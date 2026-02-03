from typing import Dict

from app.services.intelligence.avatar_profile import AvatarProfile
from app.services.intelligence.avatar_signals import AvatarSignals


def converge_avatar(signals: AvatarSignals) -> AvatarProfile:
    scores: Dict[str, float] = signals.scores

    avatar_type, top_score = max(scores.items(), key=lambda x: x[1])

    total_score = sum(scores.values())

    if total_score == 0:
        return AvatarProfile()

    confidence = top_score / total_score

    evidence = signals.evidence.get(avatar_type, [])

    return AvatarProfile(
        avatar_type=avatar_type, confidence=confidence, evidence=evidence
    )
