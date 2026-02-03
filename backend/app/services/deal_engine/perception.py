import re

from app.services.deal_engine.state import DealState

RECENT_TRANSCRIPT_CHARS = 5000


def update_state_from_transcript(deal_state: DealState, transcript: str) -> DealState:
    if not transcript:
        return deal_state

    recent = transcript[-RECENT_TRANSCRIPT_CHARS:]
    text = recent.lower()

    if any(word in text for word in ["price", "cost", "payment", "invest"]):
        deal_state.stage = max(deal_state.stage, 70)

    if any(
        word in text for word in ["need to think", "let me think", "get back to you"]
    ):
        deal_state.stage = max(deal_state.stage, 55)
        deal_state.objection_level = infer_basic_objection_level(recent)

    if any(
        word in text
        for word in [
            "how soon",
            "when can we start",
            "tell me more",
            "how does this work",
        ]
    ):
        deal_state.commitment_level = min(1.0, deal_state.commitment_level + 0.2)

    if any(word in text for word in ["hi", "hello", "just looking"]):
        deal_state.stage = max(deal_state.stage, 20)

    if "payment" in text or "pay" in text:
        deal_state.payment_discussed = True

    return deal_state


def infer_basic_objection_level(transcript: str) -> str:
    prospect_text = extract_prospect_utterances(transcript)

    if not prospect_text:
        return "None"

    surface = ["need to think", "send me", "get back to you", "talk to my"]

    logical = ["too expensive", "price", "cost", "budget", "compare"]

    core = ["not sure this is for me", "worried", "scared", "failed before"]

    if any(p in prospect_text for p in surface):
        return "Surface"
    if any(p in prospect_text for p in logical):
        return "Logical"
    if any(p in prospect_text for p in core):
        return "Core"

    return "None"


def extract_prospect_utterances(transcript: str) -> str:
    if not transcript:
        return ""

    pattern = r"\[(\d{1,2}:\d{2})\]\s*(Prospect[^:]*):\s*(.+?)(?=\[(\d{1,2}:\d{2})\]|$)"
    matches = re.findall(pattern, transcript, re.DOTALL)

    # Pattern captures: (timestamp, speaker_label, text, next_timestamp_or_empty)
    # We want the text (index 2)
    prospect_lines = [match[2].strip() for match in matches if len(match) >= 3]
    return " ".join(prospect_lines).lower()
