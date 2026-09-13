/**
 * Confirmation dialog for suspend / ban / reactivate.
 *
 * Banning asks for the account's email to be typed out. It is the one action
 * here that is meant to be permanent, and it sits one row away from "Suspend"
 * in the same menu — the friction is there to make a misclick impossible to
 * complete by reflex.
 */

import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

import {
  AdminUserRow,
  canChangeStatus,
  UserStatusValue,
  ViewerIdentity,
} from '../../types/adminUsers';

import { StatusBadge, UserAvatar } from './UserBadges';

/** Reasons are stored on the audit row; the column is generous but not endless. */
const MAX_REASON_LENGTH = 500;

interface Copy {
  title: string;
  body: string;
  confirmLabel: string;
  isDestructive: boolean;
  requiresTypedEmail: boolean;
}

const COPY: Record<UserStatusValue, Copy> = {
  ACTIVE: {
    title: 'Reactivate account',
    body: 'The account regains access immediately. Any APIs it owns become reachable again.',
    confirmLabel: 'Reactivate',
    isDestructive: false,
    requiresTypedEmail: false,
  },
  INACTIVE: {
    title: 'Deactivate account',
    body: 'The account is marked inactive and can no longer sign in. This is reversible.',
    confirmLabel: 'Deactivate',
    isDestructive: true,
    requiresTypedEmail: false,
  },
  SUSPENDED: {
    title: 'Suspend account',
    body:
      'Sign-in is blocked and the account’s APIs stop serving traffic. Subscriptions are ' +
      'kept, so reactivating restores everything as it was.',
    confirmLabel: 'Suspend',
    isDestructive: true,
    requiresTypedEmail: false,
  },
  BANNED: {
    title: 'Ban account permanently',
    body:
      'A ban is intended to be final: the account is locked out, its APIs are pulled, and ' +
      'reinstating it is a manual job. Suspend instead if you might change your mind.',
    confirmLabel: 'Ban permanently',
    isDestructive: true,
    requiresTypedEmail: true,
  },
};

interface Props {
  user: AdminUserRow;
  viewer: ViewerIdentity;
  nextStatus: UserStatusValue;
  isSaving: boolean;
  error: string | null;
  onConfirm: (status: UserStatusValue, reason: string) => void;
  onClose: () => void;
}

export const ConfirmActionDialog: React.FC<Props> = ({
  user,
  viewer,
  nextStatus,
  isSaving,
  error,
  onConfirm,
  onClose,
}) => {
  const [reason, setReason] = useState('');
  const [typedEmail, setTypedEmail] = useState('');

  const copy = COPY[nextStatus];
  const guard = canChangeStatus(viewer, user, nextStatus);

  const emailMatches =
    !copy.requiresTypedEmail || typedEmail.trim().toLowerCase() === user.email.toLowerCase();
  const canSubmit = guard.allowed && emailMatches && !isSaving;

  return (
    <div className="au-modal-overlay" role="presentation" onClick={isSaving ? undefined : onClose}>
      <div
        className="au-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={copy.title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="au-modal-title" data-destructive={copy.isDestructive ? 'true' : undefined}>
          {copy.title}
        </h2>

        <div className="au-modal-subject">
          <UserAvatar user={user} size={36} />
          <div>
            <p className="au-modal-subject-name">{user.name || 'Unnamed account'}</p>
            <p className="au-modal-subject-email">{user.email}</p>
          </div>
          <StatusBadge status={user.status} />
        </div>

        <p className="au-modal-body">{copy.body}</p>

        <label className="au-field">
          <span className="au-field-label">
            Reason <span className="au-field-optional">(saved to the audit log)</span>
          </span>
          <textarea
            className="au-textarea"
            rows={3}
            value={reason}
            maxLength={MAX_REASON_LENGTH}
            disabled={!guard.allowed || isSaving}
            placeholder="e.g. Repeated abuse reports on the Payments API"
            onChange={(event) => setReason(event.target.value)}
          />
          <span className="au-field-count">
            {reason.length}/{MAX_REASON_LENGTH}
          </span>
        </label>

        {copy.requiresTypedEmail && (
          <label className="au-field">
            <span className="au-field-label">
              Type <code className="au-mono">{user.email}</code> to confirm
            </span>
            <input
              type="text"
              className="au-input"
              value={typedEmail}
              autoComplete="off"
              spellCheck={false}
              disabled={!guard.allowed || isSaving}
              onChange={(event) => setTypedEmail(event.target.value)}
            />
          </label>
        )}

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
            className={copy.isDestructive ? 'au-danger-btn' : 'au-primary-btn'}
            disabled={!canSubmit}
            onClick={() => onConfirm(nextStatus, reason.trim())}
          >
            {isSaving && <Loader2 size={14} className="au-spin" aria-hidden="true" />}
            {copy.confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
};
