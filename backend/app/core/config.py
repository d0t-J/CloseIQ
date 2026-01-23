import os
from dotenv import load_dotenv

load_dotenv()  # Loads .env at project root

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
EMBEDDINGS_PROVIDER = os.getenv("EMBEDDINGS_PROVIDER", "openai")
CHROMADB_PATH = os.getenv("CHROMADB_PATH", "./chromadb_data")
SECRET_KEY = os.getenv("SECRET_KEY", "supersecret")
