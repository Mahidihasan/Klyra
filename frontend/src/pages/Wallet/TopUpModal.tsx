import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { createTopUpSession, WalletApiError } from '../../services/api/wallet';
import { formatAmount } from './format';

/**
 * Mirrors MAX_TOPUP_AMOUNT in backend/src/modules/wallet/wallet.service.ts.
 *
 * This is a courtesy so the button can be disabled before a pointless round
 * trip. It is not the guard — the server validates the amount again, and on a
 * money endpoint the client's opinion is never the one that counts.
 */
const MAX_TOPUP = 1000;

const PRESETS = [10, 25, 50, 100];

interface TopUpModalProps {
  balance: number;
  currency: string;
  onClose: () => void;
}

interface Validation {
  amount: number | null;
  error: string | null;
}

/** Mirrors normalizeAmount on the server: finite, positive, at most 2 decimals. */
function validate(raw: string): Validation {
  const trimmed = raw.trim();
  if (!trimmed) return { amount: null, error: null };

  const amount = Number(trimmed);
  if (!Number.isFinite(amount)) {
    return { amount: null, error: 'Enter a number.' };
  }
  if (amount <= 0) {
    return { amount: null, error: 'Enter an amount greater than zero.' };
  }
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
    return { amount: null, error: 'Amounts can have at most two decimal places.' };
  }
  if (amount > MAX_TOPUP) {
    return {
      amount: null,
      error: `A single top-up cannot exceed ${MAX_TOPUP.toLocaleString('en-US')}.`,
    };
  }
  return { amount: Math.round(amount * 100) / 100, error: null };
}

export const TopUpModal: React.FC<TopUpModalProps> = ({ balance, currency, onClose }) => {
  const [raw, setRaw] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { amount, error } = useMemo(() => validate(raw), [raw]);
  const canSubmit = amount !== null && !isSubmitting;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Esc closes, and Tab is kept inside the panel so focus cannot wander behind
  // the overlay to controls the user cannot see.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = async () => {
    if (amount === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const session = await createTopUpSession(amount, window.location.href);
      // Hand off to Stripe's hosted page. Nothing is credited here; the
      // balance moves only when the signed webhook arrives.
      window.location.assign(session.url);
    } catch (err) {
      // The modal stays open and says why, rather than closing silently and
      // leaving the user to guess whether they just paid for something.
      const message =
        err instanceof WalletApiError && err.isStripeMissing
          ? 'Payments are not set up on this environment yet.'
          : err instanceof Error
            ? err.message
            : 'Could not start the payment.';
      setSubmitError(message);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        // Only a click that starts on the overlay itself closes it, so a drag
        // that ends outside the panel does not dismiss a half-typed amount.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="tu-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tu-title"
        ref={panelRef}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="tu-head">
          <h2 id="tu-title">Add funds</h2>
          <button className="tu-close" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        <div className="tu-body">
          <div className="tu-presets">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                className={`wallet-filter ${amount === preset ? 'active' : ''}`}
                aria-pressed={amount === preset}
                onClick={() => setRaw(String(preset))}
              >
                {formatAmount(preset, currency)}
              </button>
            ))}
          </div>

          <label className="tu-field-label" htmlFor="tu-amount">
            Or enter an amount
          </label>
          <div className="tu-input-wrap">
            <span className="tu-prefix" aria-hidden="true">
              $
            </span>
            <input
              id="tu-amount"
              ref={inputRef}
              className="tu-input"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max={MAX_TOPUP}
              placeholder="0.00"
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && canSubmit) void handleSubmit();
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'tu-error' : 'tu-preview'}
            />
          </div>

          {error ? (
            <p className="tu-error" id="tu-error" role="alert">
              {error}
            </p>
          ) : (
            <p className="tu-preview" id="tu-preview">
              {amount === null
                ? `Current balance ${formatAmount(balance, currency)}`
                : `New balance will be ${formatAmount(balance + amount, currency)}`}
            </p>
          )}

          {submitError && (
            <p className="tu-error" role="alert">
              {submitError}
            </p>
          )}

          <button
            className="wallet-primary-btn tu-submit"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? 'Opening Stripe…' : 'Continue to payment'}
          </button>

          <p className="tu-footnote">You&apos;ll pay securely on Stripe.</p>
        </div>
      </div>
    </div>
  );
};
