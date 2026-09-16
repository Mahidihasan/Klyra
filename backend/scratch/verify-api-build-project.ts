/* eslint-disable no-console */
/**
 * Scratch verification (development only, not part of the application).
 *
 * Proves the seeded API Build project is real and correctly placed by
 *   1. calling the real `listProjects()` / `composeProject()` services — the
 *      functions behind `GET /api/api-build/projects` — and asserting the
 *      workspace-facing fields,
 *   2. re-requesting every endpoint stored in `api_build_endpoints` using its
 *      own documented parameters and example coordinate,
 *   3. confirming the legacy admin-side listing (`apis` table) is gone, since
 *      this API belongs to the user API Build workspace, not API Management,
 *   4. best-effort: hitting the running dev server over HTTP.
 */
import { pool } from '../src/services/database.service';
import {
  composeProject,
  listEndpoints,
  listPlans,
  listProjects,
  listVersions,
} from '../src/modules/api-build/api-build.service';

const PROJECT_ID = 'proj-open-meteo-weather';
const BASE_URL = 'https://api.open-meteo.com/v1';
const DEV_SERVER = 'http://localhost:4000';

let failures = 0;

function check(ok: boolean, label: string, detail = ''): void {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

async function main(): Promise<void> {
  console.log('=== 1. Project record via the real API Build services ===');
  const projects = await listProjects();
  check(
    projects.some((project) => project.id === PROJECT_ID),
    'GET /api/api-build/projects lists the project',
    `total projects: ${projects.length}`,
  );

  const composed = (await composeProject(PROJECT_ID)) as Record<string, unknown> | null;
  if (!composed) {
    check(false, 'composeProject returns the record');
    process.exitCode = 1;
    return;
  }

  check(composed.status === 'published', 'status is published', `status=${String(composed.status)}`);
  check(composed.visibility === 'public', 'visibility is public');
  check(composed.published === true, 'published flag is true');
  check(composed.authKind === 'none', 'authKind is none (verified keyless upstream)');
  check(composed.category === 'Weather', 'category is Weather', `category=${String(composed.category)}`);
  check(composed.baseUrl === BASE_URL, 'baseUrl points at the live host');
  check(Number(composed.endpointCount) === 7, 'endpointCount is 7', `endpointCount=${String(composed.endpointCount)}`);
  check(composed.environment === 'production', 'environment is production');

  const deployment = composed.deployment as Record<string, unknown>;
  check(
    deployment.kind === 'external' && deployment.status === 'healthy-external',
    'deployment is external/healthy-external',
    `kind=${String(deployment.kind)} status=${String(deployment.status)}`,
  );

  const detection = composed.detection as Record<string, unknown> | null;
  check(
    !!detection && detection.found === true && detection.reachable === true && Number(detection.endpointCount) === 7,
    'detection recorded 7 reachable endpoints',
  );

  const versions = (composed.versions ?? []) as Array<Record<string, unknown>>;
  check(
    versions.some((v) => v.semver === 'v1.0.0' && v.status === 'published' && v.isDefault === true),
    'version v1.0.0 is published and default',
    versions.map((v) => `${String(v.semver)}:${String(v.status)}`).join(', '),
  );

  const plans = (composed.plans ?? []) as Array<Record<string, unknown>>;
  check(plans.length === 3, 'plan ladder scaffolded (Free/Pro/Business)', `plans=${plans.length}`);
  check(
    Array.isArray(composed.activity) && (composed.activity as unknown[]).length >= 3,
    'activity trail recorded',
    `entries=${(composed.activity as unknown[]).length}`,
  );

  console.log('\n=== 2. Endpoint catalog driven from its own stored parameters ===');
  const endpoints = await listEndpoints(PROJECT_ID);
  check(endpoints.length === 7, '7 endpoint rows', `rows=${endpoints.length}`);
  check(endpoints.every((e) => e.authRequired === false), 'no endpoint requires auth');
  check(endpoints.every((e) => e.rateLimitPerMin === 600), 'rate limit is the real 600/min');
  check(
    !endpoints.some((e) => e.path === '/bom' || e.path === '/icon_eu'),
    'unverified endpoints (/bom, /icon_eu) are absent',
  );

  for (const endpoint of endpoints) {
    // Drive the upstream with exactly the parameters the catalog advertises,
    // so a wrong promise (a current block where none is served, or an
    // out-of-coverage coordinate) fails here.
    const query = new URLSearchParams();
    for (const parameter of endpoint.parameters as Array<{ name: string; example?: string }>) {
      if (parameter.example !== undefined) query.set(parameter.name, parameter.example);
    }
    const documentsCurrent = query.has('current');

    const started = Date.now();
    try {
      const response = await fetch(`${BASE_URL}${endpoint.path}?${query.toString()}`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
        headers: { Accept: 'application/json', 'User-Agent': 'KlyraVerify/1.0' },
      });
      const text = await response.text();

      let hourlyPoints = -1;
      let currentValue: unknown = 'n/a';
      let parseError = '';
      try {
        const body = JSON.parse(text) as {
          hourly?: { temperature_2m?: unknown[] };
          current?: Record<string, unknown>;
        };
        hourlyPoints = (body.hourly?.temperature_2m ?? []).filter(
          (value) => typeof value === 'number',
        ).length;
        if (documentsCurrent) currentValue = body.current?.temperature_2m;
      } catch (error) {
        parseError = error instanceof Error ? error.message : String(error);
      }

      const ok =
        response.status === 200 &&
        parseError === '' &&
        hourlyPoints > 0 &&
        (!documentsCurrent || typeof currentValue === 'number');

      check(
        ok,
        `GET ${endpoint.path}`,
        `HTTP ${response.status}, hourly=${hourlyPoints}, current=${JSON.stringify(currentValue)}` +
          `${documentsCurrent ? '' : ' (current not documented)'}` +
          `${parseError ? ` parse="${parseError}"` : ''} in ${Date.now() - started}ms`,
      );
    } catch (error) {
      check(false, `GET ${endpoint.path}`, error instanceof Error ? error.message : String(error));
    }
  }

  console.log('\n=== 3. Placement: API Build yes, Admin API Management no ===');
  const versionRows = await listVersions(PROJECT_ID);
  const defaultRows = versionRows.filter((v) => v.isDefault);
  check(
    defaultRows.length === 1 && defaultRows[0].endpointsCount === 7 && defaultRows[0].status === 'published',
    'exactly one default version row with 7 endpoints',
    versionRows.map((v) => `${v.semver}:${v.status}:${v.endpointsCount}`).join(', '),
  );
  const planRows = await listPlans(PROJECT_ID);
  check(planRows.length === 3, '3 plan rows persisted', planRows.map((p) => p.name).join(', '));

  const legacy = await pool.query(`SELECT id FROM apis WHERE slug = $1`, ['open-meteo-weather']);
  check(legacy.rows.length === 0, 'legacy admin-side listing removed from apis', `rows=${legacy.rows.length}`);

  console.log('\n=== 4. Dev server over HTTP (best effort) ===');
  try {
    const response = await fetch(`${DEV_SERVER}/api/api-build/projects`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    });
    const body = (await response.json()) as { data?: Array<{ id: string; name?: string }> };
    const served = (body.data ?? []).find((project) => project.id === PROJECT_ID);
    check(
      response.ok && !!served,
      'running backend serves the project at /api/api-build/projects',
      served ? `HTTP ${response.status}, name=${String(served.name)}` : `HTTP ${response.status}`,
    );
  } catch (error) {
    console.warn(
      `  SKIP  dev server not reachable (${error instanceof Error ? error.message : error})`,
    );
  }

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error('verification error:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });

