# from fastapi import FastAPI, UploadFile, File, Form, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# import shutil, os, json
# from typing import List
# from datetime import datetime
# import pymupdf  # PyMuPDF for PDFs
# try:
#     import docx
#     DOCX_AVAILABLE = True
# except ImportError:
#     DOCX_AVAILABLE = False
    
# from langchain_text_splitters import RecursiveCharacterTextSplitter
# from langchain_openai import OpenAIEmbeddings
# from langchain_chroma import Chroma
# from langchain_openai import ChatOpenAI

# from pathlib import Path
# from dotenv import load_dotenv

# load_dotenv()

# app = FastAPI()

# # CORS setup
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # In production lock this down
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Configuration
# UPLOAD_DIR = "user_files/"
# VECTOR_DB_DIR = "vector_store/"
# METADATA_DIR = "file_metadata/"
# MAX_FILES_PER_USER = 3

# os.makedirs(UPLOAD_DIR, exist_ok=True)
# os.makedirs(VECTOR_DB_DIR, exist_ok=True)
# os.makedirs(METADATA_DIR, exist_ok=True)

# # Set your OpenAI API key


# # Initialize embeddings with OpenRouter
# embeddings = OpenAIEmbeddings(
#     model="text-embedding-3-small",
#     api_key=os.getenv("OPENAI_API_KEY"),
#     base_url="https://openrouter.ai/api/v1"
# )
# # Initialize ChatOpenAI
# llm = ChatOpenAI(
#     model="openai/gpt-4o-mini",
#     api_key=os.getenv("OPENAI_API_KEY"),
#     base_url="https://openrouter.ai/api/v1",
#     temperature=0.7
# )

# # Pydantic models
# class FileMetadata(BaseModel):
#     filename: str
#     upload_timestamp: str
#     status: str
#     chunks_count: int
#     file_size: int

# class QueryRequest(BaseModel):
#     user_id: str
#     prospect_transcript: str
#     closer_transcript: str

# class QueryResponse(BaseModel):
#     what_to_say: str
#     why_it_works: str
#     next_move: str
#     sources: List[str]


# # =======================
# # FILE METADATA MANAGEMENT
# # =======================

# def get_metadata_path(user_id: str) -> str:
#     """Get path to user's metadata file"""
#     return os.path.join(METADATA_DIR, f"{user_id}.json")

# def load_user_metadata(user_id: str) -> List[dict]:
#     """Load user's file metadata"""
#     metadata_path = get_metadata_path(user_id)
#     if os.path.exists(metadata_path):
#         with open(metadata_path, 'r') as f:
#             return json.load(f)
#     return []

# def save_user_metadata(user_id: str, metadata: List[dict]):
#     """Save user's file metadata"""
#     metadata_path = get_metadata_path(user_id)
#     with open(metadata_path, 'w') as f:
#         json.dump(metadata, f, indent=2)

# def add_file_metadata(user_id: str, filename: str, chunks_count: int, file_size: int):
#     """Add new file to metadata"""
#     metadata = load_user_metadata(user_id)
    
#     # Check if file already exists
#     existing = [f for f in metadata if f['filename'] == filename]
#     if existing:
#         raise ValueError(f"File '{filename}' already exists. Please delete it first or rename your file.")
    
#     # Add new file
#     metadata.append({
#         "filename": filename,
#         "upload_timestamp": datetime.now().isoformat(),
#         "status": "processed",
#         "chunks_count": chunks_count,
#         "file_size": file_size
#     })
    
#     save_user_metadata(user_id, metadata)

# def remove_file_metadata(user_id: str, filename: str):
#     """Remove file from metadata"""
#     metadata = load_user_metadata(user_id)
#     metadata = [f for f in metadata if f['filename'] != filename]
#     save_user_metadata(user_id, metadata)


# # =======================
# # DOCUMENT PROCESSING
# # =======================

