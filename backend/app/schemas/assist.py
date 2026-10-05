from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class ConversationMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., description="Latest user message to send to the assistant.")
    history: List[ConversationMessage] = Field(
        default_factory=list,
        description="Chronological message history to supply to OpenAI."
    )
    voice_id: Optional[str] = Field(
        default=None,
        description="Override the default ElevenLabs voice identifier."
    )
    section: Optional[int] = Field(
        default=None,
        description="Current proposal section index to guide structured extraction."
    )


class ChatResponse(BaseModel):
    message: str
    audio_base64: Optional[str] = None
    field_updates: Optional[Dict[str, str]] = None


class SynthesisRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None


class SynthesisResponse(BaseModel):
    audio_base64: str


class TranscriptionResponse(BaseModel):
    text: str
