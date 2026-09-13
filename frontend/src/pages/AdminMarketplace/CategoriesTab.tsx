import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2, Edit, Trash2, Plus } from 'lucide-react';
import { adminMarketplaceApi } from '../../services/api/adminMarketplace';
import { AdminCategoryRow } from '../../types/adminMarketplace';

export const CategoriesTab: React.FC = () => {
  const [categories, setCategories] = useState<AdminCategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminMarketplaceApi.getCategories();
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="au-spin" size={24} /></div>;
  }

  return (
    <div className="au-table-card card-base" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600 }}>API Categories</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Manage the taxonomy used to organize APIs in the marketplace.</p>
        </div>
        <button className="au-primary-btn">
          <Plus size={16} style={{ marginRight: 6 }} /> New Category
        </button>
      </div>

      {error && (
        <div className="au-inline-error" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={15} />
          <p>{error}</p>
        </div>
      )}

      <div className="au-table-scroll">
        <table className="au-table">
          <thead>
            <tr>
              <th>Name & Slug</th>
              <th>Description</th>
              <th data-align="end">Sort Order</th>
              <th data-align="end">APIs Count</th>
              <th>Status</th>
              <th data-align="end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {cat.iconUrl ? (
                      <img src={cat.iconUrl} alt="" style={{ width: 24, height: 24 }} />
                    ) : (
                       <div className="au-avatar-fallback" style={{ width: 24, height: 24, fontSize: 10 }}>#</div>
                    )}
                    <div>
                      <div style={{ fontWeight: 500 }}>{cat.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/{cat.slug}</div>
                    </div>
                  </div>
                </td>
                <td><span style={{ color: 'var(--text-muted)' }}>{cat.description || 'No description'}</span></td>
                <td data-align="end">{cat.sortOrder}</td>
                <td data-align="end">{cat.apiCount}</td>
                <td>
                   <span className="au-badge" data-status={cat.isActive ? 'active' : 'offline'}>
                    {cat.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td data-align="end">
                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                     <button className="au-ghost-btn" style={{ padding: '4px 8px' }}><Edit size={14} /></button>
                     <button className="au-ghost-btn" style={{ padding: '4px 8px', color: 'var(--status-error)' }}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>No categories found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
