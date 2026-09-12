import React, { useState } from 'react';
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react';

import { AdminUserRow } from '../../types/adminUsers';
import { RoleBadge, UserAvatar } from './UserBadges';

interface Props {
  user: AdminUserRow;
  isSaving: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeleteUserModal: React.FC<Props> = ({
  user,
  isSaving,
  error,
  onConfirm,
  onClose,
}) => {
  const [confirmationText, setConfirmationText] = useState('');
  
  // They can type either 'DELETE' or the user's email/id to confirm
  const isConfirmed = confirmationText === 'DELETE' || confirmationText === user.email;

  return (
    <div className="au-modal-overlay" role="presentation" onClick={isSaving ? undefined : onClose}>
      <div
        className="au-modal max-w-md w-full"
        role="dialog"
        aria-modal="true"
        aria-label="Delete User"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="au-modal-title text-red-500 flex items-center gap-2">
          <ShieldAlert size={20} />
          Delete Account
        </h2>
        
        <div className="au-modal-subject my-4">
          <UserAvatar user={user} size={36} />
          <div>
            <p className="au-modal-subject-name">{user.name || 'Unnamed account'}</p>
            <p className="au-modal-subject-email">{user.email}</p>
          </div>
          <RoleBadge role={user.role} />
        </div>

        <div className="mb-6 space-y-4">
          <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-4 text-sm text-red-200">
            <h4 className="font-semibold text-red-400 mb-2">Warning: This action is destructive.</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>All active API keys will be immediately revoked.</li>
              <li>All active API subscriptions will be cancelled.</li>
              <li>Published APIs will be soft-deleted.</li>
              <li>The account will be disabled and unable to log in.</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm text-slate-300">
              Please type <strong>DELETE</strong> or <strong>{user.email}</strong> to confirm.
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              disabled={isSaving}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-red-500"
              placeholder="Confirm deletion"
            />
          </div>
        </div>

        {error && (
          <div className="au-inline-error mb-4">
            <AlertTriangle size={15} aria-hidden="true" />
            <p>{error}</p>
          </div>
        )}

        <footer className="au-modal-foot pt-4 border-t border-slate-800">
          <button type="button" className="au-ghost-btn" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            type="button"
            className="au-primary-btn bg-red-600 hover:bg-red-500 text-white disabled:bg-slate-700 disabled:text-slate-500"
            onClick={onConfirm}
            disabled={!isConfirmed || isSaving}
          >
            {isSaving && <Loader2 size={14} className="au-spin" aria-hidden="true" />}
            Delete Account
          </button>
        </footer>
      </div>
    </div>
  );
};
