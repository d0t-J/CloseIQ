from app.services.deal_engine.state import DealState

_session_state: dict[str, DealState] = {}

def get_deal_state(session_key: str) ->DealState:
    if session_key not in _session_state:
        _session_state[session_key] = DealState()
    return _session_state[session_key]

def set_deal_state(session_key: str, deal_state: DealState) -> None:
    _session_state[session_key] = deal_state