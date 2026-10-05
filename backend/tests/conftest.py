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
        "OPENAI_ANALYSIS_MODEL": "test-analysis-model",
        "ELEVENLABS_VOICE_ID": "test-voice",
        "ELEVENLABS_TTS_MODEL_ID": "test-tts-model",
        "ELEVENLABS_STT_MODEL_ID": "test-stt-model",
        "ELEVENLABS_TTS_BASE_URL": "https://api.elevenlabs.io/v1/text-to-speech",
        "ELEVENLABS_STT_ENDPOINT": "https://api.elevenlabs.io/v1/speech-to-text",
    }
)

import httpx  # noqa: E402
import pytest  # noqa: E402
import respx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

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


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())


@pytest.fixture
def mock_api():
    """Intercept every outbound HTTP call; unmocked calls fail the test."""
    with respx.mock(assert_all_called=False) as router:
        yield router
