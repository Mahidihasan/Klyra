import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Building2,
  Mail,
  CheckCircle2,
  Globe,
  Lock,
  Cpu,
  ArrowRight
} from 'lucide-react';

interface ContactSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactSalesModal: React.FC<ContactSalesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [volume, setVolume] = useState('10M - 50M req/mo');
  const [region, setRegion] = useState('Multi-region Global');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
    }, 1000);
  };

  return (
    <div className="upgrade-modal-overlay" onClick={onClose}>
      <div
        className="upgrade-modal-dialog enterprise-dialog glass-card-elevated animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-ambient-glow enterprise-glow" />

        <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
          <X size={18} />
        </button>

        {isSuccess ? (
          <div className="modal-success-state">
            <div className="success-icon-wrapper enterprise-success">
              <CheckCircle2 size={56} className="success-icon" />
            </div>
            <h2 className="success-title">Enterprise Inquiry Received</h2>
            <p className="success-desc">
              Thank you, <strong>{name || 'Developer'}</strong>. Our Solutions Architecture & Sales team
              will reach out to <strong>{email || 'your email'}</strong> within 2 business hours with a custom
              workload benchmark and SLA quote.
            </p>
            <div className="success-receipt-card">
              <div className="receipt-row">
                <span>Organization</span>
                <span className="receipt-val">{company || 'Custom Corp'}</span>
              </div>
              <div className="receipt-row">
                <span>Estimated Volume</span>
                <span className="receipt-val">{volume}</span>
              </div>
              <div className="receipt-row">
                <span>Deployment Target</span>
                <span className="receipt-val">{region}</span>
              </div>
              <div className="receipt-row">
                <span>Guaranteed SLA</span>
                <span className="receipt-badge active">99.99% Financial Uptime</span>
              </div>
            </div>
            <button className="btn-primary-glow btn-full" onClick={onClose}>
              <span>Back to Marketplace</span>
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-content-grid">
            <div className="modal-summary-panel enterprise-side">
              <div className="modal-plan-badge enterprise-badge">
                <Building2 size={14} />
                <span>KLYRA ENTERPRISE</span>
              </div>

              <h2 className="modal-heading">
                Tailored Infrastructure for High-Throughput Fleets
              </h2>
              <p className="modal-subtext">
                Direct peering, multi-cloud isolation, dedicated edge clusters, and bespoke contract terms.
              </p>

              <div className="enterprise-highlights">
                <div className="highlight-item">
                  <ShieldCheck size={18} className="hl-icon" />
                  <div>
                    <strong>99.99% Guaranteed SLA</strong>
                    <span>Contractually backed reliability with financial credits</span>
                  </div>
                </div>
                <div className="highlight-item">
                  <Globe size={18} className="hl-icon" />
                  <div>
                    <strong>Global Data Sovereignty</strong>
                    <span>Deploy in 35+ edge regions or private VPC on-premise</span>
                  </div>
                </div>
                <div className="highlight-item">
                  <Lock size={18} className="hl-icon" />
                  <div>
                    <strong>Custom SIEM & Compliance</strong>
                    <span>Splunk, Datadog streaming, HIPAA, SOC2 Type II, and SSO/SCIM</span>
                  </div>
                </div>
                <div className="highlight-item">
                  <Cpu size={18} className="hl-icon" />
                  <div>
                    <strong>Dedicated Solutions Engineer</strong>
                    <span>Direct shared Slack channel and custom endpoint optimizations</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-checkout-panel">
              <h3 className="checkout-title">Speak with an Engineer</h3>

              <div className="form-group">
                <label>Work Email *</label>
                <input
                  type="email"
                  required
                  placeholder="alex@acmecorp.com"
                  className="glass-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="form-row-split">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Alex Morgan"
                    className="glass-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Company *</label>
                  <input
                    type="text"
                    required
                    placeholder="Acme Corp"
                    className="glass-input"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row-split">
                <div className="form-group">
                  <label>Monthly Requests</label>
                  <select
                    className="glass-input glass-select"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                  >
                    <option value="5M - 20M req/mo">5M - 20M req/mo</option>
                    <option value="20M - 100M req/mo">20M - 100M req/mo</option>
                    <option value="100M+ req/mo">100M+ req/mo (Hyper-scale)</option>
                    <option value="Custom Dedicated Fleet">Custom Dedicated Fleet</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Region Requirements</label>
                  <select
                    className="glass-input glass-select"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  >
                    <option value="Multi-region Global">Multi-region Global</option>
                    <option value="US & EU Dedicated">US & EU Dedicated</option>
                    <option value="Asia-Pacific Edge">Asia-Pacific Edge</option>
                    <option value="VPC / On-Premise">Private VPC / On-Premise</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Project Details / Architecture Needs</label>
                <textarea
                  rows={3}
                  placeholder="Tell us about your expected concurrency, latency requirements, or compliance targets..."
                  className="glass-input glass-textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn-primary-glow btn-full enterprise-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="spinner-label">
                    <span className="mini-spinner" />
                    <span>Connecting with enterprise team...</span>
                  </span>
                ) : (
                  <span>Request Custom Enterprise Quote</span>
                )}
              </button>

              <div className="instant-activation-note">
                🔒 Enterprise NDA available upon request. Direct response from a senior architect.
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
