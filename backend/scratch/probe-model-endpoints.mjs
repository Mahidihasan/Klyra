/**
 * Scratch probe (development only, not part of the application).
 *
 * Determines, per Open-Meteo model endpoint, which query-parameter shape
 * actually returns usable forecast data. A 200 alone is not proof: some model
 * endpoints answer 200 with a null/absent `current` block, or with an error
 * body. Only shapes that return real values are allowed into the listing's
 * api_spec.
 */
const BASE_URL = 'https://api.open-meteo.com/v1';

const PATHS = [
  '/forecast',
  '/dwd-icon',
  '/gfs',
  '/meteofrance',
  '/ecmwf',
  '/jma',
  '/metno',
  '/bom',
  '/icon_eu',
];

const SHAPES = {
  current: '&current=temperature_2m',
  hourly: '&hourly=temperature_2m&forecast_days=1',
  daily: '&daily=temperature_2m_max&forecast_days=1',
};

async function probe(path, suffix, label) {
  const url = `${BASE_URL}${path}?latitude=52.52&longitude=13.41${suffix}`;
  const started = Date.now();
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', 'User-Agent': 'KlyraProbe/1.0' },
    });
    const text = await response.text();
    let usable = false;
    let detail = `HTTP ${response.status}`;

    try {
      const body = JSON.parse(text);
      if (body.error) {
        detail += ` error="${String(body.reason).slice(0, 60)}"`;
      } else if (label === 'current') {
        const value = body.current?.temperature_2m;
        usable = typeof value === 'number';
        detail += ` current.temperature_2m=${JSON.stringify(value)}`;
      } else if (label === 'hourly') {
        const values = body.hourly?.temperature_2m || [];
        const numeric = values.filter((v) => typeof v === 'number');
        usable = numeric.length > 0;
        detail += ` hourly points=${numeric.length}`;
      } else {
        const values = body.daily?.temperature_2m_max || [];
        const numeric = values.filter((v) => typeof v === 'number');
        usable = numeric.length > 0;
        detail += ` daily points=${numeric.length}`;
      }
    } catch {
      detail += ` non-JSON body="${text.slice(0, 70).replace(/\s+/g, ' ')}"`;
    }

    detail += ` ${Date.now() - started}ms`;
    return { ok: usable, detail };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  console.log(`Probing ${BASE_URL} (Berlin coordinate)\n`);
  const winners = [];

  for (const path of PATHS) {
    console.log(`--- ${path}`);
    const usable = [];
    for (const [label, suffix] of Object.entries(SHAPES)) {
      const { ok, detail } = await probe(path, suffix, label);
      console.log(`    ${ok ? 'USABLE' : 'not   '} ${label.padEnd(8)} ${detail}`);
      if (ok) usable.push(label);
    }
    if (usable.length > 0) winners.push(`${path}: ${usable.join(', ')}`);
    console.log('');
  }

  console.log('=== Summary: path -> usable parameter shapes ===');
  for (const line of winners) console.log(`  ${line}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});