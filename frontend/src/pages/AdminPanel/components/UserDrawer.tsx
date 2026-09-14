import React, { useState } from 'react';
import { X, ShieldAlert, Mail, Activity, Ban, CheckCircle, Settings, LogIn, Key, ArrowUpCircle, Laptop, Smartphone, Globe, Save } from 'lucide-react';
import { AdminUserRow } from '../../../types/adminUsers';

interface UserDrawerProps {
  user: AdminUserRow | null;
  onClose: () => void;
  onOpenEmail: (user: AdminUserRow) => void;
  onUpdateStatus: (userId: string, newStatus: string) => void;
  onUpdateRole: (userId: string, newRole: string) => void;
  onUpdateTier: (userId: string, newTier: string) => void;
}

export const UserDrawer: React.FC<UserDrawerProps> = ({ 
  user, 
  onClose, 
  onOpenEmail,
  onUpdateStatus,
  onUpdateRole,
  onUpdateTier
}) => {
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [rateLimit, setRateLimit] = useState('1000');
  
  if (!user) return null;

  // Mock telemetry data for the tracker
  const mockTelemetry = {
    errorViolations: user.apisSubscribed > 0 ? Math.floor(Math.random() * 50) : 0,
    suddenSpike: Math.random() > 0.7,
    suspiciousIP: Math.random() > 0.8
  };

  const hasAnomalies = mockTelemetry.errorViolations > 20 || mockTelemetry.suddenSpike || mockTelemetry.suspiciousIP;

  const handleImpersonate = () => {
    setIsImpersonating(true);
    setTimeout(() => {
      // In a real app, this would redirect with a short-lived token
      alert(`Initiating God-Mode. Redirecting to ${user.name}'s dashboard...`);
      setIsImpersonating(false);
    }, 1000);
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={e => e.stopPropagation()}>
        
        {isImpersonating && (
          <div style={{ background: '#ef4444', color: '#fff', padding: '8px', textAlign: 'center', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Activity size={12} style={{ display: 'inline', marginRight: 8, marginBottom: -2 }} className="spin-icon" />
            Initializing Impersonation Protocol...
          </div>
        )}

        <div className="drawer-header">
          <div style={{ flex: 1 }}>
            <div className="user-cell-info" style={{ marginBottom: 12, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="user-avatar" style={{ width: 48, height: 48, fontSize: 18 }}>
                  {user.name.charAt(0)}
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{user.name}</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{user.email}</p>
                </div>
              </div>
              
              {/* God-Mode Button */}
              <button className="btn-impersonate" onClick={handleImpersonate}>
                <LogIn size={14} /> Log In As User
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: 8 }}>
              <span className={`pill status-${user.status}`}>{user.status}</span>
              <span className={`pill role-${user.role}`}>{user.role}</span>
              <span className={`pill tier-${user.subscriptionTier}`}>{user.subscriptionTier}</span>
            </div>
          </div>
          <button className="drawer-close" style={{ marginLeft: 16 }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="drawer-content">
          {/* Section: Overview */}
          <div className="drawer-section">
            <h3 className="drawer-section-title">Account Overview</h3>
            <div className="drawer-row">
              <span className="drawer-label">ID</span>
              <span className="drawer-value" style={{ fontFamily: 'var(--font-mono)' }}>{user.id}</span>
            </div>
            <div className="drawer-row">
              <span className="drawer-label">Joined</span>
              <span className="drawer-value">{new Date(user.joinedAt).toLocaleDateString()}</span>
            </div>
            <div className="drawer-row">
              <span className="drawer-label">Last Login</span>
              <span className="drawer-value">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}</span>
            </div>
            <div className="drawer-row">
              <span className="drawer-label">APIs Owned / Subscribed</span>
              <span className="drawer-value">{user.apisOwned} / {user.apisSubscribed}</span>
            </div>
          </div>

          {/* Section: Role & Sub Management */}
          <div className="drawer-section">
            <h3 className="drawer-section-title">
              <Settings size={16} /> Configuration overrides
            </h3>
            <div className="drawer-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="drawer-label">Assign Role</span>
                <select 
                  className="filter-select" 
                  value={user.role}
                  onChange={(e) => onUpdateRole(user.id, e.target.value)}
                >
                  <option value="USER">Consumer</option>
                  <option value="PROVIDER">Provider</option>
                  <option value="MODERATOR">Moderator</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="drawer-label">Override Tier</span>
                <select 
                  className="filter-select"
                  value={user.subscriptionTier}
                  onChange={(e) => onUpdateTier(user.id, e.target.value)}
                >
                  <option value="FREE">Free</option>
                  <option value="PRO">Developer (Pro)</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
            </div>
          </div>

          {/* NEW SECTION: Global Rate Limits */}
          <div className="drawer-section">
            <h3 className="drawer-section-title">
              <Activity size={16} /> Global Rate Limits (God-Mode)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Manually bypass the standard rate limits inherited from their {user.subscriptionTier} plan. Use with caution.
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="drawer-label">Requests per Second</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="text" className="rate-override-input" value={rateLimit} onChange={e => setRateLimit(e.target.value)} />
                  <button className="btn-drawer btn-secondary" style={{ padding: '6px 12px' }}>Apply</button>
                </div>
              </div>
            </div>
          </div>

          {/* NEW SECTION: Raw Metadata Editor */}
          <div className="drawer-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="drawer-section-title" style={{ margin: 0 }}>
                <Settings size={16} /> Raw Metadata JSON
              </h3>
              <button className="btn-drawer" style={{ background: 'transparent', color: '#a78bfa', padding: 0 }}>
                <Save size={14} /> Save
              </button>
            </div>
            <textarea 
              className="raw-json-editor" 
              defaultValue={JSON.stringify({ custom_flags: ["beta_tester", "no_throttle"], internal_notes: "VIP customer - DO NOT BAN", stripe_customer_id: "cus_mock9129" }, null, 2)} 
            />
          </div>

          {/* NEW SECTION: Active Sessions */}
          <div className="drawer-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className="drawer-section-title" style={{ margin: 0 }}>
                <Globe size={16} /> Active Sessions
              </h3>
              <button className="btn-drawer btn-danger" style={{ padding: '4px 8px', fontSize: 11 }}>
                Force Logout All
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="session-item">
                <div className="session-info">
                  <div className="session-icon"><Laptop size={16} /></div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>MacBook Pro - Chrome</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>New York, US • 192.168.1.44 • Current</div>
                  </div>
                </div>
                <button className="btn-drawer btn-secondary" style={{ padding: '4px 8px', fontSize: 11, color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}>Kill</button>
              </div>
              <div className="session-item">
                <div className="session-info">
                  <div className="session-icon"><Smartphone size={16} /></div>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>iPhone 15 - Safari</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Boston, US • 10.0.1.22 • 2 days ago</div>
                  </div>
                </div>
                <button className="btn-drawer btn-secondary" style={{ padding: '4px 8px', fontSize: 11, color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}>Kill</button>
              </div>
            </div>
          </div>

          {/* Premium Feature: Suspicious Activity Tracker */}
          <div className={`drawer-section ${hasAnomalies ? 'security-tracker' : ''}`}>
            <h3 className="drawer-section-title">
              <ShieldAlert size={16} /> Suspicious Activity Tracker
            </h3>
            
            {hasAnomalies ? (
              <>
                {mockTelemetry.errorViolations > 20 && (
                  <div className="anomaly-alert">
                    <Activity size={16} className="anomaly-icon" />
                    <div>
                      <div className="anomaly-title">High Rate Limit Violations</div>
                      <div className="anomaly-desc">{mockTelemetry.errorViolations} 429 errors in the last hour across subscribed APIs.</div>
                    </div>
                  </div>
                )}
                {mockTelemetry.suddenSpike && (
                  <div className="anomaly-alert">
                    <Activity size={16} className="anomaly-icon" />
                    <div>
                      <div className="anomaly-title">Sudden Traffic Spike</div>
                      <div className="anomaly-desc">Traffic volume increased by 400% in the last 15 minutes compared to moving average.</div>
                    </div>
                  </div>
                )}
                {mockTelemetry.suspiciousIP && (
                  <div className="anomaly-alert">
                    <Activity size={16} className="anomaly-icon" />
                    <div>
                      <div className="anomaly-title">Suspicious Origin</div>
                      <div className="anomaly-desc">Requests originating from a known proxy/VPN IP block in unexpected regions.</div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={14} color="#22c55e" /> No suspicious behavior detected in the last 30 days.
              </div>
            )}
          </div>

        </div>

        <div className="drawer-actions">
          <button className="btn-drawer btn-secondary" onClick={() => onOpenEmail(user)}>
            <Mail size={16} /> Send Email
          </button>
          
          {user.status === 'ACTIVE' ? (
            <button className="btn-drawer btn-warning" onClick={() => onUpdateStatus(user.id, 'SUSPENDED')}>
              <Ban size={16} /> Suspend User
            </button>
          ) : (
            <button className="btn-drawer btn-primary" onClick={() => onUpdateStatus(user.id, 'ACTIVE')}>
              <CheckCircle size={16} /> Activate User
            </button>
          )}

          <button className="btn-drawer btn-danger" style={{ gridColumn: '1 / -1' }} onClick={() => onUpdateStatus(user.id, 'BANNED')}>
            <X size={16} /> Delete Account
          </button>
        </div>
      </div>
    </div>
  );
};
