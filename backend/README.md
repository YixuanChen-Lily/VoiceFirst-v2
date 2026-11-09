# VoiceFirst API

The FastAPI backend for VoiceFirst. See the [main README](../README.md) for setup, configuration and tests.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`, with interactive docs at `/docs`. Routes live in `app/api/routes/`, business logic in `app/services/`, and calls to OpenAI, ElevenLabs, TypeSafe and Supabase in `app/clients/`.
