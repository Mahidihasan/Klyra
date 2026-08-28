export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type AuthType = 'no-auth' | 'api-key' | 'bearer' | 'basic';

export type BodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw';

export interface KeyValueItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
  description?: string;
}

export interface AuthConfig {
  type: AuthType;
  apiKeyKey?: string;
  apiKeyValue?: string;
  apiKeyIn?: 'header' | 'query';
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
}

export interface BodyConfig {
  type: BodyType;
  json?: string;
  formData?: KeyValueItem[];
  urlEncoded?: KeyValueItem[];
  raw?: string;
  rawLanguage?: 'text' | 'json' | 'xml' | 'html';
}

export interface RequestConfig {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValueItem[];
  headers: KeyValueItem[];
  cookies: KeyValueItem[];
  auth: AuthConfig;
  body: BodyConfig;
}

export interface PlaygroundResponse {
  id: string;
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  body: string;
  headers: Record<string, string>;
  isSuccess: boolean;
  isRedirect: boolean;
  isClientError: boolean;
  isServerError: boolean;
  isTimeout: boolean;
  isNetworkError: boolean;
  error?: string;
}

export interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
  secrets: Record<string, string>;
  baseUrl?: string;
  isDefault?: boolean;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  color: string;
  requests: SavedRequest[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedRequest {
  id: string;
  name: string;
  collectionId?: string;
  config: RequestConfig;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEntry {
  id: string;
  requestName: string;
  method: HttpMethod;
  url: string;
  status: number;
  statusText: string;
  timeMs: number;
  timestamp: string;
  responseBody?: string;
  collectionId?: string;
  apiId?: string;
}

export interface ApiContext {
  apiId: string;
  apiName: string;
  apiDescription?: string;
  baseUrl: string;
  version: string;
  authType: string;
  documentationUrl?: string;
  endpoints?: { method: string; path: string; description?: string }[];
  sampleRequest?: string;
  sampleResponse?: string;
  isSubscribed?: boolean;
  isOwnedApi?: boolean;
  ownVersionUnpublished?: boolean;
}

export type RequestTab = 'params' | 'headers' | 'auth' | 'body' | 'cookies';

export type ResponseTab = 'body' | 'json-tree' | 'headers' | 'raw' | 'code';

export type AiAction =
  | 'generate-request'
  | 'explain-request'
  | 'fix-request'
  | 'diagnose-error'
  | 'explain-response'
  | 'generate-code'
  | 'recommend-endpoint'
  | 'suggest-improvements'
  | 'ask-ai';

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: AiAction;
  timestamp: string;
}

// =========================================================
// SCHEMA-AWARE REQUEST EDITOR
// =========================================================

export type SchemaFieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null' | 'any';

export interface SchemaField {
  name: string;
  type: SchemaFieldType;
  required: boolean;
  description?: string;
  defaultValue?: any;
  children?: SchemaField[];
  arrayItemType?: SchemaFieldType;
}

export interface RequestValidationIssue {
  fieldPath: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface SchemaValidationResult {
  isValid: boolean;
  issues: RequestValidationIssue[];
}

// =========================================================
// API EXAMPLES (Save as API Example)
// =========================================================

export interface ApiExample {
  id: string;
  name: string;
  description?: string;
  apiId?: string;
  endpointId?: string;
  request: RequestConfig;
  response?: PlaygroundResponse;
  createdAt: string;
  updatedAt: string;
}

// =========================================================
// ERROR DIAGNOSIS / SUGGESTIONS
// =========================================================

export interface ErrorSuggestion {
  cause: string;
  fix: string;
  actionable?: boolean;
  action?: () => void;
}

export interface ErrorDiagnosis {
  title: string;
  message: string;
  suggestions: ErrorSuggestion[];
  code?: string;
}

export type CodeLanguage =
  | 'curl'
  | 'javascript-fetch'
  | 'javascript-axios'
  | 'python-requests'
  | 'node'
  | 'php'
  | 'java'
  | 'csharp'
  | 'go'
  | 'ruby';

// =========================================================
// ACTION-ORIENTED AI COPILOT
// Gemini returns structured actions that the Playground executes
// on the actual request state. Never parse natural-language.
// =========================================================

export type PlaygroundActionName =
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

export interface PlaygroundAction {
  name: PlaygroundActionName;
  args: Record<string, unknown>;
}

export type AiFindingType =
  | 'authentication_required'
  | 'missing_header'
  | 'missing_environment_variable'
  | 'invalid_request'
  | 'response_error'
  | 'body_required'
  | 'insecure_configuration';

export interface AiFinding {
  type: AiFindingType;
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
  action?: PlaygroundActionName;
  actionArgs?: Record<string, unknown>;
}

export interface AiActionResult {
  type: 'action' | 'text';
  action?: PlaygroundAction;
  text?: string;
  findings?: AiFinding[];
}

// =========================================================
// WORKSPACE SIDEBAR TYPES
// =========================================================

export type ApiSource = 'my-apis' | 'subscribed' | 'recent';

// Workspace / explorer groups
export type ApiGroupId = 'my-apis' | 'connected' | 'local';

export interface UserWorkspace {
  id: string;
  name: string;
  isPinned?: boolean;
  isDefault?: boolean;
  createdAt: string;
}

export interface LocalApi {
  id: string;
  name: string;
  baseUrl: string;
  description?: string;
  accentColor?: string;
  source: 'local';
  isLocal: true;
  endpoints: ApiWorkspaceEndpoint[];
}

export interface ApiVersionInfo {
  id: string;
  version: string;
  isDraft?: boolean;
  isPublished?: boolean;
  isSubscribed?: boolean;
  isOwned?: boolean;
  baseUrl: string;
  authType: string;
  authConfig?: AuthConfig;
  endpoints: ApiWorkspaceEndpoint[];
  documentationUrl?: string;
  sampleRequest?: string;
  sampleResponse?: string;
}

export interface ApiWorkspaceEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  description?: string;
  sampleRequest?: string;
  sampleResponse?: string;
  parameters?: { name: string; type: string; required: boolean; description: string }[];
}

export interface ApiWorkspaceItem {
  id: string;
  name: string;
  description?: string;
  provider?: string;
  icon?: string;
  accentColor?: string;
  source: ApiSource;
  versions: ApiVersionInfo[];
  isOwned?: boolean;
  isSubscribed?: boolean;
  isDraft?: boolean;
}

export type WorkspaceTab = 'apis' | 'collections' | 'history' | 'environments';

export interface PlaygroundData {
  userWorkspaces: UserWorkspace[];
  workspaceApis: ApiWorkspaceItem[];
  localApis: LocalApi[];
  collections: Collection[];
  history: HistoryEntry[];
  environments: Environment[];
  apiExamples?: ApiExample[];
  workspaceItems?: WorkspaceItem[];
}

// =========================================================
// UNIFIED WORKSPACE ITEM MODEL
// Represents requests, folders, collections, test files
// in a single hierarchical tree with stable IDs, ordering,
// parent relationships, timestamps, and metadata.
// =========================================================

export type WorkspaceItemKind = 'request' | 'folder' | 'collection' | 'test';

export interface WorkspaceItem {
  id: string;
  kind: WorkspaceItemKind;
  name: string;
  parentId?: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
  isPinned?: boolean;
  collectionId?: string;
  request?: RequestConfig;
  description?: string;
  color?: string;
  workspaceId?: string;
  apiId?: string;
  endpointId?: string;
  method?: string;
  url?: string;
}

// An "open tab" preserves a request's working state while switching.
export interface OpenRequestTab {
  tabId: string;
  itemId?: string;
  name: string;
  config: RequestConfig;
  isDirty: boolean;
  responseRef?: {
    responseId: string;
  };
}

// Response cache per tab (so switching tabs doesn't lose results)
export interface TabResponseCache {
  [tabId: string]: {
    response: PlaygroundResponse | null;
  };
}
