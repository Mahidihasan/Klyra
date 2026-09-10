/**
 * User profile drawer.
 *
 * Fetches the full profile on open rather than reusing the table row: the row
 * is a page of a cached list and may be seconds or minutes old, and the drawer
 * is where someone decides whether to suspend an account. It shows the row's
 * data immediately as a placeholder so the panel never opens empty, then
 * replaces it with the authoritative record.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, X } from 'lucide-react';

import { adminApi } from '../../services/api/admin';
import { AdminUserProfile, AdminUserRow, ViewerIdentity } from '../../types/adminUsers';

import { formatFullTimestamp, formatJoinedDate, humaniseAuditAction } from './format';
import { CountPair, RoleBadge, StatusBadge, UserAvatar } from './UserBadges';
import { UserAction, UserActionMenu } from './UserActionMenu';

interface Props {
  user: AdminUserRow;
  viewer: ViewerIdentity;
  /**
   * Bumped by the page after a mutation. The drawer would otherwise only
   * refetch when the id changes, leaving it showing the role or status the
   * account had before the change made from inside this very panel.
   */
  reloadToken: number;
  onAction: (action: UserAction, user: AdminUserRow) => void;
  onClose: () => void;
}

export const UserProfileDrawer: React.FC<Props> = ({
  user,
  viewer,
  reloadToken,
  onAction,
  onClose,
}) => {
  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setProfile(null);
    setError(null);

    adminApi
      .getUser(user.id, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setProfile(data);
      })
      .catch((err: Error) => {
        if (controller.signal.aborted || err.name === 'AbortError') return;
        setError(err.message);
      });

    return () => controller.abort();
  }, [user.id, reloadToken]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Fall back to the row while the request is in flight, so the header, badges
  // and counts are populated from the first frame.
  const shown: AdminUserRow = profile ?? user;

  return (
    <div className="au-drawer-overlay" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className="au-drawer au-profile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Profile: ${shown.name}`}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="au-drawer-head">
          <div className="au-profile-identity">
            <UserAvatar user={shown} size={44} />
            <div>
              <h2>{shown.name || 'Unnamed account'}</h2>
              <p className="au-profile-email">{shown.email}</p>
            </div>
          </div>
          <div className="au-profile-head-actions">
            <UserActionMenu user={shown} viewer={viewer} onAction={onAction} />
            <button
              type="button"
              className="au-icon-btn"
              onClick={onClose}
              aria-label="Close profile"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="au-drawer-body">
          <div className="au-profile-badges">
            <RoleBadge role={shown.role} />
            <StatusBadge
              status={shown.status}
              isPendingVerification={shown.isPendingVerification}
            />
          </div>

          {error && (
            <div className="au-inline-error">
              <AlertTriangle size={15} aria-hidden="true" />
              <p>
                Couldn&apos;t load the full profile ({error}). The summary below is from the table
                row and may be out of date.
              </p>
            </div>
          )}

          {profile?.source === 'mock' && (
            <div className="au-inline-warning">
              <AlertTriangle size={15} aria-hidden="true" />
              <p>Live data is unavailable, so this profile is sample data.</p>
            </div>
          )}

          <dl className="au-facts">
            <Fact label="User ID" value={<code className="au-mono">{shown.id}</code>} />
            <Fact label="Joined" value={formatJoinedDate(shown.joinedAt)} />
            <Fact label="Last sign-in" value={formatFullTimestamp(shown.lastLoginAt)} />
            <Fact
              label="APIs owned / subscribed"
              value={<CountPair owned={shown.apisOwned} subscribed={shown.apisSubscribed} />}
            />
            <Fact
              label="Email verified"
              value={
                profile
                  ? formatFullTimestamp(profile.emailVerifiedAt)
                  : shown.isPendingVerification
                  ? 'No'
                  : 'Yes'
              }
            />
            <Fact
              label="Two-factor auth"
              value={profile ? (profile.twoFactorEnabled ? 'Enabled' : 'Not enabled') : '…'}
            />
            {profile?.company && <Fact label="Company" value={profile.company} />}
            {profile?.website && (
              <Fact
                label="Website"
                value={
                  <a href={profile.website} target="_blank" rel="noreferrer noopener">
                    {profile.website}
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                }
              />
            )}
            {profile && (
              <Fact label="Last updated" value={formatFullTimestamp(profile.updatedAt)} />
            )}
          </dl>

          {profile?.bio && (
            <section className="au-profile-section">
              <h3>Bio</h3>
              <p className="au-profile-bio">{profile.bio}</p>
            </section>
          )}

          <section className="au-profile-section">
            <h3>Recent activity</h3>
            {!profile && <p className="au-muted">Loading…</p>}
            {profile && profile.recentActivity.length === 0 && (
              <p className="au-muted">No recorded activity for this account.</p>
            )}
            {profile && profile.recentActivity.length > 0 && (
              <ul className="au-activity">
                {profile.recentActivity.map((entry) => (
                  <li key={entry.id}>
                    <span className="au-activity-action">{humaniseAuditAction(entry.action)}</span>
                    <span className="au-activity-meta">
                      {entry.entityType}
                      {entry.ipAddress ? ` · ${entry.ipAddress}` : ''}
                    </span>
                    <span className="au-activity-time">{formatFullTimestamp(entry.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

const Fact: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="au-fact">
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);
