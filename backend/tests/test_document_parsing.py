"""Reading PDF, Word and text uploads into clean text."""

import json
from io import BytesIO
from zipfile import ZipFile

import pytest
from docx import Document
from pypdf import PdfWriter

from backend.app.services.document_parsing_service import (
    DocumentParsingError,
    extract_text,
    parse_document,
)

from .conftest import OPENAI_CHAT_URL, openai_completion, sent_json


def make_pdf(*pages: str) -> bytes:
    """Build a small text PDF, one string per page."""
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"",  # page tree, filled in below
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    kids = []
    for text in pages:
        escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = f"BT /F1 12 Tf 72 720 Td ({escaped}) Tj ET".encode()
        content_id = len(objects) + 1
        objects.append(b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream))
        page_id = len(objects) + 1
        objects.append(
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 3 0 R >> >> /Contents %d 0 R >>" % content_id
        )
        kids.append(b"%d 0 R" % page_id)
    objects[1] = b"<< /Type /Pages /Kids [%s] /Count %d >>" % (b" ".join(kids), len(kids))

    out = BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(b"%d 0 obj\n%s\nendobj\n" % (number, body))
    xref_at = out.tell()
    out.write(b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1))
    for offset in offsets:
        out.write(b"%010d 00000 n \n" % offset)
    out.write(b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref_at))
    return out.getvalue()


def make_docx() -> bytes:
    document = Document()
    document.add_heading("Executive Summary", level=1)
    document.add_paragraph("Riverbend Youth Hub will renovate the old band office.")
    table = document.add_table(rows=2, cols=2)
    table.cell(0, 0).text = "Item"
    table.cell(0, 1).text = "Cost"
    table.cell(1, 0).text = "Renovation"
    table.cell(1, 1).text = "$180,000"
    document.add_paragraph("We request $250,000 in total.")
    out = BytesIO()
    document.save(out)
    return out.getvalue()


def test_pdf_text_is_read_page_by_page():
    parsed = parse_document(make_pdf("Executive Summary: a youth hub.", "Budget: $250,000."))

    assert parsed.kind == "pdf"
    assert parsed.pages == ["Executive Summary: a youth hub.", "Budget: $250,000."]
    assert parsed.text == "Executive Summary: a youth hub.\n\nBudget: $250,000."


def test_docx_paragraphs_and_tables_are_read_in_order():
    parsed = parse_document(make_docx())

    assert parsed.kind == "docx"
    assert parsed.text == (
        "Executive Summary\n\n"
        "Riverbend Youth Hub will renovate the old band office.\n\n"
        "Item | Cost\n\n"
        "Renovation | $180,000\n\n"
        "We request $250,000 in total."
    )


def test_plain_text_keeps_paragraph_breaks_and_trims_spacing():
    parsed = parse_document(b"Title  \r\n\r\n\r\n\r\n  First   paragraph.\r\nSecond line.\n")

    assert parsed.kind == "text"
    assert parsed.text == "Title\n\nFirst paragraph.\nSecond line."


@pytest.mark.parametrize(
    "content, expected",
    [
        ("Café résumé".encode("utf-8"), "Café résumé"),
        ("﻿Café".encode("utf-8"), "Café"),  # UTF-8 with a byte-order mark
        ("Café".encode("utf-16"), "Café"),
        ("Café – naïve".encode("cp1252"), "Café – naïve"),  # legacy Windows text
    ],
)
def test_plain_text_encodings(content, expected):
    assert parse_document(content).text == expected


def test_extract_text_collapses_everything_onto_one_line():
    assert extract_text(make_docx()).startswith(
        "Executive Summary Riverbend Youth Hub will renovate the old band office. Item | Cost"
    )


def test_format_is_detected_from_content_not_the_file_name():
    assert parse_document(make_pdf("Hello."), filename="notes.txt").kind == "pdf"


@pytest.mark.parametrize(
    "content, message",
    [
        (make_pdf(""), "no selectable text"),
        (b"%PDF-1.4\nthis is not really a pdf", "could not be read"),
        (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 64, "Older Office files"),
        (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR", "not supported"),
        (b"PK\x03\x04not a real zip", "could not be read"),
    ],
)
def test_unreadable_files_raise_a_clear_error(content, message):
    with pytest.raises(DocumentParsingError, match=message):
        parse_document(content)


def test_zip_that_is_not_a_word_file_is_rejected():
    out = BytesIO()
    with ZipFile(out, "w") as archive:
        archive.writestr("xl/workbook.xml", "<workbook/>")

    with pytest.raises(DocumentParsingError, match="not supported"):
        parse_document(out.getvalue())


def test_password_protected_pdf_is_rejected():
    writer = PdfWriter(clone_from=BytesIO(make_pdf("Secret.")))
    writer.encrypt("hunter2")
    out = BytesIO()
    writer.write(out)

    with pytest.raises(DocumentParsingError, match="password-protected"):
        parse_document(out.getvalue())


def _analyze(client, name: str, content: bytes):
    return client.post("/api/proposals/analyze", files={"file": (name, content, "application/octet-stream")})


@pytest.mark.parametrize(
    "name, content, expected_phrase",
    [
        ("draft.pdf", make_pdf("Executive Summary: a youth hub."), "Executive Summary: a youth hub."),
        ("draft.docx", make_docx(), "Riverbend Youth Hub will renovate the old band office."),
    ],
)
def test_analyze_sends_real_document_text_to_the_model(client, mock_api, name, content, expected_phrase):
    openai = mock_api.post(OPENAI_CHAT_URL).mock(
        return_value=openai_completion(json.dumps({"sections": [{"section": "A", "score": 70}]}))
    )

    response = _analyze(client, name, content)

    assert response.status_code == 200
    sent = sent_json(openai)["messages"][1]["content"]
    assert expected_phrase in sent
    assert "%PDF" not in sent and "PK\x03\x04" not in sent


def test_analyze_explains_why_a_file_cannot_be_read(client, mock_api):
    response = _analyze(client, "scan.pdf", make_pdf(""))

    assert response.status_code == 400
    assert response.json()["detail"].startswith("This PDF has no selectable text.")
