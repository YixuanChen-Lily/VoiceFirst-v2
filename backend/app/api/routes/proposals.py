import base64
import json
import logging
import os
import re
from datetime import datetime
from io import BytesIO
from typing import List, Optional
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from starlette.responses import StreamingResponse

try:  # pragma: no cover - optional dependency
    from openai import OpenAI
except ImportError:  # pragma: no cover - gracefully handle missing package
    OpenAI = None  # type: ignore[assignment]

router = APIRouter(prefix="/proposals", tags=["proposals"])

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-6-luna")
OPENAI_ANALYSIS_MODEL = os.getenv("OPENAI_ANALYSIS_MODEL", "gpt-6.1-sol")


class DraftAnalysis(BaseModel):
    section: str = Field(..., description="Proposal section identifier")
    summary: str = Field(..., description="Auto-generated summary or findings")
    recommendations: List[str] = Field(
        default_factory=list,
        description="Actionable recommendations derived from the draft content",
    )
    score: int = Field(
        0,
        ge=0,
        le=100,
        description="Section competitiveness score between 0 and 100",
    )


class ProposalPayload(BaseModel):
    project_title: str
    organization_name: str
    submission_date: Optional[str] = None
    executive_summary: Optional[str] = None
    community_background: Optional[str] = None
    problem_description: Optional[str] = None
    objectives: List[str] = Field(default_factory=list)
    milestones: List[str] = Field(default_factory=list)
    requested_amount: Optional[str] = None
    risks: Optional[str] = None


class ProposalResponse(BaseModel):
    message: str
    proposal_id: str


def _safe_filename(value: str) -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9-_]+", "-", value).strip("-")
    return sanitized or "proposal"


@router.post("/analyze", response_model=List[DraftAnalysis])
async def analyze_draft(file: UploadFile = File(...)) -> List[DraftAnalysis]:
    """Analyze an uploaded proposal draft and return section-level scoring."""

    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    extracted_text = _extract_text(content)
    if not extracted_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Uploaded file does not contain readable text for analysis.",
        )

    if OPENAI_API_KEY and OpenAI is not None:
        try:
            return await _analyze_with_openai(extracted_text)
        except HTTPException:
            raise
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("OpenAI analysis failed, falling back to heuristic scoring: %s", exc)

    return _fallback_analysis(extracted_text)


@router.post("/export")
async def export_proposal(
    payload: str = Form(...),
    attachments: List[UploadFile] = File(default_factory=list),
):
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Invalid JSON payload.") from exc

    try:
        proposal = ProposalPayload(**data)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    attachment_blobs = []
    for upload in attachments:
        content = await upload.read()
        attachment_blobs.append(
            {
                "filename": upload.filename or "attachment",
                "content_type": upload.content_type or "application/octet-stream",
                "data": content,
            }
        )

    document_bytes = await run_in_threadpool(
        _build_docx_document,
        proposal,
        attachment_blobs,
    )

    filename = f"{_safe_filename(proposal.project_title)}-draft-proposal.docx"
    return StreamingResponse(
        BytesIO(document_bytes),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


def _get_openai_client() -> OpenAI:
    if not OPENAI_API_KEY or OpenAI is None:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured.")
    return OpenAI(api_key=OPENAI_API_KEY)


async def _analyze_with_openai(text: str) -> List[DraftAnalysis]:
    client = _get_openai_client()

    condensed_text = text if len(text) <= 15000 else text[:15000]

    system_prompt = (
        "You are an expert grant reviewer. Assess the provided proposal text and "
        "score each major section between 0 and 100. Return JSON with a `sections` "
        "array. Each element must include `section`, `summary`, `recommendations` "
        "(array of strings), and `score` (integer)."
    )

    def _run_completion():
        return client.chat.completions.create(
            model=OPENAI_ANALYSIS_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": "Analyze the following proposal and respond with JSON only.\n\n" + condensed_text,
                },
            ],
        )

    completion = await run_in_threadpool(_run_completion)

    try:
        payload = completion.choices[0].message.content or "{}"
    except (AttributeError, IndexError) as exc:  # pragma: no cover - defensive guard
        raise ValueError("Unexpected response from analysis model.") from exc

    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:  # pragma: no cover - propagate parse failure
        raise ValueError("Unable to parse AI analysis response.") from exc

    sections = data.get("sections")
    if not isinstance(sections, list):
        raise ValueError("AI analysis response missing sections array.")

    results: List[DraftAnalysis] = []
    for section in sections:
        if not isinstance(section, dict):
            continue
        name = str(section.get("section") or section.get("name") or "Unknown Section")
        summary = str(section.get("summary") or "")
        recommendations = section.get("recommendations") or []
        if not isinstance(recommendations, list):
            recommendations = [str(recommendations)]

        score_raw = section.get("score")
        try:
            score = int(float(score_raw))
        except (TypeError, ValueError):
            score = 0

        score = max(0, min(100, score))

        results.append(
            DraftAnalysis(
                section=name,
                summary=summary,
                recommendations=[str(rec) for rec in recommendations if str(rec).strip()],
                score=score,
            )
        )

    if not results:
        raise ValueError("AI analysis did not return any sections.")

    return results


def _extract_text(content: bytes) -> str:
    """Attempt to decode uploaded content into text."""

    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            decoded = content.decode(encoding)
            return re.sub(r"\s+", " ", decoded)
        except UnicodeDecodeError:
            continue
    return ""


def _fallback_analysis(text: str) -> List[DraftAnalysis]:
    """Provide a deterministic heuristic analysis when AI is unavailable."""

    lower_text = text.lower()
    word_count = max(len(text.split()), 1)

    section_keywords = {
        "Executive Summary": ["executive", "summary", "overview"],
        "Community Context": ["community", "population", "needs", "demographic"],
        "Problem Statement": ["problem", "challenge", "issue"],
        "Project Description": ["project", "activities", "implementation"],
        "Budget": ["budget", "cost", "funding"],
        "Outcomes": ["outcome", "impact", "result"],
        "Risk Management": ["risk", "mitigation", "contingency"],
    }

    results: List[DraftAnalysis] = []
    for name, keywords in section_keywords.items():
        matches = sum(1 for keyword in keywords if keyword in lower_text)
        coverage_bonus = min(30, int(word_count / 200))
        score = 40 + matches * 12 + coverage_bonus
        score = max(30, min(92, score))

        if matches == 0:
            summary = f"{name} section appears to be missing or very light in detail."
            recommendations = [
                f"Add a dedicated section for {name.lower()} with clear specifics and quantifiable details.",
            ]
        else:
            summary = f"{name} content detected with {matches} key signal{'s' if matches == 1 else 's'}."
            recommendations = []
            if score < 75:
                recommendations.append(
                    f"Strengthen the {name.lower()} section with more evidence and funder-aligned language."
                )

        results.append(
            DraftAnalysis(
                section=name,
                summary=summary,
                recommendations=recommendations,
                score=score,
            )
        )

    return results


def _build_docx_document(proposal: ProposalPayload, attachments: List[dict]) -> bytes:
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


@router.post("", response_model=ProposalResponse, status_code=201)
async def create_proposal(payload: ProposalPayload) -> ProposalResponse:
    """
    Accept a structured proposal payload and return a mock identifier.

    Hook this into persistence once a database layer is decided.
    """
    proposal_id = f"proposal-{payload.project_title.lower().replace(' ', '-')}"
    return ProposalResponse(
        message="Proposal accepted for processing.",
        proposal_id=proposal_id,
    )
