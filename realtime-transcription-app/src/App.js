import React, { useState, useRef, useEffect } from "react";
import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
import LoginPage from "./LoginPage";
import AISuggestions from "./AISuggestions";
import { KnowledgeBasePopup } from "./KnowledgeBasePopup.jsx";
import closeIQLogo from "./assets/closeiq_logo.png";
function App() {
    const [session, setSession] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [prospectTranscript, setProspectTranscript] = useState("");
    const [closerTranscript, setCloserTranscript] = useState("");
    const [aiSuggestion, setAiSuggestion] = useState(null);
    const [isLoadingAI, setIsLoadingAI] = useState(false);
    const [streamingSuggestion, setStreamingSuggestion] = useState({
        whatToSay: "",
        whyItWorks: "",
        nextMove: "",
    });
    const prospectConnectionRef = useRef(null);
    const closerConnectionRef = useRef(null);
    const prospectMediaRecorderRef = useRef(null);
    const closerMediaRecorderRef = useRef(null);
    const deepgramClientRef = useRef(null);
    const prospectFinalTranscript = useRef("");
    const closerFinalTranscript = useRef("");
    const [popupOpen, setPopupOpen] = useState(false);
    //? const [conversationSummary, setConversationSummary] = useState("");
    const conversationTimeline = useRef([]);
    const recordingStartTime = useRef(null);
    // 🔹 Track last sent index for delta
    const lastSentIndex = useRef({
        prospect: 0,
        closer: 0,
    });
    const lastSentTimelineIndex = useRef(0);

    const speakerRegistry = useRef({});
    const callStartTime = useRef(null);

    const prospectSegments = useRef([]);
    const closerSegments = useRef([]);

    const lastSentSegmentIndex = useRef({
        prospect: 0,
        closer: 0,
    });

    const formatTime = (seconds) => {
        if (seconds === null || seconds == undefined) return "00:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);

        return `${mins.toString().padStart(2, "0")}:${secs
            .toString()
            .padStart(2, "0")}`;
    };

    const getCallElapsedTime = () => {
        if (!callStartTime.current) return 0;
        return (Date.now() - callStartTime.current) / 1000;
    };

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

        return `${mins.toString().padStart(2, "0")}:${secs
            .toString()
            .padStart(2, "0")}`;
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
    const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";

    // Initialize Deepgram client once on mount
    useEffect(() => {
        const apiKey = process.env.REACT_APP_DEEPGRAM_API_KEY;
        if (apiKey) {
            deepgramClientRef.current = createClient(apiKey);
        }
    }, []);

    // Keyboard shortcut listener (Command/Ctrl + J)
    useEffect(() => {
        const handleKeyPress = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "j") {
                e.preventDefault();
                handleGetAISuggestion();
            }
        };
        window.addEventListener("keydown", handleKeyPress);
        return () => window.removeEventListener("keydown", handleKeyPress);
    });

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
                    `[${formatTimestamp(entry.startTime)}] ${entry.speaker}: ${
                        entry.text
                    }`,
            )
            .join("\n");
    };

    const streamText = (fullText, setter, delay = 15) => {
        let index = 0;
        setter("");

        const interval = setInterval(() => {
            index += 1;
            const newValue = fullText.slice(0, index);
            setter(newValue);

            if (index >= fullText.length) {
                clearInterval(interval);
            }
        }, delay);
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
            const formattedConversation =
                formatTimelineForAI(getTimelineDelta());

            const response = await fetch(`${BACKEND_URL}/query`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: session.user.id,
                    //? conversation_summary: conversationSummary || "None",
                    conversation_transcript: formattedConversation,
                    prospect_transcript: prospectDelta,
                    closer_transcript: closerDelta,
                }),
            });

            if (!response.ok) throw new Error("RAG query failed");

            const data = await response.json();
            const whatToSay = data.what_to_say || "";
            const whyItWorks = data.why_it_works || "";
            const nextMove = data.next_move || "";

            setStreamingSuggestion({
                whatToSay: "",
                whyItWorks: "",
                nextMove: "",
            });

            // ✅ Update suggestion
            setAiSuggestion({
                whatToSay,
                whyItWorks,
                nextMove,
                sources: data.sources || [],
                timestamp: new Date().toISOString(),
                closeProbability:
                    typeof data.close_probability === "number"
                        ? data.close_probability
                        : 0,
                dealStage:
                    typeof data.deal_stage === "number" ? data.deal_stage : 0,
                avatar:
                    data.avatar && data.avatar.avatar_type != null
                        ? data.avatar
                        : null,
            });

            streamText(whatToSay, (v) =>
                setStreamingSuggestion((prev) => ({ ...prev, whatToSay: v })),
            );
            streamText(whyItWorks, (v) =>
                setStreamingSuggestion((prev) => ({ ...prev, whyItWorks: v })),
            );
            streamText(nextMove, (v) =>
                setStreamingSuggestion((prev) => ({ ...prev, nextMove: v })),
            );
        } catch (error) {
            console.error(error);
            setAiSuggestion({
                whatToSay: "Connection issue - please try again.",
                whyItWorks: "The AI service may be temporarily unavailable.",
                nextMove: "Click 'Get AI Coaching' to retry.",
                sources: [],
                closeProbability: 0,
                dealStage: 0,
                avatar: null,
                timestamp: new Date().toISOString(),
            });
            setStreamingSuggestion({
                whatToSay: "",
                whyItWorks: "",
                nextMove: "",
            });
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
                const words = data.channel.alternatives[0].words || [];
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
                        const wordStart = word.start;
                        const wordEnd = word.end;

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

                    prospectSegments.current.push(...segments);

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
                            return `[${formatTimestamp(
                                segment.startTime,
                            )}] ${speakerLabel}: ${segment.text}`;
                        })
                        .join("\n");
                    prospectFinalTranscript.current +=
                        (prospectFinalTranscript.current ? "\n" : "") +
                        formattedText;
                    setProspectTranscript(
                        prospectFinalTranscript.current.trim(),
                    );
                } else if (isFinal) {
                    const startTime =
                        words.length > 0 ? words[0].start : getElapsedTime();
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
        // setConversationSummary("");
        setAiSuggestion(null);
    };

    if (!session) return <LoginPage onLogin={setSession} />;

    return (
        <div className="min-h-screen bg-[#0b0b0b] text-white relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.08),transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(212,175,55,0.05),transparent_50%)]" />

            {/* HEADER */}
            <header className="relative z-10 border-b border-[#1f1f1f] backdrop-blur-sm bg-[#0b0b0b]/80">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    {/* Left branding */}
                    <div className="flex items-center gap-4">
                        <img
                            src={closeIQLogo}
                            alt="CloseIQ"
                            className="h-10 w-auto object-contain drop-shadow-[0_0_25px_rgba(212,175,55,0.4)]"
                        />
                        {isRecording && (
                            <div className="flex items-center gap-3 ml-2">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                    <span className="text-xs font-semibold text-red-400 tracking-wide">
                                        LIVE
                                    </span>
                                </div>
                                <span className="text-xs text-slate-500 font-mono">
                                    {formatTime(getElapsedTime())}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setPopupOpen(true)}
                            className="flex items-center gap-2 text-sm text-slate-300 hover:text-[#d4af37] transition-colors px-3 py-2 rounded-lg hover:bg-[#1a1a1a]"
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
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                            </svg>
                            <span>Training Docs</span>
                        </button>

                        {!isRecording ? (
                            <button
                                onClick={startRecording}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#d4af37] text-black font-semibold hover:bg-[#c9a227] transition-all active:scale-95"
                            >
                                <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M8 5v14l11-7z" />
                                </svg>
                                Start Session
                            </button>
                        ) : (
                            <button
                                onClick={stopRecording}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg border border-red-500 text-red-400 hover:bg-red-500/10 transition-all active:scale-95"
                            >
                                <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <rect
                                        x="6"
                                        y="6"
                                        width="12"
                                        height="12"
                                        rx="2"
                                    />
                                </svg>
                                End Session
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* MAIN */}
            <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-6">
                {/* Status Indicators - Only show when recording */}
                {isRecording && (
                    <div className="grid grid-cols-2 gap-4">
                        {/* System Audio Status */}
                        <div className="bg-[#141414] border border-[#262626] rounded-xl p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                <svg
                                    className="w-5 h-5 text-blue-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                    />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-white">
                                        System Audio
                                    </span>
                                    <div className="flex gap-0.5">
                                        {[...Array(3)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-1 bg-blue-400 rounded-full animate-pulse"
                                                style={{
                                                    height: `${
                                                        Math.random() * 10 + 6
                                                    }px`,
                                                    animationDelay: `${
                                                        i * 0.15
                                                    }s`,
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400">
                                    Capturing prospect audio
                                </p>
                            </div>
                        </div>

                        {/* Microphone Status */}
                        <div className="bg-[#141414] border border-[#262626] rounded-xl p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                <svg
                                    className="w-5 h-5 text-emerald-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                                    />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-white">
                                        Your Microphone
                                    </span>
                                    <div className="flex gap-0.5">
                                        {[...Array(3)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-1 bg-emerald-400 rounded-full animate-pulse"
                                                style={{
                                                    height: `${
                                                        Math.random() * 10 + 6
                                                    }px`,
                                                    animationDelay: `${
                                                        i * 0.15
                                                    }s`,
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <p className="text-xs text-slate-400">
                                    Recording your voice
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Transcripts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Prospect */}
                    <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden">
                        <div className="border-b border-[#262626] px-5 py-4 bg-[#0a0a0a]/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                        <svg
                                            className="w-4 h-4 text-blue-400"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                            />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-blue-400 text-sm tracking-wide">
                                            PROSPECT
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            System Audio
                                        </p>
                                    </div>
                                </div>
                                {prospectTranscript && (
                                    <span className="text-xs text-slate-500 font-mono">
                                        {prospectTranscript.length} chars
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="p-5">
                            <textarea
                                readOnly
                                value={prospectTranscript}
                                placeholder="Waiting for system audio... Make sure to share audio when starting screen share."
                                className="w-full h-64 bg-transparent text-sm text-slate-200 focus:outline-none resize-none placeholder:text-slate-600 leading-relaxed"
                            />
                        </div>
                    </div>

                    {/* Closer */}
                    <div className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden">
                        <div className="border-b border-[#262626] px-5 py-4 bg-[#0a0a0a]/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                        <svg
                                            className="w-4 h-4 text-emerald-400"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                                            />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-emerald-400 text-sm tracking-wide">
                                            CLOSER
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Your Microphone
                                        </p>
                                    </div>
                                </div>
                                {closerTranscript && (
                                    <span className="text-xs text-slate-500 font-mono">
                                        {closerTranscript.length} chars
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="p-5">
                            <textarea
                                readOnly
                                value={closerTranscript}
                                placeholder="Waiting for microphone input... Your voice will appear here."
                                className="w-full h-64 bg-transparent text-sm text-slate-200 focus:outline-none resize-none placeholder:text-slate-600 leading-relaxed"
                            />
                        </div>
                    </div>
                </div>

                {/* Clear Button - Only show when there's content */}
                {(prospectTranscript || closerTranscript) && (
                    <div className="flex justify-end">
                        <button
                            onClick={clearTranscripts}
                            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-[#1a1a1a]"
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
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                            </svg>
                            Clear Transcripts
                        </button>
                    </div>
                )}

                {/* AI SALES COACH */}
                <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#f4d03f] flex items-center justify-center shadow-lg shadow-[#d4af37]/20">
                                <svg
                                    className="w-6 h-6 text-black"
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
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">
                                    AI Sales Coach
                                </h2>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Press{" "}
                                    <kbd className="px-2 py-0.5 bg-[#262626] rounded text-[#d4af37] font-mono text-xs border border-[#333]">
                                        Ctrl+J
                                    </kbd>{" "}
                                    during a live call to receive real-time
                                    coaching
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleGetAISuggestion}
                            disabled={isLoadingAI}
                            className="bg-[#d4af37] hover:bg-[#c9a227] disabled:bg-[#262626] disabled:text-[#666] text-black font-semibold px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-[#d4af37]/20 hover:shadow-[#d4af37]/30"
                        >
                            {isLoadingAI ? (
                                <>
                                    <svg
                                        className="w-4 h-4 animate-spin"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                        />
                                    </svg>
                                    Analyzing...
                                </>
                            ) : (
                                <>
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
                                    Get AI Coaching
                                </>
                            )}
                        </button>
                    </div>

                    {isLoadingAI && (
                        <div className="flex items-center justify-center py-16 border-2 border-dashed border-[#262626] rounded-xl">
                            <div className="text-center">
                                <svg
                                    className="w-10 h-10 text-[#d4af37] animate-spin mx-auto mb-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                </svg>
                                <p className="text-sm text-slate-400 font-medium">
                                    Analyzing conversation and generating
                                    suggestions...
                                </p>
                            </div>
                        </div>
                    )}

                    {!isLoadingAI && !aiSuggestion && (
                        <div className="text-center py-16 border-2 border-dashed border-[#262626] rounded-xl">
                            <svg
                                className="w-14 h-14 text-[#666] mx-auto mb-4"
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
                            <p className="text-slate-400 font-medium mb-2">
                                No AI suggestions yet
                            </p>
                            <p className="text-sm text-slate-500">
                                Start recording and press{" "}
                                <kbd className="px-2 py-0.5 bg-[#262626] rounded text-[#d4af37] font-mono text-xs">
                                    Ctrl+J
                                </kbd>{" "}
                                to get real-time coaching
                            </p>
                        </div>
                    )}

                    {!isLoadingAI && aiSuggestion && (
                        <div className="space-y-4">
                            {aiSuggestion.closeProbability != null && (
                                <p className="text-sm text-slate-400">
                                    Close Probability:{" "}
                                    {Math.round(
                                        Number(aiSuggestion.closeProbability) *
                                            100,
                                    )}
                                    %
                                </p>
                            )}
                            {aiSuggestion.dealStage != null && (
                                <p className="text-sm text-slate-400">
                                    Deal Stage: {Number(aiSuggestion.dealStage)}
                                </p>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* What to Say */}
                                <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 hover:border-[#333] transition-colors">
                                    <div className="flex items-center gap-2 mb-3">
                                        <svg
                                            className="w-4 h-4 text-[#d4af37]"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                            />
                                        </svg>
                                        <h3 className="font-semibold text-white text-sm">
                                            What to Say
                                        </h3>
                                    </div>
                                    <p className="text-sm text-slate-300 leading-relaxed">
                                        {streamingSuggestion.whatToSay ||
                                            aiSuggestion.whatToSay}
                                    </p>
                                </div>

                                {/* Why It Works */}
                                <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 hover:border-[#333] transition-colors">
                                    <div className="flex items-center gap-2 mb-3">
                                        <svg
                                            className="w-4 h-4 text-[#4ade80]"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                        </svg>
                                        <h3 className="font-semibold text-white text-sm">
                                            Why It Works
                                        </h3>
                                    </div>
                                    <p className="text-sm text-slate-300 leading-relaxed">
                                        {streamingSuggestion.whyItWorks ||
                                            aiSuggestion.whyItWorks}
                                    </p>
                                </div>

                                {/* Next Move */}
                                <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 hover:border-[#333] transition-colors">
                                    <div className="flex items-center gap-2 mb-3">
                                        <svg
                                            className="w-4 h-4 text-[#8b5cf6]"
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
                                        <h3 className="font-semibold text-white text-sm">
                                            Next Move
                                        </h3>
                                    </div>
                                    <p className="text-sm text-slate-300 leading-relaxed">
                                        {streamingSuggestion.nextMove ||
                                            aiSuggestion.nextMove}
                                    </p>
                                </div>
                            </div>

                            {aiSuggestion.avatar &&
                                aiSuggestion.avatar.avatar_type && (
                                    <div className="pt-4 border-t border-[#262626]">
                                        <p className="text-xs text-slate-500 mb-1">
                                            Avatar:
                                        </p>
                                        <p className="text-sm text-slate-300">
                                            {aiSuggestion.avatar.avatar_type}
                                            {aiSuggestion.avatar.confidence !=
                                                null && (
                                                <>
                                                    {" "}
                                                    (
                                                    {Math.round(
                                                        Number(
                                                            aiSuggestion.avatar
                                                                .confidence,
                                                        ) * 100,
                                                    )}
                                                    %)
                                                </>
                                            )}
                                        </p>
                                    </div>
                                )}
                            {aiSuggestion.sources &&
                                aiSuggestion.sources.length > 0 && (
                                    <div className="pt-4 border-t border-[#262626]">
                                        <p className="text-xs text-slate-500 mb-2 flex items-center gap-2">
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
                                                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                                />
                                            </svg>
                                            Sources from your training docs:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {aiSuggestion.sources.map(
                                                (source, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="text-xs bg-[#1a1a1a] text-slate-400 px-3 py-1.5 rounded-lg border border-[#262626] hover:border-[#d4af37]/30 transition-colors"
                                                    >
                                                        {source}
                                                    </span>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                )}
                        </div>
                    )}
                </div>
            </main>

            {/* Knowledge Base Popup */}
            {popupOpen && (
                <KnowledgeBasePopup
                    open={popupOpen}
                    onClose={() => setPopupOpen(false)}
                    session={session}
                    backendUrl={BACKEND_URL}
                    closeIQLogo={closeIQLogo}
                />
            )}
        </div>
    );
}
export default App;
