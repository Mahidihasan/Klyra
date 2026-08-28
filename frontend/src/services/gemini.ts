import { AiAction, AiActionResult, AiFinding, PlaygroundActionName, PlaygroundResponse } from '../types/playground';

export interface GeminiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PlaygroundAiContext {
  requestName?: string;
  method?: string;
  url?: string;
  params?: Array<{ key: string; value: string; enabled: boolean }>;
  headers?: Array<{ key: string; value: string; enabled: boolean }>;
  body?: { type: string; json?: string; raw?: string };
  auth?: { type: string };
  selectedEnvironment?: string;
  environmentVariables?: Record<string, string>;
  response?: PlaygroundResponse | null;
  status?: number | string;
}

/**
 * Builds a context object from the current Playground state.
 * This is used to send relevant context with each AI request.
 */
export function buildPlaygroundContext(
  config: {
    name?: string;
    method: string;
    url: string;
    params?: Array<{ key: string; value: string; enabled: boolean }>;
    headers?: Array<{ key: string; value: string; enabled: boolean }>;
    body?: { type: string; json?: string; raw?: string };
    auth?: { type: string };
  },
  response: PlaygroundResponse | null | undefined,
  environment: string | undefined,
  environmentVariables?: Record<string, string>,
): PlaygroundAiContext {
  return {
    requestName: config.name || 'Untitled Request',
    method: config.method,
    url: config.url || '',
    params: config.params?.filter((p) => p.enabled && p.key) || [],
    headers: config.headers?.filter((h) => h.enabled && h.key) || [],
    body: config.body
      ? {
          type: config.body.type,
          json: config.body.json,
          raw: config.body.raw,
        }
      : undefined,
    auth: config.auth ? { type: config.auth.type } : undefined,
    selectedEnvironment: environment || undefined,
    environmentVariables: environmentVariables || undefined,
    response: response || undefined,
    status: response?.status,
  };
}

/**
 * Returns a context-appropriate system prompt prefix based on the AI action.
 */
export function getActionPrompt(action: AiAction): string {
  const prompts: Record<AiAction, string> = {
    'generate-request':
      'Generate a complete HTTP API request based on the description. Use the action functions to set method, URL, headers, auth, and body.',
    'explain-request':
      'Explain the current HTTP request in detail - what it does, the method, endpoint, headers, authentication, and body. Provide technical analysis.',
    'fix-request':
      'Analyze the current request and identify any issues. Call the appropriate action functions to fix URL format, headers, authentication, body structure, or content types.',
    'diagnose-error':
      'Analyze the error response and provide a root cause diagnosis. Call the appropriate fix actions.',
    'explain-response':
      'Explain the HTTP response in detail - the status code meaning, headers significance, and body structure.',
    'generate-code':
      'Generate code snippets in various languages to make this API request. Call the generate_code function.',
    'recommend-endpoint':
      'Based on the current request context, suggest related endpoints, alternative approaches, or improvements to the API design.',
    'suggest-improvements':
      'Analyze the current request and suggest improvements for performance, security, error handling, and best practices.',
    'ask-ai': '',
  };
  return prompts[action] || '';
}

/**
 * Sends a chat message to the backend Gemini proxy.
 * Returns a structured action result that the Playground executes.
 * The API key stays server-side - never exposed to the client.
 */
export async function chatWithGemini(
  messages: GeminiMessage[],
  playgroundContext?: PlaygroundAiContext,
): Promise<AiActionResult> {
  const response = await fetch('/api/playground/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, playgroundContext }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'AI chat request failed' }));
    throw new Error(error.error || `AI chat failed with status ${response.status}`);
  }

  const data = await response.json();
  return data as AiActionResult;
}

/**
 * Automatically inspects the current request state.
 * Called whenever the API URL or important request state changes.
 * Returns structured findings that the Playground turns into actionable cards.
 * Best-effort - never throws. Returns empty array on failure.
 */
export async function inspectRequest(
  playgroundContext?: PlaygroundAiContext,
  signal?: AbortSignal,
): Promise<AiFinding[]> {
  try {
    const response = await fetch('/api/playground/ai/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playgroundContext }),
      signal,
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data as AiFinding[];
  } catch (err) {
    if (signal?.aborted) {
      return [];
    }
    // Best-effort - inspection failure is silently ignored
    return [];
  }
}