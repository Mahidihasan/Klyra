import React from 'react';
import { Folder, FileText } from 'lucide-react';
import { TreeEntry } from '../../../types/repos';
import { timeAgo, Loading, ErrorBox, EmptyState } from '../shared';
import { fileIconOf } from './RepoFileTree';

interface Props {
  entries: TreeEntry[];
  currentPath: string;
  onOpenFolder: (path: string) => void;
  onOpenFile: (path: string) => void;
  loading?: boolean;
  error?: string;
  filter?: string;
  onRetry?: () => void;
}

export const RepoDirectoryList: React.FC<Props> = ({
  entries,
  currentPath,
  onOpenFolder,
  onOpenFile,
  loading = false,
  error = '',
  filter = '',
  onRetry,
}) => {
  const shownEntries = React.useMemo(() => {
    if (!filter) return entries;
    return entries.filter(e => e.path.toLowerCase().includes(filter.toLowerCase()));
  }, [entries, filter]);

  const folders = React.useMemo(() => shownEntries.filter(e => e.type === 'tree'), [shownEntries]);
  const files = React.useMemo(() => shownEntries.filter(e => e.type === 'blob'), [shownEntries]);

  if (loading) {
    return (
      <div className="repo-dir-table-container">
        <div className="gh-table-loading">
          <Loading label="Loading directory content…" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="repo-dir-table-container">
        <ErrorBox message={error} onRetry={onRetry} />
      </div>
    );
  }

  if (shownEntries.length === 0) {
    return (
      <div className="repo-dir-table-container">
        <EmptyState
          title={filter ? 'No matching files or folders' : 'Empty directory'}
          hint={filter ? 'Try clearing your search filter.' : 'This directory has no items.'}
        />
      </div>
    );
  }

  return (
    <div className="repo-dir-table-container">
      <table className="repo-dir-table">
        <tbody>
          {folders.map(t => {
            const itemPath = currentPath ? `${currentPath}/${t.path}` : t.path;
            return (
              <tr
                key={t.path}
                className="repo-dir-row folder-row"
                onClick={() => onOpenFolder(itemPath)}
              >
                <td className="col-name">
                  <div className="cell-name-wrap">
                    <Folder size={16} className="folder-icon" style={{ color: '#539bf5' }} />
                    <span className="item-name">{t.path}</span>
                  </div>
                </td>
                <td className="col-commit">
                  <span className="commit-msg">
                    {t.last_commit_message || 'Folder'}
                  </span>
                </td>
                <td className="col-updated">
                  <span className="updated-time">
                    {t.last_updated ? timeAgo(t.last_updated) : ''}
                  </span>
                </td>
              </tr>
            );
          })}

          {files.map(t => {
            const { icon: Icon, color } = fileIconOf(t.path);
            const itemPath = currentPath ? `${currentPath}/${t.path}` : t.path;
            return (
              <tr
                key={t.path}
                className="repo-dir-row file-row"
                onClick={() => onOpenFile(itemPath)}
              >
                <td className="col-name">
                  <div className="cell-name-wrap">
                    <Icon size={16} style={{ color }} className="file-icon" />
                    <span className="item-name">{t.path}</span>
                  </div>
                </td>
                <td className="col-commit">
                  <span className="commit-msg">
                    {t.last_commit_message || (t.size ? `${t.size.toLocaleString()} B` : 'File')}
                  </span>
                </td>
                <td className="col-updated">
                  <span className="updated-time">
                    {t.last_updated ? timeAgo(t.last_updated) : ''}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
