# CloseIQ

**AI-Powered Real-Time Sales Coaching Platform**

CloseIQ is an intelligent sales copilot that listens to live sales conversations, analyzes prospect behavior, retrieves relevant knowledge from uploaded documents, and provides real-time coaching recommendations to help sales representatives close more deals.

The platform combines:

* Real-time transcription
* Retrieval-Augmented Generation (RAG)
* Deal-state tracking
* Prospect avatar profiling
* Close probability prediction
* AI-powered coaching suggestions

---

## Features

### Real-Time Sales Intelligence

* Live conversation analysis
* Prospect behavior detection
* Deal-stage tracking
* Objection identification
* Close probability estimation
* Next-action recommendations

### AI Coaching Engine

CloseIQ generates:

* **What To Say**
* **Why It Works**
* **Next Move**
* **Close Probability**

during ongoing conversations.

### Knowledge-Based Coaching

Upload sales playbooks, scripts, SOPs, objection-handling guides, and training materials.

The platform:

1. Processes documents
2. Creates vector embeddings
3. Stores them in ChromaDB
4. Retrieves relevant context during conversations
5. Grounds AI recommendations using company knowledge

### Prospect Avatar Intelligence

The system continuously builds prospect profiles by analyzing:

* Communication style
* Buying signals
* Objection patterns
* Engagement indicators
* Decision-making tendencies

### Document Management

Supported file formats:

* PDF
* TXT
* DOCX

Features:

* Upload documents
* Automatic text extraction
* Chunking and embedding generation
* Vector storage
* Metadata tracking
* Secure deletion with vector cleanup

---

# Architecture

```text
┌───────────────────────────┐
│   React / Electron UI     │
│ Real-Time Transcription   │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│      FastAPI Backend      │
└─────────────┬─────────────┘
              │
      ┌───────┴────────┐
      │                │
      ▼                ▼

┌──────────────┐  ┌──────────────┐
│  RAG Engine  │  │ Deal Engine  │
└──────┬───────┘  └──────┬───────┘
       │                 │
       ▼                 ▼

┌──────────────┐  ┌──────────────┐
│  ChromaDB    │  │ Intelligence │
│ Vector Store │  │   Modules    │
└──────────────┘  └──────────────┘

              │
              ▼

       OpenRouter LLM
```

---

# Repository Structure

```text
backend/
├── app/
│   ├── core/
│   ├── models/
│   ├── routers/
│   ├── services/
│   │   ├── deal_engine/
│   │   └── intelligence/
│   └── main.py
│
├── file_metadata/
├── user_files/
├── vector_store/
└── requirements.txt

realtime-transcription-app/
├── public/
├── src/
└── package.json
```

---

# Core Components

## RAG Engine

Retrieval-Augmented Generation powers the coaching system.

Workflow:

```text
Uploaded Documents
        ↓
Text Extraction
        ↓
Chunking
        ↓
Embeddings
        ↓
ChromaDB
        ↓
Similarity Search
        ↓
LLM Context Injection
        ↓
Sales Recommendation
```

---

## Deal Engine

The deal engine maintains conversation state across the sales call.

Tracks:

* Deal stage
* Objection level
* Payment discussions
* Prospect engagement
* Session memory

Modules:

```text
deal_engine/
├── perception.py
├── decision.py
├── session_store.py
└── state.py
```

---

## Prospect Intelligence Layer

Advanced behavioral analysis modules.

### Avatar Profiling

Creates dynamic prospect personas.

### Avatar Signals

Extracts:

* Buying intent
* Trust indicators
* Resistance patterns
* Decision triggers

### Close Probability

Predicts likelihood of closing a deal based on:

* Transcript signals
* Deal progression
* Prospect engagement
* Objection severity

---

# Technology Stack

## Backend

* FastAPI
* LangChain
* LangGraph
* ChromaDB
* OpenRouter
* OpenAI-Compatible APIs
* Pydantic
* Uvicorn

## AI & Machine Learning

* GPT Models via OpenRouter
* OpenAI Embeddings
* Vector Search
* Retrieval-Augmented Generation (RAG)

## Frontend

* React
* Electron
* TailwindCSS

## Authentication

* Supabase Auth

## Real-Time Services

* Deepgram Speech-to-Text

## Deployment

* Docker
* Docker Compose

---

# API Endpoints

## Health Check

```http
GET /
```

Response:

```json
{
  "status": "ok"
}
```

---

## Upload Knowledge Document

```http
POST /upload
```

Form Data:

```text
file
user_id
```

---

## List User Files

```http
GET /user/{user_id}/files
```

---

## Delete File

```http
DELETE /user/{user_id}/files/{filename}
```

Deletes:

* Physical file
* Metadata
* Chroma vectors

---

## Generate Sales Coaching

```http
POST /query
```

Example Request:

```json
{
  "user_id": "sales_user",
  "conversation_transcript": "...",
  "prospect_transcript": "...",
  "closer_transcript": "..."
}
```

Example Response:

```json
{
  "what_to_say": "...",
  "why_it_works": "...",
  "next_move": "...",
  "deal_stage": 70,
  "close_probability": 0.82,
  "sources": []
}
```

---

# Installation

## Clone Repository

```bash
git clone https://github.com/yourusername/closeiq.git
cd closeiq
```

---

## Backend Setup

```bash
cd backend

python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
```

---

## Configure Environment Variables

Create:

```text
backend/.env
```

Example:

```env
OPENROUTER_API_KEY=your_key

OPENAI_API_BASE=https://openrouter.ai/api/v1

LLM_MODEL=openai/gpt-4o-mini

EMBEDDING_MODEL=text-embedding-3-small

SUPABASE_URL=your_supabase_url

SUPABASE_SERVICE_KEY=your_supabase_service_key
```

---

## Run Backend

```bash
uvicorn app.main:app --reload
```

Backend:

```text
http://localhost:8000
```

---

## Frontend Setup

```bash
cd realtime-transcription-app

npm install
```

Start:

```bash
npm start
```

---

# Docker Deployment

Build and run:

```bash
docker compose up --build
```

Services:

| Service  | Port |
| -------- | ---- |
| Frontend | 8080 |
| Backend  | 8000 |

---

# External Services

## OpenRouter

Used for:

* LLM responses
* Embeddings

Website:

https://openrouter.ai

---

## Deepgram

Used for:

* Real-time transcription

Website:

https://deepgram.com

---

## Supabase

Used for:

* Authentication

Website:

https://supabase.com

---

# Future Roadmap

### Phase 1

* Real-time coaching
* RAG integration
* File knowledge base

### Phase 2

* CRM integrations
* Salesforce connector
* HubSpot connector

### Phase 3

* Multi-user teams
* Analytics dashboard
* Call scoring system

### Phase 4

* Mobile applications
* React Native deployment
* Push notifications

### Phase 5

* Fine-tuned sales models
* Organization-wide knowledge graphs
* Enterprise deployment

---

# Security Considerations

* API keys stored server-side
* Environment-based configuration
* Vector store isolation per user
* Metadata tracking
* Secure document deletion
* No provider keys exposed to clients

---

# License

This project was developed as part of a Mobile Application Development project and serves as a foundation for real-time AI-powered sales enablement systems.

Feel free to fork, modify, and extend for educational or research purposes.

---

## Documentation

Additional project documentation:

* `SERVICE_SETUP.md`
* `CLOSEIQ_Mobile_Project_Article.md`
* `CLOSEIQ_Mobile_ReactNative_Deployment.md`

---

**CloseIQ — Helping Sales Teams Close Smarter, Faster, and More Consistently.**
