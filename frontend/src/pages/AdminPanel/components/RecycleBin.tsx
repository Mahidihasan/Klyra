import React, { useState } from 'react';
import { RefreshCw, Trash2, Search } from 'lucide-react';

const MOCK_DELETED_RECORDS = [
  { id: 'rec_881', type: 'API', name: 'Legacy Weather API', deleted_at: '2026-09-13T10:00:00Z', deleted_by: 'admin_sys1' },
  { id: 'rec_880', type: 'USER', name: 'John Doe', deleted_at: '2026-09-12T14:30:00Z', deleted_by: 'admin_sys2' },
  { id: 'rec_879', type: 'REVIEW', name: 'Spam Review #992', deleted_at: '2026-09-11T09:15:00Z', deleted_by: 'auto_mod' },
];

export const RecycleBin = () => {
  const [records, setRecords] = useState(MOCK_DELETED_RECORDS);
  const [search, setSearch] = useState('');
  
  const [restoring, setRestoring] = useState<string[]>([]);
  const [destroying, setDestroying] = useState<string[]>([]);

  const handleRestore = (id: string) => {
    setRestoring(prev => [...prev, id]);
    setTimeout(() => {
      setRecords(prev => prev.filter(r => r.id !== id));
      setRestoring(prev => prev.filter(r => r !== id));
    }, 500);
  };

  const handleDestroy = (id: string) => {
    setDestroying(prev => [...prev, id]);
    setTimeout(() => {
      setRecords(prev => prev.filter(r => r.id !== id));
      setDestroying(prev => prev.filter(r => r !== id));
    }, 500);
  };

  const filteredRecords = records.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trash2 size={18} color="#ef4444" /> Soft-Deleted Records
        </h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: 8 }} />
            <input type="text" placeholder="Search bin..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', color: '#fff', padding: '6px 12px 6px 30px', borderRadius: 6, fontSize: 13 }} />
          </div>
          <button style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '6px 12px', borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
            Empty Bin
          </button>
        </div>
      </div>

      <div style={{ flex: 1, background: 'rgba(20, 21, 36, 0.6)', border: '1px solid var(--border-card)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'rgba(20, 21, 36, 0.95)', borderBottom: '1px solid var(--border-card)' }}>
            <tr>
              <th style={{ padding: '12px 20px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>ID</th>
              <th style={{ padding: '12px 20px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Type</th>
              <th style={{ padding: '12px 20px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Name / Identifier</th>
              <th style={{ padding: '12px 20px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Deleted At</th>
              <th style={{ padding: '12px 20px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Deleted By</th>
              <th style={{ padding: '12px 20px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map(record => (
              <tr key={record.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'opacity 0.2s', opacity: (restoring.includes(record.id) || destroying.includes(record.id)) ? 0.5 : 1 }}>
                <td style={{ padding: '12px 20px', fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{record.id}</td>
                <td style={{ padding: '12px 20px' }}>
                  <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{record.type}</span>
                </td>
                <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{record.name}</td>
                <td style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>{new Date(record.deleted_at).toLocaleString()}</td>
                <td style={{ padding: '12px 20px', fontSize: 13, fontFamily: 'var(--font-mono)', color: '#8b5cf6' }}>{record.deleted_by}</td>
                <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button 
                      onClick={() => handleRestore(record.id)}
                      disabled={restoring.includes(record.id) || destroying.includes(record.id)}
                      style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
                    >
                      <RefreshCw size={12} className={restoring.includes(record.id) ? 'spin-icon' : ''} /> {restoring.includes(record.id) ? 'Restoring...' : 'Restore'}
                    </button>
                    <button 
                      onClick={() => handleDestroy(record.id)}
                      disabled={restoring.includes(record.id) || destroying.includes(record.id)}
                      style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Trash2 size={12} /> Obliterate
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  Recycle bin is empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
