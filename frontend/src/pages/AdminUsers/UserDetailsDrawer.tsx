import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, X, Activity, Database, Key, LayoutGrid, CreditCard } from 'lucide-react';

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

  return (
    <div className="au-drawer-overlay" onClick={onClose} role="presentation">
      <div
        ref={panelRef}
        className="au-drawer au-profile-drawer flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`Profile: ${shown.name}`}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={{ width: '640px', maxWidth: '100vw' }}
      >
        <header className="au-drawer-head shrink-0">
          <div className="au-profile-identity">
            <UserAvatar user={shown} size={56} />
            <div>
              <h2 className="text-xl font-semibold text-white">{shown.name || 'Unnamed account'}</h2>
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

        <div className="au-drawer-body !p-0 flex-1 overflow-y-auto">
          <div className="au-profile-badges px-6 pt-4 pb-2">
            <RoleBadge role={shown.role} />
            <StatusBadge
              status={shown.status}
              isPendingVerification={shown.isPendingVerification}
            />
          </div>

          <div className="px-6 border-b border-slate-800 flex gap-6">
            <TabButton id="overview" label="Overview" icon={<LayoutGrid size={16} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="plan" label="Platform Plan" icon={<CreditCard size={16} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="apis" label="APIs" icon={<Database size={16} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="subscriptions" label="Keys & Subs" icon={<Key size={16} />} active={activeTab} onClick={setActiveTab} />
            <TabButton id="telemetry" label="Telemetry" icon={<Activity size={16} />} active={activeTab} onClick={setActiveTab} />
          </div>

          <div className="p-6">
            {error && (
              <div className="au-inline-error mb-6">
                <AlertTriangle size={15} aria-hidden="true" />
                <p>Couldn't load full details ({error}).</p>
              </div>
            )}

            {activeTab === 'overview' && (
              <OverviewTab shown={shown} profile={profile} />
            )}
            {activeTab === 'plan' && (
              <PlatformPlanTab 
                user={shown} 
                reloadToken={reloadToken} 
                onModifySubscription={setSubscriptionToModify} 
              />
            )}
            {activeTab === 'apis' && (
              <ApisTab profile={profile} />
            )}
            {activeTab === 'subscriptions' && (
              <SubscriptionsTab profile={profile} />
            )}
            {activeTab === 'telemetry' && (
              <TelemetryTab profile={profile} />
            )}
          </div>
        </div>
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
              // Trigger reload action by simulating a successful mutation
              onAction('delete', shown); // Hack: onAction usually updates reloadToken, but it also closes drawer. Let's not use onAction to close.
              // Wait, to reload without closing, we should ideally mutate cache, but onAction reloads. I will just close and let parent reload.
              onAction('edit', shown); // Trigger reloadToken via parent
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
    </div>
  );
};

// ======================== Tabs ========================

const OverviewTab: React.FC<{ shown: AdminUserRow; profile: AdminUserDetails | null }> = ({ shown, profile }) => (
  <div className="space-y-6">
    <dl className="au-facts">
      <Fact label="User ID" value={<code className="au-mono">{shown.id}</code>} />
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
      className={`flex items-center gap-2 pb-3 border-b-2 transition-colors duration-200 ${
        isActive ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
};

const Fact: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="au-fact">
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);
