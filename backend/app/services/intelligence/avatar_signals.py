from dataclasses import dataclass, field
from typing import Dict, List

@dataclass
class AvatarSignals:
    scores: Dict[str, float] = field(default_factory=lambda: {
        "well_resourced": 0.0,
        "crisis": 0.0,
        "research": 0.0,
        "analytical": 0.0,
        "broke_but_motivated": 0.0,
    })

    evidence : Dict[str, List[str]] = field(default_factory=lambda: {
        "well_resourced": [],
        "crisis": [],
        "research": [],
        "analytical": [],
        "broke_but_motivated": [],
    })

def extract_avatar_signals(prospect_text: str, signals: AvatarSignals) -> AvatarSignals:

    text = prospect_text.lower()

    if "compare" in text or "other options" in text:
        signals.scores["research"] += 0.2
        signals.evidence["research"].append("Asked for comparisons")
    if "budget" in text or "tight right now" in text:
        signals.scores["crisis"] += 0.2
        signals.evidence["crisis"].append("Mentioned budget constraints")
    if "roi" in text or "leverage" in text:
        signals.scores["well_resourced"] += 0.2
        signals.evidence["well_resourced"].append("Focused on ROI and Leverage")
    return signals