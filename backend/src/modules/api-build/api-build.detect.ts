/** Server-side OpenAPI discovery for the API Build connection wizard. */
import { createHash } from 'node:crypto';

const TIMEOUT_MS = 12000;
/**
 * Conventional specification locations. Covers the frameworks Klyra-deployed
 * APIs actually use (Swagger/springdoc/springfox/inflector/NestJS/FastAPI/
 * ASP.NET) — including `/api/v3/openapi.json`, which swagger-inflector (the
 * Swagger Petstore image) serves.
 */
const SPEC_PATHS = [
  '/openapi.json',
  '/openapi.yaml',
  '/openapi.yml',
  '/swagger.json',
  '/swagger.yaml',
  '/swagger.yml',
  '/v3/api-docs',
  '/api/v3/openapi.json',
  '/api/v3/openapi.yaml',
  '/api-docs',
  '/api-docs/',
  '/api-docs.json',
  '/v2/api-docs',
  '/swagger/v1/swagger.json',
  '/api/openapi.json',
  '/api/swagger.json',
];
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
/** `3.0.4`, `2.0`, or a quoted variant — the OpenAPI/Swagger version marker. */
const VERSION_MARKER = /^v?\d+(\.\d+)*$/i;

export interface DetectedEndpoint {
  id: string; method: string; path: string; description?: string;
  /**
   * Operation shape read from the document during detection. Carrying it here
   * means the deploy-time import (and anything consuming a detection payload)
   * records the real parameters / request body / responses the deployed API
   * declares, instead of inferred placeholders the Playground cannot prompt for.
   */
  parameters?: ImportableEndpoint['parameters'];
  requestBody?: ImportableEndpoint['requestBody'];
  responses?: ImportableEndpoint['responses'];
  /**
   * Path prefix every operation of this document is served under
   * (`servers[0].url`). Carried per endpoint so a detected payload can be turned
   * into requestable rows without re-reading the document.
   */
  basePath?: string;
}
export interface DetectionPayload {
  reachable: boolean; latencyMs: number | null; found: boolean; openApiVersion: string | null;
  endpointCount: number; schemaCount: number; authKind: string | null; baseUrl: string;
  foundAt: string | null; title: string | null; description: string | null; servers: string[];
  securitySchemes: string[]; endpoints: DetectedEndpoint[]; reason: string;
  /**
   * Path prefix the operations are served under, from the document's own
   * `servers[].url` (for example `/api/v3` for swagger-inflector). Callers must
   * insert it between the deployment URL and an endpoint path, otherwise every
   * request 404s against the deployed API.
   */
  basePath: string;
}

const blank = (baseUrl: string, extra: Partial<DetectionPayload> = {}): DetectionPayload => ({
  reachable: false, latencyMs: null, found: false, openApiVersion: null, endpointCount: 0, schemaCount: 0,
  authKind: null, baseUrl, foundAt: null, title: null, description: null, servers: [], securitySchemes: [], endpoints: [], basePath: '', reason: '', ...extra,
});

/**
 * The base path the document declares, taken from `servers[].url`:
 *   - a relative server URL (`/api/v3`) is the API base path;
 *   - an absolute server URL contributes its path only when it addresses the
 *     same origin that was probed (a production host we are not talking to
 *     contributes nothing);
 *   - server variables (`{version}`) are ignored.
 * Returns '' when the API is served at the origin root (today's behaviour).
 */
