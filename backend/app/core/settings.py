"""Application settings, read from the environment once at import time."""

import os
from typing import List

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-6-luna")
OPENAI_COMPLEX_CHAT_MODEL = os.getenv("OPENAI_COMPLEX_CHAT_MODEL", "gpt-6.1-sol")
OPENAI_ANALYSIS_MODEL = os.getenv("OPENAI_ANALYSIS_MODEL", "gpt-6.1-sol")

# Chat router: Jev scores how likely a turn needs the stronger chat model.
TYPESAFE_API_KEY = os.getenv("TYPESAFE_API_KEY")
TYPESAFE_ROUTER_MODEL = os.getenv("TYPESAFE_ROUTER_MODEL", "jev-1.13.0")
CHAT_ROUTER_THRESHOLD = float(os.getenv("CHAT_ROUTER_THRESHOLD", "0.5"))

# Sign-in (Supabase Auth). Every API route needs a signed-in user unless AUTH_DISABLED is true,
# which is for local development only. Library admins may add and remove library documents.
AUTH_DISABLED = os.getenv("AUTH_DISABLED", "").lower() in ("1", "true", "yes")
LIBRARY_ADMIN_EMAILS = frozenset(
    email.strip().lower() for email in os.getenv("LIBRARY_ADMIN_EMAILS", "").split(",") if email.strip()
)

# Knowledge base: original files in Supabase Storage, records and embeddings in its Postgres.
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "documents")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1000"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "150"))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(20 * 1024 * 1024)))

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")
ELEVENLABS_TTS_MODEL_ID = os.getenv("ELEVENLABS_TTS_MODEL_ID", "eleven_multilingual_v2")
ELEVENLABS_TTS_BASE_URL = os.getenv("ELEVENLABS_TTS_BASE_URL", "https://api.elevenlabs.io/v1/text-to-speech")
ELEVENLABS_STT_MODEL_ID = os.getenv("ELEVENLABS_STT_MODEL_ID", "scribe_v2")
ELEVENLABS_STT_ENDPOINT = os.getenv("ELEVENLABS_STT_ENDPOINT", "https://api.elevenlabs.io/v1/speech-to-text")


def get_allowed_origins() -> List[str]:
    raw = os.getenv("CORS_ALLOW_ORIGINS")
    if raw:
        return [origin.strip() for origin in raw.split(",") if origin.strip()]
    return [
        "*",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    ]
