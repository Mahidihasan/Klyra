import React, { useState } from 'react';
import { ApiReviewPane } from './ApiReviewPane';
import { Clock, Eye, CheckCircle2, XCircle } from 'lucide-react';

const MOCK_PENDING = [
  { id: '1', name: 'Global Payment Gateway v2', provider: 'Stripe Co.', version: '2.1.0', submitted: '2 hours ago', description: 'Unified payment processing API supporting 150+ currencies.' },
  { id: '2', name: 'DeepSeek LLM Inference', provider: 'AI Labs', version: '1.0.0', submitted: '5 hours ago', description: 'Low latency inference for DeepSeek Coder.' },
  { id: '3', name: 'Real-time Flight Data', provider: 'AeroAPI', version: '1.4.2', submitted: '1 day ago', description: 'Live tracking of commercial flights globally.' }
];

export const ApprovalQueue = () => {
  const [pendingApis, setPendingApis] = useState(MOCK_PENDING);
  const [reviewingApi, setReviewingApi] = useState<any>(null);

  const handleApprove = (id: string) => {
    setPendingApis(prev => prev.filter(api => api.id !== id));
    setReviewingApi(null);
  };

  const handleReject = (id: string) => {
    setPendingApis(prev => prev.filter(api => api.id !== id));
    setReviewingApi(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={20} color="#f59e0b" />
          Pending Approval ({pendingApis.length})
        </h2>
      </div>

      <div className="approval-list">
        {pendingApis.map(api => (
          <div key={api.id} className="approval-card">
            <div className="approval-info">
              <h3>{api.name} <span className="version-tag">v{api.version}</span></h3>
              <p>Submitted by <strong>{api.provider}</strong> • {api.submitted}</p>
            </div>
            <div className="approval-actions">
              <button className="btn-ghost" onClick={() => setReviewingApi(api)}>
                <Eye size={16} /> Review
              </button>
              <button className="btn-approve-icon" onClick={() => handleApprove(api.id)}>
                <CheckCircle2 size={20} />
              </button>
              <button className="btn-reject-icon" onClick={() => handleReject(api.id)}>
                <XCircle size={20} />
              </button>
            </div>
          </div>
        ))}

        {pendingApis.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={48} color="#22c55e" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <p>All caught up! No APIs pending review.</p>
          </div>
        )}
      </div>

      {reviewingApi && (
        <ApiReviewPane 
          api={reviewingApi} 
          onClose={() => setReviewingApi(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
};
