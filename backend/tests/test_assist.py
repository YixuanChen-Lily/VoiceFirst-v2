import base64
import json

import httpx

from .conftest import OPENAI_CHAT_URL, STT_URL, TTS_URL_PREFIX, openai_completion, sent_json

AUDIO = b"fake-mp3-bytes"


def _mock_tts(mock_api, voice: str = "test-voice"):
    return mock_api.post(TTS_URL_PREFIX + voice).mock(
        return_value=httpx.Response(200, content=AUDIO)
    )


def test_chat_returns_reply_filtered_fields_and_audio(client, mock_api):
    model_reply = json.dumps(
        {
            "chat_reply": "Noted the title.",
            "field_updates": {
                "projectTitle": "  Riverbend Youth Hub  ",
                "totalBudget": "250000",  # not allowed for section 1
                "contactName": "",  # blank values are dropped
            },
        }
    )
    openai = mock_api.post(OPENAI_CHAT_URL).mock(return_value=openai_completion(model_reply))
    tts = _mock_tts(mock_api)

    response = client.post(
        "/api/assist/chat",
        json={
            "message": "Our project is Riverbend Youth Hub.",
            "history": [{"role": "assistant", "content": "What is the project called?"}],
            "section": 1,
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "message": "Noted the title.",
        "audio_base64": base64.b64encode(AUDIO).decode(),
        "field_updates": {"projectTitle": "Riverbend Youth Hub"},
        "model": "test-chat-model",
    }

    sent = sent_json(openai)
    assert sent["model"] == "test-chat-model"
    assert [m["role"] for m in sent["messages"]] == ["assistant", "system", "user"]
    assert "Cover Page details" in sent["messages"][1]["content"]
    assert "projectTitle" in sent["messages"][1]["content"]
    assert sent["messages"][2]["content"] == "Our project is Riverbend Youth Hub."

    assert sent_json(tts) == {"text": "Noted the title.", "model_id": "test-tts-model"}
    assert tts.calls[0].request.headers["xi-api-key"] == "test-elevenlabs-key"


def test_chat_with_plain_text_reply_has_no_field_updates(client, mock_api):
    mock_api.post(OPENAI_CHAT_URL).mock(return_value=openai_completion("Just a sentence."))
    _mock_tts(mock_api)

    response = client.post("/api/assist/chat", json={"message": "Hi", "section": 2})

    assert response.status_code == 200
    body = response.json()
    assert body["message"] == "Just a sentence."
    assert body["field_updates"] is None


def test_chat_accepts_json_wrapped_in_a_code_fence(client, mock_api):
    fenced = '```json\n{"chat_reply": "Done.", "field_updates": {"executiveSummary": "A summary."}}\n```'
    mock_api.post(OPENAI_CHAT_URL).mock(return_value=openai_completion(fenced))
    _mock_tts(mock_api)

    response = client.post("/api/assist/chat", json={"message": "Summarise", "section": 2})

    assert response.json()["message"] == "Done."
    assert response.json()["field_updates"] == {"executiveSummary": "A summary."}


def test_chat_without_section_sends_no_format_instruction_and_keeps_fields(client, mock_api):
    model_reply = json.dumps({"chat_reply": "Ok.", "field_updates": {"anything": "value"}})
    openai = mock_api.post(OPENAI_CHAT_URL).mock(return_value=openai_completion(model_reply))
    _mock_tts(mock_api)

    response = client.post("/api/assist/chat", json={"message": "Hello"})

    assert [m["role"] for m in sent_json(openai)["messages"]] == ["user"]
    assert response.json()["field_updates"] == {"anything": "value"}


def test_chat_returns_null_fields_when_nothing_is_on_the_allowlist(client, mock_api):
    model_reply = json.dumps({"chat_reply": "Ok.", "field_updates": {"totalBudget": "1"}})
    mock_api.post(OPENAI_CHAT_URL).mock(return_value=openai_completion(model_reply))
    _mock_tts(mock_api)

    response = client.post("/api/assist/chat", json={"message": "Hello", "section": 2})

    assert response.json()["field_updates"] is None


def test_chat_uses_the_requested_voice(client, mock_api):
    mock_api.post(OPENAI_CHAT_URL).mock(return_value=openai_completion("Hi."))
    custom = _mock_tts(mock_api, voice="custom-voice")

    response = client.post("/api/assist/chat", json={"message": "Hi", "voice_id": "custom-voice"})

    assert response.status_code == 200
    assert custom.called


def test_chat_returns_the_reply_without_audio_when_text_to_speech_is_rejected(client, mock_api):
    mock_api.post(OPENAI_CHAT_URL).mock(return_value=openai_completion("Hi."))
    mock_api.post(TTS_URL_PREFIX + "test-voice").mock(
        return_value=httpx.Response(404, text="voice_not_found")
    )

    response = client.post("/api/assist/chat", json={"message": "Hi"})

    assert response.status_code == 200
    assert response.json()["message"] == "Hi."
    assert response.json()["audio_base64"] is None


def test_chat_returns_the_reply_without_audio_on_a_text_to_speech_network_error(client, mock_api):
    mock_api.post(OPENAI_CHAT_URL).mock(return_value=openai_completion("Hi."))
    mock_api.post(TTS_URL_PREFIX + "test-voice").mock(side_effect=httpx.ConnectError("down"))

    response = client.post("/api/assist/chat", json={"message": "Hi"})

    assert response.status_code == 200
    assert response.json()["message"] == "Hi."
    assert response.json()["audio_base64"] is None


def test_tts_endpoint_still_reports_text_to_speech_errors(client, mock_api):
    mock_api.post(TTS_URL_PREFIX + "test-voice").mock(
        return_value=httpx.Response(404, text="voice_not_found")
    )

    response = client.post("/api/assist/tts", json={"text": "Hi"})

    assert response.status_code == 502
    assert response.json()["detail"] == "Text-to-speech failed: voice_not_found"


def test_tts_returns_base64_audio(client, mock_api):
    _mock_tts(mock_api)

    response = client.post("/api/assist/tts", json={"text": "Hello there."})

    assert response.status_code == 200
    assert response.json() == {"audio_base64": base64.b64encode(AUDIO).decode()}


def test_stt_returns_transcript(client, mock_api):
    stt = mock_api.post(STT_URL).mock(return_value=httpx.Response(200, json={"text": "hello"}))

    response = client.post(
        "/api/assist/stt", files={"file": ("voice.webm", b"audio-bytes", "audio/webm")}
    )

    assert response.status_code == 200
    assert response.json() == {"text": "hello"}
    request = stt.calls[0].request
    assert request.headers["xi-api-key"] == "test-elevenlabs-key"
    assert b"test-stt-model" in request.content
    assert b"audio-bytes" in request.content


def test_stt_reports_upstream_errors(client, mock_api):
    mock_api.post(STT_URL).mock(return_value=httpx.Response(400, text="bad audio"))

    response = client.post("/api/assist/stt", files={"file": ("voice.webm", b"x", "audio/webm")})

    assert response.status_code == 502
    assert response.json()["detail"] == "Speech-to-text failed: bad audio"


def test_stt_rejects_a_response_without_text(client, mock_api):
    mock_api.post(STT_URL).mock(return_value=httpx.Response(200, json={"text": ""}))

    response = client.post("/api/assist/stt", files={"file": ("voice.webm", b"x", "audio/webm")})

    assert response.status_code == 502
    assert response.json()["detail"] == "Speech-to-text response missing text field."
