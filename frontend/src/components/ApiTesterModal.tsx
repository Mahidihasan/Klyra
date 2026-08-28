import React, { useState } from 'react';
import { X, Play, Copy, Check, RefreshCw, Send, Layers, Globe, Code, ShieldCheck } from 'lucide-react';
import { ApiItem, ApiEndpoint } from '../types/api';

interface ApiTesterModalProps {
  api?: ApiItem | null;
  onClose: () => void;
}

export const ApiTesterModal: React.FC<ApiTesterModalProps> = ({ api, onClose }) => {
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>(
    api?.endpoints?.[0]?.method || 'POST'
  );
  const [url, setUrl] = useState(
    api 
      ? `${api.baseUrl}${api.endpoints?.[0]?.path || ''}` 
      : 'https://api.openai.com/v1/chat/completions'
  );
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'auth'>('body');
  
  // Headers state
  const [headers, setHeaders] = useState([
    { key: 'Content-Type', value: 'application/json', enabled: true },
    { key: 'Authorization', value: `Bearer ${api ? 'sk-prod-9874...' : 'sk-live-sample-key'}`, enabled: true }
  ]);

  // Body state
  const [bodyText, setBodyText] = useState(
    api?.endpoints?.[0]?.sampleRequest || JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Write a 1-line Python function to reverse a string." }],
      temperature: 0.7
    }, null, 2)
  );

  // Execution state
  const [isLoading, setIsLoading] = useState(false);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSend = () => {
    setIsLoading(true);
    setResponseStatus(null);
    setResponseBody(null);

    setTimeout(() => {
      setIsLoading(false);
      setResponseStatus(200);
      setResponseTime(Math.floor(Math.random() * 80) + 60);

      if (api?.endpoints?.[0]?.sampleResponse) {
        setResponseBody(api.endpoints[0].sampleResponse);
      } else {
        setResponseBody(JSON.stringify({
          status: "success",
          timestamp: new Date().toISOString(),
          data: {
            id: "req_" + Math.random().toString(36).substring(2, 9),
            model: "gpt-4o-mini",
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: "def reverse_string(s):\n    return s[::-1]"
                },
                finish_reason: "stop"
              }
            ],
            usage: {
              prompt_tokens: 14,
              completion_tokens: 11,
              total_tokens: 25
            }
          }
        }, null, 2));
      }
    }, 600);
  };

  const copyResponse = () => {
    if (!responseBody) return;
    navigator.clipboard.writeText(responseBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="tester-modal card-base animate-fade-in" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="tester-modal-header">
          <div className="modal-title-group">
            <span className="tester-badge">API TESTER</span>
            <h2 className="modal-heading">
              {api ? `Testing: ${api.name}` : 'Interactive API Tester'}
            </h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* URL Bar & Method Picker */}
        <div className="url-bar-container">
          <select 
            value={method} 
            onChange={(e) => setMethod(e.target.value as any)}
            className={`method-select method-${method}`}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="url-input"
            placeholder="Enter request URL..."
          />

          <button 
            className="send-btn"
            onClick={handleSend}
            disabled={isLoading}
          >
            {isLoading ? (
              <RefreshCw size={16} className="spin-icon" />
            ) : (
              <Send size={16} />
            )}
            <span>{isLoading ? 'Sending...' : 'Send'}</span>
          </button>
        </div>

        {/* Config Tabs */}
        <div className="tester-tabs">
          <button 
            className={`tab-btn ${activeTab === 'body' ? 'active' : ''}`}
            onClick={() => setActiveTab('body')}
          >
            Body
          </button>
          <button 
            className={`tab-btn ${activeTab === 'headers' ? 'active' : ''}`}
            onClick={() => setActiveTab('headers')}
          >
            Headers ({headers.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'params' ? 'active' : ''}`}
            onClick={() => setActiveTab('params')}
          >
            Params
          </button>
          <button 
            className={`tab-btn ${activeTab === 'auth' ? 'active' : ''}`}
            onClick={() => setActiveTab('auth')}
          >
            Auth
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content-area">
          {activeTab === 'body' && (
            <textarea
              className="code-editor"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="JSON request body..."
            />
          )}

          {activeTab === 'headers' && (
            <div className="key-value-list">
              {headers.map((h, i) => (
                <div key={i} className="kv-row">
                  <input
                    type="text"
                    value={h.key}
                    onChange={(e) => {
                      const newH = [...headers];
                      newH[i].key = e.target.value;
                      setHeaders(newH);
                    }}
                    placeholder="Header name"
                    className="kv-input"
                  />
                  <input
                    type="text"
                    value={h.value}
                    onChange={(e) => {
                      const newH = [...headers];
                      newH[i].value = e.target.value;
                      setHeaders(newH);
                    }}
                    placeholder="Header value"
                    className="kv-input"
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'params' && (
            <div className="empty-tab-text">Query parameters will be appended to the URL automatically.</div>
          )}

          {activeTab === 'auth' && (
            <div className="auth-tab-content">
              <label className="auth-label">Authentication Type</label>
              <div className="auth-pill">{api?.authType || 'Bearer Token'}</div>
              <p className="auth-sub">API key will be injected securely into request headers.</p>
            </div>
          )}
        </div>

        {/* Response Panel */}
        <div className="response-panel">
          <div className="response-header">
            <div className="res-title-group">
              <span className="res-title">Response Payload</span>
              {responseStatus && (
                <span className="res-status-badge">
                  Status: 200 OK
                </span>
              )}
              {responseTime && (
                <span className="res-meta">
                  Time: {responseTime}ms
                </span>
              )}
            </div>

            {responseBody && (
              <button className="copy-res-btn" onClick={copyResponse}>
                {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            )}
          </div>

          <div className="response-body-viewer">
            {isLoading ? (
              <div className="loading-state">
                <RefreshCw size={24} className="spin-icon" color="#8b5cf6" />
                <span>Executing request to endpoint...</span>
              </div>
            ) : responseBody ? (
              <pre className="json-pre">{responseBody}</pre>
            ) : (
              <div className="empty-response">
                Press <strong>Send</strong> to execute the API request and view live payload.
              </div>
            )}
          </div>
        </div>

      </div>

      <style>{`
        .tester-modal {
          width: 820px;
          max-width: 95vw;
          max-height: 90vh;
          background-color: var(--bg-modal);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-xl);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
          overflow-y: auto;
        }

        .tester-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 12px;
        }

        .modal-title-group {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .tester-badge {
          font-size: 10px;
          font-weight: 800;
          color: var(--accent-purple);
          letter-spacing: 0.08em;
        }

        .modal-heading {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .modal-close-btn {
          color: var(--text-muted);
          padding: 4px;
          border-radius: 6px;
        }
        .modal-close-btn:hover {
          color: var(--text-primary);
          background-color: var(--bg-card-hover);
        }

        .url-bar-container {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .method-select {
          height: 40px;
          padding: 0 12px;
          border-radius: var(--radius-md);
          font-weight: 700;
          font-size: 12px;
          border: 1px solid var(--border-card);
          background-color: var(--bg-card);
          cursor: pointer;
        }

        .method-GET { color: #22c55e; }
        .method-POST { color: #a78bfa; }
        .method-PUT { color: #f59e0b; }
        .method-DELETE { color: #ef4444; }
        .method-PATCH { color: #3b82f6; }

        .url-input {
          flex: 1;
          height: 40px;
          background-color: var(--bg-input);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 0 14px;
          color: var(--text-primary);
          font-family: var(--font-mono);
          font-size: 12px;
        }

        .url-input:focus {
          border-color: var(--accent-purple);
        }

        .send-btn {
          height: 40px;
          padding: 0 20px;
          border-radius: var(--radius-md);
          background: var(--accent-gradient);
          color: #ffffff;
          font-weight: 600;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: var(--shadow-purple);
        }

        .send-btn:hover {
          background: var(--accent-gradient-hover);
        }

        .spin-icon {
          animation: spinOrbit 1s linear infinite;
        }

        .tester-tabs {
          display: flex;
          gap: 8px;
          border-bottom: 1px solid var(--border-subtle);
          padding-bottom: 8px;
        }

        .tab-btn {
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-muted);
        }

        .tab-btn:hover {
          color: var(--text-primary);
        }

        .tab-btn.active {
          color: var(--text-accent);
          background-color: rgba(139, 92, 246, 0.15);
          font-weight: 600;
        }

        .tab-content-area {
          min-height: 120px;
        }

        .code-editor {
          width: 100%;
          height: 120px;
          background-color: #0a0b12;
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 12px;
          color: #a78bfa;
          font-family: var(--font-mono);
          font-size: 12px;
          resize: vertical;
        }

        .key-value-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .kv-row {
          display: flex;
          gap: 10px;
        }

        .kv-input {
          flex: 1;
          height: 34px;
          background-color: var(--bg-input);
          border: 1px solid var(--border-card);
          border-radius: 6px;
          padding: 0 12px;
          color: var(--text-primary);
          font-size: 12px;
        }

        .empty-tab-text {
          font-size: 12px;
          color: var(--text-muted);
          padding: 16px;
        }

        .auth-tab-content {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .auth-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
        }

        .auth-pill {
          display: inline-block;
          background: rgba(139, 92, 246, 0.15);
          color: var(--text-accent);
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          width: max-content;
        }

        .auth-sub {
          font-size: 11px;
          color: var(--text-muted);
        }

        .response-panel {
          background-color: #090a10;
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .response-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .res-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .res-title {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
        }

        .res-status-badge {
          background: rgba(34, 197, 94, 0.15);
          color: #22c55e;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .res-meta {
          font-size: 11px;
          color: var(--text-muted);
        }

        .copy-res-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--text-accent);
        }

        .response-body-viewer {
          min-height: 140px;
          max-height: 220px;
          overflow-y: auto;
          font-family: var(--font-mono);
          font-size: 12px;
        }

        .json-pre {
          color: #38bdf8;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .empty-response {
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 12px;
        }

        .loading-state {
          height: 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
};
