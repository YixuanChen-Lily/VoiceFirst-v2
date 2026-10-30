"""Build the proposal as a Word document (and, on request, a zip with its attachments)."""

import re
from decimal import Decimal, InvalidOperation
from io import BytesIO
from typing import List, Optional, Sequence, Tuple
from zipfile import ZIP_DEFLATED, ZipFile

from docx import Document
from docx.document import Document as WordDocument
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

from ..schemas.proposals import ProposalDocument

NOT_FILLED = "Not filled in yet."
MUTED = RGBColor(0x6B, 0x66, 0x5F)


def safe_filename(value: str) -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9-_]+", "-", value).strip("-")
    return sanitized or "proposal"


def build_docx_document(proposal: ProposalDocument, attachment_files: Sequence[dict] = ()) -> bytes:
    """
    The whole proposal, in the order funders usually expect. `attachment_files` are the
    proposal's attachments; they are listed by name, never copied into the document.
    Parts that are still empty say so, so gaps are easy to spot before sending.
    """
    doc = Document()
    doc.styles["Normal"].font.name = "Calibri"
    doc.styles["Normal"].font.size = Pt(11)
    doc.styles["Normal"].paragraph_format.space_after = Pt(6)
    p = proposal

    title = p.projectTitle.strip() or "Untitled Project"
    doc.core_properties.title = title
    doc.core_properties.subject = p.organizationName.strip() or "Funding proposal"
    doc.core_properties.author = p.organizationName.strip() or "Community Grant Assistant"

    doc.add_heading(title, level=0)
    _facts(
        doc,
        [
            ("Submitted by", p.organizationName),
            ("Submitted to", p.fundedBy),
            ("Date", p.submissionDate),
            ("Amount requested", p.requestedAmount),
        ],
    )
    contact = [line for line in (p.contactName, p.contactPhone, p.contactEmail, p.contactAddress) if line.strip()]
    if contact:
        doc.add_heading("Contact", level=2)
        _text(doc, "\n".join(contact))

    _section(doc, "Executive Summary", [(None, p.executiveSummary)])

    doc.add_heading("Community Context", level=1)
    community = [part for part in (p.communityName.strip(), _labelled("Population", p.population)) if part]
    filled = _parts(
        doc,
        [
            ("About the community", p.communityBackground),
            ("Local economy", p.economicBaseline),
            ("Culture and land", p.culturalContext),
            ("Challenges the community faces", p.needsChallenges),
        ],
        lead=" · ".join(community),
    )
    if not filled:
        _not_filled(doc)

    _section(doc, "Problem Statement", [(None, p.problemDescription), ("Evidence", p.supportingEvidence)])

    doc.add_heading("Project Description", level=1)
    objectives = [item.strip() for item in (p.objective1, p.objective2, p.objective3) if item.strip()]
    if objectives:
        doc.add_heading("Objectives", level=2)
        for item in objectives:
            doc.add_paragraph(item, style="List Number")
    filled = _parts(
        doc,
        [
            ("Year 1 activities", p.year1Activities),
            ("Year 2 activities", p.year2Activities),
            ("Year 3 activities", p.year3Activities),
        ],
    )
    if not (objectives or filled):
        _not_filled(doc)

    doc.add_heading("Implementation Plan", level=1)
    filled = _parts(
        doc,
        [
            ("Governance", p.governanceStructure),
            ("Roles and responsibilities", p.implementationResponsibilities),
            ("Partners", p.implementationPartnerships),
        ],
    )
    milestones = [(m.name, m.date) for m in p.milestones if m.name.strip() or m.date.strip()]
    if milestones:
        doc.add_heading("Milestones", level=2)
        _table(doc, ["Milestone", "Date"], milestones)
    filled = _parts(doc, [("Key risks", p.implementationRiskOverview)]) or filled
    if not (filled or milestones):
        _not_filled(doc)

    doc.add_heading("Budget", level=1)
    amounts = [
        (label, value.strip())
        for label, value in [
            ("Total project cost", p.totalBudget),
            ("Amount requested", p.requestedAmount),
            ("Community contribution", p.communityContribution),
            ("Other funding", p.otherBudget),
            ("Staff", p.personnelBudget),
            ("Equipment", p.equipmentBudget),
            ("Training", p.trainingBudget),
            ("Promotion", p.marketingBudget),
        ]
        if value.strip()
    ]
    if amounts:
        doc.add_heading("Summary", level=2)
        _table(doc, ["Item", "Amount"], amounts)
    lines = [
        (line.category, line.description, line.amount)
        for line in p.budgetLines
        if line.description.strip() or line.amount.strip()
    ]
    if lines:
        doc.add_heading("Cost breakdown", level=2)
        total = _total([amount for _, _, amount in lines])
        _table(doc, ["Category", "Description", "Amount"], lines, total_row=("Total", "", total) if total else None)
    filled = _parts(doc, [("After the grant ends", p.sustainabilityPlan)])
    if not (amounts or lines or filled):
        _not_filled(doc)

    doc.add_heading("Expected Outcomes", level=1)
    filled = _parts(doc, [(None, p.expectedOutcomes), ("Measures of success", p.successIndicators)])
    targets = [
        (row.indicator, row.baseline, row.target, row.year)
        for row in p.indicators
        if any(cell.strip() for cell in (row.indicator, row.baseline, row.target, row.year))
    ]
    if targets:
        doc.add_heading("Targets", level=2)
        _table(doc, ["Measure", "Now", "Target", "By"], targets)
    filled = _parts(doc, [("Data collection", p.dataCollectionPlan), ("Evaluation", p.evaluationPlan)]) or filled
    if not (filled or targets):
        _not_filled(doc)

    _section(
        doc,
        "Alignment and Sustainability",
        [
            ("Community priorities", p.communityAlignment),
            ("Funder priorities", p.funderAlignment),
            ("Long-term impact", p.longTermSustainability),
            ("Summary", p.alignmentDescription),
        ],
    )

    doc.add_heading("Risk Management", level=1)
    risks = [
        (row.risk, row.likelihood.strip().capitalize(), row.mitigation)
        for row in p.riskRows
        if row.risk.strip() or row.mitigation.strip()
    ]
    if risks:
        _table(doc, ["Risk", "Likelihood", "How we will handle it"], risks)
    filled = _parts(doc, [("Summary" if risks else None, p.risksMitigation)])
    if not (risks or filled):
        _not_filled(doc)

    if attachment_files:
        doc.add_heading("Supporting Documents", level=1)
        for item in attachment_files:
            name = f"{item['label']}: {item['filename']}" if item.get("label") else item["filename"]
            doc.add_paragraph(name, style="List Bullet")

    buffer = BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


