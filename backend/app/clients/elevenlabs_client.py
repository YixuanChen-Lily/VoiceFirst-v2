"""Thin wrapper around the ElevenLabs HTTP API. Services call this, never httpx."""

from typing import Optional

import httpx
from fastapi import HTTPException

from ..core import settings


def _require_api_key() -> str:
    if not settings.ELEVENLABS_API_KEY:
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not configured.")
    return settings.ELEVENLABS_API_KEY


async def text_to_speech(text: str, voice_id: Optional[str] = None) -> bytes:
    """Synthesize speech and return the MP3 bytes."""
    api_key = _require_api_key()

    effective_voice_id = voice_id or settings.ELEVENLABS_VOICE_ID
    url = f"{settings.ELEVENLABS_TTS_BASE_URL.rstrip('/')}/{effective_voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": settings.ELEVENLABS_TTS_MODEL_ID,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, headers=headers, json=payload)

    if response.status_code != httpx.codes.OK:
        raise HTTPException(status_code=502, detail=f"Text-to-speech failed: {response.text}")

    return response.content


async def speech_to_text(*, filename: str, content: bytes, content_type: str) -> str:
    """Transcribe an audio recording and return its text."""
    api_key = _require_api_key()

    headers = {
        "xi-api-key": api_key,
        "Accept": "application/json",
    }
    data = {"model_id": settings.ELEVENLABS_STT_MODEL_ID}

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            settings.ELEVENLABS_STT_ENDPOINT,
            headers=headers,
            data=data,
            files={"file": (filename, content, content_type)},
        )

    if response.status_code != httpx.codes.OK:
        raise HTTPException(status_code=502, detail=f"Speech-to-text failed: {response.text}")

    text = response.json().get("text")
    if not text:
        raise HTTPException(status_code=502, detail="Speech-to-text response missing text field.")
    return text
