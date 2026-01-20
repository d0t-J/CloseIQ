import React from 'react';
import './AISuggestions.css';

function AISuggestions({ suggestion, isLoading }) {
  if (isLoading) {
    return (
      <div className="ai-suggestions-panel loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>🤖 Analyzing conversation and retrieving relevant training materials...</p>
        </div>
      </div>
    );
  }

  if (!suggestion) {
    return (
      <div className="ai-suggestions-panel empty">
        <div className="empty-state">
          <h2>🤖 AI Sales Suggestion</h2>
          <p>Press <kbd>⌘J</kbd> (Mac) or <kbd>Ctrl+J</kbd> (Windows) during the call to get real-time AI coaching based on your training documents.</p>
          <div className="features">
            <div className="feature">
              <span className="icon">💬</span>
              <span>What to Say Next</span>
            </div>
            <div className="feature">
              <span className="icon">🧠</span>
              <span>Why It Works</span>
            </div>
            <div className="feature">
              <span className="icon">🎯</span>
              <span>Next Move Strategy</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-suggestions-panel active">
      <div className="suggestion-header">
        <h2>🤖 AI Sales Suggestion</h2>
        <span className="timestamp">{new Date(suggestion.timestamp).toLocaleTimeString()}</span>
      </div>

      <div className="suggestion-content">
        <div className="suggestion-section primary">
          <h3>💬 What to Say</h3>
          <p className="suggestion-text">{suggestion.whatToSay}</p>
        </div>

        {suggestion.whyItWorks && (
          <div className="suggestion-section">
            <h3>🧠 Why It Works</h3>
            <p className="suggestion-text">{suggestion.whyItWorks}</p>
          </div>
        )}

        {suggestion.nextMove && (
          <div className="suggestion-section">
            <h3>🎯 Next Move</h3>
            <p className="suggestion-text">{suggestion.nextMove}</p>
          </div>
        )}
        {suggestion.conversationSummary && (
            <div className="suggestion-section summary">
              <h3>📝 Conversation Summary</h3>
              <p className="suggestion-text">
                {suggestion.conversationSummary}
              </p>
            </div>
          )}

        {suggestion.sources && suggestion.sources.length > 0 && (
          <div className="suggestion-section sources">
            <h3>📚 Based on Training Materials</h3>
            <div className="sources-list">
              {suggestion.sources.map((source, index) => (
                <span key={index} className="source-tag">
                  📄 {source}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="suggestion-footer">
        <small>💡 Tip: Upload more training docs to get better suggestions</small>
      </div>
    </div>
  );
}

export default AISuggestions;