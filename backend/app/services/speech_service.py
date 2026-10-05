"""Voice in and out: text-to-speech and speech-to-text."""

import base64
from typing import Optional

from fastapi import UploadFile

from ..clients import elevenlabs_client


async def synthesize_speech(text: str, voice_id: Optional[str]) -> str:
    """Return the spoken text as base64-encoded MP3."""
    audio = await elevenlabs_client.text_to_speech(text, voice_id)
    return base64.b64encode(audio).decode("utf-8")


async def transcribe_audio(file: UploadFile) -> str:
    content = await file.read()
    return await elevenlabs_client.speech_to_text(
        filename=file.filename or "audio.webm",
        content=content,
        content_type=file.content_type or "audio/webm",
    )
