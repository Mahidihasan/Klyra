import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Upload,
  Globe,
  Tag,
  FileText,
  CreditCard,
  Plus,
  Trash2,
} from 'lucide-react';
import { CatalogCategory, catalogApi, PublishApiPayload } from '../../services/api/catalog';

interface PublishApiModalProps {
  onClose: () => void;
  onPublished: () => void;
  categories: CatalogCategory[];
}

type WizardStep = 'basics' | 'spec' | 'pricing' | 'review';

const STEPS: { key: WizardStep; label: string; icon: React.FC<any> }[] = [
  { key: 'basics', label: 'Basic Info', icon: FileText },
  { key: 'spec', label: 'API Spec & Tags', icon: Globe },
  { key: 'pricing', label: 'Pricing Plans', icon: CreditCard },
  { key: 'review', label: 'Review & Publish', icon: Check },
];

const PRICING_MODEL_INFO: Record<string, { label: string; description: string }> = {
  FREE: {
    label: 'Free',
    description: 'No charge for access. Use plans to describe limits and included support.',
  },
  FREEMIUM: {
    label: 'Freemium',
    description:
      'Offer a free entry tier alongside optional paid plans for higher limits or features.',
  },
  PAID: {
    label: 'Paid',
    description: 'Access requires a paid plan. Set the price and billing interval for each tier.',
  },
  ENTERPRISE: {
    label: 'Enterprise',
    description: 'Designed for negotiated contracts and managed enterprise access.',
  },
};

interface PlanDraft {
  name: string;
  slug: string;
  description: string;
  price: number;
  billingInterval: 'MONTHLY' | 'YEARLY';
  features: string[];
  rateLimit: number;
}

