"""One chat turn: run the chat graph and shape its result into the API response."""

from ..core.auth import User
from ..schemas.assist import ChatRequest, ChatResponse, ChatSource
from .chat_graph import chat_graph


async def run_chat_turn(request: ChatRequest, user: User) -> ChatResponse:
    result = await chat_graph.ainvoke(
        {
            "message": request.message,
            "history": [
                {"role": message.role, "content": message.content}
                for message in request.history
            ],
            "section": request.section,
            "voice_id": request.voice_id,
            "user_id": user.id,
        }
    )
    return ChatResponse(
        message=result["reply"],
        audio_base64=result.get("audio_base64"),
        field_updates=result.get("field_updates"),
        model=result.get("model"),
        sources=[ChatSource(**source) for source in result.get("sources", [])],
    )
