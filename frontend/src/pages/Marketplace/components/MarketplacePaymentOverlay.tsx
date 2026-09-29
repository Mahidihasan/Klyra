import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Wallet as WalletIcon, X } from 'lucide-react';
import {
  CatalogApi,
  CatalogPricingPlan,
  calculateMarketplacePaygo,
  catalogApi,
} from '../../../services/api/catalog';
import { fetchWallet } from '../../../services/api/wallet';
import { Wallet } from '../../../types/wallet';

interface Props {
  api: CatalogApi;
  plan: CatalogPricingPlan;
  monthlyRequests: number;
  onClose: () => void;
  onPurchased: () => void;
}

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);

export const MarketplacePaymentOverlay: React.FC<Props> = ({
  api,
  plan,
  monthlyRequests,
  onClose,
  onPurchased,
}) => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletError, setWalletError] = useState('');
  const [includePaygo, setIncludePaygo] = useState(false);
  const [method, setMethod] = useState<'wallet' | 'stripe'>('stripe');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const currency = plan.currency || 'USD';
  const paygoAmount = useMemo(
    () => (includePaygo && api.payAsYouGo ? calculateMarketplacePaygo(monthlyRequests, api.payAsYouGo) : 0),
    [includePaygo, monthlyRequests, api.payAsYouGo],
  );
  const total = Math.round((plan.price + paygoAmount) * 100) / 100;
  const walletCanPay = Boolean(
    wallet && !wallet.isLocked && wallet.currency.toUpperCase() === currency.toUpperCase() && wallet.balance >= total,
  );

  useEffect(() => {
    let active = true;
    fetchWallet()
      .then((overview) => {
        if (!active) return;
        setWallet(overview.wallet);
        setMethod(
          overview.wallet.currency.toUpperCase() === currency.toUpperCase() &&
            !overview.wallet.isLocked &&
            overview.wallet.balance >= total
            ? 'wallet'
            : 'stripe',
        );
      })
      .catch((err: unknown) => {
        if (active) setWalletError(err instanceof Error ? err.message : 'Wallet balance is unavailable.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (method === 'wallet' && wallet && !walletCanPay) setMethod('stripe');
  }, [method, wallet, walletCanPay]);

  const finishPurchase = () => {
    onPurchased();
    onClose();
  };

  const handleContinue = async () => {
    setSubmitting(true);
    setError('');
    try {
      if (method === 'wallet') {
        await catalogApi.subscribeToPlan(api.id, plan.id, { includePaygo, monthlyRequests });
        finishPurchase();
        return;
      }

      const checkout = await catalogApi.createMarketplacePurchaseSession(api.id, {
        planId: plan.id,
        includePaygo,
        monthlyRequests,
        returnUrl: window.location.href,
      });
      if (checkout.url) {
        window.location.assign(checkout.url);
        return;
      }
      if (checkout.completed) {
        finishPurchase();
        return;
      }
      throw new Error('Payment could not be started.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment could not be completed.');
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="m-payment-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="m-payment-panel" role="dialog" aria-modal="true" aria-labelledby="m-payment-title">
        <header className="m-payment-head">
          <div><span>Marketplace checkout</span><h2 id="m-payment-title">Complete your purchase</h2></div>
          <button className="m-payment-close" onClick={onClose} aria-label="Close payment"><X size={18} /></button>
        </header>

        <div className="m-payment-summary">
          <div><span>API</span><strong>{api.name}</strong></div>
          <div><span>Selected plan</span><strong>{plan.name}</strong></div>
          <div><span>Plan pricing</span><strong>{money(plan.price, currency)} / {plan.billingInterval.toLowerCase()}</strong></div>
          <label className="m-payment-paygo">
            <span><strong>Pay-as-you-go</strong><small>{api.payAsYouGo ? `${monthlyRequests.toLocaleString()} requests/month · $${api.payAsYouGo.ratePerRequest.toFixed(4)} per request after ${api.payAsYouGo.includedRequests.toLocaleString()} included` : 'Not configured for this API'}</small></span>
            <input type="checkbox" checked={includePaygo} disabled={!api.payAsYouGo} onChange={(event) => setIncludePaygo(event.target.checked)} />
          </label>
          {includePaygo && <div><span>Pay-as-you-go estimate</span><strong>{money(paygoAmount, currency)}</strong></div>}
          <div className="m-payment-total"><span>Final payable amount</span><strong>{money(total, currency)}</strong></div>
        </div>

        {loading ? (
          <p className="m-payment-note">Checking your wallet balance…</p>
        ) : (
          <>
            {walletCanPay ? (
              <div className="m-payment-methods" role="radiogroup" aria-label="Payment method">
                <button className={method === 'wallet' ? 'selected' : ''} onClick={() => setMethod('wallet')} role="radio" aria-checked={method === 'wallet'}>
                  <WalletIcon size={17} /><span>Pay from Wallet<small>{money(wallet!.balance, wallet!.currency)} available</small></span>
                </button>
                <button className={method === 'stripe' ? 'selected' : ''} onClick={() => setMethod('stripe')} role="radio" aria-checked={method === 'stripe'}>
                  <CreditCard size={17} /><span>New Payment<small>Pay securely with Stripe</small></span>
                </button>
              </div>
            ) : (
              <div className="m-payment-note">
                {walletError || (wallet?.isLocked
                  ? 'Wallet spending is currently paused.'
                  : wallet && wallet.currency.toUpperCase() !== currency.toUpperCase()
                  ? `Wallet balance uses ${wallet.currency}; this plan is priced in ${currency}.`
                  : wallet ? `Wallet balance: ${money(wallet.balance, wallet.currency)}.` : 'Wallet payment is unavailable.')}
                {' '}Choose New Payment to continue with Stripe.
              </div>
            )}
          </>
        )}

        {error && <p className="m-payment-error" role="alert">{error}</p>}
        <button className="m-payment-submit" disabled={loading || submitting || (method === 'wallet' && !walletCanPay)} onClick={() => void handleContinue()}>
          {submitting ? 'Processing…' : method === 'wallet' ? 'Pay with Wallet' : 'Continue to Payment'}
        </button>
        <style>{`
          .m-payment-backdrop{position:fixed;inset:0;z-index:10000;background:rgba(5,8,20,.76);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px}
          .m-payment-panel{width:min(100%,480px);max-height:90vh;overflow:auto;background:var(--surface-primary,#111827);color:var(--text-primary,#f9fafb);border:1px solid rgba(148,163,184,.25);border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.48);padding:24px}
          .m-payment-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:22px}.m-payment-head span{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--text-muted,#9ca3af)}.m-payment-head h2{font-size:21px;margin:6px 0 0}.m-payment-close{border:0;background:transparent;color:inherit;cursor:pointer;padding:4px}
          .m-payment-summary{border:1px solid rgba(148,163,184,.2);border-radius:12px;padding:0 15px;margin-bottom:18px}.m-payment-summary>div,.m-payment-paygo{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:13px 0;border-bottom:1px solid rgba(148,163,184,.14)}.m-payment-summary span{color:var(--text-muted,#9ca3af);font-size:13px}.m-payment-summary strong{font-size:14px;text-align:right}.m-payment-total{border:0!important}.m-payment-total strong{font-size:20px;color:var(--text-accent,#a78bfa)}.m-payment-paygo{cursor:pointer}.m-payment-paygo span{display:flex;flex-direction:column;gap:4px}.m-payment-paygo small,.m-payment-methods small{font-size:12px;color:var(--text-muted,#9ca3af)}.m-payment-paygo input{width:17px;height:17px;accent-color:#8b5cf6}
          .m-payment-methods{display:grid;gap:9px;margin:16px 0}.m-payment-methods button{display:flex;align-items:center;gap:12px;text-align:left;padding:13px;border:1px solid rgba(148,163,184,.25);border-radius:10px;background:transparent;color:inherit;cursor:pointer}.m-payment-methods button.selected{border-color:#8b5cf6;background:rgba(139,92,246,.1)}.m-payment-methods span{display:flex;flex-direction:column;gap:4px}.m-payment-note{font-size:13px;line-height:1.5;color:var(--text-muted,#9ca3af);margin:14px 0}.m-payment-error{font-size:13px;color:#f87171}.m-payment-submit{width:100%;margin-top:14px;border:0;border-radius:10px;padding:13px 16px;background:var(--accent-gradient,linear-gradient(110deg,#7c3aed,#6366f1));color:white;font-weight:700;cursor:pointer}.m-payment-submit:disabled{opacity:.55;cursor:not-allowed}
        `}</style>
      </section>
    </div>
  );
};
