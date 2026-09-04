export interface ApiItem {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  rating: number;
  requestCount: string;
  isTrending?: boolean;
  status: 'Active' | 'Beta' | 'Maintenance' | 'Deprecated';
  icon: string; // SVG icon identifier or color scheme
  accentColor: string;
  provider: string;
  latencyMs: number;
  uptime: string;
  endpointsCount: number;
  baseUrl: string;
  version: string;
  authType: 'API Key' | 'OAuth 2.0' | 'Bearer Token' | 'None';
  endpoints?: ApiEndpoint[];
}

export interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  parameters?: { name: string; type: string; required: boolean; description: string }[];
  sampleRequest?: string;
  sampleResponse?: string;
}

export interface CollectionItem {
  id: string;
  name: string;
  apiCount: number;
  color: string;
  iconName: string;
  description: string;
  apis: string[]; // ApiItem IDs
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'update' | 'system' | 'alert';
}

export type NavigationTab = 
  | 'home'
  | 'apis'
  | 'my-apis'
  | 'subscriptions'
  | 'playground'
  | 'collections'
  | 'environments'
  | 'api-keys'
  | 'history'
  | 'usage'
  | 'wallet'
  | 'billing'
  | 'billing-invoices'
  | 'billing-payments'
  | 'billing-methods'
  | 'billing-info'
  | 'settings'
  | 'api-build'
  | 'api-builder';

export type ApiProjectCreationMethod = 'import' | 'blank' | 'template' | 'ai';

/** The single resource created by every API creation path. */
export interface ApiProject {
  id: string;
  name: string;
  description: string;
  creationMethod: ApiProjectCreationMethod;
  lifecycle: 'draft' | 'build' | 'test' | 'version' | 'publish';
  activeVersionId: string;
  versions: Array<{
    id: string;
    semver: string;
    notes: string;
    status: 'draft' | 'published' | 'deprecated';
    immutable: boolean;
    definition: string;
  }>;
  createdAt: string;
  builder?: ApiBuilderState;
}

export type BuilderView = 'design' | 'code' | 'openapi' | 'test' | 'docs' | 'versions';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type FlowNodeType =
  | 'Request'
  | 'Validation'
  | 'Condition'
  | 'Database'
  | 'Function'
  | 'Transform'
  | 'Authentication'
  | 'HTTP Request'
  | 'Response';

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  label: string;
  description?: string;
  status?: 'idle' | 'running' | 'success' | 'error';
  config?: Record<string, string>;
  inputs?: string[];
  outputs?: string[];
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface ApiParameter {
  id: string;
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  type: string;
  required: boolean;
  description?: string;
}

export interface ApiHeader {
  id: string;
  name: string;
  value: string;
  required: boolean;
  description?: string;
}

export interface ApiResponse {
  id: string;
  status: number;
  description: string;
  contentType: string;
  body: string;
}

export interface ApiTest {
  id: string;
  name: string;
  status?: number;
  latency?: number;
  result?: string;
  assertions?: Array<{ id: string; expression: string; passed?: boolean }>;
  createdAt: string;
}

export interface ApiBuilderEndpoint {
  id: string;
  name: string;
  method: HttpMethod;
  path: string;
  group: string;
  authentication: 'None' | 'JWT' | 'API Key' | 'OAuth 2.0';
  rateLimit?: string;
  validation?: boolean;
  parameters: ApiParameter[];
  headers: ApiHeader[];
  requestBody: string;
  responseBody: string;
  responses: ApiResponse[];
  code: string;
  flow: FlowNode[];
  edges: FlowEdge[];
  tests: ApiTest[];
  description?: string;
}

export interface SchemaField {
  id: string;
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
}

export interface ApiBuilderModel {
  id: string;
  name: string;
  fields: SchemaField[];
  description?: string;
}

export interface DatabaseColumn {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  primaryKey?: boolean;
  foreignKey?: { table: string; column: string };
  default?: string;
}

export interface DatabaseTable {
  id: string;
  name: string;
  columns: DatabaseColumn[];
  relationships?: Array<{ from: string; to: string; type: 'one-to-many' | 'many-to-many' | 'one-to-one' | 'many-to-one' }>;
}

export interface MiddlewareItem {
  id: string;
  name: string;
  type: 'auth' | 'rate-limit' | 'logging' | 'cors' | 'custom';
  enabled: boolean;
  config?: string;
}

export interface ApiVersionChange {
  id: string;
  type: 'added' | 'updated' | 'removed';
  description: string;
  timestamp: string;
}

export interface ApiBuilderState {
  endpoints: ApiBuilderEndpoint[];
  models: ApiBuilderModel[];
  database: DatabaseTable[];
  middleware: MiddlewareItem[];
  selectedEndpointId?: string;
  selectedModelId?: string;
  selectedTableId?: string;
  selectedNodeId?: string;
  selectedMiddlewareId?: string;
  flowNodes?: FlowNode[];
  view?: BuilderView;
  pinnedIds?: string[];
  changelog?: string;
  versionChanges?: ApiVersionChange[];
  publish?: { visibility: 'Private' | 'Public/Open Source' | 'Marketplace'; license: string; pricing: string; status: 'draft' | 'published' };
}