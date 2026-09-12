import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft, ChevronDown, Check, Copy, FlaskConical, Rocket,
  MoreHorizontal, FileText, RefreshCw, Pause, Play, ShieldAlert,
  Layers, Code, Server, GitBranch, DollarSign, Users, Key,
  BarChart3, LineChart, Terminal, Activity, Settings, ExternalLink, Sparkles
} from 'lucide-react';
import { ProviderProject, ProjectTab } from '../../../types/apibuild';
import { ExtendedVersion } from '../types';

interface HeaderCommandBarProps {
  project: ProviderProject;
  projectsList: ProviderProject[];
  onSelectProject: (p: ProviderProject) => void;
  selectedVersion: string;
  onSelectVersion: (v: string) => void;
  versions: ExtendedVersion[];
  activeTab: ProjectTab;
  onSelectTab: (tab: ProjectTab) => void;
  onBackToDashboard: () => void;
  onOpenPlayground: () => void;
  onOpenDocs: () => void;
  onTriggerRedeploy: () => void;
  onPauseToggle: () => void;
  onOpenOpenApiImport: () => void;
  onShowToast: (msg: string) => void;
}

const TAB_CONFIG: { id: ProjectTab; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'api', label: 'API', icon: Code },
  { id: 'deployments', label: 'Deployments', icon: Server },
  { id: 'versions', label: 'Versions', icon: GitBranch },
  { id: 'plans', label: 'Plans', icon: DollarSign },
  { id: 'consumers', label: 'Consumers', icon: Users },
  { id: 'keys', label: 'API Keys', icon: Key },
  { id: 'usage', label: 'Usage', icon: BarChart3 },
  { id: 'analytics', label: 'Analytics', icon: LineChart },
  { id: 'logs', label: 'Logs', icon: Terminal },
  { id: 'monitoring', label: 'Monitoring', icon: ShieldAlert },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const HeaderCommandBar: React.FC<HeaderCommandBarProps> = ({
  project,
  projectsList,
  onSelectProject,
  selectedVersion,
  onSelectVersion,
  versions,
  activeTab,
  onSelectTab,
  onBackToDashboard,
  onOpenPlayground,
  onOpenDocs,
  onTriggerRedeploy,
  onPauseToggle,
  onOpenOpenApiImport,
  onShowToast
}) => {
  const [showVersionMenu, setShowVersionMenu] = useState(false);
  const [showDeployMenu, setShowDeployMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showProjMenu, setShowProjMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const versionRef = useRef<HTMLDivElement>(null);
  const deployRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const projRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (versionRef.current && !versionRef.current.contains(e.target as Node)) setShowVersionMenu(false);
      if (deployRef.current && !deployRef.current.contains(e.target as Node)) setShowDeployMenu(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setShowMoreMenu(false);
      if (projRef.current && !projRef.current.contains(e.target as Node)) setShowProjMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCopyGateway = async () => {
    try {
      await navigator.clipboard.writeText(project.gatewayUrl);
      setCopied(true);
      onShowToast(`Gateway URL copied: ${project.gatewayUrl}`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onShowToast(`Gateway: ${project.gatewayUrl}`);
    }
  };

  const currentVerObj = versions.find(v => v.semver === selectedVersion) || versions.find(v => v.isDefault);

  return (
    <header className="kly-header-command-bar">
      <div className="kly-cmd-row-top">
        {/* Left: Breadcrumbs & Project Identity & Version Selector */}
        <div className="kly-cmd-left">
          <button className="kly-back-pill" onClick={onBackToDashboard} title="Back to All Projects">
            <ArrowLeft size={13} />
            <span>Projects</span>
          </button>

          <span className="kly-breadcrumb-divider">/</span>

          {/* Project Switcher Dropdown */}
          <div className="kly-project-identity" style={{ position: 'relative' }} ref={projRef}>
            <div className="kly-project-icon">
              {project.name.charAt(0).toUpperCase()}
            </div>
            <button
              className="kly-btn-ghost"
              onClick={() => setShowProjMenu(!showProjMenu)}
              style={{ padding: '2px 6px', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span className="kly-project-name">{project.name}</span>
              <ChevronDown size={13} color="var(--kly-text-dim)" />
            </button>

            {showProjMenu && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 60,
                background: '#161724', border: '1px solid var(--kly-border-violet)',
                borderRadius: 8, boxShadow: '0 12px 30px rgba(0,0,0,0.8)', padding: 6, minWidth: 220
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--kly-text-dim)', padding: '4px 8px', textTransform: 'uppercase' }}>
                  Switch Project
                </div>
                {projectsList.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onSelectProject(p); setShowProjMenu(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 10px', borderRadius: 6, background: p.id === project.id ? 'rgba(139,92,246,0.15)' : 'transparent',
                      border: 'none', color: p.id === project.id ? '#c4b5fd' : 'var(--kly-text-main)', fontSize: 13, cursor: 'pointer', textAlign: 'left'
                    }}
                  >
                    <span>{p.name}</span>
                    {p.id === project.id && <Check size={13} color="#8b5cf6" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status Indicator */}
          <span className={`kly-badge ${project.status === 'healthy' || project.status === 'published' ? 'kly-badge-healthy' : project.status === 'deploying' ? 'kly-badge-deploying' : 'kly-badge-paused'}`}>
            <span className="kly-pulse-dot" style={{
              background: project.status === 'healthy' || project.status === 'published' ? '#10b981' : project.status === 'deploying' ? '#f59e0b' : '#94a3b8',
              boxShadow: project.status === 'healthy' || project.status === 'published' ? '0 0 8px #10b981' : 'none'
            }} />
            {project.status === 'healthy' || project.status === 'published' ? 'Operational' : project.status === 'deploying' ? 'Deploying' : 'Paused'}
          </span>

          {/* Meta Pills */}
          <div className="kly-meta-pills">
            <span className="kly-badge kly-badge-pill" style={{ textTransform: 'capitalize' }}>
              {project.environment}
            </span>

            {/* Global Version Selector */}
            <div style={{ position: 'relative' }} ref={versionRef}>
              <button
                className="kly-version-dropdown-trigger"
                onClick={() => setShowVersionMenu(!showVersionMenu)}
                title="Switch API version context"
              >
                <span>{selectedVersion === 'all' ? 'All versions' : selectedVersion}</span>
                {currentVerObj && selectedVersion !== 'all' && (
                  <span style={{ fontSize: 10, opacity: 0.7 }}>({currentVerObj.status})</span>
                )}
                <ChevronDown size={12} />
              </button>

              {showVersionMenu && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 60,
                  background: '#161724', border: '1px solid var(--kly-border-violet)',
                  borderRadius: 8, boxShadow: '0 12px 30px rgba(0,0,0,0.8)', padding: 6, minWidth: 210
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--kly-text-dim)', padding: '4px 8px', textTransform: 'uppercase' }}>
                    Select API Version
                  </div>
                  <button
                    onClick={() => { onSelectVersion('all'); setShowVersionMenu(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 8px', borderRadius: 5, background: selectedVersion === 'all' ? 'rgba(139,92,246,0.15)' : 'transparent',
                      border: 'none', color: selectedVersion === 'all' ? '#c4b5fd' : 'var(--kly-text-main)', fontSize: 12, cursor: 'pointer'
                    }}
                  >
                    <span>All versions</span>
                    {selectedVersion === 'all' && <Check size={12} color="#8b5cf6" />}
                  </button>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                  {versions.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => { onSelectVersion(v.semver); setShowVersionMenu(false); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 8px', borderRadius: 5, background: selectedVersion === v.semver ? 'rgba(139,92,246,0.15)' : 'transparent',
                        border: 'none', color: selectedVersion === v.semver ? '#c4b5fd' : 'var(--kly-text-main)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--kly-font-mono)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <b>{v.semver}</b>
                        <span style={{
                          fontSize: 10, padding: '1px 5px', borderRadius: 3,
                          background: v.status === 'Current' ? 'rgba(16,185,129,0.15)' : v.status === 'Beta' ? 'rgba(6,182,212,0.15)' : 'rgba(245,158,11,0.15)',
                          color: v.status === 'Current' ? '#34d399' : v.status === 'Beta' ? '#22d3ee' : '#fbbf24'
                        }}>
                          {v.status}
                        </span>
                      </div>
                      {selectedVersion === v.semver && <Check size={12} color="#8b5cf6" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="kly-badge kly-badge-pill">
              {project.sourceKind === 'existing' ? 'External API' : project.sourceKind === 'github' ? 'GitHub' : 'Docker'}
            </span>

            <span className="kly-badge kly-badge-pill" style={{ color: 'var(--kly-text-dim)' }}>
              {project.category}
            </span>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="kly-cmd-actions">
          <button className="kly-btn kly-btn-secondary" onClick={onOpenDocs} title="View interactive API Reference">
            <FileText size={13} />
            <span>Docs</span>
          </button>

          <button className="kly-btn kly-btn-secondary" onClick={onOpenPlayground} title="Open API Tester Playground">
            <FlaskConical size={13} color="#a855f7" />
            <span>Playground</span>
          </button>

          {/* Deploy Dropdown */}
          <div style={{ position: 'relative' }} ref={deployRef}>
            <button
              className="kly-btn kly-btn-primary"
              onClick={() => setShowDeployMenu(!showDeployMenu)}
            >
              <Rocket size={13} />
              <span>Deploy</span>
              <ChevronDown size={12} />
            </button>

            {showDeployMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 60,
                background: '#161724', border: '1px solid var(--kly-border-violet)',
                borderRadius: 8, boxShadow: '0 12px 30px rgba(0,0,0,0.8)', padding: 6, minWidth: 200
              }}>
                <button
                  onClick={() => { onTriggerRedeploy(); setShowDeployMenu(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 5, background: 'transparent',
                    border: 'none', color: 'var(--kly-text-main)', fontSize: 12, cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <RefreshCw size={13} color="#10b981" />
                  <div>
                    <b>Redeploy Current</b>
                    <div style={{ fontSize: 10, color: 'var(--kly-text-dim)' }}>Trigger instant zero-downtime refresh</div>
                  </div>
                </button>
                <button
                  onClick={() => { onSelectTab('deployments'); setShowDeployMenu(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 5, background: 'transparent',
                    border: 'none', color: 'var(--kly-text-main)', fontSize: 12, cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <Server size={13} color="#8b5cf6" />
                  <div>
                    <b>Deploy New Version</b>
                    <div style={{ fontSize: 10, color: 'var(--kly-text-dim)' }}>Select branch or upload bundle</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* More Contextual Actions Menu */}
          <div style={{ position: 'relative' }} ref={moreRef}>
            <button
              className="kly-btn-icon"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              title="More options"
            >
              <MoreHorizontal size={14} />
            </button>

            {showMoreMenu && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 60,
                background: '#161724', border: '1px solid var(--kly-border-violet)',
                borderRadius: 8, boxShadow: '0 12px 30px rgba(0,0,0,0.8)', padding: 6, minWidth: 220
              }}>
                <button
                  onClick={() => { handleCopyGateway(); setShowMoreMenu(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 5, background: 'transparent',
                    border: 'none', color: 'var(--kly-text-main)', fontSize: 12, cursor: 'pointer'
                  }}
                >
                  {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  <span>Copy Gateway URL</span>
                </button>
                <button
                  onClick={() => { onOpenOpenApiImport(); setShowMoreMenu(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 5, background: 'transparent',
                    border: 'none', color: 'var(--kly-text-main)', fontSize: 12, cursor: 'pointer'
                  }}
                >
                  <Code size={13} color="#06b6d4" />
                  <span>Sync OpenAPI Specification</span>
                </button>
                <button
                  onClick={() => { onPauseToggle(); setShowMoreMenu(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 5, background: 'transparent',
                    border: 'none', color: project.status === 'paused' ? '#34d399' : '#fbbf24', fontSize: 12, cursor: 'pointer'
                  }}
                >
                  {project.status === 'paused' ? <Play size={13} /> : <Pause size={13} />}
                  <span>{project.status === 'paused' ? 'Resume Traffic' : 'Pause Gateway'}</span>
                </button>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                <button
                  onClick={() => { onSelectTab('settings'); setShowMoreMenu(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 5, background: 'transparent',
                    border: 'none', color: 'var(--kly-text-muted)', fontSize: 12, cursor: 'pointer'
                  }}
                >
                  <Settings size={13} />
                  <span>Project Settings</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nav Tabs Bar */}
      <nav className="kly-nav-tabs-bar">
        {TAB_CONFIG.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              className={`kly-nav-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(t.id)}
            >
              <Icon size={13} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
