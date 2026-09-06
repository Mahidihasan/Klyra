import React from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';

interface Props {
  repoName: string;
  path: string;
  isFile?: boolean;
  onNavigateFolder: (path: string) => void;
  onBackToFiles?: () => void;
}

export const RepoBreadcrumb: React.FC<Props> = ({
  repoName,
  path,
  isFile = false,
  onNavigateFolder,
  onBackToFiles,
}) => {
  const segments = path.split('/').filter(Boolean);

  return (
    <div className="repo-breadcrumb-bar">
      {(path || isFile) && onBackToFiles && (
        <button
          type="button"
          className="kr-btn repo-back-btn-sm"
          onClick={onBackToFiles}
          title="Back to root/parent"
        >
          <ArrowLeft size={13} /> Back to files
        </button>
      )}

      <div className="repo-crumbs-path">
        <button
          type="button"
          className={`repo-crumb-item ${!path ? 'current' : ''}`}
          onClick={() => onNavigateFolder('')}
        >
          {repoName}
        </button>

        {segments.map((seg, idx) => {
          const isLast = idx === segments.length - 1;
          const subPath = segments.slice(0, idx + 1).join('/');

          return (
            <React.Fragment key={subPath}>
              <ChevronRight size={13} className="repo-crumb-sep" />
              {isLast && isFile ? (
                <span className="repo-crumb-item current file-crumb">
                  {seg}
                </span>
              ) : isLast ? (
                <span className="repo-crumb-item current folder-crumb">
                  {seg}
                </span>
              ) : (
                <button
                  type="button"
                  className="repo-crumb-item"
                  onClick={() => onNavigateFolder(subPath)}
                >
                  {seg}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
