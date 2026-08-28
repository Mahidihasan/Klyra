import React, { useState } from 'react';
import { X, FolderPlus, Check } from 'lucide-react';
import { CollectionItem } from '../types/api';

interface CreateCollectionModalProps {
  onClose: () => void;
  onSave: (newCol: CollectionItem) => void;
}

export const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedColor, setSelectedColor] = useState('#8b5cf6');

  const colorOptions = ['#8b5cf6', '#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#d946ef'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCol: CollectionItem = {
      id: `c-${Date.now()}`,
      name,
      description: desc || 'Custom collection of developer APIs.',
      apiCount: 0,
      color: selectedColor,
      iconName: 'folder',
      apis: []
    };

    onSave(newCol);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="create-col-modal card-base animate-fade-in" onClick={(e) => e.stopPropagation()}>
        
        <div className="modal-header">
          <div className="header-left">
            <div className="icon-badge" style={{ backgroundColor: `${selectedColor}22` }}>
              <FolderPlus size={20} color={selectedColor} />
            </div>
            <div>
              <h2 className="modal-title">Create Collection</h2>
              <p className="modal-sub">Group related APIs for your project workspace.</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-field">
            <label className="form-label">Collection Name</label>
            <input
              type="text"
              placeholder="e.g., Payment & Billing Services"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              required
              autoFocus
            />
          </div>

          <div className="form-field">
            <label className="form-label">Description</label>
            <textarea
              placeholder="Brief overview of APIs in this collection..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="form-textarea"
            />
          </div>

          <div className="form-field">
            <label className="form-label">Theme Color</label>
            <div className="color-picker-row">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-dot ${selectedColor === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                >
                  {selectedColor === color && <Check size={12} color="#ffffff" />}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="save-btn">Create Collection</button>
          </div>
        </form>

      </div>

      <style>{`
        .create-col-modal {
          width: 500px;
          max-width: 90vw;
          background-color: var(--bg-modal);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-xl);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .icon-badge {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .modal-sub {
          font-size: 12px;
          color: var(--text-muted);
        }

        .modal-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .form-input {
          height: 40px;
          background-color: var(--bg-input);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 0 14px;
          color: var(--text-primary);
          font-size: 13px;
        }

        .form-input:focus {
          border-color: var(--accent-purple);
        }

        .form-textarea {
          height: 80px;
          background-color: var(--bg-input);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 10px 14px;
          color: var(--text-primary);
          font-size: 13px;
          resize: none;
        }

        .color-picker-row {
          display: flex;
          gap: 12px;
        }

        .color-dot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s;
        }

        .color-dot:hover {
          transform: scale(1.1);
        }

        .color-dot.selected {
          box-shadow: 0 0 0 3px var(--bg-modal), 0 0 0 5px var(--accent-purple);
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 10px;
        }

        .cancel-btn {
          padding: 8px 16px;
          font-size: 13px;
          color: var(--text-muted);
        }

        .save-btn {
          height: 38px;
          padding: 0 20px;
          border-radius: var(--radius-md);
          background: var(--accent-gradient);
          color: #fff;
          font-weight: 600;
          font-size: 13px;
          box-shadow: var(--shadow-purple);
        }
      `}</style>
    </div>
  );
};
