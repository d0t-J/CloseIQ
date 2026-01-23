import React, { useState, useEffect } from "react";
import "./FileUpload.css";

function FileUpload({ session, backendUrl }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState("");
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [maxFiles, setMaxFiles] = useState(3);
    const [remainingSlots, setRemainingSlots] = useState(3);
    const [loading, setLoading] = useState(true);

    // Load uploaded files on mount
    useEffect(() => {
        if (session?.user?.id) {
            loadUploadedFiles();
        }
    }, [session]);

    const loadUploadedFiles = async () => {
        try {
            setLoading(true);
            const response = await fetch(
                `${backendUrl}/user/${session.user.id}/files`,
            );

            if (response.ok) {
                const data = await response.json();
                setUploadedFiles(data.files || []);
                setMaxFiles(data.max_files || 3);
                setRemainingSlots(data.remaining_slots || 3);
            }
        } catch (error) {
            console.error("Error loading files:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];

        if (!selectedFile) return;

        // Check if slots available
        if (remainingSlots <= 0) {
            setMessage(
                `❌ Maximum ${maxFiles} files allowed. Please delete a file first.`,
            );
            setFile(null);
            return;
        }

        // Validate file type
        const allowedTypes = [".pdf", ".txt"];
        const fileExt = selectedFile.name
            .toLowerCase()
            .substring(selectedFile.name.lastIndexOf("."));

        if (!allowedTypes.includes(fileExt)) {
            setMessage("❌ Only PDF and TXT files are supported");
            setFile(null);
            return;
        }

        // Check if file already exists
        const fileExists = uploadedFiles.some(
            (f) => f.filename === selectedFile.name,
        );
        if (fileExists) {
            setMessage(
                `❌ File "${selectedFile.name}" already exists. Please delete it first or rename your file.`,
            );
            setFile(null);
            return;
        }

        setFile(selectedFile);
        setMessage("");
    };

    const handleUpload = async () => {
        if (!file) {
            setMessage("❌ Please select a file first");
            return;
        }

        if (!session?.user?.id) {
            setMessage("❌ User not authenticated");
            return;
        }

        setUploading(true);
        setMessage("⏳ Uploading and processing...");

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("user_id", session.user.id);

            const response = await fetch(`${backendUrl}/upload`, {
                method: "POST",
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Upload failed");
            }

            setMessage(
                `✅ ${data.message}\n📄 Created ${data.chunks_created} knowledge chunks\n📊 Files: ${data.files_count}/${maxFiles}`,
            );
            setFile(null);

            // Reset file input
            document.getElementById("file-input").value = "";

            // Reload file list
            await loadUploadedFiles();
        } catch (error) {
            console.error("Upload error:", error);
            setMessage(`❌ Error: ${error.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (filename) => {
        if (
            !confirm(
                `Are you sure you want to delete "${filename}"? This will remove the file and all its embeddings.`,
            )
        ) {
            return;
        }

        try {
            setMessage("⏳ Deleting file and embeddings...");

            const response = await fetch(
                `${backendUrl}/user/${session.user.id}/files/${encodeURIComponent(filename)}`,
                {
                    method: "DELETE",
                },
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Delete failed");
            }

            setMessage(`✅ ${data.message}`);

            // Reload file list
            await loadUploadedFiles();
        } catch (error) {
            console.error("Delete error:", error);
            setMessage(`❌ Error: ${error.message}`);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
        return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    };

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleString();
    };

    return (
        <div className="file-upload-container">
            <h2>📚 Training Documents</h2>
            <p className="upload-description">
                Upload sales scripts, objection handlers, or training materials.
                These will be used to provide context-aware AI suggestions.
            </p>

            {/* File Limit Indicator */}
            <div className="file-limit-indicator">
                <div className="slots">
                    {Array.from({ length: maxFiles }).map((_, i) => (
                        <div
                            key={i}
                            className={`slot ${i < uploadedFiles.length ? "filled" : "empty"}`}
                        >
                            {i < uploadedFiles.length ? "📄" : "⬜"}
                        </div>
                    ))}
                </div>
                <p className="limit-text">
                    {uploadedFiles.length}/{maxFiles} files used •{" "}
                    {remainingSlots} slot{remainingSlots !== 1 ? "s" : ""}{" "}
                    available
                </p>
            </div>

            {/* Uploaded Files List */}
            {loading ? (
                <div className="loading-files">Loading files...</div>
            ) : uploadedFiles.length > 0 ? (
                <div className="uploaded-files-list">
                    <h3>📁 Your Files</h3>
                    {uploadedFiles.map((fileInfo, index) => (
                        <div key={index} className="file-item">
                            <div className="file-info">
                                <div className="file-name">
                                    📄 {fileInfo.filename}
                                </div>
                                <div className="file-details">
                                    <span className="file-chunks">
                                        🧩 {fileInfo.chunks_count} chunks
                                    </span>
                                    <span className="file-size">
                                        💾 {formatFileSize(fileInfo.file_size)}
                                    </span>
                                    <span className="file-date">
                                        📅{" "}
                                        {formatDate(fileInfo.upload_timestamp)}
                                    </span>
                                </div>
                            </div>
                            <button
                                className="delete-btn"
                                onClick={() => handleDelete(fileInfo.filename)}
                                title="Delete file and embeddings"
                            >
                                🗑️ Delete
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="no-files">
                    <p>📭 No files uploaded yet</p>
                </div>
            )}

            {/* Upload Section */}
            {remainingSlots > 0 ? (
                <div className="upload-box">
                    <input
                        id="file-input"
                        type="file"
                        accept=".pdf,.txt"
                        onChange={handleFileChange}
                        disabled={uploading || remainingSlots <= 0}
                    />

                    {file && (
                        <div className="file-selected">
                            📄 Selected: <strong>{file.name}</strong> (
                            {(file.size / 1024).toFixed(2)} KB)
                        </div>
                    )}

                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className="upload-btn"
                    >
                        {uploading ? "⏳ Processing..." : "📤 Upload & Process"}
                    </button>
                </div>
            ) : (
                <div className="no-slots-available">
                    <p>
                        ⚠️ Maximum files reached. Delete a file to upload a new
                        one.
                    </p>
                </div>
            )}

            {message && (
                <div
                    className={`upload-message ${message.includes("✅") ? "success" : "error"}`}
                >
                    {message}
                </div>
            )}

            <div className="upload-info">
                <h3>ℹ️ File Management Rules:</h3>
                <ul>
                    <li>📊 Maximum {maxFiles} active files per user</li>
                    <li>📕 Supported: PDF and TXT files</li>
                    <li>🔄 Files are processed incrementally (no overwrite)</li>
                    <li>🗑️ Deleting removes file + embeddings only</li>
                    <li>💾 Data persists across restarts</li>
                </ul>
            </div>
        </div>
    );
}

export default FileUpload;
