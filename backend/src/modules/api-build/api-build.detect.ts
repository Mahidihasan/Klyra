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

/* -------------------------------------------------------------------------- *
 * extractOperations — converts a detection payload into DetailedEndpointRow   *
 * records ready for relational import. Path parameters are inferred from the  *
 * real route shape; richer shapes come from extractOperationsFromSpec.        *
 * -------------------------------------------------------------------------- */
export interface ImportableEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  category: string;
  authRequired: boolean;
  rateLimitPerMin: number;
  status: 'active' | 'beta' | 'deprecated';
  parameters: { name: string; in: string; type: string; required: boolean; description: string; example?: string }[];
  requestBody: { contentType: string; schema: string; sampleBody: string } | null;
  responses: { statusCode: number; description: string; schema: string; sampleBody: string }[];
  specUrl?: string;
}

function inferCategory(path: string): string {
  const segment = path.split('/').filter(Boolean)[0]?.toLowerCase() ?? '';
  if (['generate', 'image', 'render', 'completion', 'chat', 'embedding'].some((k) => segment.includes(k))) return 'Generation';
  if (['user', 'account', 'auth', 'session'].some((k) => segment.includes(k))) return 'Users';
  if (['payment', 'refund', 'invoice', 'billing'].some((k) => segment.includes(k))) return 'Billing';
  if (['upload', 'file', 'asset', 'media'].some((k) => segment.includes(k))) return 'Media';
  return 'General';
}

function inferPathParams(path: string): ImportableEndpoint['parameters'] {
  return [...path.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => ({
    name: m[1],
    in: 'path',
    type: 'string',
    required: true,
    description: `Path parameter ${m[1]}`,
  }));
}

export function extractOperations(specUrl: string, detected: DetectedEndpoint[]): ImportableEndpoint[] {
  const methodOf = (m: string): ImportableEndpoint['method'] =>
    (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(m) ? m as ImportableEndpoint['method'] : 'GET');
  return detected.map((ep, index) => ({
    id: `ep-${index + 1}-${ep.method.toLowerCase()}-${ep.path.replace(/[^a-z0-9]+/gi, '-').slice(0, 48)}`,
    method: methodOf(ep.method),
    path: ep.path,
    summary: ep.description || `${ep.method} ${ep.path}`,
    description: ep.description || '',
    category: inferCategory(ep.path),
    authRequired: true,
    rateLimitPerMin: 100,
    status: 'active' as const,
    parameters: inferPathParams(ep.path),
    requestBody: ['POST', 'PUT', 'PATCH'].includes(ep.method)
      ? { contentType: 'application/json', schema: '', sampleBody: '{\n  "example": "value"\n}' }
      : null,
    responses: [
      { statusCode: 200, description: 'Successful response', schema: '', sampleBody: '' },
      { statusCode: 429, description: 'Rate limit exceeded', schema: '', sampleBody: '' },
    ],
    specUrl,
  }));
}
const SAMPLE_VALUES: Record<string, unknown> = { string: 'example', integer: 1, number: 1, boolean: true };

function schemaType(node: Record<string, unknown>): string {
  const t = node.type;
  if (typeof t === 'string') return t;
  if (Array.isArray(t)) return String(t[0] ?? 'string');
  if (node.properties) return 'object';
  return 'string';
}

function sampleFromSchema(node: unknown, depth = 0): string {
  if (depth > 4 || !node || typeof node !== 'object') return JSON.stringify('example');
  const schema = node as Record<string, unknown>;
  if (schema.example !== undefined) return JSON.stringify(schema.example);
  if (schema.default !== undefined) return JSON.stringify(schema.default);
  if (schema.enum && Array.isArray(schema.enum) && schema.enum.length) return JSON.stringify(schema.enum[0]);
  if (Array.isArray(schema.items)) return '[]';
  if (schema.items) return `[${sampleFromSchema(schema.items, depth + 1)}]`;
  if (schema.properties && typeof schema.properties === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(schema.properties as Record<string, unknown>)) {
      out[key] = depth === 0 ? JSON.parse(sampleFromSchema(child, depth + 1)) : sampleFromSchema(child, depth + 1);
    }
    return JSON.stringify(out);
  }
  return JSON.stringify(SAMPLE_VALUES[schemaType(schema)] ?? 'example');
}

