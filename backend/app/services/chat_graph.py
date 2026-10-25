"""
The chat turn as a LangGraph graph.

    START -> classify -> retrieve -> (simple | complex) -> filter_fields -> speak -> END

Jev scores how likely the turn needs real writing or reasoning. Plain code compares
that score to a threshold and sends the turn to the fast chat model or the stronger one.
Before the model answers, the closest passages are looked up and given to it: from the
shared document library and from the proposal's own files the assistant may read. The
reply cites the ones it uses as [1], [2], ... The model is also told the names of every
file in the proposal, including attachments it may not read.
"""

import logging
import re
from typing import Dict, List, Literal, Optional

from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict

from ..clients import openai_client, typesafe_client
from ..core import settings
from . import extraction_service, knowledge_service, proposal_files_service, speech_service

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
    user_id: Optional[str]
    proposal_id: Optional[str]
    # Set by the nodes
    complexity: Optional[float]
    files: List[Dict]
    passages: List[Dict]
    sources: List[Dict]
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


CITATION = re.compile(r"\s*\[(\d+)\]")

RETRIEVAL_INSTRUCTIONS = (
    "Below are numbered passages from the organization's document library and from the "
    "files the user added to this proposal. They may or may not be relevant. When you use information from a passage, cite it right after the "
    "statement with its number in square brackets, like [1]. Do not cite passages you did not "
    "use. If the passages do not answer the user's question about a program's rules, say so "
    "rather than guessing. Never put citation markers inside field values."
)


FILES_INSTRUCTIONS = (
    "These files are part of the user's proposal. You can read the ones marked readable, "
    "through the numbered passages when they are relevant. For the others you know only the "
    "name: do not guess at their contents. Use this list to say which supporting documents "
    "the proposal has, or seems to be missing."
)

ORIGINS = {"background": "background document", "attachment": "attachment"}


def _search_library(query: str, user_id: str, document_ids: List[str]) -> list:
    """Kept separate so tests can stand in for the knowledge base."""
    return knowledge_service.search(query, user_id, document_ids=document_ids, k=settings.CHAT_RETRIEVAL_K)


def _proposal_files(user_id: str, proposal_id: str) -> list:
    """Kept separate so tests can stand in for the proposal's files."""
    return proposal_files_service.chat_files(user_id, proposal_id)


def _file_summary(item) -> Dict:
    return {
        "document_id": item.record.id,
        "title": item.record.title,
        "role": item.link.role,
        "label": item.link.label,
        "readable": item.link.use_in_chat and item.record.status == "ready",
    }


async def retrieve(state: ChatState) -> dict:
    """
    Look up passages close in meaning to the message, from the library and the files this
    proposal lets the assistant read. Failures never block the reply.
    """
    user_id, proposal_id = state.get("user_id"), state.get("proposal_id")
    if not user_id or not knowledge_service.is_configured():
        return {"passages": [], "files": []}

    files: List[Dict] = []
    if proposal_id:
        try:
            files = [_file_summary(item) for item in await run_in_threadpool(_proposal_files, user_id, proposal_id)]
        except Exception as exc:
            logger.warning("Could not load the proposal's files, using the library only: %s", exc)
    readable_ids = [item["document_id"] for item in files if item["readable"]]

    try:
        results = await run_in_threadpool(_search_library, state["message"], user_id, readable_ids)
    except Exception as exc:
        logger.warning("Library search failed, answering without passages: %s", exc)
        return {"passages": [], "files": files}

    roles = {item["document_id"]: item["role"] for item in files}
    close = [result for result in results if result.distance <= settings.CHAT_RETRIEVAL_MAX_DISTANCE]
    return {
        "files": files,
        "passages": [
            {
                "number": number,
                "document_id": result.document_id,
                "title": result.title,
                "section": result.section,
                "page": result.page,
                # "library", or how the proposal uses the file.
                "origin": "library" if result.scope == "library" else roles.get(result.document_id, "background"),
                # The stored text starts with its "title › section" label line; drop it here.
                "text": result.text.split("\n\n", 1)[-1],
            }
            for number, result in enumerate(close, start=1)
        ],
    }


def _files_message(files: List[Dict]) -> str:
    lines = []
    for item in files:
        name = f"{item['label']}: {item['title']}" if item.get("label") else item["title"]
        access = "readable" if item["readable"] else "name only"
        lines.append(f"- {name} ({ORIGINS.get(item['role'], item['role'])}, {access})")
    return FILES_INSTRUCTIONS + "\n\n" + "\n".join(lines)


