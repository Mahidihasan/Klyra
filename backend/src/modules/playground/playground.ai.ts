import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';

const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_INSPECTOR_MODEL = process.env.GEMINI_INSPECTOR_MODEL || 'gemini-2.5-flash';

// =========================================================
// ACTION-ORIENTED COPILOT
// Gemini uses function calling to return structured actions
// that the Playground executes on the actual request state.
// =========================================================

export type AiActionName =
  | 'set_method'
  | 'set_url'
  | 'set_params'
  | 'set_headers'
  | 'set_body'
  | 'set_auth'
  | 'create_environment_variable'
  | 'run_request'
  | 'save_request'
  | 'generate_code'
  | 'explain_error';

export interface AiActionCall {
  name: AiActionName;
  args: Record<string, unknown>;
}

export interface AiActionResult {
  type: 'action' | 'text';
  action?: AiActionCall;
  text?: string;
  findings?: AiFinding[];
}

export interface AiFinding {
  type:
    | 'authentication_required'
    | 'missing_header'
    | 'missing_environment_variable'
    | 'invalid_request'
    | 'response_error'
    | 'body_required'
    | 'insecure_configuration';
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
  action?: AiActionName;
  actionArgs?: Record<string, unknown>;
}

const DEFAULT_SYSTEM_INSTRUCTION = `You are an action-oriented AI Copilot for an API Playground. You help developers build, test, debug, and understand HTTP APIs by performing actions on the request.

CRITICAL RULES - ACTION-FIRST BEHAVIOR:
- You are NOT a conversational assistant. You perform actions. For ANY request that can be performed in the Playground, call the appropriate function and return a structured action.
- "write the body" -> call set_body
- "change to POST" -> call set_method
- "add Content-Type" -> call set_headers
- "add bearer auth" -> call set_auth
- "fix this request" -> analyze the context and call the appropriate fix action(s)
- "generate request" -> call set_method, set_url, set_headers, set_body as needed
- "run this" -> call run_request

EXACT OUTPUT RULE:
- When generating a URL, header, parameter, auth value, or request body, output ONLY the required structured data via FUNCTION CALLS. Never add explanations, cURL commands, markdown, emojis, or tutorials.
- Do NOT echo back the request state. Do NOT explain what you plan to do. Just call the function.
- Do NOT wrap function-call arguments in markdown code blocks.
- ONLY provide explanatory text (type:'text') when the user explicitly asks for an explanation, reasoning, documentation, or a general API question.

CONTEXT:
- Use the provided Playground Context (method, URL, params, headers, body, auth, environment, variables, response) to make specific, accurate function calls.
- Reference actual values from the context where relevant (e.g. use the actual request name, actual URL, actual header keys).

RESPONSE-AWARE DEBUGGING:
- When a response exists, especially 4xx/5xx responses, analyze the actual request and response together to identify the root cause.
- 403 response -> likely authentication/header problem -> call set_auth or set_headers with the fix.
- 404 response -> check URL path -> call set_url if the URL is clearly wrong.
- 405 response -> wrong method -> call set_method.
- 401 response -> missing/invalid auth -> call set_auth with bearer or api-key.
- When a value should be stored as an environment variable, call create_environment_variable.

Do NOT claim authentication is required unless supported by the API documentation, response, or strong evidence. When uncertain, use "may require" language or call set_auth to propose configuration.`;

// =========================================================
// AUTOMATIC REQUEST INSPECTION
// Called whenever the API URL or important request state changes.
// Returns structured findings the Playground can act on.
// =========================================================

