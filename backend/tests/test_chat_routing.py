"""The chat router: Jev's score decides which chat model answers the turn."""

import httpx
import pytest

from backend.app.clients import typesafe_client
from backend.app.services import chat_graph

from .conftest import OPENAI_CHAT_URL, TTS_URL_PREFIX, openai_completion, sent_json


@pytest.fixture
def openai(mock_api):
    mock_api.post(TTS_URL_PREFIX + "test-voice").mock(return_value=httpx.Response(200, content=b"mp3"))
    return mock_api.post(OPENAI_CHAT_URL).mock(return_value=openai_completion("Ok."))


@pytest.fixture
def router(monkeypatch):
    """Turn the router on and let a test set the score (or exception) it returns."""
    calls = []
    outcome = {"value": 0.0}

    async def fake_yes_probability(**kwargs):
        calls.append(kwargs)
        if isinstance(outcome["value"], Exception):
            raise outcome["value"]
        return outcome["value"]

    monkeypatch.setattr(typesafe_client, "is_available", lambda: True)
    monkeypatch.setattr(typesafe_client, "yes_probability", fake_yes_probability)
    outcome["calls"] = calls
    return outcome


def _chat(client, **body):
    return client.post("/api/assist/chat", json={"message": "Hello", **body})


def test_router_off_uses_the_default_chat_model(client, openai):
    response = _chat(client)

    assert sent_json(openai)["model"] == "test-chat-model"
    assert response.json()["model"] == "test-chat-model"


@pytest.mark.parametrize(
    "score, expected_model",
    [
        (0.05, "test-chat-model"),
        (0.49, "test-chat-model"),
        (0.5, "test-complex-chat-model"),
        (0.95, "test-complex-chat-model"),
    ],
)
def test_router_score_picks_the_model(client, openai, router, score, expected_model):
    router["value"] = score

    response = _chat(client)

    assert sent_json(openai)["model"] == expected_model
    assert response.json()["model"] == expected_model


def test_router_failure_falls_back_to_the_default_chat_model(client, openai, router):
    router["value"] = RuntimeError("router unavailable")

    response = _chat(client)

    assert response.status_code == 200
    assert sent_json(openai)["model"] == "test-chat-model"


def test_router_sees_the_message_with_the_previous_assistant_turn(client, openai, router):
    _chat(
        client,
        message="Yes please.",
        history=[
            {"role": "system", "content": "You are a grant-writing copilot."},
            {"role": "assistant", "content": "Shall I draft the executive summary?"},
        ],
    )

    assert router["calls"][0]["text"] == (
        "Assistant: Shall I draft the executive summary?\nUser: Yes please."
    )


def test_router_sees_only_the_message_when_there_is_no_assistant_turn(client, openai, router):
    _chat(client, message="Our project is Riverbend Youth Hub.")

    assert router["calls"][0]["text"] == "Our project is Riverbend Youth Hub."


def test_complex_route_still_filters_fields_and_adds_audio(client, mock_api, router):
    router["value"] = 0.9
    mock_api.post(TTS_URL_PREFIX + "test-voice").mock(return_value=httpx.Response(200, content=b"mp3"))
    mock_api.post(OPENAI_CHAT_URL).mock(
        return_value=openai_completion(
            '{"chat_reply": "Drafted.", "field_updates": {"executiveSummary": "A summary.", "totalBudget": "1"}}'
        )
    )

    response = _chat(client, section=2)

    assert response.json()["message"] == "Drafted."
    assert response.json()["field_updates"] == {"executiveSummary": "A summary."}
    assert response.json()["audio_base64"]


def test_graph_has_the_expected_steps():
    nodes = set(chat_graph.chat_graph.get_graph().nodes)

    assert {"classify", "generate_simple", "generate_complex", "filter_fields", "speak"} <= nodes
