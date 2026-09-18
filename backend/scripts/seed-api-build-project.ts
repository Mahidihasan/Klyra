/* eslint-disable no-console */
/**
 * Development-only seed that registers ONE real, publicly hosted API as an
 * API Build project — the user-facing workspace served by
 * `GET /api/api-build/projects` (modules/api-build, table `api_build_projects`).
 * This is deliberately NOT an Admin API Management listing: projects live in
 * their own tables, are keyed by a project id, and are what a signed-in user
 * sees in their API Build workspace.
 *
 *   Open-Meteo — https://api.open-meteo.com/v1
 *
 * Every endpoint written below was requested against the live host and returned
 * real forecast values with no API key, no signup and no token. Two sibling
 * model endpoints failed verification and are excluded: `/v1/icon_eu` answers
 * 404, and `/v1/bom` returns an empty result set for every parameter shape even
 * inside its own coverage area. The seed re-checks the upstream while running
 * and records the honest outcome in the project's deployment status.
 *
 * The project is registered as the wizard would create it for an existing
 * external API (status `published`, deployment `healthy-external`, auth `none`,
 * visibility `public`), so every tab in the workspace — Overview, API,
 * Deployments, Versions, Plans — shows truthful data. Because the upstream's
 * `/forecast` path answers 200 without parameters, it doubles as the health
 * check target for the telemetry worker's live probes.
 *
 * This seed replaces an earlier admin-side approach. If that earlier seed left
 * an `apis` row (slug `open-meteo-weather`) plus its provider account behind,
 * they are removed here so the API appears only where it belongs.
 *
 * Safety rules:
 *   - Development data only: refuses to run when NODE_ENV === 'production'.
 *   - Idempotent: the project is keyed on its id, endpoints on
 *     (project_id, method, path); re-running refreshes in place and keeps a
 *     single seed-authored deployment/activity trail.
 *   - Only touches rows this seed family created.
 */
import { pool } from '../src/services/database.service';
import {
  addActivity,
  addDeployment,
  composeProject,
  ensureProjectDefaults,
  getProject,
  importEndpoints,
  listEndpoints,
  listProjects,
  saveProject,
  saveVersion,
  type DetailedEndpointRow,
} from '../src/modules/api-build/api-build.service';

const PROJECT_ID = 'proj-open-meteo-weather';
const PROJECT_NAME = 'Open-Meteo Weather API';
const SLUG = 'open-meteo-weather';
const BASE_URL = 'https://api.open-meteo.com/v1';
const CATEGORY = 'Weather';
const VERSION = 'v1.0.0';
/** Open-Meteo's published free-tier fair-use limit (600 calls/minute). */
const RATE_LIMIT_PER_MIN = 600;

const DESCRIPTION =
  'Keyless open weather data from Open-Meteo: current conditions, hourly and ' +
  'daily forecasts for any coordinate, from the best-match global blend and ' +
  'from five named national models (NOAA GFS, DWD ICON, Météo-France ARPEGE, ' +
  'ECMWF IFS, JMA) plus the MET Norway Nordic regional model. No API key or ' +
  'signup is required. Free for non-commercial use under the published ' +
  'fair-use limits of 10,000 calls/day, 5,000/hour and 600/minute; data is ' +
  'provided under the CC BY 4.0 licence and requires attribution to ' +
  'Open-Meteo.com.';

const TAGS = 'weather,forecast,open-data,no-auth';

/**
 * One documented GET operation per verified forecast endpoint. Every field
 * records something checked against the live host:
 *   - `supportsCurrent` — whether the endpoint returns real values for the
 *     `current` parameter (`/v1/ecmwf` answers 200 but omits the block).
 *   - `coverage` + `sample*` — limited-area models answer 200 with an invalid
 *     NaN body outside their domain, so the coverage area and an in-region
 *     example coordinate are recorded on the endpoint.
 */
interface ForecastEndpoint {
  path: string;
  summary: string;
  supportsCurrent: boolean;
  coverage: string;
  samplePlace: string;
  sampleLatitude: number;
  sampleLongitude: number;
}

const GLOBAL_COVERAGE = 'Global coverage.';

const BERLIN_EXAMPLE = { samplePlace: 'Berlin', sampleLatitude: 52.52, sampleLongitude: 13.41 };

