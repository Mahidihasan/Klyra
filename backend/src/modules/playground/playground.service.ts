import { RequestConfig, Environment, PlaygroundResponse, KeyValueItem } from './playground.types';

const TIMEOUT_MS = 30000;

const generateId = () =>
  Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

function substituteVariables(
  str: string,
  variables: Record<string, string>,
  secrets: Record<string, string>,
): string {
  const all = { ...variables, ...secrets };
  return str.replace(/\{\{([^}]+)\}\}/g, (m, n) => all[n.trim()] ?? m);
}

function maskSecretsInResponse(response: PlaygroundResponse): PlaygroundResponse {
  // Create a masked version of the response to prevent secret leakage
  const maskedBody = response.body.replace(/(\{\{.*?\}\})/g, '[MASKED_SECRET]');
  return {
    ...response,
    body: maskedBody,
  };
}

function createSecureEnvironmentCopy(environment: Environment | null): Environment | null {
  if (!environment) return null;

  // Create a copy with secret values masked for UI display
  const secretKeys = Object.keys(environment.secrets);
  const maskedSecrets: Record<string, string> = {};

  secretKeys.forEach(key => {
    maskedSecrets[key] = '••••••••'; // Mask all secret values
  });

  return {
    ...environment,
    secrets: maskedSecrets,
  };
}

function buildAuthHeaders(auth: RequestConfig['auth']): Record<string, string> {
  const h: Record<string, string> = {};
  switch (auth.type) {
    case 'bearer':
      if (auth.bearerToken) h['Authorization'] = `Bearer ${auth.bearerToken}`;
      break;
    case 'basic':
      if (auth.basicUsername !== undefined || auth.basicPassword !== undefined) {
        const cred = `${auth.basicUsername || ''}:${auth.basicPassword || ''}`;
        h['Authorization'] = `Basic ${Buffer.from(cred).toString('base64')}`;
      }
      break;
    case 'api-key':
      if (auth.apiKeyKey && auth.apiKeyValue && auth.apiKeyIn === 'header') {
        h[auth.apiKeyKey] = auth.apiKeyValue;
      }
      break;
  }
  return h;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.keys(headers).some(key => key.toLowerCase() === name.toLowerCase());
}

function removeHeader(headers: Record<string, string>, name: string): void {
  Object.keys(headers).forEach(key => {
    if (key.toLowerCase() === name.toLowerCase()) delete headers[key];
  });
}

/**
 * Executes an API request through the playground backend.
 */
