import React from 'react';
import { History } from 'lucide-react';
import { HighlightedCode, timeAgo } from '../shared';

interface Props {
  content: string;
  history?: Array<{
    sha: string;
    message: string;
    author: string;
    date: string;
  }>;
}

export const RepoCodeViewer: React.FC<Props> = ({ content, history = [] }) => {
  return (
    <div className="repo-code-viewer-wrap">
      <div className="repo-code-box">
        <HighlightedCode content={content} />
      </div>

      {history && history.length > 0 && (
        <div className="repo-file-history">
          <h4>
            <History size={14} /> File History
          </h4>
          <div className="history-list">
            {history.map((h, i) => (
              <div key={i} className="commit-item">
                <span className="sha-chip" title={h.sha}>
                  {h.sha.slice(0, 7)}
                </span>
                <div className="commit-details">
                  <div className="ovw-commit-msg">{h.message}</div>
                  <div className="list-sub">
                    {h.author} · {timeAgo(h.date)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
