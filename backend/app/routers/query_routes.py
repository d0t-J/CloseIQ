from fastapi import APIRouter
from app.models.api_models import QueryRequest, QueryResponse
from app.services.rag_service import handle_query

router = APIRouter()

@router.post("/query", response_model=QueryResponse)
async def query_rag(req: QueryRequest):
    return await handle_query(req)            