# def extract_text_from_pdf(file_path: str) -> str:
#     """Extract text from PDF using PyMuPDF"""
#     text = ""
#     try:
#         doc = pymupdf.open(file_path)
#         for page in doc:
#             text += page.get_text()
#         doc.close()
#     except Exception as e:
#         print(f"Error extracting PDF: {e}")
#         raise
#     return text

# def extract_text_from_docx(file_path: str) -> str:
#     """Extract text from DOCX"""
#     if not DOCX_AVAILABLE:
#         raise ImportError("python-docx is not installed. Only PDF and TXT files are supported.")
    
#     text = ""
#     try:
#         doc = docx.Document(file_path)
#         for paragraph in doc.paragraphs:
#             text += paragraph.text + "\n"
#     except Exception as e:
#         print(f"Error extracting DOCX: {e}")
#         raise
#     return text

# def extract_text_from_txt(file_path: str) -> str:
#     """Extract text from TXT"""
#     try:
#         with open(file_path, 'r', encoding='utf-8') as f:
#             return f.read()
#     except Exception as e:
#         print(f"Error reading TXT: {e}")
#         raise

# def process_document(file_path: str) -> str:
#     """Route to appropriate extractor based on file type"""
#     ext = Path(file_path).suffix.lower()
    
#     if ext == '.pdf':
#         return extract_text_from_pdf(file_path)
#     elif ext == '.docx':
#         return extract_text_from_docx(file_path)
#     elif ext == '.txt':
#         return extract_text_from_txt(file_path)
#     else:
#         supported = "PDF, TXT" + (", DOCX" if DOCX_AVAILABLE else "")
#         raise ValueError(f"Unsupported file type: {ext}. Only {supported} files are supported.")


# # =======================
# # VECTOR STORE MANAGEMENT
# # =======================

# def get_user_vector_store(user_id: str):
#     """Get or create vector store for a specific user"""
#     user_db_path = os.path.join(VECTOR_DB_DIR, user_id)
    
#     return Chroma(
#         persist_directory=user_db_path,
#         embedding_function=embeddings
#     )

# def add_document_to_vectorstore(user_id: str, text: str, filename: str) -> int:
#     """Chunk and add document to user's vector store with metadata"""
#     # Split text into chunks
#     text_splitter = RecursiveCharacterTextSplitter(
#         chunk_size=1000,
#         chunk_overlap=200,
#         length_function=len,
#     )
#     chunks = text_splitter.split_text(text)
    
#     # Get user's vector store
#     vectorstore = get_user_vector_store(user_id)
    
#     # Create metadata for each chunk - CRITICAL for deletion
#     metadatas = [
#         {
#             "source": filename,
#             "user_id": user_id,
#             "chunk_id": i,
#             "upload_timestamp": datetime.now().isoformat()
#         }
#         for i in range(len(chunks))
#     ]
    
#     # Add chunks with metadata (only once, not twice like in old code)
#     vectorstore.add_texts(texts=chunks, metadatas=metadatas)
    
#     return len(chunks)

# def delete_document_from_vectorstore(user_id: str, filename: str):
#     """Delete specific document's embeddings from vector store"""
#     user_db_path = os.path.join(VECTOR_DB_DIR, user_id)
    
#     if not os.path.exists(user_db_path):
#         return
    
#     vectorstore = get_user_vector_store(user_id)
    
#     # Delete by metadata filter (ChromaDB method)
#     try:
#         vectorstore._collection.delete(
#             where={"source": filename}
#         )
#     except Exception as e:
#         print(f"Error deleting from vector store: {e}")
#         raise


# # =======================
# # RAG QUERY SYSTEM
# # =======================

# def retrieve_relevant_context(user_id: str, query: str, k: int = 3) -> tuple:
#     """Retrieve relevant document chunks for a query"""
#     user_db_path = os.path.join(VECTOR_DB_DIR, user_id)
    
