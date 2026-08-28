import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowDown, ArrowUp, Bot, Braces, Check, CheckCircle2, ChevronDown,
  ChevronRight, Circle, Clipboard, Code2, Copy, Database, Download, FileCode2, FileJson, FileText,
  Filter, Folder, FolderOpen, GitBranch, Globe, History, KeyRound, Layers, Loader2,
  Lock, MoreHorizontal, MoreVertical, Network, Package, Pencil, Play, Plus, PlusCircle,
  RefreshCw, Rocket, Save, Search, Send, Server, Settings, Shield, ShieldCheck, Sparkles,
  Split, TestTube2, Trash2, Upload, Wand2, X, Zap, Eye, EyeOff, Pin, Move, GitCompare,
  RotateCcw, CheckSquare, Square, AlertTriangle, Info, Clock, Terminal, Workflow,
  ListTree, Table2, Box, FunctionSquare, SlidersHorizontal, BookOpen, FileUp, Globe2,
  Link2, Unlink, GripVertical, PanelLeft, PanelRight, PanelLeftClose, PanelRightClose,
  ChevronsLeft, ChevronsRight, CircleDot, CircleDotDashed, XCircle,
  MinusCircle, ArrowUpRight, ArrowDownRight, ArrowUpDown, CornerDownRight,
  MousePointer2, Hand, ZoomIn, ZoomOut, Maximize2, Minimize2, Undo2, Redo2, Wrench,
} from 'lucide-react';
import {
  ApiBuilderEndpoint, ApiBuilderModel, ApiBuilderState, ApiProject, ApiResponse,
  ApiTest, BuilderView, DatabaseTable, FlowNode, FlowNodeType, HttpMethod,
  MiddlewareItem, SchemaField,
} from '../../types/api';
import './styles.css';

/* =========================================================
   HELPERS
   ========================================================= */

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const defaultFlow = (): FlowNode[] => [
  { id: id(), type: 'Request', label: 'Request', description: 'Incoming HTTP request', status: 'idle', inputs: [], outputs: ['next'] },
  { id: id(), type: 'Validation', label: 'Validate Request', description: 'Validate request body', status: 'idle', inputs: ['next'], outputs: ['valid', 'invalid'] },
  { id: id(), type: 'Database', label: 'Database', description: 'Query database', status: 'idle', inputs: ['next'], outputs: ['success', 'error'] },
  { id: id(), type: 'Transform', label: 'Transform Response', description: 'Map response data', status: 'idle', inputs: ['next'], outputs: ['next'] },
  { id: id(), type: 'Response', label: 'Response', description: 'Return HTTP response', status: 'idle', inputs: ['next'], outputs: [] },
];

const defaultEdges = (nodes: FlowNode[]) => nodes.slice(0, -1).map((n, i) => ({
  id: id(), from: n.id, to: nodes[i + 1].id, label: n.outputs?.[0] || 'next',
}));

const defaultCode = (method: string, path: string) => `export async function handler(request, { db }) {
  // ${method} ${path}
  const input = await request.json();
  const result = await db.users.create({ data: input });
  return Response.json(result, { status: 201 });
}`;

const defaultEndpoint = (method: HttpMethod = 'POST', path = '/users', name = 'Create user'): ApiBuilderEndpoint => {
  const flow = defaultFlow();
  return {
    id: id(), name, method, path, group: 'Users', authentication: 'JWT', rateLimit: '100 req/min',
    validation: true, parameters: [], headers: [
      { id: id(), name: 'Content-Type', value: 'application/json', required: true, description: 'Request content type' },
      { id: id(), name: 'Authorization', value: 'Bearer <token>', required: true, description: 'JWT access token' },
    ],
    requestBody: '{\n  "name": "Ada Lovelace",\n  "email": "ada@example.com"\n}',
    responses: [
      { id: id(), status: 201, description: 'Created', contentType: 'application/json', body: '{\n  "id": "usr_123",\n  "name": "Ada Lovelace",\n  "email": "ada@example.com"\n}' },
      { id: id(), status: 400, description: 'Bad Request', contentType: 'application/json', body: '{\n  "error": "Invalid request body"\n}' },
      { id: id(), status: 401, description: 'Unauthorized', contentType: 'application/json', body: '{\n  "error": "Missing or invalid token"\n}' },
    ],
    code: defaultCode(method, path), flow, edges: defaultEdges(flow), tests: [],
    responseBody: '{\n  "id": "usr_123",\n  "name": "Ada Lovelace"\n}',
    description: 'Create a new user in the system',
  };
};

const defaultState = (): ApiBuilderState => {
  const users = defaultEndpoint('POST', '/users', 'Create user');
  const login = defaultEndpoint('POST', '/login', 'Login');
  login.group = 'Authentication';
  login.authentication = 'None';
  login.path = '/login';
  login.name = 'Login';
  login.description = 'Authenticate a user and return a JWT';
  login.flow = [
    { id: id(), type: 'Request', label: 'Request', description: 'Incoming login request', status: 'idle', inputs: [], outputs: ['next'] },
    { id: id(), type: 'Validation', label: 'Validate Credentials', description: 'Check email and password', status: 'idle', inputs: ['next'], outputs: ['valid', 'invalid'] },
    { id: id(), type: 'Function', label: 'Verify Password', description: 'Compare password hash', status: 'idle', inputs: ['valid'], outputs: ['match', 'no-match'] },
    { id: id(), type: 'Authentication', label: 'Generate JWT', description: 'Sign access token', status: 'idle', inputs: ['match'], outputs: ['next'] },
    { id: id(), type: 'Response', label: 'Response', description: 'Return token', status: 'idle', inputs: ['next'], outputs: [] },
  ];
  login.edges = defaultEdges(login.flow);

  const refresh = defaultEndpoint('POST', '/refresh', 'Refresh token');
  refresh.group = 'Authentication';
  refresh.authentication = 'JWT';
  refresh.path = '/refresh';
  refresh.name = 'Refresh token';
  refresh.description = 'Refresh an expired JWT';

  const getUsers = defaultEndpoint('GET', '/users', 'List users');
  getUsers.method = 'GET';
  getUsers.name = 'List users';
  getUsers.description = 'List all users';
  getUsers.requestBody = '{}';
  getUsers.responses = [
    { id: id(), status: 200, description: 'OK', contentType: 'application/json', body: '[\n  { "id": "usr_123", "name": "Ada Lovelace" }\n]' },
  ];

  const getUser = defaultEndpoint('GET', '/users/:id', 'Get user');
  getUser.method = 'GET';
  getUser.name = 'Get user';
  getUser.description = 'Get a single user by ID';
  getUser.requestBody = '{}';
  getUser.parameters = [{ id: id(), name: 'id', in: 'path', type: 'string', required: true, description: 'User ID' }];
  getUser.responses = [
    { id: id(), status: 200, description: 'OK', contentType: 'application/json', body: '{\n  "id": "usr_123",\n  "name": "Ada Lovelace"\n}' },
    { id: id(), status: 404, description: 'Not Found', contentType: 'application/json', body: '{\n  "error": "User not found"\n}' },
  ];

  const deleteUser = defaultEndpoint('DELETE', '/users/:id', 'Delete user');
  deleteUser.method = 'DELETE';
  deleteUser.name = 'Delete user';
  deleteUser.description = 'Delete a user by ID';
  deleteUser.requestBody = '{}';
  deleteUser.parameters = [{ id: id(), name: 'id', in: 'path', type: 'string', required: true, description: 'User ID' }];
  deleteUser.responses = [
    { id: id(), status: 204, description: 'No Content', contentType: 'application/json', body: '' },
    { id: id(), status: 404, description: 'Not Found', contentType: 'application/json', body: '{\n  "error": "User not found"\n}' },
  ];

  return {
    endpoints: [login, refresh, getUsers, users, getUser, deleteUser],
    models: [
      {
        id: id(), name: 'User', description: 'User account',
        fields: [
          { id: id(), name: 'id', type: 'integer', required: true, description: 'Primary key' },
          { id: id(), name: 'name', type: 'string', required: true, description: 'Full name' },
          { id: id(), name: 'email', type: 'string', required: true, description: 'Email address' },
          { id: id(), name: 'createdAt', type: 'datetime', required: false, description: 'Creation timestamp' },
        ],
      },
      {
        id: id(), name: 'Order', description: 'Customer order',
        fields: [
          { id: id(), name: 'id', type: 'integer', required: true, description: 'Primary key' },
          { id: id(), name: 'userId', type: 'integer', required: true, description: 'FK to User' },
          { id: id(), name: 'total', type: 'number', required: true, description: 'Order total' },
          { id: id(), name: 'status', type: 'string', required: true, description: 'Order status' },
        ],
      },
      {
        id: id(), name: 'Product', description: 'Product catalog',
        fields: [
          { id: id(), name: 'id', type: 'integer', required: true, description: 'Primary key' },
          { id: id(), name: 'name', type: 'string', required: true, description: 'Product name' },
          { id: id(), name: 'price', type: 'number', required: true, description: 'Unit price' },
          { id: id(), name: 'stock', type: 'integer', required: false, description: 'Stock count' },
        ],
      },
    ],
    database: [
      {
        id: id(), name: 'Users',
        columns: [
          { id: id(), name: 'id', type: 'integer', nullable: false, primaryKey: true },
          { id: id(), name: 'name', type: 'varchar', nullable: false },
          { id: id(), name: 'email', type: 'varchar', nullable: false },
          { id: id(), name: 'created_at', type: 'timestamp', nullable: true, default: 'now()' },
        ],
        relationships: [{ from: 'id', to: 'Orders.userId', type: 'one-to-many' }],
      },
      {
        id: id(), name: 'Orders',
        columns: [
          { id: id(), name: 'id', type: 'integer', nullable: false, primaryKey: true },
          { id: id(), name: 'user_id', type: 'integer', nullable: false, foreignKey: { table: 'Users', column: 'id' } },
          { id: id(), name: 'total', type: 'decimal', nullable: false },
          { id: id(), name: 'status', type: 'varchar', nullable: false, default: "'pending'" },
        ],
        relationships: [{ from: 'user_id', to: 'Users.id', type: 'many-to-one' }],
      },
      {
        id: id(), name: 'Products',
        columns: [
          { id: id(), name: 'id', type: 'integer', nullable: false, primaryKey: true },
          { id: id(), name: 'name', type: 'varchar', nullable: false },
          { id: id(), name: 'price', type: 'decimal', nullable: false },
          { id: id(), name: 'stock', type: 'integer', nullable: true, default: '0' },
        ],
      },
    ],
    middleware: [
      { id: id(), name: 'auth', type: 'auth', enabled: true, config: 'JWT bearer token verification' },
      { id: id(), name: 'rateLimit', type: 'rate-limit', enabled: true, config: '100 req/min per IP' },
      { id: id(), name: 'cors', type: 'cors', enabled: true, config: 'Allow all origins' },
      { id: id(), name: 'logging', type: 'logging', enabled: true, config: 'Request/response logging' },
    ],
    selectedEndpointId: users.id,
    view: 'design',
    versionChanges: [
      { id: id(), type: 'added', description: 'Added POST /orders', timestamp: new Date().toISOString() },
      { id: id(), type: 'updated', description: 'Updated User schema', timestamp: new Date().toISOString() },
      { id: id(), type: 'removed', description: 'Removed legacy endpoint', timestamp: new Date().toISOString() },
    ],
    publish: { visibility: 'Marketplace', license: 'MIT', pricing: 'Free', status: 'draft' },
  };
};

const openApi = (project: ApiProject, state: ApiBuilderState) => JSON.stringify({
  openapi: '3.0.3',
  info: { title: project.name, version: project.versions.find(v => v.id === project.activeVersionId)?.semver?.replace('v', '') || '1.0.0', description: project.description },
  paths: Object.fromEntries(state.endpoints.map(e => [e.path, {
    [e.method.toLowerCase()]: {
      summary: e.name,
      description: e.description,
      security: e.authentication === 'JWT' ? [{ bearerAuth: [] }] : e.authentication === 'API Key' ? [{ apiKey: [] }] : [],
      parameters: e.parameters.map(p => ({ name: p.name, in: p.in, required: p.required, schema: { type: p.type } })),
      requestBody: e.method !== 'GET' && e.method !== 'DELETE' ? { content: { 'application/json': { schema: { type: 'object' }, example: JSON.parse(e.requestBody || '{}') } } } : undefined,
      responses: Object.fromEntries(e.responses.map(r => [String(r.status), { description: r.description, content: r.contentType ? { [r.contentType]: { example: r.body ? JSON.parse(r.body) : undefined } } : undefined }])),
    },
  }])),
  components: {
    schemas: Object.fromEntries(state.models.map(m => [m.name, {
      type: 'object',
      properties: Object.fromEntries(m.fields.map(f => [f.name, { type: f.type }])),
      required: m.fields.filter(f => f.required).map(f => f.name),
    }])),
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' },
      apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
    },
  },
}, null, 2);

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e', POST: '#a78bfa', PUT: '#f59e0b', PATCH: '#3b82f6',
  DELETE: '#ef4444', HEAD: '#6366f1', OPTIONS: '#8b5cf6',
};

const FLOW_NODE_ICONS: Record<FlowNodeType, React.ComponentType<any>> = {
  'Request': ArrowDown, 'Validation': ShieldCheck, 'Condition': GitBranch,
  'Database': Database, 'Function': FunctionSquare, 'Transform': Wand2,
  'Authentication': KeyRound, 'HTTP Request': Globe, 'Response': Send,
};

const FLOW_NODE_COLORS: Record<FlowNodeType, string> = {
  'Request': '#a78bfa', 'Validation': '#22c55e', 'Condition': '#f59e0b',
  'Database': '#3b82f6', 'Function': '#ec4899', 'Transform': '#06b6d4',
  'Authentication': '#8b5cf6', 'HTTP Request': '#f97316', 'Response': '#22c55e',
};

const FLOW_NODE_TYPES: FlowNodeType[] = [
  'Validation', 'Condition', 'Database', 'Function', 'Transform',
  'Authentication', 'HTTP Request', 'Response',
];

