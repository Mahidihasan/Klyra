import { pool } from '../../services/database.service';

export const MARKETPLACE_IMPACT = 'MARKETPLACE_IMPACT' as const;
export const MARKETPLACE_IMPACT_TITLE = 'Marketplace Impact';
export const SECURITY_VERIFIED = 'SECURITY_VERIFIED' as const;
export const SECURITY_VERIFIED_TITLE = 'Security Verified';

export type CertificateType = typeof MARKETPLACE_IMPACT | typeof SECURITY_VERIFIED;

const CERTIFICATE_DETAILS: Record<CertificateType, { title: string; description: string }> = {
  MARKETPLACE_IMPACT: {
    title: MARKETPLACE_IMPACT_TITLE,
    description: 'Recognizes a published marketplace API, five active subscribers, and multiple API versions.',
  },
  SECURITY_VERIFIED: {
    title: SECURITY_VERIFIED_TITLE,
    description: 'Certificate awarded for enabling Two-Factor Authentication on Klyra.',
  },
};

export interface ProfileCertificate {
  id: string;
  certificate_type: CertificateType;
  title: string;
  description: string;
  verification_token: string;
  issued_at: string;
  published_api_count: number;
  active_subscriber_count: number;
  api_version_count: number;
  criteria_version: number;
}

interface CertificateMetrics {
  published_api_count: number | string;
  active_subscriber_count: number | string;
  api_version_count: number | string;
  qualifying_api_ids: string[] | null;
}

function toNumber(value: number | string): number {
  return Number(value) || 0;
}

function mapCertificate(row: any): ProfileCertificate {
  const certificateType = row.certificate_type as CertificateType;
  const details = CERTIFICATE_DETAILS[certificateType];
  return {
    id: row.id,
    certificate_type: certificateType,
    title: details.title,
    description: details.description,
    verification_token: row.verification_token,
    issued_at: row.issued_at,
    published_api_count: toNumber(row.published_api_count),
    active_subscriber_count: toNumber(row.active_subscriber_count),
    api_version_count: toNumber(row.api_version_count),
    criteria_version: toNumber(row.criteria_version),
  };
}

async function insertCertificate(
  userId: string,
  certificateType: CertificateType,
  publishedApiCount: number,
  activeSubscriberCount: number,
  apiVersionCount: number,
  qualifyingApiIds: string[],
  snapshot: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `INSERT INTO user_certificates (
       user_id, certificate_type, published_api_count, active_subscriber_count, api_version_count,
       qualifying_api_ids, criteria_version, snapshot
     ) VALUES ($1, $2, $3, $4, $5, $6::uuid[], 1, $7::jsonb)
     ON CONFLICT (user_id, certificate_type) DO NOTHING`,
    [userId, certificateType, publishedApiCount, activeSubscriberCount, apiVersionCount,
      qualifyingApiIds, JSON.stringify(snapshot)],
  );
}

