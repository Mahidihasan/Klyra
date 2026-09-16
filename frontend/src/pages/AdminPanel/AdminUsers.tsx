import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Filter, MoreVertical, X, Plus, Copy, Eye, Ban, Trash2, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { 
  AdminUserRow, 
  UserRoleValue, 
  UserStatusFilter, 
  UserSubscriptionTier 
} from '../../types/adminUsers';
import { UserDrawer } from './components/UserDrawer';
import { EmailModal } from './components/EmailModal';
import { InfiniteMatrixTable, ColumnDef } from '../../components/DataTable/InfiniteMatrixTable';
import { FloatingActionBar } from '../../components/DataTable/FloatingActionBar';
import { AddUserModal } from './components/AddUserModal';
import './AdminUsers.css';

// Toast style constants
const TOAST_STYLE = { background: '#18181b', color: '#fff', border: '1px solid #27272a' };

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------
export const AdminUsers = () => {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // id of user whose Suspend button is being held — for friction confirmation
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getToken = () =>
    localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');

  // ── Real data fetch ────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/users?limit=100&sort=joined&direction=desc', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const json = await res.json();
        // listUsers returns { users, total, page, limit }
        setUsers(json.data?.users || json.data || []);
      }
    } catch (err) {
      console.error('[AdminUsers] fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [tierFilter, setTierFilter] = useState<string>('ALL');

  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailUserTarget, setEmailUserTarget] = useState<AdminUserRow | null>(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, user: AdminUserRow } | null>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // ── Debounce search ──────────────────────────────────────────────
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

  // ── Status mutation — wired to PATCH /api/v1/admin/users/:id/status ──
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    // Optimistic update
    setUsers((prev) => prev.map(u => u.id === id ? { ...u, status: newStatus as any } : u));
    if (selectedUser?.id === id) setSelectedUser((prev) => prev ? { ...prev, status: newStatus as any } : null);

    try {
      const res = await fetch(`/api/v1/admin/users/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ status: newStatus, reason: `Status changed to ${newStatus} by admin` })
      });
      if (!res.ok) throw new Error('Failed to update status');
      toast.success(`User status set to ${newStatus}`, { style: TOAST_STYLE });
    } catch (err: any) {
      // Revert on failure
      toast.error(err.message || 'Status update failed', { style: TOAST_STYLE });
      fetchUsers();
    }
  };

  // ── Role mutation — wired to PATCH /api/v1/admin/users/:id/role ──
  const handleUpdateRole = async (id: string, newRole: string) => {
    // Optimistic update
    setUsers((prev) => prev.map(u => u.id === id ? { ...u, role: newRole as any } : u));
    if (selectedUser?.id === id) setSelectedUser((prev) => prev ? { ...prev, role: newRole as any } : null);

    try {
      const res = await fetch(`/api/v1/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ role: newRole.toUpperCase() })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const err: any = new Error(errorData.error || errorData.message || 'Failed to update role');
        err.response = { data: errorData };
        throw err;
      }
      toast.success(`Role updated to ${newRole}`, { style: TOAST_STYLE });
    } catch (error: any) {
      const backendError = error.response?.data?.error || error.response?.data?.message || error.message || "Unknown error";
      console.error("FULL ERROR OBJECT:", error.response);
      toast.error(`Error: ${backendError}`, { style: TOAST_STYLE });
      fetchUsers();
    }
  };

  const handleUpdateTier = (id: string, newTier: string) => {
    setUsers((prev: AdminUserRow[]) => prev.map(u => u.id === id ? { ...u, subscriptionTier: newTier as any } : u));
    if (selectedUser?.id === id) setSelectedUser((prev: AdminUserRow | null) => prev ? { ...prev, subscriptionTier: newTier as any } : null);
  };

  // ── Reset API Key — wired to POST /api/v1/admin/users/:id/reset-key ──
  const handleResetKey = async (userId: string) => {
    const promise = fetch(`/api/v1/admin/users/${userId}/reset-key`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    }).then(async (res) => {
      if (!res.ok) throw new Error('Key reset failed');
      const json = await res.json();
      return json.data?.keyPrefix;
    });

    toast.promise(promise, {
      loading: 'Revoking all keys & generating new one…',
      success: (prefix) => `New key issued: ${prefix}`,
      error: 'Failed to reset API key',
    }, { style: TOAST_STYLE });
  };

  // ── Framer Motion hold-to-suspend helpers ──────────────────────────
  const startSuspendHold = (userId: string) => {
    setConfirmingId(userId);
    confirmTimerRef.current = setTimeout(() => {
      handleUpdateStatus(userId, 'SUSPENDED');
      setConfirmingId(null);
    }, 1500); // 1.5s hold fires the action
  };

  // ── Add User — wired to POST /api/v1/admin/users ──
  const handleAddUser = async (data: any) => {
    try {
      const res = await fetch(`/api/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const err: any = new Error(errorData.error || errorData.message || 'Failed to create user');
        err.response = { data: errorData };
        throw err;
      }
      toast.success('User created successfully', { style: TOAST_STYLE });
      setIsAddUserModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      const backendError = error.response?.data?.error || error.response?.data?.message || error.message || "Unknown error";
      console.error("FULL ERROR OBJECT:", error.response);
      toast.error(`Error: ${backendError}`, { style: TOAST_STYLE });
      throw error;
    }
  };

  const cancelSuspendHold = () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    setConfirmingId(null);
  };

  const handleSendEmail = (subject: string, message: string) => {
    // In a real app, dispatch to backend here
    console.log(`Sending email to ${emailUserTarget?.email}`, { subject, message });
    setIsEmailModalOpen(false);
    setEmailUserTarget(null);
  };

  // Helper to generate avatar color from initials
  const getAvatarColor = (name: string) => {
    const colors = ['from-indigo-500 to-purple-500', 'from-pink-500 to-rose-500', 'from-emerald-400 to-cyan-400', 'from-amber-400 to-orange-500'];
    const charCode = name.charCodeAt(0) || 0;
    return colors[charCode % colors.length];
  };

  const columns: ColumnDef<AdminUserRow>[] = useMemo(() => [
    { 
      id: 'name', 
      header: 'User', 
      accessorKey: 'name', 
      width: 320,
      cellRenderer: (row) => (
        <div className="flex items-center gap-3 w-full overflow-hidden">
          <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br ${getAvatarColor(row.name)} text-white font-medium shadow-lg shadow-black/20`}>
            {row.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col overflow-hidden w-full">
            <span className="font-medium text-[13px] text-white truncate">{row.name}</span>
            <span className="text-[11px] text-white/40 truncate">{row.email}</span>
          </div>
        </div>
      )
    },
    { 
      id: 'status', 
      header: 'Status', 
      accessorKey: 'status', 
      width: 140,
      cellRenderer: (row) => {
        const isSuspended = row.status === 'SUSPENDED' || row.status === 'BANNED';
        const isActive = row.status === 'ACTIVE';
        return (
          <div className="flex items-center gap-2">
            <div className="relative flex h-2 w-2">
              {isActive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isActive ? 'bg-emerald-500' : isSuspended ? 'bg-rose-500' : 'bg-zinc-500'}`}></span>
            </div>
            <span className={`text-[12px] font-medium capitalize ${isActive ? 'text-emerald-400' : isSuspended ? 'text-rose-400' : 'text-zinc-400'}`}>
              {row.status.toLowerCase()}
            </span>
          </div>
        )
      }
    },
    { 
      id: 'role', 
      header: 'Role', 
      accessorKey: 'role', 
      width: 130,
      cellRenderer: (row) => (
        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          {row.role}
        </div>
      )
    },
    { 
      id: 'tier', 
      header: 'Plan', 
      accessorKey: 'subscriptionTier', 
      width: 130,
      cellRenderer: (row) => {
        const isPro = row.subscriptionTier === 'PRO' || row.subscriptionTier === 'ENTERPRISE';
        return (
          <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${isPro ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-white/5 text-white/50 border border-white/5'}`}>
            {row.subscriptionTier}
          </div>
        )
      }
    },
    { id: 'apis', header: 'APIs (Sub/Own)', accessorKey: 'apisSubscribed', width: 150 },
  ], []);

  const handleCellSave = (rowId: string, columnId: string, newValue: string) => {
    setUsers(prev => prev.map(u => u.id === rowId ? { ...u, [columnId]: newValue } : u));
  };

  const handleBulkDelete = () => {
    setUsers(prev => prev.filter(u => !selectedRowIds.has(u.id)));
    setSelectedRowIds(new Set());
  };

  return (
    <div className="admin-users-container">
      <Toaster position="bottom-right" />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight mb-1">Users</h1>
          <p className="text-sm text-white/50">Manage access, roles, and platform activity.</p>
        </div>
        <button 
          onClick={() => setIsAddUserModalOpen(true)}
          className="h-9 px-4 rounded-full bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors shadow-lg shadow-white/10 flex items-center gap-2"
        >
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Smart Filtering Bar */}
      <div className="flex items-center gap-3 p-1.5 rounded-2xl bg-[#0a0a0f]/80 backdrop-blur-md border border-white/5 shadow-2xl shadow-black/50 mb-6">
        <div className="flex items-center flex-1 h-10 px-3 gap-2 bg-white/5 rounded-xl border border-white/5 focus-within:border-white/20 focus-within:bg-white/10 transition-colors">
          <Search size={16} className="text-white/40" />
          <input 
            type="text" 
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder:text-white/30" 
            placeholder="Search by name or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="w-[1px] h-6 bg-white/10 mx-1"></div>

        <div className="flex items-center gap-2 pr-2">
          <div className="relative group">
            <select 
              className="appearance-none h-10 pl-3 pr-8 rounded-xl bg-transparent text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 border border-transparent cursor-pointer outline-none transition-colors"
              value={roleFilter} 
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL" className="bg-[#12121a]">Role: All</option>
              <option value="USER" className="bg-[#12121a]">User</option>
              <option value="PROVIDER" className="bg-[#12121a]">Provider</option>
              <option value="MODERATOR" className="bg-[#12121a]">Moderator</option>
              <option value="ADMIN" className="bg-[#12121a]">Admin</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 group-hover:text-white/70">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>

          <div className="relative group">
            <select 
              className="appearance-none h-10 pl-3 pr-8 rounded-xl bg-transparent text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 border border-transparent cursor-pointer outline-none transition-colors"
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL" className="bg-[#12121a]">Status: All</option>
              <option value="ACTIVE" className="bg-[#12121a]">Active</option>
              <option value="SUSPENDED" className="bg-[#12121a]">Suspended</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 group-hover:text-white/70">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
          
          <div className="relative group">
            <select 
              className="appearance-none h-10 pl-3 pr-8 rounded-xl bg-transparent text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 border border-transparent cursor-pointer outline-none transition-colors"
              value={tierFilter} 
              onChange={(e) => setTierFilter(e.target.value)}
            >
              <option value="ALL" className="bg-[#12121a]">Plan: All</option>
              <option value="FREE" className="bg-[#12121a]">Free</option>
              <option value="PRO" className="bg-[#12121a]">Pro</option>
              <option value="ENTERPRISE" className="bg-[#12121a]">Enterprise</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40 group-hover:text-white/70">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
        </div>
      </div>

      <div 
        className="flex-1 min-h-0 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ 
          transform: selectedUser ? 'scale(0.98)' : 'scale(1)', 
          transformOrigin: 'center center',
          opacity: selectedUser ? 0.6 : 1,
          pointerEvents: selectedUser ? 'none' : 'auto'
        }}
      >
        {/* ── Skeleton rows while loading ── */}
        {isLoading && (
          <div className="flex flex-col gap-2 mt-4">
            {[0,1,2,3,4,5,6,7].map((i) => (
              <div key={i} className="animate-pulse bg-white/5 h-12 w-full rounded-lg" style={{ opacity: 1 - i * 0.1 }} />
            ))}
          </div>
        )}

        {/* ── Real table ── */}
        {!isLoading && (
          <InfiniteMatrixTable
            data={filteredUsers}
            columns={columns}
            selectedRowIds={selectedRowIds}
            onSelectionChange={setSelectedRowIds}
            onCellSave={handleCellSave}
            getRowId={(row) => row.id}
            rowHeight={64}
            onRowClick={(row) => setSelectedUser(row)}
            onContextMenu={(e, row) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, user: row });
            }}
          />
        )}
      </div>

      <FloatingActionBar
        selectedCount={selectedRowIds.size}
        onClearSelection={() => setSelectedRowIds(new Set())}
        actions={[
          { label: 'Bulk Suspend', onClick: () => console.log('Bulk suspending...'), variant: 'danger' },
          { label: 'Change Role', onClick: () => console.log('Change role...') },
          { label: 'Export CSV', onClick: () => console.log('Exporting...') }
        ]}
      />

      {/* Custom Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-[9999] w-48 bg-[#12121a]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col py-1"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-2 border-b border-white/5 mb-1">
              <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider truncate">
                {contextMenu.user.name}
              </div>
            </div>
            
            <button 
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors text-left"
              onClick={() => { navigator.clipboard.writeText(contextMenu.user.email); setContextMenu(null); }}
            >
              <Copy size={14} /> Copy Email
            </button>
            <button 
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors text-left"
              onClick={() => { setSelectedUser(contextMenu.user); setContextMenu(null); }}
            >
              <Eye size={14} /> View Details
            </button>
            {/* Hold-to-Suspend button with Framer Motion fill animation */}
            <div className="relative overflow-hidden rounded">
              <button 
                className="relative z-10 w-full flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors text-left select-none"
                onMouseDown={() => { startSuspendHold(contextMenu.user.id); }}
                onMouseUp={cancelSuspendHold}
                onMouseLeave={cancelSuspendHold}
                onTouchStart={() => startSuspendHold(contextMenu.user.id)}
                onTouchEnd={cancelSuspendHold}
              >
                <Ban size={14} />
                <span>{confirmingId === contextMenu.user.id ? 'Hold to confirm…' : 'Suspend User'}</span>
              </button>
              {confirmingId === contextMenu.user.id && (
                <motion.div
                  className="absolute inset-0 bg-amber-500/20 origin-left"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1.5, ease: 'linear' }}
                />
              )}
            </div>
            <button 
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-sky-400 hover:bg-sky-500/10 hover:text-sky-300 transition-colors text-left"
              onClick={() => { handleResetKey(contextMenu.user.id); setContextMenu(null); }}
            >
              <KeyRound size={14} /> Reset API Key
            </button>
            <div className="h-[1px] bg-white/5 my-1" />
            <button 
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-rose-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors text-left"
              onClick={() => { setUsers(prev => prev.filter(u => u.id !== contextMenu.user.id)); setContextMenu(null); }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <AddUserModal 
          onClose={() => setIsAddUserModalOpen(false)}
          onAdd={handleAddUser}
        />
      )}
    </div>
  );
};
