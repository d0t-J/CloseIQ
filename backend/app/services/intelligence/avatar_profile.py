from dataclasses import dataclass
from typing import Optional, List


@dataclass
class AvatarProfile:
    avatar_type: Optional[str] = None
    confidence: float = 0.0
    evidence: List[str] = None

    def is_confident(self, threshold: float = 0.0) -> bool:
        return self.avatar_type is not None and self.confidence >= threshold
