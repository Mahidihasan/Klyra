import React, { useState, useEffect } from 'react';
import { Search, Cpu, Folder, Terminal, Zap, ArrowRight, X } from 'lucide-react';
import { ApiItem, CollectionItem } from '../types/api';

interface CommandPaletteProps {
  apis: ApiItem[];
  collections: CollectionItem[];
  isOpen: boolean;
  onClose: () => void;
  onSelectApi: (api: ApiItem) => void;
  onOpenTester: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  apis,
  collections,
  isOpen,
  onClose,
  onSelectApi,
  onOpenTester
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        isOpen ? onClose() : null; // Parent toggles
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredApis = apis.filter(a => 
    a.name.toLowerCase().includes(query.toLowerCase()) || 
    a.category.toLowerCase().includes(query.toLowerCase()) ||
    a.description.toLowerCase().includes(query.toLowerCase())
  );

  const filteredCols = collections.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="cmd-palette card-base animate-fade-in" onClick={(e) => e.stopPropagation()}>
        
        {/* Search Header */}
        <div className="cmd-header">
          <Search size={18} className="cmd-search-icon" />
          <input
            type="text"
            placeholder="Type a command or search APIs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="cmd-input"
            autoFocus
          />
          <button className="cmd-esc-btn" onClick={onClose}>ESC</button>
        </div>

        {/* Results Body */}
        <div className="cmd-body">
          {/* Quick Actions */}
          {!query && (
            <div className="cmd-group">
              <div className="cmd-group-title">QUICK ACTIONS</div>
              <div className="cmd-item" onClick={() => { onOpenTester(); onClose(); }}>
                <Zap size={16} color="#8b5cf6" />
                <span>Open API Tester</span>
                <span className="cmd-shortcut">Alt + T</span>
              </div>
            </div>
          )}

          {/* APIs Group */}
          {filteredApis.length > 0 && (
            <div className="cmd-group">
              <div className="cmd-group-title">APIs</div>
              {filteredApis.map(api => (
                <div 
                  key={api.id} 
                  className="cmd-item"
                  onClick={() => { onSelectApi(api); onClose(); }}
                >
                  <Cpu size={16} color="#38bdf8" />
                  <div className="cmd-item-info">
                    <span className="cmd-item-name">{api.name}</span>
                    <span className="cmd-item-desc">{api.description}</span>
                  </div>
                  <span className="badge-category">{api.category}</span>
                </div>
              ))}
            </div>
          )}

          {/* Collections Group */}
          {filteredCols.length > 0 && (
            <div className="cmd-group">
              <div className="cmd-group-title">COLLECTIONS</div>
              {filteredCols.map(col => (
                <div key={col.id} className="cmd-item">
                  <Folder size={16} color={col.color} />
                  <span className="cmd-item-name">{col.name}</span>
                  <span className="cmd-item-desc" style={{ marginLeft: 'auto' }}>{col.apiCount} APIs</span>
                </div>
              ))}
            </div>
          )}

          {filteredApis.length === 0 && filteredCols.length === 0 && (
            <div className="cmd-empty">No matching APIs or collections found.</div>
          )}
        </div>

      </div>

      <style>{`
        .cmd-palette {
          width: 600px;
          max-width: 90vw;
          background-color: var(--bg-modal);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          padding: 0;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
        }

        .cmd-header {
          display: flex;
          align-items: center;
          padding: 14px 18px;
          border-bottom: 1px solid var(--border-subtle);
          position: relative;
        }

        .cmd-search-icon {
          color: var(--text-muted);
          margin-right: 12px;
        }

        .cmd-input {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-size: 14px;
        }

        .cmd-esc-btn {
          font-size: 10px;
          background: var(--bg-pill);
          border: 1px solid var(--border-subtle);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .cmd-body {
          max-height: 360px;
          overflow-y: auto;
          padding: 12px 8px;
        }

        .cmd-group-title {
          font-size: 10px;
          font-weight: 700;
          color: var(--text-muted);
          padding: 6px 12px;
          letter-spacing: 0.06em;
        }

        .cmd-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: background-color 0.15s;
        }

        .cmd-item:hover {
          background-color: var(--bg-card-hover);
        }

        .cmd-item-info {
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .cmd-item-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .cmd-item-desc {
          font-size: 11px;
          color: var(--text-muted);
        }

        .cmd-shortcut {
          font-size: 11px;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .cmd-empty {
          padding: 30px;
          text-align: center;
          color: var(--text-muted);
          font-size: 13px;
        }
      `}</style>
    </div>
  );
};