const FORECAST_ENDPOINTS: ForecastEndpoint[] = [
  {
    path: '/forecast',
    summary:
      'Current conditions, hourly and daily forecast for a coordinate, blended from the best available national models.',
    supportsCurrent: true,
    coverage: GLOBAL_COVERAGE,
    ...BERLIN_EXAMPLE,
  },
  {
    path: '/dwd-icon',
    summary: 'Forecast from the German Weather Service (DWD) ICON model.',
    supportsCurrent: true,
    coverage: GLOBAL_COVERAGE,
    ...BERLIN_EXAMPLE,
  },
  {
    path: '/gfs',
    summary: 'Forecast from the NOAA Global Forecast System (GFS).',
    supportsCurrent: true,
    coverage: GLOBAL_COVERAGE,
    ...BERLIN_EXAMPLE,
  },
  {
    path: '/meteofrance',
    summary: 'Forecast from the Meteo-France ARPEGE / AROME models.',
    supportsCurrent: true,
    coverage: GLOBAL_COVERAGE,
    ...BERLIN_EXAMPLE,
  },
  {
    path: '/ecmwf',
    summary: 'Hourly and daily forecast from the ECMWF IFS model.',
    supportsCurrent: false,
    coverage: GLOBAL_COVERAGE,
    ...BERLIN_EXAMPLE,
  },
  {
    path: '/jma',
    summary: 'Forecast from the Japan Meteorological Agency (JMA) model.',
    supportsCurrent: true,
    coverage: GLOBAL_COVERAGE,
    ...BERLIN_EXAMPLE,
  },
  {
    path: '/metno',
    summary: 'Forecast from the MET Norway Nordic model (Norway, Sweden, Finland and Denmark).',
    supportsCurrent: true,
    coverage:
      'Limited-area model: it covers Norway, Sweden, Finland and Denmark, and requests outside that domain return an invalid body, so use the documented example coordinate or another in-region location.',
    samplePlace: 'Oslo',
    sampleLatitude: 59.91,
    sampleLongitude: 10.75,
  },
];

/** Query parameter shape produced by the OpenAPI import path (detect module). */
interface QueryParameter {
  name: string;
  in: string;
  type: string;
  required: boolean;
  description: string;
  example?: string;
}

/**
 * Builds the endpoint catalog exactly as the app's own OpenAPI import would:
 * same parameter/response shapes, deterministic `ep-*` ids, `authRequired`
 * false because the upstream genuinely needs no credentials, and the real
 * 600/min fair-use limit instead of a generic default.
 */
function buildOperations(): DetailedEndpointRow[] {
  const now = new Date().toISOString();

  return FORECAST_ENDPOINTS.map((entry, index) => {
    const parameters: QueryParameter[] = [
      {
        name: 'latitude',
        in: 'query',
        type: 'number',
        required: true,
        description: `WGS84 latitude in decimal degrees. ${entry.coverage} Example coordinate: ${entry.samplePlace}.`,
        example: String(entry.sampleLatitude),
      },
      {
        name: 'longitude',
        in: 'query',
        type: 'number',
        required: true,
        description: 'WGS84 longitude in decimal degrees.',
        example: String(entry.sampleLongitude),
      },
    ];

    if (entry.supportsCurrent) {
      parameters.push({
        name: 'current',
        in: 'query',
        type: 'string',
        required: false,
        description: 'Comma-separated current variables, for example temperature_2m.',
        example: 'temperature_2m',
      });
    }

    parameters.push(
      {
        name: 'hourly',
        in: 'query',
        type: 'string',
        required: false,
        description: 'Comma-separated hourly variables, for example temperature_2m.',
        example: 'temperature_2m',
      },
      {
        name: 'daily',
        in: 'query',
        type: 'string',
        required: false,
        description: 'Comma-separated daily aggregates, for example temperature_2m_max.',
        example: 'temperature_2m_max',
      },
      {
        name: 'timezone',
        in: 'query',
        type: 'string',
        required: false,
        description: 'IANA timezone name, or "auto" to resolve it from the coordinate.',
        example: 'auto',
      },
      {
        name: 'forecast_days',
        in: 'query',
        type: 'integer',
        required: false,
        description: 'Number of forecast days to return (1-16).',
        example: '7',
      },
    );

    const id =
      `ep-${index + 1}-get-${entry.path.replace(/[^a-z0-9]+/gi, '-').slice(0, 48)}`.replace(/-+$/, '');

    const description = [
      entry.summary,
      entry.supportsCurrent
        ? ''
        : 'This endpoint does not serve a current block, so no current parameter is documented.',
      `Verified live against ${BASE_URL}${entry.path} with the documented example coordinate.`,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      id,
      method: 'GET' as const,
      path: entry.path,
      summary: entry.summary,
      description,
      category: CATEGORY,
      authRequired: false,
      rateLimitPerMin: RATE_LIMIT_PER_MIN,
      status: 'active' as const,
      parameters,
      requestBody: null,
      responses: [
        {
          statusCode: 200,
          description: 'Weather data for the requested coordinate and variables.',
          schema: 'object',
          sampleBody: '',
        },
        {
          statusCode: 400,
          description: 'Invalid parameter combination (for example an unsupported variable).',
          schema: 'object',
          sampleBody: '',
        },
      ],
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      totalRequests: 0,
      errorRate: 0,
      isHealthy: true,
      updatedAt: now,
    };
  });
}

