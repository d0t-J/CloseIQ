from enum import Enum
from app.services.deal_engine.state import DealState


class DecisionIntent(str, Enum):
    BUILD_RAPPORT = "BUILD_RAPPORT"
    HANDLE_OBJECTION = "HANDLE_OBJECTION"
    TRIAL_CLOSE = "TRIAL_CLOSE"
    PUSH_PAYMENT = "PUSH_PAYMENT"
    CLARIFY_NEXT_STEP = "CLARIFY_NEXT_STEP"


def decide_next_intent(deal_state: DealState) -> DecisionIntent:
    if deal_state.objection_level == "Core":
        return DecisionIntent.HANDLE_OBJECTION
    if deal_state.objection_level == "Logical":
        return DecisionIntent.HANDLE_OBJECTION
    if deal_state.objection_level == "Surface":
        if deal_state.stage >= 80:
            return DecisionIntent.TRIAL_CLOSE
        return DecisionIntent.HANDLE_OBJECTION

    if deal_state.stage >= 80:
        return DecisionIntent.TRIAL_CLOSE

    if deal_state.payment_discussed and deal_state.stage >= 60:
        return DecisionIntent.PUSH_PAYMENT

    if deal_state.stage < 30:
        return DecisionIntent.BUILD_RAPPORT

    return DecisionIntent.CLARIFY_NEXT_STEP
