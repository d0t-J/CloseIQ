import os, shutil, json, sqlite3, gc, time, sys
from datetime import datetime
from pathlib import Path

from fastapi import UploadFile, HTTPException

from app.core.config import OPENAI_API_KEY, OPENAI_API_BASE, EMBEDDING_MODEL
from app.models.api_models import FileMetadata
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma

import pymupdf

try:
    import docx

    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

# Windows-specific imports for file operations
if sys.platform == "win32":
    import subprocess

UPLOAD_DIR = "user_files/"
VECTOR_DB_DIR = "vector_store/"
METADATA_DIR = "file_metadata/"
MAX_FILES_PER_USER = 3

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(VECTOR_DB_DIR, exist_ok=True)
os.makedirs(METADATA_DIR, exist_ok=True)

embeddings = OpenAIEmbeddings(
    model=EMBEDDING_MODEL,
    api_key=OPENAI_API_KEY,
    base_url=OPENAI_API_BASE,
)

# Global vectorstore cache - properly close karenge
_vectorstore_cache = {}


def cleanup_all_vectorstores():
    """Server shutdown pe saare vectorstores close karo"""
    print("🧹 Cleaning up all vectorstores...")
    for user_id in list(_vectorstore_cache.keys()):
        close_vectorstore(user_id)
    print("✅ All vectorstores cleaned up")


def cleanup_empty_vector_dirs():
    """Empty vector store directories ko cleanup karo"""
    if not os.path.exists(VECTOR_DB_DIR):
        return

    for user_dir in os.listdir(VECTOR_DB_DIR):
        user_path = os.path.join(VECTOR_DB_DIR, user_dir)
        if os.path.isdir(user_path):
            # Check if user has any metadata
            metadata = load_user_metadata(user_dir)
            if not metadata:
                # No files, try to delete directory
                print(f"🗑️ Cleaning up empty vector store for user: {user_dir}")
                force_delete_directory(user_path)


def get_metadata_path(user_id: str) -> str:
    return os.path.join(METADATA_DIR, f"{user_id}.json")


def load_user_metadata(user_id: str):
    metadata_path = get_metadata_path(user_id)
    if os.path.exists(metadata_path):
        with open(metadata_path, "r") as f:
            return json.load(f)
    return []


def save_user_metadata(user_id: str, metadata):
    metadata_path = get_metadata_path(user_id)
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)


def add_file_metadata(user_id: str, filename: str, chunks_count: int, file_size: int):
    metadata = load_user_metadata(user_id)
    existing = [f for f in metadata if f["filename"] == filename]
    if existing:
        raise ValueError(
            f"File '{filename}' already exists. Please delete it first or rename your file."
        )
    metadata.append(
        {
            "filename": filename,
            "upload_timestamp": datetime.now().isoformat(),
            "status": "processed",
            "chunks_count": chunks_count,
            "file_size": file_size,
        }
    )
    save_user_metadata(user_id, metadata)


def remove_file_metadata(user_id: str, filename: str):
    metadata = load_user_metadata(user_id)
    metadata = [f for f in metadata if f["filename"] != filename]
    save_user_metadata(user_id, metadata)


def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    try:
        doc = pymupdf.open(file_path)
        for page in doc:
            text += page.get_text()
        doc.close()
    except Exception as e:
        print(f"Error extracting PDF: {e}")
        raise
    return text