/* =========================================================
   SUB-COMPONENTS
   ========================================================= */

/* ---------- Context Menu ---------- */
interface CtxMenuState { x: number; y: number; items: Array<{ label: string; icon: React.ComponentType<any>; danger?: boolean; onClick: () => void }>; }

const ContextMenu: React.FC<{ state: CtxMenuState | null; onClose: () => void }> = ({ state, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!state) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [state, onClose]);
  if (!state) return null;
  const w = 180, h = state.items.length * 30 + 10;
  const left = Math.min(state.x, window.innerWidth - w - 8);
  const top = Math.min(state.y, window.innerHeight - h - 8);
  return (
    <div ref={ref} className="ab-ctx-menu" style={{ left, top, width: w }}>
      {state.items.map((item, i) => {
        const Icon = item.icon;
        return (
          <button key={i} className={`ab-ctx-item ${item.danger ? 'danger' : ''}`} onClick={() => { item.onClick(); onClose(); }}>
            <Icon size={13} /> <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

/* ---------- Inline Rename ---------- */
const InlineRename: React.FC<{ value: string; onCommit: (v: string) => void; onCancel: () => void }> = ({ value, onCommit, onCancel }) => {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const commit = () => { const t = v.trim(); if (t) onCommit(t); else onCancel(); };
  return (
    <input
      ref={ref} className="ab-inline-rename" value={v}
      onChange={e => setV(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}
      onBlur={commit} onClick={e => e.stopPropagation()}
    />
  );
};

/* ---------- Resizable Panels ---------- */
const useResizable = (initial: number, min: number, max: number, dir: 'left' | 'right') => {
  const [size, setSize] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, size: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, size };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const delta = dir === 'left' ? e.clientX - startRef.current.x : startRef.current.x - e.clientX;
      setSize(Math.min(max, Math.max(min, startRef.current.size + delta)));
    };
    const onUp = () => setDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [dragging, dir, min, max]);

  return { size, onMouseDown, dragging };
};

/* ---------- Top Navigation ---------- */
const TopNav: React.FC<{
  project: ApiProject; saveState: 'saved' | 'dirty' | 'saving';
  onBack: () => void; onSave: () => void; onTest: () => void; onPreview: () => void;
  onPublish: () => void; onMore: (e: React.MouseEvent) => void;
  onVersionChange: (v: string) => void; onEnvChange: (e: string) => void;
}> = ({ project, saveState, onBack, onSave, onTest, onPreview, onPublish, onMore, onVersionChange, onEnvChange }) => {
  const activeVersion = project.versions.find(v => v.id === project.activeVersionId);
  return (
    <header className="ab-topbar">
      <div className="ab-topbar-left">
        <button className="ab-back-btn" onClick={onBack} title="Back to dashboard">
          <ArrowLeft size={15} /> <span>API Builder</span>
        </button>
        <div className="ab-topbar-divider" />
        <div className="ab-project-name">
          <Package size={14} className="ab-project-icon" />
          <span className="ab-project-title">{project.name}</span>
        </div>
        <div className="ab-version-select">
          <GitBranch size={12} />
          <select value={project.activeVersionId} onChange={e => onVersionChange(e.target.value)} title="Version">
            {project.versions.map(v => <option key={v.id} value={v.id}>{v.semver}</option>)}
          </select>
          <ChevronDown size={11} />
        </div>
        <div className="ab-env-select">
          <Globe size={12} />
          <select defaultValue="development" onChange={e => onEnvChange(e.target.value)} title="Environment">
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </select>
          <ChevronDown size={11} />
        </div>
        <span className={`ab-save-state ${saveState}`}>
          {saveState === 'saving' ? <Loader2 size={11} className="ab-spin" /> : saveState === 'dirty' ? <CircleDot size={11} /> : <CheckCircle2 size={11} />}
          {saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? 'Unsaved changes' : 'Saved'}
        </span>
      </div>
      <div className="ab-topbar-right">
        <button className="ab-tb-btn" onClick={onSave} title="Save (Ctrl+S)">
          <Save size={14} /> <span>Save</span>
        </button>
        <button className="ab-tb-btn ab-tb-test" onClick={onTest} title="Run tests">
          <TestTube2 size={14} /> <span>Test</span>
        </button>
        <button className="ab-tb-btn" onClick={onPreview} title="Preview documentation">
          <Eye size={14} /> <span>Preview</span>
        </button>
        <button className="ab-tb-btn ab-tb-publish" onClick={onPublish} title="Publish API">
          <Rocket size={14} /> <span>Publish</span>
        </button>
        <button className="ab-tb-icon" onClick={onMore} title="More actions">
          <MoreVertical size={15} />
        </button>
      </div>
    </header>
  );
};

/* ---------- Project Explorer ---------- */
const ProjectExplorer: React.FC<{
  state: ApiBuilderState; project: ApiProject;
  expanded: Record<string, boolean>; onToggle: (key: string) => void;
  onSelectEndpoint: (id: string) => void; onSelectModel: (id: string) => void;
  onSelectTable: (id: string) => void; onSelectMiddleware: (id: string) => void;
  onAddEndpoint: () => void; onAddModel: () => void; onAddTable: () => void;
  onAddMiddleware: () => void; onRename: (kind: string, id: string, name: string) => void;
  onDelete: (kind: string, id: string) => void; onDuplicate: (kind: string, id: string) => void;
  onMove: (kind: string, id: string) => void; onPin: (kind: string, id: string) => void;
  onSearch: (q: string) => void; search: string;
  onOpenImport: () => void; onOpenVersions: () => void; onOpenDocs: () => void;
  onOpenTests: () => void; onOpenDatabase: () => void; onOpenSchemas: () => void;
  onOpenMiddleware: () => void; onOpenFunctions: () => void;
  onSetView: (v: BuilderView) => void;
}> = ({
  state, project, expanded, onToggle, onSelectEndpoint, onSelectModel, onSelectTable,
  onSelectMiddleware, onAddEndpoint, onAddModel, onAddTable, onAddMiddleware,
  onRename, onDelete, onDuplicate, onMove, onPin, onSearch, search,
  onOpenImport, onOpenVersions, onOpenDocs, onOpenTests, onOpenDatabase,
  onOpenSchemas, onOpenMiddleware, onOpenFunctions, onSetView,
}) => {
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [renaming, setRenaming] = useState<{ kind: string; id: string; name: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const groups = useMemo(() => {
    const endpointGroups = new Map<string, ApiBuilderEndpoint[]>();
    state.endpoints.forEach(e => {
      const g = e.group || 'Endpoints';
      if (!endpointGroups.has(g)) endpointGroups.set(g, []);
      endpointGroups.get(g)!.push(e);
    });
    return Array.from(endpointGroups.entries());
  }, [state.endpoints]);

  const filteredEndpoints = useMemo(() => {
    if (!search.trim()) return state.endpoints;
    const q = search.toLowerCase();
    return state.endpoints.filter(e =>
      e.name.toLowerCase().includes(q) || e.path.toLowerCase().includes(q) || e.method.toLowerCase().includes(q)
    );
  }, [state.endpoints, search]);

  const filteredModels = useMemo(() => {
    if (!search.trim()) return state.models;
    const q = search.toLowerCase();
    return state.models.filter(m => m.name.toLowerCase().includes(q));
  }, [state.models, search]);

  const filteredTables = useMemo(() => {
    if (!search.trim()) return state.database;
    const q = search.toLowerCase();
    return state.database.filter(t => t.name.toLowerCase().includes(q));
  }, [state.database, search]);

  const filteredMiddleware = useMemo(() => {
    if (!search.trim()) return state.middleware;
    const q = search.toLowerCase();
    return state.middleware.filter(m => m.name.toLowerCase().includes(q));
  }, [state.middleware, search]);

  const openCtx = (e: React.MouseEvent, items: CtxMenuState['items']) => {
    e.stopPropagation(); e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  };

  const renderEndpointRow = (ep: ApiBuilderEndpoint, depth: number) => (
    <div
      key={ep.id}
      className={`ab-tree-row ${state.selectedEndpointId === ep.id ? 'active' : ''} ${dragId === ep.id ? 'dragging' : ''} ${dropTarget === ep.id ? 'drop-target' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={() => onSelectEndpoint(ep.id)}
      draggable
      onDragStart={() => setDragId(ep.id)}
      onDragEnd={() => { setDragId(null); setDropTarget(null); }}
      onDragOver={e => { e.preventDefault(); setDropTarget(ep.id); }}
      onDrop={e => { e.preventDefault(); if (dragId && dragId !== ep.id) onMove('endpoint', dragId); setDropTarget(null); }}
      onContextMenu={e => openCtx(e, [
        { label: 'Rename', icon: Pencil, onClick: () => setRenaming({ kind: 'endpoint', id: ep.id, name: ep.name }) },
        { label: 'Duplicate', icon: Copy, onClick: () => onDuplicate('endpoint', ep.id) },
        { label: 'Move to…', icon: Move, onClick: () => onMove('endpoint', ep.id) },
        { label: 'Pin', icon: Pin, onClick: () => onPin('endpoint', ep.id) },
        { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete('endpoint', ep.id) },
      ])}
    >
      <span className="ab-tree-spacer" />
      <span className={`ab-method ab-method-${ep.method}`}>{ep.method}</span>
      <span className="ab-tree-label ab-mono">{ep.path}</span>
      <button className="ab-tree-hover-btn" onClick={e => { e.stopPropagation(); setRenaming({ kind: 'endpoint', id: ep.id, name: ep.name }); }} title="Rename"><Pencil size={10} /></button>
      <button className="ab-tree-hover-btn" onClick={e => openCtx(e, [
        { label: 'Rename', icon: Pencil, onClick: () => setRenaming({ kind: 'endpoint', id: ep.id, name: ep.name }) },
        { label: 'Duplicate', icon: Copy, onClick: () => onDuplicate('endpoint', ep.id) },
        { label: 'Move to…', icon: Move, onClick: () => onMove('endpoint', ep.id) },
        { label: 'Pin', icon: Pin, onClick: () => onPin('endpoint', ep.id) },
        { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete('endpoint', ep.id) },
      ])} title="Actions"><MoreVertical size={10} /></button>
    </div>
  );

  const renderModelRow = (m: ApiBuilderModel, depth: number) => (
    <div
      key={m.id}
      className={`ab-tree-row ${state.selectedModelId === m.id ? 'active' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={() => onSelectModel(m.id)}
      onContextMenu={e => openCtx(e, [
        { label: 'Rename', icon: Pencil, onClick: () => setRenaming({ kind: 'model', id: m.id, name: m.name }) },
        { label: 'Duplicate', icon: Copy, onClick: () => onDuplicate('model', m.id) },
        { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete('model', m.id) },
      ])}
    >
      <span className="ab-tree-spacer" />
      <Braces size={12} className="ab-tree-icon ab-icon-schema" />
      {renaming?.kind === 'model' && renaming.id === m.id ? (
        <InlineRename value={m.name} onCommit={v => onRename('model', m.id, v)} onCancel={() => setRenaming(null)} />
      ) : (
        <span className="ab-tree-label">{m.name}</span>
      )}
      <button className="ab-tree-hover-btn" onClick={e => openCtx(e, [
        { label: 'Rename', icon: Pencil, onClick: () => setRenaming({ kind: 'model', id: m.id, name: m.name }) },
        { label: 'Duplicate', icon: Copy, onClick: () => onDuplicate('model', m.id) },
        { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete('model', m.id) },
      ])} title="Actions"><MoreVertical size={10} /></button>
    </div>
  );

  const renderTableRow = (t: DatabaseTable, depth: number) => (
    <div
      key={t.id}
      className={`ab-tree-row ${state.selectedTableId === t.id ? 'active' : ''}`}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={() => onSelectTable(t.id)}
      onContextMenu={e => openCtx(e, [
        { label: 'Rename', icon: Pencil, onClick: () => setRenaming({ kind: 'table', id: t.id, name: t.name }) },
        { label: 'Duplicate', icon: Copy, onClick: () => onDuplicate('table', t.id) },
        { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete('table', t.id) },
      ])}
    >
      <span className="ab-tree-spacer" />
      <Table2 size={12} className="ab-tree-icon ab-icon-db" />
      {renaming?.kind === 'table' && renaming.id === t.id ? (
        <InlineRename value={t.name} onCommit={v => onRename('table', t.id, v)} onCancel={() => setRenaming(null)} />
      ) : (
        <span className="ab-tree-label">{t.name}</span>
      )}
      <button className="ab-tree-hover-btn" onClick={e => openCtx(e, [
        { label: 'Rename', icon: Pencil, onClick: () => setRenaming({ kind: 'table', id: t.id, name: t.name }) },
        { label: 'Duplicate', icon: Copy, onClick: () => onDuplicate('table', t.id) },
        { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete('table', t.id) },
      ])} title="Actions"><MoreVertical size={10} /></button>
    </div>
  );

  const renderMiddlewareRow = (mw: MiddlewareItem, depth: number) => (
    <div
      key={mw.id}
      className={`ab-tree-row ${state.middleware.some(m => m.id === mw.id && m.enabled) ? '' : 'disabled'}`}
      style={{ paddingLeft: 8 + depth * 14 }}
      onClick={() => onSelectMiddleware(mw.id)}
      onContextMenu={e => openCtx(e, [
        { label: 'Rename', icon: Pencil, onClick: () => setRenaming({ kind: 'middleware', id: mw.id, name: mw.name }) },
        { label: 'Toggle', icon: mw.enabled ? EyeOff : Eye, onClick: () => onPin('middleware', mw.id) },
        { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete('middleware', mw.id) },
      ])}
    >
      <span className="ab-tree-spacer" />
      <Shield size={12} className="ab-tree-icon ab-icon-mw" />
      {renaming?.kind === 'middleware' && renaming.id === mw.id ? (
        <InlineRename value={mw.name} onCommit={v => onRename('middleware', mw.id, v)} onCancel={() => setRenaming(null)} />
      ) : (
        <span className="ab-tree-label">{mw.name}</span>
      )}
      <span className={`ab-mw-status ${mw.enabled ? 'on' : 'off'}`}>{mw.enabled ? 'on' : 'off'}</span>
      <button className="ab-tree-hover-btn" onClick={e => openCtx(e, [
        { label: 'Rename', icon: Pencil, onClick: () => setRenaming({ kind: 'middleware', id: mw.id, name: mw.name }) },
        { label: 'Toggle', icon: mw.enabled ? EyeOff : Eye, onClick: () => onPin('middleware', mw.id) },
        { label: 'Delete', icon: Trash2, danger: true, onClick: () => onDelete('middleware', mw.id) },
      ])} title="Actions"><MoreVertical size={10} /></button>
    </div>
  );

  const renderSection = (
    key: string, label: string, icon: React.ReactNode, count: number,
    onAdd: () => void, children: React.ReactNode, onOpen?: () => void,
  ) => {
    const isOpen = expanded[key] !== false;
    return (
      <div className="ab-tree-section">
        <div className="ab-tree-section-head" onClick={() => onToggle(key)}>
          <ChevronRight size={11} className={`ab-tree-chevron ${isOpen ? 'open' : ''}`} />
          {icon}
          <span className="ab-tree-section-label">{label}</span>
          <span className="ab-tree-count">{count}</span>
          <button className="ab-tree-add-btn" onClick={e => { e.stopPropagation(); onAdd(); }} title={`Add ${label}`}><Plus size={11} /></button>
          {onOpen && <button className="ab-tree-hover-btn" onClick={e => { e.stopPropagation(); onOpen(); }} title={`Open ${label}`}><ChevronRight size={10} /></button>}
        </div>
        {isOpen && <div className="ab-tree-children">{children}</div>}
      </div>
    );
  };

  return (
    <div className="ab-explorer">
      <div className="ab-explorer-header">
        <span className="ab-explorer-title">PROJECT EXPLORER</span>
        <button className="ab-explorer-add" onClick={onAddEndpoint} title="New endpoint"><PlusCircle size={14} /></button>
      </div>
      <div className="ab-explorer-search">
        <Search size={12} />
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Search project…" />
        {search && <button onClick={() => onSearch('')}><X size={11} /></button>}
      </div>
      <div className="ab-explorer-scroll">
        {renderSection('endpoints', 'Endpoints', <ListTree size={12} className="ab-icon-endpoints" />, state.endpoints.length, onAddEndpoint,
          <>
            {filteredEndpoints.length === 0 && !search && (
              <div className="ab-tree-empty">
                <span>No endpoints yet</span>
                <button onClick={onAddEndpoint}><Plus size={10} /> Endpoint</button>
              </div>
            )}
            {filteredEndpoints.map(ep => renderEndpointRow(ep, 1))}
          </>
        )}

        {renderSection('schemas', 'Schemas', <Braces size={12} className="ab-icon-schema" />, state.models.length, onAddModel,
          <>
            {filteredModels.length === 0 && !search && (
              <div className="ab-tree-empty"><span>No schemas yet</span><button onClick={onAddModel}><Plus size={10} /> Schema</button></div>
            )}
            {filteredModels.map(m => renderModelRow(m, 1))}
          </>,
          onOpenSchemas
        )}

        {renderSection('database', 'Database', <Database size={12} className="ab-icon-db" />, state.database.length, onAddTable,
          <>
            {filteredTables.length === 0 && !search && (
              <div className="ab-tree-empty"><span>No tables yet</span><button onClick={onAddTable}><Plus size={10} /> Table</button></div>
            )}
            {filteredTables.map(t => renderTableRow(t, 1))}
          </>,
          onOpenDatabase
        )}

        {renderSection('functions', 'Functions', <FunctionSquare size={12} className="ab-icon-fn" />, 0, () => {}, 
          <div className="ab-tree-empty"><span>No functions yet</span><button onClick={onOpenFunctions}><Plus size={10} /> Function</button></div>,
          onOpenFunctions
        )}

        {renderSection('middleware', 'Middleware', <Shield size={12} className="ab-icon-mw" />, state.middleware.length, onAddMiddleware,
          <>
            {filteredMiddleware.length === 0 && !search && (
              <div className="ab-tree-empty"><span>No middleware yet</span><button onClick={onAddMiddleware}><Plus size={10} /> Middleware</button></div>
            )}
            {filteredMiddleware.map(mw => renderMiddlewareRow(mw, 1))}
          </>,
          onOpenMiddleware
        )}

        {renderSection('tests', 'Tests', <TestTube2 size={12} className="ab-icon-tests" />, 0, () => {},
          <div className="ab-tree-empty"><span>No tests yet</span><button onClick={onOpenTests}><Plus size={10} /> Test</button></div>,
          onOpenTests
        )}

        {renderSection('docs', 'Documentation', <BookOpen size={12} className="ab-icon-docs" />, 0, () => {},
          <div className="ab-tree-empty"><span>Generated from API</span><button onClick={onOpenDocs}><Eye size={10} /> Preview</button></div>,
          onOpenDocs
        )}

        {renderSection('versions', 'Versions', <GitBranch size={12} className="ab-icon-versions" />, project.versions.length, () => {},
          <div className="ab-tree-versions">
            {project.versions.map(v => (
              <div key={v.id} className={`ab-tree-row ${project.activeVersionId === v.id ? 'active' : ''}`} style={{ paddingLeft: 22 }} onClick={() => onOpenVersions()}>
                <span className="ab-tree-spacer" />
                <GitBranch size={11} className="ab-tree-icon ab-icon-versions" />
                <span className="ab-tree-label ab-mono">{v.semver}</span>
                <span className={`ab-version-badge ${v.status}`}>{v.status}</span>
              </div>
            ))}
          </div>,
          onOpenVersions
        )}

        <div className="ab-explorer-import" onClick={onOpenImport}>
          <Upload size={12} /> <span>Import API</span>
        </div>
      </div>
      <ContextMenu state={ctxMenu} onClose={() => setCtxMenu(null)} />
    </div>
  );
};

/* ---------- Visual Flow Editor ---------- */
const VisualFlowEditor: React.FC<{
  endpoint: ApiBuilderEndpoint;
  selectedNodeId?: string;
  onSelectNode: (id: string) => void;
  onUpdateNode: (node: FlowNode) => void;
  onDeleteNode: (id: string) => void;
  onAddNode: (type: FlowNodeType) => void;
  onUpdateEdge: (from: string, to: string, label: string) => void;
}> = ({ endpoint, selectedNodeId, onSelectNode, onUpdateNode, onDeleteNode, onAddNode, onUpdateEdge }) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingEdge, setEditingEdge] = useState<string | null>(null);

  const nodeById = useMemo(() => new Map(endpoint.flow.map(n => [n.id, n])), [endpoint.flow]);

  const renderNode = (node: FlowNode, index: number) => {
    const Icon = FLOW_NODE_ICONS[node.type] || Circle;
    const color = FLOW_NODE_COLORS[node.type] || '#a78bfa';
    const isSelected = selectedNodeId === node.id;
    const outgoing = endpoint.edges.filter(e => e.from === node.id);

    return (
      <React.Fragment key={node.id}>
        <div
          className={`ab-flow-node ${isSelected ? 'selected' : ''} ${node.status === 'error' ? 'error' : ''} ${node.status === 'success' ? 'success' : ''}`}
          style={{ borderColor: isSelected ? color : undefined }}
          onClick={() => onSelectNode(node.id)}
        >
          <div className="ab-flow-node-head">
            <span className="ab-flow-node-icon" style={{ background: `${color}22`, color }}>
              <Icon size={13} />
            </span>
            <span className="ab-flow-node-type">{node.type}</span>
            <div className="ab-flow-node-actions">
              <button className="ab-flow-node-btn" onClick={e => { e.stopPropagation(); onDeleteNode(node.id); }} title="Delete node"><Trash2 size={10} /></button>
              <button className="ab-flow-node-btn" onClick={e => { e.stopPropagation(); onSelectNode(node.id); }} title="Edit node"><Pencil size={10} /></button>
            </div>
          </div>
          <input
            className="ab-flow-node-title"
            value={node.label}
            onChange={e => onUpdateNode({ ...node, label: e.target.value })}
            onClick={e => e.stopPropagation()}
            placeholder="Node title"
          />
          {node.description && <span className="ab-flow-node-desc">{node.description}</span>}
          <div className="ab-flow-node-connectors">
            {node.inputs && node.inputs.length > 0 && (
              <div className="ab-flow-inputs">
                {node.inputs.map(inp => (
                  <span key={inp} className="ab-flow-connector ab-flow-input">
                    <CircleDot size={8} /> <span>{inp}</span>
                  </span>
                ))}
              </div>
            )}
            {node.outputs && node.outputs.length > 0 && (
              <div className="ab-flow-outputs">
                {node.outputs.map(out => (
                  <span key={out} className="ab-flow-connector ab-flow-output">
                    <span>{out}</span> <CircleDot size={8} />
                  </span>
                ))}
              </div>
            )}
          </div>
          {node.status && node.status !== 'idle' && (
            <span className={`ab-flow-status ab-flow-status-${node.status}`}>
              {node.status === 'success' ? <CheckCircle2 size={9} /> : node.status === 'error' ? <XCircle size={9} /> : <CircleDotDashed size={9} />}
              {node.status}
            </span>
          )}
        </div>
        {outgoing.map(edge => {
          const target = nodeById.get(edge.to);
          return (
            <div key={edge.id} className="ab-flow-edge">
              <div className="ab-flow-edge-line">
                <span className="ab-flow-edge-dot" />
              </div>
              {editingEdge === edge.id ? (
                <input
                  className="ab-flow-edge-label-input"
                  defaultValue={edge.label}
                  autoFocus
                  onBlur={e => { onUpdateEdge(edge.from, edge.to, e.target.value || 'next'); setEditingEdge(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingEdge(null); }}
                />
              ) : (
                <button className="ab-flow-edge-label" onClick={() => setEditingEdge(edge.id)} title="Edit edge label">
                  {edge.label || 'next'}
                </button>
              )}
              {target && <span className="ab-flow-edge-target">{target.label}</span>}
            </div>
          );
        })}
      </React.Fragment>
    );
  };

  return (
    <div className="ab-flow-editor">
      <div className="ab-flow-toolbar">
        <div className="ab-flow-toolbar-left">
          <span className="ab-flow-toolbar-title"><Workflow size={13} /> Visual Flow</span>
          <span className="ab-flow-toolbar-count">{endpoint.flow.length} steps</span>
        </div>
        <div className="ab-flow-toolbar-right">
          <button className="ab-flow-toolbar-btn" title="Zoom out"><ZoomOut size={13} /></button>
          <button className="ab-flow-toolbar-btn" title="Zoom in"><ZoomIn size={13} /></button>
          <button className="ab-flow-toolbar-btn" title="Fit view"><Maximize2 size={13} /></button>
          <div className="ab-flow-add-wrap">
            <button className="ab-flow-add-btn" onClick={() => setShowAddMenu(v => !v)}>
              <Plus size={13} /> <span>Add Step</span> <ChevronDown size={10} />
            </button>
            {showAddMenu && (
              <div className="ab-flow-add-menu">
                {FLOW_NODE_TYPES.map(type => {
                  const Icon = FLOW_NODE_ICONS[type];
                  const color = FLOW_NODE_COLORS[type];
                  return (
                    <button key={type} onClick={() => { onAddNode(type); setShowAddMenu(false); }}>
                      <span style={{ color, background: `${color}18` }}><Icon size={12} /></span>
                      <span>{type}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="ab-flow-canvas">
        <div className="ab-flow-canvas-inner">
          {endpoint.flow.map((node, i) => renderNode(node, i))}
        </div>
      </div>
    </div>
  );
};

/* ---------- Code Editor ---------- */
const CodeEditor: React.FC<{
  files: Array<{ name: string; content: string; generated?: boolean }>;
  activeFile: string;
  onFileChange: (name: string) => void;
  onContentChange: (name: string, content: string) => void;
  onFormat: () => void;
  onCopy: () => void;
  onSearch: () => void;
}> = ({ files, activeFile, onFileChange, onContentChange, onFormat, onCopy, onSearch }) => {
  const active = files.find(f => f.name === activeFile) || files[0];
  const lines = active.content.split('\n');
  const [folding, setFolding] = useState<Record<number, boolean>>({});

  const toggleFold = (line: number) => setFolding(prev => ({ ...prev, [line]: !prev[line] }));

  const isFoldable = (line: string) => /[{}]/.test(line) || line.trim().endsWith('{');

  return (
    <div className="ab-code-editor">
      <div className="ab-code-tabs">
        {files.map(f => (
          <button
            key={f.name}
            className={`ab-code-tab ${f.name === activeFile ? 'active' : ''}`}
            onClick={() => onFileChange(f.name)}
          >
            <FileCode2 size={12} />
            <span>{f.name}</span>
            {f.generated && <span className="ab-code-generated" title="Generated code"><Sparkles size={9} /></span>}
          </button>
        ))}
        <div className="ab-code-toolbar">
          <button onClick={onSearch} title="Search"><Search size={12} /></button>
          <button onClick={onFormat} title="Format"><Wand2 size={12} /></button>
          <button onClick={onCopy} title="Copy"><Copy size={12} /></button>
        </div>
      </div>
      <div className="ab-code-body">
        <div className="ab-code-gutter">
          {lines.map((line, i) => (
            <div key={i} className="ab-code-line-num" onClick={() => isFoldable(line) && toggleFold(i)}>
              {isFoldable(line) && <span className={`ab-code-fold ${folding[i] ? 'folded' : ''}`}>{folding[i] ? '▸' : '▾'}</span>}
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          className="ab-code-textarea"
          value={active.content}
          onChange={e => onContentChange(active.name, e.target.value)}
          spellCheck={false}
          style={{ fontFamily: 'var(--font-mono)' }}
        />
      </div>
    </div>
  );
};

/* ---------- Schema Designer ---------- */
const SchemaDesigner: React.FC<{
  model: ApiBuilderModel;
  onUpdate: (m: ApiBuilderModel) => void;
  onAddField: () => void;
  onDeleteField: (id: string) => void;
}> = ({ model, onUpdate, onAddField, onDeleteField }) => {
  const updateField = (id: string, patch: Partial<SchemaField>) => {
    onUpdate({ ...model, fields: model.fields.map(f => f.id === id ? { ...f, ...patch } : f) });
  };

  return (
    <div className="ab-schema-designer">
      <div className="ab-schema-header">
        <div className="ab-schema-title">
          <Braces size={14} className="ab-icon-schema" />
          <input value={model.name} onChange={e => onUpdate({ ...model, name: e.target.value })} className="ab-schema-name" />
          <span className="ab-schema-count">{model.fields.length} fields</span>
        </div>
        <div className="ab-schema-actions">
          <button className="ab-schema-btn" onClick={onAddField}><Plus size={12} /> Add Field</button>
        </div>
      </div>
      {model.description && <p className="ab-schema-desc">{model.description}</p>}
      <div className="ab-schema-table">
        <div className="ab-schema-table-head">
          <span>Field</span>
          <span>Type</span>
          <span>Required</span>
          <span>Description</span>
          <span />
        </div>
        {model.fields.map(f => (
          <div key={f.id} className="ab-schema-row">
            <input value={f.name} onChange={e => updateField(f.id, { name: e.target.value })} className="ab-schema-cell ab-mono" />
            <select value={f.type} onChange={e => updateField(f.id, { type: e.target.value })} className="ab-schema-cell ab-schema-type">
              <option value="string">string</option>
              <option value="integer">integer</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
              <option value="datetime">datetime</option>
              <option value="uuid">uuid</option>
              <option value="object">object</option>
              <option value="array">array</option>
            </select>
            <button
              className={`ab-schema-required ${f.required ? 'checked' : ''}`}
              onClick={() => updateField(f.id, { required: !f.required })}
              title={f.required ? 'Required' : 'Optional'}
            >
              {f.required ? <CheckSquare size={13} /> : <Square size={13} />}
            </button>
            <input value={f.description || ''} onChange={e => updateField(f.id, { description: e.target.value })} placeholder="Description" className="ab-schema-cell" />
            <button className="ab-schema-delete" onClick={() => onDeleteField(f.id)} title="Delete field"><Trash2 size={11} /></button>
          </div>
        ))}
        {model.fields.length === 0 && (
          <div className="ab-schema-empty">
            <span>No fields yet</span>
            <button onClick={onAddField}><Plus size={11} /> Add Field</button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- Database View ---------- */
const DatabaseView: React.FC<{
  tables: DatabaseTable[];
  selectedTableId?: string;
  onSelectTable: (id: string) => void;
  onUpdateTable: (t: DatabaseTable) => void;
  onAddColumn: (tableId: string) => void;
  onDeleteColumn: (tableId: string, colId: string) => void;
  onAddTable: () => void;
}> = ({ tables, selectedTableId, onSelectTable, onUpdateTable, onAddColumn, onDeleteColumn, onAddTable }) => {
  const selected = tables.find(t => t.id === selectedTableId) || tables[0];

  const updateColumn = (colId: string, patch: Partial<DatabaseTable['columns'][0]>) => {
    if (!selected) return;
    onUpdateTable({ ...selected, columns: selected.columns.map(c => c.id === colId ? { ...c, ...patch } : c) });
  };

  return (
    <div className="ab-db-view">
      <div className="ab-db-header">
        <div className="ab-db-title">
          <Database size={14} className="ab-icon-db" />
          <span>Database</span>
          <span className="ab-db-engine">PostgreSQL</span>
        </div>
        <button className="ab-schema-btn" onClick={onAddTable}><Plus size={12} /> Add Table</button>
      </div>
      <div className="ab-db-body">
        <div className="ab-db-tables">
          <div className="ab-db-tables-label">TABLES</div>
          {tables.map(t => (
            <button
              key={t.id}
              className={`ab-db-table-item ${selected?.id === t.id ? 'active' : ''}`}
              onClick={() => onSelectTable(t.id)}
            >
              <Table2 size={12} />
              <span>{t.name}</span>
              <span className="ab-db-col-count">{t.columns.length}</span>
            </button>
          ))}
          {tables.length === 0 && <div className="ab-tree-empty"><span>No tables</span><button onClick={onAddTable}><Plus size={10} /> Table</button></div>}
        </div>
        {selected && (
          <div className="ab-db-table-detail">
            <div className="ab-db-table-head">
              <input value={selected.name} onChange={e => onUpdateTable({ ...selected, name: e.target.value })} className="ab-db-table-name" />
              <span className="ab-db-table-meta">{selected.columns.length} columns</span>
            </div>
            <div className="ab-db-columns">
              <div className="ab-db-columns-head">
                <span>Column</span><span>Type</span><span>Nullable</span><span>Default</span><span>Key</span><span />
              </div>
              {selected.columns.map(col => (
                <div key={col.id} className="ab-db-column-row">
                  <input value={col.name} onChange={e => updateColumn(col.id, { name: e.target.value })} className="ab-mono ab-db-cell" />
                  <select value={col.type} onChange={e => updateColumn(col.id, { type: e.target.value })} className="ab-db-cell">
                    <option value="integer">integer</option>
                    <option value="varchar">varchar</option>
                    <option value="text">text</option>
                    <option value="decimal">decimal</option>
                    <option value="boolean">boolean</option>
                    <option value="timestamp">timestamp</option>
                    <option value="uuid">uuid</option>
                    <option value="jsonb">jsonb</option>
                  </select>
                  <button className={`ab-db-nullable ${col.nullable ? '' : 'not-null'}`} onClick={() => updateColumn(col.id, { nullable: !col.nullable })}>
                    {col.nullable ? 'NULL' : 'NOT NULL'}
                  </button>
                  <input value={col.default || ''} onChange={e => updateColumn(col.id, { default: e.target.value })} placeholder="—" className="ab-mono ab-db-cell" />
                  <span className="ab-db-key">
                    {col.primaryKey && <span className="ab-db-pk" title="Primary key">PK</span>}
                    {col.foreignKey && <span className="ab-db-fk" title={`FK → ${col.foreignKey.table}.${col.foreignKey.column}`}>FK</span>}
                  </span>
                  <button className="ab-schema-delete" onClick={() => onDeleteColumn(selected.id, col.id)}><Trash2 size={11} /></button>
                </div>
              ))}
              <button className="ab-db-add-col" onClick={() => onAddColumn(selected.id)}><Plus size={11} /> Add Column</button>
            </div>
            {selected.relationships && selected.relationships.length > 0 && (
              <div className="ab-db-relationships">
                <div className="ab-db-rel-label">RELATIONSHIPS</div>
                {selected.relationships.map((rel, i) => (
                  <div key={i} className="ab-db-rel-row">
                    <Link2 size={11} />
                    <span className="ab-mono">{selected.name}.{rel.from}</span>
                    <ArrowRight size={10} />
                    <span className="ab-mono">{rel.to}</span>
                    <span className="ab-db-rel-type">{rel.type}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- Test Workspace ---------- */
const TestWorkspace: React.FC<{
  endpoint: ApiBuilderEndpoint;
  onUpdate: (patch: Partial<ApiBuilderEndpoint>) => void;
  onRunTest: () => void;
  isRunning: boolean;
}> = ({ endpoint, onUpdate, onRunTest, isRunning }) => {
  const [activeAssertion, setActiveAssertion] = useState(0);

  return (
    <div className="ab-test-workspace">
      <div className="ab-test-header">
        <div className="ab-test-title">
          <TestTube2 size={14} className="ab-icon-tests" />
          <span className={`ab-method ab-method-${endpoint.method}`}>{endpoint.method}</span>
          <span className="ab-mono">{endpoint.path}</span>
        </div>
        <button className="ab-test-run" onClick={onRunTest} disabled={isRunning}>
          {isRunning ? <Loader2 size={13} className="ab-spin" /> : <Play size={13} />}
          <span>{isRunning ? 'Running…' : 'Run Test'}</span>
        </button>
      </div>
      <div className="ab-test-body">
        <div className="ab-test-pane">
          <div className="ab-test-pane-head">
            <span>REQUEST</span>
            <div className="ab-test-pane-tabs">
              <button className="active">Body</button>
              <button>Headers</button>
              <button>Auth</button>
            </div>
          </div>
          <div className="ab-test-pane-content">
            <div className="ab-test-kv">
              {endpoint.headers.map(h => (
                <div key={h.id} className="ab-test-kv-row">
                  <span className="ab-mono ab-test-kv-key">{h.name}</span>
                  <span className="ab-mono ab-test-kv-val">{h.value}</span>
                </div>
              ))}
            </div>
            <textarea
              className="ab-test-body-editor"
              value={endpoint.requestBody}
              onChange={e => onUpdate({ requestBody: e.target.value })}
              spellCheck={false}
            />
          </div>
        </div>
        <div className="ab-test-divider" />
        <div className="ab-test-pane">
          <div className="ab-test-pane-head">
            <span>RESPONSE</span>
            <div className="ab-test-pane-tabs">
              <button className="active">Body</button>
              <button>Headers</button>
              <button>Assertions</button>
            </div>
          </div>
          <div className="ab-test-pane-content">
            {endpoint.tests.length > 0 ? (
              <>
                <div className="ab-test-result-meta">
                  <span className={`ab-test-status ab-test-status-${endpoint.tests[0].status && endpoint.tests[0].status < 400 ? 'ok' : 'err'}`}>
                    {endpoint.tests[0].status || 200} {endpoint.tests[0].status && endpoint.tests[0].status < 400 ? 'OK' : 'Error'}
                  </span>
                  <span className="ab-test-latency"><Clock size={11} /> {endpoint.tests[0].latency || 0} ms</span>
                </div>
                <pre className="ab-test-response">{endpoint.tests[0].result || '{}'}</pre>
              </>
            ) : (
              <div className="ab-test-empty">
                <Play size={20} />
                <span>Run a test to see the response</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="ab-test-assertions">
        <div className="ab-test-assertions-head">
          <span>ASSERTIONS</span>
          <button className="ab-test-add-assertion"><Plus size={11} /> Add</button>
        </div>
        <div className="ab-test-assertions-list">
          {endpoint.tests[0]?.assertions?.map((a, i) => (
            <div key={a.id} className={`ab-test-assertion ${a.passed === false ? 'failed' : a.passed ? 'passed' : ''}`}>
              <span className="ab-test-assertion-icon">
                {a.passed === undefined ? <CircleDot size={11} /> : a.passed ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
              </span>
              <code>{a.expression}</code>
            </div>
          )) || (
            <div className="ab-test-assertion ab-test-assertion-default">
              <span className="ab-test-assertion-icon"><CircleDot size={11} /></span>
              <code>response.status === 200</code>
            </div>
          )}
        </div>
      </div>
      {endpoint.tests.length > 0 && (
        <div className="ab-test-history">
          <div className="ab-test-history-head"><span>TEST HISTORY</span></div>
          {endpoint.tests.slice(0, 5).map(t => (
            <div key={t.id} className="ab-test-history-row">
              <span className={`ab-test-history-status ${t.status && t.status < 400 ? 'ok' : 'err'}`}>{t.status || '—'}</span>
              <span className="ab-test-history-name">{t.name}</span>
              <span className="ab-test-history-latency">{t.latency} ms</span>
              <span className="ab-test-history-time">{new Date(t.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ---------- Inspector ---------- */
const Inspector: React.FC<{
  state: ApiBuilderState;
  endpoint?: ApiBuilderEndpoint;
  model?: ApiBuilderModel;
  table?: DatabaseTable;
  node?: FlowNode;
  middleware?: MiddlewareItem;
  onUpdateEndpoint: (patch: Partial<ApiBuilderEndpoint>) => void;
  onUpdateModel: (m: ApiBuilderModel) => void;
  onUpdateTable: (t: DatabaseTable) => void;
  onUpdateNode: (n: FlowNode) => void;
  onUpdateMiddleware: (m: MiddlewareItem) => void;
}> = ({ state, endpoint, model, table, node, middleware, onUpdateEndpoint, onUpdateModel, onUpdateTable, onUpdateNode, onUpdateMiddleware }) => {
  if (node && endpoint) {
    return (
      <div className="ab-inspector">
        <div className="ab-inspector-head">
          <span className="ab-inspector-title">FLOW NODE</span>
        </div>
        <div className="ab-inspector-body">
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Type</div>
            <div className="ab-inspector-value"><span className="ab-inspector-node-type">{node.type}</span></div>
          </div>
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Label</div>
            <input className="ab-inspector-input" value={node.label} onChange={e => onUpdateNode({ ...node, label: e.target.value })} />
          </div>
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Description</div>
            <textarea className="ab-inspector-input ab-inspector-textarea" value={node.description || ''} onChange={e => onUpdateNode({ ...node, description: e.target.value })} />
          </div>
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Status</div>
            <div className="ab-inspector-value"><span className={`ab-inspector-status ab-inspector-status-${node.status || 'idle'}`}>{node.status || 'idle'}</span></div>
          </div>
          {node.config && Object.entries(node.config).map(([k, v]) => (
            <div key={k} className="ab-inspector-section">
              <div className="ab-inspector-label">{k}</div>
              <input className="ab-inspector-input ab-mono" value={v} onChange={e => onUpdateNode({ ...node, config: { ...node.config, [k]: e.target.value } })} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (endpoint) {
    return (
      <div className="ab-inspector">
        <div className="ab-inspector-head">
          <span className="ab-inspector-title">INSPECTOR</span>
          <span className="ab-inspector-context">Endpoint</span>
        </div>
        <div className="ab-inspector-body">
          <div className="ab-inspector-endpoint">
            <span className={`ab-method ab-method-${endpoint.method}`}>{endpoint.method}</span>
            <span className="ab-mono ab-inspector-path">{endpoint.path}</span>
          </div>
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Authentication</div>
            <select className="ab-inspector-select" value={endpoint.authentication} onChange={e => onUpdateEndpoint({ authentication: e.target.value as any })}>
              <option>None</option><option>JWT</option><option>API Key</option><option>OAuth 2.0</option>
            </select>
          </div>
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Rate Limit</div>
            <input className="ab-inspector-input ab-mono" value={endpoint.rateLimit || ''} onChange={e => onUpdateEndpoint({ rateLimit: e.target.value })} placeholder="100 req/min" />
          </div>
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Validation</div>
            <button className={`ab-inspector-toggle ${endpoint.validation ? 'on' : ''}`} onClick={() => onUpdateEndpoint({ validation: !endpoint.validation })}>
              <span className="ab-inspector-toggle-track"><span className="ab-inspector-toggle-thumb" /></span>
              <span>{endpoint.validation ? 'Enabled' : 'Disabled'}</span>
            </button>
          </div>
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Responses</div>
            <div className="ab-inspector-responses">
              {endpoint.responses.map(r => (
                <div key={r.id} className="ab-inspector-response">
                  <span className={`ab-inspector-response-code ${r.status < 400 ? 'ok' : r.status < 500 ? 'warn' : 'err'}`}>{r.status}</span>
                  <span>{r.description}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Description</div>
            <textarea className="ab-inspector-input ab-inspector-textarea" value={endpoint.description || ''} onChange={e => onUpdateEndpoint({ description: e.target.value })} />
          </div>
        </div>
      </div>
    );
  }

  if (model) {
    return (
      <div className="ab-inspector">
        <div className="ab-inspector-head">
          <span className="ab-inspector-title">INSPECTOR</span>
          <span className="ab-inspector-context">Schema</span>
        </div>
        <div className="ab-inspector-body">
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Name</div>
            <input className="ab-inspector-input" value={model.name} onChange={e => onUpdateModel({ ...model, name: e.target.value })} />
          </div>
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Description</div>
            <textarea className="ab-inspector-input ab-inspector-textarea" value={model.description || ''} onChange={e => onUpdateModel({ ...model, description: e.target.value })} />
          </div>
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Fields</div>
            <div className="ab-inspector-fields">
              {model.fields.map(f => (
                <div key={f.id} className="ab-inspector-field">
                  <span className="ab-mono">{f.name}</span>
                  <span className="ab-inspector-field-type">{f.type}</span>
                  {f.required && <span className="ab-inspector-required">required</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (table) {
    return (
      <div className="ab-inspector">
        <div className="ab-inspector-head">
          <span className="ab-inspector-title">INSPECTOR</span>
          <span className="ab-inspector-context">Table</span>
        </div>
        <div className="ab-inspector-body">
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Name</div>
            <input className="ab-inspector-input" value={table.name} onChange={e => onUpdateTable({ ...table, name: e.target.value })} />
          </div>
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Columns</div>
            <div className="ab-inspector-fields">
              {table.columns.map(c => (
                <div key={c.id} className="ab-inspector-field">
                  <span className="ab-mono">{c.name}</span>
                  <span className="ab-inspector-field-type">{c.type}</span>
                  {c.primaryKey && <span className="ab-inspector-required">PK</span>}
                  {c.foreignKey && <span className="ab-inspector-required">FK</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (middleware) {
    return (
      <div className="ab-inspector">
        <div className="ab-inspector-head">
          <span className="ab-inspector-title">INSPECTOR</span>
          <span className="ab-inspector-context">Middleware</span>
        </div>
        <div className="ab-inspector-body">
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Name</div>
            <input className="ab-inspector-input" value={middleware.name} onChange={e => onUpdateMiddleware({ ...middleware, name: e.target.value })} />
          </div>
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Type</div>
            <div className="ab-inspector-value"><span className="ab-inspector-node-type">{middleware.type}</span></div>
          </div>
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Enabled</div>
            <button className={`ab-inspector-toggle ${middleware.enabled ? 'on' : ''}`} onClick={() => onUpdateMiddleware({ ...middleware, enabled: !middleware.enabled })}>
              <span className="ab-inspector-toggle-track"><span className="ab-inspector-toggle-thumb" /></span>
              <span>{middleware.enabled ? 'Enabled' : 'Disabled'}</span>
            </button>
          </div>
          <div className="ab-inspector-section">
            <div className="ab-inspector-label">Config</div>
            <textarea className="ab-inspector-input ab-inspector-textarea" value={middleware.config || ''} onChange={e => onUpdateMiddleware({ ...middleware, config: e.target.value })} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ab-inspector">
      <div className="ab-inspector-head">
        <span className="ab-inspector-title">INSPECTOR</span>
      </div>
      <div className="ab-inspector-empty">
        <MousePointer2 size={20} />
        <span>Select an item to inspect</span>
      </div>
    </div>
  );
};

/* ---------- AI Copilot ---------- */
const AICopilot: React.FC<{
  context: string;
  onAction: (action: string) => void;
  onSend: (message: string) => void;
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>;
  isThinking: boolean;
}> = ({ context, onAction, onSend, messages, isThinking }) => {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isThinking]);

  const suggestions = [
    { label: 'Add authentication', icon: KeyRound },
    { label: 'Create schema', icon: Braces },
    { label: 'Add validation', icon: ShieldCheck },
    { label: 'Generate tests', icon: TestTube2 },
    { label: 'Fix endpoint', icon: Wrench },
  ];

  const send = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="ab-copilot">
      <div className="ab-copilot-head">
        <span className="ab-copilot-title"><Bot size={14} /> AI Copilot</span>
      </div>
      <div className="ab-copilot-context">
        <span className="ab-copilot-context-label">CONTEXT</span>
        <span className="ab-copilot-context-value ab-mono">{context}</span>
      </div>
      <div className="ab-copilot-suggestions">
        <span className="ab-copilot-suggestions-label">SUGGESTIONS</span>
        <div className="ab-copilot-suggestions-grid">
          {suggestions.map(s => {
            const Icon = s.icon;
            return (
              <button key={s.label} className="ab-copilot-suggestion" onClick={() => onAction(s.label)}>
                <Icon size={11} /> <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="ab-copilot-messages">
        {messages.length === 0 && !isThinking && (
          <div className="ab-copilot-empty">
            <Sparkles size={18} />
            <span>Ask the copilot to modify your API</span>
            <small>Actions are applied directly to the project</small>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} className={`ab-copilot-msg ab-copilot-msg-${m.role}`}>
            {m.content}
          </div>
        ))}
        {isThinking && (
          <div className="ab-copilot-msg ab-copilot-msg-assistant ab-copilot-thinking">
            <Loader2 size={12} className="ab-spin" /> Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="ab-copilot-input-wrap">
        <input
          className="ab-copilot-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
          placeholder="Ask AI…"
        />
        <button className="ab-copilot-send" onClick={send} disabled={!input.trim() || isThinking}>
          <ArrowUp size={14} />
        </button>
      </div>
    </div>
  );
};

/* ---------- Documentation View ---------- */
const DocsView: React.FC<{ project: ApiProject; state: ApiBuilderState }> = ({ project, state }) => {
  const activeVersion = project.versions.find(v => v.id === project.activeVersionId);
  const groups = useMemo(() => {
    const map = new Map<string, ApiBuilderEndpoint[]>();
    state.endpoints.forEach(e => {
      if (!map.has(e.group)) map.set(e.group, []);
      map.get(e.group)!.push(e);
    });
    return Array.from(map.entries());
  }, [state.endpoints]);

  return (
    <div className="ab-docs-view">
      <div className="ab-docs-header">
        <h1 className="ab-docs-title">{project.name}</h1>
        <span className="ab-docs-version">{activeVersion?.semver || 'v1.0.0'}</span>
        <p className="ab-docs-desc">{project.description}</p>
      </div>
      <div className="ab-docs-nav">
        <span className="ab-docs-nav-label">ENDPOINTS</span>
        {groups.map(([group, eps]) => (
          <div key={group} className="ab-docs-group">
            <span className="ab-docs-group-name">{group}</span>
            {eps.map(ep => (
              <a key={ep.id} href={`#${ep.method}-${ep.path}`} className="ab-docs-nav-item">
                <span className={`ab-method ab-method-${ep.method}`}>{ep.method}</span>
                <span className="ab-mono">{ep.path}</span>
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="ab-docs-content">
        {groups.map(([group, eps]) => (
          <div key={group} className="ab-docs-section">
            <h2 className="ab-docs-section-title">{group}</h2>
            {eps.map(ep => (
              <div key={ep.id} id={`${ep.method}-${ep.path}`} className="ab-docs-endpoint">
                <div className="ab-docs-endpoint-head">
                  <span className={`ab-method ab-method-${ep.method}`}>{ep.method}</span>
                  <code className="ab-docs-endpoint-path">{ep.path}</code>
                  <span className="ab-docs-endpoint-name">{ep.name}</span>
                </div>
                {ep.description && <p className="ab-docs-endpoint-desc">{ep.description}</p>}
                <div className="ab-docs-endpoint-body">
                  <div className="ab-docs-block">
                    <span className="ab-docs-block-label">REQUEST</span>
                    {ep.parameters.length > 0 && (
                      <div className="ab-docs-params">
                        {ep.parameters.map(p => (
                          <div key={p.id} className="ab-docs-param">
                            <code className="ab-mono">{p.name}</code>
                            <span className="ab-docs-param-type">{p.in} · {p.type}</span>
                            {p.required && <span className="ab-docs-required">required</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {ep.method !== 'GET' && ep.method !== 'DELETE' && (
                      <pre className="ab-docs-code">{ep.requestBody}</pre>
                    )}
                  </div>
                  <div className="ab-docs-block">
                    <span className="ab-docs-block-label">RESPONSES</span>
                    {ep.responses.map(r => (
                      <div key={r.id} className="ab-docs-response">
                        <div className="ab-docs-response-head">
                          <span className={`ab-docs-response-code ${r.status < 400 ? 'ok' : r.status < 500 ? 'warn' : 'err'}`}>{r.status}</span>
                          <span className="ab-docs-response-desc">{r.description}</span>
                          <span className="ab-docs-response-type">{r.contentType}</span>
                        </div>
                        {r.body && <pre className="ab-docs-code">{r.body}</pre>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div className="ab-docs-section">
          <h2 className="ab-docs-section-title">Schemas</h2>
          {state.models.map(m => (
            <div key={m.id} className="ab-docs-schema">
              <h3 className="ab-docs-schema-name">{m.name}</h3>
              {m.description && <p className="ab-docs-endpoint-desc">{m.description}</p>}
              <div className="ab-docs-schema-table">
                {m.fields.map(f => (
                  <div key={f.id} className="ab-docs-schema-row">
                    <code className="ab-mono">{f.name}</code>
                    <span className="ab-docs-param-type">{f.type}</span>
                    {f.required && <span className="ab-docs-required">required</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ---------- Versions View ---------- */
const VersionsView: React.FC<{
  project: ApiProject; state: ApiBuilderState;
  onSelectVersion: (id: string) => void;
  onCreateVersion: () => void;
  onCompare: () => void;
  onRollback: () => void;
}> = ({ project, state, onSelectVersion, onCreateVersion, onCompare, onRollback }) => {
  const active = project.versions.find(v => v.id === project.activeVersionId);

  return (
    <div className="ab-versions-view">
      <div className="ab-versions-header">
        <div className="ab-versions-title"><GitBranch size={14} /> Versions</div>
        <button className="ab-schema-btn" onClick={onCreateVersion}><Plus size={12} /> Create Version</button>
      </div>
      <div className="ab-versions-list">
        {project.versions.map(v => (
          <div key={v.id} className={`ab-version-card ${project.activeVersionId === v.id ? 'active' : ''}`} onClick={() => onSelectVersion(v.id)}>
            <div className="ab-version-card-head">
              <span className="ab-version-semver ab-mono">{v.semver}</span>
              <span className={`ab-version-status ${v.status}`}>{v.status}</span>
              {project.activeVersionId === v.id && <span className="ab-version-current">Current</span>}
            </div>
            <p className="ab-version-notes">{v.notes}</p>
            <div className="ab-version-meta">
              <span>{v.immutable ? 'Immutable' : 'Editable'}</span>
              <span>{new Date(project.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
      {active && (
        <div className="ab-version-detail">
          <div className="ab-version-detail-head">
            <span className="ab-version-semver ab-mono">{active.semver}</span>
            <span className={`ab-version-status ${active.status}`}>{active.status}</span>
          </div>
          <div className="ab-version-detail-label">CHANGES</div>
          <div className="ab-version-changes">
            {(state.versionChanges || []).map(c => (
              <div key={c.id} className={`ab-version-change ab-version-change-${c.type}`}>
                <span className="ab-version-change-icon">
                  {c.type === 'added' ? <PlusCircle size={11} /> : c.type === 'updated' ? <MinusCircle size={11} /> : <XCircle size={11} />}
                </span>
                <span className="ab-version-change-desc">{c.description}</span>
                <span className="ab-version-change-time">{new Date(c.timestamp).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
          <div className="ab-version-actions">
            <button className="ab-schema-btn" onClick={onCompare}><GitCompare size={12} /> Compare</button>
            <button className="ab-schema-btn ab-schema-btn-danger" onClick={onRollback}><RotateCcw size={12} /> Rollback</button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------- Publish Modal ---------- */
const PublishModal: React.FC<{
  state: ApiBuilderState; project: ApiProject;
  onClose: () => void; onPublish: (publish: NonNullable<ApiBuilderState['publish']>) => void;
}> = ({ state, project, onClose, onPublish }) => {
  const [visibility, setVisibility] = useState(state.publish?.visibility || 'Marketplace');
  const [license, setLicense] = useState(state.publish?.license || 'MIT');
  const [pricing, setPricing] = useState(state.publish?.pricing || 'Free');
  const [price, setPrice] = useState('0');
  const [step, setStep] = useState(0);

  const activeVersion = project.versions.find(v => v.id === project.activeVersionId);

  const checks = [
    { label: 'Documentation', ok: true },
    { label: 'OpenAPI Specification', ok: true },
    { label: 'Tests', ok: state.endpoints.some(e => e.tests.length > 0) },
    { label: 'Schemas', ok: state.models.length > 0 },
    { label: 'Endpoints', ok: state.endpoints.length > 0 },
  ];

  const allPass = checks.every(c => c.ok);

  return (
    <div className="ab-modal-overlay" onClick={onClose}>
      <div className="ab-modal ab-publish-modal" onClick={e => e.stopPropagation()}>
        <div className="ab-modal-head">
          <span className="ab-modal-title"><Rocket size={15} /> Publish API</span>
          <button className="ab-modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="ab-publish-steps">
          <div className={`ab-publish-step ${step === 0 ? 'active' : step > 0 ? 'done' : ''}`}>
            <span>{step > 0 ? <Check size={10} /> : '1'}</span> Details
          </div>
          <div className={`ab-publish-step ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}>
            <span>{step > 1 ? <Check size={10} /> : '2'}</span> Validation
          </div>
          <div className={`ab-publish-step ${step === 2 ? 'active' : ''}`}>
            <span>3</span> Confirm
          </div>
        </div>
        {step === 0 && (
          <div className="ab-publish-body">
            <div className="ab-publish-field">
              <span className="ab-publish-label">Visibility</span>
              <div className="ab-publish-options">
                {(['Private', 'Public/Open Source', 'Marketplace'] as const).map(v => (
                  <button key={v} className={`ab-publish-option ${visibility === v ? 'active' : ''}`} onClick={() => setVisibility(v)}>
                    {v === 'Private' ? <Lock size={13} /> : v === 'Public/Open Source' ? <Globe size={13} /> : <Rocket size={13} />}
                    <span>{v}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="ab-publish-field">
              <span className="ab-publish-label">Version</span>
              <div className="ab-publish-version ab-mono">{activeVersion?.semver || 'v1.0.0'}</div>
            </div>
            <div className="ab-publish-field">
              <span className="ab-publish-label">Pricing</span>
              <div className="ab-publish-options">
                {(['Free', 'Paid'] as const).map(p => (
                  <button key={p} className={`ab-publish-option ${pricing === p ? 'active' : ''}`} onClick={() => setPricing(p)}>
                    <span>{p}</span>
                  </button>
                ))}
              </div>
            </div>
            {pricing === 'Paid' && (
              <div className="ab-publish-field">
                <span className="ab-publish-label">Price (USD)</span>
                <input className="ab-publish-input ab-mono" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
            )}
            <div className="ab-publish-field">
              <span className="ab-publish-label">License</span>
              <select className="ab-publish-input" value={license} onChange={e => setLicense(e.target.value)}>
                <option>MIT</option><option>Apache 2.0</option><option>GPL 3.0</option><option>BSD 3-Clause</option><option>Proprietary</option>
              </select>
            </div>
          </div>
        )}
        {step === 1 && (
          <div className="ab-publish-body">
            <div className="ab-publish-validation">
              <span className="ab-publish-validation-title">VALIDATION SUMMARY</span>
              {checks.map(c => (
                <div key={c.label} className={`ab-publish-check ${c.ok ? 'ok' : 'fail'}`}>
                  {c.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                  <span>{c.label}</span>
                  <span className="ab-publish-check-status">{c.ok ? 'Ready' : 'Missing'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="ab-publish-body">
            <div className="ab-publish-confirm">
              <CheckCircle2 size={28} className="ab-publish-confirm-icon" />
              <h3>Ready to publish</h3>
              <p>Your API will be published as <strong>{visibility}</strong> with <strong>{license}</strong> license.</p>
              <div className="ab-publish-summary">
                <div><span>Endpoints</span><strong>{state.endpoints.length}</strong></div>
                <div><span>Schemas</span><strong>{state.models.length}</strong></div>
                <div><span>Version</span><strong className="ab-mono">{activeVersion?.semver}</strong></div>
              </div>
            </div>
          </div>
        )}
        <div className="ab-modal-actions">
          {step > 0 && <button className="ab-schema-btn" onClick={() => setStep(s => s - 1)}><ArrowLeft size={12} /> Back</button>}
          {step < 2 ? (
            <button className="ab-publish-next" onClick={() => setStep(s => s + 1)} disabled={step === 1 && !allPass}>
              Next <ArrowRight size={12} />
            </button>
          ) : (
            <button className="ab-publish-next" onClick={() => onPublish({ visibility, license, pricing, status: 'published' })}>
              <Rocket size={13} /> Publish API
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ---------- Import Modal ---------- */
const ImportModal: React.FC<{ onClose: () => void; onImport: (source: string, format: string) => void }> = ({ onClose, onImport }) => {
  const [mode, setMode] = useState<'file' | 'url' | 'paste'>('file');
  const [source, setSource] = useState('');
  const [format, setFormat] = useState('OpenAPI');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setSource(String(reader.result || ''));
    reader.readAsText(file);
  };

  return (
    <div className="ab-modal-overlay" onClick={onClose}>
      <div className="ab-modal ab-import-modal" onClick={e => e.stopPropagation()}>
        <div className="ab-modal-head">
          <span className="ab-modal-title"><Upload size={15} /> Import API</span>
          <button className="ab-modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        <div className="ab-import-tabs">
          <button className={mode === 'file' ? 'active' : ''} onClick={() => setMode('file')}><FileUp size={13} /> File</button>
          <button className={mode === 'url' ? 'active' : ''} onClick={() => setMode('url')}><Globe2 size={13} /> URL</button>
          <button className={mode === 'paste' ? 'active' : ''} onClick={() => setMode('paste')}><Braces size={13} /> Paste</button>
        </div>
        {mode === 'file' && (
          <div
            className={`ab-import-dropzone ${dragging ? 'dragging' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          >
            <Upload size={24} />
            <strong>Drop OpenAPI / Swagger file</strong>
            <span>or click to browse</span>
            <input ref={fileRef} type="file" accept=".json,.yaml,.yml" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}
        {mode === 'url' && (
          <div className="ab-import-field">
            <span className="ab-publish-label">OpenAPI URL</span>
            <input className="ab-publish-input ab-mono" value={source} onChange={e => setSource(e.target.value)} placeholder="https://api.example.com/openapi.json" />
          </div>
        )}
        {mode === 'paste' && (
          <div className="ab-import-field">
            <span className="ab-publish-label">OpenAPI / Swagger JSON or YAML</span>
            <textarea className="ab-import-textarea ab-mono" value={source} onChange={e => setSource(e.target.value)} placeholder={'openapi: 3.0.3\ninfo:\n  title: My API'} />
          </div>
        )}
        <div className="ab-import-format">
          <span className="ab-publish-label">Import from</span>
          <div className="ab-import-format-options">
            {['OpenAPI', 'Swagger', 'Postman', 'JSON'].map(f => (
              <button key={f} className={`ab-import-format-option ${format === f ? 'active' : ''}`} onClick={() => setFormat(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div className="ab-modal-actions">
          <button className="ab-schema-btn" onClick={onClose}>Cancel</button>
          <button className="ab-publish-next" onClick={() => onImport(source, format)} disabled={!source.trim()}>
            <Upload size={13} /> Import API
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================
   MAIN API BUILDER COMPONENT
   ========================================================= */

export const ApiBuilder: React.FC<{ project: ApiProject; onBack: () => void; onChange: (project: ApiProject) => void }> = ({ project, onBack, onChange }) => {
  const [state, setState] = useState<ApiBuilderState>(() => project.builder || defaultState());
  const [view, setView] = useState<BuilderView>(project.builder?.view || 'design');
  const [rightPanel, setRightPanel] = useState<'inspector' | 'copilot'>('inspector');
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving'>('saved');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ endpoints: true, schemas: true, database: true, middleware: true });
  const [search, setSearch] = useState('');
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [notice, setNotice] = useState('');
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [aiMessages, setAiMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [activeCodeFile, setActiveCodeFile] = useState('index.ts');
  const [env, setEnv] = useState('development');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const leftResize = useResizable(260, 180, 400, 'left');
  const rightResize = useResizable(300, 220, 420, 'right');

  const selected = state.endpoints.find(e => e.id === state.selectedEndpointId) || state.endpoints[0];
  const selectedModel = state.models.find(m => m.id === state.selectedModelId) || state.models[0];
  const selectedTable = state.database.find(t => t.id === state.selectedTableId) || state.database[0];
  const selectedNode = selected ? state.flowNodes?.find(n => n.id === state.selectedNodeId) : undefined;
  const selectedMiddleware = state.middleware.find(m => m.id === state.selectedMiddlewareId) || state.middleware[0];

  const noticeTimer = useRef<ReturnType<typeof setTimeout>>();

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 3000);
  };

  const persist = useCallback((next: ApiBuilderState) => {
    setState(next);
    setSaveState('dirty');
    const definition = openApi(project, next);
    const versions = project.versions.map(v => v.id === project.activeVersionId ? { ...v, definition } : v);
    onChange({ ...project, lifecycle: 'build', versions, builder: { ...next, view } });
  }, [project, onChange, view]);

  const save = useCallback(() => {
    setSaveState('saving');
    setTimeout(() => {
      setSaveState('saved');
      showNotice('Project saved');
    }, 600);
  }, []);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runTest();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  });

  const updateEndpoint = (patch: Partial<ApiBuilderEndpoint>) => {
    if (!selected) return;
    persist({ ...state, endpoints: state.endpoints.map(e => e.id === selected.id ? { ...e, ...patch } : e) });
  };

  const addEndpoint = () => {
    const ep = defaultEndpoint('GET', '/new-endpoint', 'New endpoint');
    ep.group = 'Endpoints';
    persist({ ...state, endpoints: [...state.endpoints, ep], selectedEndpointId: ep.id });
    showNotice('Endpoint created');
  };

  const addModel = () => {
    const m: ApiBuilderModel = { id: id(), name: 'NewSchema', fields: [], description: '' };
    persist({ ...state, models: [...state.models, m], selectedModelId: m.id });
    showNotice('Schema created');
  };

  const addTable = () => {
    const t: DatabaseTable = { id: id(), name: 'new_table', columns: [], relationships: [] };
    persist({ ...state, database: [...state.database, t], selectedTableId: t.id });
    showNotice('Table created');
  };

  const addMiddleware = () => {
    const mw: MiddlewareItem = { id: id(), name: 'newMiddleware', type: 'custom', enabled: true, config: '' };
    persist({ ...state, middleware: [...state.middleware, mw] });
    showNotice('Middleware created');
  };

  const runTest = () => {
    if (!selected) return;
    setIsRunningTest(true);
    setTimeout(() => {
      const test: ApiTest = {
        id: id(),
        name: `Run ${new Date().toLocaleTimeString()}`,
        status: 200,
        latency: Math.floor(40 + Math.random() * 120),
        result: selected.responseBody || '{}',
        assertions: [
          { id: id(), expression: 'response.status === 200', passed: true },
          { id: id(), expression: 'response.body.id is defined', passed: true },
        ],
        createdAt: new Date().toISOString(),
      };
      updateEndpoint({ tests: [test, ...selected.tests] });
      setIsRunningTest(false);
      showNotice(`200 OK · ${test.latency} ms`);
    }, 800);
  };

  const executeCopilot = (action: string) => {
    if (!selected) return;
    setIsAiThinking(true);
    const msgId = id();
    setAiMessages(prev => [...prev, { id: msgId, role: 'user', content: action }]);

    setTimeout(() => {
      const text = action.toLowerCase();
      let response = '';
      let applied = false;

      if (/auth/.test(text)) {
        updateEndpoint({ authentication: 'JWT' });
        response = 'Added JWT authentication to this endpoint.';
        applied = true;
      } else if (/schema/.test(text)) {
        const m: ApiBuilderModel = { id: id(), name: 'NewSchema', fields: [], description: 'Created by AI' };
        persist({ ...state, models: [...state.models, m], selectedModelId: m.id });
        response = 'Created a new schema.';
        applied = true;
      } else if (/valid/.test(text)) {
        updateEndpoint({ validation: true });
        response = 'Enabled request validation for this endpoint.';
        applied = true;
      } else if (/test/.test(text)) {
        runTest();
        response = 'Generated and ran a test for this endpoint.';
        applied = true;
      } else if (/fix/.test(text)) {
        updateEndpoint({ description: 'Fixed by AI copilot' });
        response = 'Applied fixes to this endpoint.';
        applied = true;
      } else if (/create.*post.*\/users|create.*user/.test(text)) {
        const ep = defaultEndpoint('POST', '/users', 'Create user');
        persist({ ...state, endpoints: [...state.endpoints, ep], selectedEndpointId: ep.id });
        response = 'Created POST /users endpoint with validation, database, and response flow.';
        applied = true;
      } else {
        response = 'I can apply actions like "Add authentication", "Create schema", "Add validation", "Generate tests", or "Fix endpoint".';
      }

      setAiMessages(prev => [...prev, { id: id(), role: 'assistant', content: response }]);
      setIsAiThinking(false);
      if (applied) showNotice('AI action applied');
    }, 600);
  };

  const handleRename = (kind: string, itemId: string, name: string) => {
    if (kind === 'endpoint') {
      persist({ ...state, endpoints: state.endpoints.map(e => e.id === itemId ? { ...e, name } : e) });
    } else if (kind === 'model') {
      persist({ ...state, models: state.models.map(m => m.id === itemId ? { ...m, name } : m) });
    } else if (kind === 'table') {
      persist({ ...state, database: state.database.map(t => t.id === itemId ? { ...t, name } : t) });
    } else if (kind === 'middleware') {
      persist({ ...state, middleware: state.middleware.map(m => m.id === itemId ? { ...m, name } : m) });
    }
    showNotice('Renamed');
  };

  const handleDelete = (kind: string, itemId: string) => {
    if (kind === 'endpoint') {
      persist({ ...state, endpoints: state.endpoints.filter(e => e.id !== itemId) });
    } else if (kind === 'model') {
      persist({ ...state, models: state.models.filter(m => m.id !== itemId) });
    } else if (kind === 'table') {
      persist({ ...state, database: state.database.filter(t => t.id !== itemId) });
    } else if (kind === 'middleware') {
      persist({ ...state, middleware: state.middleware.filter(m => m.id !== itemId) });
    }
    showNotice('Deleted');
  };

  const handleDuplicate = (kind: string, itemId: string) => {
    if (kind === 'endpoint') {
      const ep = state.endpoints.find(e => e.id === itemId);
      if (!ep) return;
      const copy = { ...ep, id: id(), name: `${ep.name} (copy)`, path: `${ep.path}-copy` };
      persist({ ...state, endpoints: [...state.endpoints, copy] });
    } else if (kind === 'model') {
      const m = state.models.find(m => m.id === itemId);
      if (!m) return;
      persist({ ...state, models: [...state.models, { ...m, id: id(), name: `${m.name}Copy` }] });
    } else if (kind === 'table') {
      const t = state.database.find(t => t.id === itemId);
      if (!t) return;
      persist({ ...state, database: [...state.database, { ...t, id: id(), name: `${t.name}_copy` }] });
    }
    showNotice('Duplicated');
  };

  const handleMove = (kind: string, itemId: string) => {
    showNotice('Move is available via drag & drop');
  };

  const handlePin = (kind: string, itemId: string) => {
    if (kind === 'middleware') {
      persist({ ...state, middleware: state.middleware.map(m => m.id === itemId ? { ...m, enabled: !m.enabled } : m) });
    } else {
      const pinned = state.pinnedIds || [];
      const next = pinned.includes(itemId) ? pinned.filter(p => p !== itemId) : [...pinned, itemId];
      persist({ ...state, pinnedIds: next });
    }
  };

  const addFlowNode = (type: FlowNodeType) => {
    if (!selected) return;
    const node: FlowNode = {
      id: id(), type, label: type, description: `${type} step`,
      status: 'idle', inputs: ['next'], outputs: ['next'],
    };
    const last = selected.flow[selected.flow.length - 1];
    const edges = [...selected.edges];
    if (last) edges.push({ id: id(), from: last.id, to: node.id, label: 'next' });
    persist({ ...state, endpoints: state.endpoints.map(e => e.id === selected.id ? { ...e, flow: [...e.flow, node], edges } : e) });
    showNotice(`${type} step added`);
  };

  const updateFlowNode = (node: FlowNode) => {
    if (!selected) return;
    persist({ ...state, endpoints: state.endpoints.map(e => e.id === selected.id ? { ...e, flow: e.flow.map(n => n.id === node.id ? node : n) } : e) });
  };

  const deleteFlowNode = (nodeId: string) => {
    if (!selected) return;
    persist({
      ...state,
      endpoints: state.endpoints.map(e => e.id === selected.id ? {
        ...e,
        flow: e.flow.filter(n => n.id !== nodeId),
        edges: e.edges.filter(ed => ed.from !== nodeId && ed.to !== nodeId),
      } : e),
    });
  };

  const updateEdge = (from: string, to: string, label: string) => {
    if (!selected) return;
    persist({
      ...state,
      endpoints: state.endpoints.map(e => e.id === selected.id ? {
        ...e,
        edges: e.edges.map(ed => ed.from === from && ed.to === to ? { ...ed, label } : ed),
      } : e),
    });
  };

  const addVersion = () => {
    const current = project.versions.find(v => v.id === project.activeVersionId)!;
    const parts = current.semver.replace('v', '').split('.').map(Number);
    parts[2]++;
    const version = { ...current, id: id(), semver: `v${parts.join('.')}`, notes: state.changelog || 'Builder changes', status: 'draft' as const, immutable: false };
    onChange({ ...project, activeVersionId: version.id, versions: [...project.versions, version], builder: state });
    showNotice(`${version.semver} draft created`);
  };

  const handlePublish = (publish: NonNullable<ApiBuilderState['publish']>) => {
    persist({ ...state, publish });
    setIsPublishOpen(false);
    showNotice('API published successfully');
  };

  const handleImport = (source: string, format: string) => {
    try {
      const doc = JSON.parse(source);
      const endpoints = Object.entries(doc.paths || {}).flatMap(([path, methods]: any) =>
        Object.entries(methods).map(([method, def]: any) => {
          const ep = defaultEndpoint(method.toUpperCase() as HttpMethod, path, def.summary || `${method} ${path}`);
          ep.group = 'Imported';
          ep.description = def.description || '';
          ep.authentication = def.security?.length ? 'JWT' : 'None';
          return ep;
        })
      );
      if (endpoints.length > 0) {
        persist({ ...state, endpoints: endpoints as ApiBuilderEndpoint[] });
        setIsImportOpen(false);
        showNotice(`Imported ${endpoints.length} endpoints from ${format}`);
      } else {
        showNotice('No endpoints found in the imported definition');
      }
    } catch {
      showNotice('Invalid JSON. Please provide a valid OpenAPI definition.');
    }
  };

  const codeFiles = useMemo(() => {
    if (!selected) return [];
    return [
      { name: 'index.ts', content: selected.code, generated: false },
      { name: 'controller.ts', content: `import { handler } from './index';\n\nexport const controller = {\n  ${selected.method.toLowerCase()}: handler,\n};`, generated: true },
      { name: 'service.ts', content: `export class UserService {\n  async create(data: any) {\n    // Implementation\n    return data;\n  }\n}`, generated: true },
    ];
  }, [selected]);

  const handleCodeChange = (name: string, content: string) => {
    if (name === 'index.ts' && selected) {
      updateEndpoint({ code: content });
    }
  };

  const contextLabel = useMemo(() => {
    if (selected) return `${selected.method} ${selected.path}`;
    if (selectedModel) return `Schema: ${selectedModel.name}`;
    if (selectedTable) return `Table: ${selectedTable.name}`;
    return 'API Project';
  }, [selected, selectedModel, selectedTable]);

  const renderMainContent = () => {
    if (view === 'design' && selected) {
      return (
        <div className="ab-editor">
          <div className="ab-editor-header">
            <div className="ab-editor-endpoint">
              <span className={`ab-method ab-method-${selected.method}`}>{selected.method}</span>
              <input
                className="ab-editor-path ab-mono"
                value={selected.path}
                onChange={e => updateEndpoint({ path: e.target.value })}
                spellCheck={false}
              />
            </div>
            <div className="ab-editor-tabs">
              {(['design', 'code', 'openapi', 'test', 'docs', 'versions'] as BuilderView[]).map(t => (
                <button key={t} className={`ab-editor-tab ${view === t ? 'active' : ''}`} onClick={() => { setView(t); persist({ ...state, view: t }); }}>
                  {t === 'design' ? <Workflow size={12} /> : t === 'code' ? <Code2 size={12} /> : t === 'openapi' ? <FileJson size={12} /> : t === 'test' ? <TestTube2 size={12} /> : t === 'docs' ? <BookOpen size={12} /> : <GitBranch size={12} />}
                  <span>{t === 'design' ? 'Design' : t === 'code' ? 'Code' : t === 'openapi' ? 'OpenAPI' : t === 'test' ? 'Test' : t === 'docs' ? 'Docs' : 'Versions'}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="ab-editor-meta">
            <div className="ab-editor-meta-item">
              <span className="ab-editor-meta-label">METHOD</span>
              <select className="ab-editor-method-select" value={selected.method} onChange={e => updateEndpoint({ method: e.target.value as HttpMethod })}>
                <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option>
              </select>
            </div>
            <div className="ab-editor-meta-item">
              <span className="ab-editor-meta-label">PATH</span>
              <input className="ab-editor-meta-path ab-mono" value={selected.path} onChange={e => updateEndpoint({ path: e.target.value })} />
            </div>
            <div className="ab-editor-meta-item">
              <span className="ab-editor-meta-label">AUTH</span>
              <select className="ab-editor-meta-select" value={selected.authentication} onChange={e => updateEndpoint({ authentication: e.target.value as any })}>
                <option>None</option><option>JWT</option><option>API Key</option><option>OAuth 2.0</option>
              </select>
            </div>
            <div className="ab-editor-meta-item">
              <span className="ab-editor-meta-label">RATE LIMIT</span>
              <input className="ab-editor-meta-input ab-mono" value={selected.rateLimit || ''} onChange={e => updateEndpoint({ rateLimit: e.target.value })} />
            </div>
          </div>
          <div className="ab-editor-sections">
            <div className="ab-editor-section">
              <div className="ab-editor-section-head">
                <ChevronDown size={12} />
                <span className="ab-editor-section-title">Request</span>
                <span className="ab-editor-section-count">{selected.parameters.length + selected.headers.length}</span>
              </div>
              <div className="ab-editor-section-body">
                <div className="ab-editor-subtabs">
                  <button className="active">Parameters</button>
                  <button>Headers</button>
                  <button>Authentication</button>
                  <button>Body</button>
                </div>
                <div className="ab-editor-subcontent">
                  <div className="ab-editor-kv">
                    {selected.parameters.map(p => (
                      <div key={p.id} className="ab-editor-kv-row">
                        <span className="ab-editor-kv-in">{p.in}</span>
                        <input className="ab-mono" value={p.name} onChange={e => updateEndpoint({ parameters: selected.parameters.map(x => x.id === p.id ? { ...x, name: e.target.value } : x) })} />
                        <select value={p.type} onChange={e => updateEndpoint({ parameters: selected.parameters.map(x => x.id === p.id ? { ...x, type: e.target.value } : x) })}>
                          <option>string</option><option>integer</option><option>boolean</option>
                        </select>
                        <button className={`ab-editor-required ${p.required ? 'on' : ''}`} onClick={() => updateEndpoint({ parameters: selected.parameters.map(x => x.id === p.id ? { ...x, required: !x.required } : x) })}>
                          {p.required ? 'required' : 'optional'}
                        </button>
                      </div>
                    ))}
                    {selected.parameters.length === 0 && <span className="ab-editor-empty">No parameters</span>}
                    <button className="ab-editor-add-row" onClick={() => updateEndpoint({ parameters: [...selected.parameters, { id: id(), name: '', in: 'query', type: 'string', required: false }] })}>
                      <Plus size={11} /> Add Parameter
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="ab-editor-section">
              <div className="ab-editor-section-head">
                <ChevronDown size={12} />
                <span className="ab-editor-section-title">Response</span>
                <span className="ab-editor-section-count">{selected.responses.length}</span>
              </div>
              <div className="ab-editor-section-body">
                <div className="ab-editor-responses">
                  {selected.responses.map(r => (
                    <div key={r.id} className="ab-editor-response">
                      <div className="ab-editor-response-head">
                        <span className={`ab-editor-response-code ${r.status < 400 ? 'ok' : r.status < 500 ? 'warn' : 'err'}`}>{r.status}</span>
                        <input value={r.description} onChange={e => updateEndpoint({ responses: selected.responses.map(x => x.id === r.id ? { ...x, description: e.target.value } : x) })} />
                        <button className="ab-editor-response-delete" onClick={() => updateEndpoint({ responses: selected.responses.filter(x => x.id !== r.id) })}><Trash2 size={11} /></button>
                      </div>
                      <textarea className="ab-editor-response-body ab-mono" value={r.body} onChange={e => updateEndpoint({ responses: selected.responses.map(x => x.id === r.id ? { ...x, body: e.target.value } : x) })} />
                    </div>
                  ))}
                  <button className="ab-editor-add-row" onClick={() => updateEndpoint({ responses: [...selected.responses, { id: id(), status: 200, description: 'OK', contentType: 'application/json', body: '{}' }] })}>
                    <Plus size={11} /> Add Response
                  </button>
                </div>
              </div>
            </div>
            <div className="ab-editor-section">
              <div className="ab-editor-section-head">
                <ChevronDown size={12} />
                <span className="ab-editor-section-title">Logic</span>
                <span className="ab-editor-section-count">{selected.flow.length} steps</span>
              </div>
              <div className="ab-editor-section-body">
                <VisualFlowEditor
                  endpoint={selected}
                  selectedNodeId={state.selectedNodeId}
                  onSelectNode={nodeId => persist({ ...state, selectedNodeId: nodeId })}
                  onUpdateNode={updateFlowNode}
                  onDeleteNode={deleteFlowNode}
                  onAddNode={addFlowNode}
                  onUpdateEdge={updateEdge}
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (view === 'code') {
      return (
        <div className="ab-editor">
          <div className="ab-editor-header">
            <div className="ab-editor-endpoint">
              <span className={`ab-method ab-method-${selected?.method || 'GET'}`}>{selected?.method || 'GET'}</span>
              <span className="ab-mono ab-editor-path">{selected?.path || '/users'}</span>
            </div>
            <div className="ab-editor-tabs">
              {(['design', 'code', 'openapi', 'test', 'docs', 'versions'] as BuilderView[]).map(t => (
                <button key={t} className={`ab-editor-tab ${view === t ? 'active' : ''}`} onClick={() => { setView(t); persist({ ...state, view: t }); }}>
                  {t === 'design' ? <Workflow size={12} /> : t === 'code' ? <Code2 size={12} /> : t === 'openapi' ? <FileJson size={12} /> : t === 'test' ? <TestTube2 size={12} /> : t === 'docs' ? <BookOpen size={12} /> : <GitBranch size={12} />}
                  <span>{t === 'design' ? 'Design' : t === 'code' ? 'Code' : t === 'openapi' ? 'OpenAPI' : t === 'test' ? 'Test' : t === 'docs' ? 'Docs' : 'Versions'}</span>
                </button>
              ))}
            </div>
          </div>
          <CodeEditor
            files={codeFiles}
            activeFile={activeCodeFile}
            onFileChange={setActiveCodeFile}
            onContentChange={handleCodeChange}
            onFormat={() => showNotice('Code formatted')}
            onCopy={() => showNotice('Code copied')}
            onSearch={() => showNotice('Search')}
          />
        </div>
      );
    }

    if (view === 'openapi') {
      return (
        <div className="ab-editor">
          <div className="ab-editor-header">
            <div className="ab-editor-endpoint">
              <FileJson size={14} className="ab-icon-schema" />
              <span className="ab-editor-path">OpenAPI Specification</span>
            </div>
            <div className="ab-editor-tabs">
              {(['design', 'code', 'openapi', 'test', 'docs', 'versions'] as BuilderView[]).map(t => (
                <button key={t} className={`ab-editor-tab ${view === t ? 'active' : ''}`} onClick={() => { setView(t); persist({ ...state, view: t }); }}>
                  {t === 'design' ? <Workflow size={12} /> : t === 'code' ? <Code2 size={12} /> : t === 'openapi' ? <FileJson size={12} /> : t === 'test' ? <TestTube2 size={12} /> : t === 'docs' ? <BookOpen size={12} /> : <GitBranch size={12} />}
                  <span>{t === 'design' ? 'Design' : t === 'code' ? 'Code' : t === 'openapi' ? 'OpenAPI' : t === 'test' ? 'Test' : t === 'docs' ? 'Docs' : 'Versions'}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="ab-openapi-view">
            <div className="ab-openapi-toolbar">
              <span className="ab-openapi-title"><FileJson size={13} /> Generated from project</span>
              <div className="ab-openapi-actions">
                <button onClick={() => showNotice('Copied to clipboard')}><Copy size={12} /> Copy</button>
                <button onClick={() => showNotice('Downloaded')}><Download size={12} /> Download</button>
              </div>
            </div>
            <pre className="ab-openapi-code">{openApi(project, state)}</pre>
          </div>
        </div>
      );
    }

    if (view === 'test' && selected) {
      return (
        <div className="ab-editor">
          <div className="ab-editor-header">
            <div className="ab-editor-endpoint">
              <span className={`ab-method ab-method-${selected.method}`}>{selected.method}</span>
              <span className="ab-mono ab-editor-path">{selected.path}</span>
            </div>
            <div className="ab-editor-tabs">
              {(['design', 'code', 'openapi', 'test', 'docs', 'versions'] as BuilderView[]).map(t => (
                <button key={t} className={`ab-editor-tab ${view === t ? 'active' : ''}`} onClick={() => { setView(t); persist({ ...state, view: t }); }}>
                  {t === 'design' ? <Workflow size={12} /> : t === 'code' ? <Code2 size={12} /> : t === 'openapi' ? <FileJson size={12} /> : t === 'test' ? <TestTube2 size={12} /> : t === 'docs' ? <BookOpen size={12} /> : <GitBranch size={12} />}
                  <span>{t === 'design' ? 'Design' : t === 'code' ? 'Code' : t === 'openapi' ? 'OpenAPI' : t === 'test' ? 'Test' : t === 'docs' ? 'Docs' : 'Versions'}</span>
                </button>
              ))}
            </div>
          </div>
          <TestWorkspace endpoint={selected} onUpdate={updateEndpoint} onRunTest={runTest} isRunning={isRunningTest} />
        </div>
      );
    }

    if (view === 'docs') {
      return (
        <div className="ab-editor">
          <div className="ab-editor-header">
            <div className="ab-editor-endpoint">
              <BookOpen size={14} className="ab-icon-docs" />
              <span className="ab-editor-path">Documentation</span>
            </div>
            <div className="ab-editor-tabs">
              {(['design', 'code', 'openapi', 'test', 'docs', 'versions'] as BuilderView[]).map(t => (
                <button key={t} className={`ab-editor-tab ${view === t ? 'active' : ''}`} onClick={() => { setView(t); persist({ ...state, view: t }); }}>
                  {t === 'design' ? <Workflow size={12} /> : t === 'code' ? <Code2 size={12} /> : t === 'openapi' ? <FileJson size={12} /> : t === 'test' ? <TestTube2 size={12} /> : t === 'docs' ? <BookOpen size={12} /> : <GitBranch size={12} />}
                  <span>{t === 'design' ? 'Design' : t === 'code' ? 'Code' : t === 'openapi' ? 'OpenAPI' : t === 'test' ? 'Test' : t === 'docs' ? 'Docs' : 'Versions'}</span>
                </button>
              ))}
            </div>
          </div>
          <DocsView project={project} state={state} />
        </div>
      );
    }

    if (view === 'versions') {
      return (
        <div className="ab-editor">
          <div className="ab-editor-header">
            <div className="ab-editor-endpoint">
              <GitBranch size={14} className="ab-icon-versions" />
              <span className="ab-editor-path">Versions</span>
            </div>
            <div className="ab-editor-tabs">
              {(['design', 'code', 'openapi', 'test', 'docs', 'versions'] as BuilderView[]).map(t => (
                <button key={t} className={`ab-editor-tab ${view === t ? 'active' : ''}`} onClick={() => { setView(t); persist({ ...state, view: t }); }}>
                  {t === 'design' ? <Workflow size={12} /> : t === 'code' ? <Code2 size={12} /> : t === 'openapi' ? <FileJson size={12} /> : t === 'test' ? <TestTube2 size={12} /> : t === 'docs' ? <BookOpen size={12} /> : <GitBranch size={12} />}
                  <span>{t === 'design' ? 'Design' : t === 'code' ? 'Code' : t === 'openapi' ? 'OpenAPI' : t === 'test' ? 'Test' : t === 'docs' ? 'Docs' : 'Versions'}</span>
                </button>
              ))}
            </div>
          </div>
          <VersionsView
            project={project}
            state={state}
            onSelectVersion={v => { onChange({ ...project, activeVersionId: v, builder: state }); showNotice('Version selected'); }}
            onCreateVersion={addVersion}
            onCompare={() => showNotice('Compare versions')}
            onRollback={() => showNotice('Rolled back to previous version')}
          />
        </div>
      );
    }

    // Schema designer when a model is selected
    if (selectedModel) {
      return (
        <div className="ab-editor">
          <div className="ab-editor-header">
            <div className="ab-editor-endpoint">
              <Braces size={14} className="ab-icon-schema" />
              <span className="ab-editor-path">Schema Designer</span>
            </div>
          </div>
          <SchemaDesigner
            model={selectedModel}
            onUpdate={m => persist({ ...state, models: state.models.map(x => x.id === m.id ? m : x) })}
            onAddField={() => persist({ ...state, models: state.models.map(x => x.id === selectedModel.id ? { ...x, fields: [...x.fields, { id: id(), name: 'newField', type: 'string', required: false }] } : x) })}
            onDeleteField={fieldId => persist({ ...state, models: state.models.map(x => x.id === selectedModel.id ? { ...x, fields: x.fields.filter(f => f.id !== fieldId) } : x) })}
          />
        </div>
      );
    }

    // Database view when a table is selected
    if (selectedTable) {
      return (
        <div className="ab-editor">
          <div className="ab-editor-header">
            <div className="ab-editor-endpoint">
              <Database size={14} className="ab-icon-db" />
              <span className="ab-editor-path">Database</span>
            </div>
          </div>
          <DatabaseView
            tables={state.database}
            selectedTableId={selectedTable.id}
            onSelectTable={tableId => persist({ ...state, selectedTableId: tableId })}
            onUpdateTable={t => persist({ ...state, database: state.database.map(x => x.id === t.id ? t : x) })}
            onAddColumn={tableId => persist({ ...state, database: state.database.map(x => x.id === tableId ? { ...x, columns: [...x.columns, { id: id(), name: 'new_column', type: 'varchar', nullable: true }] } : x) })}
            onDeleteColumn={(tableId, colId) => persist({ ...state, database: state.database.map(x => x.id === tableId ? { ...x, columns: x.columns.filter(c => c.id !== colId) } : x) })}
            onAddTable={addTable}
          />
        </div>
      );
    }

    return <div className="ab-editor ab-editor-empty-state"><span>Select an item to edit</span></div>;
  };

  return (
    <div className="ab-root">
      <TopNav
        project={project}
        saveState={saveState}
        onBack={onBack}
        onSave={save}
        onTest={() => { setView('test'); persist({ ...state, view: 'test' }); }}
        onPreview={() => { setView('docs'); persist({ ...state, view: 'docs' }); }}
        onPublish={() => setIsPublishOpen(true)}
        onMore={e => setCtxMenu({ x: e.clientX, y: e.clientY, items: [
          { label: 'Import API', icon: Upload, onClick: () => setIsImportOpen(true) },
          { label: 'Create Version', icon: GitBranch, onClick: addVersion },
          { label: 'View Documentation', icon: BookOpen, onClick: () => { setView('docs'); persist({ ...state, view: 'docs' }); } },
          { label: 'Export OpenAPI', icon: FileJson, onClick: () => showNotice('OpenAPI exported') },
        ] })}
        onVersionChange={v => { onChange({ ...project, activeVersionId: v, builder: state }); showNotice('Version changed'); }}
        onEnvChange={setEnv}
      />

      <div className="ab-body">
        {/* Left Explorer */}
        {!isLeftCollapsed && (
          <>
            <div className="ab-explorer-wrap" style={{ width: leftResize.size }}>
              <ProjectExplorer
                state={state}
                project={project}
                expanded={expanded}
                onToggle={key => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
                onSelectEndpoint={id => { persist({ ...state, selectedEndpointId: id, selectedModelId: undefined, selectedTableId: undefined, view: 'design' }); }}
                onSelectModel={id => { persist({ ...state, selectedModelId: id, selectedEndpointId: undefined, selectedTableId: undefined }); }}
                onSelectTable={id => { persist({ ...state, selectedTableId: id, selectedEndpointId: undefined, selectedModelId: undefined }); }}
                onSelectMiddleware={id => { persist({ ...state, selectedMiddlewareId: id }); }}
                onAddEndpoint={addEndpoint}
                onAddModel={addModel}
                onAddTable={addTable}
                onAddMiddleware={addMiddleware}
                onRename={handleRename}
                onDelete={handleDelete}
                onDuplicate={handleDuplicate}
                onMove={handleMove}
                onPin={handlePin}
                onSearch={setSearch}
                search={search}
                onOpenImport={() => setIsImportOpen(true)}
                onOpenVersions={() => { setView('versions'); persist({ ...state, view: 'versions' }); }}
                onOpenDocs={() => { setView('docs'); persist({ ...state, view: 'docs' }); }}
                onOpenTests={() => { setView('test'); persist({ ...state, view: 'test' }); }}
                onOpenDatabase={() => { if (state.database[0]) persist({ ...state, selectedTableId: state.database[0].id }); }}
                onOpenSchemas={() => { if (state.models[0]) persist({ ...state, selectedModelId: state.models[0].id }); }}
                onOpenMiddleware={() => showNotice('Middleware view')}
                onOpenFunctions={() => showNotice('Functions view')}
                onSetView={setView}
              />
            </div>
            <div className="ab-resize-handle" onMouseDown={leftResize.onMouseDown} title="Drag to resize">
              <GripVertical size={10} />
            </div>
          </>
        )}

        {/* Main Editor */}
        <main className="ab-main">
          {renderMainContent()}
        </main>

        {/* Right Inspector / Copilot */}
        {!isRightCollapsed && (
          <>
            <div className="ab-resize-handle" onMouseDown={rightResize.onMouseDown} title="Drag to resize">
              <GripVertical size={10} />
            </div>
            <div className="ab-right-wrap" style={{ width: rightResize.size }}>
              <div className="ab-right-tabs">
                <button className={rightPanel === 'inspector' ? 'active' : ''} onClick={() => setRightPanel('inspector')}>
                  <SlidersHorizontal size={12} /> Inspector
                </button>
                <button className={rightPanel === 'copilot' ? 'active' : ''} onClick={() => setRightPanel('copilot')}>
                  <Bot size={12} /> Copilot
                </button>
              </div>
              {rightPanel === 'inspector' ? (
                <Inspector
                  state={state}
                  endpoint={selected}
                  model={selectedModel}
                  table={selectedTable}
                  node={selectedNode}
                  middleware={selectedMiddleware}
                  onUpdateEndpoint={updateEndpoint}
                  onUpdateModel={m => persist({ ...state, models: state.models.map(x => x.id === m.id ? m : x) })}
                  onUpdateTable={t => persist({ ...state, database: state.database.map(x => x.id === t.id ? t : x) })}
                  onUpdateNode={updateFlowNode}
                  onUpdateMiddleware={mw => persist({ ...state, middleware: state.middleware.map(x => x.id === mw.id ? mw : x) })}
                />
              ) : (
                <AICopilot
                  context={contextLabel}
                  onAction={executeCopilot}
                  onSend={executeCopilot}
                  messages={aiMessages}
                  isThinking={isAiThinking}
                />
              )}
            </div>
          </>
        )}

        {/* Panel collapse buttons */}
        <div className="ab-panel-controls">
          <button className="ab-panel-toggle" onClick={() => setIsLeftCollapsed(v => !v)} title={isLeftCollapsed ? 'Show explorer' : 'Hide explorer'}>
            {isLeftCollapsed ? <PanelLeft size={13} /> : <PanelLeftClose size={13} />}
          </button>
          <button className="ab-panel-toggle" onClick={() => setIsRightCollapsed(v => !v)} title={isRightCollapsed ? 'Show inspector' : 'Hide inspector'}>
            {isRightCollapsed ? <PanelRight size={13} /> : <PanelRightClose size={13} />}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="ab-statusbar">
        <div className="ab-statusbar-left">
          <span className="ab-statusbar-item"><GitBranch size={11} /> {project.versions.find(v => v.id === project.activeVersionId)?.semver}</span>
          <span className="ab-statusbar-item"><Globe size={11} /> {env}</span>
          <span className="ab-statusbar-item"><Server size={11} /> PostgreSQL</span>
        </div>
        <div className="ab-statusbar-right">
          <span className="ab-statusbar-item"><Braces size={11} /> {state.endpoints.length} endpoints</span>
          <span className="ab-statusbar-item"><Database size={11} /> {state.models.length} schemas</span>
          {notice && <span className="ab-statusbar-notice">{notice}</span>}
        </div>
      </div>

      {isPublishOpen && (
        <PublishModal
          state={state}
          project={project}
          onClose={() => setIsPublishOpen(false)}
          onPublish={handlePublish}
        />
      )}

      {isImportOpen && (
        <ImportModal
          onClose={() => setIsImportOpen(false)}
          onImport={handleImport}
        />
      )}

      <ContextMenu state={ctxMenu} onClose={() => setCtxMenu(null)} />
    </div>
  );
};