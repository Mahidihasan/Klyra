import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  MoreVertical,
  Pin,
  FolderOpen,
  History,
  Sliders,
  Cpu,
  Database,
  Network,
  Rocket,
  Link2,
  GitBranch,
  ChevronsLeft,
  ChevronsRight,
  Boxes,
  Globe,
  Trash2,
  X,
  Copy,
  Settings,
  Play,
  Pencil,
  ArrowRight,
  FolderPlus,
  Import,
  Star,
  Clock,
  Check,
  Layers,
  FileText,
  Zap,
  Move,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Folder,
  Calendar,
  LucideIcon,
} from 'lucide-react';
import {
  ApiWorkspaceItem,
  ApiVersionInfo,
  ApiWorkspaceEndpoint,
  LocalApi,
  UserWorkspace,
  WorkspaceTab,
  Collection,
  HistoryEntry,
  Environment,
  ApiGroupId,
  HttpMethod,
  WorkspaceItem,
  WorkspaceItemKind,
} from '../../types/playground';
import { WorkspaceTree, TreeAction } from './WorkspaceTree';
import { isSecretValue } from '../../utils/playground';

/* =========================================================
   TYPES
   ========================================================= */

type ContextAction =
  | 'open'
  | 'test'
  | 'rename'
  | 'pin'
  | 'move'
  | 'duplicate'
  | 'settings'
  | 'delete'
  | 'new-folder'
  | 'new-test-file';

interface ContextMenuItem {
  id: ContextAction;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  divider?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  itemId: string;
  itemType: 'workspace' | 'api' | 'collection' | 'local-api' | 'endpoint' | 'group';
  itemName: string;
}

/* =========================================================
   PROPS
   ========================================================= */

interface WorkspaceSidebarProps {
  isExpanded: boolean;
  onToggleExpand: () => void;

  // Workspace
  userWorkspaces: UserWorkspace[];
  activeWorkspaceId: string;
  onWorkspaceChange: (id: string) => void;
  onCreateWorkspace: () => void;
  onRenameWorkspace: (id: string) => void;
  onTogglePinWorkspace: (id: string) => void;
  onDeleteWorkspace?: (id: string) => void;

  // Tabs
  workspaceTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;

  // APIs
  workspaceApis: ApiWorkspaceItem[];
  localApis: LocalApi[];
  apiSearch: string;
  onApiSearchChange: (value: string) => void;
  expandedApiGroups: Record<string, boolean>;
  expandedApiIds: Record<string, boolean>;
  onToggleGroup: (groupId: string) => void;
  onToggleApiItem: (apiId: string) => void;
  selectedApi: ApiWorkspaceItem | null;
  selectedLocalApi: LocalApi | null;
  selectedEndpoint: ApiWorkspaceEndpoint | null;
  selectedLocalEndpoint: ApiWorkspaceEndpoint | null;
  onSelectEndpoint: (
    api: ApiWorkspaceItem,
    version: ApiVersionInfo,
    endpoint: ApiWorkspaceEndpoint,
  ) => void;
  onSelectLocalEndpoint: (api: LocalApi, endpoint: ApiWorkspaceEndpoint) => void;
  onAddLocalApi: () => void;
  onDeleteLocalApi?: (id: string) => void;
  onAddConnectedApi: () => void;
  onImportApi: () => void;

  // Collections
  collections: Collection[];
  collectionSearch: string;
  onCollectionSearchChange: (value: string) => void;
  onCreateCollection: () => void;
  onDeleteCollection?: (id: string) => void;
  onLoadRequest: (request: Collection['requests'][number]) => void;
  onDeleteRequestFromCollection: (collectionId: string, requestId: string) => void;

  // History
  history: HistoryEntry[];
  historySearch: string;
  onHistorySearchChange: (value: string) => void;
  onClearHistory: () => void;
  onLoadFromHistory: (entry: HistoryEntry) => void;
  onDeleteHistoryEntry: (entryId: string) => void;

  // Environments
  environments: Environment[];
  activeEnvironment: Environment | null;
  onEnvironmentChange: (env: Environment) => void;
  onCreateEnvironment: () => void;
  onEditEnvironment?: (env: Environment) => void;
  onDeleteEnvironment?: (id: string) => void;

