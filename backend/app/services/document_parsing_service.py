"""Turn uploaded files (PDF, Word .docx, plain text) into clean text."""

import re
from dataclasses import dataclass, field
from io import BytesIO
from typing import List
from zipfile import BadZipFile, ZipFile

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from pypdf import PdfReader
from pypdf.errors import PyPdfError

PDF_MAGIC = b"%PDF-"
ZIP_MAGIC = b"PK\x03\x04"
LEGACY_OFFICE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"  # .doc, .xls, .ppt


class DocumentParsingError(Exception):
    """The file cannot be read as a document. The message is safe to show to the user."""


@dataclass
class ParsedDocument:
    kind: str  # "pdf", "docx" or "text"
    text: str
    # One entry per page for PDFs, so later features can cite a page number.
    pages: List[str] = field(default_factory=list)


def parse_document(content: bytes, filename: str = "") -> ParsedDocument:
    """
    Read a document by its actual format, detected from the file's first bytes
    rather than its name. Paragraph breaks are kept as blank lines.
    """
    if content.startswith(PDF_MAGIC):
        return _parse_pdf(content)
    if content.startswith(ZIP_MAGIC):
        return _parse_docx(content)
    if content.startswith(LEGACY_OFFICE_MAGIC):
        raise DocumentParsingError(
            "Older Office files (.doc) are not supported. Save the file as .docx or PDF and upload it again."
        )
    return _parse_text(content)


def extract_text(content: bytes, filename: str = "") -> str:
    """Return the document's text on a single line, with all whitespace collapsed."""
    return re.sub(r"\s+", " ", parse_document(content, filename).text)


def _parse_pdf(content: bytes) -> ParsedDocument:
    try:
        reader = PdfReader(BytesIO(content))
        if reader.is_encrypted and not reader.decrypt(""):
            raise DocumentParsingError(
                "This PDF is password-protected. Remove the password and upload it again."
            )
        pages = [_tidy(page.extract_text() or "") for page in reader.pages]
    except DocumentParsingError:
        raise
    except (PyPdfError, ValueError, KeyError, OSError) as exc:
        raise DocumentParsingError("This PDF could not be read. It may be damaged.") from exc

    text = "\n\n".join(page for page in pages if page)
    if not text:
        raise DocumentParsingError(
            "This PDF has no selectable text. It may be a scan; upload a text-based PDF or a Word file."
        )
    return ParsedDocument(kind="pdf", text=text, pages=pages)


def _parse_docx(content: bytes) -> ParsedDocument:
    try:
        with ZipFile(BytesIO(content)) as archive:
            is_word = "word/document.xml" in archive.namelist()
    except BadZipFile as exc:
        raise DocumentParsingError("This file could not be read. It may be damaged.") from exc
    if not is_word:
        raise DocumentParsingError(
            "This file type is not supported. Upload a PDF, a Word (.docx) file or a text file."
        )

    try:
        document = Document(BytesIO(content))
    except Exception as exc:
        raise DocumentParsingError("This Word file could not be read. It may be damaged.") from exc

    blocks: List[str] = []
    for item in document.iter_inner_content():
        if isinstance(item, Paragraph):
            blocks.append(item.text)
        elif isinstance(item, Table):
            for row in item.rows:
                # Merged cells repeat in a row; keep each distinct cell once.
                cells = list(dict.fromkeys(cell.text.strip() for cell in row.cells))
                blocks.append(" | ".join(cell for cell in cells if cell))

    return ParsedDocument(kind="docx", text=_tidy("\n\n".join(blocks)))


def _parse_text(content: bytes) -> ParsedDocument:
    if content.startswith((b"\xff\xfe", b"\xfe\xff")):
        text = content.decode("utf-16", errors="replace")
    elif b"\x00" in content:
        # Text files do not contain NUL bytes; this is some other binary format.
        raise DocumentParsingError(
            "This file type is not supported. Upload a PDF, a Word (.docx) file or a text file."
        )
    else:
        try:
            text = content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = content.decode("cp1252", errors="replace")
    return ParsedDocument(kind="text", text=_tidy(text))


def _tidy(text: str) -> str:
    """Trim each line, collapse runs of spaces, and keep at most one blank line in a row."""
    lines = [re.sub(r"[ \t\f\v]+", " ", line).strip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
