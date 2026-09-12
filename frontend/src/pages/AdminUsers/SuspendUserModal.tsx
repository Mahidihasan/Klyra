import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

import { AdminUserRow } from '../../types/adminUsers';
import { RoleBadge, UserAvatar } from './UserBadges';

interface Props {
  user: AdminUserRow;
  isSaving: boolean;
  error: string | null;
  onSuspend: (reason: string, duration: string) => void;
  onActivate: () => void;
  onClose: () => void;
}

export const SuspendUserModal: React.FC<Props> = ({
  user,
  isSaving,
  error,
  onSuspend,
  onActivate,
  onClose,
}) => {
  const [reason, setReason] = useState<string>('Violation of Terms');
  const [duration, setDuration] = useState<string>('indefinite');

  const isSuspended = user.status === 'SUSPENDED';

  const handleConfirm = () => {
    if (isSuspended) {
      onActivate();
    } else {
      onSuspend(reason, duration);
    }
  };

  return (
    <div className="au-modal-overlay" role="presentation" onClick={isSaving ? undefined : onClose}>
      <div
        className="au-modal max-w-md w-full"
        role="dialog"
        aria-modal="true"
        aria-label={isSuspended ? 'Reactivate User' : 'Suspend User'}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="au-modal-title">{isSuspended ? 'Reactivate Account' : 'Suspend Account'}</h2>
        
        <div className="au-modal-subject my-4">
          <UserAvatar user={user} size={36} />
          <div>
            <p className="au-modal-subject-name">{user.name || 'Unnamed account'}</p>
            <p className="au-modal-subject-email">{user.email}</p>
          </div>
          <RoleBadge role={user.role} />
        </div>

        {isSuspended ? (
          <div className="mb-6">
            <p className="text-slate-300 text-sm mb-4">
              This account is currently suspended. Reactivating will restore their access to the platform and their active APIs immediately.
            </p>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            <p className="text-slate-300 text-sm">
              Suspending an account will immediately invalidate their sessions and prevent them from logging in or using the platform.
            </p>
            
            <div className="space-y-1">
              <label className="text-sm text-slate-300 font-medium">Reason for Suspension</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSaving}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="Violation of Terms">Violation of Terms</option>
                <option value="Suspicious Traffic">Suspicious Traffic</option>
                <option value="Non-payment">Non-payment</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-slate-300 font-medium">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                disabled={isSaving}
                className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="indefinite">Indefinite (Manual Reactivation required)</option>
                <option value="7_days">7 Days</option>
                <option value="30_days">30 Days</option>
              </select>
            </div>
          </div>
        )}

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
            className={isSuspended ? "au-primary-btn bg-emerald-600 hover:bg-emerald-500 text-white" : "au-primary-btn bg-amber-600 hover:bg-amber-500 text-white"}
            onClick={handleConfirm}
            disabled={isSaving}
          >
            {isSaving && <Loader2 size={14} className="au-spin" aria-hidden="true" />}
            {isSuspended ? 'Reactivate Account' : 'Suspend Account'}
          </button>
        </footer>
      </div>
    </div>
  );
};