  // Workspace Tree (unified model)
  workspaceItems?: WorkspaceItem[];
  workspaceSearch?: string;
  onWorkspaceSearchChange?: (q: string) => void;
  onOpenWorkspaceItem?: (item: WorkspaceItem) => void;
  onWorkspaceAction?: (action: TreeAction, item: WorkspaceItem) => void;
  onCreateWorkspaceItem?: (kind: WorkspaceItemKind, parentId?: string, name?: string) => void;
  onMoveWorkspaceItem?: (itemId: string, parentId: string | null) => void;
  activeWorkspaceItemId?: string;
  expandedTreeIds?: Record<string, boolean>;
  onToggleTreeExpand?: (id: string) => void;
}

/* =========================================================
   CONTEXT MENU CONFIG
   ========================================================= */

const WORKSPACE_MENU: ContextMenuItem[] = [
  { id: 'open', label: 'Open', icon: ExternalLink },
  { id: 'rename', label: 'Rename', icon: Pencil },
  { id: 'pin', label: 'Pin', icon: Pin },
  { id: 'move', label: 'Move', icon: Move, divider: true },
  { id: 'duplicate', label: 'Duplicate', icon: Copy },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'delete', label: 'Delete', icon: Trash2, danger: true, divider: true },
];

const API_MENU: ContextMenuItem[] = [
  { id: 'open', label: 'Open', icon: ExternalLink },
  { id: 'test', label: 'Test', icon: Play },
  { id: 'rename', label: 'Rename', icon: Pencil },
  { id: 'pin', label: 'Pin', icon: Pin },
  { id: 'move', label: 'Move', icon: Move, divider: true },
  { id: 'duplicate', label: 'Duplicate', icon: Copy },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'delete', label: 'Delete', icon: Trash2, danger: true, divider: true },
];

const COLLECTION_MENU: ContextMenuItem[] = [
  { id: 'open', label: 'Open', icon: ExternalLink },
  { id: 'test', label: 'Run Collection', icon: Play },
  { id: 'rename', label: 'Rename', icon: Pencil },
  { id: 'pin', label: 'Pin', icon: Pin },
  { id: 'move', label: 'Move', icon: Move, divider: true },
  { id: 'duplicate', label: 'Duplicate', icon: Copy },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'delete', label: 'Delete', icon: Trash2, danger: true, divider: true },
];

const LOCAL_API_MENU: ContextMenuItem[] = [
  { id: 'open', label: 'Open', icon: ExternalLink },
  { id: 'test', label: 'Test', icon: Play },
  { id: 'rename', label: 'Rename', icon: Pencil },
  { id: 'pin', label: 'Pin', icon: Pin },
  { id: 'move', label: 'Move', icon: Move, divider: true },
  { id: 'duplicate', label: 'Duplicate', icon: Copy },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'delete', label: 'Delete', icon: Trash2, danger: true, divider: true },
];

const ENDPOINT_MENU: ContextMenuItem[] = [
  { id: 'open', label: 'Open', icon: ExternalLink },
  { id: 'test', label: 'Test', icon: Play },
  { id: 'duplicate', label: 'Duplicate', icon: Copy, divider: true },
  { id: 'delete', label: 'Delete', icon: Trash2, danger: true },
];

const GROUP_MENU: ContextMenuItem[] = [
  { id: 'new-folder', label: 'New Folder', icon: FolderPlus },
  { id: 'new-test-file', label: 'New Test File', icon: FileText },
];

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#a78bfa',
  PUT: '#f59e0b',
  PATCH: '#3b82f6',
  DELETE: '#ef4444',
  HEAD: '#6366f1',
  OPTIONS: '#8b5cf6',
};

/* =========================================================
   TIME GROUPING HELPERS
   ========================================================= */

type TimeGroupKey = 'today' | 'yesterday' | 'this-week' | 'this-month' | 'earlier';

interface TimeGroup {
  key: TimeGroupKey;
  label: string;
  entries: HistoryEntry[];
}

const getTimeGroupKey = (timestamp: string): TimeGroupKey => {
  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (date >= startOfToday) return 'today';
  if (date >= startOfYesterday) return 'yesterday';
  if (date >= startOfWeek) return 'this-week';
  if (date >= startOfMonth) return 'this-month';
  return 'earlier';
};

const TIME_GROUP_LABELS: Record<TimeGroupKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  'this-week': 'This Week',
  'this-month': 'This Month',
  earlier: 'Earlier',
};

const formatRelativeTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

const formatFullTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
};

