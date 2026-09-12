import React, { useState } from 'react';
import { ArrowLeft, Copy, Check, FlaskConical, Pause, Play, Trash2 } from 'lucide-react';
import { PROJECT_TABS, ProjectTab, ProviderProject } from '../../types/apibuild';
import { StatusDot } from './bits';
import './styles.css';
import './styles2.css';

const SOURCE_LABEL: Record<ProviderProject['sourceKind'], string> = {
  existing: 'External API', github: 'GitHub', docker: 'Docker',
};

export const ProjectWorkspace: React.FC<{
  project: ProviderProject;
  tab: ProjectTab; setTab: (t: ProjectTab) => void;
  onBack: () => void; onPlayground: () => void;
  onPauseToggle: () => void; onDelete: () => void;
  onPublishToggle: () => void; children?: React.ReactNode;
}> = ({ project, tab, setTab, onBack, onPlayground, onPauseToggle, onDelete, onPublishToggle, children }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(project.gatewayUrl); } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="ab2-page"><div className="ab2-shell">
      <button className="ab2-ghost" onClick={onBack} style={{ marginBottom: 12 }}><ArrowLeft size={14} /> All projects</button>
      <div className="ab2-card" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 22 }}>{project.name}</h1><StatusDot status={project.status} />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>{project.description}</p>
            <div className="ab2-proj-meta">
              <span className="ab2-pill" style={{ textTransform: 'capitalize' }}>{project.environment}</span>
              <span className="ab2-pill ab2-mono">{project.version}</span>
              <span className="ab2-pill">{SOURCE_LABEL[project.sourceKind]}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="ab2-ghost" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />} Gateway</button>
            <button className="ab2-ghost" onClick={onPlayground}><FlaskConical size={14} /> Playground</button>
            <button className="ab2-ghost" onClick={onPauseToggle}>{project.status === 'paused' ? <Play size={14} /> : <Pause size={14} />} {project.status === 'paused' ? 'Resume' : 'Pause'}</button>
          </div>
        </div>
        <div className="ab2-tabs">{PROJECT_TABS.map((t) => (
          <button key={t.id} className={`ab2-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}</div>
        <div>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, flexWrap: 'wrap', gap: 8 }}>
          <button className="ab2-ghost" onClick={onDelete} style={{ color: '#fca5a5' }}><Trash2 size={14} /> Delete</button>
          <button className="ab2-ghost" onClick={onPublishToggle}>{project.published ? 'Unpublish' : 'Publish'}</button>
        </div>
      </div>
    </div></div>
  );
};
