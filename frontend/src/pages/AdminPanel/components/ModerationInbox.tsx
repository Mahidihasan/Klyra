import React, { useState } from 'react';
import { Flag, MessageSquare, AlertCircle, Search } from 'lucide-react';

export const ModerationInbox = () => {
  const [filter, setFilter] = useState<'ALL' | 'API' | 'USER' | 'REVIEW'>('ALL');
  const [selectedId, setSelectedId] = useState<string>('rep_1');

  const reports = [
    { id: 'rep_1', type: 'API', title: 'Malicious payload in /generate endpoint', preview: 'This API returns executable scripts when passed certain headers...', severity: 'high', reporter: 'usr_sec_1', date: '2 hours ago' },
    { id: 'rep_2', type: 'USER', title: 'Spam accounts creation', preview: 'User ID usr_9x8f is automating account creation and spamming comments.', severity: 'medium', reporter: 'System', date: '5 hours ago' },
    { id: 'rep_3', type: 'REVIEW', title: 'Inappropriate language in review', preview: '"This API is absolute garbage and the creator should..."', severity: 'low', reporter: 'usr_abc', date: '1 day ago' },
  ];

  const filtered = filter === 'ALL' ? reports : reports.filter(r => r.type === filter);
  const activeReport = reports.find(r => r.id === selectedId) || reports[0];

  return (
    <div className="inbox-container">
      {/* Sidebar List */}
      <div className="inbox-sidebar">
        <div className="inbox-filter-bar">
          <button className={`inbox-filter-btn ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>All</button>
          <button className={`inbox-filter-btn ${filter === 'API' ? 'active' : ''}`} onClick={() => setFilter('API')}>API Reports</button>
          <button className={`inbox-filter-btn ${filter === 'USER' ? 'active' : ''}`} onClick={() => setFilter('USER')}>Users</button>
        </div>
        
        <div className="inbox-list">
          {filtered.map(report => (
            <div 
              key={report.id} 
              className={`inbox-item ${selectedId === report.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(report.id)}
            >
              <div className="inbox-item-header">
                <span style={{ color: report.severity === 'high' ? '#ef4444' : report.severity === 'medium' ? '#f59e0b' : 'var(--text-muted)' }}>
                  {report.type} REPORT
                </span>
                <span style={{ color: 'var(--text-muted)' }}>{report.date}</span>
              </div>
              <div className="inbox-item-title">{report.title}</div>
              <div className="inbox-item-preview">{report.preview}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="inbox-content">
        <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{activeReport.title}</h2>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
              <span>Report ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{activeReport.id}</span></span>
              <span>Reported by: <span style={{ color: 'var(--accent-purple)' }}>{activeReport.reporter}</span></span>
            </div>
          </div>
          <span className="kanban-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: 12, padding: '4px 12px' }}>
            Severity: {activeReport.severity.toUpperCase()}
          </span>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--border-subtle)', flex: 1 }}>
          <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>Report Details</h3>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)' }}>
            {activeReport.preview}
            <br /><br />
            Additional logs indicate that this behavior started occurring after the v2.1 deployment. 
            We need an admin to review the payload structures and determine if a takedown is necessary.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button className="btn-ghost-action btn-danger-action">Take Action (Ban / Unpublish)</button>
          <button className="btn-ghost-action" style={{ borderColor: 'rgba(34, 197, 94, 0.3)', color: '#22c55e' }}>Dismiss Report (Safe)</button>
        </div>
      </div>
    </div>
  );
};
