import assert from 'node:assert/strict';
import test from 'node:test';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/klyra_test';

const { CertificatesService, MARKETPLACE_IMPACT, SECURITY_VERIFIED } = require('../modules/certificates/certificates.service') as typeof import('../modules/certificates/certificates.service');
const { pool } = require('../services/database.service') as typeof import('../services/database.service');

const qualifyingMetrics = {
  published_api_count: '1', active_subscriber_count: '5', api_version_count: '2', qualifying_api_ids: ['00000000-0000-4000-8000-000000000001'],
};

function installCertificateStore(metrics: Record<string, unknown> = qualifyingMetrics) {
  const originalQuery = (pool as any).query;
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  let certificate: any = null;
  (pool as any).query = async (sql: string, values?: unknown[]) => {
    queries.push({ sql, values });
    if (sql.includes('FROM apis a')) return { rows: [metrics] };
    if (sql.includes('INSERT INTO user_certificates')) {
      if (!certificate) {
        certificate = {
          id: 'certificate-1', certificate_type: MARKETPLACE_IMPACT,
          verification_token: '00000000-0000-4000-8000-000000000099', issued_at: '2026-09-19T00:00:00.000Z',
          published_api_count: values![2], active_subscriber_count: values![3], api_version_count: values![4], criteria_version: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('WHERE user_id = $1 AND certificate_type = $2')) return { rows: certificate ? [certificate] : [] };
    if (sql.includes('WHERE user_id = $1\n       ORDER BY')) return { rows: certificate ? [certificate] : [] };
    if (sql.includes('WHERE verification_token = $1')) {
      return { rows: certificate && values?.[0] === certificate.verification_token ? [certificate] : [] };
    }
    return { rows: [] };
  };
  return { queries, setMetrics: (next: Record<string, unknown>) => { metrics = next; }, restore: () => { (pool as any).query = originalQuery; } };
}

test('Marketplace Impact requires every verified marketplace condition and scopes them to the owner', async () => {
  const cases = [
    { published_api_count: 0, active_subscriber_count: 5, api_version_count: 2, qualifying_api_ids: [] },
    { published_api_count: 1, active_subscriber_count: 4, api_version_count: 2, qualifying_api_ids: ['api-1'] },
    { published_api_count: 1, active_subscriber_count: 5, api_version_count: 1, qualifying_api_ids: ['api-1'] },
  ];
  for (const metrics of cases) {
    const mock = installCertificateStore(metrics);
    try {
      assert.equal(await CertificatesService.ensureMarketplaceImpactCertificate('owner-1'), null);
      assert.equal(mock.queries.some(({ sql }) => sql.includes('INSERT INTO user_certificates')), false);
      const metricQuery = mock.queries.find(({ sql }) => sql.includes('FROM apis a'))!.sql;
      assert.match(metricQuery, /a\.owner_id = \$1 AND a\.deleted_at IS NULL/);
      assert.match(metricQuery, /COUNT\(DISTINCT us\.id\)/);
      assert.match(metricQuery, /COUNT\(DISTINCT av\.id\)/);
      assert.match(metricQuery, /us\.status = 'ACTIVE'/);
      assert.doesNotMatch(metricQuery, /total_subscribers|api_build|uptime|latency/i);
    } finally { mock.restore(); }
  }
});

test('Marketplace Impact stores an immutable snapshot, is idempotent, and persists after metrics fall', async () => {
  const mock = installCertificateStore();
  try {
    const first = await CertificatesService.ensureMarketplaceImpactCertificate('owner-1');
    const second = await CertificatesService.ensureMarketplaceImpactCertificate('owner-1');
    assert.equal(first?.published_api_count, 1);
    assert.equal(first?.active_subscriber_count, 5);
    assert.equal(first?.api_version_count, 2);
    assert.equal(second?.id, first?.id);
    const inserts = mock.queries.filter(({ sql }) => sql.includes('INSERT INTO user_certificates'));
    assert.equal(inserts.length, 2);
    assert.match(inserts[0].sql, /ON CONFLICT \(user_id, certificate_type\) DO NOTHING/);
    assert.deepEqual(JSON.parse(String(inserts[0].values![6])), {
      published_api_count: 1, active_subscriber_count: 5, api_version_count: 2, criteria_version: 1,
    });

    mock.setMetrics({ published_api_count: 0, active_subscriber_count: 0, api_version_count: 0, qualifying_api_ids: [] });
    const retained = await CertificatesService.ensureMarketplaceImpactCertificate('owner-1');
    assert.equal(retained?.id, first?.id);
    assert.equal(mock.queries.some(({ sql }) => /DELETE FROM user_certificates/.test(sql)), false);
  } finally { mock.restore(); }
});

test('issued certificates and public verification expose only their intended scopes', async () => {
  const mock = installCertificateStore();
  try {
    await CertificatesService.ensureMarketplaceImpactCertificate('owner-1');
    const certificates = await CertificatesService.getIssuedCertificates('owner-1');
    assert.equal(certificates.length, 1);
    assert.equal(certificates[0].verification_token, '00000000-0000-4000-8000-000000000099');
    const publicResult = await CertificatesService.verifyCertificate('00000000-0000-4000-8000-000000000099');
    assert.deepEqual(publicResult, {
      valid: true,
      certificate: { certificate_type: MARKETPLACE_IMPACT, title: 'Marketplace Impact', issued_at: '2026-09-19T00:00:00.000Z', criteria_version: 1 },
    });
    assert.equal('verification_token' in publicResult.certificate!, false);
    assert.equal('user_id' in publicResult.certificate!, false);
    assert.deepEqual(await CertificatesService.verifyCertificate('00000000-0000-4000-8000-000000000000'), { valid: false });
    const lookup = mock.queries.find(({ sql }) => sql.includes('WHERE user_id = $1\n       ORDER BY'));
    assert.ok(lookup);
    assert.equal(lookup?.values?.[0], 'owner-1');
  } finally { mock.restore(); }
});

test('public certificate verification endpoint returns only public-safe data', async () => {
  const mock = installCertificateStore();
  const express = require('express');
  const certificatesRouter = require('../modules/certificates/certificates.routes').default;
  const app = express();
  app.use('/api/certificates', certificatesRouter);
  try {
    await CertificatesService.ensureMarketplaceImpactCertificate('owner-1');
    const server = await new Promise<any>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    try {
      const address = server.address();
      const response = await fetch(`http://127.0.0.1:${address.port}/api/certificates/verify/00000000-0000-4000-8000-000000000099`);
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.valid, true);
      assert.deepEqual(Object.keys(body.certificate).sort(), ['certificate_type', 'criteria_version', 'issued_at', 'title']);
      const invalid = await fetch(`http://127.0.0.1:${address.port}/api/certificates/verify/not-a-token`);
      assert.equal(invalid.status, 404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  } finally { mock.restore(); }
});

function installSecurityCertificateStore(enabled: boolean) {
  const originalQuery = (pool as any).query;
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  let twoFactorEnabled = enabled;
  let certificate: any = null;
  (pool as any).query = async (sql: string, values?: unknown[]) => {
    queries.push({ sql, values });
    if (sql.includes('SELECT two_factor_enabled FROM users')) return { rows: [{ two_factor_enabled: twoFactorEnabled }] };
    if (sql.includes('INSERT INTO user_certificates')) {
      if (!certificate) {
        certificate = {
          id: 'security-certificate-1', certificate_type: SECURITY_VERIFIED,
          verification_token: '00000000-0000-4000-8000-000000000077', issued_at: '2026-09-19T00:00:00.000Z',
          published_api_count: values![2], active_subscriber_count: values![3], api_version_count: values![4], criteria_version: 1,
        };
      }
      return { rows: [] };
    }
    if (sql.includes('WHERE user_id = $1 AND certificate_type = $2')) {
      return { rows: certificate && values?.[0] === 'user-2' && values?.[1] === SECURITY_VERIFIED ? [certificate] : [] };
    }
    if (sql.includes('WHERE verification_token = $1')) {
      return { rows: certificate && values?.[0] === certificate.verification_token ? [certificate] : [] };
    }
    return { rows: [] };
  };
  return {
    queries,
    setEnabled: (next: boolean) => { twoFactorEnabled = next; },
    restore: () => { (pool as any).query = originalQuery; },
  };
}

test('Security Verified is issued only for server-side enabled 2FA and is retained after disablement', async () => {
  const disabled = installSecurityCertificateStore(false);
  try {
    assert.equal(await CertificatesService.ensureSecurityVerifiedCertificate('user-2'), null);
    assert.equal(disabled.queries.some(({ sql }) => sql.includes('INSERT INTO user_certificates')), false);
    assert.equal(disabled.queries[0].values?.[0], 'user-2');
  } finally { disabled.restore(); }

  const enabled = installSecurityCertificateStore(true);
  try {
    const first = await CertificatesService.ensureSecurityVerifiedCertificate('user-2');
    const repeat = await CertificatesService.ensureSecurityVerifiedCertificate('user-2');
    assert.equal(first?.certificate_type, SECURITY_VERIFIED);
    assert.equal(first?.title, 'Security Verified');
    assert.equal(repeat?.id, first?.id);
    const inserts = enabled.queries.filter(({ sql }) => sql.includes('INSERT INTO user_certificates'));
    assert.equal(inserts.length, 2);
    assert.match(inserts[0].sql, /ON CONFLICT \(user_id, certificate_type\) DO NOTHING/);
    assert.deepEqual(JSON.parse(String(inserts[0].values![6])), {
      certificate_type: SECURITY_VERIFIED, criteria_version: 1, two_factor_enabled_at_issuance: true,
    });

    enabled.setEnabled(false);
    const retained = await CertificatesService.ensureSecurityVerifiedCertificate('user-2');
    assert.equal(retained?.id, first?.id);
    assert.equal(enabled.queries.some(({ sql }) => /DELETE FROM user_certificates/.test(sql)), false);
    assert.equal(await CertificatesService.getCertificateForUser('other-user', SECURITY_VERIFIED), null);

    const publicResult = await CertificatesService.verifyCertificate('00000000-0000-4000-8000-000000000077');
    assert.deepEqual(publicResult, {
      valid: true,
      certificate: { certificate_type: SECURITY_VERIFIED, title: 'Security Verified', issued_at: '2026-09-19T00:00:00.000Z', criteria_version: 1 },
    });
    assert.equal('user_id' in publicResult.certificate!, false);
  } finally { enabled.restore(); }
});
