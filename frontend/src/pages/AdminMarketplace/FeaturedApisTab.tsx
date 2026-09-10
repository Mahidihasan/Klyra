import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2, GripVertical, Trash2, Plus } from 'lucide-react';
import { adminMarketplaceApi } from '../../services/api/adminMarketplace';
import { FeaturedApiRow } from '../../types/adminMarketplace';

export const FeaturedApisTab: React.FC = () => {
  const [apis, setApis] = useState<FeaturedApiRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newApiId, setNewApiId] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminMarketplaceApi.getFeaturedApis();
      setApis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load featured APIs');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (updatedApis: FeaturedApiRow[]) => {
    setIsSaving(true);
    setError(null);
    try {
      await adminMarketplaceApi.setFeaturedApis(updatedApis.map(a => a.id));
      setApis(updatedApis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = (id: string) => {
    const updated = apis.filter(a => a.id !== id);
    void handleSave(updated);
  };

  const handleAdd = () => {
    if (!newApiId.trim()) return;
    // Just mock appending it, ideally we'd look up the real API details.
    // In a real app we would validate the ID first.
    const updated = [...apis, {
      id: newApiId.trim(),
      name: 'New Added API',
      logoUrl: null,
      ownerName: 'Unknown',
      categoryName: 'Unknown'
    }];
    void handleSave(updated);
    setNewApiId('');
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...apis];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    void handleSave(updated);
  };

  const moveDown = (index: number) => {
    if (index === apis.length - 1) return;
    const updated = [...apis];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    void handleSave(updated);
  };

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="au-spin" size={24} /></div>;
  }

  return (
    <div className="card-base" style={{ padding: '24px' }}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Featured APIs Carousel</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
        These APIs appear pinned at the top of the marketplace home page. Order matters.
      </p>

      {error && (
        <div className="au-inline-error" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={15} />
          <p>{error}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {apis.map((api, index) => (
          <div key={api.id} style={{ display: 'flex', alignItems: 'center', padding: '12px', background: 'var(--bg-pill)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', marginRight: '16px' }}>
               <button className="au-ghost-btn" style={{ padding: 4, height: 'auto' }} onClick={() => moveUp(index)} disabled={index === 0}>▲</button>
               <button className="au-ghost-btn" style={{ padding: 4, height: 'auto' }} onClick={() => moveDown(index)} disabled={index === apis.length - 1}>▼</button>
            </div>
            
            {api.logoUrl ? (
              <img src={api.logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', marginRight: '12px' }} />
            ) : (
              <div className="au-avatar-fallback" style={{ width: 32, height: 32, fontSize: 14, marginRight: '12px' }}>
                {api.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', fontWeight: 500 }}>{api.name}</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{api.ownerName} • {api.categoryName}</p>
            </div>

            <button
              className="au-ghost-btn"
              style={{ color: 'var(--status-error)' }}
              onClick={() => handleRemove(api.id)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {apis.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>No featured APIs configured.</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="text"
          className="au-input"
          placeholder="Enter API UUID to feature..."
          value={newApiId}
          onChange={(e) => setNewApiId(e.target.value)}
          style={{ width: '300px' }}
        />
        <button
          className="au-primary-btn"
          onClick={handleAdd}
          disabled={!newApiId.trim() || isSaving}
        >
          <Plus size={16} style={{ marginRight: 6 }} /> Add API
        </button>
      </div>
    </div>
  );
};
