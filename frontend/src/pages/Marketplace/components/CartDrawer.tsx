import React, { useState } from 'react';
import { ArrowRight, ShoppingCart, Trash2, X, Check, Sparkles } from 'lucide-react';
import { useCart } from '../../../context/CartContext';
import { getSubscribedApisFromStorage, saveSubscribedApisToStorage } from '../useSubscription';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const { items, cartTotal, removeFromCart, clearCart } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const handleCheckout = () => {
    setIsCheckingOut(true);
    setTimeout(() => {
      // Provision subscriptions for all items in cart
      const currentSubs = getSubscribedApisFromStorage();
      const newSubs = Array.from(new Set([...currentSubs, ...items.map((i) => i.id)]));
      saveSubscribedApisToStorage(newSubs);

      setIsCheckingOut(false);
      setCheckoutSuccess(true);
      clearCart();
      setTimeout(() => {
        setCheckoutSuccess(false);
        onClose();
      }, 1600);
    }, 900);
  };

  return (
    <>
      {isOpen && (
        <button className="cart-drawer-backdrop" aria-label="Close cart" onClick={onClose} />
      )}
      <aside className={`cart-drawer ${isOpen ? 'open' : ''}`} aria-hidden={!isOpen}>
        <header className="cart-drawer-header">
          <div>
            <span className="cart-drawer-kicker">
              <ShoppingCart size={13} /> Marketplace cart
            </span>
            <h2>Your APIs</h2>
          </div>
          <button className="cart-drawer-close" onClick={onClose} aria-label="Close cart">
            <X size={18} />
          </button>
        </header>
        <div className="cart-drawer-body">
          {checkoutSuccess ? (
            <div className="cart-drawer-empty">
              <div className="cart-success-badge">
                <Check size={32} color="#22c55e" />
              </div>
              <h3 style={{ color: '#4ade80' }}>Subscriptions Activated!</h3>
              <p>Your API access credentials and sandbox environments are now fully unlocked.</p>
            </div>
          ) : items.length === 0 ? (
            <div className="cart-drawer-empty">
              <ShoppingCart size={28} />
              <h3>Your cart is ready</h3>
              <p>Add API plans to compare your next integration setup.</p>
            </div>
          ) : (
            items.map((item) => (
              <div className="cart-item" key={item.id}>
                <div className="cart-item-copy">
                  <strong>{item.name}</strong>
                  <span>
                    {item.category} ·{' '}
                    {item.pricingModel === 'FREE'
                      ? 'Free'
                      : item.pricingModel === 'FREEMIUM'
                      ? 'Freemium'
                      : 'Paid'}
                  </span>
                </div>
                <div className="cart-item-end">
                  <b>{item.price === 0 ? 'Free' : `$${item.price.toFixed(2)}/mo`}</b>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <footer className="cart-drawer-footer">
          <div className="cart-subtotal">
            <span>Estimated subtotal</span>
            <strong>
              ${cartTotal.toFixed(2)}
              <small>/mo</small>
            </strong>
          </div>
          <button
            className="cart-checkout-btn"
            disabled={items.length === 0 || isCheckingOut}
            onClick={handleCheckout}
          >
            {isCheckingOut ? (
              <span>Activating Subscriptions...</span>
            ) : (
              <>
                Activate & Checkout <ArrowRight size={14} />
              </>
            )}
          </button>
          {items.length > 0 && (
            <button className="cart-clear-btn" onClick={clearCart}>
              Clear cart
            </button>
          )}
        </footer>
        <style>{`
          .cart-drawer-backdrop { position: fixed; inset: 0; z-index: 1090; background: rgba(3,4,10,.48); border: 0; backdrop-filter: blur(2px); }
          .cart-drawer { background: var(--bg-modal); border-left: 1px solid var(--border-card); box-shadow: -20px 0 50px rgba(0,0,0,.35); display: flex; flex-direction: column; height: 100vh; max-width: 400px; position: fixed; right: 0; top: 0; transform: translateX(100%); transition: transform .28s cubic-bezier(.16,1,.3,1); width: min(400px, 92vw); z-index: 1100; }
          .cart-drawer.open { transform: translateX(0); }
          .cart-drawer-header { align-items: flex-start; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; padding: 24px 20px 18px; }
          .cart-drawer-kicker { align-items: center; color: var(--text-accent); display: flex; font-size: 10px; font-weight: 700; gap: 6px; letter-spacing: .08em; text-transform: uppercase; }
          .cart-drawer-header h2 { font-size: 22px; margin-top: 5px; }
          .cart-drawer-close { color: var(--text-muted); padding: 4px; }
          .cart-drawer-body { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 20px; }
          .cart-drawer-empty { align-items: center; color: var(--text-muted); display: flex; flex-direction: column; gap: 8px; justify-content: center; min-height: 300px; text-align: center; }
          .cart-drawer-empty h3 { color: var(--text-primary); font-size: 16px; }
          .cart-drawer-empty p { font-size: 12px; line-height: 1.5; max-width: 260px; }
          .cart-success-badge { width: 60px; height: 60px; border-radius: 50%; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.35); display: flex; align-items: center; justify-content: center; margin-bottom: 6px; animation: popIn 0.35s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 0 24px rgba(34, 197, 94, 0.25); }
          @keyframes popIn { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          .cart-item { align-items: center; border-bottom: 1px solid var(--border-subtle); display: flex; gap: 12px; justify-content: space-between; padding: 14px 0; }
          .cart-item-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
          .cart-item-copy strong { color: var(--text-primary); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .cart-item-copy span, .cart-item-end b { color: var(--text-muted); font-size: 11px; }
          .cart-item-end { align-items: flex-end; display: flex; flex-direction: column; gap: 6px; }
          .cart-item-end button { color: var(--text-muted); padding: 2px; }
          .cart-item-end button:hover { color: #f87171; }
          .cart-drawer-footer { border-top: 1px solid var(--border-card); padding: 18px 20px 24px; }
          .cart-subtotal { align-items: baseline; display: flex; justify-content: space-between; margin-bottom: 14px; }
          .cart-subtotal span { color: var(--text-muted); font-size: 12px; }
          .cart-subtotal strong { color: var(--text-primary); font-size: 20px; }
          .cart-subtotal small { color: var(--text-muted); font-size: 11px; font-weight: 400; }
          .cart-checkout-btn { align-items: center; background: var(--accent-gradient); border-radius: var(--radius-md); color: #fff; display: flex; font-size: 12px; font-weight: 700; gap: 6px; justify-content: center; padding: 11px; width: 100%; }
          .cart-checkout-btn:disabled { cursor: not-allowed; opacity: .45; }
          .cart-clear-btn { color: var(--text-muted); display: block; font-size: 11px; margin: 10px auto 0; }
        `}</style>
      </aside>
    </>
  );
};

export default CartDrawer;
