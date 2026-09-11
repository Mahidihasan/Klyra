import React, { useState, useEffect, useRef } from 'react';
import { Search, Code, Server, GitBranch, Key, Users, DollarSign, Terminal, Activity, ArrowRight, Settings, FlaskConical } from 'lucide-react';
import { DetailedEndpoint } from '../types';
import { ProjectTab, ProviderProject } from '../../../types/apibuild';

interface ProjectCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProviderProject;
  endpoints: DetailedEndpoint[];
  onSelectTab: (t: ProjectTab) => void;
  onSelectEndpoint: (ep: DetailedEndpoint) => void;
  onOpenPlayground: () => void;
}

export const ProjectCommandPalette: React.FC<ProjectCommandPaletteProps> = ({
  isOpen,
  onClose,
  project,
  endpoints,
  onSelectTab,
  onSelectEndpoint,
  onOpenPlayground
}) => {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQ('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredEndpoints = endpoints.filter(e =>
    e.path.toLowerCase().includes(q.toLowerCase()) ||
    e.summary.toLowerCase().includes(q.toLowerCase()) ||
    e.method.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="kly-modal-overlay" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: '12vh' }}>
      <div className="kly-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        {/* Search Input Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          borderBottom: '1px solid var(--kly-border-subtle)', background: 'rgba(255,255,255,0.02)'
        }}>
          <Search size={16} color="var(--kly-primary)" />
          <input
            ref={inputRef}
            type="text"
            className="kly-input"
            style={{ border: 'none', background: 'transparent', padding: 0, fontSize: 14, flex: 1, boxShadow: 'none' }}
            placeholder={`Search ${project.name} (endpoints, tabs, keys, logs)...`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <kbd style={{
            fontSize: 10, fontFamily: 'var(--kly-font-mono)', padding: '2px 6px',
            borderRadius: 4, background: 'rgba(255,255,255,0.08)', color: 'var(--kly-text-dim)'
          }}>ESC</kbd>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Quick Actions */}
          {!q && (
            <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 700, color: 'var(--kly-text-dim)', textTransform: 'uppercase' }}>
              Quick Navigation
            </div>
          )}

          {!q && (
            <>
              <button
                className="kly-btn-ghost"
                onClick={() => { onOpenPlayground(); onClose(); }}
                style={{ width: '100%', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 6, fontSize: 13 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FlaskConical size={14} color="#a855f7" />
                  <span>Open Interactive Playground</span>
                </div>
                <ArrowRight size={12} color="var(--kly-text-dim)" />
              </button>
              <button
                className="kly-btn-ghost"
                onClick={() => { onSelectTab('deployments'); onClose(); }}
                style={{ width: '100%', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 6, fontSize: 13 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Server size={14} color="#10b981" />
                  <span>View Deployments & Logs</span>
                </div>
                <ArrowRight size={12} color="var(--kly-text-dim)" />
              </button>
              <button
                className="kly-btn-ghost"
                onClick={() => { onSelectTab('keys'); onClose(); }}
                style={{ width: '100%', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 6, fontSize: 13 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Key size={14} color="#fbbf24" />
                  <span>Manage API Keys</span>
                </div>
                <ArrowRight size={12} color="var(--kly-text-dim)" />
              </button>
            </>
          )}

          {/* Endpoints Match */}
          {filteredEndpoints.length > 0 && (
            <>
              <div style={{ padding: '6px 8px', fontSize: 10, fontWeight: 700, color: 'var(--kly-text-dim)', textTransform: 'uppercase', marginTop: 4 }}>
                Endpoints ({filteredEndpoints.length})
              </div>
              {filteredEndpoints.map((ep) => (
                <button
                  key={ep.id}
                  className="kly-btn-ghost"
                  onClick={() => { onSelectEndpoint(ep); onClose(); }}
                  style={{ width: '100%', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 6 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`kly-method-tag kly-method-${ep.method}`} style={{ fontSize: 10 }}>{ep.method}</span>
                    <span className="kly-mono" style={{ fontSize: 12 }}>{ep.path}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--kly-text-dim)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ep.summary}
                  </span>
                </button>
              ))}
            </>
          )}

          {q && filteredEndpoints.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--kly-text-dim)', fontSize: 13 }}>
              No matches found for "{q}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
