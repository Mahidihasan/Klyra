/**
 * Impersonation confirmation.
 *
 * Separate from the suspend/ban dialog because the thing being confirmed is
 * different in kind: nothing happens to the target account, but everything the
 * admin does next is recorded against it. The dialog's job is to make that
 * trade explicit before the token exists.
 */

import React from 'react';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';

import { AdminUserRow, canImpersonate, ViewerIdentity } from '../../types/adminUsers';

import { RoleBadge, UserAvatar } from './UserBadges';

interface Props {
  user: AdminUserRow;
  viewer: ViewerIdentity;
  isSaving: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export const ImpersonateDialog: React.FC<Props> = ({
  user,
  viewer,
  isSaving,
  error,
  onConfirm,
  onClose,
}) => {
  const guard = canImpersonate(viewer, user);

  return (
    <div className="au-modal-overlay" role="presentation" onClick={isSaving ? undefined : onClose}>
      <div
        className="au-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label="Impersonate user"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="au-modal-title">Impersonate user</h2>

        <div className="au-modal-subject">
          <UserAvatar user={user} size={36} />
          <div>
            <p className="au-modal-subject-name">{user.name || 'Unnamed account'}</p>
            <p className="au-modal-subject-email">{user.email}</p>
          </div>
          <RoleBadge role={user.role} />
        </div>

        <p className="au-modal-body">
          You will be signed in as this user for ten minutes. Klyra reloads into their account, and
          your own session is restored when you exit or the time runs out.
        </p>

        <ul className="au-modal-points">
          <li>Anything you do is performed by this account and attributed to it.</li>
          <li>The impersonation itself is written to the audit log against your name.</li>
          <li>Admin actions are blocked while impersonating, even if you open them directly.</li>
        </ul>

        {!guard.allowed && (
          <div className="au-inline-error">
            <AlertTriangle size={15} aria-hidden="true" />
            <p>{guard.reason}</p>
          </div>
        )}

        {error && (
          <div className="au-inline-error">
            <AlertTriangle size={15} aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        <footer className="au-modal-foot">
          <button type="button" className="au-ghost-btn" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className="au-primary-btn"
            disabled={!guard.allowed || isSaving}
            onClick={onConfirm}
          >
            {isSaving ? (
              <Loader2 size={14} className="au-spin" aria-hidden="true" />
            ) : (
              <ShieldAlert size={14} aria-hidden="true" />
            )}
            Continue as {user.name || user.email}
          </button>
        </footer>
      </div>
    </div>
  );
};
