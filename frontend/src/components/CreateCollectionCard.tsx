import React from 'react';
import { FolderPlus, Plus } from 'lucide-react';

interface CreateCollectionCardProps {
  onCreateClick: () => void;
}

export const CreateCollectionCard: React.FC<CreateCollectionCardProps> = ({ onCreateClick }) => {
  return (
    <div className="create-col-card" onClick={onCreateClick}>
      <div className="create-col-content">
        <h3 className="create-col-title">Create Collection</h3>
        <p className="create-col-sub">Organize your favorite APIs into collections</p>
      </div>

      <div className="create-col-icon-box">
        <div className="folder-icon-circle">
          <FolderPlus size={22} color="#ffffff" />
          <div className="plus-badge">
            <Plus size={10} color="#ffffff" />
          </div>
        </div>
      </div>

      <style>{`
        .create-col-card {
          background: linear-gradient(135deg, #241442 0%, #1e1338 60%, #151128 100%);
          border: 1px solid rgba(139, 92, 246, 0.35);
          border-radius: var(--radius-lg);
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .create-col-card:hover {
          border-color: #8b5cf6;
          box-shadow: 0 6px 24px rgba(124, 58, 237, 0.3);
          transform: translateY(-1px);
        }

        .create-col-content {
          max-width: 180px;
        }

        .create-col-title {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 4px;
        }

        .create-col-sub {
          font-size: 11px;
          color: #a78bfa;
          line-height: 1.4;
        }

        .create-col-icon-box {
          position: relative;
        }

        .folder-icon-circle {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          background: var(--accent-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(124, 58, 237, 0.5);
          position: relative;
        }

        .plus-badge {
          position: absolute;
          top: -3px;
          right: -3px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #d946ef;
          border: 2px solid #1e1338;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </div>
  );
};
