import React from 'react';
import { Crown, Zap, ArrowRight } from 'lucide-react';

interface PgAiProBannerProps {
  onUpgrade?: () => void;
  onClose?: () => void;
}

export const PgAiProBanner: React.FC<PgAiProBannerProps> = ({ onUpgrade, onClose }) => {
  return (
    <div className="pg-ai-pro-banner">
      <div className="pg-ai-pro-banner-content">
        <div className="pg-ai-pro-banner-icon">
          <Crown className="pg-pro-icon" size={24} />
        </div>
        <div className="pg-ai-pro-banner-text">
          <h3 className="pg-ai-pro-banner-title">Unlock AI Features</h3>
          <p className="pg-ai-pro-banner-description">
            Upgrade to Klyra Pro to access powerful AI features including request generation,
            error diagnosis, code generation, and AI assistant chat.
          </p>
        </div>
        <div className="pg-ai-pro-banner-actions">
          <button className="pg-btn pg-btn-primary pg-btn-sm" onClick={onUpgrade}>
            <Zap size={14} />
            <span>Upgrade to Pro</span>
          </button>
          {onClose && (
            <button className="pg-ai-pro-banner-close" onClick={onClose}>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};