import { Check } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { billingApi, BillingApiError } from '../../services/api/billing';
import { BillingInformation, BillingInformationField } from '../../types/billing';

import { BillingState } from './shared';

/** A short list covering where Klyra's users are; extend as needed. */
const COUNTRIES: { code: string; name: string }[] = [
  { code: 'BD', name: 'Bangladesh' },
  { code: 'IN', name: 'India' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'NP', name: 'Nepal' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'SE', name: 'Sweden' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'JP', name: 'Japan' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'BR', name: 'Brazil' },
  { code: 'ZA', name: 'South Africa' },
];

type FormState = Record<BillingInformationField, string>;

const EMPTY_FORM: FormState = {
  billingName: '',
  companyName: '',
  invoiceEmail: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  taxId: '',
};

/** The API returns nulls for blank fields; inputs need strings. */
function toForm(information: BillingInformation): FormState {
  return {
    billingName: information.billingName ?? '',
    companyName: information.companyName ?? '',
    invoiceEmail: information.invoiceEmail ?? '',
    addressLine1: information.addressLine1 ?? '',
    addressLine2: information.addressLine2 ?? '',
    city: information.city ?? '',
    state: information.state ?? '',
    postalCode: information.postalCode ?? '',
    country: information.country ?? '',
    taxId: information.taxId ?? '',
  };
}

