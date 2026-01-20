from pydantic import BaseModel
from typing import List

class FileMetadata(BaseModel):
    filename: str
    upload_timestamp: str
    status: str
    chunks_count: int
    file_size: int

class QueryRequest(BaseModel):
    user_id: str
    prospect_transcript: str
    closer_transcript: str

class QueryResponse(BaseModel):
    what_to_say: str
    why_it_works: str
    next_move: str
    sources: List[str]