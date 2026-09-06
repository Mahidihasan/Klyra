import React from 'react';
import { Sliders, Save, CheckCircle2 } from 'lucide-react';
import { reposApi } from '../../../services/api/repos';
import { RepoDetail } from '../../../types/repos';

interface Props {
  repo: RepoDetail;
  isOwner: boolean;
  canWrite: boolean;
  onChanged: () => void;
}

export const GeneralSettings: React.FC<Props> = ({ repo, isOwner, canWrite, onChanged }) => {
  const [name, setName] = React.useState(repo.name);
  const [desc, setDesc] = React.useState(repo.description || '');
  const [visibility, setVisibility] = React.useState(repo.visibility);
  const [defaultBranch, setDefaultBranch] = React.useState(repo.default_branch);
  const [license, setLicense] = React.useState(repo.license || 'MIT');
  const [homepage, setHomepage] = React.useState(`https://api.klyra.dev/${repo.name}`);
  const [topics, setTopics] = React.useState('api, typescript, rest');

  // Feature Toggles
  const [enableIssues, setEnableIssues] = React.useState(true);
  const [enablePulls, setEnablePulls] = React.useState(true);
  const [enableActions, setEnableActions] = React.useState(true);
  const [enableMarketplace, setEnableMarketplace] = React.useState(true);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Repository name cannot be empty');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await reposApi.update(repo.id, {
        name: name.trim(),
        description: desc.trim(),
        visibility,
        default_branch: defaultBranch,
        license,
      });
      setSuccess('General repository settings saved successfully.');
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to save repository settings.');
    } finally {
      setSaving(false);
    }
  };

  const branchOptions = (repo.branches || []).map(b => b.name);
  if (!branchOptions.includes(repo.default_branch)) {
    branchOptions.unshift(repo.default_branch);
  }

  return (
    <div className="settings-section-container">
      <div className="settings-section-header">
        <h2>General Settings</h2>
        <p>Configure basic repository details, default branch, metadata, and feature availability.</p>
      </div>

      {success && (
        <div className="kr-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={15} /> {success}
        </div>
      )}
      {error && <div className="kr-error">{error}</div>}

      <form onSubmit={handleSave}>
        {/* Repository Name & Description */}
        <div className="settings-group">
          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Repository Name</label>
              <div className="settings-sub">The name of your repository as displayed in URLs and endpoints.</div>
            </div>
            <div className="settings-control">
              <input
                className="kr-input"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={!isOwner}
                placeholder="repository-name"
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Description</label>
              <div className="settings-sub">Short summary of this repository's API purpose.</div>
            </div>
            <div className="settings-control">
              <textarea
                className="kr-textarea"
                rows={3}
                value={desc}
                onChange={e => setDesc(e.target.value)}
                disabled={!canWrite}
                placeholder="Provide a clear description..."
              />
            </div>
          </div>
        </div>

        {/* Visibility & Default Branch */}
        <div className="settings-group">
          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Repository Visibility</label>
              <div className="settings-sub">Choose who can inspect this repository's code.</div>
            </div>
            <div className="settings-control">
              <select
                className="kr-select"
                value={visibility}
                onChange={e => setVisibility(e.target.value as any)}
                disabled={!isOwner}
              >
                <option value="private">Private — Accessible only to repository collaborators</option>
                <option value="public">Public — Anyone on the internet can view code</option>
              </select>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Default Branch</label>
              <div className="settings-sub">The primary branch used for pull requests and builds.</div>
            </div>
            <div className="settings-control">
              <select
                className="kr-select"
                value={defaultBranch}
                onChange={e => setDefaultBranch(e.target.value)}
                disabled={!canWrite}
              >
                {branchOptions.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="settings-group">
          <div className="settings-group-title">Repository Features</div>
          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Issues</label>
              <div className="settings-sub">Track bugs, tasks, and feature requests.</div>
            </div>
            <div className="settings-control">
              <input
                type="checkbox"
                checked={enableIssues}
                onChange={e => setEnableIssues(e.target.checked)}
                disabled={!canWrite}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Pull Requests</label>
              <div className="settings-sub">Submit and review code contributions.</div>
            </div>
            <div className="settings-control">
              <input
                type="checkbox"
                checked={enablePulls}
                onChange={e => setEnablePulls(e.target.checked)}
                disabled={!canWrite}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Actions / CI Workflows</label>
              <div className="settings-sub">Automated builds and unit test pipelines.</div>
            </div>
            <div className="settings-control">
              <input
                type="checkbox"
                checked={enableActions}
                onChange={e => setEnableActions(e.target.checked)}
                disabled={!canWrite}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">API Marketplace Listing</label>
              <div className="settings-sub">Distribute API primitives on the Klyra Hub.</div>
            </div>
            <div className="settings-control">
              <input
                type="checkbox"
                checked={enableMarketplace}
                onChange={e => setEnableMarketplace(e.target.checked)}
                disabled={!canWrite}
              />
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="settings-group">
          <div className="settings-group-title">Repository Metadata</div>
          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Topics / Tags</label>
              <div className="settings-sub">Comma-separated tags for API discovery.</div>
            </div>
            <div className="settings-control">
              <input
                className="kr-input"
                value={topics}
                onChange={e => setTopics(e.target.value)}
                disabled={!canWrite}
                placeholder="api, payments, nodejs"
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Homepage URL</label>
              <div className="settings-sub">Live URL or documentation landing page.</div>
            </div>
            <div className="settings-control">
              <input
                className="kr-input"
                value={homepage}
                onChange={e => setHomepage(e.target.value)}
                disabled={!canWrite}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Open Source License</label>
              <div className="settings-sub">Legal license governing code usage.</div>
            </div>
            <div className="settings-control">
              <select
                className="kr-select"
                value={license}
                onChange={e => setLicense(e.target.value)}
                disabled={!canWrite}
              >
                <option value="MIT">MIT License</option>
                <option value="Apache-2.0">Apache 2.0</option>
                <option value="GPL-3.0">GNU GPLv3</option>
                <option value="BSD-3-Clause">BSD 3-Clause</option>
                <option value="Unlicense">The Unlicense</option>
              </select>
            </div>
          </div>
        </div>

        {canWrite && (
          <div className="settings-actions">
            <button type="submit" className="kr-btn primary" disabled={saving}>
              <Save size={14} />
              {saving ? 'Saving changes…' : 'Save General Settings'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