interface ProbeResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  sample: string;
  error?: string;
}

/**
 * Live check of the default global endpoint. A failure does not abort the
 * seed: the project is still registered, but the deployment status honestly
 * records the failure so the workspace never claims a healthy upstream that
 * is not answering.
 */
async function probeUpstream(): Promise<ProbeResult> {
  const url = `${BASE_URL}/forecast?latitude=52.52&longitude=13.41&current=temperature_2m`;
  const started = Date.now();

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', 'User-Agent': 'KlyraSeed/1.0' },
    });
    const latencyMs = Date.now() - started;
    const body = (await response.json()) as {
      current?: Record<string, unknown>;
      current_units?: Record<string, string>;
    };
    const value = body.current?.temperature_2m;
    const ok = response.ok && typeof value === 'number';

    return {
      ok,
      status: response.status,
      latencyMs,
      sample: ok ? `${String(value)}${body.current_units?.temperature_2m ?? ''}` : '',
      error: ok ? undefined : `HTTP ${response.status}${typeof value === 'number' ? '' : ' (no current value)'}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      sample: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * The detection record a real "Connect an existing API" run would have
 * produced, populated from the verified endpoint list and the probe result.
 */
function buildDetection(probe: ProbeResult): Record<string, unknown> {
  return {
    openApiVersion: '3.0.3',
    endpointCount: FORECAST_ENDPOINTS.length,
    schemaCount: 0,
    authKind: 'none',
    baseUrl: BASE_URL,
    endpoints: FORECAST_ENDPOINTS.map((entry, index) => ({
      id: `ep-${index + 1}`,
      method: 'GET',
      path: entry.path,
      description: entry.summary,
    })),
    found: true,
    reachable: probe.ok,
    latencyMs: probe.latencyMs,
    foundAt: null,
    title: PROJECT_NAME,
    description: DESCRIPTION,
    servers: [BASE_URL],
    securitySchemes: [],
  };
}

/**
 * The project record in the exact shape `newProjectRecord` (api-build.routes)
 * creates, populated with the verified upstream facts. `createdAt` is
 * preserved across re-runs so the project history stays stable.
 */
function buildProjectRecord(
  probe: ProbeResult,
  previousCreatedAt: string,
): Record<string, unknown> & { id: string } {
  const now = new Date().toISOString();
  const operational = probe.ok;

  const deploymentLog = [
    `Registered from the live upstream ${BASE_URL} (seed:api-build).`,
    operational
      ? `Live check passed: HTTP ${probe.status} in ${probe.latencyMs}ms — sample reading ${probe.sample}.`
      : `Live check failed (${probe.error ?? 'unavailable'}). The project is marked degraded until the upstream responds again.`,
  ];

  return {
    id: PROJECT_ID,
    name: PROJECT_NAME,
    slug: SLUG,
    description: DESCRIPTION,
    category: CATEGORY,
    status: operational ? 'published' : 'degraded',
    environment: 'production',
    version: VERSION,
    sourceKind: 'existing',
    baseUrl: BASE_URL,
    openApiUrl: '',
    gatewayUrl: `https://api.klyra.com/${SLUG}`,
    authKind: 'none',
    rateLimitPerMin: RATE_LIMIT_PER_MIN,
    healthCheckPath: '/forecast',
    requests: 0,
    requestsLabel: '0 requests',
    successRate: 100,
    latencyMs: 0,
    consumers: 0,
    revenue: 0,
    endpointCount: FORECAST_ENDPOINTS.length,
    schemaCount: 0,
    visibility: 'public',
    published: true,
    createdAt: previousCreatedAt || now,
    updatedAt: now,
    deployment: {
      kind: 'external',
      status: operational ? 'healthy-external' : 'failed',
      providerUrl: BASE_URL,
      environment: 'production',
      version: VERSION,
      lastHealthCheck: operational ? now : `failed: ${probe.error ?? `HTTP ${probe.status}`}`,
      log: deploymentLog,
    },
    detection: buildDetection(probe),
    plans: [],
    consumersList: [],
    apiKeys: [],
    versions: [],
    activity: [],
    corsOrigins: '*',
    cacheTtlSeconds: 0,
    retryStrategy: 'none',
    connectTimeoutMs: 5000,
    requestTimeoutMs: 30000,
    stripBasePath: false,
    authHeaderName: 'Authorization',
    ipAllowlist: '',
    tags: TAGS,
  };
}

