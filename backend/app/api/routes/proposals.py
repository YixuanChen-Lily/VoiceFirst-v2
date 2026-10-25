import json
from io import BytesIO
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from starlette.concurrency import run_in_threadpool
from starlette.responses import StreamingResponse

from ...core.auth import User, get_current_user
from ...schemas.proposals import (
    DraftAnalysisResponse,
    ProposalPayload,
    ProposalSaveRequest,
    ProposalSummary,
    SavedProposal,
)
from ...services import (
    analysis_service,
    document_parsing_service,
    export_service,
    knowledge_service,
    proposal_files_service,
    proposal_service,
)

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
    proposal_id: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
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

    stored_files = await _stored_files(user.id, proposal_id) if proposal_id else []

    document_bytes = await run_in_threadpool(
        export_service.build_docx_document,
        proposal,
        attachment_blobs,
        stored_files,
    )

    filename = f"{export_service.safe_filename(proposal.project_title)}-draft-proposal.docx"
    return StreamingResponse(
        BytesIO(document_bytes),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


async def _stored_files(user_id: str, proposal_id: str) -> List[dict]:
    """The files kept with the saved proposal, for the export. None when file storage is not set up."""
    try:
        files = await run_in_threadpool(proposal_files_service.list_proposal_files, user_id, proposal_id)
    except (knowledge_service.KnowledgeBaseNotConfigured, proposal_service.ProposalsNotConfigured):
        return []
    except proposal_service.ProposalNotFound as exc:
        raise HTTPException(status_code=404, detail="Proposal not found.") from exc
    return [
        {"filename": item.record.filename, "label": item.link.label, "size_bytes": item.record.size_bytes}
        for item in files
    ]


async def _run(function, *args):
    """Run a blocking proposal call off the event loop and map its errors to HTTP."""
    try:
        return await run_in_threadpool(function, *args)
    except proposal_service.ProposalsNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except proposal_service.ProposalNotFound as exc:
        raise HTTPException(status_code=404, detail="Proposal not found.") from exc
    except proposal_service.ProposalTooLarge as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc


@router.post("", response_model=SavedProposal, status_code=201)
async def create_proposal(request: ProposalSaveRequest, user: User = Depends(get_current_user)) -> SavedProposal:
    """Save a new proposal for the signed-in user."""
    record = await _run(proposal_service.create_proposal, user.id, request.data)
    return SavedProposal.model_validate(record)


@router.get("", response_model=List[ProposalSummary])
async def list_proposals(user: User = Depends(get_current_user)) -> List[ProposalSummary]:
    """The signed-in user's proposals, most recently saved first."""
    records = await _run(proposal_service.list_proposals, user.id)
    return [ProposalSummary.model_validate(record) for record in records]


@router.get("/{proposal_id}", response_model=SavedProposal)
async def get_proposal(proposal_id: str, user: User = Depends(get_current_user)) -> SavedProposal:
    record = await _run(proposal_service.get_proposal, proposal_id, user.id)
    return SavedProposal.model_validate(record)


@router.put("/{proposal_id}", response_model=SavedProposal)
async def save_proposal(
    proposal_id: str, request: ProposalSaveRequest, user: User = Depends(get_current_user)
) -> SavedProposal:
    record = await _run(proposal_service.save_proposal, proposal_id, user.id, request.data)
    return SavedProposal.model_validate(record)


@router.delete("/{proposal_id}", status_code=204)
async def delete_proposal(proposal_id: str, user: User = Depends(get_current_user)) -> Response:
    await _run(proposal_service.delete_proposal, proposal_id, user.id)
    # The files stay in My files; only their links to this proposal go.
    await run_in_threadpool(proposal_files_service.forget_proposal, user.id, proposal_id)
    return Response(status_code=204)
