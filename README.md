# Proposal Builder Monorepo

This repository now ships with a Next.js frontend and a FastAPI backend. The previous single-page React implementation has been migrated into the `frontend` package while all server responsibilities live under `backend`.

## Project layout

```
frontend/       # Next.js 14 + Tailwind UI
backend/        # FastAPI application exposes /api endpoints
guidelines/     # Existing documentation and assets
```

## Getting started

### Frontend

```bash
cd frontend
npm install
npm run dev
```

By default the development server runs on `http://localhost:3000`. Configure `NEXT_PUBLIC_API_BASE_URL` in a `.env.local` file if the API is not reachable at `http://127.0.0.1:8000/api`, or change `NEXT_PUBLIC_DEFAULT_API_BASE_URL` if you want to adjust the fallback URL baked into the client bundle.

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The FastAPI server listens on `http://127.0.0.1:8000`. CORS is pre-configured for the local Next.js dev server.

### Environment configuration

Copy `.env.example` to `.env` at the repository root and fill in your keys. The backend loads this file automatically on startup.

Required secrets:

- `OPENAI_API_KEY` – used by the backend to call the Chat Completions API.
- `ELEVENLABS_API_KEY` – used for speech-to-text and text-to-speech.
- `NEXT_PUBLIC_API_BASE_URL` – optional override for the frontend.
- `NEXT_PUBLIC_DEFAULT_API_BASE_URL` – fallback base URL used when no override is set (defaults to `http://127.0.0.1:8000/api`).
- `CORS_ALLOW_ORIGINS` – optional comma-separated list of frontend origins allowed to call the backend (defaults to local ports 3000 and 3002).

Optional tuning variables (set in the backend environment):

- `OPENAI_CHAT_MODEL` (default `gpt-4o-mini`)
- `ELEVENLABS_VOICE_ID` (default `Rachel`)
- `ELEVENLABS_TTS_MODEL_ID` / `ELEVENLABS_STT_MODEL_ID`
- `ELEVENLABS_TTS_BASE_URL` (default `https://api.elevenlabs.io/v1/text-to-speech`)
- `ELEVENLABS_STT_ENDPOINT` (default `https://api.elevenlabs.io/v1/speech-to-text`)

## Frontend ↔ Backend integration points

- Draft uploads now call `POST /api/proposals/analyze` and render the response inside the Draft Analysis page.
- Save/Export actions in the builder invoke `POST /api/proposals`, which currently returns a generated identifier that you can replace with database persistence.
- The AI chat drawer sends user turns to `POST /api/assist/chat`, triggers ElevenLabs speech responses, and uses `POST /api/assist/stt` when the microphone button is pressed.
- Shared API helpers live in `frontend/lib/api.ts`; extend this module as new endpoints are introduced.

## Next steps

- Replace the placeholder business logic inside `backend/app/api/routes/proposals.py` with your AI/RAG pipeline and storage layer.
- Persist uploaded files in object storage (e.g., S3) and surface asynchronous job progress through WebSockets or polling as needed.
- Harden error handling and add unit/integration tests for both apps once the data model stabilises.
- Experiment with different OpenAI or ElevenLabs models/voices by adjusting the environment variables noted above.