/** Spec-aware variant: re-fetches the detected spec document and pulls real
 *  parameter, request-body and response shapes from it. */
export async function extractOperationsFromSpec(specUrl: string, detected: DetectedEndpoint[]): Promise<ImportableEndpoint[]> {
  const rows = extractOperations(specUrl, detected);
  if (!specUrl) return rows;
  const result = await getText(specUrl);
  if (!result.ok) return rows;
  const doc = parseDocument(result.text);
  if (!doc || !(doc.paths && typeof doc.paths === 'object')) return rows;
  const paths = doc.paths as Record<string, unknown>;

  return rows.map((row) => {
    const opMap = paths[row.path];
    if (!opMap || typeof opMap !== 'object') return row;
    const operation = (opMap as Record<string, unknown>)[row.method.toLowerCase()];
    if (!operation || typeof operation !== 'object') return row;
    const op = operation as Record<string, unknown>;

    // Parameters — real ones from the document.
    const parameters: ImportableEndpoint['parameters'] = [...row.parameters];
    if (Array.isArray(op.parameters)) {
      for (const p of op.parameters) {
        if (!p || typeof p !== 'object') continue;
        const param = p as Record<string, unknown>;
        if (parameters.some((existing) => existing.name === param.name && existing.in === param.in)) continue;
        const schema = param.schema && typeof param.schema === 'object' ? param.schema as Record<string, unknown> : {};
        parameters.push({
          name: String(param.name ?? 'param'),
          in: String(param.in ?? 'query'),
          type: String(schema.type ?? param.type ?? 'string'),
          required: param.required === true,
          description: String(param.description ?? ''),
          example: schema.example !== undefined ? String(schema.example) : undefined,
        });
      }
    }
    row.parameters = parameters;

    // Request body — from requestBody.content (OpenAPI 3) or parameters (Swagger 2).
    if (row.requestBody && op.requestBody && typeof op.requestBody === 'object') {
      const rb = op.requestBody as Record<string, unknown>;
      const content = rb.content && typeof rb.content === 'object' ? rb.content as Record<string, unknown> : {};
      const [contentType, media] = Object.entries(content)[0] ?? ['application/json', undefined];
      const schema = media && typeof media === 'object' ? (media as Record<string, unknown>).schema : null;
      let sampleBody = row.requestBody.sampleBody;
      if (schema) { try { sampleBody = JSON.stringify(JSON.parse(sampleFromSchema(schema)), null, 2); } catch { sampleBody = row.requestBody.sampleBody; } }
      row.requestBody = {
        contentType: String(contentType),
        schema: schema ? JSON.stringify(schema, null, 2) : '',
        sampleBody,
      };
    }

    // Responses — real status codes and sample payloads.
    if (op.responses && typeof op.responses === 'object') {
      const responses: ImportableEndpoint['responses'] = [];
      for (const [code, value] of Object.entries(op.responses as Record<string, unknown>)) {
        if (!value || typeof value !== 'object') continue;
        const resp = value as Record<string, unknown>;
        const content = resp.content && typeof resp.content === 'object' ? resp.content as Record<string, unknown> : {};
        const [, media] = Object.entries(content)[0] ?? ['', undefined];
        const schema = media && typeof media === 'object' ? (media as Record<string, unknown>).schema : null;
        let sampleBody = '';
        if (schema) { try { sampleBody = JSON.stringify(JSON.parse(sampleFromSchema(schema)), null, 2); } catch { sampleBody = ''; } }
        responses.push({
          statusCode: Number(code) || 200,
          description: String(resp.description ?? ''),
          schema: schema ? JSON.stringify(schema) : '',
          sampleBody,
        });
      }
      if (responses.length) row.responses = responses;
    }
    return row;
  });
}
