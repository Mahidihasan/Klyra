import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { adminSubscriptionsApi } from '../../services/api/adminSubscriptions';
import { GlobalTierTemplate } from '../../types/adminSubscriptions';

export const TierTemplatesTab: React.FC = () => {
  const [templates, setTemplates] = useState<GlobalTierTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminSubscriptionsApi.getGlobalTierTemplates();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await adminSubscriptionsApi.saveGlobalTierTemplates(templates);
      alert('Templates saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save templates');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTemplate = () => {
    setTemplates([
      ...templates, 
      { id: Date.now().toString(), name: 'New Tier', slug: 'new-tier', description: '', suggestedPrice: 0, features: [], rateLimit: null, rateLimitPeriod: 'MONTHLY' }
    ]);
  };

  const handleRemoveTemplate = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
  };

  const updateTemplate = (id: string, key: keyof GlobalTierTemplate, value: any) => {
    setTemplates(templates.map(t => t.id === id ? { ...t, [key]: value } : t));
  };

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}><Loader2 className="au-spin" size={24} /></div>;
  }

  return (
    <div className="card-base" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Global Tier Templates</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
            Configure default subscription tiers (Free, Pro, etc.) that API providers can use when publishing.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="au-secondary-btn" onClick={handleAddTemplate}>
            <Plus size={16} style={{ marginRight: 6 }} /> Add Tier
          </button>
          <button className="au-primary-btn" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 size={16} className="au-spin" style={{ marginRight: 6 }} /> : <Save size={16} style={{ marginRight: 6 }} />}
            Save Changes
          </button>
        </div>
      </div>

      {error && (
        <div className="au-inline-error" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={15} />
          <p>{error}</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        {templates.map((tpl) => (
          <div key={tpl.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px', background: 'var(--bg-pill)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <input 
                type="text" 
                className="au-input" 
                value={tpl.name} 
                onChange={(e) => updateTemplate(tpl.id, 'name', e.target.value)} 
                style={{ fontWeight: 600, fontSize: '15px' }}
              />
              <button className="au-ghost-btn" style={{ color: 'var(--status-error)', padding: '4px' }} onClick={() => handleRemoveTemplate(tpl.id)}>
                <Trash2 size={16} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="au-label">Slug</label>
                <input type="text" className="au-input" value={tpl.slug} onChange={(e) => updateTemplate(tpl.id, 'slug', e.target.value)} />
              </div>
              
              <div>
                <label className="au-label">Suggested Price ($)</label>
                <input type="number" className="au-input" value={tpl.suggestedPrice} onChange={(e) => updateTemplate(tpl.id, 'suggestedPrice', parseFloat(e.target.value) || 0)} />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <label className="au-label">Rate Limit Quota</label>
                  <input type="number" className="au-input" placeholder="e.g. 10000" value={tpl.rateLimit || ''} onChange={(e) => updateTemplate(tpl.id, 'rateLimit', parseInt(e.target.value) || null)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="au-label">Period</label>
                  <select className="au-input" value={tpl.rateLimitPeriod || 'MONTHLY'} onChange={(e) => updateTemplate(tpl.id, 'rateLimitPeriod', e.target.value)}>
                    <option value="DAILY">Daily</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {templates.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>No global templates defined.</p>
      )}
    </div>
  );
};
