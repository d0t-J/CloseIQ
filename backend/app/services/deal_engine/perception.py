from app.services.deal_engine.state import DealState


def update_state_from_transcript(deal_state: DealState, transcript: str) -> str:
    if not transcript:
        return deal_state

    text = transcript.lower()

    if any(word in text for word in ["price", "cost", "payment", "invest"]):
        deal_state.stage = max(deal_state.stage, 70)

    if any(
        word in text for word in ["need to think", "let me think", "get back to you"]
    ):
        deal_state.stage = max(deal_state.stage, 55)
        deal_state.objection_level = infer_basic_objection_level(transcript)

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
        deal_state.stage = max(deal_state.state, 20)

    if "payment" in text or "pay" in text:
        deal_state.payment_discussed = True

    return deal_state

def infer_basic_objection_level(transcript: str) -> str:
    if not transcript:
        return "None"

    text = transcript.lower()

    surface = ["need to think", "send me", "get back to you", "talk to my"]

    logical = ["too expensive", "price", "cost", "budget", "compare"]

    core = ["not sure this is for me", "worried", "scared", "failed before"]

    if any(p in text for p in surface):
        return "Surface"
    if any(p in text for p in logical):
        return "Logical"
    if any(p in text for p in core):
        return "Core"

    return "None"
