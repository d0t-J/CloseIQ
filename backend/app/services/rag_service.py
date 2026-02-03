import re
import asyncio
import threading

from copy import deepcopy
from collections import OrderedDict
from fastapi import HTTPException
from langchain_openai import ChatOpenAI

from app.core.config import OPENAI_API_KEY
from app.services.file_service import get_user_vector_store
from app.models.api_models import QueryRequest, QueryResponse
from app.services.deal_engine.state import DealState
from app.services.deal_engine.perception import update_state_from_transcript
from app.services.deal_engine.decision import DecisionIntent, decide_next_intent
from app.services.deal_engine.session_store import get_deal_state, set_deal_state
from app.services.intelligence.close_probability import compute_close_probability
from app.services.intelligence.avatar_signals import extract_avatar_signals
from app.services.intelligence.avatar_store import (
    set_avatar_signals,
    get_avatar_signals,
)

PARSE_TRANSCRIPT_MAX_CHARS = 5000
_parse_cache: OrderedDict = OrderedDict()
_parse_cache_lock = threading.Lock()
_parse_cache_max_size = 256

llm = ChatOpenAI(
    model="openai/gpt-4o-mini",
    api_key=OPENAI_API_KEY,
    base_url="https://openrouter.ai/api/v1",
    temperature=0.7,
    request_timeout=1.5,
)


def _parsed_timestamped_transcript_impl(transcript: str) -> dict:
    if not transcript:
        return {
            "speakers": set(),
            "utterances": [],
            "duration_seconds": 0,
            "last_speaker": None,
        }
    pattern = r"\[(\d{1,2}:\d{2})\]\s*([^:\[\]]+):\s*([^\[]+?)(?=\[|$)"

    try:
        matches = re.findall(
            pattern, transcript[:PARSE_TRANSCRIPT_MAX_CHARS], re.MULTILINE
        )
    except re.error:
        return {
            "speakers": set(),
            "utterances": [],
            "duration_seconds": 0,
            "last_speaker": None,
        }
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
        "speaker_count": len([s for s in speakers if s.startswith("Prospect")]),
    }


def parse_timestamped_transcript(transcript: str) -> dict:
    key = transcript[:PARSE_TRANSCRIPT_MAX_CHARS] if transcript else ""

    with _parse_cache_lock:
        if key in _parse_cache:
            return deepcopy(_parse_cache[key])

    result = _parsed_timestamped_transcript_impl(transcript)

    with _parse_cache_lock:
        _parse_cache[key] = result
        if len(_parse_cache) > _parse_cache_max_size:
            _parse_cache.popitem(last=False)
        return deepcopy(result)


def parse_speaker_from_transcripts(transcript: str) -> dict:
    pattern = r"\[([^\]]+)\]:\s*([^\[]+)"
    matches = re.findall(pattern, transcript)

    speakers = {}
    for speaker, text in matches:
        speaker = speaker.strip()
        if speaker not in speakers:
            speakers[speaker] = []
        speakers[speaker].append(text.strip())

    return speakers


def retrieve_context(user_id: str, query: str, k: int = 3):
    vectorstore = get_user_vector_store(user_id)
    docs = vectorstore.similarity_search(query, k=k)
    if not docs:
        return "", []
    context = "\n\n".join([doc.page_content for doc in docs])
    sources = [doc.metadata.get("source", "Unknown") for doc in docs]
    return context, sources


async def retrieve_context_async(user_id: str, query: str, k: int = 3):
    return await asyncio.to_thread(retrieve_context, user_id, query, k)


async def ai_suggestion(
    deal_state: DealState,
    decision_intent: DecisionIntent,
    close_probability: float,
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
            You are a real-time sales copilot.

            SYSTEM STATE (AUTHORITATIVE):
            Stage: {deal_state.stage}%
            Objection: {deal_state.objection_level}
            Payment Discussed: {deal_state.payment_discussed}

            INTELLIGENCE (INFORMATIONAL - DOES NOT AFFECT INTENT OR STRATEGY):
            Close Probability: {close_probability:.0%}

            DECISION (FIXED):
            Intent: {decision_intent.value}

            SPEAKER CONTEXT:
            {speaker_info}

            RULES:
            - Do NOT change intent or state
            - Only phrase language to execute the intent
            - Be concise, direct, and spoken

            FORMAT:
            What to Say:
            Why It Works:
            Next Move:
            Conversation Summary:

            CONTEXT:
            Summary: {conversation_summary or "None"}
            Transcript: {conversation_transcript or "None"}
            Knowledge: {context or "None"}
        """

    try:
        response = await llm.ainvoke(prompt)
    except Exception as e:
        if "timeout" in str(e).lower():
            print(f"LLM timeout: {str(e)}")
        else:
            print(f"LLM invocation failed: {str(e)}")
        return {
            "what_to_say": "Let's lock in the next step so we don't lose momentum.",
            "why_it_works": "Keeps control even if the system stalls.",
            "next_move": "Ask for availability or commitment.",
            "speakers_detected": parsed.get("speaker_count", 1),
        }
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
        # "conversation_summary": sections["summary"].strip(),
        "speakers_detected": parsed.get("speaker_count", 1),
    }


async def handle_query(req: QueryRequest) -> QueryResponse:
    try:
        session_key = req.session_id if req.session_id else req.user_id

        deal_state = get_deal_state(session_key)

        deal_state = update_state_from_transcript(
            deal_state, req.conversation_transcript or ""
        )
        set_deal_state(session_key, deal_state)

        avatar_signals = get_avatar_signals(session_key)

        if req.prospect_transcript:
            avatar_signals = extract_avatar_signals(
                req.closer_transcript, avatar_signals
            )
        set_avatar_signals(session_key, avatar_signals)

        search_text = req.conversation_transcript or req.prospect_transcript
        search_query = f"Sales conversation: {search_text[:300]}"

        intent = decide_next_intent(deal_state)

        close_probability = compute_close_probability(deal_state)

        use_rag = intent in [
            DecisionIntent.HANDLE_OBJECTION,
            DecisionIntent.PUSH_PAYMENT,
        ]

        context = ""
        sources = []

        if use_rag:
            context, sources = await retrieve_context_async(
                req.user_id, search_query, k=3
            )

        suggestion = await ai_suggestion(
            deal_state=deal_state,
            decision_intent=intent,
            close_probability=close_probability,
            conversation_transcript=req.conversation_transcript or "",
            # conversation_summary=req.conversation_summary,
            conversation_summary="",
            prospect_transcript=req.prospect_transcript,
            closer_transcript=req.closer_transcript,
            context=context,
        )

        return QueryResponse(
            what_to_say=suggestion["what_to_say"],
            why_it_works=suggestion["why_it_works"],
            next_move=suggestion["next_move"],
            # conversation_summary=suggestion["conversation_summary"],
            sources=list(set(sources)),
            speakers_detected=suggestion.get("speakers_detected", 1),
            close_probability=close_probability,
        )

    except Exception as e:
        print(f"AI suggestion failed: {str(e)}")
        return QueryResponse(
            what_to_say="Let's lock in the next step so we don't lose momentum.",
            why_it_works="Keeps controls even if system stalls.",
            next_move="Ask for availability or commitment.",
            sources=[],
            speakers_detected=1,
            close_probability=0.0,
        )
