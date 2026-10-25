from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from starlette.concurrency import run_in_threadpool

from ...clients.supabase_storage_client import StorageError
from ...core import settings
from ...core.auth import User, get_current_user
from ...schemas.files import AddFileRequest, FileRole, MyFileOut, ProposalFileOut, UpdateFileRequest
from ...services import knowledge_service, proposal_files_service, proposal_service
from ...services.document_parsing_service import DocumentParsingError
from ...services.proposal_files_service import ProposalFile, ShelfFile

router = APIRouter(tags=["files"])


async def _run(function, *args, **kwargs):
    """Run a blocking call off the event loop and map its errors to HTTP."""
    try:
        return await run_in_threadpool(function, *args, **kwargs)
    except (knowledge_service.KnowledgeBaseNotConfigured, proposal_service.ProposalsNotConfigured) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except proposal_service.ProposalNotFound as exc:
        raise HTTPException(status_code=404, detail="Proposal not found.") from exc
    except (proposal_files_service.FileNotFound, knowledge_service.DocumentNotFound) as exc:
        raise HTTPException(status_code=404, detail="File not found.") from exc
    except proposal_files_service.FileNotInProposal as exc:
        raise HTTPException(status_code=404, detail="This file is not in the proposal.") from exc
    except proposal_files_service.BackgroundAlwaysRead as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except DocumentParsingError as exc:
        raise HTTPException(
            status_code=400, detail=f"The assistant can't read this file. {exc}"
        ) from exc
    except knowledge_service.IndexingFailed as exc:
        raise HTTPException(
            status_code=502,
            detail="The file is saved, but it could not be prepared for the assistant. Try again in a moment.",
        ) from exc
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def _my_file(item: ShelfFile) -> MyFileOut:
    record = item.record
    return MyFileOut(
        id=record.id,
        title=record.title,
        filename=record.filename,
        kind=record.kind,
        size_bytes=record.size_bytes,
        status=record.status,
        error=record.error,
        created_at=record.created_at,
        used_in=item.used_in,
    )


def _proposal_file(item: ProposalFile) -> ProposalFileOut:
    record, link = item.record, item.link
    return ProposalFileOut(
        document_id=record.id,
        title=record.title,
        filename=record.filename,
        kind=record.kind,
        size_bytes=record.size_bytes,
        status=record.status,
        error=record.error,
        role=link.role,
        label=link.label,
        use_in_chat=link.use_in_chat,
        added_at=link.created_at,
    )


async def _read_upload(file: UploadFile) -> bytes:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > settings.MAX_UPLOAD_BYTES:
        limit_mb = settings.MAX_UPLOAD_BYTES // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"File is larger than the {limit_mb} MB limit.")
    return content


# My files


@router.get("/files", response_model=List[MyFileOut])
async def list_my_files(user: User = Depends(get_current_user)) -> List[MyFileOut]:
    """The signed-in user's own files, newest first, with how many proposals use each."""
    files = await _run(proposal_files_service.list_my_files, user.id)
    return [_my_file(item) for item in files]


@router.post("/files", response_model=MyFileOut, status_code=201)
async def upload_my_file(file: UploadFile = File(...), user: User = Depends(get_current_user)) -> MyFileOut:
    """Keep a file in My files without adding it to a proposal."""
    content = await _read_upload(file)
    record, _ = await _run(
        proposal_files_service.upload_file,
        owner_id=user.id,
        content=content,
        filename=file.filename or "file",
        content_type=file.content_type or "application/octet-stream",
    )
    return _my_file(ShelfFile(record=record, used_in=0))


@router.delete("/files/{document_id}", status_code=204)
async def delete_my_file(document_id: str, user: User = Depends(get_current_user)) -> Response:
    """Delete a file from My files and from every proposal that uses it."""
    await _run(proposal_files_service.delete_file, user.id, document_id)
    return Response(status_code=204)


# A proposal's files


@router.get("/proposals/{proposal_id}/files", response_model=List[ProposalFileOut])
async def list_proposal_files(proposal_id: str, user: User = Depends(get_current_user)) -> List[ProposalFileOut]:
    files = await _run(proposal_files_service.list_proposal_files, user.id, proposal_id)
    return [_proposal_file(item) for item in files]


@router.post("/proposals/{proposal_id}/files/upload", response_model=ProposalFileOut, status_code=201)
async def upload_proposal_file(
    proposal_id: str,
    file: UploadFile = File(...),
    role: FileRole = Form("attachment"),
    label: Optional[str] = Form(None),
    use_in_chat: Optional[bool] = Form(None),
    user: User = Depends(get_current_user),
) -> ProposalFileOut:
    """Upload a new file: it is kept in My files and added to this proposal."""
    content = await _read_upload(file)
    _, added = await _run(
        proposal_files_service.upload_file,
        owner_id=user.id,
        content=content,
        filename=file.filename or "file",
        content_type=file.content_type or "application/octet-stream",
        proposal_id=proposal_id,
        role=role,
        label=(label or "").strip()[:200] or None,
        use_in_chat=use_in_chat,
    )
    return _proposal_file(added)


@router.post("/proposals/{proposal_id}/files", response_model=ProposalFileOut, status_code=201)
async def add_proposal_file(
    proposal_id: str, request: AddFileRequest, user: User = Depends(get_current_user)
) -> ProposalFileOut:
    """Add a file that is already in My files to this proposal."""
    added = await _run(
        proposal_files_service.add_to_proposal,
        owner_id=user.id,
        proposal_id=proposal_id,
        document_id=request.document_id,
        role=request.role,
        label=(request.label or "").strip() or None,
        use_in_chat=request.use_in_chat,
    )
    return _proposal_file(added)


@router.patch("/proposals/{proposal_id}/files/{document_id}", response_model=ProposalFileOut)
async def update_proposal_file(
    proposal_id: str, document_id: str, request: UpdateFileRequest, user: User = Depends(get_current_user)
) -> ProposalFileOut:
    """Switch whether the assistant may read this file in this proposal."""
    updated = await _run(
        proposal_files_service.set_use_in_chat, user.id, proposal_id, document_id, request.use_in_chat
    )
    return _proposal_file(updated)


@router.delete("/proposals/{proposal_id}/files/{document_id}", status_code=204)
async def remove_proposal_file(proposal_id: str, document_id: str, user: User = Depends(get_current_user)) -> Response:
    """Take a file out of this proposal. It stays in My files."""
    await _run(proposal_files_service.remove_from_proposal, user.id, proposal_id, document_id)
    return Response(status_code=204)
