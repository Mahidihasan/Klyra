import { useState, useEffect, useCallback } from 'react';

const SUBSCRIPTION_STORAGE_KEY = 'klyra_api_subscriptions';

export function getSubscribedApisFromStorage(): string[] {
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSubscribedApisToStorage(apiIds: string[]) {
  try {
    localStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(apiIds));
    window.dispatchEvent(
      new CustomEvent('klyra:subscription-updated', { detail: { subscriptions: apiIds } })
    );
  } catch {
    /* noop */
  }
}

export function useSubscription(currentApiId?: string) {
  const [subscriptions, setSubscriptions] = useState<string[]>(getSubscribedApisFromStorage);

  useEffect(() => {
    const handleUpdate = () => {
      setSubscriptions(getSubscribedApisFromStorage());
    };
    window.addEventListener('klyra:subscription-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('klyra:subscription-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const isSubscribed = useCallback(
    (apiId?: string) => {
      if (!apiId) return false;
      return subscriptions.includes(apiId);
    },
    [subscriptions]
  );

  const subscribe = useCallback((apiId: string) => {
    setSubscriptions((prev) => {
      if (prev.includes(apiId)) return prev;
      const next = [...prev, apiId];
      saveSubscribedApisToStorage(next);
      return next;
    });
  }, []);

  const unsubscribe = useCallback((apiId: string) => {
    setSubscriptions((prev) => {
      const next = prev.filter((id) => id !== apiId);
      saveSubscribedApisToStorage(next);
      return next;
    });
  }, []);

  return {
    subscriptions,
    isSubscribed,
    isCurrentSubscribed: currentApiId ? isSubscribed(currentApiId) : false,
    subscribe,
    unsubscribe,
  };
}
