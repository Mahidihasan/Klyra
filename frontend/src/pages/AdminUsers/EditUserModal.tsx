import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { AdminUserRow } from '../../types/adminUsers';

const editSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().email('Invalid email address'),
  company: z.string().max(255, 'Company name is too long').optional().nullable(),
  customRateLimit: z
    .preprocess((val) => {
      if (val === '' || val === null || val === undefined) return null;
      return Number(val);
    }, z.number().min(1, 'Rate limit must be at least 1').nullable()),
});

type EditFormData = z.infer<typeof editSchema>;

interface Props {
  user: AdminUserRow;
  isSaving: boolean;
  error: string | null;
  onConfirm: (data: EditFormData) => void;
  onClose: () => void;
}

export const EditUserModal: React.FC<Props> = ({
  user,
  isSaving,
  error,
  onConfirm,
  onClose,
}) => {
  // Pre-fill with user details. Note: customRateLimit might not be on AdminUserRow directly,
  // but it's okay to start it as empty if we don't have it in the row.
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    company: (user as any).company || '',
    customRateLimit: '', // Defaulting to empty string for the input
  });
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear validation error when user types
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = editSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach(err => {
        if (err.path[0]) fieldErrors[err.path[0].toString()] = err.message;
      });
      setValidationErrors(fieldErrors);
      return;
    }
    
    // Convert to proper types for API
    onConfirm({
      name: result.data.name,
      email: result.data.email,
      company: result.data.company || null,
      customRateLimit: result.data.customRateLimit,
    });
  };

  return (
    <div className="au-modal-overlay" role="presentation" onClick={isSaving ? undefined : onClose}>
      <div
        className="au-modal max-w-md w-full"
        role="dialog"
        aria-modal="true"
        aria-label="Edit User"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="au-modal-title">Edit User Details</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm text-slate-300 font-medium">Full Name</label>
            <input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={isSaving}
              className={`w-full bg-slate-900 border ${validationErrors.name ? 'border-red-500' : 'border-slate-700'} rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500`}
            />
            {validationErrors.name && <p className="text-xs text-red-400">{validationErrors.name}</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="text-sm text-slate-300 font-medium">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              disabled={isSaving}
              className={`w-full bg-slate-900 border ${validationErrors.email ? 'border-red-500' : 'border-slate-700'} rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500`}
            />
            {validationErrors.email && <p className="text-xs text-red-400">{validationErrors.email}</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="company" className="text-sm text-slate-300 font-medium">Organization / Company</label>
            <input
              id="company"
              name="company"
              value={formData.company}
              onChange={handleChange}
              disabled={isSaving}
              className={`w-full bg-slate-900 border ${validationErrors.company ? 'border-red-500' : 'border-slate-700'} rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500`}
            />
            {validationErrors.company && <p className="text-xs text-red-400">{validationErrors.company}</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="customRateLimit" className="text-sm text-slate-300 font-medium">Custom Rate-Limit Override (requests / min)</label>
            <input
              id="customRateLimit"
              name="customRateLimit"
              type="number"
              placeholder="Leave empty for default"
              value={formData.customRateLimit}
              onChange={handleChange}
              disabled={isSaving}
              className={`w-full bg-slate-900 border ${validationErrors.customRateLimit ? 'border-red-500' : 'border-slate-700'} rounded-md px-3 py-2 text-white focus:outline-none focus:border-cyan-500`}
            />
            {validationErrors.customRateLimit && <p className="text-xs text-red-400">{validationErrors.customRateLimit}</p>}
          </div>

          {error && (
            <div className="au-inline-error mt-4">
              <AlertTriangle size={15} aria-hidden="true" />
              <p>{error}</p>
            </div>
          )}

          <footer className="au-modal-foot mt-6 pt-4 border-t border-slate-800">
            <button type="button" className="au-ghost-btn" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="au-primary-btn" disabled={isSaving}>
              {isSaving && <Loader2 size={14} className="au-spin" aria-hidden="true" />}
              Save Changes
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};
