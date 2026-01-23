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
    temperature=0.7,
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
    conversation_summary: str,
    prospect_transcript: str,
    closer_transcript: str,
    context: str,
):
    prompt = f"""
You are a real-time sales copilot helping a closer during a live call.

You will be given:
1) A short summary of the conversation so far (if available)
2) NEW transcript only
3) Training context (optional)

IMPORTANT RULES:
- NEVER repeat old transcript.
- Treat the summary as the ONLY memory of past conversation.
- Focus mainly on the NEW transcript.
- Keep responses short and actionable.

Generate EXACTLY four sections in this order:

What to Say:
Why It Works:
Next Move:
Conversation Summary:

--------------------------------

PREVIOUS CONVERSATION SUMMARY:
{conversation_summary if conversation_summary else "None"}

--------------------------------

NEW CONVERSATION:
Prospect:
{prospect_transcript}

Closer:
{closer_transcript}

--------------------------------

TRAINING CONTEXT:
{context if context else "None"}

--------------------------------
"""

    response = llm.invoke(prompt)
    content = response.content

    sections = {"what": "", "why": "", "next": "", "summary": ""}

    current = None
    for line in content.split("\n"):
        l = line.lower().strip()
        if l.startswith("what to say"):
            current = "what"
            continue
        if l.startswith("why"):
            current = "why"
            continue
        if l.startswith("next"):
            current = "next"
            continue
        if l.startswith("conversation summary"):
            current = "summary"
            continue

        if current:
            sections[current] += line + " "

    return {
        "what_to_say": sections["what"].strip(),
        "why_it_works": sections["why"].strip(),
        "next_move": sections["next"].strip(),
        "conversation_summary": sections["summary"].strip(),
    }


async def handle_query(req: QueryRequest) -> QueryResponse:
    try:
        search_query = f"Prospect said: {req.prospect_transcript[:200]}"
        context, sources = retrieve_context(req.user_id, search_query, k=3)

        suggestion = ai_suggestion(
            conversation_summary=req.conversation_summary,
            prospect_transcript=req.prospect_transcript,
            closer_transcript=req.closer_transcript,
            context=context,
        )

        return QueryResponse(
            what_to_say=suggestion["what_to_say"],
            why_it_works=suggestion["why_it_works"],
            next_move=suggestion["next_move"],
            conversation_summary=suggestion["conversation_summary"],
            sources=list(set(sources)),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI suggestion failed: {str(e)}")
