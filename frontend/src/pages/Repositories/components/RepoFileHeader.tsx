import React from 'react';
import { Copy, Download, Check } from 'lucide-react';
import { fileIconOf } from './RepoFileTree';

interface Props {
  filePath: string;
  content: string;
  onCopy: () => void;
  onRaw: () => void;
  copied: boolean;
}

export const RepoFileHeader: React.FC<Props> = ({
  filePath,
  content,
  onCopy,
  onRaw,
  copied,
}) => {
  const fileName = filePath.split('/').pop() || filePath;
  const { icon: Icon, color } = fileIconOf(fileName);
  const lineCount = content.split('\n').length;
  const byteSize = new TextEncoder().encode(content).length;
  const kbSize = (byteSize / 1024).toFixed(1);

  return (
    <div className="repo-file-header-bar">
      <div className="repo-file-meta-info">
        <Icon size={16} style={{ color }} className="file-icon" />
        <span className="file-name">{fileName}</span>
        <span className="file-stats-divider">|</span>
        <span className="file-stats">
          {lineCount.toLocaleString()} lines
        </span>
        <span className="file-stats-dot">•</span>
        <span className="file-stats">
          {kbSize} KB ({byteSize.toLocaleString()} Bytes)
        </span>
      </div>

      <div className="repo-file-header-actions">
        <button type="button" className="kr-btn action-btn" onClick={onCopy}>
          {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>

        <button type="button" className="kr-btn action-btn" onClick={onRaw}>
          <Download size={13} />
          Raw
        </button>
      </div>
    </div>
  );
};
