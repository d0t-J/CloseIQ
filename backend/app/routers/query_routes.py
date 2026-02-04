from fastapi import APIRouter
from app.models.api_models import QueryRequest
from app.models.cockpit_model import SalesCockpit
from app.services.rag_service import handle_query, llm

router = APIRouter()


@router.post("/query", response_model=SalesCockpit)
async def query_rag(req: QueryRequest):
    return await handle_query(req)


@router.get("/debug-llm")
async def debug_llm():
    try:
        response = await llm.ainvoke("Say hello in one sentence")
        return {"status": "ok", "response": response.content}
    except Exception as e:
        return {"status": "error", "error": str(e)}