def _passages_message(passages: List[Dict]) -> str:
    blocks = []
    for passage in passages:
        where = passage["title"]
        if passage.get("section"):
            where += f" › {passage['section']}"
        if passage.get("page"):
            where += f" (page {passage['page']})"
        if passage.get("origin") in ORIGINS:
            where += f" [the user's {ORIGINS[passage['origin']]}]"
        blocks.append(f"[{passage['number']}] {where}\n{passage['text']}")
    return RETRIEVAL_INSTRUCTIONS + "\n\n" + "\n\n".join(blocks)


def _cited_sources(reply: str, passages: List[Dict]) -> List[Dict]:
    """The passages the reply actually cites, in the order of their numbers."""
    cited = {int(number) for number in CITATION.findall(reply)}
    return [
        {key: passage.get(key) for key in ("number", "document_id", "title", "section", "page", "origin")}
        for passage in passages
        if passage["number"] in cited
    ]


def _strip_citations(text: str) -> str:
    return CITATION.sub("", text).strip()


def route(state: ChatState) -> Literal["generate_simple", "generate_complex"]:
    score = state.get("complexity")
    if score is not None and score >= settings.CHAT_ROUTER_THRESHOLD:
        return "generate_complex"
    return "generate_simple"


async def _generate(state: ChatState, model: str) -> dict:
    section = state.get("section")
    messages = list(state.get("history", []))
    instruction = extraction_service.build_extraction_instruction(section)
    if instruction:
        messages.append({"role": "system", "content": instruction})
    files = state.get("files") or []
    if files:
        messages.append({"role": "system", "content": _files_message(files)})
    passages = state.get("passages") or []
    if passages:
        messages.append({"role": "system", "content": _passages_message(passages)})
    messages.append({"role": "user", "content": state["message"]})

    turn_model = extraction_service.build_turn_model(section)
    if turn_model is None:
        # No form section to fill: an ordinary reply.
        try:
            response_text = await openai_client.complete_chat(model=model, messages=messages) or ""
        except openai_client.UnexpectedOpenAIResponse:
            raise HTTPException(status_code=502, detail="Unexpected response from OpenAI.")
        reply, field_updates = extraction_service.parse_structured_response(response_text)
        return _generated(model, reply, field_updates, passages)

    try:
        turn = await openai_client.complete_structured(
            model=model, messages=messages, response_model=turn_model
        )
    except openai_client.StructuredOutputFailed as exc:
        if not exc.raw_text:
            raise HTTPException(status_code=502, detail="The assistant could not reply. Try again.")
        # Keep the conversation going with whatever the model said.
        logger.warning("Structured reply failed for section %s; using the raw reply.", section)
        reply, field_updates = extraction_service.parse_structured_response(exc.raw_text)
        return _generated(model, reply, field_updates, passages)

    return _generated(
        model, turn.chat_reply, extraction_service.to_field_updates(turn.field_updates), passages
    )


def _generated(model: str, reply: str, field_updates: Optional[Dict[str, str]], passages: List[Dict]) -> dict:
    if field_updates:
        field_updates = {name: _strip_citations(value) for name, value in field_updates.items()}
    return {
        "model": model,
        "reply": reply,
        "field_updates": field_updates,
        "sources": _cited_sources(reply, passages),
    }


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
        # Citation markers like [1] are for reading, not for saying aloud.
        spoken = _strip_citations(state["reply"]) or state["reply"]
        audio = await speech_service.synthesize_speech(spoken, state.get("voice_id"))
    except Exception as exc:
        detail = exc.detail if isinstance(exc, HTTPException) else exc
        logger.warning("Text-to-speech failed, returning the reply without audio: %s", detail)
        audio = None
    return {"audio_base64": audio}


def build_chat_graph():
    builder = StateGraph(ChatState)
    builder.add_node("classify", classify)
    builder.add_node("retrieve", retrieve)
    builder.add_node("generate_simple", generate_simple)
    builder.add_node("generate_complex", generate_complex)
    builder.add_node("filter_fields", filter_fields)
    builder.add_node("speak", speak)

    builder.add_edge(START, "classify")
    builder.add_edge("classify", "retrieve")
    builder.add_conditional_edges("retrieve", route, ["generate_simple", "generate_complex"])
    builder.add_edge("generate_simple", "filter_fields")
    builder.add_edge("generate_complex", "filter_fields")
    builder.add_edge("filter_fields", "speak")
    builder.add_edge("speak", END)
    return builder.compile()


chat_graph = build_chat_graph()
