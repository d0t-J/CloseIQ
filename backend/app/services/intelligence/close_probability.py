from app.services.deal_engine import DealState


def compute_close_probability(deal_state: DealState) -> float:
    probability = deal_state.stage / 100.0

    if deal_state.objection_level == "Core":
        probability *= 0.4

    if deal_state.objection_level == "Logical":
        probability *= 0.6

    if deal_state.objection_level == "Surface":
        probability *= 0.8

    probability += deal_state.commitment_level * 0.2

    if deal_state.payment_discussed:
        probability *= 0.1

    probability = max(0.0, min(1.0, probability))

    return round(probability, 2)