const INSPECTION_SYSTEM_INSTRUCTION = `You are an automatic request inspector for an API Playground. Analyze the current request context and identify issues using the structured finding types.

Finding types you can return:
- authentication_required: The API or evidence suggests authentication is needed but none is configured. Only report if the API documentation, response (e.g. 401/403), or strong evidence supports it. Use "may require" language in the message if uncertain.
- missing_header: A header is needed (e.g. Content-Type for a body, Accept) but missing or disabled.
- missing_environment_variable: The request references a variable (e.g. {{variable}}) or a value that should be stored as an env var, but the variable is not defined in the current environment.
- invalid_request: The request is malformed (empty URL, invalid JSON body, invalid method, etc.).
- response_error: Since the last response is a 4xx/5xx, time-out, or network error - summarize the root cause and suggest a fix.
- body_required: The method (POST/PUT/PATCH) requires a body but none is configured.
- insecure_configuration: The URL uses http:// where the target is a known public/hosted endpoint (should be https), or a secret value is hard-coded in a non-secret location.

Rules:
- Return ONLY the findings array. Do not add commentary, explanations, or conversational text.
- Use severity: 'info' | 'warning' | 'error'.
- Provide a concrete suggestion and an actionable fix action (set_method, set_url, set_params, set_headers, set_body, set_auth, create_environment_variable, run_request, save_request, generate_code, explain_error) with actionArgs when applicable.
- Do NOT report issues that are not supported by evidence. Use "may require" for uncertain findings.
- Return each finding as an object with fields: type, severity, message, suggestion (optional), action (optional), actionArgs (optional).`;

const AI_ACTION_NAMES: AiActionName[] = [
  'set_method',
  'set_url',
  'set_params',
  'set_headers',
  'set_body',
  'set_auth',
  'create_environment_variable',
  'run_request',
  'save_request',
  'generate_code',
  'explain_error',
];

function isAiActionName(value: unknown): value is AiActionName {
  return typeof value === 'string' && AI_ACTION_NAMES.includes(value as AiActionName);
}

function parseFirstVariableName(text: string): string | null {
  const match = text.match(/\{\{\s*([A-Za-z0-9_\-.]+)\s*\}\}/);
  return match?.[1] || null;
}

