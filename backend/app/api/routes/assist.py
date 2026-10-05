from fastapi import APIRouter, File, UploadFile

from ...schemas.assist import (
    ChatRequest,
    ChatResponse,
    SynthesisRequest,
    SynthesisResponse,
    TranscriptionResponse,
)
from ...services import chat_service, speech_service

router = APIRouter(prefix="/assist", tags=["assist"])


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(request: ChatRequest) -> ChatResponse:
    return await chat_service.run_chat_turn(request)


@router.post("/tts", response_model=SynthesisResponse)
async def text_to_speech(request: SynthesisRequest) -> SynthesisResponse:
    audio_base64 = await speech_service.synthesize_speech(request.text, request.voice_id)
    return SynthesisResponse(audio_base64=audio_base64)


@router.post("/stt", response_model=TranscriptionResponse)
async def speech_to_text(file: UploadFile = File(...)) -> TranscriptionResponse:
    text = await speech_service.transcribe_audio(file)
    return TranscriptionResponse(text=text)
