import React, { useState } from 'react';
import { X, Star, Eye, ShieldCheck, Zap, Code, Copy, Check, Terminal, ExternalLink, Activity } from 'lucide-react';
import { ApiItem } from '../types/api';

interface ApiDetailModalProps {
  api: ApiItem;
  onClose: () => void;
  onOpenTester: (api: ApiItem) => void;
}

export const ApiDetailModal: React.FC<ApiDetailModalProps> = ({ api, onClose, onOpenTester }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'endpoints' | 'code' | 'pricing'>('overview');
  const [selectedLanguage, setSelectedLanguage] = useState<'curl' | 'js' | 'python' | 'node'>('curl');
  const [copiedCode, setCopiedCode] = useState(false);

  const getCodeSnippet = () => {
    const url = `${api.baseUrl}${api.endpoints?.[0]?.path || ''}`;
    switch (selectedLanguage) {
      case 'curl':
        return `curl -X POST "${url}" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${api.endpoints?.[0]?.sampleRequest || '{"query": "hello"}'}'`;
      case 'js':
        return `const response = await fetch("${url}", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer YOUR_API_KEY",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify(${api.endpoints?.[0]?.sampleRequest || '{}'})\n});\nconst data = await response.json();\nconsole.log(data);`;
      case 'python':
        return `import requests\n\nurl = "${url}"\nheaders = {\n    "Authorization": "Bearer YOUR_API_KEY",\n    "Content-Type": "application/json"\n}\npayload = ${api.endpoints?.[0]?.sampleRequest || '{}'}\n\nresponse = requests.post(url, headers=headers, json=payload)\nprint(response.json())`;
      case 'node':
        return `const axios = require('axios');\n\naxios.post('${url}', ${api.endpoints?.[0]?.sampleRequest || '{}'}, {\n  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }\n}).then(res => console.log(res.data));`;
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="api-detail-modal card-base animate-fade-in" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header">
          <div className="header-left">
            <div className="api-logo-container" style={{ background: api.accentColor || '#7c3aed' }}>
              <span style={{ color: '#fff', fontWeight: '800', fontSize: '18px' }}>
                {api.name.substring(0, 2)}
              </span>
            </div>
            <div>
              <div className="title-row">
                <h2 className="api-modal-title">{api.name}</h2>
                <span className="badge-category">{api.category}</span>
                <span className="status-indicator"><span className="status-dot"/>{api.status}</span>
              </div>
              <p className="provider-name">By {api.provider} • Version {api.version}</p>
            </div>
          </div>

          <div className="header-actions">
            <button className="test-now-btn" onClick={() => onOpenTester(api)}>
              <Zap size={16} />
              <span>Test in Tester</span>
            </button>
            <button className="modal-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-label">Rating</span>
            <div className="stat-val">
              <Star size={14} fill="#f59e0b" color="#f59e0b" />
              <span>{api.rating} / 5.0</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-label">Monthly Requests</span>
            <div className="stat-val">
              <Eye size={14} color="#94a3b8" />
              <span>{api.requestCount}</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-label">Avg Latency</span>
            <div className="stat-val">
              <Activity size={14} color="#22c55e" />
              <span>{api.latencyMs} ms</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-label">Uptime</span>
            <div className="stat-val">
              <ShieldCheck size={14} color="#8b5cf6" />
              <span>{api.uptime}</span>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="detail-tabs">
          <button className={`dtab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={`dtab ${activeTab === 'endpoints' ? 'active' : ''}`} onClick={() => setActiveTab('endpoints')}>Endpoints ({api.endpointsCount})</button>
          <button className={`dtab ${activeTab === 'code' ? 'active' : ''}`} onClick={() => setActiveTab('code')}>Code Snippets</button>
        </div>

        {/* Tab Content */}
        <div className="detail-tab-body">
          {activeTab === 'overview' && (
            <div className="overview-content">
              <h3 className="section-h">Description</h3>
              <p className="desc-text">{api.longDescription || api.description}</p>

              <h3 className="section-h" style={{ marginTop: '20px' }}>Authentication & Base URL</h3>
              <div className="base-url-box">
                <span className="auth-tag">{api.authType}</span>
                <code className="url-code">{api.baseUrl}</code>
              </div>
            </div>
          )}

          {activeTab === 'endpoints' && (
            <div className="endpoints-list">
              {api.endpoints && api.endpoints.length > 0 ? (
                api.endpoints.map((ep) => (
                  <div key={ep.id} className="endpoint-item card-base">
                    <div className="ep-top">
                      <span className={`method-badge method-${ep.method}`}>{ep.method}</span>
                      <code className="ep-path">{ep.path}</code>
                    </div>
                    <p className="ep-desc">{ep.description}</p>
                  </div>
                ))
              ) : (
                <div className="endpoint-item card-base">
                  <div className="ep-top">
                    <span className="method-badge method-GET">GET</span>
                    <code className="ep-path">/v1/resource</code>
                  </div>
                  <p className="ep-desc">Retrieve resource list with standard query filtering.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'code' && (
            <div className="code-snippets-container">
              <div className="lang-bar">
                <button className={`lang-btn ${selectedLanguage === 'curl' ? 'active' : ''}`} onClick={() => setSelectedLanguage('curl')}>cURL</button>
                <button className={`lang-btn ${selectedLanguage === 'js' ? 'active' : ''}`} onClick={() => setSelectedLanguage('js')}>JavaScript</button>
                <button className={`lang-btn ${selectedLanguage === 'python' ? 'active' : ''}`} onClick={() => setSelectedLanguage('python')}>Python</button>
                <button className={`lang-btn ${selectedLanguage === 'node' ? 'active' : ''}`} onClick={() => setSelectedLanguage('node')}>Node.js</button>

                <button className="copy-code-btn" onClick={handleCopyCode}>
                  {copiedCode ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <pre className="snippet-pre">{getCodeSnippet()}</pre>
            </div>
          )}
        </div>

      </div>

      <style>{`
        .api-detail-modal {
          width: 800px;
          max-width: 95vw;
          max-height: 90vh;
          background-color: var(--bg-modal);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-xl);
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .api-logo-container {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .api-modal-title {
          font-size: 20px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .provider-name {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .test-now-btn {
          height: 38px;
          padding: 0 16px;
          border-radius: var(--radius-md);
          background: var(--accent-gradient);
          color: #fff;
          font-weight: 600;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 6px;
          box-shadow: var(--shadow-purple);
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        @media (max-width: 640px) {
          .stats-row {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .stat-card {
          background-color: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          font-size: 11px;
          color: var(--text-muted);
        }

        .stat-val {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .detail-tabs {
          display: flex;
          gap: 12px;
          border-bottom: 1px solid var(--border-subtle);
        }

        .dtab {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted);
          border-bottom: 2px solid transparent;
        }

        .dtab.active {
          color: var(--text-accent);
          border-bottom-color: var(--accent-purple);
        }

        .detail-tab-body {
          min-height: 160px;
        }

        .section-h {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .desc-text {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .base-url-box {
          display: flex;
          align-items: center;
          gap: 12px;
          background-color: var(--bg-input);
          border: 1px solid var(--border-card);
          padding: 10px 14px;
          border-radius: var(--radius-md);
        }

        .auth-tag {
          background: rgba(139, 92, 246, 0.2);
          color: var(--accent-purple);
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 4px;
        }

        .url-code {
          font-family: var(--font-mono);
          font-size: 12px;
          color: #38bdf8;
        }

        .endpoints-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .endpoint-item {
          padding: 14px;
        }

        .ep-top {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
        }

        .method-badge {
          font-size: 11px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 4px;
          background-color: var(--bg-pill);
        }

        .ep-path {
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--text-primary);
        }

        .ep-desc {
          font-size: 12px;
          color: var(--text-muted);
        }

        .code-snippets-container {
          background-color: #080910;
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .lang-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background-color: #0f101c;
          border-bottom: 1px solid var(--border-subtle);
        }

        .lang-btn {
          font-size: 12px;
          padding: 4px 10px;
          border-radius: 4px;
          color: var(--text-muted);
        }

        .lang-btn.active {
          background-color: var(--accent-purple);
          color: #fff;
          font-weight: 600;
        }

        .copy-code-btn {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-accent);
        }

        .snippet-pre {
          padding: 16px;
          font-family: var(--font-mono);
          font-size: 12px;
          color: #38bdf8;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
};
