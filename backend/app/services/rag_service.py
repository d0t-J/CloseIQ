import os
from fastapi import HTTPException
from app.core.config import OPENAI_API_KEY
from app.services.file_service import get_user_vector_store
from langchain_openai import ChatOpenAI
from app.models.api_models import QueryRequest, QueryResponse

llm = ChatOpenAI(
    model="openai/gpt-4o-mini",
    api_key=OPENAI_API_KEY,
    base_url="https://openrouter.ai/api/v1",
    temperature=0.7
)

def retrieve_context(user_id: str, query: str, k: int = 3):
    vectorstore = get_user_vector_store(user_id)
    docs = vectorstore.similarity_search(query, k=k)
    if not docs:
        return "", []
    context = "\n\n".join([doc.page_content for doc in docs])
    sources = [doc.metadata.get("source", "Unknown") for doc in docs]
    return context, sources

def ai_suggestion(
    prospect_transcript: str,
    closer_transcript: str,
    context: str
):
    prompt = f"""
You are an expert sales coach helping a closer during a live sales call.

You have access to:
1. The prospect's words
2. The closer's words
3. Relevant training materials

Your task is to respond in EXACTLY this format:

What to Say:
Why It Works:
Next Move:

TRAINING CONTEXT:
{context if context else "No relevant training materials found."}

CURRENT CONVERSATION:

Prospect:
{prospect_transcript[-500:] if len(prospect_transcript) > 500 else prospect_transcript}

Closer:
{closer_transcript[-500:] if len(closer_transcript) > 500 else closer_transcript}
"""
    try:
        response = llm.invoke(prompt)
        content = response.content

        # Simple parser - adjust as needed
        lines = content.split("\n")
        what, why, nextm, section = "", "", "", None
        for line in lines:
            l = line.lower().strip()
            if l.startswith("what to say"):
                section = "what"; continue
            elif l.startswith("why"):
                section = "why"; continue
            elif l.startswith("next"):
                section = "next"; continue
            if section == "what": what += line + " "
            elif section == "why": why += line + " "
            elif section == "next": nextm += line + " "
        return {
            "what_to_say": what.strip() or content[:200],
            "why_it_works": why.strip() or "Strategic response.",
            "next_move": nextm.strip() or "Keep conversation going."
        }
    except Exception as e:
        print("LLM Error:", e)
        return {
            "what_to_say": "Error generating suggestion.",
            "why_it_works": "",
            "next_move": ""
        }

async def handle_query(req: QueryRequest) -> QueryResponse:
    try:
        query = f"Prospect said: {req.prospect_transcript[-200:]}. How should I respond?"
        context, sources = retrieve_context(req.user_id, query, k=3)
        suggestion = ai_suggestion(
            req.prospect_transcript,
            req.closer_transcript,
            context
        )
        return QueryResponse(
            what_to_say=suggestion["what_to_say"],
            why_it_works=suggestion["why_it_works"],
            next_move=suggestion["next_move"],
            sources=list(set(sources))
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying RAG: {str(e)}")