function formatUpdatedAt(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface BillingInfoTabProps {
  refreshToken: number;
  onLoadingChange: (isLoading: boolean) => void;
}

export const BillingInfoTab: React.FC<BillingInfoTabProps> = ({
  refreshToken,
  onLoadingChange,
}) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [savedForm, setSavedForm] = useState<FormState>(EMPTY_FORM);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<BillingInformationField, string>>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const loadInformation = useCallback(async () => {
    setIsLoading(true);
    onLoadingChange(true);
    setLoadError(null);
    try {
      const { information } = await billingApi.fetchBillingInformation();
      const next = toForm(information);
      setForm(next);
      setSavedForm(next);
      setUpdatedAt(information.updatedAt);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load billing information.');
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  }, [onLoadingChange]);

  useEffect(() => {
    loadInformation();
  }, [loadInformation, refreshToken]);

  const isDirty = (Object.keys(form) as BillingInformationField[]).some(
    (key) => form[key] !== savedForm[key],
  );

  const update = (field: BillingInformationField, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setJustSaved(false);
    // Clear the error as soon as the field is edited.
    setFieldErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setFieldErrors({});
    try {
      const { information } = await billingApi.saveBillingInformation(form);
      const next = toForm(information);
      setForm(next);
      setSavedForm(next);
      setUpdatedAt(information.updatedAt);
      setJustSaved(true);
    } catch (err) {
      if (err instanceof BillingApiError && Object.keys(err.fields).length > 0) {
        setFieldErrors(err.fields);
        setSaveError(err.message);
      } else {
        setSaveError(err instanceof Error ? err.message : 'Could not save billing information.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setForm(savedForm);
    setFieldErrors({});
    setSaveError(null);
    setJustSaved(false);
  };

  if (isLoading) {
    return (
      <div className="card-base bi-card">
        <div className="bi-skeleton" />
        <div className="bi-skeleton" />
        <div className="bi-skeleton" />
        <BillingInfoStyles />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card-base">
        <BillingState
          title="Billing information didn't load"
          body={loadError}
          actionLabel="Try again"
          onAction={loadInformation}
        />
        <BillingInfoStyles />
      </div>
    );
  }

  const savedAt = formatUpdatedAt(updatedAt);

  return (
    <div className="bi-wrap">
      {saveError && <div className="bi-banner error">{saveError}</div>}
      {justSaved && !isDirty && (
        <div className="bi-banner success">
          <Check size={14} />
          <span>Billing information saved</span>
        </div>
      )}

      <div className="card-base bi-card">
        <Field
          label="Billing name"
          field="billingName"
          value={form.billingName}
          error={fieldErrors.billingName}
          onChange={update}
          placeholder="Radwan Hasan"
          required
          hint="Who invoices are addressed to."
        />

        <div className="bi-grid">
          <Field
            label="Company"
            field="companyName"
            value={form.companyName}
            error={fieldErrors.companyName}
            onChange={update}
            placeholder="Klyra Ltd"
          />
          <Field
            label="Invoice email"
            field="invoiceEmail"
            value={form.invoiceEmail}
            error={fieldErrors.invoiceEmail}
            onChange={update}
            placeholder="billing@company.com"
            type="email"
            hint="Leave blank to use your account email."
          />
        </div>

        <div className="bi-divider" />

        <Field
          label="Address line 1"
          field="addressLine1"
          value={form.addressLine1}
          error={fieldErrors.addressLine1}
          onChange={update}
          placeholder="House 12, Road 4"
        />
        <Field
          label="Address line 2"
          field="addressLine2"
          value={form.addressLine2}
          error={fieldErrors.addressLine2}
          onChange={update}
          placeholder="Badda"
        />

        <div className="bi-grid three">
          <Field
            label="City"
            field="city"
            value={form.city}
            error={fieldErrors.city}
            onChange={update}
            placeholder="Dhaka"
          />
          <Field
            label="State or region"
            field="state"
            value={form.state}
            error={fieldErrors.state}
            onChange={update}
            placeholder="Dhaka Division"
          />
          <Field
            label="Postal code"
            field="postalCode"
            value={form.postalCode}
            error={fieldErrors.postalCode}
            onChange={update}
            placeholder="1212"
          />
        </div>

        <div className="bi-grid">
          <div className="bi-field">
            <label htmlFor="bi-country">Country</label>
            <select
              id="bi-country"
              className={`bi-input ${fieldErrors.country ? 'invalid' : ''}`}
              value={form.country}
              onChange={(event) => update('country', event.target.value)}
            >
              <option value="">Not set</option>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
            {fieldErrors.country && <span className="bi-error">{fieldErrors.country}</span>}
          </div>

          <Field
            label="Tax or VAT ID"
            field="taxId"
            value={form.taxId}
            error={fieldErrors.taxId}
            onChange={update}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="bi-actions">
        <button className="bi-save" onClick={handleSave} disabled={isSaving || !isDirty}>
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
        {isDirty && (
          <button className="bi-discard" onClick={handleDiscard} disabled={isSaving}>
            Discard
          </button>
        )}
        {savedAt && !isDirty && <span className="bi-timestamp">Last updated {savedAt}</span>}
      </div>

      <p className="bi-note">These details appear on your invoices.</p>

      <BillingInfoStyles />
    </div>
  );
};

interface FieldProps {
  label: string;
  field: BillingInformationField;
  value: string;
  error?: string;
  onChange: (field: BillingInformationField, value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  hint?: string;
}

const Field: React.FC<FieldProps> = ({
  label,
  field,
  value,
  error,
  onChange,
  placeholder,
  type = 'text',
  required,
  hint,
}) => (
  <div className="bi-field">
    <label htmlFor={`bi-${field}`}>
      {label}
      {required && <span className="bi-required"> *</span>}
    </label>
    <input
      id={`bi-${field}`}
      className={`bi-input ${error ? 'invalid' : ''}`}
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(field, event.target.value)}
    />
    {error ? (
      <span className="bi-error">{error}</span>
    ) : (
      hint && <span className="bi-hint">{hint}</span>
    )}
  </div>
);

const BillingInfoStyles: React.FC = () => (
  <style>{`
    .bi-wrap {
      display: flex;
      flex-direction: column;
      gap: 14px;
      align-items: flex-start;
    }

    .bi-banner {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 11px 14px;
      border-radius: var(--radius-md);
      font-size: 13px;
    }

    .bi-banner.error {
      background-color: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: var(--status-maintenance);
    }

    .bi-banner.success {
      background-color: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: var(--status-active);
    }

    .bi-card {
      width: 100%;
      padding: 22px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .bi-card:hover {
      transform: none;
    }

    .bi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .bi-grid.three {
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }

    .bi-divider {
      height: 1px;
      background-color: var(--border-subtle);
      margin: 2px 0;
    }

    .bi-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }

    .bi-field label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .bi-required {
      color: var(--accent-purple);
    }

    .bi-input {
      height: 38px;
      width: 100%;
      padding: 0 12px;
      border-radius: var(--radius-md);
      background-color: var(--bg-input);
      border: 1px solid var(--border-card);
      color: var(--text-primary);
      font-size: 13px;
      font-family: inherit;
      transition: border-color 0.15s ease;
    }

    .bi-input::placeholder {
      color: var(--text-muted);
    }

    .bi-input:focus {
      outline: none;
      border-color: var(--border-focus);
    }

    .bi-input.invalid {
      border-color: rgba(239, 68, 68, 0.5);
    }

    select.bi-input {
      cursor: pointer;
    }

    .bi-hint {
      font-size: 11px;
      color: var(--text-muted);
    }

    .bi-error {
      font-size: 11px;
      color: var(--status-maintenance);
    }

    .bi-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .bi-save {
      height: 38px;
      padding: 0 20px;
      border-radius: var(--radius-md);
      background: var(--accent-gradient);
      border: none;
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    .bi-save:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .bi-discard {
      height: 38px;
      padding: 0 16px;
      border-radius: var(--radius-md);
      background-color: transparent;
      border: 1px solid var(--border-card);
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }

    .bi-discard:hover:not(:disabled) {
      color: var(--text-primary);
      border-color: var(--accent-subtle-border);
    }

    .bi-timestamp {
      font-size: 12px;
      color: var(--text-muted);
    }

    .bi-note {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.6;
      max-width: 60ch;
    }

    .bi-skeleton {
      height: 38px;
      border-radius: var(--radius-md);
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.02) 25%,
        rgba(255, 255, 255, 0.05) 50%,
        rgba(255, 255, 255, 0.02) 75%
      );
      background-size: 400px 100%;
      animation: bi-shimmer 1.3s ease-in-out infinite;
    }

    @keyframes bi-shimmer {
      0% { background-position: -200px 0; }
      100% { background-position: 400px 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .bi-skeleton { animation: none; }
    }
  `}</style>
);