def extract_text_from_docx(file_path: str) -> str:
    if not DOCX_AVAILABLE:
        raise ImportError("DOCX not supported on this server.")
    text = ""
    try:
        doc = docx.Document(file_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    except Exception as e:
        print(f"Error DOCX: {e}")
        raise
    return text


def extract_text_from_txt(file_path: str) -> str:
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        print(f"Error TXT: {e}")
        raise


def process_document(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    elif ext == ".docx":
        return extract_text_from_docx(file_path)
    elif ext == ".txt":
        return extract_text_from_txt(file_path)
    else:
        supported = "PDF, TXT" + (", DOCX" if DOCX_AVAILABLE else "")
        raise ValueError(
            f"Unsupported file type: {ext}. Only {supported} files allowed."
        )


def close_vectorstore(user_id: str):
    """Vectorstore ko properly close karta hai taake file lock release ho"""
    if user_id in _vectorstore_cache:
        try:
            vs = _vectorstore_cache[user_id]

            # Try to reset the client properly
            try:
                if hasattr(vs, "_client") and vs._client:
                    # Clear any cached connections
                    if hasattr(vs._client, "clear_system_cache"):
                        vs._client.clear_system_cache()
                    # Reset client
                    if hasattr(vs._client, "reset"):
                        vs._client.reset()
            except:
                pass

            # Remove from cache
            del _vectorstore_cache[user_id]
            print(f"✅ Vectorstore removed from cache for user: {user_id}")
        except Exception as e:
            print(f"⚠️ Error closing vectorstore: {e}")

    # Force garbage collection multiple times
    for _ in range(3):
        gc.collect()

    # Longer delay for Windows to release file handles
    time.sleep(0.5)


def get_user_vector_store(user_id: str):
    """Vectorstore ko cache karta hai, reuse karta hai"""
    if user_id not in _vectorstore_cache:
        user_db_path = os.path.join(VECTOR_DB_DIR, user_id)
        _vectorstore_cache[user_id] = Chroma(
            persist_directory=user_db_path, embedding_function=embeddings
        )
    return _vectorstore_cache[user_id]


def add_document_to_vectorstore(user_id: str, text: str, filename: str) -> int:
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
    )
    chunks = text_splitter.split_text(text)
    vectorstore = get_user_vector_store(user_id)
    metadatas = [
        {
            "source": filename,
            "user_id": user_id,
            "chunk_id": i,
            "upload_timestamp": datetime.now().isoformat(),
        }
        for i in range(len(chunks))
    ]
    vectorstore.add_texts(texts=chunks, metadatas=metadatas)
    return len(chunks)


def force_delete_directory(path: str, max_retries: int = 5):
    """Windows ke liye robust directory deletion with aggressive cleanup"""

    # First, try to close any open connections
    gc.collect()
    time.sleep(0.3)

    for attempt in range(max_retries):
        try:
            if os.path.exists(path):
                # Try to delete all files individually first
                for root, dirs, files in os.walk(path, topdown=False):
                    for name in files:
                        file_path = os.path.join(root, name)
                        try:
                            os.chmod(file_path, 0o777)  # Change permissions
                            os.remove(file_path)
                        except Exception as e:
                            print(f"⚠️ Could not delete file {name}: {e}")

                    for name in dirs:
                        dir_path = os.path.join(root, name)
                        try:
                            os.rmdir(dir_path)
                        except Exception as e:
                            print(f"⚠️ Could not delete dir {name}: {e}")

                # Now try to delete the main directory
                os.rmdir(path)
                print(f"✅ Directory deleted: {path}")
                return True
        except Exception as e:
            print(f"⚠️ Retry {attempt + 1}/{max_retries}: {e}")

            # Aggressive cleanup between retries
            gc.collect()
            gc.collect()
            gc.collect()

            # Exponential backoff with longer delays
            time.sleep(0.5 * (attempt + 1))

    # Last resort: Windows-specific command to force delete
    if sys.platform == "win32" and os.path.exists(path):
        try:
            print(f"💥 Trying Windows rmdir /S /Q command...")
            subprocess.run(
                ["cmd", "/c", "rmdir", "/S", "/Q", path],
                check=False,
                capture_output=True,
                timeout=5,
            )
            time.sleep(0.5)
            if not os.path.exists(path):
                print(f"✅ Directory deleted using Windows command")
                return True
        except Exception as e:
            print(f"⚠️ Windows command also failed: {e}")

    print(f"❌ Could not delete directory after {max_retries} retries: {path}")
    print(
        f"💡 Directory will remain but is empty of data. You can manually delete it later."
    )
    return False


def vacuum_chromadb(user_id: str):
    """ChromaDB database ko compact karta hai"""
    user_db_path = os.path.join(VECTOR_DB_DIR, user_id)
    db_file = os.path.join(user_db_path, "chroma.sqlite3")

    if os.path.exists(db_file):
        try:
            conn = sqlite3.connect(db_file)
            conn.execute("VACUUM")
            conn.commit()
            conn.close()
            print(f"✅ Database vacuumed successfully for user: {user_id}")

            # Show size after vacuum
            size_kb = os.path.getsize(db_file) / 1024
            print(f"📊 Database size after vacuum: {size_kb:.2f} KB")
        except Exception as e:
            print(f"⚠️ Error vacuuming database: {e}")


def delete_document_from_vectorstore(user_id: str, filename: str):
    """File ke vectors ko permanently delete karta hai"""
    user_db_path = os.path.join(VECTOR_DB_DIR, user_id)
    if not os.path.exists(user_db_path):
        return

    try:
        # Check remaining files
        metadata = load_user_metadata(user_id)
        remaining_files = [f for f in metadata if f["filename"] != filename]

        if not remaining_files:
            # IMPORTANT: Last file hai, so pehle vectorstore properly close karo
            print(f"🔒 Closing vectorstore before deletion for user: {user_id}")
            close_vectorstore(user_id)

            # Extra cleanup - try to delete the SQLite WAL and SHM files if they exist
            db_file = os.path.join(user_db_path, "chroma.sqlite3")
            wal_file = db_file + "-wal"
            shm_file = db_file + "-shm"

            # Multiple garbage collection cycles
            for _ in range(5):
                gc.collect()
            time.sleep(1.0)  # Give more time for Windows

            # Try to delete WAL/SHM files first
            for extra_file in [wal_file, shm_file]:
                if os.path.exists(extra_file):
                    try:
                        os.chmod(extra_file, 0o777)
                        os.remove(extra_file)
                        print(f"✅ Deleted: {os.path.basename(extra_file)}")
                    except Exception as e:
                        print(f"⚠️ Could not delete {os.path.basename(extra_file)}: {e}")

            # Small delay
            time.sleep(0.5)

            # Ab directory delete karo
            print(f"🗑️ No files remaining, deleting entire vector store")
            success = force_delete_directory(user_db_path)

            if not success:
                print(f"⚠️ Directory not deleted but database is empty")
                print(f"💡 Manual cleanup: delete folder 'vector_store/{user_id}'")
        else:
            # Specific file ke vectors delete karo
            vectorstore = get_user_vector_store(user_id)

            # Check current count
            try:
                count_before = vectorstore._collection.count()
                print(f"📊 Vectors before deletion: {count_before}")
            except:
                count_before = "unknown"

            # Delete vectors
            vectorstore._collection.delete(where={"source": filename})
            print(f"🗑️ Deleted vectors for file: {filename}")

            # Check count after deletion
            try:
                count_after = vectorstore._collection.count()
                print(f"📊 Vectors after deletion: {count_after}")
            except:
                count_after = "unknown"

            # IMPORTANT: Close vectorstore before vacuum
            print(f"🔒 Closing vectorstore before vacuum")
            close_vectorstore(user_id)

            # Wait for file handles to release
            time.sleep(0.5)

            # Ab VACUUM karo
            vacuum_chromadb(user_id)

    except Exception as e:
        print(f"❌ Error deleting from vector store: {e}")
        # Ensure vectorstore is closed even on error
        close_vectorstore(user_id)
        raise


# ------- API logic --------


async def handle_upload(file: UploadFile, user_id: str):
    existing_files = load_user_metadata(user_id)
    if len(existing_files) >= MAX_FILES_PER_USER:
        raise HTTPException(
            status_code=400,
            detail=f"Max {MAX_FILES_PER_USER} files allowed per user. Delete old files first.",
        )
    user_folder = os.path.join(UPLOAD_DIR, user_id)
    os.makedirs(user_folder, exist_ok=True)
    file_path = os.path.join(user_folder, file.filename)

    if os.path.exists(file_path):
        raise HTTPException(
            status_code=400,
            detail=f"File '{file.filename}' already exists. Delete or rename first.",
        )

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    file_size = os.path.getsize(file_path)
    text = process_document(file_path)
    if not text.strip():
        os.remove(file_path)
        raise HTTPException(status_code=400, detail="Could not extract text from file.")
    num_chunks = add_document_to_vectorstore(user_id, text, file.filename)
    add_file_metadata(user_id, file.filename, num_chunks, file_size)
    return {
        "message": "File uploaded and processed successfully.",
        "file": file.filename,
        "chunks_created": num_chunks,
        "text_length": len(text),
        "files_count": len(existing_files) + 1,
        "remaining_slots": MAX_FILES_PER_USER - len(existing_files) - 1,
    }


def list_files(user_id: str):
    metadata = load_user_metadata(user_id)

    # Calculate actual ChromaDB size if exists
    user_db_path = os.path.join(VECTOR_DB_DIR, user_id)
    db_file = os.path.join(user_db_path, "chroma.sqlite3")
    db_size_kb = 0
    if os.path.exists(db_file):
        db_size_kb = os.path.getsize(db_file) / 1024

    return {
        "files": metadata,
        "count": len(metadata),
        "max_files": MAX_FILES_PER_USER,
        "remaining_slots": MAX_FILES_PER_USER - len(metadata),
        "chromadb_size_kb": round(db_size_kb, 2),
    }


def delete_file(user_id: str, filename: str):
    """File ko completely delete karta hai - physical file, metadata, aur vectors"""
    metadata = load_user_metadata(user_id)
    file_exists = any(f["filename"] == filename for f in metadata)

    if not file_exists:
        raise HTTPException(status_code=404, detail=f"No such file: '{filename}'")

    print(f"\n{'=' * 60}")
    print(f"🔄 Starting deletion process for file: {filename}")
    print(f"{'=' * 60}")

    # Get size before deletion
    user_db_path = os.path.join(VECTOR_DB_DIR, user_id)
    db_file = os.path.join(user_db_path, "chroma.sqlite3")
    size_before = 0
    if os.path.exists(db_file):
        size_before = os.path.getsize(db_file) / 1024
        print(f"📊 ChromaDB size BEFORE: {size_before:.2f} KB")

    # Step 1: Vector store se delete karo (ye VACUUM bhi karega)
    try:
        delete_document_from_vectorstore(user_id, filename)
    except Exception as e:
        print(f"❌ Error in vector deletion: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete vectors: {str(e)}"
        )

    # Step 2: Physical file delete karo
    file_path = os.path.join(UPLOAD_DIR, user_id, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        print(f"✅ Physical file deleted: {filename}")

    # Step 3: Metadata se remove karo
    remove_file_metadata(user_id, filename)
    print(f"✅ Metadata updated for user: {user_id}")

    # Step 4: Check size after deletion
    size_after = 0
    if os.path.exists(db_file):
        size_after = os.path.getsize(db_file) / 1024
        size_reduced = size_before - size_after
        print(f"📊 ChromaDB size AFTER: {size_after:.2f} KB")
        print(f"💾 Space reclaimed: {size_reduced:.2f} KB")

    # Step 5: Agar user folder empty hai to use bhi delete karo
    user_folder = os.path.join(UPLOAD_DIR, user_id)
    if os.path.exists(user_folder) and not os.listdir(user_folder):
        os.rmdir(user_folder)
        print(f"🗑️ Empty user folder deleted: {user_id}")

    updated_metadata = load_user_metadata(user_id)
    print(f"{'=' * 60}\n")

    return {
        "message": f"File '{filename}' permanently deleted with all vectors and data.",
        "deleted_file": filename,
        "remaining_files": len(updated_metadata),
        "available_slots": MAX_FILES_PER_USER - len(updated_metadata),
        "chromadb_size_before_kb": round(size_before, 2),
        "chromadb_size_after_kb": round(size_after, 2),
        "space_reclaimed_kb": round(size_before - size_after, 2),
        "status": "success",
    }
