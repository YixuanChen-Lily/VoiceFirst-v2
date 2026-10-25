from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from starlette.concurrency import run_in_threadpool

from ...clients.supabase_storage_client import StorageError
from ...core import settings
from ...core.auth import User, get_current_user
from ...schemas.documents import DocumentOut, SearchRequest, SearchResponse
from ...services import knowledge_service, proposal_files_service
from ...services.document_parsing_service import DocumentParsingError

router = APIRouter(prefix="/documents", tags=["documents"])


async def _run(function, *args, **kwargs):
    """Run a blocking knowledge-base call off the event loop and map its errors to HTTP."""
    try:
        return await run_in_threadpool(function, *args, **kwargs)
    except knowledge_service.KnowledgeBaseNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except knowledge_service.DocumentNotFound as exc:
        raise HTTPException(status_code=404, detail="Document not found.") from exc
    except knowledge_service.NotAllowed as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except DocumentParsingError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except knowledge_service.IndexingFailed as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "The file was saved but could not be indexed. Try re-indexing it.",
                "document_id": exc.record.id,
            },
        ) from exc
    except StorageError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    scope: Literal["library"] = Form("library"),
    title: Optional[str] = Form(None),
    doc_type: Optional[str] = Form(None),
    funder: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
) -> DocumentOut:
    """
    Add a document to the shared library and index it so the assistant can draw on it.
    Needs a library admin. People add their own files through /files instead.
    """
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Only library admins can add library documents.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > settings.MAX_UPLOAD_BYTES:
        limit_mb = settings.MAX_UPLOAD_BYTES // (1024 * 1024)
        raise HTTPException(status_code=413, detail=f"File is larger than the {limit_mb} MB limit.")

    record = await _run(
        knowledge_service.ingest_document,
        content=content,
        filename=file.filename or "document",
        content_type=file.content_type or "application/octet-stream",
        owner_id=user.id,
        title=title,
        doc_type=doc_type,
        funder=funder,
    )
    return DocumentOut.model_validate(record)


@router.get("", response_model=List[DocumentOut])
async def list_documents(
    scope: Optional[Literal["library", "personal"]] = None,
    user: User = Depends(get_current_user),
) -> List[DocumentOut]:
    """The shared library plus the signed-in user's own uploads."""
    records = await _run(knowledge_service.list_documents, user.id, scope=scope)
    return [DocumentOut.model_validate(record) for record in records]


@router.post("/search", response_model=SearchResponse)
async def search_documents(
    request: SearchRequest, user: User = Depends(get_current_user)
) -> SearchResponse:
    """Return the passages closest in meaning to the query."""
    document_ids = None
    if request.proposal_id:
        files = await _run(proposal_files_service.chat_files, user.id, request.proposal_id)
        document_ids = proposal_files_service.readable_document_ids(files)
    results = await _run(
        knowledge_service.search, request.query, user.id, document_ids=document_ids, k=request.k
    )
    return SearchResponse(results=results)


@router.post("/{document_id}/reindex", response_model=DocumentOut)
async def reindex_document(document_id: str, user: User = Depends(get_current_user)) -> DocumentOut:
    record = await _run(knowledge_service.reindex_document, document_id, user.id, user.is_admin)
    return DocumentOut.model_validate(record)


@router.delete("/{document_id}", status_code=204)
async def delete_document(document_id: str, user: User = Depends(get_current_user)) -> Response:
    await _run(knowledge_service.delete_document, document_id, user.id, user.is_admin)
    return Response(status_code=204)
