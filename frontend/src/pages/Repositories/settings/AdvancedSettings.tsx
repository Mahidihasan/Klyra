import React from 'react';
import { AlertTriangle, Trash2, ArrowRightLeft, Archive } from 'lucide-react';
import { reposApi } from '../../../services/api/repos';
import { RepoDetail } from '../../../types/repos';
import { Modal } from '../shared';

interface Props {
  repo: RepoDetail;
  isOwner: boolean;
  onBack: () => void;
}

export const AdvancedSettings: React.FC<Props> = ({ repo, isOwner, onBack }) => {
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showTransferModal, setShowTransferModal] = React.useState(false);
  const [confirmNameInput, setConfirmNameInput] = React.useState('');
  const [transferTarget, setTransferTarget] = React.useState('');
  const [error, setError] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (confirmNameInput !== repo.name || deleting) return;
    setDeleting(true);
    setError('');

    try {
      await reposApi.remove(repo.id);
      setShowDeleteModal(false);
      onBack();
    } catch (err: any) {
      setError(err.message || 'Failed to delete repository.');
      setDeleting(false);
    }
  };

  const handleArchive = () => {
    if (window.confirm(`Archive "${repo.name}"? An archived repository becomes read-only for all users.`)) {
      alert(`Repository "${repo.name}" has been archived.`);
    }
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTarget.trim()) return;
    if (window.confirm(`Transfer ownership of "${repo.name}" to @${transferTarget.trim()}?`)) {
      alert(`Ownership transfer requested for @${transferTarget.trim()}`);
      setShowTransferModal(false);
    }
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-header">
        <h2>Advanced & Danger Zone Settings</h2>
        <p>Perform irreversible administrative operations on this repository.</p>
      </div>

      {error && <div className="kr-error">{error}</div>}

      {/* Danger Zone Banner */}
      <div className="secret-banner alert" style={{ border: '1px solid rgba(239, 68, 68, 0.4)' }}>
        <h4 style={{ color: '#f87171', margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={18} /> Danger Zone
        </h4>

        {/* Archive Repository */}
        <div className="settings-row" style={{ borderBottom: '1px solid rgba(239,68,68,0.2)', paddingBottom: 12 }}>
          <div className="settings-info">
            <label className="settings-label" style={{ color: 'var(--text-primary)' }}>Archive Repository</label>
            <div className="settings-sub">Mark this repository as read-only. Users can still inspect and clone code.</div>
          </div>
          <div className="settings-control">
            <button
              type="button"
              className="kr-btn danger"
              onClick={handleArchive}
              disabled={!isOwner}
            >
              <Archive size={13} /> Archive repository
            </button>
          </div>
        </div>

        {/* Transfer Ownership */}
        <div className="settings-row" style={{ borderBottom: '1px solid rgba(239,68,68,0.2)', padding: '12px 0' }}>
          <div className="settings-info">
            <label className="settings-label" style={{ color: 'var(--text-primary)' }}>Transfer Ownership</label>
            <div className="settings-sub">Transfer this repository to another Klyra user or organization account.</div>
          </div>
          <div className="settings-control">
            <button
              type="button"
              className="kr-btn danger"
              onClick={() => setShowTransferModal(true)}
              disabled={!isOwner}
            >
              <ArrowRightLeft size={13} /> Transfer repository
            </button>
          </div>
        </div>

        {/* Delete Repository */}
        <div className="settings-row" style={{ paddingTop: 12 }}>
          <div className="settings-info">
            <label className="settings-label" style={{ color: '#f87171' }}>Delete Repository</label>
            <div className="settings-sub">
              Permanently delete this repository and all commits, branches, issues, and pull requests. <b>This action cannot be undone.</b>
            </div>
          </div>
          <div className="settings-control">
            <button
              type="button"
              className="kr-btn danger"
              style={{ background: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.5)', color: '#f87171' }}
              onClick={() => setShowDeleteModal(true)}
              disabled={!isOwner}
            >
              <Trash2 size={13} /> Delete this repository
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Modal
          title={`Delete Repository "${repo.name}"`}
          subtitle="This action is permanent and irreversible."
          onClose={() => setShowDeleteModal(false)}
        >
          <div className="kr-error mt8">
            <b>Warning:</b> You are about to permanently delete <b>{repo.owner_username}/{repo.name}</b> along with all code, branches, issues, and pull requests.
          </div>

          <label className="kr-label" style={{ marginTop: 14 }}>
            To confirm deletion, type <code style={{ color: '#f87171' }}>{repo.name}</code> below:
          </label>
          <input
            className="kr-input mono"
            value={confirmNameInput}
            onChange={e => setConfirmNameInput(e.target.value)}
            placeholder={repo.name}
          />

          <div className="modal-actions" style={{ marginTop: 16 }}>
            <button type="button" className="kr-btn" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="kr-btn danger"
              style={{ background: '#ef4444', color: '#fff', border: 'none' }}
              disabled={confirmNameInput !== repo.name || deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deleting repository…' : 'I understand the consequences, delete this repository'}
            </button>
          </div>
        </Modal>
      )}

      {/* Transfer Confirmation Modal */}
      {showTransferModal && (
        <Modal
          title="Transfer Repository Ownership"
          subtitle="Transfer repository administration rights to another Klyra account."
          onClose={() => setShowTransferModal(false)}
        >
          <form onSubmit={handleTransfer}>
            <label className="kr-label">Target Owner Username</label>
            <input
              className="kr-input"
              placeholder="new-owner-username"
              value={transferTarget}
              onChange={e => setTransferTarget(e.target.value)}
            />

            <div className="modal-actions">
              <button type="button" className="kr-btn" onClick={() => setShowTransferModal(false)}>
                Cancel
              </button>
              <button type="submit" className="kr-btn primary" disabled={!transferTarget.trim()}>
                Initiate Transfer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
