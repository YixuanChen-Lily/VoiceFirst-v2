"""Thin wrapper around the OpenAI SDK. Services call this, never the SDK."""

from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None  # type: ignore[assignment]

from ..core import settings


# Tests set this to a client with a fake transport so no request leaves the machine.
http_client: Optional[Any] = None


class UnexpectedOpenAIResponse(Exception):
    """The completion came back without the expected choices/message shape."""


def is_available() -> bool:
    return bool(settings.OPENAI_API_KEY) and OpenAI is not None


def _get_client() -> OpenAI:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured.")
    if OpenAI is None:
        raise HTTPException(status_code=500, detail="openai package not installed on server.")
    return OpenAI(api_key=settings.OPENAI_API_KEY, http_client=http_client)


async def complete_chat(
    *,
    model: str,
    messages: List[Dict[str, str]],
    response_format: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """Run a chat completion and return the first choice's text content."""
    client = _get_client()

    params: Dict[str, Any] = {"model": model, "messages": messages}
    if response_format is not None:
        params["response_format"] = response_format

    def _run_completion():
        return client.chat.completions.create(**params)

    completion = await run_in_threadpool(_run_completion)
    try:
        return completion.choices[0].message.content
    except (AttributeError, IndexError) as exc:
        raise UnexpectedOpenAIResponse("Completion has no message content.") from exc
