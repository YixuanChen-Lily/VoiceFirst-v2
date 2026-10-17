"""
Shared fixtures for the API tests.

The tests drive the app over HTTP and fake OpenAI and ElevenLabs at the network
layer, so they describe endpoint behaviour rather than how the code is laid out.
"""

import json
import os

# The app reads its configuration from the environment at import time, so pin
# every value before anything under backend.app is imported.
os.environ.update(
    {
        "OPENAI_API_KEY": "test-openai-key",
        "ELEVENLABS_API_KEY": "test-elevenlabs-key",
        "OPENAI_CHAT_MODEL": "test-chat-model",
        "OPENAI_COMPLEX_CHAT_MODEL": "test-complex-chat-model",
        "OPENAI_ANALYSIS_MODEL": "test-analysis-model",
        "SUPABASE_URL": "https://test-project.supabase.co",
        "SUPABASE_SERVICE_KEY": "test-supabase-key",
        # Never the real database: tests swap in in-memory stand-ins.
        "SUPABASE_DB_URL": "postgresql://user:pass@localhost:1/none",
        "SUPABASE_BUCKET": "documents",
        "LIBRARY_ADMIN_EMAILS": "admin@example.com",
        "AUTH_DISABLED": "",
        "CHUNK_SIZE": "200",
        "CHUNK_OVERLAP": "40",
        # Empty so the chat router is off unless a test turns it on.
        "TYPESAFE_API_KEY": "",
        "ELEVENLABS_VOICE_ID": "test-voice",
        "ELEVENLABS_TTS_MODEL_ID": "test-tts-model",
        "ELEVENLABS_STT_MODEL_ID": "test-stt-model",
        "ELEVENLABS_TTS_BASE_URL": "https://api.elevenlabs.io/v1/text-to-speech",
        "ELEVENLABS_STT_ENDPOINT": "https://api.elevenlabs.io/v1/speech-to-text",
    }
)

from types import SimpleNamespace  # noqa: E402

import httpx  # noqa: E402
import httpx2  # noqa: E402
import pytest  # noqa: E402
import respx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend.app.clients import openai_client  # noqa: E402
from backend.app.core.auth import User, get_current_user  # noqa: E402
from backend.app.main import create_app  # noqa: E402

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
TTS_URL_PREFIX = "https://api.elevenlabs.io/v1/text-to-speech/"
STT_URL = "https://api.elevenlabs.io/v1/speech-to-text"


def openai_completion(content: str) -> httpx.Response:
    """Build the JSON body OpenAI returns for a chat completion."""
    return httpx.Response(
        200,
        json={
            "id": "chatcmpl-test",
            "object": "chat.completion",
            "created": 0,
            "model": "test-model",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": content},
                    "finish_reason": "stop",
                }
            ],
        },
    )


def sent_json(route: respx.Route, call_index: int = -1) -> dict:
    """Return the JSON body of a request the app sent to a mocked route."""
    return json.loads(route.calls[call_index].request.content)


STAFF = User(id="user-staff", email="staff@example.com", is_admin=False)
OTHER_STAFF = User(id="user-other", email="other@example.com", is_admin=False)
ADMIN = User(id="user-admin", email="admin@example.com", is_admin=True)


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
def sign_in(app):
    """Sign the test client in as a given user without a real token. Starts as STAFF."""
    current = {"user": STAFF}
    app.dependency_overrides[get_current_user] = lambda: current["user"]

    def _sign_in(user: User) -> None:
        current["user"] = user

    return _sign_in


@pytest.fixture
def client(app, sign_in) -> TestClient:
    """A client that is already signed in (as STAFF unless a test calls sign_in)."""
    return TestClient(app)


@pytest.fixture
def anonymous_client(app) -> TestClient:
    """A client with real sign-in checks and no token."""
    return TestClient(app)


class FakeOpenAIRoute:
    """
    Stands in for OpenAI's chat endpoint. The OpenAI SDK sends requests with
    httpx2, which respx cannot intercept, so it gets its own fake transport.
    It mirrors the small part of the respx route API the tests use.
    """

    def __init__(self) -> None:
        self.calls = []
        self._response = None

    def mock(self, return_value: httpx.Response) -> "FakeOpenAIRoute":
        self._response = return_value
        return self

    @property
    def called(self) -> bool:
        return bool(self.calls)

    def handle(self, request: httpx2.Request) -> httpx2.Response:
        assert str(request.url) == OPENAI_CHAT_URL, f"Unexpected OpenAI request to {request.url}"
        assert self._response is not None, "The app called OpenAI but the test did not mock it."
        self.calls.append(SimpleNamespace(request=request))
        return httpx2.Response(
            self._response.status_code,
            content=self._response.content,
            headers={"content-type": "application/json"},
        )


class MockApi:
    """Routes OpenAI mocks to the fake transport and everything else to respx."""

    def __init__(self, router: respx.MockRouter, openai_route: FakeOpenAIRoute) -> None:
        self._router = router
        self._openai_route = openai_route

    def post(self, url: str):
        if url == OPENAI_CHAT_URL:
            return self._openai_route
        return self._router.post(url)


@pytest.fixture
def mock_api(monkeypatch):
    """Intercept every outbound HTTP call; unmocked calls fail the test."""
    openai_route = FakeOpenAIRoute()
    fake_client = httpx2.Client(transport=httpx2.MockTransport(openai_route.handle))
    monkeypatch.setattr(openai_client, "http_client", fake_client)
    with respx.mock(assert_all_called=False) as router:
        yield MockApi(router, openai_route)


@pytest.fixture(autouse=True)
def empty_library(monkeypatch):
    """Chat turns find no library passages unless a test supplies some."""
    from backend.app.services import chat_graph

    monkeypatch.setattr(chat_graph, "_search_library", lambda query, user_id: [])
