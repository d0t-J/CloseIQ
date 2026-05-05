import os
from dotenv import load_dotenv

load_dotenv()  # Loads .env at project root

# Prefer OpenRouter credentials while keeping OPENAI_API_KEY fallback for compatibility.
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENAI_API_KEY = OPENROUTER_API_KEY or os.getenv("OPENAI_API_KEY")
OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "https://openrouter.ai/api/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-4o-mini")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
EMBEDDINGS_PROVIDER = os.getenv("EMBEDDINGS_PROVIDER", "openai")
CHROMADB_PATH = os.getenv("CHROMADB_PATH", "./chromadb_data")
SECRET_KEY = os.getenv("SECRET_KEY", "supersecret")
