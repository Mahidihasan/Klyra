/**
 * Change-role modal.
 *
 * Spells out the consequence of the selected role before the confirm button is
 * live, because "Provider" and "Admin" look equally harmless in a dropdown and
 * only one of them hands over the keys to the platform.
 */

import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

import {
  AdminUserRow,
  canChangeRole,
  ROLE_FILTER_OPTIONS,
  ROLE_LABELS,
  UserRoleValue,
  ViewerIdentity,
} from '../../types/adminUsers';

import { RoleBadge, UserAvatar } from './UserBadges';

/** What each role actually grants, in one line, shown under the picker. */
const ROLE_CONSEQUENCE: Record<UserRoleValue, string> = {
  USER: 'Can browse and subscribe to APIs. No publishing rights.',
  PROVIDER: 'Can publish and manage their own APIs, and see their subscriber analytics.',
  MODERATOR: 'Read-only access to every admin screen. Cannot modify accounts.',
  ADMIN: 'Full control of the platform, including other admins and every account.',
};

interface Props {
  user: AdminUserRow;
  viewer: ViewerIdentity;
  isSaving: boolean;
  error: string | null;
  onConfirm: (role: UserRoleValue) => void;
  onClose: () => void;
}

export const ChangeRoleModal: React.FC<Props> = ({
  user,
  viewer,
  isSaving,
  error,
  onConfirm,
  onClose,
}) => {
  const [role, setRole] = useState<UserRoleValue>(user.role);

  const guard = canChangeRole(viewer, user);
  const isUnchanged = role === user.role;
  const isEscalation = role === 'ADMIN' && user.role !== 'ADMIN';
  const isSelfDemotionRisk = user.role === 'ADMIN' && role !== 'ADMIN';

  return (
    <div className="au-modal-overlay" role="presentation" onClick={isSaving ? undefined : onClose}>
      <div
        className="au-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Change role"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="au-modal-title">Change role</h2>

        <div className="au-modal-subject">
          <UserAvatar user={user} size={36} />
          <div>
            <p className="au-modal-subject-name">{user.name || 'Unnamed account'}</p>
            <p className="au-modal-subject-email">{user.email}</p>
          </div>
          <RoleBadge role={user.role} />
        </div>

        <fieldset className="au-role-picker" disabled={!guard.allowed || isSaving}>
          <legend className="au-sr-only">New role</legend>
          {ROLE_FILTER_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={role === option.id ? 'au-role-option selected' : 'au-role-option'}
            >
              <input
                type="radio"
                name="au-role"
                value={option.id}
                checked={role === option.id}
                onChange={() => setRole(option.id)}
              />
              <span className="au-role-option-body">
                <span className="au-role-option-label">
                  {option.label}
                  {option.id === user.role && <span className="au-role-current">Current</span>}
                </span>
                <span className="au-role-option-hint">{ROLE_CONSEQUENCE[option.id]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {isEscalation && (
          <div className="au-inline-warning">
            <AlertTriangle size={15} aria-hidden="true" />
            <p>
              This grants full platform control, including the ability to change your own account.
              Admin accounts also cannot be suspended until they are demoted again.
            </p>
          </div>
        )}

        {isSelfDemotionRisk && (
          <div className="au-inline-warning">
            <AlertTriangle size={15} aria-hidden="true" />
            <p>
              Removing the last active admin is refused by the server, so this may fail if no other
              admin remains.
            </p>
          </div>
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
            className="au-primary-btn"
            disabled={!guard.allowed || isUnchanged || isSaving}
            onClick={() => onConfirm(role)}
          >
            {isSaving && <Loader2 size={14} className="au-spin" aria-hidden="true" />}
            {isUnchanged ? 'No change' : `Make ${ROLE_LABELS[role]}`}
          </button>
        </footer>
      </div>
    </div>
  );
};