function inferFallbackAction(
  findingType: AiFinding['type'],
  playgroundContext: Record<string, unknown> | undefined,
  message: string,
  suggestion: string,
): { action: AiActionName; actionArgs: Record<string, unknown> } {
  const context = playgroundContext || {};
  const method = String(context.method || 'GET').toUpperCase();
  const url = String(context.url || '').trim();
  const body = (context.body && typeof context.body === 'object'
    ? (context.body as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const response = (context.response && typeof context.response === 'object'
    ? (context.response as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const status = Number(response.status || context.status || 0);

  switch (findingType) {
    case 'body_required':
      return {
        action: 'set_body',
        actionArgs: {
          type: 'json',
          json: body.json ? String(body.json) : '{\n  \n}',
        },
      };

    case 'missing_header':
      return {
        action: 'set_headers',
        actionArgs: {
          headers: [
            {
              key: 'Content-Type',
              value: method === 'GET' || method === 'HEAD' ? 'application/json' : 'application/json',
              enabled: true,
            },
          ],
          replace: false,
        },
      };

    case 'missing_environment_variable': {
      const fromMsg = parseFirstVariableName(`${message} ${suggestion}`);
      const name = fromMsg || 'API_TOKEN';
      return {
        action: 'create_environment_variable',
        actionArgs: {
          name,
          value: 'REPLACE_ME',
          isSecret: true,
        },
      };
    }

    case 'authentication_required':
      return {
        action: 'set_auth',
        actionArgs: {
          type: 'bearer',
          bearerToken: '{{API_TOKEN}}',
        },
      };

    case 'invalid_request':
      return {
        action: 'set_url',
        actionArgs: {
          url: url || 'https://api.example.com',
        },
      };

    case 'response_error': {
      if (status === 401 || status === 403) {
        return {
          action: 'set_auth',
          actionArgs: {
            type: 'bearer',
            bearerToken: '{{API_TOKEN}}',
          },
        };
      }
      if (status === 405) {
        return {
          action: 'set_method',
          actionArgs: {
            method: method === 'GET' ? 'POST' : 'GET',
          },
        };
      }
      return {
        action: 'set_headers',
        actionArgs: {
          headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
          replace: false,
        },
      };
    }

    case 'insecure_configuration':
      return {
        action: 'set_url',
        actionArgs: {
          url: url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : 'https://api.example.com',
        },
      };

    default:
      return {
        action: 'set_headers',
        actionArgs: {
          headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
          replace: false,
        },
      };
  }
}

function normalizeFinding(
  raw: unknown,
  playgroundContext?: Record<string, unknown>,
): AiFinding | null {
  if (!raw || typeof raw !== 'object') return null;

  const candidate = raw as Record<string, unknown>;
  const type = String(candidate.type || '').trim() as AiFinding['type'];
  const message = String(candidate.message || '').trim();
  if (!type || !message) return null;

  const severityRaw = String(candidate.severity || 'warning').toLowerCase();
  const severity: AiFinding['severity'] =
    severityRaw === 'info' || severityRaw === 'error' ? (severityRaw as AiFinding['severity']) : 'warning';
  const suggestion = candidate.suggestion ? String(candidate.suggestion) : undefined;

  let action = isAiActionName(candidate.action) ? candidate.action : undefined;
  let actionArgs =
    candidate.actionArgs && typeof candidate.actionArgs === 'object'
      ? (candidate.actionArgs as Record<string, unknown>)
      : undefined;

  if (!action || !actionArgs) {
    const fallback = inferFallbackAction(type, playgroundContext, message, suggestion || '');
    action = fallback.action;
    actionArgs = fallback.actionArgs;
  }

  return {
    type,
    severity,
    message,
    suggestion,
    action,
    actionArgs,
  };
}

function buildPlaygroundContext(context: Record<string, unknown>): string {
  const parts: string[] = [];

  if (context.requestName) parts.push(`Request Name: ${context.requestName}`);
  if (context.method) parts.push(`Method: ${context.method}`);
  if (context.url) parts.push(`URL: ${context.url}`);
  if (context.params && Array.isArray(context.params)) {
    const active = (context.params as Array<Record<string, unknown>>).filter((p) => p.enabled);
    if (active.length > 0) parts.push(`Query Params: ${JSON.stringify(active)}`);
  }
  if (context.headers && Array.isArray(context.headers)) {
    const active = (context.headers as Array<Record<string, unknown>>).filter((h) => h.enabled);
    if (active.length > 0) parts.push(`Headers: ${JSON.stringify(active)}`);
  }
  if (context.body && typeof context.body === 'object') {
    const body = context.body as Record<string, unknown>;
    if (body.type) parts.push(`Body Type: ${body.type}`);
    if (body.json) parts.push(`Body JSON: ${body.json}`);
    if (body.raw) parts.push(`Body Raw: ${body.raw}`);
  }
  if (context.auth && typeof context.auth === 'object') {
    const auth = context.auth as Record<string, unknown>;
    parts.push(`Auth Type: ${auth.type || 'no-auth'}`);
  }
  if (context.selectedEnvironment) {
    parts.push(`Environment: ${context.selectedEnvironment}`);
  }
  if (context.environmentVariables && typeof context.environmentVariables === 'object') {
    const vars = context.environmentVariables as Record<string, string>;
    const names = Object.keys(vars);
    if (names.length > 0) parts.push(`Available Environment Variables: ${names.join(', ')}`);
  }
  if (context.response) {
    const resp = context.response as Record<string, unknown>;
    parts.push(`Response Status: ${resp.status} ${resp.statusText || ''}`);
    if (resp.body) {
      const bodyStr = String(resp.body);
      parts.push(`Response Body (first 2000 chars): ${bodyStr.slice(0, 2000)}`);
    }
  }
  if (context.status) parts.push(`Status: ${context.status}`);

  return parts.length > 0 ? `Current Playground Context:\n${parts.join('\n')}` : '';
}

// =========================================================
// FUNCTION DECLARATIONS (Gemini Tools)
// =========================================================

const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'set_method',
    description:
      'Set the HTTP method of the current request. Use when the user asks to change the method, e.g. "change to POST", "use GET", "make it a PUT".',
    parameters: {
      type: Type.OBJECT,
      properties: {
        method: {
          type: Type.STRING,
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
          description: 'The HTTP method to set.',
        },
      },
      required: ['method'],
    },
  },
  {
    name: 'set_url',
    description:
      'Set the URL of the current request. Use when the user provides a URL, endpoint, or asks to change the request URL.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: 'The full URL to set for the request.',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'set_params',
    description:
      'Set or update query parameters on the current request. Use when the user asks to add, change, or remove query parameters.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        params: {
          type: Type.ARRAY,
          description: 'Array of query parameters to set. Each has a key, value, and enabled flag.',
          items: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING, description: 'Parameter name.' },
              value: { type: Type.STRING, description: 'Parameter value.' },
              enabled: { type: Type.BOOLEAN, description: 'Whether the parameter is enabled. Default true.' },
            },
            required: ['key', 'value'],
          },
        },
        replace: {
          type: Type.BOOLEAN,
          description: 'If true, replace all existing params. If false (default), merge with existing.',
        },
      },
      required: ['params'],
    },
  },
  {
    name: 'set_headers',
    description:
      'Set or update HTTP headers on the current request. Use when the user asks to add, change, or remove headers like Content-Type, Authorization, Accept, etc.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        headers: {
          type: Type.ARRAY,
          description: 'Array of headers to set. Each has a key, value, and enabled flag.',
          items: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING, description: 'Header name, e.g. Content-Type.' },
              value: { type: Type.STRING, description: 'Header value.' },
              enabled: { type: Type.BOOLEAN, description: 'Whether the header is enabled. Default true.' },
            },
            required: ['key', 'value'],
          },
        },
        replace: {
          type: Type.BOOLEAN,
          description: 'If true, replace all existing headers. If false (default), merge with existing.',
        },
      },
      required: ['headers'],
    },
  },
  {
    name: 'set_body',
    description:
      'Set the request body. Use when the user asks to write, change, or generate a request body, JSON payload, form data, or raw content.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          enum: ['none', 'json', 'form-data', 'x-www-form-urlencoded', 'raw'],
          description: 'The body type to set.',
        },
        json: {
          type: Type.STRING,
          description: 'The JSON body content as a string. Required when type is "json".',
        },
        raw: {
          type: Type.STRING,
          description: 'The raw body content. Required when type is "raw".',
        },
        formData: {
          type: Type.ARRAY,
          description: 'Form data fields. Required when type is "form-data".',
          items: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING },
              value: { type: Type.STRING },
              enabled: { type: Type.BOOLEAN },
            },
            required: ['key', 'value'],
          },
        },
        urlEncoded: {
          type: Type.ARRAY,
          description: 'URL-encoded form fields. Required when type is "x-www-form-urlencoded".',
          items: {
            type: Type.OBJECT,
            properties: {
              key: { type: Type.STRING },
              value: { type: Type.STRING },
              enabled: { type: Type.BOOLEAN },
            },
            required: ['key', 'value'],
          },
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'set_auth',
    description:
      'Set the authentication configuration for the request. Use when the user asks to add bearer token, API key, basic auth, or change auth type.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: {
          type: Type.STRING,
          enum: ['no-auth', 'api-key', 'bearer', 'basic'],
          description: 'The authentication type to set.',
        },
        apiKeyKey: {
          type: Type.STRING,
          description: 'The API key header/param name. Required when type is "api-key".',
        },
        apiKeyValue: {
          type: Type.STRING,
          description: 'The API key value. Required when type is "api-key".',
        },
        apiKeyIn: {
          type: Type.STRING,
          enum: ['header', 'query'],
          description: 'Where to place the API key. Default "header".',
        },
        bearerToken: {
          type: Type.STRING,
          description: 'The bearer token value. Required when type is "bearer".',
        },
        basicUsername: {
          type: Type.STRING,
          description: 'The basic auth username. Required when type is "basic".',
        },
        basicPassword: {
          type: Type.STRING,
          description: 'The basic auth password. Required when type is "basic".',
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'create_environment_variable',
    description:
      'Create or update an environment variable. Use when the user asks to create a variable, store a value, or when a value should be stored as an environment variable.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: 'The variable name (without {{}} braces).',
        },
        value: {
          type: Type.STRING,
          description: 'The variable value.',
        },
        isSecret: {
          type: Type.BOOLEAN,
          description: 'Whether this is a secret value. Default false.',
        },
      },
      required: ['name', 'value'],
    },
  },
  {
    name: 'run_request',
    description:
      'Execute the current request. Use when the user asks to run, send, execute, or test the request.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'save_request',
    description:
      'Save the current request to the workspace. Use when the user asks to save the request.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: 'Optional name for the saved request. Defaults to current request name.',
        },
      },
    },
  },
  {
    name: 'generate_code',
    description:
      'Generate code for the current request in a specific language. Use when the user asks for code snippets, cURL, or code generation.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        language: {
          type: Type.STRING,
          enum: [
            'curl',
            'javascript-fetch',
            'javascript-axios',
            'python-requests',
            'node',
            'php',
            'java',
            'csharp',
            'go',
            'ruby',
          ],
          description: 'The programming language to generate code for.',
        },
      },
      required: ['language'],
    },
  },
  {
    name: 'explain_error',
    description:
      'Explain an error response in detail. Use when the user asks to explain, diagnose, or understand an error response.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        statusCode: {
          type: Type.NUMBER,
          description: 'The HTTP status code of the error.',
        },
      },
      required: ['statusCode'],
    },
  },
];

