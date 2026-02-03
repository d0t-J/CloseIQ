from pydantic import BaseModel
from typing import Optional, List


class AvatarInfo(BaseModel):
    avatar_type: Optional[str]
    confidence: float
    evidence: List[str] = []

class SalesCockpit(BaseModel):
    what_to_say: str
    why_it_works: str
    next_move: str
    deal_stage: int
    objection_level: Optional[str]
    close_probability: float
    avatar: Optional[AvatarInfo]
    sources: List[str] = []
    speakers_detected: int = 1