import React from 'react';
import {
  Folder, FolderOpen, FileText, Braces, FileCode, FileCode2, Database, Image, File,
  ChevronRight, Search, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { TreeEntry } from '../../../types/repos';

export function fileIconOf(name: string): { icon: any; color: string } {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  if (ext === '.md' || ext === '.txt') return { icon: FileText, color: '#539bf5' };
  if (ext === '.json' || ext === '.yaml' || ext === '.yml') return { icon: Braces, color: '#d4a72c' };
  if (ext === '.ts' || ext === '.tsx') return { icon: FileCode2, color: '#539bf5' };
  if (ext === '.js' || ext === '.jsx' || ext === '.mjs') return { icon: FileCode2, color: '#d4a72c' };
  if (ext === '.css' || ext === '.scss') return { icon: FileCode, color: '#96d0ff' };
  if (ext === '.html') return { icon: FileCode, color: '#f47067' };
  if (ext === '.py') return { icon: FileCode2, color: '#57ab5a' };
  if (ext === '.sql') return { icon: Database, color: '#dcbdfb' };
  if (ext === '.png' || ext === '.jpg' || ext === '.svg' || ext === '.ico') return { icon: Image, color: '#6cb6ff' };
  return { icon: File, color: 'var(--text-muted)' };
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'blob' | 'tree';
  children: TreeNode[];
}

export function buildTreeModel(entries: TreeEntry[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', type: 'tree', children: [] };
  for (const e of entries) {
    const segs = e.path.split('/');
    let node = root;
    for (let i = 0; i < segs.length; i++) {
      const p = segs.slice(0, i + 1).join('/');
      const isLeaf = i === segs.length - 1;
      let child = node.children.find(c => c.path === p);
      if (!child) {
        child = { name: segs[i], path: p, type: isLeaf ? e.type : 'tree', children: [] };
        node.children.push(child);
      }
      node = child;
    }
  }
  const sort = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'tree' ? -1 : 1));
    nodes.forEach(n => sort(n.children));
    return nodes;
  };
  return sort(root.children);
}

interface Props {
  entries: TreeEntry[];
  activePath: string;
  currentRef: string;
  onSelectFile: (path: string) => void;
  onSelectFolder: (path: string) => void;
  onSelectRoot: () => void;
  filter?: string;
  onFilterChange?: (filter: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const RepoFileTree: React.FC<Props> = ({
  entries,
  activePath,
  currentRef,
  onSelectFile,
  onSelectFolder,
  onSelectRoot,
  filter = '',
  onFilterChange,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  // Auto-expand ancestor folders of the activePath
  React.useEffect(() => {
    if (!activePath) return;
    const segs = activePath.split('/');
    setExpanded(prev => {
      const next = new Set(prev);
      for (let i = 1; i <= segs.length; i++) {
        next.add(segs.slice(0, i).join('/'));
      }
      return next;
    });
  }, [activePath]);

  const treeModel = React.useMemo(() => buildTreeModel(entries), [entries]);

  const toggleFolder = (p: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p); else next.add(p);
      return next;
    });
  };

  const renderNodes = (nodes: TreeNode[], depth: number): React.ReactNode => {
    return nodes.map(n => {
      const isMatchingSearch = !filter || n.path.toLowerCase().includes(filter.toLowerCase()) ||
        n.children.some(c => c.path.toLowerCase().includes(filter.toLowerCase()));

      if (filter && !isMatchingSearch) return null;

      if (n.type === 'tree') {
        const isOpen = expanded.has(n.path) || Boolean(filter);
        const isActive = activePath === n.path;
        return (
          <React.Fragment key={n.path}>
            <button
              type="button"
              className={`repo-tree-item folder ${isActive ? 'active' : ''}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => {
                onSelectFolder(n.path);
                setExpanded(prev => new Set(prev).add(n.path));
              }}
            >
              <span
                className="repo-tree-chev-wrap"
                onClick={(e) => toggleFolder(n.path, e)}
                title={isOpen ? "Collapse folder" : "Expand folder"}
              >
                <ChevronRight size={12} className={`repo-tree-chev ${isOpen ? 'open' : ''}`} />
              </span>
              {isOpen ? (
                <FolderOpen size={14} className="repo-tree-icon folder-icon" />
              ) : (
                <Folder size={14} className="repo-tree-icon folder-icon" />
              )}
              <span className="repo-tree-name">{n.name}</span>
            </button>
            {isOpen && renderNodes(n.children, depth + 1)}
          </React.Fragment>
        );
      }

      const { icon: Icon, color } = fileIconOf(n.name);
      const isActive = activePath === n.path;

      return (
        <button
          key={n.path}
          type="button"
          className={`repo-tree-item file ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => onSelectFile(n.path)}
        >
          <span className="repo-tree-chev-spacer" />
          <Icon size={14} style={{ color }} className="repo-tree-icon" />
          <span className="repo-tree-name">{n.name}</span>
        </button>
      );
    });
  };

  if (isCollapsed) {
    return (
      <button
        type="button"
        className="repo-tree-collapsed-toggle"
        onClick={onToggleCollapse}
        title="Expand file tree"
      >
        <PanelLeftOpen size={16} />
      </button>
    );
  }

  return (
    <aside className="repo-tree-panel">
      <div className="repo-tree-header">
        <div className="repo-tree-title-group" onClick={onSelectRoot} style={{ cursor: 'pointer' }}>
          <span className="repo-tree-title">Files</span>
          <span className="branch-tag">{currentRef}</span>
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            className="repo-tree-toggle-btn"
            onClick={onToggleCollapse}
            title="Collapse file tree"
          >
            <PanelLeftClose size={14} />
          </button>
        )}
      </div>

      {onFilterChange && (
        <div className="repo-tree-search">
          <Search size={12} className="search-icon" />
          <input
            type="text"
            placeholder="Filter files…"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
          />
        </div>
      )}

      <div className="repo-tree-body">
        <button
          type="button"
          className={`repo-tree-item root-item ${activePath === '' ? 'active' : ''}`}
          onClick={onSelectRoot}
        >
          <Folder size={14} className="repo-tree-icon folder-icon" />
          <span className="repo-tree-name">Repository Root</span>
        </button>
        {entries.length === 0 ? (
          <div className="repo-tree-empty">No files on this branch.</div>
        ) : (
          renderNodes(treeModel, 0)
        )}
      </div>
    </aside>
  );
};
