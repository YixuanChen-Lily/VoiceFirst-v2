"""Turn uploaded files (PDF, Word .docx, Excel .xlsx, plain text) into clean text and LangChain documents."""

import re
from dataclasses import dataclass, field
from datetime import datetime, time
from io import BytesIO
from typing import List
from zipfile import BadZipFile, ZipFile

from docx import Document as WordDocument
from docx.table import Table
from docx.text.paragraph import Paragraph
from langchain_core.documents import Document
from openpyxl import load_workbook
from pypdf import PdfReader
from pypdf.errors import FileNotDecryptedError, PyPdfError

PDF_MAGIC = b"%PDF-"
ZIP_MAGIC = b"PK\x03\x04"
LEGACY_OFFICE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"  # .doc, .xls, .ppt


class DocumentParsingError(Exception):
    """The file cannot be read as a document. The message is safe to show to the user."""


@dataclass
class ParsedDocument:
    kind: str  # "pdf", "docx", "xlsx" or "text"
    text: str
    # One entry per page for PDFs, so later features can cite a page number.
    pages: List[str] = field(default_factory=list)
    # One entry per sheet for spreadsheets, each starting with the sheet's name.
    sheets: List[str] = field(default_factory=list)


def parse_document(content: bytes, filename: str = "") -> ParsedDocument:
    """
    Read a document by its actual format, detected from the file's first bytes
    rather than its name. Paragraph breaks are kept as blank lines.
    """
    if content.startswith(PDF_MAGIC):
        return _parse_pdf(content)
    if content.startswith(ZIP_MAGIC):
        return _parse_office(content)
    if content.startswith(LEGACY_OFFICE_MAGIC):
        raise DocumentParsingError(
            "Older Office files (.doc, .xls) are not supported. "
            "Save the file as .docx, .xlsx or PDF and upload it again."
        )
    return _parse_text(content)


def extract_text(content: bytes, filename: str = "") -> str:
    """Return the document's text on a single line, with all whitespace collapsed."""
    return re.sub(r"\s+", " ", parse_document(content, filename).text)


def to_langchain_documents(parsed: ParsedDocument) -> List[Document]:
    """
    Wrap parsed text as LangChain documents, ready for a text splitter.
    A PDF becomes one document per page, tagged with its page number, and a
    spreadsheet one document per sheet.
    """
    if parsed.kind == "pdf":
        return [
            Document(page_content=page, metadata={"page": number})
            for number, page in enumerate(parsed.pages, start=1)
            if page
        ]
    if parsed.kind == "xlsx":
        return [Document(page_content=sheet) for sheet in parsed.sheets]
    return [Document(page_content=parsed.text)]


def _parse_pdf(content: bytes) -> ParsedDocument:
    """Read a PDF page by page."""
    try:
        reader = PdfReader(BytesIO(content))
        pages = [_tidy(page.extract_text() or "") for page in reader.pages]
    except FileNotDecryptedError as exc:
        raise DocumentParsingError(
            "This PDF is password-protected. Remove the password and upload it again."
        ) from exc
    except (PyPdfError, ValueError, KeyError, OSError) as exc:
        raise DocumentParsingError("This PDF could not be read. It may be damaged.") from exc

    text = "\n\n".join(page for page in pages if page)
    if not text:
        raise DocumentParsingError(
            "This PDF has no selectable text. It may be a scan; upload a text-based PDF or a Word file."
        )
    return ParsedDocument(kind="pdf", text=text, pages=pages)


UNSUPPORTED_TYPE = "This file type is not supported. Upload a PDF, a Word (.docx) or Excel (.xlsx) file, or a text file."


def _parse_office(content: bytes) -> ParsedDocument:
    """Word and Excel files are both ZIP archives; tell them apart by what is inside."""
    try:
        with ZipFile(BytesIO(content)) as archive:
            names = set(archive.namelist())
    except BadZipFile as exc:
        raise DocumentParsingError("This file could not be read. It may be damaged.") from exc
    if "word/document.xml" in names:
        return _parse_docx(content)
    if "xl/workbook.xml" in names:
        return _parse_xlsx(content)
    raise DocumentParsingError(UNSUPPORTED_TYPE)


def _parse_xlsx(content: bytes) -> ParsedDocument:
    """
    Read each sheet as rows of cells separated by " | ". Formulas give the value
    Excel last calculated, not the formula itself.
    """
    try:
        workbook = load_workbook(BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:
        raise DocumentParsingError("This Excel file could not be read. It may be damaged.") from exc

    sheets: List[str] = []
    try:
        for worksheet in workbook.worksheets:
            rows = []
            for row in worksheet.iter_rows(values_only=True):
                cells = [_cell_text(value) for value in row]
                if any(cells):
                    rows.append(" | ".join(cells).strip(" |"))
            if rows:
                sheets.append(_tidy(f"{worksheet.title}\n\n" + "\n".join(rows)))
    finally:
        workbook.close()

    if not sheets:
        raise DocumentParsingError("This spreadsheet has no filled-in cells.")
    return ParsedDocument(kind="xlsx", text="\n\n".join(sheets), sheets=sheets)


def _cell_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, datetime) and value.time() == time(0):
        return value.date().isoformat()  # a date with no time of day
    return str(value).strip()


def _parse_docx(content: bytes) -> ParsedDocument:
    try:
        document = WordDocument(BytesIO(content))
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
        raise DocumentParsingError(UNSUPPORTED_TYPE)
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
