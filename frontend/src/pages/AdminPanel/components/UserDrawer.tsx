import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, Activity, LogIn, Key, Ban, UserCog, CheckCircle, Clock } from 'lucide-react';
import { AdminUserRow } from '../../../types/adminUsers';

interface UserDrawerProps {
  user: AdminUserRow | null;
  onClose: () => void;
  onOpenEmail: (user: AdminUserRow) => void;
  onUpdateStatus: (userId: string, newStatus: string) => void;
  onUpdateRole: (userId: string, newRole: string) => void;
  onUpdateTier: (userId: string, newTier: string) => void;
}

type TabType = 'overview' | 'security' | 'activity';

export const UserDrawer: React.FC<UserDrawerProps> = ({ 
  user, 
  onClose, 
  onUpdateStatus,
  onUpdateRole
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id && activeTab === 'security') {
      fetch(`/api/v1/admin/users/${user.id}/api-keys`)
        .then(r => r.json())
        .then(res => {
          if (res.success) setApiKeys(res.data);
        });
    }
  }, [user?.id, activeTab]);

  const handleRevokeKey = async (keyId: string) => {
    if (window.confirm("Are you sure you want to permanently revoke this API Key?")) {
      try {
        const res = await fetch(`/api/v1/admin/api-keys/${keyId}/revoke`, { method: 'POST' });
        if (res.ok) {
          setApiKeys(prev => prev.filter(k => k.id !== keyId));
          // toast.success("API Key Revoked") could go here if toast is available
        }
      } catch (err) {
        console.error("Failed to revoke key", err);
      }
    }
  };

  const SYSTEM_ROLES = ['USER', 'PROVIDER', 'MODERATOR', 'ADMIN'];

  // Helper to generate avatar color from initials
  const getAvatarColor = (name: string) => {
    const colors = ['from-indigo-500 to-purple-500', 'from-pink-500 to-rose-500', 'from-emerald-400 to-cyan-400', 'from-amber-400 to-orange-500'];
    const charCode = name.charCodeAt(0) || 0;
    return colors[charCode % colors.length];
  };

  const handleImpersonate = async () => {
    setIsImpersonating(true);
    try {
      const adminToken = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const res = await fetch(`/api/v1/admin/users/${user?.id}/impersonate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (!res.ok) throw new Error('Impersonation failed');
      
      const json = await res.json();
      const newAccessToken = json.data?.accessToken;
      
      if (newAccessToken) {
        localStorage.setItem('admin_token_backup', adminToken as string);
        localStorage.setItem('klyra_access_token', newAccessToken);
        localStorage.setItem('klyra_token', newAccessToken);
        window.location.href = '/dashboard';
      }
    } catch (err) {
      console.error('[Impersonate]', err);
      alert('Failed to initiate God-Mode. Please try again.');
    } finally {
      setIsImpersonating(false);
    }
  };

  return (
    <AnimatePresence>
      {user && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Slide-Over Drawer */}
          <motion.div 
            initial={{ x: '100%', opacity: 0, scale: 0.95 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: '100%', opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-[110] w-full max-w-2xl bg-[#0a0a0f] border-l border-white/5 shadow-2xl shadow-black/80 flex flex-col"
          >
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 px-8 py-6 border-b border-white/5 bg-[#0a0a0f]/90 backdrop-blur-xl flex flex-col gap-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${getAvatarColor(user.name)} flex items-center justify-center text-xl font-bold text-white shadow-lg shadow-black/50`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">{user.name}</h2>
                    <p className="text-sm text-white/50">{user.email}</p>
                  </div>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors outline-none"
                >
                  <X size={20} />
                </button>
              </div>

              {/* God-Mode Actions */}
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleImpersonate}
                  className="flex-1 h-9 bg-white text-black font-semibold text-[13px] rounded-lg flex items-center justify-center gap-2 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-lg shadow-white/10 group"
                >
                  {isImpersonating ? <Activity className="animate-spin" size={16} /> : <LogIn size={16} className="group-hover:translate-x-0.5 transition-transform" />}
                  Impersonate User
                </button>
                <button 
                  onClick={() => onUpdateStatus(user.id, user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                  className="flex-1 h-9 bg-rose-500/10 text-rose-400 font-semibold text-[13px] rounded-lg flex items-center justify-center gap-2 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20"
                >
                  <Ban size={16} />
                  {user.status === 'ACTIVE' ? 'Suspend Account' : 'Activate Account'}
                </button>
                <div className="flex-1 relative">
                  <button 
                    onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
                    className="w-full h-9 bg-white/5 text-white font-semibold text-[13px] rounded-lg flex items-center justify-center gap-2 hover:bg-white/10 transition-all border border-white/5"
                  >
                    <UserCog size={16} />
                    {user.role}
                  </button>
                  
                  <AnimatePresence>
                    {isRoleMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="absolute right-0 mt-2 w-40 bg-[#12121a]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden py-1"
                      >
                        {SYSTEM_ROLES.map((r) => (
                          <button
                            key={r}
                            onClick={() => {
                              onUpdateRole(user.id, r);
                              setIsRoleMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors text-left ${user.role === r ? 'text-indigo-400 bg-indigo-500/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                          >
                            {r}
                            {user.role === r && <CheckCircle size={14} className="text-indigo-400" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-6 border-b border-white/5 pt-2">
                {(['overview', 'security', 'activity'] as TabType[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-3 text-sm font-medium capitalize transition-colors relative outline-none ${activeTab === tab ? 'text-white' : 'text-white/40 hover:text-white/70'}`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <motion.div layoutId="drawer-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'overview' && (
                    <div className="space-y-8">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                          <span className="text-[12px] font-semibold text-white/40 uppercase tracking-wider">Total API Calls</span>
                          <span className="text-3xl font-bold text-white">{(user.apisSubscribed * 1420).toLocaleString()}</span>
                        </div>
                        <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-1">
                          <span className="text-[12px] font-semibold text-white/40 uppercase tracking-wider">Current Plan</span>
                          <span className="text-3xl font-bold text-amber-400">{user.subscriptionTier}</span>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-white mb-4">Account Details</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 rounded-xl hover:bg-white/5 transition-colors">
                            <span className="text-sm text-white/50">User ID</span>
                            <span className="text-sm font-mono text-white/80">{user.id}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-xl hover:bg-white/5 transition-colors">
                            <span className="text-sm text-white/50">Date Joined</span>
                            <span className="text-sm text-white/80">{new Date(user.joinedAt).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-xl hover:bg-white/5 transition-colors">
                            <span className="text-sm text-white/50">Last Login</span>
                            <span className="text-sm text-white/80">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'security' && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-white">Active API Keys</h3>
                        <button className="text-[12px] font-semibold text-indigo-400 hover:text-indigo-300">Generate New Key</button>
                      </div>
                      
                      {apiKeys.length === 0 ? (
                        <div className="text-white/40 text-sm italic">No active API keys found.</div>
                      ) : apiKeys.map((key) => (
                        <div key={key.id} className="p-5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between group">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                              <Key size={18} />
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-white mb-0.5">{key.name || 'Production Key'}</div>
                              <div className="text-[12px] font-mono text-white/40">{key.key_prefix}...</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleRevokeKey(key.id)}
                            className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 text-[12px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white border border-rose-500/20"
                          >
                            Revoke Key
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeTab === 'activity' && (
                    <div className="relative pl-6 space-y-8 before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-white/5">
                      {[
                        { title: 'Logged in from New IP', desc: 'New York, US (192.168.1.1)', time: '2 hours ago', icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-400/10' },
                        { title: 'Generated API Key', desc: 'Production Key 2 created.', time: '1 day ago', icon: Key, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
                        { title: 'Upgraded Subscription', desc: 'Changed tier from FREE to PRO.', time: '3 days ago', icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                        { title: 'Account Created', desc: 'User signed up successfully.', time: '2 weeks ago', icon: CheckCircle, color: 'text-white/70', bg: 'bg-white/10' },
                      ].map((event, i) => (
                        <div key={i} className="relative">
                          <div className={`absolute -left-[30px] w-6 h-6 rounded-full flex items-center justify-center ${event.bg} border border-[#0a0a0f] shadow-sm shadow-black/50 z-10`}>
                            <event.icon size={10} className={event.color} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-white mb-1">{event.title}</div>
                            <div className="text-[13px] text-white/50">{event.desc}</div>
                            <div className="text-[11px] text-white/30 flex items-center gap-1 mt-2">
                              <Clock size={10} /> {event.time}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