const groupHistoryByTime = (entries: HistoryEntry[]): TimeGroup[] => {
  const groups: Record<TimeGroupKey, HistoryEntry[]> = {
    today: [],
    yesterday: [],
    'this-week': [],
    'this-month': [],
    earlier: [],
  };
  entries.forEach((entry) => {
    const key = getTimeGroupKey(entry.timestamp);
    groups[key].push(entry);
  });
  const order: TimeGroupKey[] = ['today', 'yesterday', 'this-week', 'this-month', 'earlier'];
  return order
    .filter((key) => groups[key].length > 0)
    .map((key) => ({ key, label: TIME_GROUP_LABELS[key], entries: groups[key] }));
};

/* =========================================================
   CONTEXT MENU COMPONENT
   ========================================================= */

const ContextMenu: React.FC<{
  state: ContextMenuState | null;
  onClose: () => void;
  onAction: (action: ContextAction, itemId: string, itemType: ContextMenuState['itemType']) => void;
}> = ({ state, onClose, onAction }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [state, onClose]);

  if (!state) return null;

  const getMenu = (): ContextMenuItem[] => {
    switch (state.itemType) {
      case 'workspace':
        return WORKSPACE_MENU;
      case 'api':
        return API_MENU;
      case 'collection':
        return COLLECTION_MENU;
      case 'local-api':
        return LOCAL_API_MENU;
      case 'endpoint':
        return ENDPOINT_MENU;
      case 'group':
        return GROUP_MENU;
      default:
        return [];
    }
  };

  const menu = getMenu();
  const menuWidth = 190;
  const menuHeight = menu.length * 30 + 12;
  const left = Math.min(state.x, window.innerWidth - menuWidth - 8);
  const top = Math.min(state.y, window.innerHeight - menuHeight - 8);

  return (
    <div ref={menuRef} className="pg-ctx-menu" style={{ left, top, width: menuWidth }}>
      <div className="pg-ctx-menu-head">
        <span className="pg-ctx-menu-title">{state.itemName}</span>
      </div>
      <div className="pg-ctx-menu-items">
        {menu.map((item) => {
          const Icon = item.icon;
          return (
            <React.Fragment key={item.id}>
              {item.divider && <div className="pg-ctx-divider" />}
              <button
                className={`pg-ctx-item ${item.danger ? 'danger' : ''}`}
                onClick={() => {
                  onAction(item.id, state.itemId, state.itemType);
                  onClose();
                }}
              >
                <Icon size={13} />
                <span>{item.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/* =========================================================
   TOOLTIP
   ========================================================= */

const Tooltip: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <span className="pg-tooltip-wrap">
    {children}
    <span className="pg-tooltip">{label}</span>
  </span>
);

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  isExpanded,
  onToggleExpand,
  userWorkspaces,
  activeWorkspaceId,
  onWorkspaceChange,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  workspaceTab,
  onTabChange,
  workspaceApis,
  localApis,
  apiSearch,
  onApiSearchChange,
  expandedApiGroups,
  expandedApiIds,
  onToggleGroup,
  onToggleApiItem,
  selectedApi,
  selectedLocalApi,
  selectedEndpoint,
  selectedLocalEndpoint,
  onSelectEndpoint,
  onSelectLocalEndpoint,
  onAddLocalApi,
  onDeleteLocalApi,
  onAddConnectedApi,
  onImportApi,
  collections,
  collectionSearch,
  onCollectionSearchChange,
  onCreateCollection,
  onDeleteCollection,
  onLoadRequest,
  onDeleteRequestFromCollection,
  history,
  historySearch,
  onHistorySearchChange,
  onClearHistory,
  onLoadFromHistory,
  onDeleteHistoryEntry,
  environments,
  activeEnvironment,
  onEnvironmentChange,
  onCreateEnvironment,
  onEditEnvironment,
  onDeleteEnvironment,
  workspaceItems = [],
  workspaceSearch = '',
  onWorkspaceSearchChange,
  onOpenWorkspaceItem,
  onWorkspaceAction,
  onCreateWorkspaceItem,
  onMoveWorkspaceItem,
  activeWorkspaceItemId,
  expandedTreeIds = {},
  onToggleTreeExpand,
}) => {
  const [showWorkspaceSwitcher, setShowWorkspaceSwitcher] = useState(false);
  const [showAddApiMenu, setShowAddApiMenu] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [pinnedItems, setPinnedItems] = useState<Record<string, boolean>>({});
  const [recentItems, setRecentItems] = useState<string[]>([]);
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const switcherRef = useRef<HTMLDivElement>(null);
  const addApiRef = useRef<HTMLDivElement>(null);

  const activeWorkspace =
    userWorkspaces.find((w) => w.id === activeWorkspaceId) || userWorkspaces[0];

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowWorkspaceSwitcher(false);
      }
      if (addApiRef.current && !addApiRef.current.contains(e.target as Node)) {
        setShowAddApiMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Derived data
  const connectedApis = workspaceApis.filter(
    (api) => api.source === 'subscribed' || api.source === 'recent',
  );
  const myApis = workspaceApis.filter((api) => api.source === 'my-apis');

  const searchFilteredApis = useCallback(() => {
    if (!apiSearch) return { my: myApis, connected: connectedApis, local: localApis };
    const q = apiSearch.toLowerCase();
    return {
      my: myApis.filter((api) => api.name.toLowerCase().includes(q)),
      connected: connectedApis.filter((api) => api.name.toLowerCase().includes(q)),
      local: localApis.filter(
        (api) => api.name.toLowerCase().includes(q) || api.baseUrl.toLowerCase().includes(q),
      ),
    };
  }, [myApis, connectedApis, localApis, apiSearch]);

  const filtered = searchFilteredApis();
  const isAnySearch = apiSearch.length > 0;

  // Context menu action handler
  const handleContextAction = (
    action: ContextAction,
    itemId: string,
    itemType: ContextMenuState['itemType'],
  ) => {
    switch (action) {
      case 'pin':
        setPinnedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
        break;
      case 'rename':
        if (itemType === 'workspace') onRenameWorkspace(itemId);
        break;
      case 'delete':
        if (itemType === 'workspace' && onDeleteWorkspace) {
          onDeleteWorkspace(itemId);
        } else if (itemType === 'local-api' && onDeleteLocalApi) {
          onDeleteLocalApi(itemId);
        } else if (itemType === 'collection' && onDeleteCollection) {
          onDeleteCollection(itemId);
        }
        break;
      case 'new-folder':
        onCreateWorkspaceItem?.('folder');
        break;
      case 'new-test-file':
        onCreateWorkspaceItem?.('test');
        break;
      default:
        break;
    }
  };

  const openContextMenu = (
    e: React.MouseEvent,
    itemId: string,
    itemType: ContextMenuState['itemType'],
    itemName: string,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, itemId, itemType, itemName });
  };

  // =========================================================
  // COLLAPSED RAIL
  // =========================================================
  if (!isExpanded) {
    const railItems = [
      { id: 'apis' as WorkspaceTab, icon: Cpu, label: 'APIs' },
      { id: 'collections' as WorkspaceTab, icon: FolderOpen, label: 'Collections' },
      { id: 'history' as WorkspaceTab, icon: History, label: 'History' },
      { id: 'environments' as WorkspaceTab, icon: Sliders, label: 'Environments' },
    ];
    return (
      <aside className="pg-left-rail">
        <div className="pg-rail-top">
          <Tooltip label="Expand sidebar">
            <button className="pg-rail-btn" onClick={onToggleExpand}>
              <ChevronsRight size={16} />
            </button>
          </Tooltip>
        </div>
        <div className="pg-rail-items">
          {railItems.map((item) => {
            const Icon = item.icon;
            return (
              <Tooltip key={item.id} label={item.label}>
                <button
                  className={`pg-rail-btn ${workspaceTab === item.id ? 'active' : ''}`}
                  onClick={() => {
                    onTabChange(item.id);
                    onToggleExpand();
                  }}
                >
                  <Icon size={17} />
                </button>
              </Tooltip>
            );
          })}
        </div>
        <div className="pg-rail-bottom">
          <Tooltip label="New Request">
            <button className="pg-rail-btn pg-rail-new" onClick={() => onTabChange('apis')}>
              <Plus size={17} />
            </button>
          </Tooltip>
        </div>
      </aside>
    );
  }

  // =========================================================
  // EXPANDED SIDEBAR
  // =========================================================
  return (
    <aside className="pg-left-sidebar pg-sidebar-redesign">
      {/* Header */}
      <div className="pg-left-header">
        <div className="pg-left-title">
          <Boxes size={15} />
          <span>Workspace</span>
        </div>
        <Tooltip label="Collapse sidebar">
          <button className="pg-icon-btn" onClick={onToggleExpand}>
            <ChevronsLeft size={16} />
          </button>
        </Tooltip>
      </div>

      {/* Resource tabs */}
      <div className="pg-left-tabs pg-tabs-compact">
        {[
          { id: 'apis' as WorkspaceTab, icon: Cpu, label: 'APIs' },
          { id: 'collections' as WorkspaceTab, icon: FolderOpen, label: 'Collections' },
          { id: 'environments' as WorkspaceTab, icon: Sliders, label: 'Environments' },
          { id: 'history' as WorkspaceTab, icon: History, label: 'History' },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <Tooltip key={tab.id} label={tab.label}>
              <button
                className={`pg-left-tab ${workspaceTab === tab.id ? 'active' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Content */}
      <div className="pg-left-content pg-scroll-smooth">
        {/* ============ APIS TAB ============ */}
        {workspaceTab === 'apis' && (
          <>
            {/* Workspace Tree (unified model) */}
            {onOpenWorkspaceItem && onWorkspaceAction && onCreateWorkspaceItem && (
              <WorkspaceTree
                items={workspaceItems}
                searchQuery={workspaceSearch}
                onSearchChange={onWorkspaceSearchChange || (() => {})}
                onOpenItem={onOpenWorkspaceItem}
                onAction={onWorkspaceAction}
                onCreateItem={onCreateWorkspaceItem}
                onMoveItem={onMoveWorkspaceItem || (() => {})}
                activeItemId={activeWorkspaceItemId}
                expandedIds={expandedTreeIds}
                onToggleExpand={onToggleTreeExpand}
              />
            )}
          </>
        )}

        {/* ============ COLLECTIONS TAB ============ */}
        {workspaceTab === 'collections' && (
          <>
            <div className="pg-sidebar-section-head">
              <span>COLLECTIONS</span>
              <Tooltip label="New collection">
                <button className="pg-icon-btn" onClick={onCreateCollection}>
                  <FolderPlus size={14} />
                </button>
              </Tooltip>
            </div>
            <div className="pg-sidebar-list">
              {/* Use unified workspace items for collections (syncs with workspace folders) */}
              {workspaceItems.length > 0 ? (
                (() => {
                  // Build tree from workspace items
                  const collectionItems = workspaceItems.filter(
                    (item) => item.kind === 'collection' || item.kind === 'folder',
                  );
                  const requestItems = workspaceItems.filter((item) => item.kind === 'request');
                  const searchQ = collectionSearch.toLowerCase();

                  const filteredCollections = collectionItems.filter((col) => {
                    if (!searchQ) return true;
                    if (col.name.toLowerCase().includes(searchQ)) return true;
                    // Include if any child request matches
                    return requestItems.some(
                      (req) =>
                        req.parentId === col.id &&
                        (req.name.toLowerCase().includes(searchQ) ||
                          (req.url || '').toLowerCase().includes(searchQ)),
                    );
                  });

                  if (filteredCollections.length === 0) {
                    return (
                      <div className="pg-sidebar-empty">
                        <FolderOpen size={20} />
                        <p>No collections yet</p>
                        <button
                          className="pg-btn pg-btn-primary pg-btn-sm"
                          onClick={onCreateCollection}
                        >
                          <Plus size={12} /> New Collection
                        </button>
                      </div>
                    );
                  }

                  return filteredCollections.map((col) => {
                    const children = requestItems
                      .filter((req) => req.parentId === col.id)
                      .sort((a, b) => a.order - b.order);
                    const isExpanded = !!expandedTreeIds[col.id];
                    const Icon = isExpanded ? FolderOpen : Folder;

                    return (
                      <div key={col.id} className="pg-collection-card">
                        <div
                          className="pg-collection-card-head"
                          onClick={() => onToggleTreeExpand?.(col.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <Icon size={13} className="pg-collection-folder-icon" />
                          <span className="pg-collection-name">{col.name}</span>
                          <span className="pg-collection-count">{children.length}</span>
                          <button
                            className="pg-icon-btn pg-xs pg-ctx-trigger"
                            onClick={(e) =>
                              openContextMenu(e, col.id, 'collection', col.name)
                            }
                          >
                            <MoreVertical size={11} />
                          </button>
                        </div>
                        {isExpanded && children.length > 0 && (
                          <div className="pg-collection-requests">
                            {children.map((req) => (
                              <div
                                key={req.id}
                                className="pg-collection-request"
                                onClick={() => {
                                  if (req.request) {
                                    onLoadRequest({
                                      id: req.id,
                                      name: req.name,
                                      config: req.request,
                                      createdAt: req.createdAt || '',
                                      updatedAt: req.updatedAt || '',
                                    });
                                  } else if (onOpenWorkspaceItem) {
                                    onOpenWorkspaceItem(req);
                                  }
                                }}
                              >
                                <span className={`pg-method pg-method-${req.method || 'GET'}`}>
                                  {req.method || 'GET'}
                                </span>
                                <span className="pg-request-name">{req.name}</span>
                                <button
                                  className="pg-icon-btn pg-xs pg-ctx-trigger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onWorkspaceAction) {
                                      onWorkspaceAction('delete', req);
                                    }
                                  }}
                                  title="Delete request"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()
              ) : (
                <>
                  {collections
                    .filter((c) => c.name.toLowerCase().includes(collectionSearch.toLowerCase()))
                    .map((collection) => (
                      <div key={collection.id} className="pg-collection-card">
                        <div className="pg-collection-card-head">
                          <span className="pg-color-dot" style={{ background: collection.color }} />
                          <span className="pg-collection-name">{collection.name}</span>
                          <span className="pg-collection-count">{collection.requests.length}</span>
                          <button
                            className="pg-icon-btn pg-xs pg-ctx-trigger"
                            onClick={(e) =>
                              openContextMenu(e, collection.id, 'collection', collection.name)
                            }
                          >
                            <MoreVertical size={11} />
                          </button>
                        </div>
                        {collection.requests.length > 0 && (
                          <div className="pg-collection-requests">
                            {collection.requests.map((request) => (
                              <div
                                key={request.id}
                                className="pg-collection-request"
                                onClick={() => onLoadRequest(request)}
                              >
                                <span className={`pg-method pg-method-${request.config.method}`}>
                                  {request.config.method}
                                </span>
                                <span className="pg-request-name">{request.name}</span>
                                <button
                                  className="pg-icon-btn pg-xs pg-ctx-trigger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteRequestFromCollection(collection.id, request.id);
                                  }}
                                  title="Delete request"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  {collections.length === 0 && (
                    <div className="pg-sidebar-empty">
                      <FolderOpen size={20} />
                      <p>No collections yet</p>
                      <button className="pg-btn pg-btn-primary pg-btn-sm" onClick={onCreateCollection}>
                        <Plus size={12} /> New Collection
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ============ HISTORY TAB ============ */}
        {workspaceTab === 'history' && (
          <>
            <div className="pg-sidebar-section-head">
              <span>HISTORY</span>
              <Tooltip label="Clear history">
                <button className="pg-icon-btn" onClick={onClearHistory}>
                  <Trash2 size={14} />
                </button>
              </Tooltip>
            </div>
            <div className="pg-sidebar-list">
              {history.length > 0 ? (
                (() => {
                  const filteredHistory = history.filter(
                    (h) =>
                      h.requestName.toLowerCase().includes(historySearch.toLowerCase()) ||
                      h.url.toLowerCase().includes(historySearch.toLowerCase()),
                  );
                  const groups = groupHistoryByTime(filteredHistory);

                  if (groups.length === 0) {
                    return (
                      <div className="pg-sidebar-empty">
                        <History size={20} />
                        <p>No history found</p>
                      </div>
                    );
                  }

                  return groups.map((group) => (
                    <div key={group.key} className="pg-history-group">
                      <div className="pg-history-group-label">
                        <Calendar size={11} />
                        <span>{group.label}</span>
                        <span className="pg-history-group-count">{group.entries.length}</span>
                      </div>
                      {group.entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="pg-history-item"
                          onClick={() => onLoadFromHistory(entry)}
                        >
                          <span className={`pg-method pg-method-${entry.method}`}>
                            {entry.method}
                          </span>
                          <div className="pg-history-details">
                            <span className="pg-history-name">{entry.requestName}</span>
                            <span className="pg-history-url">{entry.url}</span>
                          </div>
                          <div className="pg-history-meta">
                            <span className="pg-history-time" title={formatFullTimestamp(entry.timestamp)}>
                              {formatRelativeTime(entry.timestamp)}
                            </span>
                            <span
                              className={`pg-status-dot pg-status-${statusColorClass(entry.status)}`}
                            />
                            <button
                              className="pg-icon-btn pg-xs pg-ctx-trigger"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteHistoryEntry(entry.id);
                              }}
                              title="Delete"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ));
                })()
              ) : (
                <div className="pg-sidebar-empty">
                  <History size={20} />
                  <p>No history yet</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* ============ ENVIRONMENTS TAB ============ */}
        {workspaceTab === 'environments' && (
          <>
            <div className="pg-sidebar-section-head">
              <span>ENVIRONMENTS</span>
              <Tooltip label="New environment">
                <button className="pg-icon-btn" onClick={onCreateEnvironment}>
                  <Plus size={14} />
                </button>
              </Tooltip>
            </div>
            <div className="pg-sidebar-list">
              {environments.map((env) => {
                const secretCount = Object.keys(env.secrets || {}).length;
                const varCount = Object.keys(env.variables || {}).length;
                return (
                  <div
                    key={env.id}
                    className={`pg-env-item ${activeEnvironment?.id === env.id ? 'active' : ''}`}
                    onClick={() => onEnvironmentChange(env)}
                  >
                    <div className="pg-env-info">
                      <Globe size={13} />
                      <span className="pg-env-name">{env.name}</span>
                      {env.isDefault && <span className="pg-env-default">Default</span>}
                    </div>
                    <div className="pg-env-vars" style={{display:'flex',gap:'5px',alignItems:'center'}}>
                      <span className="pg-env-var-count">{varCount} vars</span>
                      {secretCount > 0 && (
                        <span className="pg-env-secret-badge" title={`${secretCount} secret(s) stored securely`}>
                          <Lock size={10} />
                          {secretCount}
                        </span>
                      )}
                      {onEditEnvironment && (
                        <button
                          className="pg-icon-btn pg-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditEnvironment(env);
                          }}
                          title="Edit environment"
                        >
                          <Pencil size={11} />
                        </button>
                      )}
                      {onDeleteEnvironment && !env.isDefault && (
                        <button
                          className="pg-icon-btn pg-xs pg-danger-hover"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteEnvironment(env.id);
                          }}
                          title="Delete environment"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="pg-sidebar-note">
              <Shield size={13} />
              <span>
                Variables are substituted via <code>{'{{variable}}'}</code> in URLs, headers and
                bodies. Secrets are stored encrypted and never displayed.
              </span>
            </div>
          </>
        )}
      </div>

      {/* Context menu */}
      <ContextMenu
        state={ctxMenu}
        onClose={() => setCtxMenu(null)}
        onAction={handleContextAction}
      />
    </aside>
  );
};

/* =========================================================
   API TREE NODE
   ========================================================= */

const ApiTreeNode: React.FC<{
  api: ApiWorkspaceItem;
  isExpanded: boolean;
  isActive: boolean;
  selectedEndpoint: ApiWorkspaceEndpoint | null;
  onToggle: () => void;
  onSelectEndpoint: (
    api: ApiWorkspaceItem,
    version: ApiVersionInfo,
    endpoint: ApiWorkspaceEndpoint,
  ) => void;
  onContextMenu: (
    e: React.MouseEvent,
    itemId: string,
    itemType: ContextMenuState['itemType'],
    itemName: string,
  ) => void;
}> = ({
  api,
  isExpanded,
  isActive,
  selectedEndpoint,
  onToggle,
  onSelectEndpoint,
  onContextMenu,
}) => {
  const totalEndpoints = api.versions.reduce((sum, v) => sum + v.endpoints.length, 0);
  return (
    <div className="pg-explorer-node">
      <div className={`pg-explorer-row ${isActive ? 'active' : ''}`} onClick={onToggle}>
        <ChevronRight size={11} className={`pg-explorer-chevron ${isExpanded ? 'open' : ''}`} />
        <span className="pg-explorer-dot" style={{ background: api.accentColor || '#8b5cf6' }} />
        <span className="pg-explorer-label">{api.name}</span>
        {api.isOwned && <span className="pg-explorer-badge pg-badge-owned">Owned</span>}
        {api.isSubscribed && !api.isOwned && (
          <span className="pg-explorer-badge pg-badge-sub">Sub</span>
        )}
        <span className="pg-explorer-count">{totalEndpoints}</span>
        <button
          className="pg-icon-btn pg-xs pg-ctx-trigger"
          onClick={(e) => onContextMenu(e, api.id, 'api', api.name)}
          title="API actions"
        >
          <MoreVertical size={10} />
        </button>
      </div>
      {isExpanded && (
        <div className="pg-explorer-children">
          {api.versions.map((version) => (
            <div key={version.id} className="pg-explorer-version">
              <div className="pg-explorer-row pg-explorer-version-row">
                <GitBranch size={10} />
                <span className="pg-explorer-label pg-explorer-muted">{version.version}</span>
                {version.isDraft && <span className="pg-version-badge">Draft</span>}
              </div>
              <div className="pg-explorer-endpoints">
                {version.endpoints.map((endpoint) => (
                  <button
                    key={endpoint.id}
                    className={`pg-explorer-endpoint ${
                      selectedEndpoint?.id === endpoint.id && isActive ? 'active' : ''
                    }`}
                    onClick={() => onSelectEndpoint(api, version, endpoint)}
                  >
                    <span className={`pg-method pg-method-${endpoint.method}`}>
                      {endpoint.method}
                    </span>
                    <span className="pg-explorer-path">{endpoint.path}</span>
                    <button
                      className="pg-icon-btn pg-xs pg-ctx-trigger"
                      onClick={(e) =>
                        onContextMenu(
                          e,
                          endpoint.id,
                          'endpoint',
                          `${endpoint.method} ${endpoint.path}`,
                        )
                      }
                      title="Endpoint actions"
                    >
                      <MoreVertical size={9} />
                    </button>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* =========================================================
   LOCAL API TREE NODE
   ========================================================= */

const LocalApiTreeNode: React.FC<{
  api: LocalApi;
  isExpanded: boolean;
  isActive: boolean;
  selectedEndpoint: ApiWorkspaceEndpoint | null;
  onToggle: () => void;
  onSelectEndpoint: (api: LocalApi, endpoint: ApiWorkspaceEndpoint) => void;
  onContextMenu: (
    e: React.MouseEvent,
    itemId: string,
    itemType: ContextMenuState['itemType'],
    itemName: string,
  ) => void;
}> = ({
  api,
  isExpanded,
  isActive,
  selectedEndpoint,
  onToggle,
  onSelectEndpoint,
  onContextMenu,
}) => {
  return (
    <div className="pg-explorer-node">
      <div className={`pg-explorer-row ${isActive ? 'active' : ''}`} onClick={onToggle}>
        <ChevronRight size={11} className={`pg-explorer-chevron ${isExpanded ? 'open' : ''}`} />
        <Rocket size={11} className="pg-explorer-icon" />
        <span className="pg-explorer-label">{api.name}</span>
        <span className="pg-explorer-badge pg-badge-local">Local</span>
        <span className="pg-explorer-count">{api.endpoints.length}</span>
        <button
          className="pg-icon-btn pg-xs pg-ctx-trigger"
          onClick={(e) => onContextMenu(e, api.id, 'local-api', api.name)}
          title="Local API actions"
        >
          <MoreVertical size={10} />
        </button>
      </div>
      {isExpanded && (
        <div className="pg-explorer-children">
          <div className="pg-explorer-row pg-explorer-version-row">
            <Link2 size={10} />
            <span className="pg-explorer-label pg-explorer-muted pg-explorer-url">
              {api.baseUrl}
            </span>
          </div>
          <div className="pg-explorer-endpoints">
            {api.endpoints.map((endpoint) => (
              <button
                key={endpoint.id}
                className={`pg-explorer-endpoint ${
                  selectedEndpoint?.id === endpoint.id && isActive ? 'active' : ''
                }`}
                onClick={() => onSelectEndpoint(api, endpoint)}
              >
                <span className={`pg-method pg-method-${endpoint.method}`}>{endpoint.method}</span>
                <span className="pg-explorer-path">{endpoint.path}</span>
                <button
                  className="pg-icon-btn pg-xs pg-ctx-trigger"
                  onClick={(e) =>
                    onContextMenu(e, endpoint.id, 'endpoint', `${endpoint.method} ${endpoint.path}`)
                  }
                  title="Endpoint actions"
                >
                  <MoreVertical size={9} />
                </button>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================
   HELPERS
   ========================================================= */

const statusColorClass = (status: number): string => {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client-error';
  if (status >= 500) return 'server-error';
  return 'error';
};

const Shield: React.FC<{ size?: number; className?: string }> = ({ size = 14, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);