// =========================================================
// GEMINI FUNCTION CALLING - Chat / Actions
// =========================================================

export async function chatWithGemini(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  playgroundContext?: Record<string, unknown>,
): Promise<AiActionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }

  const client = new GoogleGenAI({ apiKey });

  const systemMessage = `${DEFAULT_SYSTEM_INSTRUCTION}\n\n${
    playgroundContext ? buildPlaygroundContext(playgroundContext) : 'No specific playground context provided.'
  }`;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: {
        role: 'system',
        parts: [{ text: systemMessage }],
      },
      tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      temperature: 0.2,
      maxOutputTokens: 4096,
    },
  });

  const candidate = response.candidates?.[0];
  if (!candidate) {
    throw new Error('Gemini returned an empty response');
  }

  const parts = candidate.content?.parts || [];

  // Check for function calls
  for (const part of parts) {
    if (part.functionCall) {
      const fc = part.functionCall;
      return {
        type: 'action',
        action: {
          name: fc.name as AiActionName,
          args: (fc.args as Record<string, unknown>) || {},
        },
      };
    }
  }

  // Fallback to text
  const text = parts.map((p) => p.text || '').join('');
  if (!text) {
    throw new Error('Gemini returned an empty response');
  }

  return {
    type: 'text',
    text,
  };
}

