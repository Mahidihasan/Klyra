import React from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { PricingSection } from '../../components/pricing/PricingSection';

interface PricingPageProps {
  onBack?: () => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onBack }) => {
  return (
    <div className="pricing-page-wrapper">
      {onBack && (
        <div className="pricing-page-topbar">
          <button className="pricing-back-btn" onClick={onBack}>
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>
        </div>
      )}

      <PricingSection currentPlanId="free" />

      <style>{`
        .pricing-page-wrapper {
          width: 100%;
          min-height: calc(100vh - var(--topbar-height, 64px));
          padding: 24px 20px 80px 20px;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        .pricing-page-topbar {
          max-width: 1360px;
          margin: 0 auto;
          width: 100%;
          padding-bottom: 12px;
          z-index: 10;
        }

        .pricing-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: var(--radius-md, 10px);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-secondary, #94a3b8);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          backdrop-filter: blur(8px);
        }

        .pricing-back-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.16);
          transform: translateX(-2px);
        }
      `}</style>
    </div>
  );
};