export function resolveBasePath(servers: string[], probedBaseUrl = ''): string {
  let probed: URL | null = null;
  try { probed = new URL(probedBaseUrl); } catch { probed = null; }
  for (const raw of servers) {
    const value = String(raw || '').trim();
    if (!value || value === '/' || value.includes('{')) continue;
    if (/^https?:\/\//i.test(value)) {
      let parsed: URL | null = null;
      try { parsed = new URL(value); } catch { continue; }
      if (!probed || parsed.host !== probed.host) continue;
      const sharedPath = parsed.pathname.replace(/\/+$/, '');
      if (sharedPath) return sharedPath;
      continue;
    }
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) continue; // other schemes
    const path = `/${value.replace(/^\/+/, '')}`.replace(/\/+$/, '');
    if (path && path !== '/') return path;
  }
  return '';
}

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
  // Conservative YAML subset: enough for the version marker, `paths:` and its
  // method keys. Indentation is read from the document itself so both 2-space
  // and 4-space styles parse; a method key must be a block start (`get:`) so
  // description text can never be mistaken for an operation.
  const doc: Record<string, unknown> = {};
  let inPaths = false; let pathsIndent = -1; let currentPath = ''; let currentPathIndent = -1;
  for (const source of text.split(/\r?\n/)) {
    const line = source.replace(/\s+#.*$/, '');
    const indent = line.length - line.trimStart().length; const value = line.trim();
    if (!value || value.startsWith('#')) continue;
    const match = value.match(/^([^:]+):\s*(.*)$/); if (!match) continue;
    const key = match[1].trim().replace(/^['"]|['"]$/g, ''); const body = match[2].trim().replace(/^['"]|['"]$/g, '');
    if (key === 'paths') { inPaths = true; pathsIndent = indent; currentPath = ''; doc.paths = {}; continue; }
    if (!inPaths) {
      if (['openapi', 'swagger'].includes(key) && VERSION_MARKER.test(body)) doc[key] = body;
      continue;
    }
    if (indent <= pathsIndent) { inPaths = false; currentPath = ''; continue; } // paths block ended
    if (key.startsWith('/')) { currentPath = key; currentPathIndent = indent; (doc.paths as Record<string, unknown>)[key] = {}; continue; }
    if (currentPath && indent > currentPathIndent && METHODS.has(key.toUpperCase()) && body === '') {
      ((doc.paths as Record<string, unknown>)[currentPath] as Record<string, unknown>)[key.toLowerCase()] = {};
    }
  }
  return doc.openapi || doc.swagger ? doc : null;
}

/**
 * True when a document really is an OpenAPI/Swagger specification: a version
 * marker plus a `paths` object with at least one operation. Arbitrary JSON
 * payloads, HTML pages and Swagger UI shells are rejected — nothing is ever
 * imported from a response that is not a specification.
 */
export function isOpenApiDocument(doc: unknown): doc is Record<string, unknown> {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return false;
  const record = doc as Record<string, unknown>;
  const marker = typeof record.openapi === 'string' ? record.openapi : typeof record.swagger === 'string' ? record.swagger : '';
  if (!VERSION_MARKER.test(marker.trim())) return false;
  const paths = record.paths;
  if (!paths || typeof paths !== 'object' || Array.isArray(paths)) return false;
  return Object.values(paths as Record<string, unknown>).some((operationMap) =>
    Boolean(operationMap) && typeof operationMap === 'object' && !Array.isArray(operationMap) &&
    Object.keys(operationMap as Record<string, unknown>).some((key) => METHODS.has(key.toUpperCase())));
}

function inspect(doc: Record<string, unknown>, baseUrl: string): DetectionPayload | null {
  // Never treat arbitrary JSON or a Swagger UI / HTML page as a specification:
  // only a real OpenAPI/Swagger document with at least one operation is used.
  if (!isOpenApiDocument(doc)) return null;
  const paths = doc.paths as Record<string, unknown>;
  const endpoints: DetectedEndpoint[] = [];
  for (const [path, operationMap] of Object.entries(paths)) {
    if (!operationMap || typeof operationMap !== 'object') continue;
    for (const [key, operation] of Object.entries(operationMap as Record<string, unknown>)) {
      const method = key.toUpperCase(); if (!METHODS.has(method)) continue;
      const details = operation && typeof operation === 'object' ? operation as Record<string, unknown> : {};
      const shape = operationDetails(details);
      endpoints.push({
        id: `ep-${endpoints.length + 1}`,
        method,
        path,
        description: String(details.summary || details.description || '').slice(0, 160) || undefined,
        // Real operation shape — this is what lets the deploy-time import (and
        // the Playground) know which inputs an endpoint requires.
        ...(shape.parameters.length ? { parameters: shape.parameters } : {}),
        ...(shape.requestBody ? { requestBody: shape.requestBody } : {}),
        ...(shape.responses.length ? { responses: shape.responses } : {}),
      });
    }
  }
  const components = doc.components && typeof doc.components === 'object' ? doc.components as Record<string, unknown> : {};
  const schemas = components.schemas && typeof components.schemas === 'object' ? components.schemas as Record<string, unknown> : doc.definitions && typeof doc.definitions === 'object' ? doc.definitions as Record<string, unknown> : {};
  const security = components.securitySchemes && typeof components.securitySchemes === 'object' ? components.securitySchemes as Record<string, unknown> : {};
  const schemes = Object.entries(security).map(([name, item]) => item && typeof item === 'object' ? String((item as Record<string, unknown>).type || name) : name);
  const info = doc.info && typeof doc.info === 'object' ? doc.info as Record<string, unknown> : {};
  const servers = Array.isArray(doc.servers) ? doc.servers.map((server) => server && typeof server === 'object' ? String((server as Record<string, unknown>).url || '') : '').filter(Boolean) : [];
  const basePath = resolveBasePath(servers, baseUrl);
  // Every operation is served under the same base path, so it rides along with
  // each detected endpoint (see DetectedEndpoint.basePath).
  if (basePath) for (const endpoint of endpoints) endpoint.basePath = basePath;
  return blank(baseUrl, { reachable: true, found: true, openApiVersion: doc.openapi ? `OpenAPI ${String(doc.openapi)}` : doc.swagger ? `Swagger ${String(doc.swagger)}` : 'OpenAPI', endpointCount: endpoints.length, schemaCount: Object.keys(schemas).length, authKind: schemes.length ? `${schemes.join(', ')} authentication` : null, title: String(info.title || '') || null, description: String(info.description || '') || null, servers, securitySchemes: schemes, endpoints, basePath });
}

export async function detectUpstream(baseInput: string, explicitSpecUrl = ''): Promise<DetectionPayload> {
  const baseUrl = normalize(baseInput || explicitSpecUrl);
  const direct = explicitSpecUrl.trim();
  let landingText = '';
  if (!direct) {
    const health = await getText(baseUrl, 6000);
    if (!health.ok) return blank(baseUrl, { reason: `Unable to reach ${baseUrl} (HTTP ${health.status || 'network error'}).`, latencyMs: health.latencyMs });
    landingText = health.text;
  }
  const conventional = direct ? [direct] : SPEC_PATHS.map((path) => `${baseUrl}${path}`);
  const resolved = await resolveCandidateSpecs(baseUrl, conventional);
  if (resolved) return resolved;
  // Not at a conventional location: ask the application itself. Swagger UI
  // pages declare their own specification URL, so discovery stays targeted
  // instead of probing arbitrary paths.
  if (!direct) {
    const declared = extractSpecUrlsFromHtml(landingText);
    if (declared.length) {
      const declaredResolved = await resolveCandidateSpecs(
        baseUrl,
        declared.map((url) => (/^https?:\/\//i.test(url) ? url : `${baseUrl}${url}`)),
      );
      if (declaredResolved) return declaredResolved;
    }
  }
  return blank(baseUrl, { reachable: true, reason: direct ? `No OpenAPI specification found at ${direct}.` : `No OpenAPI or Swagger specification discovered under ${baseUrl}.` });
}

/** Tries candidate URLs in order and returns the first real specification. */
async function resolveCandidateSpecs(baseUrl: string, candidates: string[]): Promise<DetectionPayload | null> {
  for (const url of candidates) {
    const result = await getText(url); if (!result.ok) continue;
    const document = parseDocument(result.text); if (!document) continue;
    const detected = inspect(document, baseUrl); if (!detected) continue;
    return { ...detected, latencyMs: result.latencyMs, foundAt: url, reason: `Specification resolved from ${url}` };
  }
  return null;
}

/**
 * Extracts specification URLs an application declares in its own Swagger UI
 * page (`url: "/api/v3/openapi.json"`, an `apiUrl` that concatenates a spec
 * path, `data-url`, …). Bounded, and every candidate is still validated as an
 * OpenAPI document before use — the application's declaration is followed, no
 * arbitrary paths are guessed.
 */
export function extractSpecUrlsFromHtml(html: string, limit = 5): string[] {
  if (!html || !/<html|swagger|openapi/i.test(html)) return [];
  const found: string[] = [];
  const pattern = /["']((?:https?:\/\/[^"']+|\/)[^"']*\.(?:json|yaml|yml))["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    if (!found.includes(match[1])) found.push(match[1]);
    if (found.length >= limit) break;
  }
  return found;
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
  /**
   * Path prefix the deployed API serves this operation under
   * (`servers[0].url`, e.g. `/api/v3`). Carried from detection so the import can
   * record it and consumers can build requestable URLs.
   */
  basePath?: string;
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

/**
 * Deterministic, collision-free endpoint row id.
 *
 * Derived from the same (method, path) identity the `api_build_endpoints`
 * unique constraint uses, so re-discovering an endpoint always updates its own
 * row: imports stay idempotent and a generated id can never collide with
 * `api_build_endpoints_pkey (project_id, id)` for a different operation.
 */
export function endpointRowId(method: string, path: string): string {
  const digest = createHash('sha1').update(`${method.toUpperCase()} ${path}`).digest('hex').slice(0, 16);
  return `ep-${String(method).toLowerCase()}-${digest}`;
}

/**
 * Overlays the parameters a document declares onto the inferred path
 * placeholders (matched by name + location): the document wins, while a path
 * parameter the document omits keeps its inferred description.
 */
function mergeParameters(
  base: ImportableEndpoint['parameters'],
  actual: ImportableEndpoint['parameters'],
): ImportableEndpoint['parameters'] {
  const merged = base.map(
    (placeholder) =>
      actual.find((real) => real.name === placeholder.name && real.in === placeholder.in) ?? placeholder,
  );
  for (const real of actual) {
    if (!merged.some((existing) => existing.name === real.name && existing.in === real.in)) merged.push(real);
  }
  return merged;
}

export function extractOperations(specUrl: string, detected: DetectedEndpoint[]): ImportableEndpoint[] {
  const methodOf = (m: string): ImportableEndpoint['method'] =>
    (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(m) ? m as ImportableEndpoint['method'] : 'GET');
  return detected.map((ep) => ({
    id: endpointRowId(ep.method, ep.path),
    method: methodOf(ep.method),
    path: ep.path,
    summary: ep.description || `${ep.method} ${ep.path}`,
    description: ep.description || '',
    category: inferCategory(ep.path),
    authRequired: true,
    rateLimitPerMin: 100,
    status: 'active' as const,
    // Detection already read the real operation shape from the document; the
    // path-template placeholders stay as the base so a path parameter the
    // document omits is still described, and the document's own parameters win.
    parameters: mergeParameters(inferPathParams(ep.path), ep.parameters ?? []),
    requestBody: ep.requestBody
      ? ep.requestBody
      : ['POST', 'PUT', 'PATCH'].includes(ep.method)
        ? { contentType: 'application/json', schema: '', sampleBody: '{\n  "example": "value"\n}' }
        : null,
    responses: ep.responses?.length
      ? ep.responses
      : [
          { statusCode: 200, description: 'Successful response', schema: '', sampleBody: '' },
          { statusCode: 429, description: 'Rate limit exceeded', schema: '', sampleBody: '' },
        ],
    specUrl,
    // The document's base path travels with every row so the import records it
    // (and nothing downstream has to re-read the specification).
    ...(ep.basePath ? { basePath: ep.basePath } : {}),
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

/**
 * The operation shape a document declares: real parameters (path/query/header
 * with required flags and examples), the request body and the responses.
 * Shared by detection (so a detected endpoint carries what it needs) and by the
 * spec-aware extractor, so both describe an operation identically.
 */
function operationDetails(operation: Record<string, unknown>): {
  parameters: ImportableEndpoint['parameters'];
  requestBody: ImportableEndpoint['requestBody'];
  responses: ImportableEndpoint['responses'];
} {
  const parameters: ImportableEndpoint['parameters'] = [];
  if (Array.isArray(operation.parameters)) {
    for (const p of operation.parameters) {
      if (!p || typeof p !== 'object') continue;
      const param = p as Record<string, unknown>;
      const schema = param.schema && typeof param.schema === 'object' ? param.schema as Record<string, unknown> : {};
      const real: ImportableEndpoint['parameters'][number] = {
        name: String(param.name ?? 'param'),
        in: String(param.in ?? 'query'),
        type: String(schema.type ?? param.type ?? 'string'),
        required: param.required === true,
        description: String(param.description ?? ''),
        // Omitted entirely when the document has no example: a key present with
        // `undefined` disappears on the jsonb round-trip and would then look
        // like a change on the next import.
        ...(schema.example !== undefined && schema.example !== null ? { example: String(schema.example) } : {}),
      };
      const existingIndex = parameters.findIndex((existing) => existing.name === real.name && existing.in === real.in);
      if (existingIndex >= 0) parameters[existingIndex] = real;
      else parameters.push(real);
    }
  }

  let requestBody: ImportableEndpoint['requestBody'] = null;
  if (operation.requestBody && typeof operation.requestBody === 'object') {
    const rb = operation.requestBody as Record<string, unknown>;
    const content = rb.content && typeof rb.content === 'object' ? rb.content as Record<string, unknown> : {};
    const [contentType, media] = Object.entries(content)[0] ?? ['application/json', undefined];
    const schema = media && typeof media === 'object' ? (media as Record<string, unknown>).schema : null;
    let sampleBody = '';
    if (schema) { try { sampleBody = JSON.stringify(JSON.parse(sampleFromSchema(schema)), null, 2); } catch { sampleBody = ''; } }
    requestBody = { contentType: String(contentType), schema: schema ? JSON.stringify(schema, null, 2) : '', sampleBody };
  }

  const responses: ImportableEndpoint['responses'] = [];
  if (operation.responses && typeof operation.responses === 'object') {
    for (const [code, value] of Object.entries(operation.responses as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const resp = value as Record<string, unknown>;
      const content = resp.content && typeof resp.content === 'object' ? resp.content as Record<string, unknown> : {};
      const [, media] = Object.entries(content)[0] ?? ['', undefined];
      const schema = media && typeof media === 'object' ? (media as Record<string, unknown>).schema : null;
      let sampleBody = '';
      if (schema) { try { sampleBody = JSON.stringify(JSON.parse(sampleFromSchema(schema)), null, 2); } catch { sampleBody = ''; } }
      responses.push({ statusCode: Number(code) || 200, description: String(resp.description ?? ''), schema: schema ? JSON.stringify(schema) : '', sampleBody });
    }
  }

  return { parameters, requestBody, responses };
}

/** Merges a document's operation shape into an endpoint row — real values win
 *  over the inferred path-template placeholders. */
function describeOperation(operation: Record<string, unknown>, row: ImportableEndpoint): ImportableEndpoint {
  const details = operationDetails(operation);
  row.parameters = mergeParameters(row.parameters, details.parameters);
  if (row.requestBody && details.requestBody) {
    row.requestBody = {
      contentType: details.requestBody.contentType,
      schema: details.requestBody.schema,
      sampleBody: details.requestBody.sampleBody || row.requestBody.sampleBody,
    };
  }
  if (details.responses.length) row.responses = details.responses;
  return row;
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

    return describeOperation(op, row);
  });
}
