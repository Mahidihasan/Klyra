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

export interface SavedRequest {
  id: string;
  name: string;
  collectionId?: string;
  config: RequestConfig;
  createdAt: string;
  updatedAt: string;
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

export interface UserWorkspace {
  id: string;
  name: string;
  isPinned?: boolean;
  isDefault?: boolean;
  createdAt: string;
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

export interface ApiWorkspaceItem {
  id: string;
  name: string;
  description?: string;
  provider?: string;
  icon?: string;
  accentColor?: string;
  source: 'my-apis' | 'subscribed' | 'recent';
  versions: ApiVersionInfo[];
  isOwned?: boolean;
  isSubscribed?: boolean;
  isDraft?: boolean;
}

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

export interface ExecuteRequestPayload {
  config: RequestConfig;
  environment: Environment | null;
}

export interface PlaygroundData {
  userWorkspaces: UserWorkspace[];
  workspaceApis: ApiWorkspaceItem[];
  localApis: LocalApi[];
  collections: Collection[];
  history: HistoryEntry[];
  environments: Environment[];
  apiExamples: ApiExample[];
  workspaceItems: import('./playground.workspace').WorkspaceItem[];
}
