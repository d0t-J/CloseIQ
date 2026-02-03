from collections import defaultdict
from app.services.intelligence.avatar_signals import AvatarSignals

_avatar_signal_store = defaultdict(AvatarSignals)


def get_avatar_signals(session_key: str) -> AvatarSignals:
    return _avatar_signal_store


def set_avatar_signals(session_key: str, avatar_signals: AvatarSignals) -> None:
    _avatar_signal_store[session_key] = avatar_signals
