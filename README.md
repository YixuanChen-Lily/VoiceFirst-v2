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
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_DB_URL` – the knowledge base: uploaded documents are stored in Supabase Storage and indexed in its Postgres database (`pgvector`). Without them the `/api/documents` endpoints return 503 and the rest of the app works as before. The same settings store each user's own files (`/api/files`, and `/api/proposals/{id}/files` for the files a proposal uses); a file is only read and indexed while a proposal lets the assistant use it.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` – used by the website to sign users in with Supabase Auth (email link). Both are public values.
- `LIBRARY_ADMIN_EMAILS` – comma-separated emails allowed to add and remove library documents.
- `AUTH_DISABLED` – set to `true` for local development to use the API without signing in. Never set it on a deployed backend.
- `NEXT_PUBLIC_API_BASE_URL` – optional override for the frontend.
- `NEXT_PUBLIC_DEFAULT_API_BASE_URL` – fallback base URL used when no override is set (defaults to `http://127.0.0.1:8000/api`).
- `CORS_ALLOW_ORIGINS` – optional comma-separated list of frontend origins allowed to call the backend (defaults to local ports 3000 and 3002).

Optional tuning variables (set in the backend environment):

- `OPENAI_CHAT_MODEL` (default `gpt-6-luna`) — chat and field extraction
- `OPENAI_ANALYSIS_MODEL` (default `gpt-6.1-sol`) — draft analysis
- `OPENAI_COMPLEX_CHAT_MODEL` (default `gpt-6.1-sol`) — chat turns the router judges to need writing or advice
- `TYPESAFE_API_KEY` — enables the Jev chat router; without it every chat turn uses `OPENAI_CHAT_MODEL`
- `TYPESAFE_ROUTER_MODEL` (default `jev-1.13.0`) and `CHAT_ROUTER_THRESHOLD` (default `0.5`)
- `EMBEDDING_MODEL` (default `text-embedding-3-small`), `CHUNK_SIZE` (default `1000`), `CHUNK_OVERLAP` (default `150`) — knowledge base indexing; changing them requires re-indexing documents
- `ELEVENLABS_VOICE_ID` (default `EXAVITQu4vr4xnSDxMaL`, the "Sarah" voice; must be a voice ID, not a name)
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

## Demo
Uploading an existing proposal gives heuristics score. 
<img width="1867" height="883" alt="image" src="https://github.com/user-attachments/assets/63d72fa4-293b-4c4d-9f2c-f84f953fdbd8" />

