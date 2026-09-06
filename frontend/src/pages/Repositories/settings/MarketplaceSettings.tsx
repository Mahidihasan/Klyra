import React from 'react';
import { Store, Save, CheckCircle2, Globe, Lock, Layers } from 'lucide-react';
import { RepoDetail } from '../../../types/repos';
import { StatusPill } from '../shared';

interface Props {
  repo: RepoDetail;
  isOwner: boolean;
  canWrite: boolean;
}

export const MarketplaceSettings: React.FC<Props> = ({ repo, isOwner, canWrite }) => {
  const [listingStatus, setListingStatus] = React.useState<'Not listed' | 'Listed' | 'Unlisted'>('Not listed');
  const [pricingModel, setPricingModel] = React.useState('Free');
  const [currency, setCurrency] = React.useState('USD');
  const [priceCents, setPriceCents] = React.useState('0');
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setTimeout(() => {
      setSaving(false);
      setMessage('Marketplace distribution settings saved.');
    }, 400);
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-header">
        <h2>Klyra API Marketplace Distribution</h2>
        <p>Manage API ecosystem distribution, plan tiers, and listing availability on the Klyra Hub.</p>
      </div>

      {message && (
        <div className="kr-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={15} /> {message}
        </div>
      )}

      {/* Visibility vs Listing Distinction Banner */}
      <div className="kr-card" style={{ marginBottom: 16, background: 'var(--bg-input)' }}>
        <h4 style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text-primary)' }}>
          <Layers size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          Repository Visibility vs Marketplace Listing
        </h4>
        <div className="list-sub" style={{ fontSize: 12 }}>
          Repository visibility controls access to source code (<b style={{ color: 'var(--text-accent)' }}>{repo.visibility}</b>).
          Marketplace listing status controls API endpoint discovery on the public marketplace hub (<b style={{ color: 'var(--text-accent)' }}>{listingStatus}</b>).
        </div>
      </div>

      <form onSubmit={handleSave}>
        {/* Listing Status */}
        <div className="settings-group">
          <div className="settings-group-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Store size={15} /> Marketplace Availability
          </div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Listing Status</label>
              <div className="settings-sub">Choose whether this API is listed on the Klyra Marketplace directory.</div>
            </div>
            <div className="settings-control">
              <select
                className="kr-select"
                value={listingStatus}
                onChange={e => setListingStatus(e.target.value as any)}
                disabled={!isOwner}
              >
                <option value="Not listed">Not listed — Private API not published to Hub</option>
                <option value="Listed">Listed — Published and discoverable in Marketplace</option>
                <option value="Unlisted">Unlisted — Accessible via direct link only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Pricing Model */}
        <div className="settings-group">
          <div className="settings-group-title">Pricing & Access Tiers</div>

          <div className="settings-row">
            <div className="settings-info">
              <label className="settings-label">Pricing Model</label>
              <div className="settings-sub">Billing architecture for marketplace consumers.</div>
            </div>
            <div className="settings-control">
              <select
                className="kr-select"
                value={pricingModel}
                onChange={e => setPricingModel(e.target.value)}
                disabled={!canWrite}
              >
                <option value="Free">Free Tier — Unlimited free access</option>
                <option value="Subscription">Monthly Subscription — Fixed monthly tier</option>
                <option value="Usage-based">Usage-based — Pay per 1,000 API requests</option>
              </select>
            </div>
          </div>

          {pricingModel !== 'Free' && (
            <div className="settings-row">
              <div className="settings-info">
                <label className="settings-label">Tier Price</label>
                <div className="settings-sub">Base price in selected currency.</div>
              </div>
              <div className="settings-control" style={{ display: 'flex', gap: 8 }}>
                <select className="kr-select" value={currency} onChange={e => setCurrency(e.target.value)} style={{ width: 90 }}>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
                <input
                  className="kr-input mono"
                  type="number"
                  placeholder="0"
                  value={priceCents}
                  onChange={e => setPriceCents(e.target.value)}
                  style={{ width: 120 }}
                />
              </div>
            </div>
          )}
        </div>

        {canWrite && (
          <div className="settings-actions">
            <button type="submit" className="kr-btn primary" disabled={saving}>
              <Save size={14} />
              {saving ? 'Saving marketplace settings…' : 'Save Marketplace Settings'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