// =========================================================
// AUTOMATIC REQUEST INSPECTION
// Called whenever the API URL or important request state changes.
// Returns structured findings that the Playground turns into
// actionable suggestion cards.
// =========================================================

export async function inspectRequest(
  playgroundContext?: Record<string, unknown>,
): Promise<AiFinding[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return [];
  }

  try {
    const client = new GoogleGenAI({ apiKey });

    const contextMessage = playgroundContext
      ? buildPlaygroundContext(playgroundContext)
      : 'No specific playground context provided.';

    const response = await client.models.generateContent({
      model: GEMINI_INSPECTOR_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                `${contextMessage}\n\n` +
                'Return findings by calling the report_findings function with an array of findings. Every finding must include an executable action and actionArgs.',
            },
          ],
        },
      ],
      config: {
        systemInstruction: {
          role: 'system',
          parts: [{ text: INSPECTION_SYSTEM_INSTRUCTION }],
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'report_findings',
                description: 'Returns structured and actionable request inspection findings.',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    findings: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          type: {
                            type: Type.STRING,
                            enum: [
                              'authentication_required',
                              'missing_header',
                              'missing_environment_variable',
                              'invalid_request',
                              'response_error',
                              'body_required',
                              'insecure_configuration',
                            ],
                          },
                          severity: {
                            type: Type.STRING,
                            enum: ['info', 'warning', 'error'],
                          },
                          message: { type: Type.STRING },
                          suggestion: { type: Type.STRING },
                          action: {
                            type: Type.STRING,
                            enum: AI_ACTION_NAMES,
                          },
                          actionArgs: { type: Type.OBJECT },
                        },
                        required: ['type', 'severity', 'message', 'action', 'actionArgs'],
                      },
                    },
                  },
                  required: ['findings'],
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    });

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Extract the report_findings function call args
    const functionCall = parts
      .map((p) => p.functionCall)
      .find((fc) => fc && fc.name === 'report_findings');
    if (!functionCall || !functionCall.args) return [];

    const parsedArgs = functionCall.args as { findings?: unknown[] };
    const findings = Array.isArray(parsedArgs.findings) ? parsedArgs.findings : [];

    return findings
      .map((f) => normalizeFinding(f, playgroundContext))
      .filter((f): f is AiFinding => Boolean(f));
  } catch (_err) {
    // Silent fail - inspection is best-effort
    return [];
  }
}
