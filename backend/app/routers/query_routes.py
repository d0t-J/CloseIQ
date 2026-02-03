from fastapi import APIRouter
from app.models.api_models import QueryRequest
from app.models.cockpit_model import SalesCockpit
from app.services.rag_service import handle_query

router = APIRouter()


@router.post("/query", response_model=SalesCockpit)
async def query_rag(req: QueryRequest):
    return await handle_query(req)
