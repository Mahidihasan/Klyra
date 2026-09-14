import React, { useState } from 'react';
import { AdminApiRow, ApiStatusValue } from '../../../types/adminApis';
import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

interface ApiModerationBoardProps {
  apis: AdminApiRow[];
  onUpdateStatus: (apiId: string, newStatus: ApiStatusValue) => void;
  onOpenDetails: (api: AdminApiRow) => void;
}

export const ApiModerationBoard: React.FC<ApiModerationBoardProps> = ({ apis, onUpdateStatus, onOpenDetails }) => {
  // We'll mock the drag-and-drop visually by just allowing status updates via buttons 
  // or a dropdown on the card to keep it lightweight, but visually it's a Kanban board.

  const pending = apis.filter(a => a.status === 'PENDING');
  const rejected = apis.filter(a => a.status === 'REJECTED' || a.status === 'DEPRECATED');
  const published = apis.filter(a => a.status === 'PUBLISHED');

  const renderColumn = (title: string, icon: React.ReactNode, items: AdminApiRow[], columnType: 'PENDING' | 'REJECTED' | 'PUBLISHED') => (
    <div className="kanban-column">
      <div className="kanban-col-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon} {title}
        </div>
        <div className="kanban-badge">{items.length}</div>
      </div>
      <div className="kanban-list">
        {items.map(api => (
          <div key={api.id} className="kanban-card" onClick={() => onOpenDetails(api)}>
            <div className="card-title">{api.name}</div>
            <div className="card-subtitle">{api.categoryName}</div>
            
            <div className="card-footer">
              <div className="card-author">
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10 }}>
                  {api.ownerName.charAt(0)}
                </div>
                {api.ownerName}
              </div>
              <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                {columnType === 'PENDING' && (
                  <>
                    <button className="rollback-btn" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderColor: 'transparent' }} onClick={() => onUpdateStatus(api.id, 'PUBLISHED')}>Approve</button>
                    <button className="rollback-btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'transparent' }} onClick={() => onUpdateStatus(api.id, 'REJECTED')}>Reject</button>
                  </>
                )}
                {columnType === 'REJECTED' && (
                  <button className="rollback-btn" onClick={() => onUpdateStatus(api.id, 'PENDING')}>Re-review</button>
                )}
                {columnType === 'PUBLISHED' && (
                  <button className="rollback-btn" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderColor: 'transparent' }} onClick={() => onUpdateStatus(api.id, 'UNPUBLISHED')}>Unpublish</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: 12 }}>
            No APIs in this queue.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="kanban-board">
      {renderColumn('Pending Review', <Clock size={16} color="#3b82f6" />, pending, 'PENDING')}
      {renderColumn('Needs Changes / Rejected', <AlertCircle size={16} color="#ef4444" />, rejected, 'REJECTED')}
      {renderColumn('Approved & Published', <CheckCircle2 size={16} color="#22c55e" />, published, 'PUBLISHED')}
    </div>
  );
};
