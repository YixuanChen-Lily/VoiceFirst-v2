"""Thin wrapper around the OpenAI SDK. Services call this, never the SDK."""

from typing import Any, Dict, List, Optional, Type, TypeVar

from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool

import instructor
from instructor.core.exceptions import InstructorRetryException
from pydantic import BaseModel

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover
    OpenAI = None  # type: ignore[assignment]

from ..core import settings


# Tests set this to a client with a fake transport so no request leaves the machine.
http_client: Optional[Any] = None


ResponseModel = TypeVar("ResponseModel", bound=BaseModel)

# How many times Instructor asks again when a reply does not match the required shape.
STRUCTURED_RETRIES = 1


class StructuredOutputFailed(Exception):
    """No reply matching the required shape was produced. `raw_text` is the last reply, if any."""

    def __init__(self, raw_text: Optional[str]) -> None:
        super().__init__("The model did not return a reply in the required shape.")
        self.raw_text = raw_text


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


async def complete_structured(
    *,
    model: str,
    messages: List[Dict[str, str]],
    response_model: Type[ResponseModel],
) -> ResponseModel:
    """
    Run a chat completion whose reply must match `response_model`.

    Uses Instructor in JSON-schema mode, which sends the model's shape to OpenAI
    as a structured-output schema and validates the reply against it.
    """
    client = instructor.from_openai(_get_client(), mode=instructor.Mode.JSON_SCHEMA)

    def _run_completion():
        return client.chat.completions.create(
            model=model,
            messages=messages,
            response_model=response_model,
            max_retries=STRUCTURED_RETRIES,
        )

    try:
        return await run_in_threadpool(_run_completion)
    except InstructorRetryException as exc:
        raw_text = None
        try:
            raw_text = exc.last_completion.choices[0].message.content
        except (AttributeError, IndexError, TypeError):
            pass
        raise StructuredOutputFailed(raw_text) from exc
