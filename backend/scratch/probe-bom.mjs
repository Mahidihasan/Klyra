/**
 * Scratch probe (development only, not part of the application).
 *
 * /v1/bom answered HTTP 200 with an empty result set at Sydney, Melbourne and
 * Berlin. This walks several parameter shapes inside the model's own coverage
 * area to confirm the endpoint serves no data at all, rather than rejecting it
 * because of my parameter choice.
 */
const BASE_URL = 'https://api.open-meteo.com/v1';

const SHAPES = [
  '&current=temperature_2m',
  '&hourly=temperature_2m',
  '&hourly=wind_speed_10m',
  '&hourly=temperature_2m,wind_speed_10m,precipitation',
  '&daily=temperature_2m_max',
  '&hourly=temperature_2m&models=access_global',
  '&current=temperature_2m&models=access_global',
  '&hourly=temperature_2m&forecast_days=3&timezone=auto',
];

const PLACES = [
  { label: 'Sydney', lat: -33.87, lon: 151.21 },
  { label: 'Alice Springs', lat: -23.7, lon: 133.88 },
];

async function main() {
  console.log(`BOM endpoint probe against ${BASE_URL}/bom\n`);

  for (const place of PLACES) {
    for (const suffix of SHAPES) {
      const url = `${BASE_URL}/bom?latitude=${place.lat}&longitude=${place.lon}${suffix}`;
      try {
        const response = await fetch(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
          headers: { Accept: 'application/json', 'User-Agent': 'KlyraProbe/1.0' },
        });
        const text = await response.text();
        let summary = `HTTP ${response.status}`;

        try {
          const body = JSON.parse(text);
          if (body.error) {
            summary += ` error="${String(body.reason).slice(0, 60)}"`;
          } else {
            const shapes = ['current', 'hourly', 'daily']
              .map((section) => {
                const value = body[section];
                if (!value || typeof value !== 'object') return null;
                const numeric = Object.entries(value).filter(
                  ([, v]) =>
                    typeof v === 'number' ||
                    (Array.isArray(v) && v.some((item) => typeof item === 'number')),
                ).length;
                return `${section}:${numeric}`;
              })
              .filter(Boolean)
              .join(' ');
            summary += ` ${shapes || 'no data sections'} | ${text.slice(0, 150).replace(/\s+/g, ' ')}`;
          }
        } catch {
          summary += ` non-JSON="${text.slice(0, 80).replace(/\s+/g, ' ')}"`;
        }

        console.log(`${place.label.padEnd(14)} ${suffix.padEnd(52)} ${summary}`);
      } catch (error) {
        console.log(
          `${place.label.padEnd(14)} ${suffix.padEnd(52)} FAILED ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    console.log('');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});