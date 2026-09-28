import React, { useState } from 'react';
import { ApprovalQueue } from './components/ApprovalQueue';
import { ApiDirectory } from './components/ApiDirectory';
import { RateLimiter } from './components/RateLimiter';
import { LayoutList, ShieldAlert, FolderKey } from 'lucide-react';
import './AdminApis.css';

export const AdminApis = () => {
  const [activeTab, setActiveTab] = useState<'queue' | 'directory' | 'gateway'>('queue');

  return (
    <div className="admin-apis-container">
      <div className="admin-apis-header">
        <h1>API Management & Security</h1>
        <p>Review, categorize, and enforce global rate limits on published APIs.</p>
        
        <div className="api-tabs">
          <div 
            className={`api-tab ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('queue')}
          >
            <ShieldAlert size={14} /> Approval Queue
          </div>
          <div 
            className={`api-tab ${activeTab === 'directory' ? 'active' : ''}`}
            onClick={() => setActiveTab('directory')}
          >
            <LayoutList size={14} /> API Directory (Bulk)
          </div>
          <div 
            className={`api-tab ${activeTab === 'gateway' ? 'active' : ''}`}
            onClick={() => setActiveTab('gateway')}
          >
            <FolderKey size={14} /> Gateway & Rate Limits
          </div>
        </div>
      </div>

      <div className="admin-apis-content">
        {activeTab === 'queue' && <ApprovalQueue />}
        {activeTab === 'directory' && <ApiDirectory />}
        {activeTab === 'gateway' && <RateLimiter />}
      </div>
    </div>
  );
};
