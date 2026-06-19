# Service Setup Guide

This project has 3 external service dependencies in the current implementation:

1. OpenRouter (LLM + embeddings)
2. Deepgram (real-time transcription)
3. Supabase (frontend login/auth)

## 1) OpenRouter (recommended default)

Why: backend RAG calls and embeddings use OpenAI-compatible APIs through OpenRouter.

- Sign up: https://openrouter.ai/
- Create API key from dashboard.
- Put key in backend `.env` as `OPENROUTER_API_KEY`.

Backend now prefers `OPENROUTER_API_KEY` and falls back to `OPENAI_API_KEY` for compatibility.

## 2) Deepgram

Why: frontend live transcription uses Deepgram JS SDK.

- Sign up: https://deepgram.com/
- Create an API key.
- Put key in frontend `.env` as `REACT_APP_DEEPGRAM_API_KEY`.

## 3) Supabase

Why: current login form uses Supabase Auth (`signInWithPassword`).

- Sign up: https://supabase.com/
- Create a project (free tier available).
- From Project Settings -> API, copy:
    - Project URL -> `REACT_APP_SUPABASE_URL`
    - Publishable (anon) key -> `REACT_APP_SUPABASE_PUBLISHABLE_DEFAULT_KEY`

Backend `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are currently optional for boot in this repo, but kept in env for future features.

## Free Alternatives

## A) LLM provider alternatives (OpenRouter replacement)

Use any OpenAI-compatible endpoint by changing backend env:

- `OPENAI_API_BASE`
- `OPENROUTER_API_KEY` (or `OPENAI_API_KEY`)
- `LLM_MODEL`
- `EMBEDDING_MODEL`

Examples:

- Groq (chat only, no embeddings): good for fast inference, you still need an embedding provider.
- Together AI / Fireworks / other OpenAI-compatible APIs: can be wired using `OPENAI_API_BASE` + key.
- Ollama (local/free): usable for chat with compatibility layers, but embedding model names and API compatibility vary.

Note: This backend currently expects OpenAI-style embedding APIs via `langchain_openai.OpenAIEmbeddings`.

## B) Supabase alternatives

If you do not want Supabase:

- Firebase Auth (free tier)
- Clerk (free developer tier)
- Auth0 (limited free tier)
- Local/dev-only auth bypass (requires code changes)

Current code is hard-wired to Supabase login in frontend.

## C) Deepgram alternatives

For browser real-time streaming, alternatives are limited and integration-specific:

- AssemblyAI (paid/free trial)
- AWS Transcribe streaming (complex setup)
- Whisper local (not trivial for browser real-time dual stream)

Deepgram is the easiest drop-in with current code.

## Quick Start from Fresh Clone

Create env files from examples:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Fill required values in both `.env` files.

Run backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Run frontend:

```powershell
cd frontend
npm install
npm run electron-dev
```

Or web mode:

```powershell
cd frontend
npm start
```

## Production-style test via Docker

```powershell
docker compose up --build
```

Ports:

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:8000`
