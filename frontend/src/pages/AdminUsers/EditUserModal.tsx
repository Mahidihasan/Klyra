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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0B0F19] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <h3 className="text-lg font-semibold text-slate-100 tracking-tight">Edit User Details</h3>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          {/* Full Name */}
          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Full Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={isSaving}
              className={`w-full rounded-lg border ${validationErrors.name ? 'border-red-500' : 'border-slate-800'} bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all`}
              placeholder="Enter full name"
            />
            {validationErrors.name && <p className="text-xs text-red-400 mt-1">{validationErrors.name}</p>}
          </div>

          {/* Email Address */}
          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={isSaving}
              className={`w-full rounded-lg border ${validationErrors.email ? 'border-red-500' : 'border-slate-800'} bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all`}
              placeholder="user@example.com"
            />
            {validationErrors.email && <p className="text-xs text-red-400 mt-1">{validationErrors.email}</p>}
          </div>

          {/* Organization / Company */}
          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Organization / Company
            </label>
            <input
              type="text"
              name="company"
              value={formData.company || ''}
              onChange={handleChange}
              disabled={isSaving}
              className={`w-full rounded-lg border ${validationErrors.company ? 'border-red-500' : 'border-slate-800'} bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all`}
              placeholder="Company or Organization name"
            />
            {validationErrors.company && <p className="text-xs text-red-400 mt-1">{validationErrors.company}</p>}
          </div>

          {/* Custom Rate-Limit */}
          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Custom Rate-Limit Override (requests / min)
            </label>
            <input
              type="number"
              name="customRateLimit"
              value={formData.customRateLimit || ''}
              onChange={handleChange}
              disabled={isSaving}
              className={`w-full rounded-lg border ${validationErrors.customRateLimit ? 'border-red-500' : 'border-slate-800'} bg-slate-950/80 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-all`}
              placeholder="Leave empty for default"
            />
            {validationErrors.customRateLimit && <p className="text-xs text-red-400 mt-1">{validationErrors.customRateLimit}</p>}
          </div>

          {error && (
            <div className="mt-2 text-sm text-red-400 flex items-center gap-2">
              <AlertTriangle size={15} aria-hidden="true" />
              <p>{error}</p>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="mt-4 flex items-center justify-end gap-3 pt-4 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-lg shadow-md shadow-violet-600/30 transition-all duration-200 flex items-center justify-center"
            >
              {isSaving && <Loader2 size={14} className="animate-spin mr-2" aria-hidden="true" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