def build_zip(document_name: str, document: bytes, files: Sequence[Tuple[str, bytes]]) -> bytes:
    """The Word document plus each attachment as its own file, in an Attachments folder."""
    buffer = BytesIO()
    used: set = set()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as archive:
        archive.writestr(document_name, document)
        for filename, data in files:
            archive.writestr(f"Attachments/{_unique_name(filename, used)}", data)
    return buffer.getvalue()


def _unique_name(filename: str, used: set) -> str:
    """Keep two attachments with the same name apart: "letter.pdf", "letter (2).pdf"."""
    name = filename.replace("/", "-").replace("\\", "-").strip() or "attachment"
    stem, dot, extension = name.rpartition(".")
    if not dot:
        stem, extension = name, ""
    candidate, number = name, 2
    while candidate.lower() in used:
        candidate = f"{stem} ({number}){dot}{extension}"
        number += 1
    used.add(candidate.lower())
    return candidate


def _section(doc: WordDocument, heading: str, parts: List[Tuple[Optional[str], str]]) -> None:
    doc.add_heading(heading, level=1)
    if not _parts(doc, parts):
        _not_filled(doc)


def _parts(doc: WordDocument, parts: List[Tuple[Optional[str], str]], lead: str = "") -> bool:
    """Write each non-empty part under its own subheading. Returns whether anything was written."""
    wrote = False
    if lead:
        doc.add_paragraph().add_run(lead).bold = True
        wrote = True
    for label, text in parts:
        if not text.strip():
            continue
        if label:
            doc.add_heading(label, level=2)
        _text(doc, text)
        wrote = True
    return wrote


def _text(doc: WordDocument, text: str) -> None:
    """Blank lines start a new paragraph; single line breaks stay line breaks."""
    for block in re.split(r"\n\s*\n", text.strip()):
        paragraph = doc.add_paragraph()
        for index, line in enumerate(block.split("\n")):
            if index:
                paragraph.add_run().add_break()
            paragraph.add_run(line.strip())


def _facts(doc: WordDocument, facts: List[Tuple[str, str]]) -> None:
    for label, value in facts:
        if value.strip():
            paragraph = doc.add_paragraph()
            paragraph.paragraph_format.space_after = Pt(2)
            paragraph.add_run(f"{label}: ").bold = True
            paragraph.add_run(value.strip())


def _labelled(label: str, value: str) -> str:
    return f"{label}: {value.strip()}" if value.strip() else ""


def _not_filled(doc: WordDocument) -> None:
    run = doc.add_paragraph().add_run(NOT_FILLED)
    run.italic = True
    run.font.color.rgb = MUTED


def _table(
    doc: WordDocument,
    headers: List[str],
    rows: Sequence[Sequence[str]],
    total_row: Optional[Sequence[str]] = None,
) -> None:
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    _set_borders(table)
    for cell, header in zip(table.rows[0].cells, headers):
        cell.text = ""
        cell.paragraphs[0].add_run(header).bold = True
    for row in rows:
        cells = table.add_row().cells
        for cell, value in zip(cells, row):
            cell.text = (value or "").strip()
    if total_row:
        cells = table.add_row().cells
        for cell, value in zip(cells, total_row):
            cell.text = ""
            cell.paragraphs[0].add_run(value).bold = True
    for row in table.rows:
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_before = Pt(2)
                paragraph.paragraph_format.space_after = Pt(2)
    doc.add_paragraph()


def _set_borders(table) -> None:
    """Thin grey lines around every cell, so the table reads the same in any viewer."""
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        line = OxmlElement(f"w:{edge}")
        line.set(qn("w:val"), "single")
        line.set(qn("w:sz"), "4")
        line.set(qn("w:color"), "A8A29A")
        borders.append(line)
    table._tbl.tblPr.append(borders)


def _total(amounts: List[str]) -> str:
    """Add up amounts like "$9,200" or "1500.50". No total if any filled amount isn't a plain number."""
    total = Decimal(0)
    counted = 0
    for amount in amounts:
        cleaned = amount.replace("$", "").replace(",", "").strip()
        if not cleaned:
            continue
        try:
            total += Decimal(cleaned)
        except InvalidOperation:
            return ""
        counted += 1
    if not counted:
        return ""
    return f"${total:,.2f}" if total != total.to_integral_value() else f"${total:,.0f}"
