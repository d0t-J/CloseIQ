import React from "react";

function AISuggestions({ suggestion, isLoading }) {
    // Loading state
    if (isLoading) {
        return (
            <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6">
                <div className="flex flex-col items-center justify-center py-10 text-slate-300">
                    <div className="w-8 h-8 mb-4 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-center">
                        Analyzing conversation and retrieving relevant insights…
                    </p>
                </div>
            </div>
        );
    }

    // Empty state
    if (!suggestion) {
        return (
            <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6">
                <div className="text-center py-10 space-y-6">
                    <h2 className="text-lg font-semibold flex items-center justify-center gap-2">
                        <span className="text-[#1dbf73]">🧠</span>
                        AI Sales Coach
                    </h2>

                    <p className="text-sm text-slate-400 max-w-md mx-auto">
                        Press <kbd className="px-1.5 py-0.5 bg-[#0a0a0a] border border-[#262626] rounded text-xs">Ctrl + J</kbd>
                        {" "}during a live call to receive real-time coaching based on your training materials.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                        <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 text-sm text-slate-300">
                            💬 What to Say
                        </div>
                        <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 text-sm text-slate-300">
                            🧠 Why It Works
                        </div>
                        <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 text-sm text-slate-300">
                            🎯 Next Move
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Active suggestion state
    return (
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-[#1dbf73]">🧠</span>
                    <h2 className="font-semibold">AI Sales Coach</h2>
                </div>
                <span className="text-xs text-slate-400">
                    AUTO-COACH ACTIVE ·{" "}
                    {suggestion.timestamp
                        ? new Date(suggestion.timestamp).toLocaleTimeString()
                        : ""}
                </span>
            </div>

            {/* Main content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* What to Say */}
                <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-4">
                    <h3 className="text-emerald-400 font-semibold mb-2 flex items-center gap-2">
                        💬 WHAT TO SAY
                    </h3>
                    <p className="text-sm text-slate-200 leading-relaxed">
                        {suggestion.whatToSay}
                    </p>
                </div>

                {/* Why It Works */}
                {suggestion.whyItWorks && (
                    <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-xl p-4">
                        <h3 className="text-yellow-400 font-semibold mb-2 flex items-center gap-2">
                            💡 WHY IT WORKS
                        </h3>
                        <p className="text-sm text-slate-200 leading-relaxed">
                            {suggestion.whyItWorks}
                        </p>
                    </div>
                )}

                {/* Next Move */}
                {suggestion.nextMove && (
                    <div className="border border-purple-500/30 bg-purple-500/5 rounded-xl p-4">
                        <h3 className="text-purple-400 font-semibold mb-2 flex items-center gap-2">
                            🎯 NEXT MOVE
                        </h3>
                        <p className="text-sm text-slate-200 leading-relaxed mb-3">
                            {suggestion.nextMove}
                        </p>

                        <div className="flex gap-2 flex-wrap">
                            <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-300">
                                OBJECTION PREP
                            </span>
                            <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-300">
                                DIAGNOSIS
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Conversation Summary */}
            {suggestion.conversationSummary && (
                <div className="border border-[#262626] bg-[#0a0a0a] rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                        📝 Conversation Summary
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        {suggestion.conversationSummary}
                    </p>
                </div>
            )}

            {/* Sources */}
            {suggestion.sources && suggestion.sources.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                    {suggestion.sources.map((source, index) => (
                        <span
                            key={index}
                            className="px-2 py-1 bg-[#0a0a0a] border border-[#262626] rounded"
                        >
                            📄 {source}
                        </span>
                    ))}
                </div>
            )}

            {/* Footer */}
            <div className="text-xs text-slate-500 text-center pt-2">
                Tip: Upload more training documents to improve coaching quality
            </div>
        </div>
    );
}

export default AISuggestions;