export const PublishApiModal: React.FC<PublishApiModalProps> = ({
  onClose,
  onPublished,
  categories,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('basics');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [docsUrl, setDocsUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [pricingModel, setPricingModel] = useState<'FREE' | 'FREEMIUM' | 'PAID' | 'ENTERPRISE'>(
    'FREEMIUM',
  );
  const [tagsInput, setTagsInput] = useState('');
  const [apiSpecRaw, setApiSpecRaw] = useState('');
  const [plans, setPlans] = useState<PlanDraft[]>([
    {
      name: 'Free',
      slug: 'free',
      description: 'Sandbox access',
      price: 0,
      billingInterval: 'MONTHLY',
      features: ['1,000 requests/mo', 'Community Support'],
      rateLimit: 60,
    },
  ]);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const stepIndex = STEPS.findIndex((s) => s.key === currentStep);
  const pricingInfo = PRICING_MODEL_INFO[pricingModel];

  const validateBasics = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 3) errs.name = 'Name must be at least 3 characters';
    if (!description.trim() || description.trim().length < 10)
      errs.description = 'Description must be at least 10 characters';
    if (!categoryId) errs.categoryId = 'Select a category';
    if (!baseUrl.trim() || !baseUrl.startsWith('http'))
      errs.baseUrl = 'Must be a valid URL starting with http';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateSpec = (): boolean => {
    const errs: Record<string, string> = {};
    if (apiSpecRaw.trim()) {
      try {
        JSON.parse(apiSpecRaw);
      } catch {
        errs.apiSpec = 'Must be valid JSON';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validatePricing = (): boolean => {
    const errs: Record<string, string> = {};
    if (plans.length === 0) errs.plans = 'Add at least one pricing plan';
    plans.forEach((p, i) => {
      if (!p.name.trim()) errs[`plan_${i}_name`] = 'Plan name required';
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    if (currentStep === 'basics' && validateBasics()) setCurrentStep('spec');
    else if (currentStep === 'spec' && validateSpec()) setCurrentStep('pricing');
    else if (currentStep === 'pricing' && validatePricing()) setCurrentStep('review');
  };

  const goBack = () => {
    if (currentStep === 'spec') setCurrentStep('basics');
    else if (currentStep === 'pricing') setCurrentStep('spec');
    else if (currentStep === 'review') setCurrentStep('pricing');
  };

  const addPlan = () => {
    setPlans([
      ...plans,
      {
        name: '',
        slug: '',
        description: '',
        price: 0,
        billingInterval: 'MONTHLY',
        features: [],
        rateLimit: 60,
      },
    ]);
  };

  const removePlan = (idx: number) => {
    setPlans(plans.filter((_, i) => i !== idx));
  };

  const updatePlan = (idx: number, field: keyof PlanDraft, value: any) => {
    const updated = [...plans];
    (updated[idx] as any)[field] = value;
    if (field === 'name') {
      updated[idx].slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
    setPlans(updated);
  };

  const handlePublish = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      let apiSpec: Record<string, any> | undefined;
      if (apiSpecRaw.trim()) {
        apiSpec = JSON.parse(apiSpecRaw);
      }

      const payload: PublishApiPayload = {
        name: name.trim(),
        description: description.trim(),
        categoryId,
        baseUrl: baseUrl.trim(),
        docsUrl: docsUrl.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        pricingModel,
        apiSpec,
        tags,
        plans: plans.map((p) => ({
          name: p.name,
          slug: p.slug,
          description: p.description,
          price: p.price,
          billingInterval: p.billingInterval,
          features: p.features,
          rateLimit: p.rateLimit,
        })),
      };

      await catalogApi.publishApi(payload);
      onPublished();
      onClose();
    } catch (e: any) {
      setSubmitError(e.message || 'Failed to publish API');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pam-overlay" onClick={onClose}>
      <div className="pam-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pam-close" onClick={onClose}>
          <X size={18} />
        </button>

        <h2 className="pam-title">Publish API to Marketplace</h2>

        {/* Step Indicator */}
        <div className="pam-steps">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === stepIndex;
            const isCompleted = i < stepIndex;
            return (
              <div
                key={step.key}
                className={`pam-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              >
                <div className="pam-step-circle">
                  {isCompleted ? <Check size={14} /> : <Icon size={14} />}
                </div>
                <span className="pam-step-label">{step.label}</span>
                {i < STEPS.length - 1 && <div className="pam-step-line" />}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="pam-body">
          {currentStep === 'basics' && (
            <div className="pam-form pam-basics-form">
              <div className="pam-field">
                <label>API Name *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Awesome API"
                  className={errors.name ? 'error' : ''}
                />
                {errors.name && <span className="pam-error">{errors.name}</span>}
              </div>
              <div className="pam-field">
                <label>Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what your API does..."
                  rows={3}
                  className={errors.description ? 'error' : ''}
                />
                {errors.description && <span className="pam-error">{errors.description}</span>}
              </div>
              <div className="pam-field">
                <label>Category *</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={errors.categoryId ? 'error' : ''}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {errors.categoryId && <span className="pam-error">{errors.categoryId}</span>}
              </div>
              <div className="pam-field">
                <label>Base URL *</label>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className={errors.baseUrl ? 'error' : ''}
                />
                {errors.baseUrl && <span className="pam-error">{errors.baseUrl}</span>}
              </div>
              <div className="pam-row">
                <div className="pam-field">
                  <label>Documentation URL</label>
                  <input
                    value={docsUrl}
                    onChange={(e) => setDocsUrl(e.target.value)}
                    placeholder="https://docs.example.com"
                  />
                </div>
                <div className="pam-field">
                  <label>Logo URL</label>
                  <input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              </div>
              <div className="pam-field">
                <label>Pricing Model</label>
                <select
                  value={pricingModel}
                  onChange={(e) => setPricingModel(e.target.value as any)}
                >
                  <option value="FREE">Free</option>
                  <option value="FREEMIUM">Freemium</option>
                  <option value="PAID">Paid</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
                <div className="pam-pricing-note">
                  <span className={`pam-model-dot ${pricingModel.toLowerCase()}`} />
                  <span>
                    <b>{pricingInfo.label}:</b> {pricingInfo.description}
                  </span>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'spec' && (
            <div className="pam-form">
              <div className="pam-field">
                <label>Tags (comma-separated)</label>
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="ai, machine-learning, nlp"
                />
              </div>
              <div className="pam-field">
                <label>OpenAPI Spec (JSON, optional)</label>
                <textarea
                  value={apiSpecRaw}
                  onChange={(e) => setApiSpecRaw(e.target.value)}
                  placeholder='{"openapi":"3.0.0","info":{"title":"..."},"paths":{}}'
                  rows={10}
                  className={`pam-mono ${errors.apiSpec ? 'error' : ''}`}
                />
                {errors.apiSpec && <span className="pam-error">{errors.apiSpec}</span>}
              </div>
            </div>
          )}

          {currentStep === 'pricing' && (
            <div className="pam-form">
              <div className="pam-pricing-heading">
                <div>
                  <span className="pam-section-kicker">Access model</span>
                  <h3>{pricingInfo.label} plans</h3>
                </div>
                <span className={`pam-model-badge ${pricingModel.toLowerCase()}`}>
                  {pricingInfo.label}
                </span>
              </div>
              <p className="pam-pricing-help">
                Configure the limits, billing, and support included in each plan. Keep the plan
                names and prices consistent with the selected access model.
              </p>
              {plans.map((plan, idx) => (
                <div key={idx} className="pam-plan-card">
                  <div className="pam-plan-header">
                    <div>
                      <span className="pam-plan-num">Plan {idx + 1}</span>
                      <span className={`pam-plan-access ${plan.price === 0 ? 'free' : 'paid'}`}>
                        {plan.price === 0 ? 'Free access' : 'Paid tier'}
                      </span>
                    </div>
                    {plans.length > 1 && (
                      <button className="pam-plan-remove" onClick={() => removePlan(idx)}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div className="pam-row">
                    <div className="pam-field">
                      <label>Name *</label>
                      <input
                        value={plan.name}
                        onChange={(e) => updatePlan(idx, 'name', e.target.value)}
                        placeholder="Pro"
                      />
                    </div>
                    <div className="pam-field">
                      <label>Price ($)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={plan.price}
                        onChange={(e) => updatePlan(idx, 'price', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="pam-row">
                    <div className="pam-field">
                      <label>Billing</label>
                      <select
                        value={plan.billingInterval}
                        onChange={(e) => updatePlan(idx, 'billingInterval', e.target.value)}
                      >
                        <option value="MONTHLY">Monthly</option>
                        <option value="YEARLY">Yearly</option>
                      </select>
                    </div>
                    <div className="pam-field">
                      <label>Rate Limit (req/min)</label>
                      <input
                        type="number"
                        min={1}
                        value={plan.rateLimit}
                        onChange={(e) =>
                          updatePlan(idx, 'rateLimit', parseInt(e.target.value) || 60)
                        }
                      />
                    </div>
                  </div>
                  <div className="pam-field">
                    <label>Description</label>
                    <input
                      value={plan.description}
                      onChange={(e) => updatePlan(idx, 'description', e.target.value)}
                      placeholder="Access to all endpoints"
                    />
                  </div>
                  <div className="pam-field">
                    <label>Features (comma-separated)</label>
                    <input
                      value={plan.features.join(', ')}
                      onChange={(e) =>
                        updatePlan(
                          idx,
                          'features',
                          e.target.value
                            .split(',')
                            .map((f: string) => f.trim())
                            .filter(Boolean),
                        )
                      }
                      placeholder="Unlimited requests, Priority support"
                    />
                  </div>
                </div>
              ))}
              <button className="pam-add-plan-btn" onClick={addPlan}>
                <Plus size={14} /> Add Plan
              </button>
              {errors.plans && <span className="pam-error">{errors.plans}</span>}
            </div>
          )}

          {currentStep === 'review' && (
            <div className="pam-review">
              <div className="pam-review-section">
                <h4>Basic Info</h4>
                <div className="pam-review-row">
                  <span>Name:</span> <b>{name}</b>
                </div>
                <div className="pam-review-row">
                  <span>Category:</span>{' '}
                  <b>{categories.find((c) => c.id === categoryId)?.name || categoryId}</b>
                </div>
                <div className="pam-review-row">
                  <span>Base URL:</span> <b>{baseUrl}</b>
                </div>
                <div className="pam-review-row">
                  <span>Pricing:</span> <b>{pricingInfo.label}</b>
                </div>
              </div>
              <div className="pam-review-section">
                <h4>Tags</h4>
                <p>{tagsInput || 'None'}</p>
              </div>
              <div className="pam-review-section">
                <h4>Plans ({plans.length})</h4>
                {plans.map((p, i) => (
                  <div key={i} className="pam-review-row">
                    <span>{p.name}:</span>{' '}
                    <b>
                      ${p.price.toFixed(2)} / {p.billingInterval.toLowerCase()}
                    </b>
                  </div>
                ))}
              </div>
              <div className="pam-review-section">
                <h4>Description</h4>
                <p className="pam-review-desc">{description}</p>
              </div>
              {submitError && (
                <div className="pam-submit-error">
                  <AlertCircle size={14} /> {submitError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pam-footer">
          {stepIndex > 0 && (
            <button className="pam-btn secondary" onClick={goBack}>
              <ChevronLeft size={14} /> Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {currentStep !== 'review' ? (
            <button className="pam-btn primary" onClick={goNext}>
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button className="pam-btn primary" onClick={handlePublish} disabled={submitting}>
              {submitting ? 'Publishing...' : 'Publish API'} <Upload size={14} />
            </button>
          )}
        </div>

        <style>{`
          .pam-overlay {
            position: fixed;
            inset: 0;
            z-index: 10000;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            animation: pamFade 0.2s ease;
          }

          @keyframes pamFade {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          .pam-modal {
            width: 100%;
            max-width: 760px;
            max-height: 85vh;
            overflow: hidden;
            background: var(--bg-modal);
            border: 1px solid var(--border-card);
            border-radius: var(--radius-xl);
            padding: 28px;
            position: relative;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            gap: 20px;
            animation: pamSlide 0.25s ease;
          }

          @keyframes pamSlide {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .pam-close {
            position: absolute;
            top: 16px;
            right: 16px;
            background: var(--bg-card-hover);
            border: none;
            color: var(--text-muted);
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .pam-close:hover { color: var(--text-primary); }

          .pam-title {
            font-size: 20px;
            font-weight: 800;
            color: var(--text-primary);
          }

          /* Steps */
          .pam-steps {
            display: flex;
            align-items: center;
            gap: 0;
          }

          .pam-step {
            display: flex;
            align-items: center;
            gap: 6px;
            flex: 1;
          }

          .pam-step-circle {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--bg-card);
            border: 2px solid var(--border-card);
            color: var(--text-muted);
            flex-shrink: 0;
            transition: all 0.2s;
          }

          .pam-step.active .pam-step-circle {
            border-color: var(--accent-purple);
            background: var(--accent-subtle);
            color: var(--accent-purple);
          }

          .pam-step.completed .pam-step-circle {
            background: #22c55e;
            border-color: #22c55e;
            color: #fff;
          }

          .pam-step-label {
            font-size: 11px;
            color: var(--text-muted);
            white-space: nowrap;
          }

          .pam-step.active .pam-step-label { color: var(--text-primary); font-weight: 600; }

          .pam-step-line {
            flex: 1;
            height: 2px;
            background: var(--border-card);
            margin: 0 8px;
          }

          .pam-step.completed .pam-step-line { background: #22c55e; }

          /* Form */
          .pam-body {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            padding: 0 2px 4px 0;
            scrollbar-gutter: stable;
          }

          .pam-form {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .pam-basics-form {
            gap: 16px;
            padding-bottom: 4px;
          }

          .pam-row {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .pam-basics-form .pam-row {
            align-items: start;
            gap: 16px;
          }

          .pam-row .pam-field { flex: 1; }

          .pam-field {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .pam-basics-form .pam-field {
            gap: 6px;
            min-width: 0;
          }

          .pam-field label {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-secondary);
            line-height: 1.25;
            min-height: 15px;
          }

          .pam-field input,
          .pam-field select,
          .pam-field textarea {
            width: 100%;
            padding: 9px 12px;
            background: var(--bg-input);
            border: 1px solid var(--border-card);
            border-radius: var(--radius-md);
            color: var(--text-primary);
            font-size: 13px;
            font-family: var(--font-sans);
            transition: border-color 0.15s;
            min-height: 40px;
          }

          .pam-basics-form textarea {
            min-height: 82px;
            resize: vertical;
          }

          .pam-basics-form .pam-pricing-note {
            margin-top: 2px;
          }

          .pam-field input.error,
          .pam-field select.error,
          .pam-field textarea.error {
            border-color: #ef4444;
          }

          .pam-field input:focus,
          .pam-field select:focus,
          .pam-field textarea:focus {
            outline: none;
            border-color: var(--border-focus);
          }

          .pam-field select option {
            background: #141524;
            color: #f8fafc;
          }

          .pam-pricing-note {
            align-items: flex-start;
            color: var(--text-muted);
            display: flex;
            font-size: 11px;
            gap: 8px;
            line-height: 1.45;
            padding: 8px 10px;
            background: var(--bg-card);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-sm);
          }

          .pam-pricing-note b { color: var(--text-secondary); }

          .pam-model-dot {
            background: var(--accent-purple);
            border-radius: 50%;
            flex: 0 0 7px;
            height: 7px;
            margin-top: 4px;
          }

          .pam-model-dot.free, .pam-model-badge.free, .pam-plan-access.free { color: #22c55e; }
          .pam-model-dot.free { background: #22c55e; }
          .pam-model-dot.paid, .pam-model-badge.paid, .pam-plan-access.paid { color: #f59e0b; }
          .pam-model-dot.paid { background: #f59e0b; }
          .pam-model-dot.enterprise, .pam-model-badge.enterprise { color: #60a5fa; }
          .pam-model-dot.enterprise { background: #60a5fa; }

          .pam-pricing-heading {
            align-items: center;
            display: flex;
            justify-content: space-between;
            gap: 16px;
          }

          .pam-section-kicker {
            color: var(--text-muted);
            display: block;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }

          .pam-pricing-heading h3 {
            font-size: 18px;
            margin-top: 3px;
          }

          .pam-model-badge {
            background: var(--accent-subtle);
            border: 1px solid var(--accent-subtle-border);
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
            padding: 5px 10px;
          }

          .pam-pricing-help {
            color: var(--text-secondary);
            font-size: 12px;
            line-height: 1.5;
            margin-top: -6px;
          }

          .pam-mono {
            font-family: var(--font-mono) !important;
            font-size: 12px !important;
          }

          .pam-error {
            font-size: 11px;
            color: #ef4444;
          }

          /* Plans */
          .pam-plan-card {
            padding: 14px;
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: var(--radius-md);
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .pam-plan-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .pam-plan-header > div {
            align-items: center;
            display: flex;
            gap: 8px;
          }

          .pam-plan-num {
            font-size: 12px;
            font-weight: 700;
            color: var(--text-accent);
          }

          .pam-plan-access {
            font-size: 10px;
            font-weight: 700;
          }

          .pam-plan-remove {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
          }

          .pam-plan-remove:hover { color: #ef4444; }

          .pam-add-plan-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 14px;
            border-radius: var(--radius-md);
            border: 1px dashed var(--border-card);
            background: transparent;
            color: var(--text-secondary);
            font-size: 12.5px;
            cursor: pointer;
            transition: all 0.15s;
          }

          .pam-add-plan-btn:hover {
            border-color: var(--accent-purple);
            color: var(--accent-purple);
          }

          /* Review */
          .pam-review {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .pam-review-section {
            padding: 14px;
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: var(--radius-md);
          }

          .pam-review-section h4 {
            font-size: 12px;
            font-weight: 700;
            color: var(--text-accent);
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
          }

          .pam-review-row {
            display: flex;
            gap: 8px;
            font-size: 13px;
            color: var(--text-secondary);
            margin-bottom: 4px;
          }

          .pam-review-row b { color: var(--text-primary); }

          .pam-review-desc {
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.5;
          }

          .pam-submit-error {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 10px 14px;
            border-radius: var(--radius-md);
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #ef4444;
            font-size: 12.5px;
          }

          /* Footer */
          .pam-footer {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 0 0 auto;
            margin: 0 -28px -28px;
            padding: 16px 28px 28px;
            border-top: 1px solid var(--border-subtle);
            background: var(--bg-modal);
            position: relative;
            z-index: 1;
          }

          .pam-btn {
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 9px 18px;
            border-radius: var(--radius-md);
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .pam-btn.secondary {
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            color: var(--text-secondary);
          }

          .pam-btn.secondary:hover { color: var(--text-primary); }

          .pam-btn.primary {
            background: var(--accent-gradient);
            color: #fff;
            border: none;
            box-shadow: var(--shadow-purple);
          }

          .pam-btn.primary:hover {
            transform: translateY(-1px);
            filter: brightness(1.1);
          }

          .pam-btn.primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }

          @media (max-width: 640px) {
            .pam-overlay { padding: 10px; }
            .pam-modal { max-height: 94vh; padding: 20px; border-radius: var(--radius-lg); }
            .pam-footer { margin: 0 -20px -20px; padding: 14px 20px 20px; }
            .pam-steps { overflow-x: auto; padding-bottom: 4px; }
            .pam-step { min-width: 132px; }
            .pam-step-label { font-size: 10px; }
            .pam-row { grid-template-columns: 1fr; }
            .pam-basics-form { gap: 14px; }
            .pam-plan-header > div { align-items: flex-start; flex-direction: column; gap: 2px; }
          }
        `}</style>
      </div>
    </div>
  );
};
