import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { CatalogApi, catalogApi } from '../../../services/api/catalog';

export const ApiStarButton: React.FC<{ api: CatalogApi; compact?: boolean }> = ({ api, compact = false }) => {
  const { isAuthenticated } = useAuth();
  const [starred, setStarred] = useState(api.viewerHasStarred);
  const [count, setCount] = useState(api.starCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    setStarred(api.viewerHasStarred);
    setCount(api.starCount);
    setError(null);
    busyRef.current = false;
    setBusy(false);
  }, [api.id, api.starCount, api.viewerHasStarred]);

  const toggleStar = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (busyRef.current) return;
    if (!isAuthenticated) {
      setError('Sign in to star APIs.');
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = starred ? await catalogApi.unstarApi(api.id) : await catalogApi.starApi(api.id);
      setStarred(result.viewerHasStarred);
      setCount(result.starCount);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update star.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <span className={`api-star-control${compact ? ' compact' : ''}`}>
      <button
        type="button"
        className={`api-star-btn${starred ? ' is-starred' : ''}`}
        onClick={toggleStar}
        disabled={busy}
        aria-pressed={starred}
        title={error || (isAuthenticated ? (starred ? 'Remove star' : 'Star API') : 'Sign in to star APIs')}
      >
        {starred ? '★ Starred' : '☆ Star'}
      </button>
      <span className="api-star-count" aria-label={`${count} stars`}>{count}</span>
    </span>
  );
};
