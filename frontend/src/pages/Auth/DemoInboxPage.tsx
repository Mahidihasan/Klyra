import React, { useState, useEffect } from 'react';
import {
  Mail,
  RefreshCw,
  Trash2,
  CheckCircle,
  Copy,
  ExternalLink,
  ShieldCheck,
  KeyRound,
  Check,
} from 'lucide-react';
import { authApi, DemoEmailItem } from '../../services/api/auth';
import { AuthPage } from './AuthPage';
import klyraLogo from '../../assets/images/klyra_logo.png';

export const DemoInboxPage: React.FC = () => {
  const [emails, setEmails] = useState<DemoEmailItem[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<DemoEmailItem | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
  const [isVerifiedSuccess, setIsVerifiedSuccess] = useState<boolean>(false);
  const [actionNotification, setActionNotification] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [isResetComplete, setIsResetComplete] = useState<boolean>(false);
  const [redirectSeconds, setRedirectSeconds] = useState<number | null>(null);

  useEffect(() => {
    setIsVerifiedSuccess(false);
    setActionNotification(null);
    setIsResetComplete(false);
  }, [selectedEmail?.id]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('klyra_auth_channel');
    channel.onmessage = (event) => {
      if (event.data?.type === 'RESET_PASSWORD_COMPLETE') {
        setIsResetComplete(true);
        setActionNotification('Password reset successfully.');
        setRedirectSeconds(5);
      }
    };
    return () => channel.close();
  }, []);

  const syncToOriginalTab = (event: { type: string; token?: string; message?: string }) => {
    // 1. BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('klyra_auth_channel');
        bc.postMessage(event);
        bc.close();
      }
    } catch {}

    // 2. localStorage event
    try {
      localStorage.setItem('klyra_auth_sync', JSON.stringify({ ...event, timestamp: Date.now() }));
    } catch {}

    // 3. window.opener
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: 'KLYRA_AUTH_SYNC',
            action: event.type,
            token: event.token,
            message: event.message,
          },
          '*',
        );
        window.opener.focus();
      }
    } catch {}
  };

  const handleVerifyFromInbox = async (actionUrl?: string) => {
    if (!actionUrl) return;
    try {
      const url = new URL(actionUrl, window.location.origin);
      const token = url.searchParams.get('token');
      if (!token) return;

      setIsActionLoading(true);
      setVerificationToken(token);
    } catch (err: any) {
      setActionNotification(err.message || 'Verification failed.');
      setTimeout(() => setActionNotification(null), 6000);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResetFromInbox = (actionUrl?: string) => {
    if (!actionUrl) return;
    try {
      const url = new URL(actionUrl, window.location.origin);
      const token = url.searchParams.get('token');
      if (!token) return;

      setResetToken(token);
      syncToOriginalTab({ type: 'START_RESET_PASSWORD', token });
      setActionNotification('Password reset panel is ready in this tab and the auth tab.');
      setTimeout(() => setActionNotification(null), 6000);
    } catch (err: any) {
      setActionNotification(err.message || 'Failed to trigger reset.');
      setTimeout(() => setActionNotification(null), 6000);
    }
  };

  useEffect(() => {
    if (redirectSeconds === null) return;
    if (redirectSeconds <= 0) {
      if (window.opener && !window.opener.closed) {
        window.opener.focus();
      }
      window.close();
      return;
    }

    const timer = setTimeout(() => setRedirectSeconds((seconds) => (seconds ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
  }, [redirectSeconds]);

  const handleEmailBodyClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest('a');
    if (anchor && anchor.href) {
      const href = anchor.href;
      if (href.includes('auth=verify-email') && href.includes('token=')) {
        e.preventDefault();
        handleVerifyFromInbox(href);
      } else if (href.includes('auth=reset-password') && href.includes('token=')) {
        e.preventDefault();
        handleResetFromInbox(href);
      }
    }
  };

  const fetchEmails = async () => {
    try {
      setIsRefreshing(true);
      const res = await authApi.getDemoEmails();
      setEmails(res.emails);
      setSelectedEmail((current) => {
        if (!current) return res.emails[0] || null;
        return res.emails.find((email) => email.id === current.id) || current;
      });
    } catch {
      // Ignore poll errors
    } finally {
      setIsRefreshing(false);
    }
  };

  // Poll for new demo emails every 2.5 seconds
  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleClearAll = async () => {
    if (confirm('Clear all demo emails?')) {
      await authApi.clearDemoEmails();
      setEmails([]);
      setSelectedEmail(null);
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'VERIFY_EMAIL':
        return <span className="badge-category badge-verify">Email Verification</span>;
      case 'TWO_FACTOR_CODE':
        return <span className="badge-category badge-2fa">2FA Security Code</span>;
      case 'RESET_PASSWORD':
        return <span className="badge-category badge-reset">Password Reset</span>;
      default:
        return <span className="badge-category">System Email</span>;
    }
  };

  return (
    <div className="demo-inbox-wrapper">
      {resetToken && (
        <AuthPage
          isModal={true}
          initialMode="reset-password"
          initialToken={resetToken}
          onResetComplete={() => {
            setIsResetComplete(true);
            setActionNotification('Password reset successfully.');
            setRedirectSeconds(5);
          }}
          onClose={() => setResetToken(null)}
        />
      )}
      {verificationToken && !resetToken && (
        <AuthPage
          isModal={true}
          initialMode="verify-email"
          initialToken={verificationToken}
          onEmailVerified={(message) => {
            setIsVerifiedSuccess(true);
            syncToOriginalTab({ type: 'EMAIL_VERIFIED', token: verificationToken, message });
            setRedirectSeconds(5);
          }}
          onClose={() => setVerificationToken(null)}
        />
      )}
      {/* Top Header */}
      <header className="inbox-header">
        <div className="inbox-header-left">
          <img src={klyraLogo} alt="Klyra" className="inbox-logo-img" />
          <div>
            <div className="inbox-title-row">
              <h1 className="inbox-title">Klyra Demo Mailbox</h1>
              <span className="live-pill">
                <span className="live-dot" /> LIVE INBOX
              </span>
            </div>
            <p className="inbox-subtitle">
              Mock email client for testing verification links, new-device 2FA codes, and password
              reset workflows.
            </p>
          </div>
        </div>

        <div className="inbox-header-actions">
          <button
            className="inbox-btn"
            onClick={fetchEmails}
            disabled={isRefreshing}
            title="Refresh emails"
          >
            <RefreshCw size={15} className={isRefreshing ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
          <button className="inbox-btn danger" onClick={handleClearAll} title="Clear all emails">
            <Trash2 size={15} />
            <span>Clear Inbox</span>
          </button>
        </div>
      </header>

      {/* Main Mailbox Content */}
      <div className="inbox-body">
        {/* Left: Email List */}
        <aside className="inbox-sidebar">
          <div className="inbox-sidebar-top">
            <span className="sidebar-count-label">
              Inbox ({emails.length} {emails.length === 1 ? 'message' : 'messages'})
            </span>
          </div>

          <div className="email-list">
            {emails.length === 0 ? (
              <div className="empty-inbox">
                <Mail size={32} className="empty-inbox-icon" />
                <p className="empty-inbox-title">Inbox is empty</p>
                <p className="empty-inbox-desc">
                  Trigger an action in Klyra (Register, New Device Login, or Forgot Password) to
                  receive an email here in real time.
                </p>
              </div>
            ) : (
              emails.map((email) => {
                const isSelected = selectedEmail?.id === email.id;
                return (
                  <div
                    key={email.id}
                    className={`email-list-item ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedEmail(email)}
                  >
                    <div className="email-item-header">
                      <span className="email-from">{email.from}</span>
                      <span className="email-time">
                        {new Date(email.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="email-item-subject">{email.subject}</div>
                    <div className="email-item-preview">{email.previewText}</div>
                    <div className="email-item-footer">
                      {getCategoryBadge(email.category)}
                      <span className="email-to-pill">To: {email.to}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right: Email Detail Pane */}
        <main className="email-detail-pane">
          {selectedEmail ? (
            <div className="email-detail-content">
              {/* Detail Header */}
              <div className="detail-header">
                <div className="detail-subject-row">
                  <h2 className="detail-subject">{selectedEmail.subject}</h2>
                  {getCategoryBadge(selectedEmail.category)}
                </div>

                <div className="detail-meta-card">
                  <div className="meta-line">
                    <span className="meta-label">From:</span>
                    <span className="meta-value from">{selectedEmail.from}</span>
                  </div>
                  <div className="meta-line">
                    <span className="meta-label">To:</span>
                    <span className="meta-value">{selectedEmail.to}</span>
                  </div>
                  <div className="meta-line">
                    <span className="meta-label">Date:</span>
                    <span className="meta-value">
                      {new Date(selectedEmail.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Quick Action Banner */}
                {selectedEmail.category === 'TWO_FACTOR_CODE' && selectedEmail.code && (
                  <div className="action-banner two-factor">
                    <div className="banner-left">
                      <KeyRound size={22} className="banner-icon" />
                      <div>
                        <div className="banner-title">Two-Factor Authentication Code</div>
                        <div className="banner-code">{selectedEmail.code}</div>
                      </div>
                    </div>
                    <button
                      className="copy-btn"
                      onClick={() => handleCopyCode(selectedEmail.code!)}
                    >
                      {copiedCode === selectedEmail.code ? (
                        <>
                          <Check size={16} />
                          <span>Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          <span>Copy 2FA Code</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {selectedEmail.category === 'VERIFY_EMAIL' && selectedEmail.actionUrl && (
                  <div className="action-banner verify">
                    <div className="banner-left">
                      <ShieldCheck size={22} className="banner-icon" />
                      <div>
                        <div className="banner-title">Account Email Verification</div>
                        <div className="banner-subtitle">
                          Click below to activate your Klyra account:
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="action-link-btn"
                      onClick={() => handleVerifyFromInbox(selectedEmail.actionUrl)}
                      disabled={isActionLoading}
                    >
                      {isActionLoading ? (
                        <>
                          <RefreshCw size={14} className="spin-icon" />
                          <span>Verifying...</span>
                        </>
                      ) : isVerifiedSuccess ? (
                        <>
                          <Check size={14} />
                          <span>Verified! Tab Updated</span>
                        </>
                      ) : (
                        <>
                          <span>Verify Email Now</span>
                          <ExternalLink size={14} />
                        </>
                      )}
                    </button>
                  </div>
                )}

                {selectedEmail.category === 'RESET_PASSWORD' && selectedEmail.actionUrl && (
                  <div className="action-banner reset">
                    <div className="banner-left">
                      <KeyRound size={22} className="banner-icon" />
                      <div>
                        <div className="banner-title">Password Reset Link</div>
                        <div className="banner-subtitle">
                          Click below to reset your account password:
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="action-link-btn reset"
                      onClick={() => handleResetFromInbox(selectedEmail.actionUrl)}
                    >
                      {isResetComplete ? (
                        <>
                          <Check size={14} />
                          <span>Password Reset Complete</span>
                        </>
                      ) : (
                        <>
                          <span>Reset Password</span>
                          <ExternalLink size={14} />
                        </>
                      )}
                    </button>
                  </div>
                )}

                {actionNotification && (
                  <div className="inbox-notification-banner animate-fade-in">
                    <CheckCircle size={16} color="#22c55e" />
                    <div>
                      <div>{actionNotification}</div>
                      {redirectSeconds !== null && <div>Redirecting... {redirectSeconds}s</div>}
                    </div>
                  </div>
                )}
              </div>

              {/* Rendered HTML Email Body */}
              <div
                className="email-html-body"
                onClick={handleEmailBodyClick}
                dangerouslySetInnerHTML={{ __html: selectedEmail.htmlContent }}
              />
            </div>
          ) : (
            <div className="no-email-selected">
              <Mail size={40} className="placeholder-icon" />
              <h3>Select an email to view its contents</h3>
              <p>Received emails will appear in the sidebar on the left.</p>
            </div>
          )}
        </main>
      </div>

      <style>{`
        .demo-inbox-wrapper {
          min-height: 100vh;
          background: #0b0c12;
          color: #f8fafc;
          font-family: 'Inter', system-ui, sans-serif;
          display: flex;
          flex-direction: column;
        }

        .inbox-header {
          height: 70px;
          background: #0f101b;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          position: sticky;
          top: 0;
          z-index: 50;
        }

        .inbox-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .inbox-logo-img {
          width: 38px;
          height: 38px;
          border-radius: 8px;
        }

        .inbox-title-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .inbox-title {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #ffffff;
        }

        .live-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #22c55e;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 6px #22c55e;
          animation: pulseDot 1.5s infinite;
        }

        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }

        .inbox-subtitle {
          font-size: 12px;
          color: #94a3b8;
        }

        .inbox-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .inbox-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f8fafc;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .inbox-btn:hover {
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.18);
        }

        .inbox-btn.danger:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }

        .spin-icon {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Body Split */
        .inbox-body {
          display: flex;
          flex: 1;
          min-height: calc(100vh - 70px);
        }

        .inbox-sidebar {
          width: 380px;
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          background: #0e0f18;
          display: flex;
          flex-direction: column;
        }

        .inbox-sidebar-top {
          padding: 14px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .sidebar-count-label {
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .email-list {
          flex: 1;
          overflow-y: auto;
        }

        .empty-inbox {
          padding: 40px 24px;
          text-align: center;
          color: #64748b;
        }

        .empty-inbox-icon {
          color: #3b3f60;
          margin-bottom: 12px;
        }

        .empty-inbox-title {
          font-size: 15px;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 6px;
        }

        .empty-inbox-desc {
          font-size: 12px;
          line-height: 1.5;
        }

        .email-list-item {
          padding: 16px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .email-list-item:hover {
          background: rgba(255, 255, 255, 0.025);
        }

        .email-list-item.active {
          background: rgba(139, 92, 246, 0.08);
          border-left: 3px solid #8b5cf6;
        }

        .email-item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 5px;
        }

        .email-from {
          font-size: 11px;
          font-weight: 600;
          color: #8b5cf6;
        }

        .email-time {
          font-size: 10px;
          color: #64748b;
        }

        .email-item-subject {
          font-size: 13px;
          font-weight: 600;
          color: #f8fafc;
          margin-bottom: 5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .email-item-preview {
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.4;
          margin-bottom: 10px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .email-item-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .badge-category {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 4px;
        }

        .badge-verify {
          background: rgba(99, 102, 241, 0.15);
          color: #a5b4fc;
          border: 1px solid rgba(99, 102, 241, 0.3);
        }

        .badge-2fa {
          background: rgba(245, 158, 11, 0.15);
          color: #fcd34d;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .badge-reset {
          background: rgba(236, 72, 153, 0.15);
          color: #f472b6;
          border: 1px solid rgba(236, 72, 153, 0.3);
        }

        .email-to-pill {
          font-size: 10px;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
        }

        /* Detail Pane */
        .email-detail-pane {
          flex: 1;
          background: #0b0c12;
          padding: 32px 40px;
          overflow-y: auto;
        }

        .no-email-selected {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #64748b;
          text-align: center;
        }

        .placeholder-icon {
          color: #202237;
          margin-bottom: 16px;
        }

        .no-email-selected h3 {
          font-size: 16px;
          color: #94a3b8;
          margin-bottom: 6px;
        }

        .detail-header {
          margin-bottom: 28px;
        }

        .detail-subject-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        .detail-subject {
          font-size: 22px;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.02em;
        }

        .detail-meta-card {
          background: #141524;
          border: 1px solid #202237;
          border-radius: 8px;
          padding: 14px 18px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 20px;
        }

        .meta-line {
          font-size: 12px;
          display: flex;
          gap: 8px;
        }

        .meta-label {
          color: #64748b;
          width: 50px;
        }

        .meta-value {
          color: #e2e8f0;
        }

        .meta-value.from {
          color: #8b5cf6;
          font-weight: 600;
        }

        /* Action Banners */
        .action-banner {
          border-radius: 10px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .action-banner.two-factor {
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        .action-banner.verify {
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.25);
        }

        .action-banner.reset {
          background: rgba(236, 72, 153, 0.08);
          border: 1px solid rgba(236, 72, 153, 0.25);
        }

        .banner-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .banner-icon {
          color: #f59e0b;
        }

        .action-banner.verify .banner-icon {
          color: #6366f1;
        }

        .action-banner.reset .banner-icon {
          color: #ec4899;
        }

        .banner-title {
          font-size: 13px;
          font-weight: 600;
          color: #f8fafc;
        }

        .banner-code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 26px;
          font-weight: 700;
          color: #fbbf24;
          letter-spacing: 4px;
          margin-top: 2px;
        }

        .banner-subtitle {
          font-size: 12px;
          color: #94a3b8;
        }

        .copy-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #f59e0b;
          color: #0b0c12;
          font-size: 13px;
          font-weight: 700;
          padding: 10px 18px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .copy-btn:hover {
          background: #fbbf24;
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35);
        }

        .action-link-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .action-link-btn:hover:not(:disabled) {
          opacity: 0.92;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
        }

        .action-link-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .action-link-btn.reset {
          background: linear-gradient(135deg, #ec4899 0%, #d946ef 100%);
        }

        .inbox-notification-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.35);
          color: #86efac;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 20px;
        }

        .email-html-body {
          background: #141524;
          border: 1px solid #202237;
          border-radius: 12px;
          padding: 24px;
        }
      `}</style>
    </div>
  );
};
