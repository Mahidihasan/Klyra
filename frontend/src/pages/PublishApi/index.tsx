import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UploadCloud, CheckCircle, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { adminMarketplaceApi } from '../../services/api/adminMarketplace';
import { providerApi } from '../../services/api/provider';
import { AdminCategoryRow } from '../../types/adminMarketplace';

const publishSchema = z.object({
  name: z.string().min(3, 'API Name must be at least 3 characters').max(100, 'API Name is too long'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semantic (e.g. 1.0.0)'),
  categoryId: z.string().uuid('Please select a valid category'),
  baseUrl: z.string().url('Must be a valid https URL').startsWith('https://', 'Must use HTTPS'),
  pricingModel: z.enum(['FREE', 'FREEMIUM', 'PAID'], { message: 'Please select a pricing model' }),
});

type PublishFormData = z.infer<typeof publishSchema>;

interface Props {
  onBack: () => void;
  onSuccess: (apiId: string) => void;
}

export const PublishApiPage: React.FC<Props> = ({ onBack, onSuccess }) => {
  const [categories, setCategories] = useState<AdminCategoryRow[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PublishFormData>({
    resolver: zodResolver(publishSchema),
    defaultValues: {
      version: '1.0.0',
      pricingModel: 'FREE',
    },
  });

  const selectedPricing = watch('pricingModel');

  useEffect(() => {
    adminMarketplaceApi.getCategories()
      .then(data => setCategories(data.filter(c => c.isActive)))
      .catch(err => console.error('Failed to load categories', err))
      .finally(() => setIsLoadingCategories(false));
  }, []);

  const onSubmit = async (data: PublishFormData) => {
    setSubmitError(null);
    try {
      const result = await providerApi.publishApi(data);
      onSuccess(result.id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to publish API');
    }
  };

  return (
    <div style={{ background: '#0B0F19', minHeight: '100vh', width: '100%', padding: '40px 24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <button 
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '24px', fontSize: '14px', fontWeight: 500 }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#f1f5f9', marginBottom: '8px' }}>Publish New API</h1>
          <p style={{ color: '#94a3b8', fontSize: '15px' }}>
            Add your API to the Klyra marketplace. Once published, developers can discover, test, and subscribe to your endpoints.
          </p>
        </div>

        <form 
          onSubmit={handleSubmit(onSubmit)} 
          className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-8 shadow-2xl shadow-black/50"
          style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}
        >
          {submitError && (
            <div style={{ padding: '16px', background: 'rgba(225, 29, 72, 0.1)', color: '#f43f5e', borderRadius: '12px', border: '1px solid rgba(225, 29, 72, 0.2)', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <AlertTriangle size={18} />
              <span style={{ fontSize: '14px', fontWeight: 500 }}>{submitError}</span>
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', marginBottom: '16px' }}>1. Basic Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">API Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Acme Payment Gateway"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all duration-200"
                  {...register('name')} 
                />
                {errors.name && <p className="text-xs text-rose-500 mt-1.5">{errors.name.message}</p>}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Initial Version</label>
                <input 
                  type="text" 
                  placeholder="1.0.0"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all duration-200"
                  {...register('version')} 
                />
                {errors.version && <p className="text-xs text-rose-500 mt-1.5">{errors.version.message}</p>}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Category</label>
                <div style={{ position: 'relative' }}>
                  <select 
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all duration-200"
                    style={{ appearance: 'none' }}
                    {...register('categoryId')}
                    disabled={isLoadingCategories}
                  >
                    <option value="">Select a category...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {isLoadingCategories && (
                    <Loader2 size={16} className="au-spin" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  )}
                </div>
                {errors.categoryId && <p className="text-xs text-rose-500 mt-1.5">{errors.categoryId.message}</p>}
              </div>
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

          {/* Section 2: Logo / Thumbnail */}
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', marginBottom: '16px' }}>2. API Thumbnail</h3>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Upload Graphic</label>
            <div 
              style={{
                width: '100%',
                height: '140px',
                border: '2px dashed #334155', // border-slate-700
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#06b6d4'} // border-cyan-500
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}
            >
              <UploadCloud size={32} color="#64748b" />
              <div style={{ textAlign: 'center' }}>
                <span style={{ color: '#06b6d4', fontWeight: 500, fontSize: '14px' }}>Click to upload</span>
                <span style={{ color: '#94a3b8', fontSize: '14px' }}> or drag and drop</span>
                <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>PNG, JPG or GIF (max 2MB)</p>
              </div>
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

          {/* Section 3: Endpoint */}
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', marginBottom: '16px' }}>3. Integration Details</h3>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Production Base URL</label>
            <input 
              type="url" 
              placeholder="https://api.example.com/v1"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all duration-200"
              {...register('baseUrl')} 
            />
            {errors.baseUrl && <p className="text-xs text-rose-500 mt-1.5">{errors.baseUrl.message}</p>}
            <p style={{ color: '#64748b', fontSize: '12px', marginTop: '8px' }}>
              All API requests will be proxied to this root URL via the Klyra Gateway.
            </p>
          </div>

          <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

          {/* Section 4: Pricing */}
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9', marginBottom: '16px' }}>4. Pricing Model</h3>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Select Tier Type</label>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              
              <label 
                style={{ 
                  border: `2px solid ${selectedPricing === 'FREE' ? '#06b6d4' : '#1e293b'}`, 
                  borderRadius: '12px', padding: '16px', cursor: 'pointer',
                  background: selectedPricing === 'FREE' ? 'rgba(6, 182, 212, 0.05)' : 'transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Free</span>
                  <input type="radio" value="FREE" {...register('pricingModel')} style={{ opacity: 0, position: 'absolute' }} />
                  {selectedPricing === 'FREE' ? <CheckCircle size={18} color="#06b6d4" /> : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #334155' }} />}
                </div>
                <p style={{ fontSize: '12px', color: '#94a3b8' }}>Completely open, ideal for public data or hobby projects.</p>
              </label>

              <label 
                style={{ 
                  border: `2px solid ${selectedPricing === 'FREEMIUM' ? '#06b6d4' : '#1e293b'}`, 
                  borderRadius: '12px', padding: '16px', cursor: 'pointer',
                  background: selectedPricing === 'FREEMIUM' ? 'rgba(6, 182, 212, 0.05)' : 'transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Freemium</span>
                  <input type="radio" value="FREEMIUM" {...register('pricingModel')} style={{ opacity: 0, position: 'absolute' }} />
                  {selectedPricing === 'FREEMIUM' ? <CheckCircle size={18} color="#06b6d4" /> : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #334155' }} />}
                </div>
                <p style={{ fontSize: '12px', color: '#94a3b8' }}>Free basic tier, with paid quotas for heavy users.</p>
              </label>

              <label 
                style={{ 
                  border: `2px solid ${selectedPricing === 'PAID' ? '#06b6d4' : '#1e293b'}`, 
                  borderRadius: '12px', padding: '16px', cursor: 'pointer',
                  background: selectedPricing === 'PAID' ? 'rgba(6, 182, 212, 0.05)' : 'transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Paid Only</span>
                  <input type="radio" value="PAID" {...register('pricingModel')} style={{ opacity: 0, position: 'absolute' }} />
                  {selectedPricing === 'PAID' ? <CheckCircle size={18} color="#06b6d4" /> : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #334155' }} />}
                </div>
                <p style={{ fontSize: '12px', color: '#94a3b8' }}>Monetize from day 1. Subscriptions required for all requests.</p>
              </label>

            </div>
            {errors.pricingModel && <p className="text-xs text-rose-500 mt-1.5">{errors.pricingModel.message}</p>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-xl px-6 py-3 shadow-lg shadow-violet-600/25 transition-all flex items-center gap-2"
              style={{ opacity: isSubmitting ? 0.7 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
            >
              {isSubmitting ? <Loader2 className="au-spin" size={18} /> : null}
              {isSubmitting ? 'Publishing...' : 'Publish API'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
