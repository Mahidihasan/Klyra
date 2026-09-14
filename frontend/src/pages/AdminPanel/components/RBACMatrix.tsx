import React, { useState } from 'react';
import { ShieldCheck, Check, X } from 'lucide-react';

const PERMISSIONS = [
  { id: 'view_dashboard', label: 'View Analytics Dashboard', category: 'General' },
  { id: 'manage_users', label: 'Manage Users (Suspend/Ban)', category: 'User Management' },
  { id: 'manage_roles', label: 'Assign Roles & Tiers', category: 'User Management' },
  { id: 'approve_apis', label: 'Approve/Reject APIs', category: 'API Management' },
  { id: 'delete_apis', label: 'Deprecate/Delete APIs', category: 'API Management' },
  { id: 'manage_gateway', label: 'Configure Gateway Limits', category: 'Security' },
  { id: 'revoke_keys', label: 'Revoke API Keys', category: 'Security' },
  { id: 'view_revenue', label: 'View Financial Data', category: 'Billing' },
];

const ROLES = ['Super Admin', 'Manager', 'Editor', 'Viewer'];

export const RBACMatrix = () => {
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({
    'Super Admin': PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
    'Manager': { view_dashboard: true, manage_users: true, approve_apis: true, view_revenue: true },
    'Editor': { view_dashboard: true, approve_apis: true },
    'Viewer': { view_dashboard: true }
  });

  const togglePermission = (role: string, permId: string) => {
    if (role === 'Super Admin') return; // Cannot modify super admin
    
    setMatrix(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permId]: !prev[role][permId]
      }
    }));
  };

  // Group by category
  const categories = Array.from(new Set(PERMISSIONS.map(p => p.category)));

  return (
    <div className="rbac-container" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <ShieldCheck size={24} color="#a78bfa" />
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>Role-Based Access Control (RBAC)</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Configure granular permissions for administrative roles.</p>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>Permissions</th>
              {ROLES.map(role => (
                <th key={role} style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)', textAlign: 'center' }}>
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => (
              <React.Fragment key={cat}>
                {/* Category Header */}
                <tr>
                  <td colSpan={ROLES.length + 1} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.02)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {cat}
                  </td>
                </tr>
                {/* Permission Rows */}
                {PERMISSIONS.filter(p => p.category === cat).map(perm => (
                  <tr key={perm.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '16px 24px', fontSize: 13, color: 'var(--text-primary)' }}>{perm.label}</td>
                    {ROLES.map(role => (
                      <td key={`${role}-${perm.id}`} style={{ padding: '16px', textAlign: 'center' }}>
                        <button 
                          onClick={() => togglePermission(role, perm.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: role === 'Super Admin' ? 'not-allowed' : 'pointer',
                            color: matrix[role]?.[perm.id] ? '#22c55e' : 'rgba(255,255,255,0.1)',
                            opacity: role === 'Super Admin' ? 0.5 : 1
                          }}
                        >
                          {matrix[role]?.[perm.id] ? <Check size={20} /> : <X size={20} />}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
