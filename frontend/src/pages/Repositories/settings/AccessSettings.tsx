import React from 'react';
import { Users, UserPlus, Trash2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { collaboratorsApi } from '../../../services/api/repos';
import { RepoDetail, Collaborator } from '../../../types/repos';
import { Avatar, Loading, ErrorBox } from '../shared';

interface Props {
  repo: RepoDetail;
  isOwner: boolean;
  canManage: boolean;
  onChanged: () => void;
}

export const AccessSettings: React.FC<Props> = ({ repo, isOwner, canManage, onChanged }) => {
  const [rows, setRows] = React.useState<Collaborator[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [role, setRole] = React.useState('developer');
  const [message, setMessage] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await collaboratorsApi.list(repo.id)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [repo.id]);

  React.useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || submitting) return;
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      await collaboratorsApi.add(repo.id, username.trim(), role);
      setUsername('');
      setMessage(`Successfully added @${username.trim()} with ${role} permissions.`);
      load();
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to add collaborator.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeRole = async (targetUsername: string, newRole: string) => {
    setError('');
    setMessage('');
    try {
      await collaboratorsApi.add(repo.id, targetUsername, newRole);
      setMessage(`Updated @${targetUsername}'s role to ${newRole}.`);
      load();
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to update role.');
    }
  };

  const handleRemove = async (targetUsername: string) => {
    if (!window.confirm(`Are you sure you want to revoke @${targetUsername}'s access to ${repo.name}?`)) {
      return;
    }
    setError('');
    setMessage('');
    try {
      await collaboratorsApi.remove(repo.id, targetUsername);
      setMessage(`Revoked access for @${targetUsername}.`);
      load();
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to remove collaborator.');
    }
  };

  if (loading) return <Loading label="Loading access permissions…" />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  return (
    <div className="settings-section-container">
      <div className="settings-section-header">
        <h2>Access & Permissions</h2>
        <p>Manage team member access and permission roles for this repository.</p>
      </div>

      {message && (
        <div className="kr-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={15} /> {message}
        </div>
      )}
      {error && <div className="kr-error">{error}</div>}

      {/* Invite Form */}
      {canManage && (
        <form className="settings-group" onSubmit={handleAdd}>
          <div className="settings-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserPlus size={15} /> Add Team Collaborator
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">User Identifier</label>
              <div className="settings-sub">Enter the Klyra username or registered email.</div>
            </div>
            <div className="settings-control">
              <input
                className="kr-input"
                placeholder="username or email"
                value={username}
                onChange={e => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Permission Role</label>
              <div className="settings-sub">Determines push, review, merge, and admin capabilities.</div>
            </div>
            <div className="settings-control">
              <select className="kr-select" value={role} onChange={e => setRole(e.target.value)}>
                <option value="maintainer">Maintainer — Full write, merge, and branch management</option>
                <option value="developer">Developer — Read/Write push access, PR creation</option>
                <option value="reviewer">Reviewer — Read access, code review capabilities</option>
              </select>
            </div>
          </div>

          <div className="settings-actions">
            <button type="submit" className="kr-btn primary" disabled={!username.trim() || submitting}>
              {submitting ? 'Granting access…' : 'Add Collaborator'}
            </button>
          </div>
        </form>
      )}

      {/* Active Collaborators List */}
      <div className="settings-group">
        <div className="settings-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={15} /> Current Collaborators ({rows.length})
        </div>

        <div className="repo-dir-table-container">
          {rows.map(collab => (
            <div key={collab.user_id} className="list-row" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar name={collab.display_name || collab.username} color={collab.avatar_color} size={32} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                    {collab.display_name || collab.username}
                  </div>
                  <div className="list-sub">@{collab.username}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {collab.role === 'owner' ? (
                  <span className="role-badge owner">Owner</span>
                ) : canManage ? (
                  <select
                    className="kr-select"
                    style={{ width: 140, padding: '4px 8px', fontSize: 12 }}
                    value={collab.role}
                    onChange={e => handleChangeRole(collab.username, e.target.value)}
                  >
                    <option value="maintainer">Maintainer</option>
                    <option value="developer">Developer</option>
                    <option value="reviewer">Reviewer</option>
                  </select>
                ) : (
                  <span className={`role-badge ${collab.role}`}>{collab.role}</span>
                )}

                {collab.role !== 'owner' && canManage && (
                  <button
                    type="button"
                    className="kr-btn danger"
                    onClick={() => handleRemove(collab.username)}
                    title="Revoke access"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
