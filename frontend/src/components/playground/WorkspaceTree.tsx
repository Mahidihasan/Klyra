import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  MoreVertical,
  Plus,
  Pin,
  Copy,
  Trash2,
  Pencil,
  Move,
  Play,
  X,
  Check,
  FolderPlus,
  TestTube,
  Search,
  Upload,
} from 'lucide-react';
import { WorkspaceItem, WorkspaceItemKind } from '../../types/playground';

/* =========================================================
   TYPES
   ========================================================= */

export type TreeAction =
  | 'open'
  | 'rename'
  | 'pin'
  | 'unpin'
  | 'duplicate'
  | 'delete'
  | 'move'
  | 'new-folder'
  | 'new-request'
  | 'new-test'
  | 'replay'
  | 'import';

interface TreeContextMenuState {
  x: number;
  y: number;
  item: WorkspaceItem;
}

interface WorkspaceTreeProps {
  items: WorkspaceItem[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenItem: (item: WorkspaceItem) => void;
  onAction: (action: TreeAction, item: WorkspaceItem) => void;
  onCreateItem: (kind: WorkspaceItemKind, parentId?: string, name?: string) => void;
  onMoveItem: (itemId: string, parentId: string | null) => void;
  activeItemId?: string;
  expandedIds?: Record<string, boolean>;
  onToggleExpand?: (id: string) => void;
}

/* =========================================================
   CONTEXT MENU
   ========================================================= */

const ContextMenu: React.FC<{
  state: TreeContextMenuState | null;
  onClose: () => void;
  onAction: (action: TreeAction, item: WorkspaceItem) => void;
}> = ({ state, onClose, onAction }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
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

  const item = state.item;
  const isFolder = item.kind === 'folder' || item.kind === 'collection';
  const menuItems: Array<{
    id: TreeAction;
    label: string;
    icon: React.ComponentType<any>;
    danger?: boolean;
    divider?: boolean;
  }> = [
    { id: 'open', label: 'Open', icon: Play },
    ...(isFolder
      ? [
          { id: 'new-request' as TreeAction, label: 'New Request', icon: FileText },
          { id: 'new-folder' as TreeAction, label: 'New Folder', icon: FolderPlus },
          { id: 'new-test' as TreeAction, label: 'New Test', icon: TestTube },
        ]
      : []),
    { id: 'rename', label: 'Rename', icon: Pencil },
    { id: item.isPinned ? 'unpin' : 'pin', label: item.isPinned ? 'Unpin' : 'Pin', icon: Pin },
    { id: 'move', label: 'Move to...', icon: Move, divider: true },
    { id: 'duplicate', label: 'Duplicate', icon: Copy },
    { id: 'delete', label: 'Delete', icon: Trash2, danger: true, divider: true },
  ];

  const menuWidth = 190;
  const menuHeight = menuItems.length * 30 + 12;
  const left = Math.min(state.x, window.innerWidth - menuWidth - 8);
  const top = Math.min(state.y, window.innerHeight - menuHeight - 8);

  return (
    <div ref={menuRef} className="pg-ctx-menu" style={{ left, top, width: menuWidth }}>
      <div className="pg-ctx-menu-head">
        <span className="pg-ctx-menu-title">{item.name}</span>
      </div>
      <div className="pg-ctx-menu-items">
        {menuItems.map((mi) => {
          const Icon = mi.icon;
          return (
            <React.Fragment key={mi.id}>
              {mi.divider && <div className="pg-ctx-divider" />}
              <button
                className={`pg-ctx-item ${mi.danger ? 'danger' : ''}`}
                onClick={() => {
                  onAction(mi.id, item);
                  onClose();
                }}
              >
                <Icon size={13} />
                <span>{mi.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

/* =========================================================
   INLINE RENAME
   ========================================================= */

const InlineRename: React.FC<{
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}> = ({ initialValue, onCommit, onCancel }) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed) onCommit(trimmed);
    else onCancel();
  };

  return (
    <div className="pg-tree-inline-rename" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={commit}
        className="pg-tree-rename-input"
      />
      <button
        className="pg-icon-btn pg-xs"
        onMouseDown={(e) => e.preventDefault()}
        onClick={commit}
        title="Confirm rename"
      >
        <Check size={11} />
      </button>
      <button
        className="pg-icon-btn pg-xs"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onCancel}
        title="Cancel rename"
      >
        <X size={11} />
      </button>
    </div>
  );
};

/* =========================================================
   TREE NODE
   ========================================================= */

const TreeNode: React.FC<{
  item: WorkspaceItem;
  depth: number;
  isExpanded: boolean;
  isActive: boolean;
  isRenaming: boolean;
  isQuickMenuOpen: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent, item: WorkspaceItem) => void;
  onRenameCommit: (name: string) => void;
  onRenameCancel: () => void;
  onToggleQuickMenu: () => void;
  onCreateInFolder: (kind: WorkspaceItemKind) => void;
  children?: React.ReactNode;
}> = ({
  item,
  depth,
  isExpanded,
  isActive,
  isRenaming,
  isQuickMenuOpen,
  onToggle,
  onOpen,
  onContextMenu,
  onRenameCommit,
  onRenameCancel,
  onToggleQuickMenu,
  onCreateInFolder,
  children,
}) => {
  const isFolder = item.kind === 'folder' || item.kind === 'collection';
  const Icon = isFolder ? (isExpanded ? FolderOpen : Folder) : FileText;
  const rowClassName = `pg-tree-row ${isActive ? 'active' : ''} ${depth > 0 ? 'has-depth' : ''}`;
  const rowStyle = {
    paddingLeft: 8 + depth * 14,
    ['--pg-tree-depth' as string]: depth,
  } as React.CSSProperties;

  return (
    <div className="pg-tree-node">
      <div
        className={rowClassName}
        style={rowStyle}
        onClick={() => (isFolder ? onToggle() : onOpen())}
        onContextMenu={(e) => onContextMenu(e, item)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            isFolder ? onToggle() : onOpen();
          } else if (isFolder && e.key === 'ArrowRight' && !isExpanded) {
            e.preventDefault();
            onToggle();
          } else if (isFolder && e.key === 'ArrowLeft' && isExpanded) {
            e.preventDefault();
            onToggle();
          }
        }}
        role="treeitem"
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-selected={isActive}
        tabIndex={0}
      >
        {isFolder ? (
          <ChevronRight
            size={11}
            className={`pg-tree-chevron ${isExpanded ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          />
        ) : (
          <span className="pg-tree-spacer" />
        )}
        <Icon size={12} className={`pg-tree-icon pg-tree-icon-${item.kind}`} />
        {isRenaming ? (
          <InlineRename
            initialValue={item.name}
            onCommit={onRenameCommit}
            onCancel={onRenameCancel}
          />
        ) : (
          <>
            <span className="pg-tree-label">{item.name}</span>
            {item.isPinned && <Pin size={9} className="pg-tree-pin" />}
          </>
        )}
        {isFolder ? (
          <div className="pg-tree-folder-actions">
            <div className={`pg-tree-folder-quick ${isQuickMenuOpen ? 'open' : ''}`}>
              <button
                className={`pg-icon-btn pg-xs pg-tree-folder-plus ${isQuickMenuOpen ? 'open' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleQuickMenu();
                }}
                title="Create inside folder"
                aria-label={`Create inside ${item.name}`}
                aria-haspopup="menu"
                aria-expanded={isQuickMenuOpen}
              >
                <Plus size={11} />
              </button>
              {isQuickMenuOpen && (
                <div
                  className="pg-tree-folder-menu"
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      onToggleQuickMenu();
                    }
                  }}
                >
                  <button
                    className="pg-tree-folder-menu-item"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateInFolder('request');
                    }}
                  >
                    <FileText size={11} />
                    <span>New Request</span>
                  </button>
                  <button
                    className="pg-tree-folder-menu-item"
                    role="menuitem"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreateInFolder('folder');
                    }}
                  >
                    <FolderPlus size={11} />
                    <span>New Folder</span>
                  </button>
                </div>
              )}
            </div>
            <button
              className="pg-icon-btn pg-xs pg-ctx-trigger"
              onClick={(e) => onContextMenu(e, item)}
              title="Actions"
              aria-label={`Actions for ${item.name}`}
            >
              <MoreVertical size={10} />
            </button>
          </div>
        ) : (
          <button
            className="pg-icon-btn pg-xs pg-ctx-trigger"
            onClick={(e) => onContextMenu(e, item)}
            title="Actions"
            aria-label={`Actions for ${item.name}`}
          >
            <MoreVertical size={10} />
          </button>
        )}
      </div>
      {isExpanded && children}
    </div>
  );
};

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

