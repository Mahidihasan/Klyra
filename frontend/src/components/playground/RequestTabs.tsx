import React, { useRef, useEffect } from 'react';
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

  // Auto-scroll active tab into view
  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-tab-id="${activeTabId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeTabId, tabs.length]);

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

};