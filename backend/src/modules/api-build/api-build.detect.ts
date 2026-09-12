/** Server-side OpenAPI discovery for the API Build connection wizard. */
const TIMEOUT_MS = 12000;
const SPEC_PATHS = ['/openapi.json', '/swagger.json', '/api/openapi.json', '/v3/api-docs', '/api-docs', '/openapi.yaml', '/openapi.yml', '/swagger.yaml'];
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

export interface DetectedEndpoint { id: string; method: string; path: string; description?: string; }
export interface DetectionPayload {
  reachable: boolean; latencyMs: number | null; found: boolean; openApiVersion: string | null;
  endpointCount: number; schemaCount: number; authKind: string | null; baseUrl: string;
  foundAt: string | null; title: string | null; description: string | null; servers: string[];
  securitySchemes: string[]; endpoints: DetectedEndpoint[]; reason: string;
}

const blank = (baseUrl: string, extra: Partial<DetectionPayload> = {}): DetectionPayload => ({
  reachable: false, latencyMs: null, found: false, openApiVersion: null, endpointCount: 0, schemaCount: 0,
  authKind: null, baseUrl, foundAt: null, title: null, description: null, servers: [], securitySchemes: [], endpoints: [], reason: '', ...extra,
});

const normalize = (input: string) => {
  const value = input.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

async function getText(url: string, timeout = TIMEOUT_MS) {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      redirect: 'follow', signal: AbortSignal.timeout(timeout),
      headers: { Accept: 'application/json, application/yaml, text/yaml, text/plain, */*', 'User-Agent': 'KlyraApiBuild/1.0' },
    });
    return { ok: response.ok, status: response.status, text: await response.text(), latencyMs: Date.now() - started };
  } catch { return { ok: false, status: 0, text: '', latencyMs: Date.now() - started }; }
}

function parseDocument(text: string): Record<string, unknown> | null {
  try { const parsed = JSON.parse(text); return parsed && typeof parsed === 'object' ? parsed : null; } catch { /* yaml fallback below */ }
  // Deliberately conservative YAML subset: enough for standard paths/methods/spec metadata.
  const doc: Record<string, unknown> = {}; let section = ''; let currentPath = '';
  for (const source of text.split(/\r?\n/)) {
    const line = source.replace(/\s+#.*$/, ''); const indent = line.length - line.trimStart().length; const value = line.trim();
    if (!value || value.startsWith('#')) continue;
    const match = value.match(/^([^:]+):\s*(.*)$/); if (!match) continue;
    const key = match[1].trim().replace(/^['"]|['"]$/g, ''); const body = match[2].trim().replace(/^['"]|['"]$/g, '');
    if (indent === 0 && ['openapi', 'swagger'].includes(key)) doc[key] = body;
    if (indent === 0 && key === 'paths') { section = 'paths'; doc.paths = {}; continue; }
    if (section === 'paths' && indent === 2 && key.startsWith('/')) { currentPath = key; (doc.paths as Record<string, unknown>)[key] = {}; continue; }
    if (section === 'paths' && currentPath && indent >= 4 && METHODS.has(key.toUpperCase())) { ((doc.paths as Record<string, unknown>)[currentPath] as Record<string, unknown>)[key] = {}; }
  }
  return doc.openapi || doc.swagger || doc.paths ? doc : null;
}

function inspect(doc: Record<string, unknown>, baseUrl: string): DetectionPayload | null {
  const paths = doc.paths && typeof doc.paths === 'object' ? doc.paths as Record<string, unknown> : null;
  if (!paths) return null;
  const endpoints: DetectedEndpoint[] = [];
  for (const [path, operationMap] of Object.entries(paths)) {
    if (!operationMap || typeof operationMap !== 'object') continue;
    for (const [key, operation] of Object.entries(operationMap as Record<string, unknown>)) {
      const method = key.toUpperCase(); if (!METHODS.has(method)) continue;
      const details = operation && typeof operation === 'object' ? operation as Record<string, unknown> : {};
      endpoints.push({ id: `ep-${endpoints.length + 1}`, method, path, description: String(details.summary || details.description || '').slice(0, 160) || undefined });
    }
  }
  const components = doc.components && typeof doc.components === 'object' ? doc.components as Record<string, unknown> : {};
  const schemas = components.schemas && typeof components.schemas === 'object' ? components.schemas as Record<string, unknown> : doc.definitions && typeof doc.definitions === 'object' ? doc.definitions as Record<string, unknown> : {};
  const security = components.securitySchemes && typeof components.securitySchemes === 'object' ? components.securitySchemes as Record<string, unknown> : {};
  const schemes = Object.entries(security).map(([name, item]) => item && typeof item === 'object' ? String((item as Record<string, unknown>).type || name) : name);
  const info = doc.info && typeof doc.info === 'object' ? doc.info as Record<string, unknown> : {};
  const servers = Array.isArray(doc.servers) ? doc.servers.map((server) => server && typeof server === 'object' ? String((server as Record<string, unknown>).url || '') : '').filter(Boolean) : [];
  return blank(baseUrl, { reachable: true, found: true, openApiVersion: doc.openapi ? `OpenAPI ${String(doc.openapi)}` : doc.swagger ? `Swagger ${String(doc.swagger)}` : 'OpenAPI', endpointCount: endpoints.length, schemaCount: Object.keys(schemas).length, authKind: schemes.length ? `${schemes.join(', ')} authentication` : null, title: String(info.title || '') || null, description: String(info.description || '') || null, servers, securitySchemes: schemes, endpoints });
}

export async function detectUpstream(baseInput: string, explicitSpecUrl = ''): Promise<DetectionPayload> {
  const baseUrl = normalize(baseInput || explicitSpecUrl);
  const direct = explicitSpecUrl.trim();
  if (!direct) {
    const health = await getText(baseUrl, 6000);
    if (!health.ok) return blank(baseUrl, { reason: `Unable to reach ${baseUrl} (HTTP ${health.status || 'network error'}).`, latencyMs: health.latencyMs });
  }
  const candidates = direct ? [direct] : SPEC_PATHS.map((path) => `${baseUrl}${path}`);
  for (const url of candidates) {
    const result = await getText(url); if (!result.ok) continue;
    const document = parseDocument(result.text); if (!document) continue;
    const detected = inspect(document, baseUrl); if (!detected) continue;
    return { ...detected, latencyMs: result.latencyMs, foundAt: url, reason: `Specification resolved from ${url}` };
  }
  return blank(baseUrl, { reachable: true, reason: direct ? `No OpenAPI specification found at ${direct}.` : `No OpenAPI or Swagger specification discovered under ${baseUrl}.` });
}