/**
 * Removes the rows the earlier admin-side seed created, so this API appears
 * only as an API Build project. Rows are matched by the exact slug/email that
 * seed used; anything else in the database is untouched.
 */
async function removeLegacyAdminListing(): Promise<void> {
  const removed = await pool.query(`DELETE FROM apis WHERE slug = $1`, [SLUG]);
  if ((removed.rowCount ?? 0) > 0) {
    console.log(`[seed:api-build] Removed legacy admin listing "${SLUG}" (api_versions cascade).`);
  }

  try {
    const removedUser = await pool.query(
      `DELETE FROM users WHERE email = $1 AND role = 'PROVIDER' AND name = $2`,
      ['info@open-meteo.com', 'Open-Meteo'],
    );
    if ((removedUser.rowCount ?? 0) > 0) {
      console.log('[seed:api-build] Removed legacy provider account info@open-meteo.com.');
    }
  } catch (error) {
    console.warn(
      `[seed:api-build] Legacy provider account kept (still referenced elsewhere): ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
}

/**
 * Keeps the seed's deployment/activity trail at exactly one copy across
 * re-runs: prior seed-authored deployment rows and activity lines are removed
 * before the fresh ones are written. Activity labels are matched on the exact
 * strings this seed (and the service functions it calls) produce.
 */
async function clearSeedTrail(): Promise<void> {
  await pool.query(`DELETE FROM api_build_deployments WHERE project_id = $1 AND author = $2`, [
    PROJECT_ID,
    'seed:api-build',
  ]);
  await pool.query(
    `DELETE FROM api_build_activity
     WHERE project_id = $1
       AND (label = $2 OR label LIKE $3 OR label LIKE $4 OR label LIKE $5)`,
    [
      PROJECT_ID,
      'Project created',
      'Imported % endpoint% from the OpenAPI specification',
      'Deployment v1.0.0 % to production',
      'Live check%',
    ],
  );
}

const line = (label: string, value: string) => console.log(`  ${label.padEnd(26)} ${value}`);

/**
 * Reads everything back through the real service functions the workspace
 * calls, so the printed values are what the API Build UI will render.
 */
async function readBack(): Promise<void> {
  console.log('\n=== Read back (what the API Build workspace will show) ===');

  const projects = await listProjects();
  const listed = projects.some((project) => project.id === PROJECT_ID);
  check(listed, `GET /api/api-build/projects lists "${PROJECT_ID}"`, `total projects: ${projects.length}`);
  if (!listed) return;

  const composed = (await composeProject(PROJECT_ID)) as Record<string, unknown> | null;
  if (!composed) {
    check(false, 'composeProject returns the record');
    return;
  }

  line('Name / category', `${String(composed.name)} — ${String(composed.category)}`);
  line('Status', String(composed.status));
  line('Environment / version', `${String(composed.environment)} / ${String(composed.version)}`);
  line('Visibility / published', `${String(composed.visibility)} / ${String(composed.published)}`);
  line('Auth / rate limit', `${String(composed.authKind)} — ${String(composed.rateLimitPerMin)}/min`);
  line('Base URL', String(composed.baseUrl));
  line('Endpoints', String(composed.endpointCount));

  const deployment = composed.deployment as Record<string, unknown>;
  line(
    'Deployment',
    `${String(deployment.kind)} / ${String(deployment.status)} — ${String(deployment.providerUrl)}`,
  );
  line('Last health check', String(deployment.lastHealthCheck));

  const detection = composed.detection as Record<string, unknown> | null;
  line(
    'Detection',
    detection
      ? `found ${String(detection.endpointCount)} endpoints, reachable=${String(detection.reachable)}`
      : '(none)',
  );

  const versions = (composed.versions ?? []) as Array<Record<string, unknown>>;
  line(
    'Versions',
    versions
      .map((v) => `${String(v.semver)} (${String(v.status)}${v.isDefault ? ', default' : ''})`)
      .join(', '),
  );

  const plans = (composed.plans ?? []) as Array<Record<string, unknown>>;
  line('Plans', plans.map((p) => String(p.name)).join(', ') || '(none)');

  const activity = (composed.activity ?? []) as Array<Record<string, unknown>>;
  line('Recent activity', `${activity.length} entr(ies)`);

  const endpoints = await listEndpoints(PROJECT_ID);
  console.log(`  ${'Endpoint catalog'.padEnd(26)} ${endpoints.length}`);
  for (const endpoint of endpoints) {
    console.log(
      `    GET ${endpoint.path.padEnd(16)} auth=${endpoint.authRequired ? 'yes' : 'no'} ` +
        `limit=${endpoint.rateLimitPerMin}/min ${endpoint.summary}`,
    );
  }
}

let failures = 0;

/** Pass/fail reporter shared by the seed's read-back assertions. */
function check(ok: boolean, label: string, detail = ''): void {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main(): Promise<void> {
  console.log(`[seed:api-build] Registering "${PROJECT_NAME}" (${BASE_URL}) as an API Build project.`);

  await removeLegacyAdminListing();

  console.log('\n=== Live upstream check ===');
  const probe = await probeUpstream();
  console.log(
    `  GET ${BASE_URL}/forecast?latitude=52.52&longitude=13.41&current=temperature_2m`,
  );
  console.log(
    `  HTTP ${probe.status} in ${probe.latencyMs}ms` +
      (probe.ok ? ` — sample reading ${probe.sample}` : ` — ${probe.error ?? 'unavailable'}`),
  );

  const previous = (await getProject(PROJECT_ID)) as Record<string, unknown> | null;
  const record = buildProjectRecord(probe, previous ? String(previous.createdAt ?? '') : '');
  await saveProject(record);
  console.log(
    `\n[seed:api-build] Project "${PROJECT_ID}" ${previous ? 'refreshed in place' : 'created'} ` +
      `(status: ${String(record.status)}).`,
  );

  // Default scaffolding exactly as POST /projects creates it: a v1.0.0 draft
  // version row, the Free/Pro/Business plan ladder and a 'Project created'
  // activity entry. The seed trail is cleared first so re-runs never duplicate
  // these entries.
  await clearSeedTrail();
  await ensureProjectDefaults(PROJECT_ID);

  await importEndpoints(PROJECT_ID, buildOperations());
  console.log(`[seed:api-build] Imported ${FORECAST_ENDPOINTS.length} verified endpoints.`);

  await saveVersion(PROJECT_ID, {
    id: VERSION,
    semver: VERSION,
    status: 'published',
    notes: 'Initial published version of the live Open-Meteo forecast API.',
    endpointsCount: FORECAST_ENDPOINTS.length,
    isDefault: true,
    releasedAt: new Date().toISOString(),
    changelog: {
      added: FORECAST_ENDPOINTS.map((entry) => `GET ${entry.path}`),
      modified: [],
      deprecated: [],
      breaking: [],
    },
    createdAt: new Date().toISOString(),
  });

  await addDeployment(PROJECT_ID, {
    version: VERSION,
    environment: 'production',
    source: 'External API',
    status: probe.ok ? 'healthy' : 'failed',
    url: BASE_URL,
    author: 'seed:api-build',
    logs: [
      `Registered the live public API ${PROJECT_NAME}.`,
      probe.ok
        ? `Live check passed: HTTP ${probe.status} in ${probe.latencyMs}ms (sample ${probe.sample}).`
        : `Live check failed: ${probe.error ?? 'unavailable'}.`,
    ],
  });

  await addActivity(
    PROJECT_ID,
    probe.ok
      ? `Live check passed: HTTP ${probe.status} in ${probe.latencyMs}ms (sample ${probe.sample})`
      : `Live check failed: ${probe.error ?? 'unavailable'}`,
    probe.ok ? 'ok' : 'warning',
  );

  await readBack();

  if (failures > 0) {
    console.error(`\n[seed:api-build] ${failures} read-back check(s) FAILED.`);
    process.exitCode = 1;
    return;
  }

  console.log(
    probe.ok
      ? '\n[seed:api-build] Done. The project is live in the user API Build workspace.'
      : '\n[seed:api-build] Done, but the upstream is not answering — the project was registered as degraded.',
  );
}

if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
  console.error(
    '[seed:api-build] Refusing to run: NODE_ENV is "production". This seed is development-only.',
  );
  process.exit(1);
}

main()
  .catch((error) => {
    console.error('[seed:api-build] Failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });

