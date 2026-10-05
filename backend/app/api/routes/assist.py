import base64
import json
import os
from typing import Dict, List, Literal, Optional

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None  # type: ignore[assignment]


router = APIRouter(prefix="/assist", tags=["assist"])

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")
ELEVENLABS_TTS_MODEL_ID = os.getenv("ELEVENLABS_TTS_MODEL_ID", "eleven_multilingual_v2")
ELEVENLABS_TTS_BASE_URL = os.getenv("ELEVENLABS_TTS_BASE_URL", "https://api.elevenlabs.io/v1/text-to-speech")
ELEVENLABS_STT_MODEL_ID = os.getenv("ELEVENLABS_STT_MODEL_ID", "scribe_v2")
ELEVENLABS_STT_ENDPOINT = os.getenv("ELEVENLABS_STT_ENDPOINT", "https://api.elevenlabs.io/v1/speech-to-text")
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-6-luna")

SECTION_FIELD_CONFIG: Dict[int, Dict[str, List[str]]] = {
    0: {
        "description": "Quick start intake overview",
        "fields": [
            "projectTitle",
            "organizationName",
            "executiveSummary",
            "problemDescription",
            "expectedOutcomes",
            "objective1",
            "communityBackground",
            "needsChallenges",
        ],
    },
    1: {
        "description": "Cover Page details",
        "fields": [
            "projectTitle",
            "organizationName",
            "submissionDate",
            "contactName",
            "contactPhone",
            "contactEmail",
            "contactAddress",
            "fundedBy",
        ],
    },
    2: {
        "description": "Executive Summary narrative",
        "fields": ["executiveSummary"],
    },
    3: {
        "description": "Community and background context",
        "fields": [
            "communityName",
            "population",
            "communityBackground",
            "economicBaseline",
            "culturalContext",
            "needsChallenges",
        ],
    },
    4: {
        "description": "Problem / Opportunity statement details",
        "fields": ["problemDescription", "supportingEvidence"],
    },
    5: {
        "description": "Project objectives and yearly activities",
        "fields": [
            "objective1",
            "objective2",
            "objective3",
            "year1Activities",
            "year2Activities",
            "year3Activities",
        ],
    },
    6: {
        "description": "Implementation plan details",
        "fields": [
            "governanceStructure",
            "implementationResponsibilities",
            "implementationPartnerships",
            "implementationRiskOverview",
        ],
    },
    7: {
        "description": "Budget and financial plan",
        "fields": [
            "totalBudget",
            "requestedAmount",
            "communityContribution",
            "personnelBudget",
            "equipmentBudget",
            "trainingBudget",
            "marketingBudget",
            "otherBudget",
            "sustainabilityPlan",
        ],
    },
    8: {
        "description": "Expected outcomes and evaluation plans",
        "fields": [
            "expectedOutcomes",
            "successIndicators",
            "dataCollectionPlan",
            "evaluationPlan",
        ],
    },
    9: {
        "description": "Alignment with priorities and sustainability",
        "fields": [
            "communityAlignment",
            "funderAlignment",
            "longTermSustainability",
        ],
    },
    10: {
        "description": "Risk management overview",
        "fields": ["risksMitigation"],
    },
}


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


def _get_openai_client() -> OpenAI:
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured.")
    if OpenAI is None:
        raise HTTPException(status_code=500, detail="openai package not installed on server.")
    return OpenAI(api_key=OPENAI_API_KEY)


def _build_format_instruction(section: Optional[int]) -> Optional[str]:
    if section is None:
        return None
    config = SECTION_FIELD_CONFIG.get(section)
    if not config:
        return None
    allowed_fields = ", ".join(config["fields"])
    description = config.get("description", "the current section")
    return (
        f"You are extracting structured data for {description}. "
        "Respond strictly with a JSON object shaped as "
        '{"chat_reply": "<natural language response for the user>", '
        '"field_updates": { "<field>": "<value>" }}. '
        f"Only include keys in field_updates from this allowlist: {allowed_fields}. "
        "If you have no structured updates, return an empty object for field_updates. "
        "All field values must be plain strings without markdown or trailing commentary. "
        "Do not wrap the JSON in code fences or include text outside the JSON object."
    )


def _parse_structured_response(content: str) -> tuple[str, Optional[Dict[str, str]]]:
    stripped = content.strip()
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        if "\n" in stripped:
            stripped = stripped.split("\n", 1)[1]

    try:
        payload = json.loads(stripped)
    except json.JSONDecodeError:
        return content, None

    chat_reply = payload.get("chat_reply")
    if not isinstance(chat_reply, str) or not chat_reply.strip():
        chat_reply = content

    raw_updates = payload.get("field_updates")
    field_updates: Optional[Dict[str, str]] = None
    if isinstance(raw_updates, dict):
        extracted: Dict[str, str] = {}
        for key, value in raw_updates.items():
            if isinstance(value, str) and value.strip():
                extracted[key] = value.strip()
        if extracted:
            field_updates = extracted

    return chat_reply, field_updates


async def synthesize_speech(text: str, voice_id: Optional[str]) -> str:
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not configured.")

    effective_voice_id = voice_id or ELEVENLABS_VOICE_ID
    url = f"{ELEVENLABS_TTS_BASE_URL.rstrip('/')}/{effective_voice_id}"
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "model_id": ELEVENLABS_TTS_MODEL_ID,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, headers=headers, json=payload)

    if response.status_code != httpx.codes.OK:
        raise HTTPException(status_code=502, detail=f"Text-to-speech failed: {response.text}")

    return base64.b64encode(response.content).decode("utf-8")


async def transcribe_audio(file: UploadFile) -> str:
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not configured.")

    url = ELEVENLABS_STT_ENDPOINT
    headers = {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Accept": "application/json",
    }
    data = {"model_id": ELEVENLABS_STT_MODEL_ID}
    file_bytes = await file.read()

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            url,
            headers=headers,
            data=data,
            files={"file": (file.filename or "audio.webm", file_bytes, file.content_type or "audio/webm")},
        )

    if response.status_code != httpx.codes.OK:
        raise HTTPException(status_code=502, detail=f"Speech-to-text failed: {response.text}")

    payload = response.json()
    text = payload.get("text")
    if not text:
        raise HTTPException(status_code=502, detail="Speech-to-text response missing text field.")
    return text


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(request: ChatRequest) -> ChatResponse:
    client = _get_openai_client()

    openai_messages = [
        {"role": message.role, "content": message.content}
        for message in request.history
    ]
    format_instruction = _build_format_instruction(request.section)
    if format_instruction:
        openai_messages.append({"role": "system", "content": format_instruction})
    openai_messages.append({"role": "user", "content": request.message})

    def _run_completion():
        return client.chat.completions.create(
            model=OPENAI_CHAT_MODEL,
            messages=openai_messages,
        )

    completion = await run_in_threadpool(_run_completion)
    try:
        response_text = completion.choices[0].message.content or ""
    except (AttributeError, IndexError):
        raise HTTPException(status_code=502, detail="Unexpected response from OpenAI.")

    chat_reply, field_updates = _parse_structured_response(response_text)
    if field_updates:
        section_key = request.section if request.section is not None else -1
        allowed = set(SECTION_FIELD_CONFIG.get(section_key, {}).get("fields", []))
        if allowed:
            filtered = {key: value for key, value in field_updates.items() if key in allowed}
            field_updates = filtered or None

    audio_base64 = None
    try:
        audio_base64 = await synthesize_speech(chat_reply, request.voice_id)
    except HTTPException:
        # Propagate configuration errors, but swallow synthesis issues to keep chat functional.
        raise
    except Exception:
        audio_base64 = None

    return ChatResponse(message=chat_reply, audio_base64=audio_base64, field_updates=field_updates)


@router.post("/tts", response_model=SynthesisResponse)
async def text_to_speech(request: SynthesisRequest) -> SynthesisResponse:
    audio_base64 = await synthesize_speech(request.text, request.voice_id)
    return SynthesisResponse(audio_base64=audio_base64)


@router.post("/stt", response_model=TranscriptionResponse)
async def speech_to_text(file: UploadFile = File(...)) -> TranscriptionResponse:
    text = await transcribe_audio(file)
    return TranscriptionResponse(text=text)
