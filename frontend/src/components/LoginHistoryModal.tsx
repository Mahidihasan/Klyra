import React, { useEffect, useState } from 'react';
import { X, Shield, CheckCircle2, XCircle, Globe, Laptop, RefreshCw } from 'lucide-react';
import { authApi, LoginHistoryItem } from '../services/api/auth';

interface LoginHistoryModalProps {
  onClose: () => void;
}

export const LoginHistoryModal: React.FC<LoginHistoryModalProps> = ({ onClose }) => {
  const [history, setHistory] = useState<LoginHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await authApi.loginHistory();
      setHistory(res.history);
    } catch (err: any) {
      setError(err.message || 'Failed to load login history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="history-modal-container card-base" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="history-modal-header">
          <div className="history-header-left">
            <div className="history-shield-icon">
              <Shield size={18} color="#8b5cf6" />
            </div>
            <div>
              <h3 className="history-modal-title">Login History & Audit Log</h3>
              <p className="history-modal-subtitle">Recent login activity and security audit trail for your account</p>
            </div>
          </div>
          <button className="history-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="history-modal-body">
          {loading ? (
            <div className="history-loading-state">
              <RefreshCw size={24} className="spin-icon" color="#8b5cf6" />
              <p>Loading security audit logs...</p>
            </div>
          ) : error ? (
            <div className="history-error-state">
              <p>{error}</p>
              <button className="inbox-btn" onClick={loadHistory}>Retry</button>
            </div>
          ) : history.length === 0 ? (
            <div className="history-empty-state">
              <Shield size={32} color="#3b3f60" />
              <p>No login audit records found.</p>
            </div>
          ) : (
            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Date & Time</th>
                    <th>Device / Browser</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td>
                        {item.success ? (
                          <span className="status-pill success">
                            <CheckCircle2 size={13} />
                            <span>Success</span>
                          </span>
                        ) : (
                          <span className="status-pill failed">
                            <XCircle size={13} />
                            <span>Failed</span>
                          </span>
                        )}
                      </td>
                      <td className="time-cell">
                        {new Date(item.timestamp).toLocaleString()}
                      </td>
                      <td className="device-cell">
                        <div className="device-info">
                          <Laptop size={14} className="device-icon" />
                          <span>{item.deviceSummary || 'Desktop Browser'}</span>
                        </div>
                      </td>
                      <td className="ip-cell">
                        <div className="ip-info">
                          <Globe size={13} className="ip-icon" />
                          <span>{item.ipAddress ? item.ipAddress.replace('/32', '') : '127.0.0.1'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="history-modal-footer">
          <span className="security-notice">
            🔒 Unrecognized login activity? Change your password immediately from the auth portal.
          </span>
          <button className="inbox-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <style>{`
        .history-modal-container {
          width: 720px;
          max-width: 92vw;
          max-height: 85vh;
          background: #121322;
          border: 1px solid #202237;
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 50px rgba(0,0,0,0.6);
          animation: fadeIn 0.2s ease-out;
          overflow: hidden;
          padding: 0;
        }

        .history-modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .history-header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .history-shield-icon {
          width: 36px;
          height: 36px;
          border-radius: 9px;
          background: rgba(139, 92, 246, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .history-modal-title {
          font-size: 16px;
          font-weight: 700;
          color: #f8fafc;
        }

        .history-modal-subtitle {
          font-size: 12px;
          color: #94a3b8;
        }

        .history-close-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          transition: all 0.15s ease;
        }

        .history-close-btn:hover {
          background: rgba(255,255,255,0.06);
          color: #f8fafc;
        }

        .history-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px 24px;
          min-height: 250px;
        }

        .history-loading-state,
        .history-empty-state,
        .history-error-state {
          height: 250px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #94a3b8;
          font-size: 13px;
        }

        .history-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .history-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .history-table th {
          text-align: left;
          padding: 10px 12px;
          color: #64748b;
          font-weight: 600;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.04em;
        }

        .history-table td {
          padding: 12px 12px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          color: #e2e8f0;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .status-pill.success {
          background: rgba(34, 197, 94, 0.12);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.25);
        }

        .status-pill.failed {
          background: rgba(239, 68, 68, 0.12);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .device-info, .ip-info {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .device-icon, .ip-icon {
          color: #64748b;
        }

        .history-modal-footer {
          padding: 16px 24px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(0,0,0,0.15);
        }

        .security-notice {
          font-size: 11px;
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
};
