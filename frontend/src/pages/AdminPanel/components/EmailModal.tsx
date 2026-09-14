import React, { useState } from 'react';
import { AdminUserRow } from '../../../types/adminUsers';

interface EmailModalProps {
  user: AdminUserRow;
  onClose: () => void;
  onSend: (subject: string, message: string) => void;
}

export const EmailModal: React.FC<EmailModalProps> = ({ user, onClose, onSend }) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim() && message.trim()) {
      onSend(subject, message);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content-lg">
        <h2>Send Communication to {user.name}</h2>
        <p>This will be delivered to {user.email}</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Subject</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Warning: Unusual API Activity detected" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Message</label>
            <textarea 
              className="form-textarea" 
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-drawer btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-drawer btn-primary">
              Send Email
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
