"""
The chat turn as a LangGraph graph.

    START -> classify -> (simple | complex) -> filter_fields -> speak -> END

Jev scores how likely the turn needs real writing or reasoning. Plain code compares
that score to a threshold and sends the turn to the fast chat model or the stronger one.
"""

import logging
from typing import Dict, List, Literal, Optional

from fastapi import HTTPException
from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

from ..clients import openai_client, typesafe_client
from ..core import settings
from . import extraction_service, speech_service

logger = logging.getLogger(__name__)

ROUTER_INSTRUCTIONS = (
    "Is the user asking the assistant to compose, draft, rewrite, expand, summarize or improve "
    "proposal narrative text, or to give strategic advice? Answer no when the user is only "
    "supplying facts or details for form fields, greeting, or asking a short factual question."
)
ROUTER_YES_MEANS = (
    "The assistant must write or rework paragraphs of proposal prose, or reason about how to "
    "strengthen the proposal."
)
ROUTER_NO_MEANS = (
    "The user states facts (names, dates, amounts, contacts) to record, makes small talk, or "
    "asks something answerable in a sentence."
)


class ChatState(TypedDict, total=False):
    # Inputs
    message: str
    history: List[Dict[str, str]]
    section: Optional[int]
    voice_id: Optional[str]
    # Set by the nodes
    complexity: Optional[float]
    model: str
    reply: str
    field_updates: Optional[Dict[str, str]]
    audio_base64: Optional[str]


def _router_text(state: ChatState) -> str:
    """The user's message, with the assistant's previous turn for context when there is one."""
    previous = next(
        (m["content"] for m in reversed(state.get("history", [])) if m["role"] == "assistant"),
        None,
    )
    if previous:
        return f"Assistant: {previous}\nUser: {state['message']}"
    return state["message"]


async def classify(state: ChatState) -> dict:
    """Score the turn with Jev. A missing key or a failed call leaves the score unset."""
    if not typesafe_client.is_available():
        return {"complexity": None}
    try:
        score = await typesafe_client.yes_probability(
            text=_router_text(state),
            instructions=ROUTER_INSTRUCTIONS,
            yes_means=ROUTER_YES_MEANS,
            no_means=ROUTER_NO_MEANS,
        )
    except Exception as exc:
        logger.warning("Chat router failed, using the default chat model: %s", exc)
        return {"complexity": None}
    return {"complexity": score}


def route(state: ChatState) -> Literal["generate_simple", "generate_complex"]:
    score = state.get("complexity")
    if score is not None and score >= settings.CHAT_ROUTER_THRESHOLD:
        return "generate_complex"
    return "generate_simple"


async def _generate(state: ChatState, model: str) -> dict:
    messages = list(state.get("history", []))
    format_instruction = extraction_service.build_format_instruction(state.get("section"))
    if format_instruction:
        messages.append({"role": "system", "content": format_instruction})
    messages.append({"role": "user", "content": state["message"]})

    try:
        response_text = await openai_client.complete_chat(model=model, messages=messages) or ""
    except openai_client.UnexpectedOpenAIResponse:
        raise HTTPException(status_code=502, detail="Unexpected response from OpenAI.")

    reply, field_updates = extraction_service.parse_structured_response(response_text)
    return {"model": model, "reply": reply, "field_updates": field_updates}


async def generate_simple(state: ChatState) -> dict:
    return await _generate(state, settings.OPENAI_CHAT_MODEL)


async def generate_complex(state: ChatState) -> dict:
    return await _generate(state, settings.OPENAI_COMPLEX_CHAT_MODEL)


def filter_fields(state: ChatState) -> dict:
    return {
        "field_updates": extraction_service.filter_field_updates(
            state.get("section"), state.get("field_updates")
        )
    }


async def speak(state: ChatState) -> dict:
    """Voice the reply. The text reply is still returned if speech fails."""
    try:
        audio = await speech_service.synthesize_speech(state["reply"], state.get("voice_id"))
    except Exception as exc:
        detail = exc.detail if isinstance(exc, HTTPException) else exc
        logger.warning("Text-to-speech failed, returning the reply without audio: %s", detail)
        audio = None
    return {"audio_base64": audio}


def build_chat_graph():
    builder = StateGraph(ChatState)
    builder.add_node("classify", classify)
    builder.add_node("generate_simple", generate_simple)
    builder.add_node("generate_complex", generate_complex)
    builder.add_node("filter_fields", filter_fields)
    builder.add_node("speak", speak)

    builder.add_edge(START, "classify")
    builder.add_conditional_edges("classify", route, ["generate_simple", "generate_complex"])
    builder.add_edge("generate_simple", "filter_fields")
    builder.add_edge("generate_complex", "filter_fields")
    builder.add_edge("filter_fields", "speak")
    builder.add_edge("speak", END)
    return builder.compile()


chat_graph = build_chat_graph()
