import React, { useEffect, useState } from 'react';
import { CreditCard, AlertTriangle, Loader2 } from 'lucide-react';

import { adminApi } from '../../services/api/admin';
import { AdminUserRow, PlatformSubscriptionDetails, SUBSCRIPTION_TIER_LABELS } from '../../types/adminUsers';

interface Props {
  user: AdminUserRow;
  reloadToken: number;
  onModifySubscription: (details: PlatformSubscriptionDetails) => void;
}

export const PlatformPlanTab: React.FC<Props> = ({ user, reloadToken, onModifySubscription }) => {
  const [details, setDetails] = useState<PlatformSubscriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    adminApi
      .getSubscriptionDetails(user.id, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setDetails(data);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (controller.signal.aborted || err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [user.id, reloadToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        Loading subscription data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="au-inline-error">
        <AlertTriangle size={15} aria-hidden="true" />
        <p>Could not load platform plan: {error}</p>
      </div>
    );
  }

  if (!details) return null;

  const usagePercent = Math.min(100, (details.quota.used / details.quota.limit) * 100);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <CreditCard size={18} className="text-cyan-400" />
            {SUBSCRIPTION_TIER_LABELS[details.tier]}
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ml-2 ${details.status === 'ACTIVE' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-amber-900/50 text-amber-400'}`}>
              {details.status}
            </span>
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            {details.billingCycle ? `Billed ${details.billingCycle.toLowerCase()} • Renews ${new Date(details.renewalDate!).toLocaleDateString()}` : 'Manual or Lifetime'}
          </p>
          {details.paymentMethod && (
            <p className="text-sm text-slate-500 mt-1">{details.paymentMethod}</p>
          )}
        </div>
        <button
          onClick={() => onModifySubscription(details)}
          className="au-secondary-btn text-xs py-1.5 px-3"
        >
          Modify Subscription
        </button>
      </div>

      {details.override?.active && (
        <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-4">
          <h4 className="text-amber-500 text-sm font-semibold flex items-center gap-1.5 mb-2">
            <AlertTriangle size={14} />
            Manual Override Active
          </h4>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-slate-400">Override Tier</dt>
            <dd className="text-slate-200 font-medium">{SUBSCRIPTION_TIER_LABELS[details.override.tier]}</dd>
            <dt className="text-slate-400">Expires</dt>
            <dd className="text-slate-200">{details.override.expiresAt ? new Date(details.override.expiresAt).toLocaleDateString() : 'Lifetime'}</dd>
            <dt className="text-slate-400">Reason</dt>
            <dd className="text-slate-200">{details.override.reason}</dd>
          </dl>
        </div>
      )}

      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-5">
        <div className="flex justify-between items-end mb-2">
          <h4 className="text-sm font-semibold text-slate-300">API Quota Consumption</h4>
          <span className="text-sm font-medium text-white">
            {details.quota.used.toLocaleString()} <span className="text-slate-500 font-normal">/ {details.quota.limit.toLocaleString()}</span>
          </span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
          <div 
            className={`h-2.5 rounded-full transition-all ${usagePercent > 90 ? 'bg-red-500' : usagePercent > 75 ? 'bg-amber-500' : 'bg-cyan-500'}`} 
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};
