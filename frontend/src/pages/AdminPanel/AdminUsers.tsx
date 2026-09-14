import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, MoreVertical, X, Plus } from 'lucide-react';
import { 
  AdminUserRow, 
  UserRoleValue, 
  UserStatusFilter, 
  UserSubscriptionTier 
} from '../../types/adminUsers';
import { UserDrawer } from './components/UserDrawer';
import { EmailModal } from './components/EmailModal';
import './AdminUsers.css';

// ------------------------------------------------------------------
// Mock Data Generator for Frontend Demonstration
// ------------------------------------------------------------------
const generateMockUsers = (): AdminUserRow[] => {
  const roles: UserRoleValue[] = ['USER', 'PROVIDER', 'MODERATOR', 'ADMIN'];
  const statuses: UserStatusFilter[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED', 'PENDING'];
  const tiers: UserSubscriptionTier[] = ['FREE', 'PRO', 'ENTERPRISE'];
  
  const users: AdminUserRow[] = [];
  for (let i = 1; i <= 50; i++) {
    users.push({
      id: `usr_mock_${Math.random().toString(36).substring(7)}`,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      avatarUrl: null,
      role: roles[Math.floor(Math.random() * roles.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)] as any,
      subscriptionTier: tiers[Math.floor(Math.random() * tiers.length)],
      isPendingVerification: false,
      apisOwned: Math.floor(Math.random() * 5),
      apisSubscribed: Math.floor(Math.random() * 20),
      joinedAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
      lastLoginAt: new Date(Date.now() - Math.random() * 1000000000).toISOString()
    });
  }
  return users;
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------
export const AdminUsers = () => {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [tierFilter, setTierFilter] = useState<string>('ALL');

  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailUserTarget, setEmailUserTarget] = useState<AdminUserRow | null>(null);

  // Initialization
  useEffect(() => {
    setUsers(generateMockUsers());
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filtering Logic
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchSearch = u.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
                          u.email.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchStatus = statusFilter === 'ALL' || u.status === statusFilter;
      const matchTier = tierFilter === 'ALL' || u.subscriptionTier === tierFilter;
      
      return matchSearch && matchRole && matchStatus && matchTier;
    });
  }, [users, debouncedSearch, roleFilter, statusFilter, tierFilter]);

  // Handlers for Drawer actions
  const handleUpdateStatus = (id: string, newStatus: string) => {
    setUsers((prev: AdminUserRow[]) => prev.map(u => u.id === id ? { ...u, status: newStatus as any } : u));
    if (selectedUser?.id === id) setSelectedUser((prev: AdminUserRow | null) => prev ? { ...prev, status: newStatus as any } : null);
  };

  const handleUpdateRole = (id: string, newRole: string) => {
    setUsers((prev: AdminUserRow[]) => prev.map(u => u.id === id ? { ...u, role: newRole as any } : u));
    if (selectedUser?.id === id) setSelectedUser((prev: AdminUserRow | null) => prev ? { ...prev, role: newRole as any } : null);
  };

  const handleUpdateTier = (id: string, newTier: string) => {
    setUsers((prev: AdminUserRow[]) => prev.map(u => u.id === id ? { ...u, subscriptionTier: newTier as any } : u));
    if (selectedUser?.id === id) setSelectedUser((prev: AdminUserRow | null) => prev ? { ...prev, subscriptionTier: newTier as any } : null);
  };

  const handleSendEmail = (subject: string, message: string) => {
    // In a real app, dispatch to backend here
    console.log(`Sending email to ${emailUserTarget?.email}`, { subject, message });
    setIsEmailModalOpen(false);
    setEmailUserTarget(null);
  };

  return (
    <div className="admin-users-container">
      <div className="users-header">
        <h1>User Management</h1>
        
        <div className="users-controls">
          <div className="search-input-wrapper">
            <Search size={16} />
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search by name or email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="query-builder">
            <Filter size={16} color="var(--text-muted)" style={{ marginRight: 4 }} />
            
            <div className="query-clause">
              <span className="query-field">Role</span>
              <span className="query-operator">is</span>
              <select 
                className="filter-select" 
                style={{ minWidth: 0, padding: '2px 4px', border: 'none', background: 'transparent', height: 'auto', fontSize: 12, fontWeight: 600, color: '#22c55e' }}
                value={roleFilter} 
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="ALL">Any</option>
                <option value="USER">User</option>
                <option value="PROVIDER">Provider</option>
                <option value="MODERATOR">Moderator</option>
                <option value="ADMIN">Admin</option>
              </select>
              {roleFilter !== 'ALL' && <button className="query-remove" onClick={() => setRoleFilter('ALL')}><X size={12} /></button>}
            </div>

            <span className="query-and">AND</span>

            <div className="query-clause">
              <span className="query-field">Status</span>
              <span className="query-operator">is</span>
              <select 
                className="filter-select" 
                style={{ minWidth: 0, padding: '2px 4px', border: 'none', background: 'transparent', height: 'auto', fontSize: 12, fontWeight: 600, color: '#22c55e' }}
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Any</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="BANNED">Banned</option>
              </select>
              {statusFilter !== 'ALL' && <button className="query-remove" onClick={() => setStatusFilter('ALL')}><X size={12} /></button>}
            </div>

            <span className="query-and">AND</span>

            <div className="query-clause">
              <span className="query-field">Tier</span>
              <span className="query-operator">is</span>
              <select 
                className="filter-select" 
                style={{ minWidth: 0, padding: '2px 4px', border: 'none', background: 'transparent', height: 'auto', fontSize: 12, fontWeight: 600, color: '#22c55e' }}
                value={tierFilter} 
                onChange={(e) => setTierFilter(e.target.value)}
              >
                <option value="ALL">Any</option>
                <option value="FREE">Free</option>
                <option value="PRO">Pro</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
              {tierFilter !== 'ALL' && <button className="query-remove" onClick={() => setTierFilter('ALL')}><X size={12} /></button>}
            </div>

            <button className="btn-add-query">
              <Plus size={12} /> Add filter
            </button>
          </div>
        </div>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Tier</th>
              <th>APIs (Sub/Own)</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No users match your filters.
                </td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.id} onClick={() => setSelectedUser(user)}>
                  <td>
                    <div className="user-cell-info">
                      <div className="user-avatar">{user.name.charAt(0)}</div>
                      <div>
                        <span className="user-name">{user.name}</span>
                        <span className="user-email">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td><span className={`pill role-${user.role}`}>{user.role}</span></td>
                  <td><span className={`pill status-${user.status}`}>{user.status}</span></td>
                  <td><span className={`pill tier-${user.subscriptionTier}`}>{user.subscriptionTier}</span></td>
                  <td style={{ color: 'var(--text-secondary)' }}>
                    {user.apisSubscribed} / {user.apisOwned}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {new Date(user.joinedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      <UserDrawer 
        user={selectedUser} 
        onClose={() => setSelectedUser(null)} 
        onOpenEmail={(u) => { setIsEmailModalOpen(true); setEmailUserTarget(u); }}
        onUpdateStatus={handleUpdateStatus}
        onUpdateRole={handleUpdateRole}
        onUpdateTier={handleUpdateTier}
      />

      {/* Email Modal */}
      {isEmailModalOpen && emailUserTarget && (
        <EmailModal 
          user={emailUserTarget} 
          onClose={() => { setIsEmailModalOpen(false); setEmailUserTarget(null); }} 
          onSend={handleSendEmail} 
        />
      )}
    </div>
  );
};
