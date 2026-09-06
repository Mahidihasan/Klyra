import React from 'react';
import { GitPullRequest, Save, CheckCircle2 } from 'lucide-react';
import { RepoDetail } from '../../../types/repos';

interface Props {
  repo: RepoDetail;
  canWrite: boolean;
}

export const PullRequestSettings: React.FC<Props> = ({ repo, canWrite }) => {
  const [mergeStrategy, setMergeStrategy] = React.useState('squash');
  const [autoDeleteBranch, setAutoDeleteBranch] = React.useState(true);
  const [requireResolution, setRequireResolution] = React.useState(true);
  const [dismissStale, setDismissStale] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess('');
    setTimeout(() => {
      setSaving(false);
      setSuccess('Pull request configuration updated.');
    }, 400);
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-header">
        <h2>Pull Request Settings</h2>
        <p>Configure merge strategies, review policies, and branch cleanup for pull requests.</p>
      </div>

      {success && (
        <div className="kr-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={15} /> {success}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Merge Strategies */}
        <div className="settings-group">
          <div className="settings-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <GitPullRequest size={15} /> Allowed Merge Strategies
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Default Merge Strategy</label>
              <div className="settings-sub">Selected strategy for merging PRs into protected target branches.</div>
            </div>
            <div className="settings-control">
              <select
                className="kr-select"
                value={mergeStrategy}
                onChange={e => setMergeStrategy(e.target.value)}
                disabled={!canWrite}
              >
                <option value="squash">Squash and merge — Combine all commits into a single commit</option>
                <option value="merge_commit">Merge commit — Preserve full commit history</option>
                <option value="rebase">Rebase and merge — Rebase commits onto base branch</option>
              </select>
            </div>
          </div>
        </div>

        {/* PR Policies */}
        <div className="settings-group">
          <div className="settings-group-title">Pull Request Policies</div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Automatically delete head branches</label>
              <div className="settings-sub">Deleted merged source branches automatically after PR completion.</div>
            </div>
            <div className="settings-control">
              <input
                type="checkbox"
                checked={autoDeleteBranch}
                onChange={e => setAutoDeleteBranch(e.target.checked)}
                disabled={!canWrite}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Require conversation resolution</label>
              <div className="settings-sub">All inline code comments and threads must be resolved before merging.</div>
            </div>
            <div className="settings-control">
              <input
                type="checkbox"
                checked={requireResolution}
                onChange={e => setRequireResolution(e.target.checked)}
                disabled={!canWrite}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Dismiss stale pull request approvals</label>
              <div className="settings-sub">New commits automatically reset approval status requiring re-review.</div>
            </div>
            <div className="settings-control">
              <input
                type="checkbox"
                checked={dismissStale}
                onChange={e => setDismissStale(e.target.checked)}
                disabled={!canWrite}
              />
            </div>
          </div>
        </div>

        {canWrite && (
          <div className="settings-actions">
            <button type="submit" className="kr-btn primary" disabled={saving}>
              <Save size={14} />
              {saving ? 'Saving PR settings…' : 'Save PR Settings'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
