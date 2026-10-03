import React, { useRef, useEffect, useState } from 'react';
import { Plus, X, FileText } from 'lucide-react';
import { OpenRequestTab } from '../../types/playground';

interface RequestTabsProps {
  tabs: OpenRequestTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
  onRenameTab?: (tabId: string, name: string) => void;
}

/**
 * Lightweight request tab bar for the multi-request workspace.
 * Preserves each request's unsaved state with a subtle dot indicator.
 */
export const RequestTabs: React.FC<RequestTabsProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onRenameTab,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Auto-scroll active tab into view
  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-tab-id="${activeTabId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeTabId, tabs.length]);

  useEffect(() => {
    if (!renamingTabId) return;
    renameRef.current?.focus();
    renameRef.current?.select();
  }, [renamingTabId]);

  const startRename = (tab: OpenRequestTab) => {
    if (!onRenameTab) return;
    setRenamingTabId(tab.tabId);
    setRenameValue(tab.name);
  };

  const commitRename = () => {
    if (!renamingTabId) return;
    const name = renameValue.trim();
    if (name) onRenameTab?.(renamingTabId, name);
    setRenamingTabId(null);
  };

  if (tabs.length === 0) {
    return (
      <div className="pg-request-tabs-bar pg-request-tabs-empty">
        <button className="pg-tab-new-btn" onClick={onNewTab} title="New Request">
          <Plus size={13} />
          <span>New Request</span>
        </button>
      </div>
    );
  }

  return (
    <div className="pg-request-tabs-bar">
      <div
        className="pg-request-tabs-scroll"
        ref={scrollRef}
        role="tablist"
        aria-label="Open requests"
      >
        {tabs.map((tab) => {
          const isActive = tab.tabId === activeTabId;
          return (
            <div
              key={tab.tabId}
              data-tab-id={tab.tabId}
              role="tab"
              aria-selected={isActive}
              className={`pg-request-tab-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(tab.tabId)}
              onDoubleClick={() => startRename(tab)}
              title={tab.itemId ? `${tab.name} — saved in Files` : `${tab.name} — not saved yet`}
            >
              <FileText size={11} className="pg-tab-file-icon" />
              {renamingTabId === tab.tabId ? (
                <input
                  ref={renameRef}
                  className="pg-tab-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitRename();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setRenamingTabId(null);
                    }
                  }}
                />
              ) : (
                <span className="pg-tab-name">{tab.name}</span>
              )}
              {tab.isDirty && <span className="pg-tab-dirty-dot" aria-label="Unsaved changes" />}
              <button
                className="pg-tab-close"
                title="Close tab"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.tabId);
                }}
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
      </div>
      <button className="pg-tab-new-btn" onClick={onNewTab} title="New Request">
        <Plus size={12} />
        <span>New</span>
      </button>
    </div>
  );
};