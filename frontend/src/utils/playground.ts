// Playground utilities
import {
  RequestConfig,
  PlaygroundResponse,
  Environment,
  AuthConfig,
  BodyConfig,
  HttpMethod,
  CodeLanguage,
} from '../types/playground';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
};

export const emptyRequestConfig = (): RequestConfig => ({
  id: generateId(),
  name: 'Untitled Request',
  method: 'GET',
  url: '',
  params: [{ id: generateId(), key: '', value: '', enabled: true }],
  headers: [{ id: generateId(), key: '', value: '', enabled: true }],
  cookies: [{ id: generateId(), key: '', value: '', enabled: true }],
  auth: { type: 'no-auth' },
  body: {
    type: 'none',
    json: '',
    formData: [{ id: generateId(), key: '', value: '', enabled: true }],
    urlEncoded: [{ id: generateId(), key: '', value: '', enabled: true }],
    raw: '',
  },
});

export const substituteVariables = (
  str: string,
  variables: Record<string, string>,
  secrets: Record<string, string>,
): string => {
  const allVars = { ...variables, ...secrets };
  return str.replace(/\{\{([^}]+)\}\}/g, (match, name) => {
    return allVars[name.trim()] ?? match;
  });
};

export const extractVariables = (str: string): string[] => {
  const matches = str.match(/\{\{([^}]+)\}\}/g) || [];
  return matches.map((m) => m.replace(/[{}]/g, '').trim());
};

export const buildAuthHeaders = (auth: AuthConfig): Record<string, string> => {
  const headers: Record<string, string> = {};
  switch (auth.type) {
    case 'bearer':
      if (auth.bearerToken) {
        headers['Authorization'] = `Bearer ${auth.bearerToken}`;
      }
      break;
    case 'basic':
      if (auth.basicUsername !== undefined || auth.basicPassword !== undefined) {
        const token = btoa(`${auth.basicUsername || ''}:${auth.basicPassword || ''}`);
        headers['Authorization'] = `Basic ${token}`;
      }
      break;
    case 'api-key':
      if (auth.apiKeyKey && auth.apiKeyValue && auth.apiKeyIn === 'header') {
        headers[auth.apiKeyKey] = auth.apiKeyValue;
      }
      break;
    default:
      break;
  }
  return headers;
};

const hasHeader = (headers: Record<string, string>, name: string): boolean =>
  Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase());

const removeHeader = (headers: Record<string, string>, name: string): void => {
  Object.keys(headers).forEach((key) => {
    if (key.toLowerCase() === name.toLowerCase()) delete headers[key];
  });
};

export const buildUrl = (config: RequestConfig, environment: Environment | null): string => {
  let url = config.url;
  if (!url) return '';

  if (environment) {
    url = substituteVariables(url, environment.variables, environment.secrets);
  }

  const enabledParams = config.params.filter((p) => p.enabled && p.key);
  if (enabledParams.length > 0) {
    const paramPairs: string[] = [];
    enabledParams.forEach((p) => {
      let val = p.value;
      if (environment) {
        val = substituteVariables(val, environment.variables, environment.secrets);
      }
      paramPairs.push(`${encodeURIComponent(p.key)}=${encodeURIComponent(val)}`);
    });
    const separator = url.includes('?') ? '&' : '?';
    url = url + separator + paramPairs.join('&');
  }

  return url;
};

const TIMEOUT_MS = 30000;

