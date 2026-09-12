import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { SubscriptionOverridePayload, UserSubscriptionTier, PlatformSubscriptionDetails, AdminUserRow, SUBSCRIPTION_TIER_LABELS } from '../../types/adminUsers';
import { UserAvatar } from './UserBadges';

const overrideSchema = z.object({
  tier: z.enum(['FREE', 'PRO', 'ENTERPRISE']),
  expiresAt: z.string().optional().nullable(),
  reason: z.string().min(1, 'Please provide a reason for the audit log').max(500),
});

interface Props {
  user: AdminUserRow;
  currentDetails: PlatformSubscriptionDetails | null;
  isSaving: boolean;
  error: string | null;
  onConfirm: (payload: SubscriptionOverridePayload) => void;
  onClose: () => void;
}

export const ModifySubscriptionModal: React.FC<Props> = ({
  user,
  currentDetails,
  isSaving,
  error,
  onConfirm,
  onClose,
}) => {
  const [tier, setTier] = useState<UserSubscriptionTier>(currentDetails?.override?.tier || currentDetails?.tier || 'FREE');
  const [expiresIn, setExpiresIn] = useState<string>('30_days');
  const [reason, setReason] = useState<string>(currentDetails?.override?.reason || '');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleConfirm = () => {
    let expiresAt: string | null = null;
    if (expiresIn === '30_days') {
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (expiresIn === '1_year') {
      expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    } else if (expiresIn === 'lifetime') {
      expiresAt = null;
    }

    const payload = { tier, expiresAt, reason };
    const result = overrideSchema.safeParse(payload);
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
      });
      setValidationErrors(fieldErrors);
      return;
    }

    onConfirm(payload);
  };

  return (
    <div className="au-modal-overlay" role="presentation" onClick={isSaving ? undefined : onClose}>
      <div
        className="au-modal max-w-lg w-full"
        role="dialog"
        aria-modal="true"
        aria-label="Modify Subscription"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="au-modal-title">Modify Platform Subscription</h2>
        
        <div className="au-modal-subject my-4">
          <UserAvatar user={user} size={36} />
          <div>
            <p className="au-modal-subject-name">{user.name || 'Unnamed account'}</p>
            <p className="au-modal-subject-email">{user.email}</p>
          </div>
          <span className="text-xs uppercase font-bold tracking-wider px-2 py-1 rounded bg-slate-800 text-slate-300">
            Current: {SUBSCRIPTION_TIER_LABELS[user.subscriptionTier]}
          </span>
        </div>

        <div className="space-y-5 mb-6">
          <p className="text-sm text-slate-400">
            Manually overriding a user's subscription tier grants them elevated quotas and features without charging their payment method.
          </p>
          
          <div className="space-y-3">
            <label className="text-sm font-semibold text-white block">Select Tier</label>
            <div className="grid grid-cols-3 gap-3">
              {(['FREE', 'PRO', 'ENTERPRISE'] as UserSubscriptionTier[]).map((t) => (
                <label
                  key={t}
                  className={`
                    flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer transition-colors
                    ${tier === t ? 'bg-cyan-900/30 border-cyan-500' : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'}
                  `}
                >
                  <input
                    type="radio"
                    name="tier"
                    className="sr-only"
                    checked={tier === t}
                    onChange={() => setTier(t)}
                  />
                  <span className={`text-sm font-bold ${tier === t ? 'text-cyan-400' : 'text-slate-300'}`}>
                    {SUBSCRIPTION_TIER_LABELS[t]}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 uppercase">
                    {t === 'FREE' ? 'Default' : (t === 'PRO' ? '$29 / mo' : '$199 / mo')}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-white block">Expiration</label>
            <select
              value={expiresIn}
              onChange={(e) => setExpiresIn(e.target.value)}
              disabled={isSaving}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="30_days">30 Days</option>
              <option value="1_year">1 Year</option>
              <option value="lifetime">Lifetime / Indefinite</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-semibold text-white block">Reason <span className="font-normal text-slate-500">(Audit log justification)</span></label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (validationErrors.reason) setValidationErrors(prev => ({ ...prev, reason: '' }));
              }}
              disabled={isSaving}
              className={`w-full bg-slate-900 border ${validationErrors.reason ? 'border-red-500' : 'border-slate-700'} rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500 min-h-[80px]`}
              placeholder="e.g. Comped for partnership evaluation"
            />
            {validationErrors.reason && <p className="text-xs text-red-400 mt-1">{validationErrors.reason}</p>}
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
            className="au-primary-btn"
            onClick={handleConfirm}
            disabled={isSaving}
          >
            {isSaving && <Loader2 size={14} className="au-spin" aria-hidden="true" />}
            Apply Override
          </button>
        </footer>
      </div>
    </div>
  );
};
