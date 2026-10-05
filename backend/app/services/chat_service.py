"""One chat turn: ask the model, extract field updates, and voice the reply."""

from fastapi import HTTPException

from ..clients import openai_client
from ..core import settings
from ..schemas.assist import ChatRequest, ChatResponse
from . import extraction_service, speech_service


async def run_chat_turn(request: ChatRequest) -> ChatResponse:
    messages = [
        {"role": message.role, "content": message.content}
        for message in request.history
    ]
    format_instruction = extraction_service.build_format_instruction(request.section)
    if format_instruction:
        messages.append({"role": "system", "content": format_instruction})
    messages.append({"role": "user", "content": request.message})

    try:
        response_text = await openai_client.complete_chat(
            model=settings.OPENAI_CHAT_MODEL,
            messages=messages,
        ) or ""
    except openai_client.UnexpectedOpenAIResponse:
        raise HTTPException(status_code=502, detail="Unexpected response from OpenAI.")

    chat_reply, field_updates = extraction_service.parse_structured_response(response_text)
    field_updates = extraction_service.filter_field_updates(request.section, field_updates)

    audio_base64 = None
    try:
        audio_base64 = await speech_service.synthesize_speech(chat_reply, request.voice_id)
    except HTTPException:
        # Propagate configuration errors, but swallow synthesis issues to keep chat functional.
        raise
    except Exception:
        audio_base64 = None

    return ChatResponse(message=chat_reply, audio_base64=audio_base64, field_updates=field_updates)
