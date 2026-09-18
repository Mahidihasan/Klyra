import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface CartItem {
  id: string;
  name: string;
  category: string;
  price: number;
  pricingModel: string;
  logoUrl?: string;
  slug?: string;
}

interface CartContextValue {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (apiId: string) => void;
  clearCart: () => void;
  isInCart: (apiId: string) => boolean;
  cartCount: number;
  cartTotal: number;
  justAdded: boolean; // triggers the header animation
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const STORAGE_KEY = 'klyra_cart_items';

function loadCartFromStorage(): CartItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveCartToStorage(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* noop */ }
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(loadCartFromStorage);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    saveCartToStorage(items);
    window.dispatchEvent(new CustomEvent('klyra:cart-updated', { detail: { count: items.length, total: items.reduce((sum, i) => sum + (Number(i.price) || 0), 0) } }));
  }, [items]);

  const addToCart = useCallback((item: CartItem) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      return [...prev, item];
    });
    setJustAdded(true);
    window.dispatchEvent(new CustomEvent('klyra:cart-item-added'));
    setTimeout(() => setJustAdded(false), 800);
  }, []);

  const removeFromCart = useCallback((apiId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== apiId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const isInCart = useCallback(
    (apiId: string) => items.some((i) => i.id === apiId),
    [items],
  );

  const cartTotal = Number(items.reduce((sum, item) => sum + (Number(item.price) || 0), 0).toFixed(2));

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        clearCart,
        isInCart,
        cartCount: items.length,
        cartTotal,
        justAdded,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
