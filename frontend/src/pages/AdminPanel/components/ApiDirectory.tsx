import React, { useState } from 'react';
import { Search, Filter, MoreHorizontal, Tags, FolderEdit, XCircle } from 'lucide-react';

const MOCK_CATALOG = Array.from({ length: 20 }).map((_, i) => ({
  id: `api_${i}`,
  name: `Production API Service ${i + 1}`,
  provider: `Provider ${String.fromCharCode(65 + (i % 5))}`,
  status: i % 4 === 0 ? 'Deprecated' : 'Active',
  category: ['Finance', 'AI', 'Weather', 'Data'][i % 4],
  calls: Math.floor(Math.random() * 100000)
}));

export const ApiDirectory = () => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelectAll = () => {
    if (selected.size === MOCK_CATALOG.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(MOCK_CATALOG.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className="api-directory">
      <div className="directory-toolbar">
        <div className="search-bar">
          <Search size={16} />
          <input type="text" placeholder="Search 5,231 APIs..." />
        </div>
        <button className="btn-filter"><Filter size={16} /> Filters</button>
      </div>

      <div className="table-container">
        <table className="bulk-table">
          <thead>
            <tr>
              <th className="sticky-col checkbox-col">
                <input 
                  type="checkbox" 
                  checked={selected.size === MOCK_CATALOG.length && MOCK_CATALOG.length > 0} 
                  onChange={toggleSelectAll} 
                />
              </th>
              <th>API Name</th>
              <th>Provider</th>
              <th>Category</th>
              <th>Status</th>
              <th className="text-right">30d Volume</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_CATALOG.map((api) => (
              <tr key={api.id} className={selected.has(api.id) ? 'selected-row' : ''}>
                <td className="sticky-col checkbox-col">
                  <input type="checkbox" checked={selected.has(api.id)} onChange={() => toggleSelect(api.id)} />
                </td>
                <td className="font-semibold">{api.name}</td>
                <td style={{ color: 'var(--text-muted)' }}>{api.provider}</td>
                <td><span className="badge-outline">{api.category}</span></td>
                <td>
                  <span className={`status-dot ${api.status === 'Active' ? 'green' : 'red'}`}></span>
                  {api.status}
                </td>
                <td className="text-right mono-text">{api.calls.toLocaleString()}</td>
                <td className="text-right">
                  <button className="btn-icon"><MoreHorizontal size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating Bulk Action Bar (Shopify Inspired) */}
      {selected.size > 0 && (
        <div className="bulk-action-bar-wrapper">
          <div className="bulk-action-bar">
            <span style={{ fontWeight: 600, paddingRight: 16, borderRight: '1px solid rgba(255,255,255,0.1)' }}>
              {selected.size} selected
            </span>
            <div className="bulk-actions">
              <button className="btn-bulk"><Tags size={14} /> Add Tags</button>
              <button className="btn-bulk"><FolderEdit size={14} /> Change Category</button>
              <button className="btn-bulk danger"><XCircle size={14} /> Deprecate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
