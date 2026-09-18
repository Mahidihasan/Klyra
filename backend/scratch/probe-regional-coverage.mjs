/**
 * Scratch probe (development only, not part of the application).
 *
 * /v1/metno and /v1/bom are limited-area models. At a Berlin coordinate both
 * answer HTTP 200 with unusable data (null / NaN-driven invalid JSON), which
 * says nothing about whether they work inside their coverage area. This checks
 * in-region coordinates before deciding whether those endpoints belong in the
 * listing's api_spec, and how they must be described.
 */
const BASE_URL = 'https://api.open-meteo.com/v1';

const CASES = [
  { path: '/metno', label: 'Oslo (in region)', lat: 59.91, lon: 10.75 },
  { path: '/metno', label: 'Berlin (out of region)', lat: 52.52, lon: 13.41 },
  { path: '/metno', label: 'Reykjavik (in region)', lat: 64.15, lon: -21.94 },
  { path: '/bom', label: 'Sydney (in region)', lat: -33.87, lon: 151.21 },
  { path: '/bom', label: 'Melbourne (in region)', lat: -37.81, lon: 144.96 },
  { path: '/bom', label: 'Berlin (out of region)', lat: 52.52, lon: 13.41 },
  { path: '/forecast', label: 'Sydney (global control)', lat: -33.87, lon: 151.21 },
  { path: '/forecast', label: 'Oslo (global control)', lat: 59.91, lon: 10.75 },
];

async function probe(testCase) {
  const { path, label, lat, lon } = testCase;
  const url =
    `${BASE_URL}${path}?latitude=${lat}&longitude=${lon}` +
    '&current=temperature_2m&hourly=temperature_2m&forecast_days=1';
  const started = Date.now();

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', 'User-Agent': 'KlyraProbe/1.0' },
    });
    const text = await response.text();
    let detail = `HTTP ${response.status}`;

    try {
      const body = JSON.parse(text);
      if (body.error) {
        detail += ` error="${String(body.reason).slice(0, 70)}"`;
      } else {
        const current = body.current?.temperature_2m;
        const hourlyPoints = (body.hourly?.temperature_2m || []).filter(
          (v) => typeof v === 'number',
        ).length;
        detail +=
          ` current=${JSON.stringify(current)}` +
          ` hourlyPoints=${hourlyPoints}` +
          ` lat=${String(body.latitude)} lon=${String(body.longitude)}`;
      }
    } catch {
      detail += ` non-JSON="${text.slice(0, 90).replace(/\s+/g, ' ')}"`;
    }

    console.log(`${label.padEnd(24)} ${path.padEnd(10)} ${detail} ${Date.now() - started}ms`);
  } catch (error) {
    console.log(
      `${label.padEnd(24)} ${path.padEnd(10)} FETCH FAILED ${error instanceof Error ? error.message : error}`,
    );
  }
}

async function main() {
  console.log(`Regional coverage probe against ${BASE_URL}\n`);
  for (const testCase of CASES) {
    await probe(testCase);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});