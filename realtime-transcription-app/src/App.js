import React, { useState, useRef, useEffect } from "react";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import LoginPage from "./LoginPage";
import AISuggestions from "./AISuggestions";
import FileUpload from "./FileUpload.jsx";
import MyPopup from "./MyPopup.jsx";
import "./App.css";

function App() {
    const [session, setSession] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [prospectTranscript, setProspectTranscript] = useState("");
    const [closerTranscript, setCloserTranscript] = useState("");
    const [aiSuggestion, setAiSuggestion] = useState(null);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const prospectConnectionRef = useRef(null);
    const closerConnectionRef = useRef(null);
    const prospectMediaRecorderRef = useRef(null);
    const closerMediaRecorderRef = useRef(null);
    const deepgramClientRef = useRef(null);
    const prospectFinalTranscript = useRef("");
    const closerFinalTranscript = useRef("");
    const [popupOpen, setPopupOpen] = useState(false);
    const [conversationSummary, setConversationSummary] = useState("");
    const conversationTimeline = useRef([]);
    const recordingStartTime = useRef(null);
    // 🔹 Track last sent index for delta
    const lastSentIndex = useRef({
        prospect: 0,
        closer: 0,
    });
    const lastSentTimelineIndex = useRef(0);

    const speakerRegistry = useRef({});

    const mapSpeakerLabel = (speakerId) => {
        if (speakerRegistry.current[speakerId] === undefined) {
            const prospectNum = Object.keys(speakerRegistry.current).length + 1;
            speakerRegistry.current[speakerId] = `Prospect ${prospectNum}`;
        }
        return speakerRegistry.current[speakerId];
    };
    const formatTimestamp = (seconds) => {
        if (seconds === null || seconds === undefined) return "00:00";

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);

        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const getElapsedTime = () => {
        if (!recordingStartTime.current) return 0;

        return (Date.now() - recordingStartTime.current) / 1000;
    };

    const addToTimeline = (speaker, text, startTime, endTime) => {
        conversationTimeline.current.push({
            speaker,
            text,
            startTime: startTime ?? getElapsedTime(),
            endTime: endTime ?? getElapsedTime(),
            timestamp: new Date().toISOString(),
        });
    };

    // Backend API URL
    const BACKEND_URL =
        process.env.REACT_APP_BACKEND_URL || "http://77.37.62.127:8000";

    useEffect(() => {
        const apiKey = process.env.REACT_APP_DEEPGRAM_API_KEY;
        if (apiKey) {
            deepgramClientRef.current = createClient(apiKey);
        }

        // Keyboard shortcut listener (Command/Ctrl + J)
        const handleKeyPress = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "j") {
                e.preventDefault();
                handleGetAISuggestion();
            }
        };
        window.addEventListener("keydown", handleKeyPress);
        return () => window.removeEventListener("keydown", handleKeyPress);
    }, [prospectTranscript, closerTranscript]);

    const getDelta = (fullText, type) => {
        const lastIndex = lastSentIndex.current[type];
        const delta = fullText.slice(lastIndex);
        lastSentIndex.current[type] = fullText.length;
        return delta.trim();
    };

    const getTimelineDelta = () => {
        const newEntries = conversationTimeline.current.slice(
            lastSentTimelineIndex.current,
        );
        lastSentTimelineIndex.current = conversationTimeline.current.length;
        return newEntries;
    };

    const formatTimelineForAI = (entries) => {
        return entries
            .sort((a, b) => a.startTime - b.startTime)
            .map(
                (entry) =>
                    `[${formatTimestamp(entry.startTime)}] ${entry.speaker}: ${entry.text}`,
            )
            .join("\n");
    };

    const handleGetAISuggestion = async () => {
        const prospectDelta = getDelta(
            prospectFinalTranscript.current,
            "prospect",
        );
        const closerDelta = getDelta(closerFinalTranscript.current, "closer");

        if (!prospectDelta && !closerDelta) {
            alert("No new conversation since last suggestion.");
            return;
        }

        if (!session?.user?.id) {
            alert("User session not found!");
            return;
        }

        setIsLoadingAI(true);
        setAiSuggestion(null);

        try {
            const formattedConversation = formatTimelineForAI(getTimelineDelta);

            const response = await fetch(`${BACKEND_URL}/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: session.user.id,
                    conversation_summary: conversationSummary || "None",
                    convesation_transcript: formattedConversation,
                    prospect_transcript: prospectDelta,
                    closer_transcript: closerDelta,
                }),
            });

            if (!response.ok) throw new Error("RAG query failed");

            const data = await response.json();

            // ✅ Update suggestion
            setAiSuggestion({
                whatToSay: data.what_to_say || "",
                whyItWorks: data.why_it_works || "",
                nextMove: data.next_move || "",
                conversationSummary: data.conversation_summary || "",
                sources: data.sources || [],
                timestamp: new Date().toISOString(),
            });

            // ✅ VERY IMPORTANT: overwrite summary
            if (data.conversation_summary) {
                setConversationSummary(data.conversation_summary);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoadingAI(false);
        }
    };

    const startRecording = async () => {
        try {
            if (!deepgramClientRef.current) {
                alert("Deepgram API key missing! Please add it to .env file");
                return;
            }

            prospectFinalTranscript.current = "";
            closerFinalTranscript.current = "";
            speakerRegistry.current = {};
            conversationTimeline.current = [];
            recordingStartTime.current = Date.now();

            await startCloserTranscription();
            await startProspectTranscription();

            setIsRecording(true);
        } catch (error) {
            console.error("Error starting recording:", error);
            alert("Error: " + error.message);
        }
    };

    const startCloserTranscription = async () => {
        try {
            const micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000,
                },
            });

            const connection = deepgramClientRef.current.listen.live({
                model: "nova-2",
                language: "en-US",
                smart_format: true,
                interim_results: true,
                punctuate: true,
                endpointing: 200,
                utterance_end_ms: 1000,
            });

            connection.on(LiveTranscriptionEvents.Open, () => {
                console.log("✅ Closer connection opened");

                const mediaRecorder = new MediaRecorder(micStream, {
                    mimeType: "audio/webm",
                });

                mediaRecorder.ondataavailable = (event) => {
                    if (
                        event.data.size > 0 &&
                        connection.getReadyState() === 1
                    ) {
                        connection.send(event.data);
                    }
                };

                mediaRecorder.start(100);
                closerMediaRecorderRef.current = mediaRecorder;
            });

            connection.on(LiveTranscriptionEvents.Transcript, (data) => {
                const transcript = data.channel.alternatives[0].transcript;
                const isFinal = data.is_final;

                if (transcript && transcript.trim() !== "") {
                    if (isFinal) {
                        const startTime =
                            words.length > 0
                                ? words[0].start
                                : getElapsedTime();
                        const endTime =
                            words.length > 0
                                ? words[words.length - 1].end
                                : getElapsedTime();

                        addToTimeline("Closer", transcript, startTime, endTime);

                        closerFinalTranscript.current +=
                            (closerFinalTranscript.current ? " " : "") +
                            `[${formatTimestamp(startTime)}] ${transcript}`;
                        setCloserTranscript(closerFinalTranscript.current);
                    } else {
                        setCloserTranscript(
                            closerFinalTranscript.current +
                                (closerFinalTranscript.current ? " " : "") +
                                transcript,
                        );
                    }
                }
            });

            connection.on(LiveTranscriptionEvents.Error, (error) => {
                console.error("Closer error:", error);
            });

            closerConnectionRef.current = connection;
        } catch (error) {
            console.error("Error starting closer transcription:", error);
            throw error;
        }
    };

    const startProspectTranscription = async () => {
        try {
            const systemStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000,
                },
            });

            const audioTracks = systemStream.getAudioTracks();
            if (audioTracks.length === 0) {
                alert(
                    'Please select "Share audio" when choosing screen/window',
                );
                return;
            }

            const audioStream = new MediaStream(audioTracks);

            const connection = deepgramClientRef.current.listen.live({
                model: "nova-2",
                language: "en-US",
                smart_format: true,
                interim_results: true,
                punctuate: true,
                endpointing: 200,
                utterance_end_ms: 1000,
                diarize: true,
            });

            connection.on(LiveTranscriptionEvents.Open, () => {
                console.log("✅ Prospect connection opened");

                const mediaRecorder = new MediaRecorder(audioStream, {
                    mimeType: "audio/webm",
                });

                mediaRecorder.ondataavailable = (event) => {
                    if (
                        event.data.size > 0 &&
                        connection.getReadyState() === 1
                    ) {
                        connection.send(event.data);
                    }
                };

                mediaRecorder.start(100);
                prospectMediaRecorderRef.current = mediaRecorder;
            });

            connection.on(LiveTranscriptionEvents.Transcript, (data) => {
                const words = data.channel.alternatives[0].words || [];
                const transcript = data.channel.alternatives[0].transcript;
                const isFinal = data.is_final;

                if (!transcript || transcript.trim() === "") {
                    return;
                }

                if (
                    isFinal &&
                    words.length > 0 &&
                    words[0].speaker !== undefined
                ) {
                    let currentSpeaker = null;
                    let segments = [];
                    let currentSegment = {
                        speaker: null,
                        text: "",
                        startTime: null,
                        endTime: null,
                    };

                    words.forEach((word) => {
                        const speaker = word.speaker ?? 0;

                        if (speaker !== currentSpeaker) {
                            if (currentSegment.text) {
                                segments.push(currentSegment);
                            }

                            currentSpeaker = speaker;
                            currentSegment = {
                                speaker,
                                text: word.punctuated_word || word.word,
                                startTime: word.start,
                                endTime: word.end,
                            };
                        } else {
                            currentSegment.text +=
                                " " + (word.punctuated_word || word.word);
                            currentSegment.endTime = word.end;
                        }
                    });
                    if (currentSegment.text) {
                        segments.push(currentSegment);
                    }

                    const formattedText = segments
                        .map((segment) => {
                            const speakerLabel = mapSpeakerLabel(
                                segment.speaker,
                            );
                            addToTimeline(
                                speakerLabel,
                                segment.text,
                                segment.startTime,
                                segment.endTime,
                            );
                            return `[${formatTimestamp(segment.startTime)}] ${speakerLabel}: ${segment.text}`;
                        })
                        .join("\n");
                    prospectFinalTranscript.current +=
                        (prospectFinalTranscript.current ? " " : "") +
                        formattedText;
                    setProspectTranscript(
                        prospectFinalTranscript.current.trim(),
                    );
                } else if (isFinal) {
                    const startTime =
                        words.length > 0
                            ? words[0].startTime
                            : getElapsedTime();
                    addToTimeline("Prospect", transcript, startTime, startTime);

                    prospectFinalTranscript.current +=
                        (prospectFinalTranscript.current ? " " : "") +
                        `[${formatTimestamp(startTime)}] ${transcript}`;
                    setProspectTranscript(prospectFinalTranscript.current);
                } else {
                    setProspectTranscript(
                        prospectFinalTranscript.current +
                            (prospectFinalTranscript.current ? " " : "") +
                            transcript,
                    );
                }
            });

            connection.on(LiveTranscriptionEvents.Error, (error) => {
                console.error("Prospect error:", error);
            });

            prospectConnectionRef.current = connection;
        } catch (error) {
            console.error("Error starting prospect transcription:", error);
            alert(
                'System audio capture failed. Make sure to select "Share audio" option.',
            );
            throw error;
        }
    };

    const stopRecording = () => {
        if (closerMediaRecorderRef.current) {
            closerMediaRecorderRef.current.stop();
            closerMediaRecorderRef.current.stream
                .getTracks()
                .forEach((track) => track.stop());
        }
        if (closerConnectionRef.current) {
            closerConnectionRef.current.finish();
        }

        if (prospectMediaRecorderRef.current) {
            prospectMediaRecorderRef.current.stop();
            prospectMediaRecorderRef.current.stream
                .getTracks()
                .forEach((track) => track.stop());
        }
        if (prospectConnectionRef.current) {
            prospectConnectionRef.current.finish();
        }

        setIsRecording(false);
    };
    const clearTranscripts = () => {
        setProspectTranscript("");
        setCloserTranscript("");
        prospectFinalTranscript.current = "";
        closerFinalTranscript.current = "";
        speakerRegistry.current = {};
        conversationTimeline.current = [];
        recordingStartTime.current = null;
        lastSentTimelineIndex.current = 0;

        lastSentIndex.current = { prospect: 0, closer: 0 };
        setConversationSummary("");
        setAiSuggestion(null);
    };

    if (!session) return <LoginPage onLogin={setSession} />;

    return (
        <div className="App">
            <div className="container">
                <h1>Real-Time Dual Transcription with RAG</h1>

                <div className="controls">
                    <button
                        className={`btn ${isRecording ? "btn-stop" : "btn-start"}`}
                        onClick={isRecording ? stopRecording : startRecording}
                    >
                        {isRecording ? "⏹ Stop Recording" : "▶ Start Recording"}
                    </button>

                    <button
                        className="btn btn-clear"
                        onClick={clearTranscripts}
                        disabled={isRecording}
                    >
                        🗑 Clear
                    </button>

                    <MyPopup
                        open={popupOpen}
                        onClose={() => setPopupOpen(false)}
                    >
                        <FileUpload
                            session={session}
                            backendUrl={BACKEND_URL}
                        />
                    </MyPopup>

                    <button onClick={() => setPopupOpen(true)}>
                        📄 Upload Training Docs
                    </button>

                    <button
                        className="btn btn-ai"
                        onClick={handleGetAISuggestion}
                        disabled={!isRecording || isLoadingAI}
                    >
                        {isLoadingAI ? "⏳ Loading..." : "🤖 Get AI Help (⌘J)"}
                    </button>
                </div>

                <div className="main-layout">
                    <div className="transcripts">
                        <div className="transcript-box">
                            <h2>Prospect Transcript</h2>
                            <p className="subtitle">
                                (System Audio - YouTube, Videos, etc.)
                            </p>
                            <textarea
                                value={prospectTranscript}
                                readOnly
                                placeholder="System audio transcript will appear here..."
                            />
                        </div>

                        <div className="transcript-box">
                            <h2>Closer Transcript</h2>
                            <p className="subtitle">(Your Microphone)</p>
                            <textarea
                                value={closerTranscript}
                                readOnly
                                placeholder="Your voice transcript will appear here..."
                            />
                        </div>
                    </div>

                    {/* AI Suggestions Panel with Sources */}
                    <AISuggestions
                        suggestion={aiSuggestion}
                        isLoading={isLoadingAI}
                    />
                </div>

                <div className="status">
                    <span
                        className={`status-indicator ${isRecording ? "recording" : ""}`}
                    >
                        {isRecording ? "🔴 Recording..." : "⚪ Stopped"}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default App;
