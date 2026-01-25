import React, { useState, useEffect } from "react";

// KnowledgeBasePopup Component
export function KnowledgeBasePopup({ open, onClose, session, backendUrl, enzetiLogo }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [maxFiles, setMaxFiles] = useState(3);
  const [remainingSlots, setRemainingSlots] = useState(3);
  const [loading, setLoading] = useState(true);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (session?.user?.id && open) {
      loadUploadedFiles();
    }
  }, [session, open]);

  const loadUploadedFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${backendUrl}/user/${session.user.id}/files`
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
    validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (selectedFile) => {
    if (!selectedFile) return;

    if (remainingSlots <= 0) {
      setMessage(
        `❌ Maximum ${maxFiles} files allowed. Please delete a file first.`
      );
      setFile(null);
      return;
    }

    const allowedTypes = [".pdf", ".txt"];
    const fileExt = selectedFile.name
      .toLowerCase()
      .substring(selectedFile.name.lastIndexOf("."));

    if (!allowedTypes.includes(fileExt)) {
      setMessage("❌ Only PDF and TXT files are supported");
      setFile(null);
      return;
    }

    const fileExists = uploadedFiles.some(
      (f) => f.filename === selectedFile.name
    );
    if (fileExists) {
      setMessage(
        `❌ File "${selectedFile.name}" already exists. Please delete it first or rename your file.`
      );
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setMessage("");
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
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
        `✅ ${data.message} - Created ${data.chunks_created} knowledge chunks`
      );
      setFile(null);

      const fileInput = document.getElementById("kb-file-input");
      if (fileInput) fileInput.value = "";

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
      !window.confirm(
        `Are you sure you want to delete "${filename}"? This will remove the file and all its embeddings.`
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
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Delete failed");
      }

      setMessage(`✅ ${data.message}`);
      await loadUploadedFiles();
    } catch (error) {
      console.error("Delete error:", error);
      setMessage(`❌ Error: ${error.message}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f0f0f] border border-[#262626] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="border-b border-[#262626] p-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {enzetiLogo && (
                <img
                  src={enzetiLogo}
                  alt="eNZeTi Logo"
                  className="h-8 w-auto object-contain drop-shadow-[0_0_20px_rgba(212,175,55,0.35)]"
                />
              )}
              <span className="text-[#888] text-sm font-medium uppercase tracking-wider">
                Management
              </span>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-1">
              Knowledge Base
            </h2>
            <p className="text-[#888] text-sm">
              Enhance AI intelligence by uploading specific sales guidelines and
              scripts.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#666] hover:text-white transition-colors text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Slots Indicator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  {Array.from({ length: maxFiles }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full ${
                        i < uploadedFiles.length
                          ? "bg-[#d4af37]"
                          : "bg-[#262626]"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-[#888]">
                  <span className="text-white font-medium">
                    {uploadedFiles.length}
                  </span>{" "}
                  of{" "}
                  <span className="text-white font-medium">{maxFiles}</span>{" "}
                  slots utilized
                </span>
              </div>
              <div className="text-xs text-[#888] bg-[#1a1a1a] px-3 py-1.5 rounded-lg border border-[#262626]">
                PDF + TXT
              </div>
            </div>

            {/* Upload Zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
                dragActive
                  ? "border-[#d4af37] bg-[#d4af37]/5"
                  : "border-[#262626] bg-[#0a0a0a] hover:border-[#d4af37]/30"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                id="kb-file-input"
                type="file"
                accept=".pdf,.txt"
                onChange={handleFileChange}
                disabled={uploading || remainingSlots <= 0}
                className="hidden"
              />
              <label
                htmlFor="kb-file-input"
                className="flex flex-col items-center gap-4 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-[#666]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div>
                  <span className="text-white font-medium hover:text-[#d4af37] transition-colors">
                    Click to upload
                  </span>
                  <span className="text-[#666]"> or drag and drop</span>
                  <p className="text-xs text-[#666] mt-2">
                    MAXIMUM 10MB PER FILE
                  </p>
                </div>
              </label>
            </div>

            {/* Active Documents */}
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-[#888] uppercase tracking-wider">
                Active Documents
              </h3>

              {loading ? (
                <div className="text-center text-[#666] py-8">
                  Loading files...
                </div>
              ) : uploadedFiles.length > 0 ? (
                uploadedFiles.map((fileInfo, idx) => (
                  <div
                    key={idx}
                    className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 hover:border-[#333] transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-5 h-5 text-[#d4af37]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium text-sm mb-1 truncate">
                            {fileInfo.filename}
                          </h4>
                          <div className="flex items-center gap-3 text-xs text-[#666]">
                            <span>{formatFileSize(fileInfo.file_size)}</span>
                            <span>•</span>
                            <span>
                              {formatDate(fileInfo.upload_timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#d4af37] bg-[#d4af37]/10 px-2.5 py-1 rounded-md">
                          READY
                        </span>
                        <button
                          onClick={() => handleDelete(fileInfo.filename)}
                          className="text-[#666] hover:text-red-400 transition-colors p-1"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {uploading && file?.name === fileInfo.filename && (
                      <div className="space-y-2">
                        <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#d4af37] to-[#f4d03f] rounded-full w-2/3 animate-pulse" />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#666]">
                            INDEXING VECTORS...
                          </span>
                          <span className="text-white font-medium">68%</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center text-[#666] py-8 bg-[#0a0a0a] border border-[#262626] rounded-xl">
                  📭 No files uploaded yet
                </div>
              )}
            </div>
          </div>

          {/* Right Column - AI Integration Rules */}
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">
                AI Integration Rules
              </h3>

              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#d4af37]/10 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-[#d4af37]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-medium text-sm mb-1">
                      Storage Capacity
                    </h4>
                    <p className="text-xs text-[#888] leading-relaxed">
                      Limit of 3 core training documents per active profile.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#d4af37]/10 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-[#d4af37]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-medium text-sm mb-1">
                      Smart Indexing
                    </h4>
                    <p className="text-xs text-[#888] leading-relaxed">
                      Neural embeddings are generated instantly for RAG
                      retrieval.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#d4af37]/10 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-[#d4af37]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-medium text-sm mb-1">
                      Private & Secure
                    </h4>
                    <p className="text-xs text-[#888] leading-relaxed">
                      Documents are siloed and used only for your specific
                      coaching.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Expert Tip */}
            <div className="bg-gradient-to-br from-[#d4af37]/10 to-transparent border border-[#d4af37]/20 rounded-xl p-4">
              <div className="flex items-start gap-2 mb-2">
                <svg
                  className="w-4 h-4 text-[#d4af37] flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <span className="text-xs font-semibold text-[#d4af37] uppercase tracking-wider">
                  Expert Tip
                </span>
              </div>
              <p className="text-xs text-[#ccc] leading-relaxed italic">
                "Focus on uploading transcripts of your most successful closing
                calls to teach the AI your unique tone."
              </p>
            </div>

            {/* Footer Note */}
            <div className="pt-4 border-t border-[#262626]">
              <div className="flex items-center gap-2 text-xs text-[#666]">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <span>LOCAL ENCRYPTION ACTIVE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Message Toast */}
        {message && (
          <div className="px-6 pb-4">
            <div
              className={`text-sm px-4 py-3 rounded-lg ${
                message.includes("✅")
                  ? "bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}
            >
              {message}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="border-t border-[#262626] p-6 flex items-center justify-between bg-[#0a0a0a]">
          <button
            onClick={onClose}
            className="text-sm text-[#888] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="bg-[#d4af37] hover:bg-[#c9a227] disabled:bg-[#262626] disabled:text-[#666] text-black font-semibold px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>{uploading ? "Processing..." : "Sync Changes"}</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Demo wrapper
export default function App() {
  const [popupOpen, setPopupOpen] = useState(true);

  // Mock session and backend URL for demo
  const mockSession = {
    user: {
      id: "demo-user-123",
    },
  };

  const mockBackendUrl = "https://api.example.com";

  // Mock logo - replace with your actual logo import
  const mockLogo = "https://via.placeholder.com/120x120/d4af37/000000?text=eNZeTi";

  return (
    <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center p-4">
      <button
        onClick={() => setPopupOpen(true)}
        className="bg-[#d4af37] hover:bg-[#c9a227] text-black font-semibold px-6 py-3 rounded-lg transition-colors"
      >
        Open Knowledge Base
      </button>

      <KnowledgeBasePopup
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
        session={mockSession}
        backendUrl={mockBackendUrl}
        enzetiLogo={mockLogo}
      />
    </div>
  );
}