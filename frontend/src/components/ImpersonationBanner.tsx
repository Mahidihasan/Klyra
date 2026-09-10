/**
 * Persistent impersonation banner.
 *
 * Rendered above everything for the whole duration of an impersonated session.
 * It is deliberately loud and un-dismissable: the entire risk of impersonation
 * is an admin forgetting they are inside someone else's account and taking an
 * action they believe is their own.
 *
 * It also enforces the expiry client-side. The token stops working on its own
 * after ten minutes, but a session that silently starts 401-ing looks like a
 * broken app; exiting cleanly at zero is the honest ending.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';

import {
  endImpersonation,
  getImpersonationSession,
  ImpersonationSession,
  isExpired,
  millisecondsRemaining,
} from '../services/impersonation';

function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const ImpersonationBanner: React.FC = () => {
  const [session] = useState<ImpersonationSession | null>(() => getImpersonationSession());
  const [remaining, setRemaining] = useState(() => (session ? millisecondsRemaining(session) : 0));

  const exit = useCallback(() => {
    if (endImpersonation()) window.location.reload();
  }, []);

  useEffect(() => {
    if (!session) return undefined;

    // Expired before the first tick — a tab left open overnight, say.
    if (isExpired(session)) {
      exit();
      return undefined;
    }

    const timer = window.setInterval(() => {
      const left = millisecondsRemaining(session);
      setRemaining(left);
      if (left <= 0) exit();
    }, 1000);

    return () => window.clearInterval(timer);
  }, [session, exit]);

  if (!session) return null;

  const isEndingSoon = remaining <= 60_000;

  return (
    <div className="imp-banner" role="alert" data-ending={isEndingSoon ? 'true' : undefined}>
      <ShieldAlert size={16} aria-hidden="true" />

      <p className="imp-text">
        <strong>Viewing as {session.target.name || session.target.email}</strong>
        <span className="imp-sub">
          {session.target.email} · started by {session.issuedBy.name}
        </span>
      </p>

      <span className="imp-timer" title="Time left before this session ends automatically">
        {formatCountdown(remaining)}
      </span>

      <button type="button" className="imp-exit" onClick={exit}>
        <LogOut size={14} aria-hidden="true" />
        <span>Exit</span>
      </button>

      <style>{`
        .imp-banner {
          position: sticky;
          top: 0;
          z-index: 900;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 9px 18px;
          background: linear-gradient(90deg, rgba(245, 158, 11, 0.16), rgba(245, 158, 11, 0.09));
          border-bottom: 1px solid rgba(245, 158, 11, 0.4);
          color: var(--status-beta);
        }

        .imp-banner[data-ending='true'] {
          background: linear-gradient(90deg, rgba(239, 68, 68, 0.18), rgba(239, 68, 68, 0.09));
          border-bottom-color: rgba(239, 68, 68, 0.45);
          color: var(--status-maintenance);
        }

        .imp-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
          flex: 1;
          min-width: 0;
        }

        .imp-text strong {
          font-size: 12.5px;
          font-weight: 700;
        }

        .imp-sub {
          font-size: 11px;
          opacity: 0.85;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .imp-timer {
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          padding: 3px 9px;
          border-radius: var(--radius-sm);
          background-color: rgba(0, 0, 0, 0.25);
        }

        .imp-exit {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 28px;
          padding: 0 12px;
          border-radius: var(--radius-md);
          border: 1px solid currentColor;
          color: inherit;
          font-size: 12px;
          font-weight: 600;
          background-color: rgba(0, 0, 0, 0.2);
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .imp-exit:hover {
          background-color: rgba(0, 0, 0, 0.4);
        }

        @media (max-width: 640px) {
          .imp-sub { display: none; }
        }
      `}</style>
    </div>
  );
};

export default ImpersonationBanner;