#     # Check if user has any documents
#     if not os.path.exists(user_db_path):
#         return "", []
    
#     vectorstore = get_user_vector_store(user_id)
    
#     # Retrieve relevant chunks
#     docs = vectorstore.similarity_search(query, k=k)
    
#     if not docs:
#         return "", []
    
#     # Combine context
#     context = "\n\n".join([doc.page_content for doc in docs])
#     sources = [doc.metadata.get("source", "Unknown") for doc in docs]
    
#     return context, sources

# def generate_ai_suggestion(
#     prospect_transcript: str,
#     closer_transcript: str,
#     context: str
# ) -> dict:
#     """Generate AI suggestion using OpenRouter with RAG context"""

#     prompt = f"""
# You are an expert sales coach helping a closer during a live sales call.

# You have access to:
# 1. The prospect's words
# 2. The closer's words
# 3. Relevant training materials

# Your task is to respond in EXACTLY this format:

# What to Say:
# Why It Works:
# Next Move:

# TRAINING CONTEXT:
# {context if context else "No relevant training materials found."}

# CURRENT CONVERSATION:

# Prospect:
# {prospect_transcript[-500:] if len(prospect_transcript) > 500 else prospect_transcript}

# Closer:
# {closer_transcript[-500:] if len(closer_transcript) > 500 else closer_transcript}
# """

#     try:
#         response = llm.invoke(prompt)
#         content = response.content

#         # Parse response
#         lines = content.split("\n")
#         what_to_say = ""
#         why_it_works = ""
#         next_move = ""

#         current_section = None
#         for line in lines:
#             l = line.lower().strip()

#             if l.startswith("what to say"):
#                 current_section = "what"
#                 continue
#             elif l.startswith("why"):
#                 current_section = "why"
#                 continue
#             elif l.startswith("next"):
#                 current_section = "next"
#                 continue

#             if current_section == "what":
#                 what_to_say += line + " "
#             elif current_section == "why":
#                 why_it_works += line + " "
#             elif current_section == "next":
#                 next_move += line + " "

#         return {
#             "what_to_say": what_to_say.strip() or content[:200],
#             "why_it_works": why_it_works.strip() or "Strategic response based on the conversation.",
#             "next_move": next_move.strip() or "Continue the conversation and probe deeper."
#         }

#     except Exception as e:
#         print("LLM Error:", e)
#         return {
#             "what_to_say": "Error generating suggestion. Please try again.",
#             "why_it_works": "",
#             "next_move": ""
#         }


# # =======================
# # API ENDPOINTS
# # =======================

# @app.post("/upload")
# async def upload_file(
#     file: UploadFile = File(...),
#     user_id: str = Form(...)
# ):
#     """Upload and process single document for RAG (MAX 3 FILES)"""
#     try:
#         # Check file limit
#         existing_files = load_user_metadata(user_id)
#         if len(existing_files) >= MAX_FILES_PER_USER:
#             raise HTTPException(
#                 status_code=400,
#                 detail=f"Maximum {MAX_FILES_PER_USER} files allowed per user. Please delete an existing file first."
#             )
        
#         # Save file
#         user_folder = os.path.join(UPLOAD_DIR, user_id)
#         os.makedirs(user_folder, exist_ok=True)
#         file_path = os.path.join(user_folder, file.filename)
        
#         # Check if file already exists
#         if os.path.exists(file_path):
#             raise HTTPException(
#                 status_code=400,
#                 detail=f"File '{file.filename}' already exists. Please delete it first or rename your file."
#             )
        
#         # Save file to disk
#         with open(file_path, "wb") as buffer:
#             shutil.copyfileobj(file.file, buffer)
        
#         file_size = os.path.getsize(file_path)
        
#         # Extract text
#         text = process_document(file_path)
        
#         if not text.strip():
#             os.remove(file_path)
#             raise HTTPException(status_code=400, detail="Could not extract text from document")
        