export async function executeRequest(
  config: RequestConfig,
  environment: Environment | null,
): Promise<PlaygroundResponse> {
  const startTime = Date.now();
  const id = generateId();

  let url = config.url || '';
  if (!url) throw new Error('URL is required');
  if (environment) url = substituteVariables(url, environment.variables, environment.secrets);

  const params = config.params.filter((p: KeyValueItem) => p.enabled && p.key);
  const qs: string[] = [];
  params.forEach((p: KeyValueItem) => {
    let v = p.value;
    if (environment) v = substituteVariables(v, environment.variables, environment.secrets);
    qs.push(`${encodeURIComponent(p.key)}=${encodeURIComponent(v)}`);
  });
  if (qs.length) url += (url.includes('?') ? '&' : '?') + qs.join('&');

  const headers: Record<string, string> = {};
  config.headers
    .filter((h: KeyValueItem) => h.enabled && h.key)
    .forEach((h: KeyValueItem) => {
      let v = h.value;
      if (environment) v = substituteVariables(v, environment.variables, environment.secrets);
      headers[h.key] = v;
    });

  const auth = { ...config.auth };
  if (environment) {
    if (auth.apiKeyValue) auth.apiKeyValue = substituteVariables(auth.apiKeyValue, environment.variables, environment.secrets);
    if (auth.bearerToken) auth.bearerToken = substituteVariables(auth.bearerToken, environment.variables, environment.secrets);
    if (auth.basicUsername) auth.basicUsername = substituteVariables(auth.basicUsername, environment.variables, environment.secrets);
    if (auth.basicPassword) auth.basicPassword = substituteVariables(auth.basicPassword, environment.variables, environment.secrets);
  }
  const authHeaders = buildAuthHeaders(auth);
  Object.entries(authHeaders).forEach(([k, v]) => { if (!hasHeader(headers, k)) headers[k] = v; });
  if (auth.type === 'api-key' && auth.apiKeyIn === 'query' && auth.apiKeyKey) {
    const sep = url.includes('?') ? '&' : '?';
    url += sep + `${encodeURIComponent(auth.apiKeyKey)}=${encodeURIComponent(auth.apiKeyValue || '')}`;
  }

  const cookiePairs = config.cookies
    .filter((cookie: KeyValueItem) => cookie.enabled && cookie.key)
    .map((cookie: KeyValueItem) => {
      const value = environment
        ? substituteVariables(cookie.value, environment.variables, environment.secrets)
        : cookie.value;
      return `${cookie.key}=${value}`;
    });
  if (cookiePairs.length > 0) {
    const cookieKey = Object.keys(headers).find(key => key.toLowerCase() === 'cookie');
    headers[cookieKey || 'Cookie'] = [cookieKey ? headers[cookieKey] : '', cookiePairs.join('; ')]
      .filter(Boolean)
      .join('; ');
  }

  let body: any = null;
  const method = config.method;
  if (method !== 'GET' && method !== 'HEAD') {
    const bc = config.body;
    if (bc.type === 'json' && bc.json) {
      body = environment ? substituteVariables(bc.json, environment.variables, environment.secrets) : bc.json;
      if (!hasHeader(headers, 'Content-Type')) headers['Content-Type'] = 'application/json';
    } else if (bc.type === 'x-www-form-urlencoded' && bc.urlEncoded) {
      const fb = new URLSearchParams();
      bc.urlEncoded.filter((f: KeyValueItem) => f.enabled && f.key).forEach((f: KeyValueItem) => {
        const v = environment ? substituteVariables(f.value, environment.variables, environment.secrets) : f.value;
        fb.append(f.key, v);
      });
      body = fb.toString();
      if (!hasHeader(headers, 'Content-Type')) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (bc.type === 'form-data' && bc.formData) {
      const formData = new FormData();
      bc.formData.filter((field: KeyValueItem) => field.enabled && field.key).forEach((field: KeyValueItem) => {
        const value = environment ? substituteVariables(field.value, environment.variables, environment.secrets) : field.value;
        formData.append(field.key, value);
      });
      body = formData;
      // Let fetch create the required multipart boundary.
      removeHeader(headers, 'Content-Type');
    } else if (bc.type === 'raw' && bc.raw) {
      body = environment ? substituteVariables(bc.raw, environment.variables, environment.secrets) : bc.raw;
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const resp = await fetch(url, {
      method,
      headers,
      body: body as any,
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const text = await resp.text();
    const respHeaders: Record<string, string> = {};
    resp.headers.forEach((v, k) => { respHeaders[k] = v; });
    const timeMs = Date.now() - startTime;
    return {
      id,
      status: resp.status,
      statusText: resp.statusText,
      timeMs,
      sizeBytes: Buffer.byteLength(text),
      body: text,
      headers: respHeaders,
      isSuccess: resp.status >= 200 && resp.status < 300,
      isRedirect: resp.status >= 300 && resp.status < 400,
      isClientError: resp.status >= 400 && resp.status < 500,
      isServerError: resp.status >= 500,
      isTimeout: false,
      isNetworkError: false,
    };
  } catch (err: any) {
    const timeMs = Date.now() - startTime;
    if (err.name === 'AbortError') {
      return {
        id, status: 0, statusText: 'Request Timeout', timeMs, sizeBytes: 0, body: '', headers: {},
        isSuccess: false, isRedirect: false, isClientError: false, isServerError: false,
        isTimeout: true, isNetworkError: false,
        error: `Request timed out after ${TIMEOUT_MS / 1000}s`,
      };
    }
    return {
      id,
      status: 0,
      statusText: 'Network Error',
      timeMs,
      sizeBytes: 0,
      body: '',
      headers: {},
      isSuccess: false,
      isRedirect: false,
      isClientError: false,
      isServerError: false,
      isTimeout: false,
      isNetworkError: true,
      error: err.message || 'Network request failed',
    };
  }
}
