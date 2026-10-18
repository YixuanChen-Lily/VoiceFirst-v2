import json
from io import BytesIO
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool
from starlette.responses import StreamingResponse

from ...schemas.proposals import DraftAnalysisResponse, ProposalPayload, ProposalResponse
from ...services import analysis_service, document_parsing_service, export_service

router = APIRouter(prefix="/proposals", tags=["proposals"])


@router.post("/analyze", response_model=DraftAnalysisResponse)
async def analyze_draft(file: UploadFile = File(...)) -> DraftAnalysisResponse:
    """Analyze an uploaded proposal draft and return section-level scoring."""

    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        extracted_text = document_parsing_service.parse_document(content, file.filename or "").text
    except document_parsing_service.DocumentParsingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not extracted_text.strip():
        raise HTTPException(
            status_code=400,
            detail="Uploaded file does not contain readable text for analysis.",
        )

    return await analysis_service.analyze_text(extracted_text)


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
        export_service.build_docx_document,
        proposal,
        attachment_blobs,
    )

    filename = f"{export_service.safe_filename(proposal.project_title)}-draft-proposal.docx"
    return StreamingResponse(
        BytesIO(document_bytes),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
