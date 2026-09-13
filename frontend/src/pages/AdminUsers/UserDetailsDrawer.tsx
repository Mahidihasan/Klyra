import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, X, Activity, Database, Key, LayoutGrid, CreditCard, Copy } from 'lucide-react';

import { adminApi } from '../../services/api/admin';
import { AdminUserDetails, AdminUserRow, ViewerIdentity, PlatformSubscriptionDetails } from '../../types/adminUsers';

import { formatFullTimestamp, formatJoinedDate, humaniseAuditAction } from './format';
import { RoleBadge, StatusBadge, UserAvatar } from './UserBadges';
import { UserAction, UserActionMenu } from './UserActionMenu';
import { PlatformPlanTab } from './PlatformPlanTab';
import { ModifySubscriptionModal } from './ModifySubscriptionModal';

interface Props {
  user: AdminUserRow;
  viewer: ViewerIdentity;
  reloadToken: number;
  onAction: (action: UserAction, user: AdminUserRow) => void;
  onClose: () => void;
}

type TabId = 'overview' | 'apis' | 'subscriptions' | 'telemetry' | 'plan';

export const UserDetailsDrawer: React.FC<Props> = ({
  user,
  viewer,
  reloadToken,
  onAction,
  onClose,
}) => {
  const [profile, setProfile] = useState<AdminUserDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [subscriptionToModify, setSubscriptionToModify] = useState<PlatformSubscriptionDetails | null>(null);
  const [isSavingSubscription, setIsSavingSubscription] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setProfile(null);
    setError(null);

    adminApi
      .getUserDetails(user.id, { signal: controller.signal })
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

  const shown: AdminUserRow = profile ?? user;

  const avatarLetters = shown.name ? shown.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} role="presentation" />
      <div
        ref={panelRef}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xl border-l border-slate-800 bg-[#0B0F19] p-6 shadow-2xl overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={`Profile: ${shown.name}`}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header Section */}
        <div className="flex items-start justify-between pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-4">
            {/* Avatar with cyan-violet gradient */}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-violet-600 text-lg font-bold text-white shadow-lg shadow-cyan-500/20">
              {avatarLetters || 'SA'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">{shown.name || 'Unnamed account'}</h2>
              <p className="text-sm text-slate-400 mt-0.5">{shown.email}</p>
              
              {/* Badges */}
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center rounded-md bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold text-violet-400 border border-violet-500/20">
                  {shown.role || 'Admin'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {shown.status || 'Active'}
                </span>
              </div>
            </div>
          </div>

          {/* Top Right Controls */}
          <div className="flex items-center gap-1">
            <UserActionMenu user={shown} viewer={viewer} onAction={onAction} />
            <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/50">
              ✕
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800/80 py-4 my-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Overview', icon: '⊞' },
            { id: 'plan', label: 'Platform Plan', icon: '💳' },
            { id: 'apis', label: 'APIs', icon: '🗄' },
            { id: 'subscriptions', label: 'Keys & Subs', icon: '🔑' },
            { id: 'telemetry', label: 'Telemetry', icon: '📈' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabId)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700/80 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 text-sm text-red-400 flex items-center gap-2">
            <AlertTriangle size={15} aria-hidden="true" />
            <p>Couldn't load full details ({error}).</p>
          </div>
        )}

        {/* Metadata Grid (Overview Tab Content) */}
        {activeTab === 'overview' && (
          <div className="mt-6">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Account Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* User ID */}
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-3.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">User ID</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono text-xs text-violet-400 truncate max-w-[170px]" title={shown.id}>
                    {shown.id}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => navigator.clipboard.writeText(shown.id)}
                    className="text-slate-500 hover:text-cyan-400 transition-colors p-1"
                    title="Copy ID"
                  >
                    📋
                  </button>
                </div>
              </div>

              {/* Joined Date */}
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-3.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">Joined</span>
                <span className="text-sm font-medium text-slate-200 mt-1 block">{formatJoinedDate(shown.joinedAt)}</span>
              </div>

              {/* Last Sign-in */}
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-3.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">Last Sign-in</span>
                <span className="text-sm font-medium text-slate-200 mt-1 block">{formatFullTimestamp(shown.lastLoginAt)}</span>
              </div>

              {/* Email Verified */}
              <div className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-3.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">Email Verified</span>
                <span className={`text-sm font-medium mt-1 block ${profile?.emailVerifiedAt || !shown.isPendingVerification ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {profile ? (profile.emailVerifiedAt ? 'Verified' : 'Unverified') : (!shown.isPendingVerification ? 'Verified' : 'Unverified')}
                </span>
              </div>

              {/* 2FA */}
              <div className="sm:col-span-2 rounded-xl border border-slate-800/60 bg-slate-950/40 p-3.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 block">Two-Factor Auth</span>
                <span className="text-sm font-medium text-slate-400 mt-1 block">{profile ? (profile.twoFactorEnabled ? 'Enabled' : 'Not enabled') : '…'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Other Tabs */}
        {activeTab === 'plan' && (
          <div className="mt-6">
            <PlatformPlanTab 
              user={shown} 
              reloadToken={reloadToken} 
              onModifySubscription={setSubscriptionToModify} 
            />
          </div>
        )}
        {activeTab === 'apis' && (
          <div className="mt-6">
            <ApisTab profile={profile} />
          </div>
        )}
        {activeTab === 'subscriptions' && (
          <div className="mt-6">
            <SubscriptionsTab profile={profile} />
          </div>
        )}
        {activeTab === 'telemetry' && (
          <div className="mt-6">
            <TelemetryTab profile={profile} />
          </div>
        )}
      </div>

      {subscriptionToModify && (
        <ModifySubscriptionModal
          user={shown}
          currentDetails={subscriptionToModify}
          isSaving={isSavingSubscription}
          error={subscriptionError}
          onConfirm={async (payload) => {
            setIsSavingSubscription(true);
            setSubscriptionError(null);
            try {
              await adminApi.overrideSubscription(shown.id, payload);
              onAction('delete', shown);
              onAction('edit', shown);
              setSubscriptionToModify(null);
            } catch (err: any) {
              setSubscriptionError(err.message);
            } finally {
              setIsSavingSubscription(false);
            }
          }}
          onClose={() => setSubscriptionToModify(null)}
        />
      )}
    </>
  );
};

// ======================== Tabs ========================

const OverviewTab: React.FC<{ shown: AdminUserRow; profile: AdminUserDetails | null }> = ({ shown, profile }) => (
  <div className="space-y-6">
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Fact 
        label="User ID" 
        mono 
        value={
          <div className="flex items-center gap-2">
            <span>{shown.id}</span>
            <button type="button" className="text-slate-500 hover:text-cyan-400 p-1 hover:bg-slate-800 rounded transition-colors" onClick={() => navigator.clipboard.writeText(shown.id)} title="Copy ID">
              <Copy size={14} />
            </button>
          </div>
        } 
      />
      <Fact label="Joined" value={formatJoinedDate(shown.joinedAt)} />
      <Fact label="Last sign-in" value={formatFullTimestamp(shown.lastLoginAt)} />
      <Fact label="Email verified" value={profile ? formatFullTimestamp(profile.emailVerifiedAt) : (shown.isPendingVerification ? 'No' : 'Yes')} />
      <Fact label="Two-factor auth" value={profile ? (profile.twoFactorEnabled ? 'Enabled' : 'Not enabled') : '…'} />
      {profile?.company && <Fact label="Company" value={profile.company} />}
      {profile?.website && (
        <Fact
          label="Website"
          value={
            <a href={profile.website} target="_blank" rel="noreferrer noopener" className="text-cyan-400 hover:text-cyan-300">
              {profile.website}
              <ExternalLink size={12} className="inline ml-1" aria-hidden="true" />
            </a>
          }
        />
      )}
    </dl>
    {profile?.bio && (
      <section className="au-profile-section">
        <h3 className="text-sm font-semibold text-white mb-2">Bio</h3>
        <p className="au-profile-bio text-slate-300 text-sm">{profile.bio}</p>
      </section>
    )}
  </div>
);

const ApisTab: React.FC<{ profile: AdminUserDetails | null }> = ({ profile }) => {
  if (!profile) return <p className="au-muted">Loading APIs...</p>;
  if (profile.apis.length === 0) return <p className="au-muted text-sm">No APIs published by this user.</p>;
  return (
    <div className="space-y-4">
      {profile.apis.map(api => (
        <div key={api.id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-white font-medium">{api.name}</h4>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-slate-800 text-slate-300">{api.status}</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-400">
            <div>Subscribers: <span className="text-white font-medium">{api.subscribers}</span></div>
            <div>Avg Latency (7d): <span className="text-white font-medium">{api.avgLatencyMs ? `${Math.round(api.avgLatencyMs)}ms` : 'N/A'}</span></div>
          </div>
        </div>
      ))}
    </div>
  );
};

const SubscriptionsTab: React.FC<{ profile: AdminUserDetails | null }> = ({ profile }) => {
  if (!profile) return <p className="au-muted">Loading subscriptions...</p>;
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-white mb-3">API Keys</h3>
        {profile.apiKeys.length === 0 ? (
          <p className="au-muted text-sm">No active API keys.</p>
        ) : (
          <div className="space-y-3">
            {profile.apiKeys.map(key => (
              <div key={key.id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-300">{key.name}</span>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${key.status === 'ACTIVE' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>{key.status}</span>
                </div>
                <div className="flex justify-between items-end mt-2">
                  <div className="text-xs text-slate-400 space-y-1">
                    <div>Prefix: <code className="text-cyan-400">{key.keyPrefix}...</code></div>
                    <div>Rate Limit: <span className="text-white">{key.rateLimit}</span> / {key.rateLimitPeriod}</div>
                  </div>
                  {key.lastUsedAt && <div className="text-[10px] text-slate-500">Last used: {formatJoinedDate(key.lastUsedAt)}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-white mb-3">Active Subscriptions</h3>
        {profile.subscriptions.length === 0 ? (
          <p className="au-muted text-sm">No active subscriptions.</p>
        ) : (
          <div className="space-y-3">
            {profile.subscriptions.map(sub => (
              <div key={sub.id} className="bg-slate-900/50 border border-slate-800 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-200">{sub.apiName}</span>
                  <span className="text-xs font-semibold bg-violet-900/30 text-violet-400 px-2 py-0.5 rounded">{sub.planName}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-slate-500">Since {formatJoinedDate(sub.periodStart)}</span>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${sub.status === 'ACTIVE' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>{sub.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const TelemetryTab: React.FC<{ profile: AdminUserDetails | null }> = ({ profile }) => {
  if (!profile) return <p className="au-muted">Loading telemetry...</p>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">30d API Requests</div>
          <div className="text-2xl font-semibold text-cyan-400">{profile.telemetry.totalRequests30d.toLocaleString()}</div>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">30d Error/Quota Violations</div>
          <div className="text-2xl font-semibold text-rose-400">{profile.telemetry.errorQuotaViolations30d.toLocaleString()}</div>
        </div>
      </div>
      
      <section className="au-profile-section mt-6">
        <h3 className="text-sm font-semibold text-white mb-3">Recent Security Activity</h3>
        {profile.recentActivity.length === 0 ? (
          <p className="au-muted text-sm">No recorded activity for this account.</p>
        ) : (
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
  );
};

// ======================== Helpers ========================

const TabButton: React.FC<{ id: TabId; label: string; icon: React.ReactNode; active: TabId; onClick: (id: TabId) => void }> = ({ id, label, icon, active, onClick }) => {
  const isActive = active === id;
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
        isActive ? 'bg-slate-800/80 text-cyan-400 border border-slate-700/60 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border border-transparent'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
};

const Fact: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="bg-slate-900/50 border border-slate-800/60 rounded-lg p-3 flex flex-col">
    <dt className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</dt>
    <dd className={`text-sm font-medium text-slate-200 mt-1 ${mono ? 'font-mono' : ''}`}>{value}</dd>
  </div>
);
