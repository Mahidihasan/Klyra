import React, { useState } from 'react';
import { X, Code, Upload, Check, RefreshCw, Sparkles, FileCode } from 'lucide-react';

interface OpenApiImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (count: number) => void;
  onShowToast: (msg: string) => void;
}

export const OpenApiImportModal: React.FC<OpenApiImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  onShowToast
}) => {
  const [mode, setMode] = useState<'url' | 'paste'>('url');
  const [url, setUrl] = useState('https://api.kickonass.com/openapi.json');
  const [rawJson, setRawJson] = useState(`{
  "openapi": "3.1.0",
  "info": { "title": "Kickon Ass API", "version": "2.4.1" },
  "paths": {
    "/generate": { "post": { "summary": "Generate AI image" } },
    "/users": { "get": { "summary": "List users" } },
    "/refunds": { "post": { "summary": "Issue refund" } }
  }
}`);
  const [isSyncing, setIsSyncing] = useState(false);

  if (!isOpen) return null;

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      onImportSuccess(42);
      onShowToast('OpenAPI 3.1 specification parsed & 42 endpoints synced');
      onClose();
    }, 1200);
  };

  return (
    <div className="kly-modal-overlay" onClick={onClose}>
      <div className="kly-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="kly-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileCode size={16} color="#06b6d4" />
            <h3 style={{ fontSize: 15 }}>Sync OpenAPI / Swagger Specification</h3>
          </div>
          <button className="kly-btn-icon" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="kly-modal-body">
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--kly-border-subtle)', paddingBottom: 12 }}>
            <button
              className={`kly-btn ${mode === 'url' ? 'kly-btn-secondary' : 'kly-btn-ghost'}`}
              onClick={() => setMode('url')}
            >
              Fetch from Live URL
            </button>
            <button
              className={`kly-btn ${mode === 'paste' ? 'kly-btn-secondary' : 'kly-btn-ghost'}`}
              onClick={() => setMode('paste')}
            >
              Paste JSON / YAML
            </button>
          </div>

          {mode === 'url' ? (
            <div className="kly-input-group">
              <label className="kly-label">OpenAPI / Swagger 3.x URL Endpoint</label>
              <input
                type="url"
                className="kly-input kly-mono"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.yourdomain.com/openapi.json"
              />
              <span style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>
                Klyra gateway will periodically poll this URL to auto-sync new routes.
              </span>
            </div>
          ) : (
            <div className="kly-input-group">
              <label className="kly-label">OpenAPI 3.0 / 3.1 Schema Document</label>
              <textarea
                className="kly-textarea kly-mono"
                rows={8}
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                style={{ fontSize: 11 }}
              />
            </div>
          )}
        </div>

        <div className="kly-modal-footer">
          <button className="kly-btn kly-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="kly-btn kly-btn-primary" disabled={isSyncing} onClick={handleSync}>
            {isSyncing ? <RefreshCw size={13} className="spin-icon" /> : <Sparkles size={13} />}
            <span>{isSyncing ? 'Parsing Schema...' : 'Parse & Sync Spec'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
