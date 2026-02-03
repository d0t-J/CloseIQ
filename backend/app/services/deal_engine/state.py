from dataclasses import dataclass
from typing import Optional


@dataclass
class DealState:
    stage: int = 0
    avatar: str = "Unknown"
    objection_level: str = "None"
    payment_discussed: bool = False
    commitment_level: float = 0.0
    last_speaker: Optional[str] = None
