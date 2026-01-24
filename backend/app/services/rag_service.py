import os
import re
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


def parse_timestamped_transcript(transcript: str) -> dict:
    if not transcript:
        return {
            "speakers": set(),
            "utterances": [],
            "duration_seconds": 0,
            "last_speaker": None,
        }
    pattern = r"\[(\d+:\d+)\]\s*([^:]+):\s*(.+?)(?=\[|$)"
    matches = re.findall(pattern, transcript, re.DOTALL)

    speakers = set()
    utterances = []
    max_time = 0
    last_speaker = None

    for timestamp, speaker, text in matches:
        speaker = speaker.strip()
        speakers.add(speaker)
        last_speaker = speaker

        parts = timestamp.split(":")
        seconds = int(parts[0]) * 60 + int(parts[1])
        max_time = max(max_time, seconds)

        utterances.append(
            {
                "timestamp": timestamp,
                "seconds": seconds,
                "speaker": speaker,
                "text": text.strip(),
            }
        )

        return {
            "speakers": speakers,
            "utterances": utterances,
            "duration_seconds": max_time,
            "last_speaker": last_speaker,
            "speaker_count": len(
                [speaker for speaker in speakers if speaker.startswithd("Prospect")]
            ),
        }


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
    conversation_transcript: str,
    prospect_transcript: str,
    closer_transcript: str,
    context: str,
):
    parsed = parse_timestamped_transcript(conversation_transcript)

    speaker_info = ""

    if parsed["speakers"]:
        prospect_speakers = [
            speaker for speaker in parsed["speakers"] if speaker.startswith("Prospect")
        ]
        if len(prospect_speakers) > 1:
            speaker_info = f"Multiple prospects detected: {', '.join(prospect_speakers)}. Pay Attention to who said that."
        if parsed["last_speaker"]:
            speaker_info += f"\nLast speaker was: {parsed['last_speaker']}"

    prompt = f"""
    You are a real-time sales copilot helping a closer during a live call.

    SPEAKER DIARIZATION INFO:
    {speaker_info if speaker_info else "Single prospect detected."}

    The transcript below includes TIMESTAMPS [MM:SS] showing when each statement was made.
    This helps you understand the conversation flow and timing.

    You will be given:
    1) A short summary of the conversation so far (if available)
    2) NEW timestamped transcript showing the conversation flow
    3) Training context (optional)

    IMPORTANT RULES:
    - Use timestamps to understand conversation FLOW and PACE
    - If someone spoke recently (last few seconds), they're likely still engaged
    - Pay attention to WHO said what - especially if multiple prospects
    - The closer is always one person
    - If one prospect has concerns while another is interested, address strategically
    - NEVER repeat old transcript
    - Treat the summary as the ONLY memory of past conversation
    - Keep responses short and actionable

    Generate EXACTLY four sections in this order:

    What to Say:
    Why It Works:
    Next Move:
    Conversation Summary:

    --------------------------------

    PREVIOUS CONVERSATION SUMMARY:
    {conversation_summary if conversation_summary else "None"}

    --------------------------------

    NEW CONVERSATION (with timestamps):
    {conversation_transcript if conversation_transcript else "No new conversation"}

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
        "speakers_detected": parsed.get("speaker_count", 1),
    }


async def handle_query(req: QueryRequest) -> QueryResponse:
    try:
        search_text = req.conversation_transcript or req.prospect_transcript
        search_query = f"Sales conversation: {search_text[:300]}"
        context, sources = retrieve_context(req.user_id, search_query, k=3)

        suggestion = ai_suggestion(
            conversation_transcript=req.conversation_transcript or "",
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
            speakers_detected=suggestion.get("speakers_detected", 1),
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI suggestion failed: {str(e)}")
