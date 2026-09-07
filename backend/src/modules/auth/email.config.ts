/**
 * Email provider configuration + startup validation.
 *
 * Supports two providers via EMAIL_PROVIDER:
 *   - 'brevo': real transactional email through the Brevo API (production)
 *   - 'demo':  in-memory demo inbox (local development fallback only)
 *
 * Secrets (BREVO_API_KEY) must never be logged or returned from any API.
 */

export type EmailProviderName = 'brevo' | 'demo';

export interface ParsedEmailAddress {
  email: string;
  name: string;
}

export function getEmailProvider(): EmailProviderName {
  const raw = (process.env.EMAIL_PROVIDER || 'demo').trim().toLowerCase();
  return raw === 'brevo' ? 'brevo' : 'demo';
}

/**
 * Parse EMAIL_FROM ("Klyra <shuvra098@gmail.com>" or "shuvra098@gmail.com").
 * Throws when the value is missing/unparseable.
 */
export function getFromAddress(): ParsedEmailAddress {
  const raw = (process.env.EMAIL_FROM || '').trim();
  if (!raw) {
    throw new Error('EMAIL_FROM is not configured.');
  }

  const match = raw.match(/^(.*?)\s*<\s*([^\s<>]+@[^\s<>]+)\s*>$/);
  if (match) {
    return { name: match[1].trim() || 'Klyra', email: match[2].trim() };
  }

  if (/^[^\s<>]+@[^\s<>]+\.[^\s<>]+$/.test(raw)) {
    return { name: 'Klyra', email: raw };
  }

  throw new Error('EMAIL_FROM is invalid. Use the format: Klyra <noreply@klyra.dev>');
}

export function getBrevoApiKey(): string {
  const key = (process.env.BREVO_API_KEY || '').trim();
  if (!key) {
    throw new Error('BREVO_API_KEY is not configured.');
  }
  return key;
}

export interface EmailConfigValidation {
  provider: EmailProviderName;
  ok: boolean;
  problems: string[];
}

/**
 * Validate required configuration for the active provider. Returns a report;
 * the caller decides how loudly to fail. Never includes secret values.
 */
export function validateEmailConfig(): EmailConfigValidation {
  const provider = getEmailProvider();
  const problems: string[] = [];

  try {
    getFromAddress();
  } catch (err: any) {
    problems.push(err.message);
  }

  if (provider === 'brevo') {
    if (!process.env.BREVO_API_KEY?.trim()) {
      problems.push('EMAIL_PROVIDER=brevo requires BREVO_API_KEY to be set.');
    }
  }

  return { provider, ok: problems.length === 0, problems };
}

/**
 * Log a clear, secret-free configuration report at startup. Does not crash the
 * backend — email endpoints will return a safe error until config is fixed.
 */
export function reportEmailConfig(): void {
  const report = validateEmailConfig();
  // eslint-disable-next-line no-console
  console.log(`[email] provider=${report.provider}`);

  if (!report.ok) {
    for (const problem of report.problems) {
      // eslint-disable-next-line no-console
      console.warn(`[email] CONFIG PROBLEM: ${problem}`);
    }
    // eslint-disable-next-line no-console
    console.warn('[email] Email-dependent endpoints will return a safe error until the configuration above is fixed.');
  }
}