/** Persistent, server-authoritative marketplace certificate issuance. */
export class CertificatesService {
  static async ensureMarketplaceImpactCertificate(userId: string): Promise<ProfileCertificate | null> {
    const metricsResult = await pool.query<CertificateMetrics>(
      `SELECT
         COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'PUBLISHED') AS published_api_count,
         COUNT(DISTINCT us.id) AS active_subscriber_count,
         COUNT(DISTINCT av.id) AS api_version_count,
         COALESCE(ARRAY_AGG(DISTINCT a.id) FILTER (WHERE a.status = 'PUBLISHED'), '{}') AS qualifying_api_ids
       FROM apis a
       LEFT JOIN user_subscriptions us ON us.api_id = a.id AND us.status = 'ACTIVE'
       LEFT JOIN api_versions av ON av.api_id = a.id
       WHERE a.owner_id = $1 AND a.deleted_at IS NULL`,
      [userId],
    );
    const metrics = metricsResult.rows[0] ?? {
      published_api_count: 0, active_subscriber_count: 0, api_version_count: 0, qualifying_api_ids: [],
    };
    const publishedApiCount = toNumber(metrics.published_api_count);
    const activeSubscriberCount = toNumber(metrics.active_subscriber_count);
    const apiVersionCount = toNumber(metrics.api_version_count);

    if (publishedApiCount < 1 || activeSubscriberCount < 5 || apiVersionCount < 2) {
      // A certificate is an issued record, not a live badge: never revoke it.
      return this.getCertificateForUser(userId, MARKETPLACE_IMPACT);
    }

    const snapshot = {
      published_api_count: publishedApiCount,
      active_subscriber_count: activeSubscriberCount,
      api_version_count: apiVersionCount,
      criteria_version: 1,
    };
    await insertCertificate(userId, MARKETPLACE_IMPACT, publishedApiCount, activeSubscriberCount,
      apiVersionCount, metrics.qualifying_api_ids ?? [], snapshot);
    return this.getCertificateForUser(userId, MARKETPLACE_IMPACT);
  }

  /** Issue once from the server-side 2FA state; later disablement never revokes it. */
  static async ensureSecurityVerifiedCertificate(userId: string): Promise<ProfileCertificate | null> {
    const result = await pool.query<{ two_factor_enabled: boolean }>(
      'SELECT two_factor_enabled FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId],
    );
    if (!result.rows[0]?.two_factor_enabled) {
      return this.getCertificateForUser(userId, SECURITY_VERIFIED);
    }
    await insertCertificate(userId, SECURITY_VERIFIED, 0, 0, 0, [], {
      certificate_type: SECURITY_VERIFIED,
      criteria_version: 1,
      two_factor_enabled_at_issuance: true,
    });
    return this.getCertificateForUser(userId, SECURITY_VERIFIED);
  }

  static async getIssuedCertificates(userId: string): Promise<ProfileCertificate[]> {
    const result = await pool.query<{ certificate_type: CertificateType; issued_at: string; criteria_version: number | string }>(
      `SELECT id, certificate_type, verification_token, issued_at, published_api_count,
              active_subscriber_count, api_version_count, criteria_version
       FROM user_certificates
       WHERE user_id = $1
       ORDER BY issued_at DESC`,
      [userId],
    );
    return result.rows.map(mapCertificate);
  }

  static async getCertificateForUser(userId: string, certificateType: CertificateType): Promise<ProfileCertificate | null> {
    const result = await pool.query<{ certificate_type: CertificateType; issued_at: string; criteria_version: number | string }>(
      `SELECT id, certificate_type, verification_token, issued_at, published_api_count,
              active_subscriber_count, api_version_count, criteria_version
       FROM user_certificates
       WHERE user_id = $1 AND certificate_type = $2`,
      [userId, certificateType],
    );
    return result.rows[0] ? mapCertificate(result.rows[0]) : null;
  }

  /** Public-safe verification response: no user identifiers or private evidence. */
  static async verifyCertificate(verificationToken: string): Promise<{
    valid: boolean; certificate?: Pick<ProfileCertificate, 'certificate_type' | 'title' | 'issued_at' | 'criteria_version'>;
  }> {
    const result = await pool.query<{ certificate_type: CertificateType; issued_at: string; criteria_version: number | string }>(
      `SELECT certificate_type, issued_at, criteria_version
       FROM user_certificates
       WHERE verification_token = $1`,
      [verificationToken],
    );
    if (!result.rows[0] || !CERTIFICATE_DETAILS[result.rows[0].certificate_type]) return { valid: false };
    const row = result.rows[0];
    return {
      valid: true,
      certificate: {
        certificate_type: row.certificate_type,
        title: CERTIFICATE_DETAILS[row.certificate_type].title,
        issued_at: row.issued_at,
        criteria_version: toNumber(row.criteria_version),
      },
    };
  }
}
