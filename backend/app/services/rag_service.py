import re
from fastapi import HTTPException
from app.core.config import OPENAI_API_KEY
from app.services.file_service import get_user_vector_store
from langchain_openai import ChatOpenAI

from app.models.api_models import QueryRequest, QueryResponse
from app.services.deal_engine.state import DealState
from app.services.deal_engine.perception import update_state_from_transcript
from app.services.deal_engine.decision import DecisionIntent, decide_next_intent


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
            [speaker for speaker in speakers if speaker.startswith("Prospect")]
        ),
    }


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


def ai_suggestion(
    deal_state: DealState,
    decision_intent: DecisionIntent,
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

                SYSTEM STATE (AUTHORITATIVE — DO NOT OVERRIDE):
                - Deal Stage: {deal_state.stage}%
                - Objection Level: {deal_state.objection_level}
                - Payment Discussed: {deal_state.payment_discussed}

                DECISION (ALREADY MADE BY SYSTEM):
                - Intent: {decision_intent.value}

                YOUR ROLE:
                - You are NOT allowed to change the intent
                - You are NOT allowed to reclassify the deal
                - You must ONLY phrase language that executes the intent

                INTENT DEFINITIONS:
                - BUILD_RAPPORT → Ask light, open-ended questions to build comfort
                - HANDLE_OBJECTION → Address the objection directly and move forward
                - TRIAL_CLOSE → Ask for a decision or commitment
                - PUSH_PAYMENT → Transition into payment discussion confidently
                - CLARIFY_NEXT_STEP → Lock in a concrete next action

                OUTPUT FORMAT (STRICT):
                What to Say:
                Why It Works:
                Next Move:
                Conversation Summary:

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

        deal_state = DealState()

        deal_state = update_state_from_transcript(
            deal_state, req.conversation_transcript or ""
        )

        intent = decide_next_intent(deal_state)

        suggestion = ai_suggestion(
            deal_state=deal_state,
            decision_intent=intent.value,
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
