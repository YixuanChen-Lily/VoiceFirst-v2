"""Thin wrapper around Supabase Storage, where the original uploaded files are kept."""

from urllib.parse import quote

import httpx

from ..core import settings

_TIMEOUT_SECONDS = 60.0


class StorageError(Exception):
    """Supabase Storage rejected a request."""


def is_configured() -> bool:
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY)


def _headers() -> dict:
    key = settings.SUPABASE_SERVICE_KEY
    return {"Authorization": f"Bearer {key}", "apikey": key}


def _object_url(path: str) -> str:
    base = settings.SUPABASE_URL.rstrip("/")
    return f"{base}/storage/v1/object/{settings.SUPABASE_BUCKET}/{quote(path)}"


def ensure_bucket() -> None:
    """Create the private bucket if it does not exist yet."""
    url = f"{settings.SUPABASE_URL.rstrip('/')}/storage/v1/bucket"
    body = {"id": settings.SUPABASE_BUCKET, "name": settings.SUPABASE_BUCKET, "public": False}
    response = httpx.post(url, headers=_headers(), json=body, timeout=_TIMEOUT_SECONDS)
    already_exists = response.status_code in (400, 409) and "exist" in response.text.lower()
    if response.status_code != httpx.codes.OK and not already_exists:
        raise StorageError(f"Could not create storage bucket: {response.text}")


def upload(path: str, content: bytes, content_type: str) -> None:
    headers = {**_headers(), "Content-Type": content_type, "x-upsert": "true"}
    response = httpx.post(_object_url(path), headers=headers, content=content, timeout=_TIMEOUT_SECONDS)
    if response.status_code != httpx.codes.OK:
        raise StorageError(f"Could not store the file: {response.text}")


def download(path: str) -> bytes:
    response = httpx.get(_object_url(path), headers=_headers(), timeout=_TIMEOUT_SECONDS)
    if response.status_code != httpx.codes.OK:
        raise StorageError(f"Could not fetch the stored file: {response.text}")
    return response.content


def delete(path: str) -> None:
    response = httpx.delete(_object_url(path), headers=_headers(), timeout=_TIMEOUT_SECONDS)
    if response.status_code not in (httpx.codes.OK, httpx.codes.NOT_FOUND):
        raise StorageError(f"Could not delete the stored file: {response.text}")
