import React from 'react';
import { GitBranch, Shield, ShieldOff, Plus, CheckCircle2, Lock } from 'lucide-react';
import { gitApi } from '../../../services/api/repos';
import { RepoDetail, BranchInfo } from '../../../types/repos';
import { Loading, ErrorBox, Modal } from '../shared';

interface Props {
  repo: RepoDetail;
  isOwner: boolean;
  canWrite: boolean;
  onChanged: () => void;
}

export const BranchSettings: React.FC<Props> = ({ repo, isOwner, canWrite, onChanged }) => {
  const [branches, setBranches] = React.useState<BranchInfo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [showRuleModal, setShowRuleModal] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setBranches(await gitApi.branches(repo.id)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  const handleToggleProtection = async (branchName: string) => {
    if (!isOwner) return;
    setError(''); setMessage('');
    try {
      await gitApi.toggleProtection(repo.id, branchName);
      setMessage(`Protection settings updated for branch "${branchName}".`);
      load();
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to update branch protection.');
    }
  };

  if (loading) return <Loading label="Loading branch settings…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div className="settings-section-container">
      <div className="settings-section-header">
        <h2>Branch Settings & Protection Rules</h2>
        <p>Define default branches and enforce branch protection policies for workflow compliance.</p>
      </div>

      {message && (
        <div className="kr-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={15} /> {message}
        </div>
      )}
      {error && <div className="kr-error">{error}</div>}

      {/* Default Branch Card */}
      <div className="settings-group">
        <div className="settings-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <GitBranch size={15} /> Default Branch
        </div>
        <div className="settings-row">
          <div className="settings-info">
            <label className="settings-label">Current Default Branch</label>
            <div className="settings-sub">
              Primary target branch for git clones, commits, and pull requests: <b className="mono">{repo.default_branch}</b>
            </div>
          </div>
          <div className="settings-control">
            <span className="branch-tag" style={{ fontSize: 13, padding: '4px 10px' }}>
              <Shield size={12} color="#4ade80" /> {repo.default_branch}
            </span>
          </div>
        </div>
      </div>

      {/* Protected Branches Rules */}
      <div className="settings-group">
        <div className="settings-group-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Lock size={15} /> Protected Branch Rules ({branches.filter(b => b.protected || b.name === repo.default_branch).length})
          </span>
          {isOwner && (
            <button
              type="button"
              className="kr-btn primary"
              onClick={() => setShowRuleModal(true)}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              <Plus size={13} /> Add protection rule
            </button>
          )}
        </div>

        <div className="repo-dir-table-container">
          {branches.map(b => {
            const isDefault = b.name === repo.default_branch;
            const isProtected = b.protected || isDefault;

            return (
              <div key={b.name} className="list-row" style={{ padding: '12px 16px', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="branch-tag" style={{ fontSize: 12.5 }}>
                      {isProtected && <Shield size={12} color="#4ade80" />}
                      {b.name}
                    </span>
                    {isDefault && <span className="status-pill neutral">Default</span>}
                  </div>

                  {isOwner && !isDefault && (
                    <button
                      type="button"
                      className="kr-btn"
                      onClick={() => handleToggleProtection(b.name)}
                    >
                      {b.protected ? <ShieldOff size={13} /> : <Shield size={13} />}
                      {b.protected ? 'Disable protection' : 'Enable protection'}
                    </button>
                  )}
                </div>

                {isProtected && (
                  <div className="branch-rule-badges" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--text-muted)' }}>
                    <span className="status-pill accent">PR Required</span>
                    <span className="status-pill accent">1 Review Approval</span>
                    <span className="status-pill accent">Status Checks Required</span>
                    <span className="status-pill neutral">Force Push Disabled</span>
                    <span className="status-pill neutral">Deletion Disabled</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showRuleModal && (
        <Modal
          title="Add Branch Protection Rule"
          subtitle="Specify branch pattern rules to prevent force pushes, require reviews, and enforce CI checks."
          onClose={() => setShowRuleModal(false)}
        >
          <label className="kr-label">Branch name pattern</label>
          <input className="kr-input" placeholder="e.g. main or release/*" defaultValue="release/*" />

          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-primary)' }}>
              <input type="checkbox" defaultChecked /> Require a pull request before merging
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-primary)' }}>
              <input type="checkbox" defaultChecked /> Require 1 review approval
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-primary)' }}>
              <input type="checkbox" defaultChecked /> Require status checks to pass before merging
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-primary)' }}>
              <input type="checkbox" defaultChecked /> Block force pushes and branch deletions
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="kr-btn" onClick={() => setShowRuleModal(false)}>Cancel</button>
            <button type="button" className="kr-btn primary" onClick={() => { setShowRuleModal(false); setMessage('Branch protection rule created.'); }}>
              Create protection rule
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
