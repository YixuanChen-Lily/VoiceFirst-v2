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
    proposal_id: Optional[str] = Field(
        default=None,
        description="The saved proposal being worked on, so the assistant can use its files."
    )


class ChatSource(BaseModel):
    """A passage the reply cites as [number]."""

    number: int
    document_id: str
    title: str
    section: Optional[str] = None
    page: Optional[int] = None
    origin: Literal["library", "background", "attachment"] = Field(
        default="library",
        description="The shared library, or one of the proposal's background documents or attachments.",
    )


class ChatResponse(BaseModel):
    message: str
    audio_base64: Optional[str] = None
    field_updates: Optional[Dict[str, str]] = None
    model: Optional[str] = Field(
        default=None,
        description="The chat model the router selected for this turn."
    )
    sources: List[ChatSource] = Field(
        default_factory=list,
        description="Passages cited in the reply, in citation order."
    )


class SynthesisRequest(BaseModel):
    text: str
    voice_id: Optional[str] = None


class SynthesisResponse(BaseModel):
    audio_base64: str


class TranscriptionResponse(BaseModel):
    text: str