#         # Add to vector store (incremental)
#         num_chunks = add_document_to_vectorstore(user_id, text, file.filename)
        
#         # Save metadata
#         add_file_metadata(user_id, file.filename, num_chunks, file_size)
        
#         return {
#             "message": "Document uploaded and processed successfully!",
#             "file": file.filename,
#             "chunks_created": num_chunks,
#             "text_length": len(text),
#             "files_count": len(existing_files) + 1,
#             "remaining_slots": MAX_FILES_PER_USER - len(existing_files) - 1
#         }
        
#     except ValueError as e:
#         raise HTTPException(status_code=400, detail=str(e))
#     except ImportError as e:
#         raise HTTPException(status_code=400, detail=str(e))
#     except Exception as e:
#         # Cleanup on error
#         try:
#             file_path = os.path.join(UPLOAD_DIR, user_id, file.filename)
#             if os.path.exists(file_path):
#                 os.remove(file_path)
#         except:
#             pass
#         raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


# @app.get("/user/{user_id}/files")
# async def list_user_files(user_id: str):
#     """List all uploaded files for a user with metadata"""
#     try:
#         metadata = load_user_metadata(user_id)
#         return {
#             "files": metadata,
#             "count": len(metadata),
#             "max_files": MAX_FILES_PER_USER,
#             "remaining_slots": MAX_FILES_PER_USER - len(metadata)
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))


# @app.delete("/user/{user_id}/files/{filename}")
# async def delete_file(user_id: str, filename: str):
#     """Delete a specific file AND its embeddings"""
#     try:
#         # Check if file exists in metadata
#         metadata = load_user_metadata(user_id)
#         file_exists = any(f['filename'] == filename for f in metadata)
        
#         if not file_exists:
#             raise HTTPException(status_code=404, detail=f"File '{filename}' not found")
        
#         # 1. Delete from vector store (CRITICAL - delete embeddings)
#         delete_document_from_vectorstore(user_id, filename)
        
#         # 2. Delete physical file
#         file_path = os.path.join(UPLOAD_DIR, user_id, filename)
#         if os.path.exists(file_path):
#             os.remove(file_path)
        
#         # 3. Remove from metadata
#         remove_file_metadata(user_id, filename)
        
#         # Get updated count
#         updated_metadata = load_user_metadata(user_id)
        
#         return {
#             "message": f"File '{filename}' and its embeddings deleted successfully",
#             "deleted_file": filename,
#             "remaining_files": len(updated_metadata),
#             "available_slots": MAX_FILES_PER_USER - len(updated_metadata)
#         }
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error deleting file: {str(e)}")


# @app.post("/query", response_model=QueryResponse)
# async def query_rag(request: QueryRequest):
#     """Query RAG system for AI suggestions during sales call"""
#     try:
#         # Create query from transcripts
#         query = f"Prospect said: {request.prospect_transcript[-200:]}. How should I respond?"
        
#         # Retrieve relevant context
#         context, sources = retrieve_relevant_context(request.user_id, query, k=3)
        
#         # Generate AI suggestion
#         suggestion = generate_ai_suggestion(
#             request.prospect_transcript,
#             request.closer_transcript,
#             context
#         )
        
#         return QueryResponse(
#             what_to_say=suggestion["what_to_say"],
#             why_it_works=suggestion["why_it_works"],
#             next_move=suggestion["next_move"],
#             sources=list(set(sources))
#         )
        
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Error querying RAG: {str(e)}")


# @app.get("/")
# async def root():
#     """Health check"""
#     return {
#         "status": "ok",
#         "message": "RAG Backend with File Management",
#         "max_files_per_user": MAX_FILES_PER_USER,
#         "docx_support": DOCX_AVAILABLE
#     }


# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import file_routes, query_routes

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(file_routes.router)
app.include_router(query_routes.router)

@app.get("/")
def root():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 