export const WorkspaceTree: React.FC<WorkspaceTreeProps> = ({
  items,
  searchQuery,
  onSearchChange,
  onOpenItem,
  onAction,
  onCreateItem,
  onMoveItem,
  activeItemId,
  expandedIds = {},
  onToggleExpand,
}) => {
  const [ctxMenu, setCtxMenu] = useState<TreeContextMenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [creatingKind, setCreatingKind] = useState<WorkspaceItemKind | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [quickMenuFolderId, setQuickMenuFolderId] = useState<string | null>(null);
  const newItemRef = useRef<HTMLInputElement>(null);
  const quickMenuRootRef = useRef<HTMLDivElement>(null);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    const included = new Set<string>();

    items.forEach((item) => {
      const isMatch =
        item.name.toLowerCase().includes(q) ||
        (item.url || '').toLowerCase().includes(q) ||
        (item.method || '').toLowerCase().includes(q);
      if (!isMatch) return;

      let current: WorkspaceItem | undefined = item;
      while (current) {
        included.add(current.id);
        current = current.parentId ? itemById.get(current.parentId) : undefined;
      }
    });

    return items.filter((item) => included.has(item.id));
  }, [items, itemById, searchQuery]);

  const fullChildrenMap = useMemo(() => {
    const map = new Map<string, WorkspaceItem[]>();
    items.forEach((item) => {
      const key = item.parentId || '__root__';
      const existing = map.get(key) || [];
      existing.push(item);
      map.set(key, existing);
    });
    map.forEach((children) => {
      children.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    });
    return map;
  }, [items]);

  const visibleChildrenMap = useMemo(() => {
    const map = new Map<string, WorkspaceItem[]>();
    filteredItems.forEach((item) => {
      const key = item.parentId || '__root__';
      const existing = map.get(key) || [];
      existing.push(item);
      map.set(key, existing);
    });
    map.forEach((children) => {
      children.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    });
    return map;
  }, [filteredItems]);

  useEffect(() => {
    if (!creatingKind) return;
    requestAnimationFrame(() => newItemRef.current?.focus());
  }, [creatingKind, creatingIn]);

  useEffect(() => {
    if (!quickMenuFolderId) return;
    const handleClick = (e: MouseEvent) => {
      if (!quickMenuRootRef.current) return;
      if (!quickMenuRootRef.current.contains(e.target as Node)) {
        setQuickMenuFolderId(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQuickMenuFolderId(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [quickMenuFolderId]);

  const startCreate = (kind: WorkspaceItemKind, parentId?: string) => {
    setCreatingIn(parentId || null);
    setCreatingKind(kind);
    setNewItemName('');
    setQuickMenuFolderId(null);
    if (parentId && !expandedIds[parentId]) {
      onToggleExpand?.(parentId);
    }
  };

  const commitCreate = () => {
    if (!creatingKind) return;
    const name = newItemName.trim();
    onCreateItem(creatingKind, creatingIn || undefined, name || undefined);
    setCreatingIn(null);
    setCreatingKind(null);
    setNewItemName('');
  };

  const cancelCreate = () => {
    setCreatingIn(null);
    setCreatingKind(null);
    setNewItemName('');
  };

  const handleAction = (action: TreeAction, item: WorkspaceItem) => {
    switch (action) {
      case 'rename':
        setRenamingId(item.id);
        break;
      case 'new-folder':
      case 'new-request':
      case 'new-test':
        startCreate(action === 'new-folder' ? 'folder' : action === 'new-test' ? 'test' : 'request', item.id);
        break;
      case 'move':
        setMoveTarget(item.id);
        break;
      default:
        onAction(action, item);
    }
  };

  const getDescendantIds = (id: string): Set<string> => {
    const descendants = new Set<string>();
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      const children = fullChildrenMap.get(current) || [];
      children.forEach((child) => {
        if (!descendants.has(child.id)) {
          descendants.add(child.id);
          stack.push(child.id);
        }
      });
    }
    return descendants;
  };

  const moveTargetItem = moveTarget ? itemById.get(moveTarget) : undefined;
  const blockedMoveTargets = moveTarget ? getDescendantIds(moveTarget) : new Set<string>();
  if (moveTarget) blockedMoveTargets.add(moveTarget);

  const folderMoveTargets = items
    .filter((i) => i.kind === 'folder' || i.kind === 'collection')
    .filter((i) => !blockedMoveTargets.has(i.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const renderInlineCreate = (depth: number) => {
    if (!creatingKind) return null;
    const icon =
      creatingKind === 'folder' ? (
        <Folder size={12} className="pg-tree-icon pg-tree-icon-folder" />
      ) : creatingKind === 'test' ? (
        <TestTube size={12} className="pg-tree-icon pg-tree-icon-test" />
      ) : (
        <FileText size={12} className="pg-tree-icon pg-tree-icon-request" />
      );

    return (
      <div
        className={`pg-tree-inline-create ${depth > 0 ? 'has-depth' : ''}`}
        style={{
          marginLeft: 8 + depth * 14,
          ['--pg-tree-depth' as string]: depth,
        }}
      >
        <span className="pg-tree-spacer" />
        {icon}
        <input
          ref={newItemRef}
          className="pg-tree-rename-input"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder={
            creatingKind === 'folder'
              ? 'New Folder'
              : creatingKind === 'test'
                ? 'New Test'
                : 'New Request'
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitCreate();
            if (e.key === 'Escape') cancelCreate();
          }}
          onBlur={commitCreate}
          aria-label="New item name"
        />
        <button
          className="pg-icon-btn pg-xs"
          onMouseDown={(e) => e.preventDefault()}
          onClick={commitCreate}
          title="Create"
        >
          <Check size={11} />
        </button>
        <button
          className="pg-icon-btn pg-xs"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancelCreate}
          title="Cancel"
        >
          <X size={11} />
        </button>
      </div>
    );
  };

  const renderNode = (node: WorkspaceItem, depth: number): React.ReactNode => {
    const children = visibleChildrenMap.get(node.id) || [];
    const isExpanded = !!expandedIds[node.id];
    const isFolder = node.kind === 'folder' || node.kind === 'collection';
    const showChildren = isFolder && isExpanded;

    return (
      <TreeNode
        key={node.id}
        item={node}
        depth={depth}
        isExpanded={isExpanded}
        isActive={activeItemId === node.id}
        isRenaming={renamingId === node.id}
        isQuickMenuOpen={quickMenuFolderId === node.id}
        onToggle={() => onToggleExpand?.(node.id)}
        onOpen={() => onOpenItem(node)}
        onContextMenu={(e, item) => {
          e.stopPropagation();
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY, item });
          setQuickMenuFolderId(null);
        }}
        onRenameCommit={(name) => {
          onAction('rename', { ...node, name });
          setRenamingId(null);
        }}
        onRenameCancel={() => setRenamingId(null)}
        onToggleQuickMenu={() =>
          setQuickMenuFolderId((prev) => (prev === node.id ? null : node.id))
        }
        onCreateInFolder={(kind) => startCreate(kind, node.id)}
      >
        {showChildren && (
          <div className="pg-tree-children" role="group">
            {children.map((child) => renderNode(child, depth + 1))}
            {creatingKind && creatingIn === node.id && renderInlineCreate(depth + 1)}
          </div>
        )}
      </TreeNode>
    );
  };

  const roots = visibleChildrenMap.get('__root__') || [];

  return (
    <div className="pg-workspace-tree" ref={quickMenuRootRef}>
      <div className="pg-tree-toolbar">
        <div className="pg-sidebar-search pg-search-flex">
          <Search size={13} />
          <input
            type="text"
            placeholder="Search workspace..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pg-sidebar-search-input"
            aria-label="Search workspace items"
          />
        </div>
        <button
          className="pg-tree-toolbar-btn"
          onClick={() => startCreate('folder')}
          title="New folder"
        >
          <FolderPlus size={11} />
          <span>Folder</span>
        </button>
      </div>

      {moveTargetItem && (
        <div className="pg-tree-move-panel">
          <div className="pg-tree-move-head">
            <Move size={12} />
            <span>Move "{moveTargetItem.name}" to...</span>
            <button
              className="pg-icon-btn pg-xs"
              onClick={() => setMoveTarget(null)}
              title="Close move panel"
            >
              <X size={11} />
            </button>
          </div>
          <div className="pg-tree-move-list">
            <button
              className="pg-tree-move-item"
              onClick={() => {
                onMoveItem(moveTargetItem.id, null);
                setMoveTarget(null);
              }}
            >
              <Folder size={11} />
              <span>Workspace Root</span>
            </button>
            {folderMoveTargets.map((folder) => (
              <button
                key={folder.id}
                className="pg-tree-move-item"
                onClick={() => {
                  onMoveItem(moveTargetItem.id, folder.id);
                  setMoveTarget(null);
                }}
              >
                <Folder size={11} />
                <span>{folder.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="pg-tree-scroll" role="tree" aria-label="Workspace Explorer">
        {roots.map((root) => renderNode(root, 0))}
        {creatingKind && creatingIn === null && renderInlineCreate(0)}
        {roots.length === 0 && !creatingKind && (
          <div className="pg-workspace-empty" role="note" aria-live="polite">
            <div className="pg-workspace-empty-line">
              <FolderOpen size={13} />
              <span>No workspace items yet</span>
            </div>
            <div className="pg-workspace-empty-actions">
              <button
                className="pg-tree-toolbar-btn pg-workspace-empty-btn"
                onClick={() => startCreate('request')}
                title="Create request"
              >
                <FileText size={11} />
                <span>New Request</span>
              </button>
              <button
                className="pg-tree-toolbar-btn pg-workspace-empty-btn"
                onClick={() => startCreate('folder')}
                title="Create folder"
              >
                <FolderPlus size={11} />
                <span>New Folder</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <ContextMenu state={ctxMenu} onClose={() => setCtxMenu(null)} onAction={handleAction} />
    </div>
  );
};
