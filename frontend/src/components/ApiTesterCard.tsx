import React from 'react';
import { Zap } from 'lucide-react';

interface ApiTesterCardProps {
  onOpenTester: () => void;
}

export const ApiTesterCard: React.FC<ApiTesterCardProps> = ({ onOpenTester }) => {
  return (
    <div className="tester-widget card-base">
      <div className="tester-icon-row">
        <div className="lightning-icon-box">
          <Zap size={20} color="#8b5cf6" fill="#8b5cf6" />
        </div>
        <h3 className="tester-title">Test Your APIs</h3>
      </div>

      <p className="tester-desc">
        Test APIs directly in the built-in API tester
      </p>

      <button className="open-tester-btn" onClick={onOpenTester}>
        Open API Tester
      </button>

      <style>{`
        .tester-widget {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .tester-icon-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .lightning-icon-box {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(139, 92, 246, 0.15);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tester-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .tester-desc {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.4;
        }

        .open-tester-btn {
          width: 100%;
          height: 38px;
          border-radius: var(--radius-md);
          border: 1px solid rgba(139, 92, 246, 0.5);
          background: rgba(139, 92, 246, 0.1);
          color: var(--text-accent);
          font-weight: 600;
          font-size: 13px;
          transition: all 0.2s ease;
          margin-top: 4px;
        }

        .open-tester-btn:hover {
          background: rgba(139, 92, 246, 0.22);
          border-color: #8b5cf6;
          color: #ffffff;
          box-shadow: 0 4px 16px rgba(124, 58, 237, 0.25);
        }
      `}</style>
    </div>
  );
};