export const executeRequest = async (
  config: RequestConfig,
  environment: Environment | null,
): Promise<PlaygroundResponse> => {
  const startTime = performance.now();
  const id = generateId();

  // Primary execution via backend proxy to bypass CORS
  try {
    const res = await fetch('/api/playground/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, environment }),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (_backendErr) {
    // Fall back to client-side fetch if backend service is unreachable
  }

  let url = config.url;
  if (!url) {
    return {
      id,
      status: 0,
      statusText: 'Bad Request',
      timeMs: 0,
      sizeBytes: 0,
      body: '',
      headers: {},
      isSuccess: false,
      isRedirect: false,
      isClientError: true,
      isServerError: false,
      isTimeout: false,
      isNetworkError: false,
      error: 'URL is required',
    };
  }

  if (environment) {
    url = substituteVariables(url, environment.variables, environment.secrets);
  }

  // Process query params
  const enabledParams = config.params.filter((p) => p.enabled && p.key);
  const paramPairs: string[] = [];
  enabledParams.forEach((p) => {
    let val = p.value;
    if (environment) val = substituteVariables(val, environment.variables, environment.secrets);
    paramPairs.push(`${encodeURIComponent(p.key)}=${encodeURIComponent(val)}`);
  });
  const paramStr = paramPairs.length > 0 ? `?${paramPairs.join('&')}` : '';
  url = url + paramStr;

  // Headers
  const headers: Record<string, string> = {};
  config.headers
    .filter((h) => h.enabled && h.key)
    .forEach((h) => {
      let val = h.value;
      if (environment) val = substituteVariables(val, environment.variables, environment.secrets);
      headers[h.key] = val;
    });

  // Auth
  if (environment) {
    const authCopy = { ...config.auth };
    if (authCopy.apiKeyValue)
      authCopy.apiKeyValue = substituteVariables(
        authCopy.apiKeyValue,
        environment.variables,
        environment.secrets,
      );
    if (authCopy.bearerToken)
      authCopy.bearerToken = substituteVariables(
        authCopy.bearerToken,
        environment.variables,
        environment.secrets,
      );
    if (authCopy.basicUsername)
      authCopy.basicUsername = substituteVariables(
        authCopy.basicUsername,
        environment.variables,
        environment.secrets,
      );
    if (authCopy.basicPassword)
      authCopy.basicPassword = substituteVariables(
        authCopy.basicPassword,
        environment.variables,
        environment.secrets,
      );

    const authHeaders = buildAuthHeaders(authCopy);
    Object.entries(authHeaders).forEach(([k, v]) => {
      if (!hasHeader(headers, k)) headers[k] = v;
    });

    if (authCopy.type === 'api-key' && authCopy.apiKeyIn === 'query' && authCopy.apiKeyKey) {
      url +=
        (url.includes('?') ? '&' : '?') +
        `${encodeURIComponent(authCopy.apiKeyKey)}=${encodeURIComponent(
          authCopy.apiKeyValue || '',
        )}`;
    }
  } else {
    const authHeaders = buildAuthHeaders(config.auth);
    Object.entries(authHeaders).forEach(([k, v]) => {
      if (!hasHeader(headers, k)) headers[k] = v;
    });
    if (
      config.auth.type === 'api-key' &&
      config.auth.apiKeyIn === 'query' &&
      config.auth.apiKeyKey
    ) {
      url +=
        (url.includes('?') ? '&' : '?') +
        `${encodeURIComponent(config.auth.apiKeyKey)}=${encodeURIComponent(
          config.auth.apiKeyValue || '',
        )}`;
    }
  }

  const cookiePairs = config.cookies
    .filter((cookie) => cookie.enabled && cookie.key)
    .map((cookie) => {
      const value = environment
        ? substituteVariables(cookie.value, environment.variables, environment.secrets)
        : cookie.value;
      return `${cookie.key}=${value}`;
    });
  if (cookiePairs.length > 0) {
    const cookieKey = Object.keys(headers).find((key) => key.toLowerCase() === 'cookie');
    headers[cookieKey || 'Cookie'] = [cookieKey ? headers[cookieKey] : '', cookiePairs.join('; ')]
      .filter(Boolean)
      .join('; ');
  }

  // Build body
  let body: BodyInit | null = null;
  const method = config.method;

  if (method !== 'GET' && method !== 'HEAD') {
    const bodyConfig = config.body;
    if (bodyConfig.type === 'json' && bodyConfig.json) {
      let jsonVal = bodyConfig.json;
      if (environment)
        jsonVal = substituteVariables(jsonVal, environment.variables, environment.secrets);
      body = jsonVal;
      if (!hasHeader(headers, 'Content-Type')) headers['Content-Type'] = 'application/json';
    } else if (bodyConfig.type === 'x-www-form-urlencoded' && bodyConfig.urlEncoded) {
      const formBody = new URLSearchParams();
      bodyConfig.urlEncoded
        .filter((f) => f.enabled && f.key)
        .forEach((f) => {
          let val = f.value;
          if (environment)
            val = substituteVariables(val, environment.variables, environment.secrets);
          formBody.append(f.key, val);
        });
      body = formBody.toString();
      if (!hasHeader(headers, 'Content-Type')) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (bodyConfig.type === 'form-data' && bodyConfig.formData) {
      const formData = new FormData();
      bodyConfig.formData
        .filter((f) => f.enabled && f.key)
        .forEach((f) => {
          let val = f.value;
          if (environment)
            val = substituteVariables(val, environment.variables, environment.secrets);
          formData.append(f.key, val);
        });
      body = formData;
      // The browser must set the multipart boundary; a manual Content-Type breaks uploads.
      removeHeader(headers, 'Content-Type');
    } else if (bodyConfig.type === 'raw' && bodyConfig.raw) {
      let rawVal = bodyConfig.raw;
      if (environment)
        rawVal = substituteVariables(rawVal, environment.variables, environment.secrets);
      body = rawVal;
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method,
      headers,
      body: body as any,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const timeMs = Math.round(performance.now() - startTime);
    const sizeBytes = new Blob([responseText]).size;

    return {
      id,
      status: response.status,
      statusText: response.statusText,
      timeMs,
      sizeBytes,
      body: responseText,
      headers: responseHeaders,
      isSuccess: response.status >= 200 && response.status < 300,
      isRedirect: response.status >= 300 && response.status < 400,
      isClientError: response.status >= 400 && response.status < 500,
      isServerError: response.status >= 500,
      isTimeout: false,
      isNetworkError: false,
    };
  } catch (err: any) {
    const timeMs = Math.round(performance.now() - startTime);

    if (err.name === 'AbortError') {
      return {
        id,
        status: 0,
        statusText: 'Request Timeout',
        timeMs,
        sizeBytes: 0,
        body: '',
        headers: {},
        isSuccess: false,
        isRedirect: false,
        isClientError: false,
        isServerError: false,
        isTimeout: true,
        isNetworkError: false,
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
      error: err?.message || 'Network request failed',
    };
  }
};

export const formatJson = (json: string): string => {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
};

export const isValidJson = (json: string): boolean => {
  try {
    JSON.parse(json);
    return true;
  } catch {
    return false;
  }
};

const KEYWORDS = new Set(['true', 'false', 'null']);

export const highlightJson = (json: string): string => {
  return json
    .replace(/("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?/g, (match, str, colon) => {
      if (colon) {
        return match.replace(str, `<span style="color:#7dd3fc">${str}</span>`);
      }
      return match.replace(str, `<span style="color:#a5b4fc">${str}</span>`);
    })
    .replace(/('(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\'])*')/g, (match) => {
      return match.replace(match, `<span style="color:#a5b4fc">${match}</span>`);
    })
    .replace(/\b(-?\d+\.?\d*)\b/g, `<span style="color:#fbbf24">$1</span>`)
    .replace(/\b(true|false|null)\b/g, `<span style="color:#f472b6">$1</span>`);
};

export type JsonNodeType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface JsonNode {
  key: string;
  type: JsonNodeType;
  value: any;
  children?: JsonNode[];
}

export const buildJsonTree = (obj: any, key: string = 'root'): JsonNode => {
  if (obj === null) {
    return { key, type: 'null', value: null };
  }
  if (Array.isArray(obj)) {
    return {
      key,
      type: 'array',
      value: obj,
      children: obj.map((item, idx) => buildJsonTree(item, `[${idx}]`)),
    };
  }
  if (typeof obj === 'object') {
    return {
      key,
      type: 'object',
      value: obj,
      children: Object.entries(obj).map(([k, v]) => buildJsonTree(v, k)),
    };
  }
  if (typeof obj === 'number') return { key, type: 'number', value: obj };
  if (typeof obj === 'boolean') return { key, type: 'boolean', value: obj };
  return { key, type: 'string', value: String(obj) };
};

export const parseCollectionResponse = (
  content: string,
): { status: number; statusText: string; timeMs: number; body: string } | null => {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || !parsed.status || !parsed.body) return null;
    return {
      status: parsed.status,
      statusText: parsed.statusText || '',
      timeMs: parsed.timeMs || 0,
      body: typeof parsed.body === 'string' ? parsed.body : JSON.stringify(parsed.body, null, 2),
    };
  } catch {
    return null;
  }
};

export interface CodeGenInput {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
  bodyType?: string;
  authType?: string;
}

const bodyAsParsed = (body?: string): any => {
  if (!body) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
};

export const generateCode = (lang: CodeLanguage, input: CodeGenInput): string => {
  const { method, url, headers, body } = input;
  const bodyObj = bodyAsParsed(body);
  const bodyStr = body ? JSON.stringify(bodyObj || body, null, 2) : '';
  const headerEntries = Object.entries(headers);
  const headerLines = headerEntries.map(([k, v]) => `  "${k}": "${v}"`).join(',\n');
  const hasHeaders = headerEntries.length > 0;

  switch (lang) {
    case 'curl': {
      const lines = [`curl --request ${method} \\`, `  --url '${url}' \\`];
      headerEntries.forEach(([k, v]) => {
        lines.push(`  --header '${k}: ${v}' \\`);
      });
      if (bodyStr) {
        lines.push(`  --data '${bodyStr.replace(/'/g, "\\'")}'`);
      } else {
        lines[lines.length - 1] = lines[lines.length - 1].replace(/ \\$/, '');
      }
      return lines.join('\n');
    }

    case 'javascript-fetch': {
      const lines = [`fetch('${url}', {`, `  method: '${method}',`];
      if (hasHeaders) {
        lines.push(`  headers: {`);
        lines.push(headerLines);
        lines.push(`  },`);
      }
      if (bodyStr) {
        lines.push(`  body: JSON.stringify(${bodyStr}),`);
      }
      lines.push(`})`);
      lines.push(`  .then(response => response.json())`);
      lines.push(`  .then(data => console.log(data))`);
      lines.push(`  .catch(error => console.error(error));`);
      return lines.join('\n');
    }

    case 'javascript-axios': {
      return [
        `const response = await axios.${method.toLowerCase()}('${url}',`,
        bodyStr ? `  ${bodyStr}` : undefined,
        hasHeaders ? `  ${JSON.stringify(headers, null, 2)}` : undefined,
        `);`,
        `console.log(response.data);`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'python-requests': {
      const lines = [
        `import requests`,
        ``,
        `headers = {`,
        ...headerEntries.map(([k, v]) => `    "${k}": "${v}",`),
        `}`,
      ];
      if (bodyStr) {
        lines.push(`payload = ${bodyStr}`);
        lines.push(``);
        lines.push(
          `response = requests.${method.toLowerCase()}("${url}", headers=headers, json=payload)`,
        );
      } else {
        lines.push(``);
        lines.push(`response = requests.${method.toLowerCase()}("${url}", headers=headers)`);
      }
      lines.push(`print(response.status_code)`);
      lines.push(`print(response.json())`);
      return lines.join('\n');
    }

    case 'node': {
      const lines = [
        `const http = require('http');`,
        ``,
        `const options = {`,
        `  method: '${method}',`,
        `  headers: ${JSON.stringify(headers, null, 2)}`,
        `  hosts: '${url.replace(/^https?:\/\//, '').split('/')[0]}',`,
        `  path: '${url.replace(/^https?:\/\/[^/]+/, '')}'`,
        `};`,
        ``,
        `const req = http.request(options, (res) => {`,
        `  let data = '';`,
        `  res.on('data', (chunk) => { data += chunk; });`,
        `  res.on('end', () => {`,
        `    console.log(JSON.parse(data));`,
        `  });`,
        `});`,
      ];
      if (bodyStr) {
        lines.push(``);
        lines.push(`req.write(${JSON.stringify(bodyStr)});`);
      }
      lines.push(`req.end();`);
      return lines.join('\n');
    }

    case 'php': {
      const lines = [
        `<?php`,
        ``,
        `$curl = curl_init();`,
        ``,
        `curl_setopt_array($curl, [`,
        `  CURLOPT_URL => '${url}',`,
        `  CURLOPT_RETURNTRANSFER => true,`,
        `  CURLOPT_CUSTOMREQUEST => '${method}',`,
      ];
      if (hasHeaders) {
        lines.push(
          `  CURLOPT_HTTPHEADER => ${JSON.stringify(
            headerEntries.map(([k, v]) => `${k}: ${v}`),
            null,
            2,
          )},`,
        );
      }
      if (bodyStr) {
        lines.push(`  CURLOPT_POSTFIELDS => ${JSON.stringify(bodyStr)},`);
      }
      lines.push(`]);`);
      lines.push(``);
      lines.push(`$response = curl_exec($curl);`);
      lines.push(`$error = curl_error($curl);`);
      lines.push(`curl_close($curl);`);
      lines.push(``);
      lines.push(`if ($error) {`);
      lines.push(`  echo "cURL Error: $error";`);
      lines.push(`} else {`);
      lines.push(`  print_r(json_decode($response, true));`);
      lines.push(`}`);
      return lines.join('\n');
    }

    case 'java': {
      const lines = [
        `import java.net.http.HttpClient;`,
        `import java.net.http.HttpRequest;`,
        `import java.net.http.HttpResponse;`,
        `import java.net.URI;`,
        `import java.time.Duration;`,
        ``,
        `public class ApiClient {`,
        `  public static void main(String[] args) throws Exception {`,
        `    HttpClient client = HttpClient.newHttpClient();`,
        ``,
        `    HttpRequest.Builder builder = HttpRequest.newBuilder()`,
        `        .uri(URI.create("${url}"))`,
        `        .timeout(Duration.ofSeconds(30))`,
        `        .method("${method}", HttpRequest.BodyPublishers.ofString(${
          bodyStr ? `"""${bodyStr.replace(/"/g, '\\"')}"""` : '""'
        }));`,
      ];
      if (hasHeaders) {
        lines.push(``);
        lines.push(`    // Headers`);
        headerEntries.forEach(([k, v]) => {
          lines.push(`    builder.header("${k}", "${v}");`);
        });
      }
      lines.push(``);
      lines.push(`    HttpRequest request = builder.build();`);
      lines.push(
        `    HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());`,
      );
      lines.push(``);
      lines.push(`    System.out.println(response.statusCode());`);
      lines.push(`    System.out.println(response.body());`);
      lines.push(`  }`);
      lines.push(`}`);
      return lines.join('\n');
    }

    case 'csharp': {
      const lines = [
        `using System.Net.Http;`,
        `using System.Net.Http.Headers;`,
        `using System.Threading.Tasks;`,
        `using Newtonsoft.Json;`,
        ``,
        `public class ApiClient`,
        `{`,
        `  public static async Task Main()`,
        `  {`,
        `    using var client = new HttpClient();`,
      ];
      if (hasHeaders) {
        lines.push('');
        headerEntries.forEach(([k, v]) => {
          lines.push(`    client.DefaultRequestHeaders.Add("${k}", "${v}");`);
        });
      }
      lines.push(``);
      lines.push(`    var url = "${url}";`);
      if (bodyStr) {
        lines.push(`    var payload = """${bodyStr.replace(/"/g, '\\"').replace(/`/g, '\\`')}""";`);
        lines.push(
          `    var content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");`,
        );
        lines.push(``);
        lines.push(
          `    var response = await client.${
            method.charAt(0) + method.slice(1).toLowerCase()
          }Async(url, content);`,
        );
      } else {
        lines.push(``);
        lines.push(`    var response = await client.GetAsync(url);`);
      }
      lines.push(`    var body = await response.Content.ReadAsStringAsync();`);
      lines.push(``);
      lines.push(`    Console.WriteLine($"Status: {(int)response.StatusCode}");`);
      lines.push(`    Console.WriteLine(body);`);
      lines.push(`  }`);
      lines.push(`}`);
      return lines.join('\n');
    }

    case 'go': {
      const lines = [
        `package main`,
        ``,
        `import (`,
        `  "bytes"`,
        `  "fmt"`,
        `  "io"`,
        `  "net/http"`,
        `  "time"`,
        `)`,
        ``,
        `func main() {`,
        `  client := &http.Client{Timeout: 30 * time.Second}`,
        ``,
        `  var body io.Reader`,
      ];
      if (bodyStr) {
        lines.push(`  jsonBody := []byte(\`${bodyStr.replace(/`/g, '\\`')}\`)`);
        lines.push(`  body = bytes.NewBuffer(jsonBody)`);
      } else {
        lines.push(`  body = nil`);
      }
      lines.push(``);
      lines.push(`  req, err := http.NewRequest("${method}", "${url}", body)`);
      lines.push(`  if err != nil {`);
      lines.push(`    panic(err)`);
      lines.push(`  }`);
      lines.push('');
      if (hasHeaders) {
        headerEntries.forEach(([k, v]) => {
          lines.push(`  req.Header.Set("${k}", "${v}")`);
        });
        lines.push('');
      }
      lines.push(`  resp, err := client.Do(req)`);
      lines.push(`  if err != nil {`);
      lines.push(`    panic(err)`);
      lines.push(`  }`);
      lines.push(`  defer resp.Body.Close()`);
      lines.push(``);
      lines.push(`  fmt.Println("Status:", resp.StatusCode)`);
      lines.push(`  responseBody, _ := io.ReadAll(resp.Body)`);
      lines.push(`  fmt.Println(string(responseBody))`);
      lines.push(`}`);
      return lines.join('\n');
    }

    case 'ruby': {
      const lines = [
        `require 'net/http'`,
        `require 'json'`,
        `require 'uri'`,
        ``,
        `uri = URI("${url}")`,
        `http = Net::HTTP.new(uri.host, uri.port)`,
        `http.use_ssl = uri.scheme == 'https'`,
        ``,
        `request = Net::HTTP::${
          method === 'GET' ? 'Get' : method.charAt(0) + method.slice(1).toLowerCase()
        }.new(uri)`,
      ];
      if (hasHeaders) {
        lines.push(``);
        headerEntries.forEach(([k, v]) => {
          lines.push(`request["${k}"] = "${v}"`);
        });
      }
      if (bodyStr) {
        lines.push(``);
        lines.push(`request.body = ${JSON.stringify(bodyStr)}`);
      }
      lines.push(``);
      lines.push(`response = http.request(request)`);
      lines.push(`puts "Status: #{response.code}"`);
      lines.push(`puts response.body`);
      return lines.join('\n');
    }

    default:
      return '';
  }
};

export const statusColorClass = (status: number): string => {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client-error';
  if (status >= 500) return 'server-error';
  return 'error';
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
};

export const getStatusText = (status: number): string => {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    408: 'Request Timeout',
    409: 'Conflict',
    410: 'Gone',
    415: 'Unsupported Media Type',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return statusTexts[status] || status.toString();
};

// =========================================================
// SCHEMA INFERENCE & VALIDATION
// =========================================================

import {
  SchemaField,
  SchemaValidationResult,
  RequestValidationIssue,
  ErrorDiagnosis,
} from '../types/playground';

const inferType = (value: any): SchemaField['type'] => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') return 'string';
  return 'any';
};

export const inferSchemaFromJson = (json: string): SchemaField[] => {
  try {
    const parsed = JSON.parse(json);
    return inferSchemaFromValue(parsed);
  } catch {
    return [];
  }
};

const inferSchemaFromValue = (value: any, name: string = 'root'): SchemaField[] => {
  const type = inferType(value);
  if (type === 'object' && value !== null) {
    return Object.entries(value).map(([key, val]) => {
      const childType = inferType(val);
      const field: SchemaField = {
        name: key,
        type: childType,
        required: true,
      };
      if (childType === 'object' && val !== null) {
        field.children = inferSchemaFromValue(val, key);
      } else if (childType === 'array' && Array.isArray(val)) {
        const itemType = val.length > 0 ? inferType(val[0]) : 'any';
        field.arrayItemType = itemType;
        if (itemType === 'object' && val.length > 0) {
          field.children = inferSchemaFromValue(val[0], key);
        }
      }
      return field;
    });
  }
  return [];
};

export const validateRequestAgainstSchema = (
  config: RequestConfig,
  schema: SchemaField[],
): SchemaValidationResult => {
  const issues: RequestValidationIssue[] = [];
  if (!schema || schema.length === 0) return { isValid: true, issues };

  // Parse current JSON body
  let bodyObj: any = null;
  if (config.body.type === 'json' && config.body.json) {
    try {
      bodyObj = JSON.parse(config.body.json);
    } catch {
      issues.push({
        fieldPath: 'body',
        message: 'Request body is not valid JSON',
        severity: 'error',
      });
      return { isValid: false, issues };
    }
  }

  // Check required fields
  const checkRequired = (obj: any, fields: SchemaField[], path: string) => {
    if (!obj || typeof obj !== 'object') return;
    for (const field of fields) {
      const fieldPath = path ? `${path}.${field.name}` : field.name;
      const hasField = field.name in obj;
      if (field.required && !hasField) {
        issues.push({
          fieldPath,
          message: `Required field "${field.name}" is missing`,
          severity: 'error',
        });
      } else if (hasField && obj[field.name] === undefined) {
        issues.push({
          fieldPath,
          message: `Field "${field.name}" is undefined`,
          severity: 'warning',
        });
      }
      // Recurse into nested objects
      if (hasField && field.children && obj[field.name] && typeof obj[field.name] === 'object') {
        checkRequired(obj[field.name], field.children, fieldPath);
      }
    }
  };

  if (bodyObj) {
    checkRequired(bodyObj, schema, 'body');
  }

  return { isValid: issues.filter((i) => i.severity === 'error').length === 0, issues };
};

export const getUnknownFields = (
  config: RequestConfig,
  schema: SchemaField[],
): RequestValidationIssue[] => {
  const issues: RequestValidationIssue[] = [];
  if (!schema || schema.length === 0) return issues;

  let bodyObj: any = null;
  if (config.body.type === 'json' && config.body.json) {
    try {
      bodyObj = JSON.parse(config.body.json);
    } catch {
      return issues;
    }
  }
  if (!bodyObj || typeof bodyObj !== 'object') return issues;

  const checkUnknown = (obj: any, fields: SchemaField[], path: string) => {
    if (!obj || typeof obj !== 'object') return;
    const knownKeys = new Set(fields.map((f) => f.name));
    for (const key of Object.keys(obj)) {
      if (!knownKeys.has(key)) {
        issues.push({
          fieldPath: path ? `${path}.${key}` : key,
          message: `Unknown field "${key}" - not in schema`,
          severity: 'warning',
        });
      } else {
        const field = fields.find((f) => f.name === key);
        if (field?.children && obj[key] && typeof obj[key] === 'object') {
          checkUnknown(obj[key], field.children, path ? `${path}.${key}` : key);
        }
      }
    }
  };

  checkUnknown(bodyObj, schema, 'body');
  return issues;
};

// =========================================================
// ERROR DIAGNOSIS
// =========================================================

export const diagnoseError = (
  response: PlaygroundResponse | null,
  config: RequestConfig,
): ErrorDiagnosis | null => {
  if (!response) return null;

  if (response.isTimeout) {
    return {
      title: 'Request Timed Out',
      message: `The request exceeded the 30 second timeout limit.`,
      suggestions: [
        {
          cause: 'Server is slow or unresponsive',
          fix: 'Check if the server is running and reachable.',
        },
        { cause: 'Network latency', fix: 'Try again later or check your network connection.' },
        { cause: 'Large payload', fix: 'Reduce the request body size or increase the timeout.' },
      ],
    };
  }

  if (response.isNetworkError) {
    return {
      title: 'Network Error',
      message: response.error || 'Could not connect to the server.',
      suggestions: [
        { cause: 'CORS policy', fix: 'Enable CORS on the server or use a proxy.' },
        {
          cause: 'Server not running',
          fix: 'Verify the server is running and the URL is correct.',
        },
        { cause: 'Invalid URL', fix: `Check the URL: ${config.url || '(empty)'}` },
      ],
    };
  }

  if (response.status === 401) {
    return {
      title: 'Unauthorized (401)',
      message: 'Authentication is required or the provided credentials are invalid.',
      suggestions: [
        {
          cause: 'Missing or invalid API key',
          fix: 'Check the Authorization header or API key in the Auth tab.',
        },
        { cause: 'Expired token', fix: 'Refresh your token and try again.' },
      ],
    };
  }

  if (response.status === 403) {
    return {
      title: 'Forbidden (403)',
      message: 'The server understood the request but refuses to authorize it.',
      suggestions: [
        {
          cause: 'Insufficient permissions',
          fix: 'Check if your API key has the required scopes.',
        },
        { cause: 'IP allowlist', fix: 'Add your IP address to the API allowlist.' },
      ],
    };
  }

  if (response.status === 404) {
    return {
      title: 'Not Found (404)',
      message: 'The requested resource was not found on the server.',
      suggestions: [
        { cause: 'Incorrect URL path', fix: `Verify the URL: ${config.url || '(empty)'}` },
        { cause: 'Wrong API version', fix: 'Check if the API version in the URL is correct.' },
      ],
    };
  }

  if (response.status === 422) {
    return {
      title: 'Unprocessable Entity (422)',
      message: 'The request was well-formed but contains semantic errors.',
      suggestions: [
        { cause: 'Validation error', fix: 'Check the request body for missing or invalid fields.' },
        { cause: 'Schema mismatch', fix: 'Verify the request matches the API schema.' },
      ],
    };
  }

  if (response.status === 429) {
    return {
      title: 'Too Many Requests (429)',
      message: 'Rate limit exceeded. Please slow down your requests.',
      suggestions: [
        { cause: 'Rate limit reached', fix: 'Wait a moment and try again.' },
        { cause: 'Concurrent requests', fix: 'Add a delay between requests.' },
      ],
    };
  }

  if (response.status >= 500) {
    return {
      title: `Server Error (${response.status})`,
      message: 'The server encountered an error while processing the request.',
      suggestions: [
        { cause: 'Server-side issue', fix: 'Check server logs for more details.' },
        { cause: 'Temporary outage', fix: 'Try again in a few minutes.' },
      ],
    };
  }

  if (response.status >= 400) {
    return {
      title: `Client Error (${response.status})`,
      message: 'The request could not be processed due to a client error.',
      suggestions: [
        { cause: 'Invalid request', fix: 'Review the request parameters and body.' },
        { cause: 'Missing required fields', fix: 'Ensure all required fields are provided.' },
      ],
    };
  }

  return null;
};

// =========================================================
// SECURE CODE GENERATION (env-var aware)
// =========================================================

const SECRET_PATTERNS =
  /(key|token|secret|password|authorization|auth|apikey|api_key|apikey|bearer)/i;

export const isSecretValue = (key: string, value: string): boolean => {
  if (!value) return false;
  if (value.startsWith('{{') && value.endsWith('}}')) return true;
  return SECRET_PATTERNS.test(key) && value.length > 0;
};

export const toEnvVarName = (key: string): string => {
  return (
    key
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toUpperCase() || 'SECRET'
  );
};

export const generateSecureCode = (lang: CodeLanguage, input: CodeGenInput): string => {
  const { method, url, headers, body } = input;
  const bodyObj = bodyAsParsed(body);
  const bodyStr = body ? JSON.stringify(bodyObj || body, null, 2) : '';

  // Separate secrets from regular headers
  const secretHeaders: Record<string, string> = {};
  const regularHeaders: Record<string, string> = {};
  Object.entries(headers).forEach(([k, v]) => {
    if (isSecretValue(k, v)) {
      secretHeaders[k] = v;
    } else {
      regularHeaders[k] = v;
    }
  });

  const headerEntries = Object.entries(regularHeaders);
  const secretEntries = Object.entries(secretHeaders);

  const envVars = secretEntries.map(([k]) => `process.env.${toEnvVarName(k)}`);

  switch (lang) {
    case 'curl': {
      const lines = [`curl --request ${method} \\`, `  --url '${url}' \\`];
      headerEntries.forEach(([k, v]) => {
        lines.push(`  --header '${k}: ${v}' \\`);
      });
      secretEntries.forEach(([k]) => {
        lines.push(`  --header '${k}: ${'${' + toEnvVarName(k) + '}'}' \\`);
      });
      if (bodyStr) {
        lines.push(`  --data '${bodyStr.replace(/'/g, "\\'")}'`);
      } else {
        lines[lines.length - 1] = lines[lines.length - 1].replace(/ \\$/, '');
      }
      return lines.join('\n');
    }

    case 'javascript-fetch': {
      const lines = [`fetch('${url}', {`, `  method: '${method}',`];
      if (headerEntries.length > 0 || secretEntries.length > 0) {
        lines.push(`  headers: {`);
        headerEntries.forEach(([k, v]) => lines.push(`    '${k}': '${v}',`));
        secretEntries.forEach(([k]) => lines.push(`    '${k}': process.env.${toEnvVarName(k)},`));
        lines.push(`  },`);
      }
      if (bodyStr) {
        lines.push(`  body: JSON.stringify(${bodyStr}),`);
      }
      lines.push(`})`);
      lines.push(`  .then(response => response.json())`);
      lines.push(`  .then(data => console.log(data))`);
      lines.push(`  .catch(error => console.error(error));`);
      return lines.join('\n');
    }

    case 'javascript-axios': {
      const lines = [
        `const response = await axios.${method.toLowerCase()}('${url}',`,
        bodyStr ? `  ${bodyStr},` : undefined,
        `  {`,
        `    headers: {`,
        ...headerEntries.map(([k, v]) => `      '${k}': '${v}',`),
        ...secretEntries.map(([k]) => `      '${k}': process.env.${toEnvVarName(k)},`),
        `    }`,
        `  }`,
        `);`,
        `console.log(response.data);`,
      ].filter(Boolean);
      return lines.join('\n');
    }

    case 'python-requests': {
      const lines = [
        `import requests`,
        `import os`,
        ``,
        `headers = {`,
        ...headerEntries.map(([k, v]) => `    "${k}": "${v}",`),
        ...secretEntries.map(([k]) => `    "${k}": os.environ.get("${toEnvVarName(k)}", ""),`),
        `}`,
      ];
      if (bodyStr) {
        lines.push(`payload = ${bodyStr}`);
        lines.push(``);
        lines.push(
          `response = requests.${method.toLowerCase()}("${url}", headers=headers, json=payload)`,
        );
      } else {
        lines.push(``);
        lines.push(`response = requests.${method.toLowerCase()}("${url}", headers=headers)`);
      }
      lines.push(`print(response.status_code)`);
      lines.push(`print(response.json())`);
      return lines.join('\n');
    }

    case 'node': {
      const lines = [
        `const http = require('http');`,
        ``,
        `const options = {`,
        `  method: '${method}',`,
        `  headers: {`,
        ...headerEntries.map(([k, v]) => `    '${k}': '${v}',`),
        ...secretEntries.map(([k]) => `    '${k}': process.env.${toEnvVarName(k)},`),
        `  },`,
        `  hosts: '${url.replace(/^https?:\/\//, '').split('/')[0]}',`,
        `  path: '${url.replace(/^https?:\/\/[^/]+/, '')}'`,
        `};`,
        ``,
        `const req = http.request(options, (res) => {`,
        `  let data = '';`,
        `  res.on('data', (chunk) => { data += chunk; });`,
        `  res.on('end', () => {`,
        `    console.log(JSON.parse(data));`,
        `  });`,
        `});`,
      ];
      if (bodyStr) {
        lines.push(``);
        lines.push(`req.write(${JSON.stringify(bodyStr)});`);
      }
      lines.push(`req.end();`);
      return lines.join('\n');
    }

    case 'php': {
      const lines = [
        `<?php`,
        ``,
        `$curl = curl_init();`,
        ``,
        `curl_setopt_array($curl, [`,
        `  CURLOPT_URL => '${url}',`,
        `  CURLOPT_RETURNTRANSFER => true,`,
        `  CURLOPT_CUSTOMREQUEST => '${method}',`,
      ];
      if (headerEntries.length > 0 || secretEntries.length > 0) {
        lines.push(`  CURLOPT_HTTPHEADER => [`);
        headerEntries.forEach(([k, v]) => lines.push(`    '${k}: ${v}',`));
        secretEntries.forEach(([k]) => lines.push(`    '${k}: ' . getenv('${toEnvVarName(k)}'),`));
        lines.push(`  ],`);
      }
      if (bodyStr) {
        lines.push(`  CURLOPT_POSTFIELDS => ${JSON.stringify(bodyStr)},`);
      }
      lines.push(`]);`);
      lines.push(``);
      lines.push(`$response = curl_exec($curl);`);
      lines.push(`$error = curl_error($curl);`);
      lines.push(`curl_close($curl);`);
      lines.push(``);
      lines.push(`if ($error) {`);
      lines.push(`  echo "cURL Error: $error";`);
      lines.push(`} else {`);
      lines.push(`  print_r(json_decode($response, true));`);
      lines.push(`}`);
      return lines.join('\n');
    }

    case 'java': {
      const lines = [
        `import java.net.http.HttpClient;`,
        `import java.net.http.HttpRequest;`,
        `import java.net.http.HttpResponse;`,
        `import java.net.URI;`,
        `import java.time.Duration;`,
        ``,
        `public class ApiClient {`,
        `  public static void main(String[] args) throws Exception {`,
        `    HttpClient client = HttpClient.newHttpClient();`,
        ``,
        `    HttpRequest.Builder builder = HttpRequest.newBuilder()`,
        `        .uri(URI.create("${url}"))`,
        `        .timeout(Duration.ofSeconds(30))`,
        `        .method("${method}", HttpRequest.BodyPublishers.ofString(${
          bodyStr ? `"""${bodyStr.replace(/"/g, '\\"')}"""` : '""'
        }));`,
      ];
      if (headerEntries.length > 0 || secretEntries.length > 0) {
        lines.push(``);
        lines.push(`    // Headers`);
        headerEntries.forEach(([k, v]) => {
          lines.push(`    builder.header("${k}", "${v}");`);
        });
        secretEntries.forEach(([k]) => {
          lines.push(`    builder.header("${k}", System.getenv("${toEnvVarName(k)}"));`);
        });
      }
      lines.push(``);
      lines.push(`    HttpRequest request = builder.build();`);
      lines.push(
        `    HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());`,
      );
      lines.push(``);
      lines.push(`    System.out.println(response.statusCode());`);
      lines.push(`    System.out.println(response.body());`);
      lines.push(`  }`);
      lines.push(`}`);
      return lines.join('\n');
    }

    case 'csharp': {
      const lines = [
        `using System.Net.Http;`,
        `using System.Net.Http.Headers;`,
        `using System.Threading.Tasks;`,
        `using Newtonsoft.Json;`,
        ``,
        `public class ApiClient`,
        `{`,
        `  public static async Task Main()`,
        `  {`,
        `    using var client = new HttpClient();`,
      ];
      if (headerEntries.length > 0 || secretEntries.length > 0) {
        lines.push('');
        headerEntries.forEach(([k, v]) => {
          lines.push(`    client.DefaultRequestHeaders.Add("${k}", "${v}");`);
        });
        secretEntries.forEach(([k]) => {
          lines.push(
            `    client.DefaultRequestHeaders.Add("${k}", Environment.GetEnvironmentVariable("${toEnvVarName(
              k,
            )}"));`,
          );
        });
      }
      lines.push(``);
      lines.push(`    var url = "${url}";`);
      if (bodyStr) {
        lines.push(`    var payload = """${bodyStr.replace(/"/g, '\\"').replace(/`/g, '\\`')}""";`);
        lines.push(
          `    var content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");`,
        );
        lines.push(``);
        lines.push(
          `    var response = await client.${
            method.charAt(0) + method.slice(1).toLowerCase()
          }Async(url, content);`,
        );
      } else {
        lines.push(``);
        lines.push(`    var response = await client.GetAsync(url);`);
      }
      lines.push(`    var body = await response.Content.ReadAsStringAsync();`);
      lines.push(``);
      lines.push(`    Console.WriteLine($"Status: {(int)response.StatusCode}");`);
      lines.push(`    Console.WriteLine(body);`);
      lines.push(`  }`);
      lines.push(`}`);
      return lines.join('\n');
    }

    case 'go': {
      const lines = [
        `package main`,
        ``,
        `import (`,
        `  "bytes"`,
        `  "fmt"`,
        `  "io"`,
        `  "net/http"`,
        `  "os"`,
        `  "time"`,
        `)`,
        ``,
        `func main() {`,
        `  client := &http.Client{Timeout: 30 * time.Second}`,
        ``,
        `  var body io.Reader`,
      ];
      if (bodyStr) {
        lines.push(`  jsonBody := []byte(\`${bodyStr.replace(/`/g, '\\`')}\`)`);
        lines.push(`  body = bytes.NewBuffer(jsonBody)`);
      } else {
        lines.push(`  body = nil`);
      }
      lines.push(``);
      lines.push(`  req, err := http.NewRequest("${method}", "${url}", body)`);
      lines.push(`  if err != nil {`);
      lines.push(`    panic(err)`);
      lines.push(`  }`);
      lines.push('');
      if (headerEntries.length > 0 || secretEntries.length > 0) {
        headerEntries.forEach(([k, v]) => {
          lines.push(`  req.Header.Set("${k}", "${v}")`);
        });
        secretEntries.forEach(([k]) => {
          lines.push(`  req.Header.Set("${k}", os.Getenv("${toEnvVarName(k)}"))`);
        });
        lines.push('');
      }
      lines.push(`  resp, err := client.Do(req)`);
      lines.push(`  if err != nil {`);
      lines.push(`    panic(err)`);
      lines.push(`  }`);
      lines.push(`  defer resp.Body.Close()`);
      lines.push(``);
      lines.push(`  fmt.Println("Status:", resp.StatusCode)`);
      lines.push(`  responseBody, _ := io.ReadAll(resp.Body)`);
      lines.push(`  fmt.Println(string(responseBody))`);
      lines.push(`}`);
      return lines.join('\n');
    }

    case 'ruby': {
      const lines = [
        `require 'net/http'`,
        `require 'json'`,
        `require 'uri'`,
        ``,
        `uri = URI("${url}")`,
        `http = Net::HTTP.new(uri.host, uri.port)`,
        `http.use_ssl = uri.scheme == 'https'`,
        ``,
        `request = Net::HTTP::${
          method === 'GET' ? 'Get' : method.charAt(0) + method.slice(1).toLowerCase()
        }.new(uri)`,
      ];
      if (headerEntries.length > 0 || secretEntries.length > 0) {
        lines.push(``);
        headerEntries.forEach(([k, v]) => {
          lines.push(`request["${k}"] = "${v}"`);
        });
        secretEntries.forEach(([k]) => {
          lines.push(`request["${k}"] = ENV["${toEnvVarName(k)}"]`);
        });
      }
      if (bodyStr) {
        lines.push(``);
        lines.push(`request.body = ${JSON.stringify(bodyStr)}`);
      }
      lines.push(``);
      lines.push(`response = http.request(request)`);
      lines.push(`puts "Status: #{response.code}"`);
      lines.push(`puts response.body`);
      return lines.join('\n');
    }

    default:
      return '';
  }
};
