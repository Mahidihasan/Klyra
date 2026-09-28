import React, { useState } from 'react';
import { DataGrid } from './components/DataGrid';
import { AuditLogViewer } from './components/AuditLogViewer';
import { RecycleBin } from './components/RecycleBin';
import { Database, Terminal, Trash2 } from 'lucide-react';
import './AdminDatabase.css';

export const AdminDatabase = () => {
  const [activeView, setActiveView] = useState<'DATAGRID' | 'AUDIT' | 'TRASH'>('DATAGRID');

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 box-border admin-database-container">
      <div className="w-full flex items-center justify-between flex-wrap gap-4 mb-6 database-header">
        <h1>Database & Logs</h1>
        
        <div className="view-tabs">
          <div className={`view-tab ${activeView === 'DATAGRID' ? 'active' : ''}`} onClick={() => setActiveView('DATAGRID')}>
            <Database size={14} /> Data Explorer
          </div>
          <div className={`view-tab ${activeView === 'AUDIT' ? 'active' : ''}`} onClick={() => setActiveView('AUDIT')}>
            <Terminal size={14} /> Audit Logs
          </div>
          <div className={`view-tab ${activeView === 'TRASH' ? 'active' : ''}`} onClick={() => setActiveView('TRASH')}>
            <Trash2 size={14} /> Recycle Bin
          </div>
        </div>
      </div>

      {activeView === 'DATAGRID' && <DataGrid />}
      {activeView === 'AUDIT' && <AuditLogViewer />}
      {activeView === 'TRASH' && <RecycleBin />}
    </div>
  );
};
