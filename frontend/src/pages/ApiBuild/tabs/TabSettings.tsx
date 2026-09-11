import React, { useState } from 'react';
import { Settings, ShieldAlert, Trash2, Pause, Play, Save, Check, Users, Globe, Key, GitBranch, Bell } from 'lucide-react';
import { ProviderProject } from '../../../types/apibuild';

interface TabSettingsProps {
  project: ProviderProject;
  onUpdateProject: (patch: Partial<ProviderProject>) => void;
  onDeleteProject: () => void;
  onShowToast: (msg: string) => void;
}

export const TabSettings: React.FC<TabSettingsProps> = ({
  project,
  onUpdateProject,
  onDeleteProject,
  onShowToast
}) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [category, setCategory] = useState(project.category);
  const [baseUrl, setBaseUrl] = useState(project.baseUrl || 'https://api.kickonass.com');
  const [rateLimit, setRateLimit] = useState(project.rateLimitPerMin || 100);
  const [visibility, setVisibility] = useState(project.visibility || 'public');
  const [customDomain, setCustomDomain] = useState('api.kickonass.com');

  const handleSave = () => {
    onUpdateProject({
      name,
      description,
      category,
      baseUrl,
      rateLimitPerMin: Number(rateLimit),
      visibility: visibility as any
    });
    onShowToast('Project configuration saved successfully');
  };

  return (
    <div className="kly-page-stack kly-settings-page">
      {/* 1. General Settings */}
      <div className="kly-card">
        <h4 className="kly-card-title" style={{ marginBottom: 14 }}>General Configuration</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="kly-input-group">
            <label className="kly-label">Project Name</label>
            <input className="kly-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="kly-input-group">
            <label className="kly-label">Category</label>
            <input className="kly-input" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
        </div>

        <div className="kly-input-group" style={{ marginTop: 12 }}>
          <label className="kly-label">Project Description</label>
          <textarea
            className="kly-textarea"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="kly-input-group" style={{ marginTop: 12 }}>
          <label className="kly-label">Marketplace Listing Visibility</label>
          <select className="kly-select" value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
            <option value="public">Public (Indexed on Klyra marketplace & search engines)</option>
            <option value="unlisted">Unlisted (Accessible only via direct gateway link)</option>
            <option value="private">Private (Restricted to workspace team members)</option>
          </select>
        </div>
      </div>

      {/* 2. Gateway & Routing */}
      <div className="kly-card">
        <h4 className="kly-card-title" style={{ marginBottom: 14 }}>Gateway & Custom Domain</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="kly-input-group">
            <label className="kly-label">Custom Edge Domain</label>
            <input
              className="kly-input kly-mono"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="api.yourbrand.com"
            />
            <span style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>
              CNAME points to <code>edge.klyra.net</code> (SSL auto-provisioned)
            </span>
          </div>

          <div className="kly-input-group">
            <label className="kly-label">Upstream Origin Base URL</label>
            <input
              className="kly-input kly-mono"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>
        </div>

        <div className="kly-input-group" style={{ marginTop: 14 }}>
          <label className="kly-label">Global Default Rate Limit Policy (requests/min per IP/Key)</label>
          <input
            type="number"
            className="kly-input"
            value={rateLimit}
            onChange={(e) => setRateLimit(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="kly-btn kly-btn-primary" onClick={handleSave}>
          <Save size={13} />
          <span>Save Changes</span>
        </button>
      </div>

      {/* 3. Danger Zone */}
      <div className="kly-card" style={{ borderColor: 'rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.03)' }}>
        <h4 className="kly-card-title" style={{ color: '#fb7185', marginBottom: 10 }}>
          <ShieldAlert size={15} color="#fb7185" />
          <span>Danger Zone</span>
        </h4>
        <p style={{ fontSize: 12, color: 'var(--kly-text-muted)', marginBottom: 14 }}>
          Destructive operations that immediately halt traffic or irreversibly purge project data.
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <b style={{ fontSize: 13, display: 'block' }}>Delete this Project</b>
            <span style={{ fontSize: 11, color: 'var(--kly-text-dim)' }}>
              Permanently revokes all 42 endpoints, 3 API keys, and drops gateway routing.
            </span>
          </div>

          <button className="kly-btn kly-btn-danger" onClick={onDeleteProject}>
            <Trash2 size={13} />
            <span>Delete Project</span>
          </button>
        </div>
      </div>
    </div>
  );
};
