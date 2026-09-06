import React from 'react';
import { Radio, Plus, Trash2, CheckCircle2, RefreshCw, Send, AlertTriangle } from 'lucide-react';
import { RepoDetail } from '../../../types/repos';
import { Modal } from '../shared';

interface WebhookItem {
  id: string;
  url: string;
  active: boolean;
  events: string[];
  created_at: string;
  last_delivery?: { status: number; message: string; date: string };
}

interface Props {
  repo: RepoDetail;
  canWrite: boolean;
}

export const WebhooksSettings: React.FC<Props> = ({ repo, canWrite }) => {
  const [webhooks, setWebhooks] = React.useState<WebhookItem[]>([
    {
      id: 'wh-1',
      url: `https://events.example.com/webhooks/klyra/${repo.name}`,
      active: true,
      events: ['push', 'pull_request', 'release'],
      created_at: new Date().toISOString(),
      last_delivery: { status: 200, message: 'OK', date: new Date().toISOString() },
    },
  ]);

  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newUrl, setNewUrl] = React.useState('');
  const [newSecret, setNewSecret] = React.useState('');
  const [selectedEvents, setSelectedEvents] = React.useState<string[]>(['push', 'pull_request']);
  const [message, setMessage] = React.useState('');
  const [testingId, setTestingId] = React.useState('');

  const allEvents = [
    { id: 'push', label: 'Push events' },
    { id: 'pull_request', label: 'Pull requests' },
    { id: 'issues', label: 'Issues' },
    { id: 'release', label: 'Releases' },
    { id: 'deployment', label: 'Deployments' },
    { id: 'branch', label: 'Branch creation/deletion' },
  ];

  const handleAddWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    const item: WebhookItem = {
      id: `wh-${Date.now()}`,
      url: newUrl.trim(),
      active: true,
      events: selectedEvents,
      created_at: new Date().toISOString(),
      last_delivery: { status: 200, message: 'Ping delivery OK', date: new Date().toISOString() },
    };
    setWebhooks(prev => [...prev, item]);
    setNewUrl('');
    setNewSecret(''); // Cleared immediately
    setShowAddModal(false);
    setMessage('Webhook endpoint created successfully.');
  };

  const handleToggleActive = (id: string) => {
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, active: !w.active } : w));
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this webhook endpoint?')) return;
    setWebhooks(prev => prev.filter(w => w.id !== id));
    setMessage('Webhook deleted.');
  };

  const handleTestDelivery = (id: string) => {
    setTestingId(id);
    setTimeout(() => {
      setTestingId('');
      setMessage('Test delivery ping dispatched: HTTP 200 OK');
    }, 800);
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-header">
        <h2>Repository Webhooks</h2>
        <p>Subscribe external HTTP endpoints to repository lifecycle events.</p>
      </div>

      {message && (
        <div className="kr-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={15} /> {message}
        </div>
      )}

      <div className="settings-group">
        <div className="settings-group-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radio size={15} /> Configured Webhooks ({webhooks.length})
          </span>
          {canWrite && (
            <button
              type="button"
              className="kr-btn primary"
              onClick={() => setShowAddModal(true)}
              style={{ fontSize: 12, padding: '4px 10px' }}
            >
              <Plus size={13} /> Add webhook
            </button>
          )}
        </div>

        <div className="repo-dir-table-container">
          {webhooks.length === 0 ? (
            <div className="kr-empty" style={{ padding: 24 }}>No webhooks configured.</div>
          ) : (
            webhooks.map(wh => (
              <div key={wh.id} className="list-row" style={{ padding: '14px 16px', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Radio size={16} color={wh.active ? '#4ade80' : 'var(--text-muted)'} />
                    <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{wh.url}</span>
                    <span className={`status-pill ${wh.active ? 'success' : 'neutral'}`}>
                      {wh.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {canWrite && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="kr-btn"
                        onClick={() => handleTestDelivery(wh.id)}
                        disabled={testingId === wh.id}
                      >
                        <Send size={12} className={testingId === wh.id ? 'kr-spin' : ''} />
                        {testingId === wh.id ? 'Pinging…' : 'Test delivery'}
                      </button>

                      <button
                        type="button"
                        className="kr-btn"
                        onClick={() => handleToggleActive(wh.id)}
                      >
                        {wh.active ? 'Disable' : 'Enable'}
                      </button>

                      <button
                        type="button"
                        className="kr-btn danger"
                        onClick={() => handleDelete(wh.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Events:</span>
                  {wh.events.map(ev => (
                    <span key={ev} className="branch-tag" style={{ fontSize: 11 }}>{ev}</span>
                  ))}
                  {wh.last_delivery && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      Last delivery: <b style={{ color: '#4ade80' }}>HTTP {wh.last_delivery.status}</b>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showAddModal && (
        <Modal
          title="Add Webhook Endpoint"
          subtitle="We will send HTTP POST payloads to this URL when events occur."
          onClose={() => setShowAddModal(false)}
        >
          <form onSubmit={handleAddWebhook}>
            <label className="kr-label">Payload URL</label>
            <input
              className="kr-input mono"
              placeholder="https://example.com/webhooks"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
            />

            <label className="kr-label">Secret (HMAC SHA-256 signing)</label>
            <input
              className="kr-input mono"
              type="password"
              placeholder="Signing secret (optional)"
              value={newSecret}
              onChange={e => setNewSecret(e.target.value)}
            />

            <label className="kr-label">Trigger Events</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, margin: '6px 0 14px' }}>
              {allEvents.map(ev => (
                <label key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(ev.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedEvents(prev => [...prev, ev.id]);
                      else setSelectedEvents(prev => prev.filter(x => x !== ev.id));
                    }}
                  />
                  {ev.label}
                </label>
              ))}
            </div>

            <div className="modal-actions">
              <button type="button" className="kr-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button type="submit" className="kr-btn primary" disabled={!newUrl.trim()}>
                Add webhook
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
