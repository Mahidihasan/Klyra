import React from 'react';
import { Play, Key, Plus, Trash2, CheckCircle2, Lock } from 'lucide-react';
import { RepoDetail } from '../../../types/repos';
import { Modal } from '../shared';

interface Props {
  repo: RepoDetail;
  canWrite: boolean;
}

export const ActionsSettings: React.FC<Props> = ({ repo, canWrite }) => {
  const [secrets, setSecrets] = React.useState<Array<{ name: string; updated_at: string }>>([
    { name: 'PAYMENTS_API_KEY', updated_at: new Date().toISOString() },
    { name: 'WEBHOOK_SIGNING_SECRET', updated_at: new Date().toISOString() },
  ]);

  const [variables, setVariables] = React.useState<Array<{ name: string; value: string }>>([
    { name: 'NODE_ENV', value: 'production' },
    { name: 'API_TIMEOUT_MS', value: '5000' },
  ]);

  const [workflowPermission, setWorkflowPermission] = React.useState('read_write');
  const [showSecretModal, setShowSecretModal] = React.useState(false);
  const [showVarModal, setShowVarModal] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const [newSecretName, setNewSecretName] = React.useState('');
  const [newSecretValue, setNewSecretValue] = React.useState('');

  const [newVarName, setNewVarName] = React.useState('');
  const [newVarValue, setNewVarValue] = React.useState('');

  const handleAddSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecretName.trim() || !newSecretValue.trim()) return;
    const name = newSecretName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    setSecrets(prev => [...prev.filter(s => s.name !== name), { name, updated_at: new Date().toISOString() }]);
    setNewSecretName('');
    setNewSecretValue(''); // CRITICAL: Secret value immediately cleared from memory
    setShowSecretModal(false);
    setMessage(`Secret "${name}" added successfully.`);
  };

  const handleDeleteSecret = (name: string) => {
    if (!window.confirm(`Delete repository secret "${name}"?`)) return;
    setSecrets(prev => prev.filter(s => s.name !== name));
    setMessage(`Secret "${name}" deleted.`);
  };

  const handleAddVariable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarName.trim() || !newVarValue.trim()) return;
    const name = newVarName.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    setVariables(prev => [...prev.filter(v => v.name !== name), { name, value: newVarValue.trim() }]);
    setNewVarName('');
    setNewVarValue('');
    setShowVarModal(false);
    setMessage(`Variable "${name}" added.`);
  };

  const handleDeleteVariable = (name: string) => {
    setVariables(prev => prev.filter(v => v.name !== name));
    setMessage(`Variable "${name}" deleted.`);
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-header">
        <h2>Actions & CI Pipeline Settings</h2>
        <p>Manage workflow permissions, encrypted repository secrets, and environment variables.</p>
      </div>

      {message && (
        <div className="kr-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={15} /> {message}
        </div>
      )}

      {/* Workflow Permissions */}
      <div className="settings-group">
        <div className="settings-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Play size={15} /> Workflow Permissions
        </div>
        <div className="settings-row">
          <div className="settings-info">
            <label className="settings-label">GITHUB_TOKEN Permissions</label>
            <div className="settings-sub">Set default permissions granted to workflow runners.</div>
          </div>
          <div className="settings-control">
            <select
              className="kr-select"
              value={workflowPermission}
              onChange={e => setWorkflowPermission(e.target.value)}
              disabled={!canWrite}
            >
              <option value="read_write">Read and write permissions — Workflows can push commits and tags</option>
              <option value="read_only">Read repository contents permission — Restricted write access</option>
            </select>
          </div>
        </div>
      </div>

      {/* Secrets Management */}
      <div className="settings-group">
        <div className="settings-group-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Key size={15} /> Encrypted Repository Secrets ({secrets.length})
          </span>
          {canWrite && (
            <button
              type="button"
              className="kr-btn primary"
              onClick={() => setShowSecretModal(true)}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              <Plus size={13} /> New repository secret
            </button>
          )}
        </div>

        <div className="repo-dir-table-container">
          {secrets.length === 0 ? (
            <div className="kr-empty" style={{ padding: 24 }}>No encrypted secrets added yet.</div>
          ) : (
            secrets.map(s => (
              <div key={s.name} className="list-row" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Lock size={15} color="var(--accent-purple)" />
                  <div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                    <div className="list-sub">Value hidden for security • Updated {new Date(s.updated_at).toLocaleDateString()}</div>
                  </div>
                </div>

                {canWrite && (
                  <button
                    type="button"
                    className="kr-btn danger"
                    onClick={() => handleDeleteSecret(s.name)}
                    title="Delete secret"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Environment Variables */}
      <div className="settings-group">
        <div className="settings-group-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Repository Variables ({variables.length})</span>
          {canWrite && (
            <button
              type="button"
              className="kr-btn"
              onClick={() => setShowVarModal(true)}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              <Plus size={13} /> New variable
            </button>
          )}
        </div>

        <div className="repo-dir-table-container">
          {variables.map(v => (
            <div key={v.name} className="list-row" style={{ padding: '12px 16px' }}>
              <div>
                <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{v.name}</div>
                <div className="list-sub mono">{v.value}</div>
              </div>

              {canWrite && (
                <button
                  type="button"
                  className="kr-btn danger"
                  onClick={() => handleDeleteVariable(v.name)}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Secret Modal */}
      {showSecretModal && (
        <Modal
          title="New Repository Secret"
          subtitle="Secrets are encrypted in backend vault storage and never exposed in plain text."
          onClose={() => setShowSecretModal(false)}
        >
          <form onSubmit={handleAddSecret}>
            <label className="kr-label">Secret Name</label>
            <input
              className="kr-input mono"
              placeholder="API_KEY_PRODUCTION"
              value={newSecretName}
              onChange={e => setNewSecretName(e.target.value)}
            />

            <label className="kr-label">Secret Value</label>
            <textarea
              className="kr-textarea mono"
              rows={4}
              placeholder="Paste secret value here..."
              value={newSecretValue}
              onChange={e => setNewSecretValue(e.target.value)}
            />

            <div className="modal-actions">
              <button type="button" className="kr-btn" onClick={() => setShowSecretModal(false)}>Cancel</button>
              <button type="submit" className="kr-btn primary" disabled={!newSecretName || !newSecretValue}>
                Add secret
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Variable Modal */}
      {showVarModal && (
        <Modal
          title="New Repository Variable"
          subtitle="Variables are accessible to workflows in non-sensitive tasks."
          onClose={() => setShowVarModal(false)}
        >
          <form onSubmit={handleAddVariable}>
            <label className="kr-label">Variable Name</label>
            <input
              className="kr-input mono"
              placeholder="VAR_NAME"
              value={newVarName}
              onChange={e => setNewVarName(e.target.value)}
            />

            <label className="kr-label">Value</label>
            <input
              className="kr-input mono"
              placeholder="value"
              value={newVarValue}
              onChange={e => setNewVarValue(e.target.value)}
            />

            <div className="modal-actions">
              <button type="button" className="kr-btn" onClick={() => setShowVarModal(false)}>Cancel</button>
              <button type="submit" className="kr-btn primary" disabled={!newVarName || !newVarValue}>
                Add variable
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
