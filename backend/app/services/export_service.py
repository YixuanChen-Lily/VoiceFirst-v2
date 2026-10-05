"""Build the exported proposal as a .docx file."""

import base64
import re
from datetime import datetime
from io import BytesIO
from typing import List
from zipfile import ZIP_DEFLATED, ZipFile

from ..schemas.proposals import ProposalPayload


def safe_filename(value: str) -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9-_]+", "-", value).strip("-")
    return sanitized or "proposal"


def build_docx_document(proposal: ProposalPayload, attachments: List[dict]) -> bytes:
    buffer = BytesIO()

    document_xml = _build_document_xml(proposal, attachments)
    core_xml = _build_core_properties(proposal)
    app_xml = _build_app_properties()

    with ZipFile(buffer, "w", ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", _build_content_types())
        docx.writestr("_rels/.rels", _build_root_rels())
        docx.writestr("docProps/core.xml", core_xml)
        docx.writestr("docProps/app.xml", app_xml)
        docx.writestr("word/document.xml", document_xml)
        docx.writestr("word/_rels/document.xml.rels", _build_document_rels())

    return buffer.getvalue()


def _build_content_types() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
        '</Types>'
    )


def _build_root_rels() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        '</Relationships>'
    )


def _build_document_rels() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships" />'
    )


def _build_core_properties(proposal: ProposalPayload) -> str:
    now = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    title = _xml_escape(proposal.project_title or "Untitled Project")
    subject = _xml_escape(proposal.organization_name or "Proposal")
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<cp:coreProperties '
        'xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        'xmlns:dc="http://purl.org/dc/elements/1.1/" '
        'xmlns:dcterms="http://purl.org/dc/terms/" '
        'xmlns:dcmitype="http://purl.org/dc/dcmitype/" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        f'<dc:title>{title}</dc:title>'
        f'<dc:subject>{subject}</dc:subject>'
        '<dc:creator>Proposal Builder</dc:creator>'
        '<cp:keywords>proposal, export</cp:keywords>'
        '<cp:lastModifiedBy>Proposal Builder</cp:lastModifiedBy>'
        f'<dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>'
        f'<dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>'
        '</cp:coreProperties>'
    )


def _build_app_properties() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
        '<Application>Proposal Builder</Application>'
        '<DocSecurity>0</DocSecurity>'
        '<ScaleCrop>0</ScaleCrop>'
        '<HeadingPairs><vt:vector size="1" baseType="variant"><vt:variant><vt:lpstr>Title</vt:lpstr></vt:variant></vt:vector></HeadingPairs>'
        '<TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>Proposal</vt:lpstr></vt:vector></TitlesOfParts>'
        '</Properties>'
    )


def _build_document_xml(proposal: ProposalPayload, attachments: List[dict]) -> str:
    paragraphs: List[str] = []

    def add_heading(text: str) -> None:
        paragraphs.append(
            '<w:p><w:r><w:rPr><w:b/></w:rPr>'
            f'<w:t>{_xml_escape(text)}</w:t></w:r></w:p>'
        )

    def add_paragraph(text: str) -> None:
        escaped = _xml_escape(text or "")
        parts = escaped.split("\\n")
        run = '</w:t><w:br/><w:t>'.join(parts)
        paragraphs.append(f'<w:p><w:r><w:t xml:space="preserve">{run}</w:t></w:r></w:p>')

    def add_blank() -> None:
        paragraphs.append('<w:p/>')

    add_heading(proposal.project_title or "Untitled Project")
    add_paragraph(f"Organization: {proposal.organization_name or 'Unknown'}")
    if proposal.submission_date:
        add_paragraph(f"Submission Date: {proposal.submission_date}")

    add_blank()

    sections = [
        ("Executive Summary", proposal.executive_summary),
        ("Community Context", proposal.community_background),
        ("Problem Statement", proposal.problem_description),
    ]

    if proposal.objectives:
        sections.append(("Objectives", "\n".join(f"- {item}" for item in proposal.objectives)))

    if proposal.milestones:
        sections.append(("Milestones", "\n".join(f"- {item}" for item in proposal.milestones)))

    if proposal.requested_amount:
        sections.append(("Requested Amount", proposal.requested_amount))

    if proposal.risks:
        sections.append(("Risk Mitigation", proposal.risks))

    for title, body in sections:
        add_heading(title)
        add_paragraph(body or "Information pending.")
        add_blank()

    if attachments:
        add_heading("Attachments")
        for item in attachments:
            filename = item["filename"]
            size = len(item["data"])
            size_kb = f"{size / 1024:.1f} KB"
            add_paragraph(f"Attachment: {filename} ({size_kb})")
            if _is_text_attachment(item["content_type"], filename):
                try:
                    text_content = item["data"].decode("utf-8")
                except UnicodeDecodeError:
                    text_content = item["data"].decode("latin-1", errors="replace")
                add_paragraph(text_content)
            else:
                encoded = base64.b64encode(item["data"]).decode("ascii")
                add_paragraph("Binary file (base64 encoded):")
                for chunk_start in range(0, len(encoded), 76):
                    add_paragraph(encoded[chunk_start : chunk_start + 76])
            add_blank()

    add_heading("Updated Proposal (Plain Text)")
    plain_text_sections = []
    for title, body in sections:
        plain_text_sections.append(f"{title}\n{body or 'Information pending.'}\n")
    add_paragraph("\n".join(plain_text_sections))

    document_body = "".join(paragraphs)
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f'<w:body>{document_body}<w:sectPr/></w:body>'
        '</w:document>'
    )


def _is_text_attachment(content_type: str, filename: str) -> bool:
    if content_type.startswith("text/"):
        return True
    return bool(re.search(r"\.(txt|md|csv|json)$", filename, re.IGNORECASE))


def _xml_escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )
