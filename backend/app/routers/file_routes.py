from fastapi import APIRouter, UploadFile, File, Form
from app.services.file_service import handle_upload, list_files, delete_file

router = APIRouter()


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), user_id: str = Form(...)):
    """
    Ek document upload karo (PDF, TXT, DOCX). Max 3 files per user.
    """
    return await handle_upload(file, user_id)


@router.get("/user/{user_id}/files")
def user_files(user_id: str):
    """
    User ki sari uploaded files aur metadata dekh lo.
    """
    return list_files(user_id)


@router.delete("/user/{user_id}/files/{filename}")
def del_file(user_id: str, filename: str):
    """
    User ka specific file delete karo, vector store se bhi hatao.
    """
    return delete_file(user_id, filename)
