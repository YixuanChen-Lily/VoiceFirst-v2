# Proposal Builder API

## Local development

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The server listens on `http://127.0.0.1:8000` by default. The Next.js frontend is configured to call the API at `http://127.0.0.1:8000/api`.

### Environment variables

Copy the repository-level `.env.example` to `.env` (or export the variables below) before starting the server. The backend loads this file automatically.

```
OPENAI_API_KEY=sk-...
ELEVENLABS_API_KEY=elevenlabs_...
CORS_ALLOW_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3002,http://127.0.0.1:3002
# Optional overrides
OPENAI_CHAT_MODEL=gpt-6-luna
OPENAI_ANALYSIS_MODEL=gpt-6.1-sol
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL
ELEVENLABS_TTS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_STT_MODEL_ID=scribe_v2
ELEVENLABS_TTS_BASE_URL=https://api.elevenlabs.io/v1/text-to-speech
ELEVENLABS_STT_ENDPOINT=https://api.elevenlabs.io/v1/speech-to-text
```

### Key endpoints

- `POST /api/proposals/analyze` – placeholder draft analysis from uploaded files.
- `POST /api/proposals` – accept structured proposal data and return an identifier.
- `POST /api/assist/chat` – call OpenAI for conversation responses and ElevenLabs for audio.
- `POST /api/assist/stt` – forward microphone recordings to ElevenLabs speech-to-text.
- `POST /api/assist/tts` – synthesize narration for assistant responses with ElevenLabs.
