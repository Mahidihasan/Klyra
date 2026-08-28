import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Terminal,
  Send,
  Save,
  Copy,
  Trash2,
  Code,
  BookOpen,
  History,
  Sliders,
  X,
  Plus,
  ChevronDown,
  Search,
  Download,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Clock,
  Server,
  Zap,
  Crown,
  ArrowLeft,
  MoreVertical,
  Sparkles,
  Wrench,
  Bug,
  FileCode2,
  Compass,
  Bot,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  ChevronsLeft,
  ChevronsRight,
  FolderPlus,
  Globe,
  Shield,
  Braces,
  FileText,
  UploadCloud,
  ListOrdered,
  Cookie,
} from 'lucide-react';
import { PgAiProBanner } from '../../components/playground/PgAiProBanner';
import { WorkspaceSidebar } from '../../components/playground/WorkspaceSidebar';
import { RequestTabs } from '../../components/playground/RequestTabs';
import { WorkspaceTree, TreeAction } from '../../components/playground/WorkspaceTree';
import { playgroundApi } from '../../services/api/playground';
import {
  RequestConfig,
  PlaygroundResponse,
  Environment,
  Collection,
  SavedRequest,
  HistoryEntry,
  RequestTab,
  ResponseTab,
  CodeLanguage,
  HttpMethod,
  AuthType,
  BodyType,
  AuthConfig,
  AiAction,
  ApiWorkspaceItem,
  ApiVersionInfo,
  ApiWorkspaceEndpoint,
  WorkspaceTab,
  ApiSource,
  UserWorkspace,
  LocalApi,
} from '../../types/playground';
import {
  emptyRequestConfig,
  executeRequest,
  formatJson,
  isValidJson,
  extractVariables,
  substituteVariables,
  highlightJson,
  buildJsonTree,
  generateCode,
  statusColorClass,
  formatBytes,
  formatDuration,
  getStatusText,
  buildAuthHeaders,
  generateId,
  JsonNode,
  inferSchemaFromJson,
  validateRequestAgainstSchema,
  getUnknownFields,
  diagnoseError,
  generateSecureCode,
  isSecretValue,
  toEnvVarName,
} from '../../utils/playground';
import {
  buildPlaygroundContext,
  getActionPrompt,
  chatWithGemini,
  inspectRequest,
  GeminiMessage,
} from '../../services/gemini';
import {
  PlaygroundAction,
  PlaygroundActionName,
  AiFinding,
} from '../../types/playground';
import {
  createEmptyTab,
  createTabFromConfig,
  createTabFromItem,
  findTabForItem,
  getNextOrder,
  getPinnedItems,
  syncItemFromTab,
  createItemFromTab,
  migrateLegacyToItems,
} from '../../utils/playgroundWorkspace';
import { ApiProject } from '../../types/api';

interface PlaygroundProps {
  onBackToKlyra?: () => void;
  apiProject?: ApiProject | null;
}

type AiMsg = {
  id: string;
  role: 'user' | 'assistant';
  content: string | React.ReactNode;
  action?: AiAction;
};

const METHOD_COLORS: Record<string, string> = {
  GET: '#22c55e',
  POST: '#a78bfa',
  PUT: '#f59e0b',
  PATCH: '#3b82f6',
  DELETE: '#ef4444',
  HEAD: '#6366f1',
  OPTIONS: '#8b5cf6',
};

const AI_ACTIONS: Array<{ id: AiAction; icon: typeof Zap; label: string }> = [
  { id: 'generate-request', icon: Zap, label: 'Generate Request' },
  { id: 'explain-request', icon: BookOpen, label: 'Explain Request' },
  { id: 'diagnose-error', icon: Bug, label: 'Diagnose Error' },
  { id: 'fix-request', icon: Wrench, label: 'Fix Request' },
  { id: 'explain-response', icon: FileCode2, label: 'Explain Response' },
  { id: 'generate-code', icon: Code, label: 'Generate Code' },
  { id: 'recommend-endpoint', icon: Compass, label: 'Recommend Endpoint' },
  { id: 'suggest-improvements', icon: Sparkles, label: 'Suggest Improvements' },
  { id: 'ask-ai', icon: Bot, label: 'Ask AI' },
];

const ACTION_LABELS: Record<AiAction, string> = {
  'generate-request': 'Generate Request',
  'explain-request': 'Explain Request',
  'fix-request': 'Fix Request',
  'diagnose-error': 'Diagnose Error',
  'explain-response': 'Explain Response',
  'generate-code': 'Generate Code',
  'recommend-endpoint': 'Recommend Endpoint',
  'suggest-improvements': 'Suggest Improvements',
  'ask-ai': 'Ask AI',
};

const BanIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m4.9 4.9 14.2 14.2" />
  </svg>
);

// Code generation panel component (proper hooks usage)
const CodeGenPanel: React.FC<{ config: RequestConfig; onCopy: (text: string) => void }> = ({
  config,
  onCopy,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<CodeLanguage>('curl');
  const [copied, setCopied] = useState(false);

  const code = useMemo(() => {
    const headers: Record<string, string> = {};
    config.headers
      .filter((h) => h.enabled && h.key)
      .forEach((h) => {
        headers[h.key] = h.value;
      });
    const authHeaders = buildAuthHeaders(config.auth);
    Object.entries(authHeaders).forEach(([k, v]) => {
      if (!headers[k]) headers[k] = v;
    });
    const body = config.body.type === 'json' && config.body.json ? config.body.json : undefined;
    // Use secure code generation to reference secrets via environment variables
    return generateSecureCode(selectedLanguage, {
      method: config.method,
      url: config.url,
      headers,
      body,
      bodyType: config.body.type,
    });
  }, [selectedLanguage, config]);

  const handleCopy = async () => {
    onCopy(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pg-codegen">
      <div className="pg-codegen-toolbar">
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value as CodeLanguage)}
          className="pg-select pg-select-sm"
        >
          <option value="curl">cURL</option>
          <option value="javascript-fetch">JavaScript (Fetch)</option>
          <option value="javascript-axios">JavaScript (Axios)</option>
          <option value="python-requests">Python (Requests)</option>
          <option value="node">Node.js</option>
          <option value="php">PHP</option>
          <option value="java">Java</option>
          <option value="csharp">C#</option>
          <option value="go">Go</option>
          <option value="ruby">Ruby</option>
        </select>
        <button onClick={handleCopy} className="pg-btn pg-btn-ghost pg-btn-sm">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="pg-code-block">{code}</pre>
    </div>
  );
};

// JSON tree viewer component
const JsonTreeViewer: React.FC<{ body: string }> = ({ body }) => {
  const renderNode = (node: JsonNode, depth: number): React.ReactNode => (
    <div
      key={`${node.key}-${depth}`}
      className="pg-json-tree-row"
      style={{ paddingLeft: depth * 16 }}
    >
      <span className={`pg-json-tree-key pg-json-tree-${node.type}`}>{node.key}</span>
      {node.children ? (
        <div className="pg-json-tree-children">
          {node.children.map((child) => renderNode(child, depth + 1))}
        </div>
      ) : (
        <span className={`pg-json-tree-value pg-json-tree-${node.type}`}>
          {JSON.stringify(node.value)}
        </span>
      )}
    </div>
  );

  try {
    const parsed = JSON.parse(body);
    const tree = buildJsonTree(parsed);
    return <div className="pg-json-tree">{renderNode(tree, 0)}</div>;
  } catch {
    return <div className="pg-error-inline">Invalid JSON for tree view</div>;
  }
};

// Playground data is now loaded dynamically from the backend API.

export const PlaygroundPage: React.FC<PlaygroundProps> = ({ onBackToKlyra, apiProject }) => {
  // Core request state
  const [config, setConfig] = useState<RequestConfig>(emptyRequestConfig());
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeRequestTab, setActiveRequestTab] = useState<RequestTab>('body');
  const [activeResponseTab, setActiveResponseTab] = useState<ResponseTab>('body');

  // Layout state - independent sidebars
  const [isLeftExpanded, setIsLeftExpanded] = useState(() => {
    const saved = localStorage.getItem('pg-left-expanded');
    return saved === null ? false : saved === 'true';
  });
  const [isRightExpanded, setIsRightExpanded] = useState(true);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('apis');
  const [isRequestMaximized, setIsRequestMaximized] = useState(false);
  const [splitRatio, setSplitRatio] = useState(45);
  const splitRef = useRef<HTMLDivElement>(null);

  // Data state
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnvironment, setActiveEnvironment] = useState<Environment | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [apiSearch, setApiSearch] = useState('');

  // Workspace API state
  const [workspaceApis, setWorkspaceApis] = useState<ApiWorkspaceItem[]>([]);
  const [selectedApi, setSelectedApi] = useState<ApiWorkspaceItem | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<ApiVersionInfo | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiWorkspaceEndpoint | null>(null);
  const [apiSourceFilter, setApiSourceFilter] = useState<ApiSource | 'all'>('all');

  // Workspace explorer state
  const [userWorkspaces, setUserWorkspaces] = useState<UserWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [localApis, setLocalApis] = useState<LocalApi[]>([]);
  const [expandedApiGroups, setExpandedApiGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('pg-expanded-groups');
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return { 'my-apis': false, connected: false, local: false };
  });
  const [expandedApiIds, setExpandedApiIds] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('pg-expanded-api-ids');
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return {};
  });
  const [selectedLocalApi, setSelectedLocalApi] = useState<LocalApi | null>(null);
  const [selectedLocalEndpoint, setSelectedLocalEndpoint] = useState<ApiWorkspaceEndpoint | null>(
    null,
  );

  // Environment editing modal state
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
  const [editingEnvName, setEditingEnvName] = useState('');
  const [editingEnvVars, setEditingEnvVars] = useState<Array<{ id: string; key: string; value: string }>>([]);
  const [editingEnvSecrets, setEditingEnvSecrets] = useState<Array<{ id: string; key: string; value: string }>>([]);
  const [aiShortcuts, setAiShortcuts] = useState<Array<{ id: AiAction; label: string }>>(() => {
    return [
      { id: 'generate-request', label: 'Generate Request' },
      { id: 'explain-request', label: 'Explain Request' },
      { id: 'diagnose-error', label: 'Diagnose Error' },
      { id: 'fix-request', label: 'Fix Request' },
      { id: 'explain-response', label: 'Explain Response' },
      { id: 'generate-code', label: 'Generate Code' },
      { id: 'recommend-endpoint', label: 'Recommend Endpoint' },
      { id: 'suggest-improvements', label: 'Suggest Improvements' },
      { id: 'ask-ai', label: 'Ask AI' },
    ];
  });
  const aiChatEndRef = useRef<HTMLDivElement>(null);
  const activeWorkspace = useMemo(
    () => userWorkspaces.find((w) => w.id === activeWorkspaceId) || userWorkspaces[0],
    [userWorkspaces, activeWorkspaceId],
  );
  const connectedApis = useMemo(
    () => workspaceApis.filter((api) => api.source === 'subscribed' || api.source === 'recent'),
    [workspaceApis],
  );
  const myApis = useMemo(
    () => workspaceApis.filter((api) => api.source === 'my-apis'),
    [workspaceApis],
  );
  const searchFilteredApis = useMemo(() => {
    if (!apiSearch) return { my: myApis, connected: connectedApis, local: localApis };
    const q = apiSearch.toLowerCase();
    return {
      my: myApis.filter((api) => api.name.toLowerCase().includes(q)),
      connected: connectedApis.filter((api) => api.name.toLowerCase().includes(q)),
      local: localApis.filter(
        (api) => api.name.toLowerCase().includes(q) || api.baseUrl.toLowerCase().includes(q),
      ),
    };
  }, [myApis, connectedApis, localApis, apiSearch]);
  const isAnySearch = apiSearch.length > 0;
  const activeWorkspaceLabel = activeWorkspace?.name || 'Workspace';

  // AI state
  const [aiMessages, setAiMessages] = useState<AiMsg[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [responseRequest, setResponseRequest] = useState<RequestConfig | null>(null);
  const [copilotAnalysis, setCopilotAnalysis] = useState<CopilotResponseAnalysis | null>(null);
  const [copilotSuggestions, setCopilotSuggestions] = useState<CopilotSuggestion[]>([]);
  const responseAnalysisId = useRef(0);

  // Schema-aware editor state
  const [inferredSchema, setInferredSchema] = useState<
    import('../../types/playground').SchemaField[]
  >([]);
  const [schemaIssues, setSchemaIssues] = useState<
    import('../../types/playground').RequestValidationIssue[]
  >([]);
  const [showSchemaValidation, setShowSchemaValidation] = useState(false);

  // Save as API Example state
  const [savedExamples, setSavedExamples] = useState<import('../../types/playground').ApiExample[]>(
    [],
  );
  const [showSaveExampleModal, setShowSaveExampleModal] = useState(false);
  const [exampleName, setExampleName] = useState('');
  const [exampleDescription, setExampleDescription] = useState('');

  // Generic input modal state (replaces browser prompt())
  const [inputModal, setInputModal] = useState<{
    title: string;
    label: string;
    placeholder?: string;
    initialValue?: string;
    multiline?: boolean;
    onConfirm: (value: string) => void;
  } | null>(null);
  const [inputModalValue, setInputModalValue] = useState('');
  const inputModalRef = useRef<HTMLInputElement>(null);
  const inputModalTextareaRef = useRef<HTMLTextAreaElement>(null);

  const openInputModal = (opts: {
    title: string;
    label: string;
    placeholder?: string;
    initialValue?: string;
    multiline?: boolean;
    onConfirm: (value: string) => void;
  }) => {
    setInputModalValue(opts.initialValue || '');
    setInputModal(opts);
    // Use setTimeout to ensure DOM is ready before focusing
    setTimeout(() => {
      if (opts.multiline) inputModalTextareaRef.current?.focus();
      else inputModalRef.current?.focus();
    }, 50);
  };

  const closeInputModal = () => setInputModal(null);

  const confirmInputModal = () => {
    if (!inputModal) return;
    const value = inputModalValue.trim();
    if (value) {
      inputModal.onConfirm(value);
    }
    setInputModal(null);
  };

  // Error diagnosis state
  const [errorDiagnosis, setErrorDiagnosis] = useState<
    import('../../types/playground').ErrorDiagnosis | null
  >(null);

  // Variable autocomplete state
  const [activeEditor, setActiveEditor] = useState<string | null>(null);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [autocompletePos, setAutocompletePos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const urlRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLTextAreaElement>(null);

  // =========================================================
  // UNIFIED WORKSPACE STATE (Phase 1)
  // =========================================================
  const [workspaceItems, setWorkspaceItems] = useState<import('../../types/playground').WorkspaceItem[]>([]);
  const [openTabs, setOpenTabs] = useState<import('../../types/playground').OpenRequestTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [tabResponses, setTabResponses] = useState<Record<string, { response: PlaygroundResponse | null }>>({});
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [expandedTreeIds, setExpandedTreeIds] = useState<Record<string, boolean>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Derive active tab
  const activeTab = useMemo(
    () => openTabs.find((t) => t.tabId === activeTabId) || null,
    [openTabs, activeTabId],
  );

  // Keep config/response in sync with active tab
  useEffect(() => {
    if (activeTab) {
      setConfig(activeTab.config);
      const cached = tabResponses[activeTab.tabId];
      setResponse(cached?.response || null);
    }
  }, [activeTabId, openTabs.length]);

  // Persist sidebar & explorer state
  useEffect(() => {
    localStorage.setItem('pg-left-expanded', String(isLeftExpanded));
  }, [isLeftExpanded]);

  useEffect(() => {
    localStorage.setItem('pg-expanded-groups', JSON.stringify(expandedApiGroups));
  }, [expandedApiGroups]);

  useEffect(() => {
    localStorage.setItem('pg-expanded-api-ids', JSON.stringify(expandedApiIds));
  }, [expandedApiIds]);

  // Real backend data load
  useEffect(() => {
    let isMounted = true;
    playgroundApi
      .fetchPlaygroundData()
      .then((data) => {
        if (!isMounted) return;
        setWorkspaceApis(data.workspaceApis || []);
        setUserWorkspaces(data.userWorkspaces || []);
        setLocalApis(data.localApis || []);
        setCollections(data.collections || []);
        setHistory(data.history || []);
        setEnvironments(data.environments || []);
        if (data.apiExamples) setSavedExamples(data.apiExamples);
        if (data.workspaceItems && data.workspaceItems.length > 0) {
          setWorkspaceItems(data.workspaceItems);
        } else if (data.collections && data.collections.length > 0) {
          // Migration: build workspace items from legacy collections
          const migrated = migrateLegacyToItems(data.collections);
          setWorkspaceItems(migrated);
        }
        // Create initial tab if none exist
        if (!openTabs || openTabs.length === 0) {
          const initialTab = createEmptyTab();
          setOpenTabs([initialTab]);
          setActiveTabId(initialTab.tabId);
        }
        if (data.environments && data.environments.length > 0) {
          setActiveEnvironment(data.environments[0]);
        }
        if (data.userWorkspaces && data.userWorkspaces.length > 0) {
          setActiveWorkspaceId(data.userWorkspaces[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to load playground backend data:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const envVariables = useMemo(() => {
    if (!activeEnvironment) return {};
    return { ...activeEnvironment.variables, ...activeEnvironment.secrets };
  }, [activeEnvironment]);

  const filteredVariables = useMemo(() => {
    const names = Object.keys(envVariables);
    if (!autocompleteQuery) return names;
    return names.filter((n) => n.toLowerCase().includes(autocompleteQuery.toLowerCase()));
  }, [envVariables, autocompleteQuery]);

  const requestReadiness = useMemo(() => {
    const issues: Array<{ severity: 'error' | 'warning'; message: string; tab: RequestTab }> = [];
    const values = [
      config.url,
      ...config.params.map((item) => item.value),
      ...config.headers.map((item) => item.value),
      ...config.cookies.map((item) => item.value),
      config.auth.apiKeyValue || '',
      config.auth.bearerToken || '',
      config.auth.basicUsername || '',
      config.auth.basicPassword || '',
      config.body.json || '',
      config.body.raw || '',
      ...(config.body.formData || []).map((item) => item.value),
      ...(config.body.urlEncoded || []).map((item) => item.value),
    ];
    const unresolved = [...new Set(values.flatMap(extractVariables).filter((name) => !(name in envVariables)))];
    if (!config.url.trim()) issues.push({ severity: 'error', message: 'Add a request URL before sending.', tab: 'params' });
    if (unresolved.length > 0) {
      issues.push({
        severity: 'error',
        message: `Undefined environment variable${unresolved.length > 1 ? 's' : ''}: ${unresolved.map((name) => `{{${name}}}`).join(', ')}`,
        tab: 'params',
      });
    }
    if (config.body.type === 'json' && config.body.json) {
      const resolvedJson = activeEnvironment
        ? substituteVariables(config.body.json, activeEnvironment.variables, activeEnvironment.secrets)
        : config.body.json;
      if (!isValidJson(resolvedJson)) {
        issues.push({ severity: 'error', message: 'The JSON body is invalid.', tab: 'body' });
      }
    }
    if (config.auth.type === 'bearer' && !config.auth.bearerToken?.trim()) {
      issues.push({ severity: 'error', message: 'Bearer authentication needs a token.', tab: 'auth' });
    }
    if (config.auth.type === 'api-key' && (!config.auth.apiKeyKey?.trim() || !config.auth.apiKeyValue?.trim())) {
      issues.push({ severity: 'error', message: 'API key authentication needs both a key name and value.', tab: 'auth' });
    }
    if (config.auth.type === 'basic' && (!config.auth.basicUsername?.trim() || !config.auth.basicPassword?.trim())) {
      issues.push({ severity: 'warning', message: 'Basic authentication is incomplete; empty values will be sent.', tab: 'auth' });
    }
    if (['POST', 'PUT', 'PATCH'].includes(config.method) && config.body.type === 'none') {
      issues.push({ severity: 'warning', message: `${config.method} requests commonly require a body.`, tab: 'body' });
    }
    return issues;
  }, [config, envVariables, activeEnvironment]);

  const hasBlockingRequestIssue = requestReadiness.some((issue) => issue.severity === 'error');

  // Filtered workspace APIs
  const filteredApis = useMemo(() => {
    let apis = workspaceApis;
    if (apiSourceFilter !== 'all') {
      apis = apis.filter((api) => api.source === apiSourceFilter);
    }
    if (apiSearch) {
      apis = apis.filter((api) => api.name.toLowerCase().includes(apiSearch.toLowerCase()));
    }
    return apis;
  }, [workspaceApis, apiSourceFilter, apiSearch]);

  // Select API endpoint - auto-populate center playground
  const handleSelectEndpoint = (
    api: ApiWorkspaceItem,
    version: ApiVersionInfo,
    endpoint: ApiWorkspaceEndpoint,
  ) => {
    setSelectedApi(api);
    setSelectedVersion(version);
    setSelectedEndpoint(endpoint);

    const newConfig = emptyRequestConfig();
    newConfig.name = `${endpoint.method} ${endpoint.path}`;
    newConfig.method = endpoint.method as HttpMethod;
    newConfig.url = `${version.baseUrl}${endpoint.path}`;

    // Inherit auth from API version
    if (version.authConfig) {
      newConfig.auth = { ...version.authConfig };
    }

    // Inherit sample request body if available
    if (endpoint.sampleRequest) {
      try {
        const parsed = JSON.parse(endpoint.sampleRequest);
        newConfig.body = { type: 'json', json: JSON.stringify(parsed, null, 2) };
      } catch {
        newConfig.body = { type: 'raw', raw: endpoint.sampleRequest, rawLanguage: 'json' };
      }
    }

    // Inherit sample response if available
    if (endpoint.sampleResponse) {
      setResponse({
        id: generateId(),
        status: 200,
        statusText: 'OK',
        timeMs: 0,
        sizeBytes: new Blob([endpoint.sampleResponse]).size,
        body: endpoint.sampleResponse,
        headers: { 'content-type': 'application/json' },
        isSuccess: true,
        isRedirect: false,
        isClientError: false,
        isServerError: false,
        isTimeout: false,
        isNetworkError: false,
      });
    } else {
      setResponse(null);
    }

    setConfig(newConfig);
  };

  // Schema inference & validation effect
  useEffect(() => {
    let schema: import('../../types/playground').SchemaField[] = [];
    if (selectedEndpoint?.sampleRequest) {
      schema = inferSchemaFromJson(selectedEndpoint.sampleRequest);
    } else if (selectedLocalEndpoint?.sampleRequest) {
      schema = inferSchemaFromJson(selectedLocalEndpoint.sampleRequest);
    }
    setInferredSchema(schema);
    if (schema.length > 0) {
      const validation = validateRequestAgainstSchema(config, schema);
      const unknown = getUnknownFields(config, schema);
      setSchemaIssues([...validation.issues, ...unknown]);
    } else {
      setSchemaIssues([]);
    }
  }, [config.body.json, selectedEndpoint, selectedLocalEndpoint]);

  // Error diagnosis on response
  useEffect(() => {
    if (
      response &&
      (response.isClientError ||
        response.isServerError ||
        response.isTimeout ||
        response.isNetworkError)
    ) {
      const diagnosis = diagnoseError(response, config);
      setErrorDiagnosis(diagnosis);
    } else {
      setErrorDiagnosis(null);
    }
  }, [response]);

  const buildResponseAnalysis = (
    result: PlaygroundResponse,
    request: RequestConfig,
  ): CopilotResponseAnalysis => {
    const statusText = getStatusText(result.status);
    const isFailure = result.isClientError || result.isServerError || result.isTimeout || result.isNetworkError;
    const bodyKind = result.body
      ? (isValidJson(result.body) ? 'JSON payload' : 'text payload')
      : 'no response body';
    const summary = result.isTimeout
      ? `The ${request.method} request timed out before ${request.url} returned a response.`
      : result.isNetworkError
        ? `The ${request.method} request could not reach ${request.url}.`
        : isFailure
          ? `The ${request.method} request completed with ${result.status} ${statusText}; the server did not accept or complete it as requested.`
          : `The ${request.method} request completed successfully with ${result.status} ${statusText}.`;
    const observations = [
      `${bodyKind.charAt(0).toUpperCase()}${bodyKind.slice(1)} was returned${result.body ? '.' : '.'}`,
      `${Object.keys(result.headers || {}).length} response header${Object.keys(result.headers || {}).length === 1 ? '' : 's'} captured.`,
    ];
    if (result.timeMs >= 2000) observations.push(`Response time was ${formatDuration(result.timeMs)}, which may be worth monitoring.`);
    if (result.sizeBytes >= 1024 * 1024) observations.push(`Response size was ${formatBytes(result.sizeBytes)}, which is relatively large.`);
    return {
      summary,
      details: [
        { label: 'Status', value: result.isTimeout ? 'Timed out' : result.isNetworkError ? 'Network error' : `${result.status} ${statusText}` },
        { label: 'Response', value: bodyKind },
        { label: 'Time', value: formatDuration(result.timeMs) },
        { label: 'Size', value: formatBytes(result.sizeBytes) },
      ],
      observations,
    };
  };

  const findingToSuggestion = (finding: AiFinding, index: number): CopilotSuggestion => ({
    id: `copilot-finding-${Date.now()}-${index}`,
    problem: finding.message,
    why: finding.type === 'response_error'
      ? 'The response and request context indicate this may prevent the request from succeeding.'
      : 'This was identified from the request and response context.',
    fix: finding.suggestion || 'Review and apply the proposed request change.',
    action: finding.action ? { name: finding.action, args: finding.actionArgs || {} } : undefined,
  });

  // Each response gets a fresh, response-scoped analysis. A new request invalidates
  // the prior one before execution so stale findings can never be applied.
  useEffect(() => {
    if (!response || !responseRequest) return;
    const analysisId = responseAnalysisId.current;
    setCopilotAnalysis(buildResponseAnalysis(response, responseRequest));

    inspectRequest(
      buildPlaygroundContext(responseRequest, response, activeEnvironment?.name, envVariables),
    ).then((findings) => {
      if (analysisId !== responseAnalysisId.current) return;
      setCopilotSuggestions(findings.map(findingToSuggestion));
    });
  }, [response, responseRequest]);

  // Save as API Example handlers
  const openSaveExampleModal = () => {
    setExampleName(config.name || 'Untitled Request');
    setExampleDescription('');
    setShowSaveExampleModal(true);
  };

  const saveAsExample = () => {
    const newExample: import('../../types/playground').ApiExample = {
      id: generateId(),
      name: exampleName || config.name || 'Untitled Example',
      description: exampleDescription || undefined,
      apiId: selectedApi?.id || selectedLocalApi?.id,
      endpointId: selectedEndpoint?.id || selectedLocalEndpoint?.id,
      request: { ...config, id: generateId() },
      response: response || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSavedExamples((prev) => [newExample, ...prev]);
    setShowSaveExampleModal(false);
    setActiveResponseTab('body');
  };

  // Send request
  const handleSendRequest = async () => {
    if (!config.url.trim() || hasBlockingRequestIssue) return;
    responseAnalysisId.current += 1;
    setAiMessages([]);
    setAiInput('');
    setCopilotAnalysis(null);
    setCopilotSuggestions([]);
    setResponseRequest({ ...config });
    setIsLoading(true);
    setResponse(null);
    try {
      const result = await executeRequest(config, activeEnvironment);
      setResponse(result);
      const historyPayload = {
        requestName: config.name || 'Untitled Request',
        method: config.method,
        url: config.url,
        status: result.status,
        statusText: result.statusText,
        timeMs: result.timeMs,
        responseBody: result.body,
        apiId: selectedApi?.id,
      };
      try {
        const savedHistory = await playgroundApi.addHistoryEntry(historyPayload);
        setHistory((prev) => [savedHistory, ...prev.slice(0, 49)]);
      } catch (_histErr) {
        const fallbackHistory: HistoryEntry = {
          ...historyPayload,
          id: `hist-${Date.now()}`,
          timestamp: new Date().toISOString(),
        };
        setHistory((prev) => [fallbackHistory, ...prev.slice(0, 49)]);
      }
    } catch (error) {
      console.error('Request failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Core handlers
  const handleMethodChange = (method: HttpMethod) => setConfig((prev) => ({ ...prev, method }));
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setConfig((prev) => ({ ...prev, name: e.target.value }));
  const handleAuthChange = (auth: AuthConfig) => setConfig((prev) => ({ ...prev, auth }));
  const handleBodyTypeChange = (type: BodyType) =>
    setConfig((prev) => ({ ...prev, body: { ...prev.body, type } }));
  const handleRawBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    setConfig((prev) => ({ ...prev, body: { ...prev.body, raw: e.target.value } }));
  const handleRawLanguageChange = (language: 'text' | 'json' | 'xml' | 'html') =>
    setConfig((prev) => ({ ...prev, body: { ...prev.body, rawLanguage: language } }));

  // Generic KV handlers
  const handleKvChange = (
    kind: 'params' | 'headers' | 'cookies' | 'formData' | 'urlEncoded',
    index: number,
    field: 'key' | 'value' | 'enabled',
    value: string | boolean,
  ) => {
    setConfig((prev) => {
      if (kind === 'params') {
        const newArr = [...prev.params];
        newArr[index] = { ...newArr[index], [field]: value };
        return { ...prev, params: newArr };
      }
      if (kind === 'headers') {
        const newArr = [...prev.headers];
        newArr[index] = { ...newArr[index], [field]: value };
        return { ...prev, headers: newArr };
      }
      if (kind === 'cookies') {
        const newArr = [...prev.cookies];
        newArr[index] = { ...newArr[index], [field]: value };
        return { ...prev, cookies: newArr };
      }
      if (kind === 'formData') {
        const newArr = prev.body.formData ? [...prev.body.formData] : [];
        newArr[index] = { ...newArr[index], [field]: value };
        return { ...prev, body: { ...prev.body, formData: newArr } };
      }
      const newArr = prev.body.urlEncoded ? [...prev.body.urlEncoded] : [];
      newArr[index] = { ...newArr[index], [field]: value };
      return { ...prev, body: { ...prev.body, urlEncoded: newArr } };
    });
  };

  const addKv = (kind: 'params' | 'headers' | 'cookies' | 'formData' | 'urlEncoded') => {
    setConfig((prev) => {
      const item = { id: generateId(), key: '', value: '', enabled: true };
      if (kind === 'params') return { ...prev, params: [...prev.params, item] };
      if (kind === 'headers') return { ...prev, headers: [...prev.headers, item] };
      if (kind === 'cookies') return { ...prev, cookies: [...prev.cookies, item] };
      if (kind === 'formData')
        return { ...prev, body: { ...prev.body, formData: [...(prev.body.formData || []), item] } };
      return {
        ...prev,
        body: { ...prev.body, urlEncoded: [...(prev.body.urlEncoded || []), item] },
      };
    });
  };

  const removeKv = (
    kind: 'params' | 'headers' | 'cookies' | 'formData' | 'urlEncoded',
    index: number,
  ) => {
    setConfig((prev) => {
      if (kind === 'params') return { ...prev, params: prev.params.filter((_, i) => i !== index) };
      if (kind === 'headers')
        return { ...prev, headers: prev.headers.filter((_, i) => i !== index) };
      if (kind === 'cookies')
        return { ...prev, cookies: prev.cookies.filter((_, i) => i !== index) };
      if (kind === 'formData')
        return {
          ...prev,
          body: { ...prev.body, formData: prev.body.formData?.filter((_, i) => i !== index) || [] },
        };
      return {
        ...prev,
        body: {
          ...prev.body,
          urlEncoded: prev.body.urlEncoded?.filter((_, i) => i !== index) || [],
        },
      };
    });
  };

  // Body / URL with variable handling
  const handleEditorVariableInput = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
    field: 'url' | 'json',
  ) => {
    const value = e.target.value;
    if (field === 'url') setConfig((prev) => ({ ...prev, url: value }));
    else setConfig((prev) => ({ ...prev, body: { ...prev.body, json: value } }));

    const caretPos = e.target.selectionStart ?? value.length;
    const before = value.slice(0, caretPos);
    const match = before.match(/\{\{\s*([^{}]*)$/);
    if (match) {
      setActiveEditor(field);
      setAutocompleteQuery(match[1]);
      const el = e.target;
      const rect = el.getBoundingClientRect();
      const line = before.split('\n').length;
      setAutocompletePos({ top: rect.top + 28 + line * 18, left: rect.left + 8 });
    } else {
      setActiveEditor(null);
      setAutocompletePos(null);
    }
  };

  const insertVariable = (name: string) => {
    const replaceIn = (value: string, caretPos: number): { value: string; pos: number } => {
      const before = value.slice(0, caretPos);
      const after = value.slice(caretPos);
      const replaced = before.replace(/\{\{\s*([^{}]*)$/, `{{${name}}}`);
      return { value: replaced + after, pos: replaced.length + after.length };
    };

    if (activeEditor === 'url' && urlRef.current) {
      const el = urlRef.current;
      const { value, pos } = replaceIn(el.value, el.selectionStart ?? el.value.length);
      setConfig((prev) => ({ ...prev, url: value }));
      // Use setTimeout to ensure DOM is ready before focusing
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(pos, pos);
      }, 50);
    } else if (activeEditor === 'json' && jsonRef.current) {
      const el = jsonRef.current;
      const { value, pos } = replaceIn(el.value, el.selectionStart ?? el.value.length);
      setConfig((prev) => ({ ...prev, body: { ...prev.body, json: value } }));
      // Use setTimeout to ensure DOM is ready before focusing
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(pos, pos);
      }, 50);
    }
    setActiveEditor(null);
    setAutocompletePos(null);
  };

  // Request actions
  const saveRequest = async () => {
    const targetCollection = collections[0];
    const newReq: SavedRequest = {
      id: `req-${Date.now()}`,
      name: config.name || 'Untitled Request',
      config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (targetCollection) {
      try {
        const updatedCol = await playgroundApi.addRequestToCollection(targetCollection.id, newReq);
        setCollections((prev) => prev.map((c) => (c.id === updatedCol.id ? updatedCol : c)));
      } catch (_err) {
        setCollections((prev) =>
          prev.map((c, i) => (i === 0 ? { ...c, requests: [...c.requests, newReq] } : c)),
        );
      }
    } else {
      // Create default collection if none exists
      try {
        const newCol = await playgroundApi.createCollection({
          name: 'My Collection',
          description: 'Saved requests',
          color: '#10b981',
          requests: [newReq],
        });
        setCollections([newCol]);
      } catch (_err) {
        const fallbackCol: Collection = {
          id: `col-${Date.now()}`,
          name: 'My Collection',
          description: 'Saved requests',
          color: '#10b981',
          requests: [newReq],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setCollections([fallbackCol]);
      }
    }
  };

  const duplicateRequest = () => {
    setConfig((prev) => ({
      ...prev,
      id: generateId(),
      name: `${prev.name} (Copy)`,
      url: prev.url,
    }));
  };

  const prettifyJson = () => {
    if (config.body.type === 'json' && config.body.json) {
      try {
        const formatted = formatJson(config.body.json);
        setConfig((prev) => ({ ...prev, body: { ...prev.body, json: formatted } }));
      } catch {
        /* invalid */
      }
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const copyResponse = () => {
    if (response?.body) copyToClipboard(response.body);
  };
  const downloadResponse = () => {
    if (response?.body) {
      const blob = new Blob([response.body], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.name || 'response'}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Environment / collection / history management
  const createEnvironment = () => {
    openInputModal({
      title: 'New Environment',
      label: 'Environment Name',
      placeholder: 'e.g. Development',
      onConfirm: async (name) => {
        try {
          const newEnv = await playgroundApi.createEnvironment({
            name,
            variables: {},
            secrets: {},
            isDefault: false,
          });
          setEnvironments((prev) => [...prev, newEnv]);
          setActiveEnvironment(newEnv);
        } catch (_err) {
          const fallbackEnv: Environment = {
            id: `env-${Date.now()}`,
            name,
            variables: {},
            secrets: {},
            isDefault: false,
          };
          setEnvironments((prev) => [...prev, fallbackEnv]);
          setActiveEnvironment(fallbackEnv);
        }
      },
    });
  };

  const createCollection = () => {
    openInputModal({
      title: 'New Collection',
      label: 'Collection Name',
      placeholder: 'e.g. E-commerce APIs',
      onConfirm: async (name) => {
        try {
          const newCol = await playgroundApi.createCollection({
            name,
            description: '',
            color: '#' + Math.floor(Math.random() * 16777215).toString(16),
            requests: [],
          });
          setCollections((prev) => [...prev, newCol]);
        } catch (_err) {
          const fallbackCol: Collection = {
            id: `col-${Date.now()}`,
            name,
            description: '',
            color: '#' + Math.floor(Math.random() * 16777215).toString(16),
            requests: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setCollections((prev) => [...prev, fallbackCol]);
        }
      },
    });
  };

  const loadRequest = (request: SavedRequest) => {
    setConfig(request.config);
    setResponse(null);
  };
  const loadFromHistory = (entry: HistoryEntry) => {
    const newConfig = emptyRequestConfig();
    newConfig.name = entry.requestName;
    newConfig.method = entry.method;
    newConfig.url = entry.url;
    setConfig(newConfig);
    setResponse(
      entry.responseBody
        ? {
          id: entry.id,
          status: entry.status,
          statusText: entry.statusText,
          timeMs: entry.timeMs,
          sizeBytes: new Blob([entry.responseBody]).size,
          body: entry.responseBody,
          headers: {},
          isSuccess: entry.status >= 200 && entry.status < 300,
          isRedirect: entry.status >= 300 && entry.status < 400,
          isClientError: entry.status >= 400 && entry.status < 500,
          isServerError: entry.status >= 500,
          isTimeout: false,
          isNetworkError: false,
        }
        : null,
    );
  };
  const clearHistory = async () => {
    try {
      await playgroundApi.clearHistory();
    } catch (_err) {
      /* fallback */
    }
    setHistory([]);
  };
  const deleteHistoryEntry = async (entryId: string) => {
    try {
      await playgroundApi.deleteHistoryEntry(entryId);
    } catch (_err) {
      /* fallback */
    }
    setHistory((prev) => prev.filter((h) => h.id !== entryId));
  };
  const deleteRequestFromCollection = async (collectionId: string, requestId: string) => {
    try {
      const updatedCol = await playgroundApi.deleteRequestFromCollection(collectionId, requestId);
      setCollections((prev) => prev.map((c) => (c.id === updatedCol.id ? updatedCol : c)));
    } catch (_err) {
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId
            ? { ...c, requests: c.requests.filter((r) => r.id !== requestId) }
            : c,
        ),
      );
    }
  };

  // =========================================================
  // TAB MANAGEMENT (Multi-request workspace)
  // =========================================================
  const handleNewTab = () => {
    const tab = createEmptyTab();
    setOpenTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.tabId);
    setResponse(null);
  };

  const handleSelectTab = (tabId: string) => {
    // Save current config to the active tab before switching
    setOpenTabs((prev) =>
      prev.map((t) => (t.tabId === activeTabId ? { ...t, config: { ...config } } : t)),
    );
    setActiveTabId(tabId);
  };

  const handleCloseTab = (tabId: string) => {
    const tab = openTabs.find((t) => t.tabId === tabId);
    if (tab?.isDirty) {
      setConfirmDialog({
        title: 'Discard unsaved changes?',
        message: `"${tab.name}" has unsaved changes. Closing this tab will discard them.`,
        onConfirm: () => {
          setOpenTabs((prev) => {
            const remaining = prev.filter((t) => t.tabId !== tabId);
            if (activeTabId === tabId) {
              const next = remaining[remaining.length - 1];
              setActiveTabId(next?.tabId || '');
              if (!next) setResponse(null);
            }
            return remaining;
          });
          setTabResponses((prev) => {
            const next = { ...prev };
            delete next[tabId];
            return next;
          });
          setConfirmDialog(null);
        },
      });
      return;
    }
    setOpenTabs((prev) => {
      const remaining = prev.filter((t) => t.tabId !== tabId);
      if (activeTabId === tabId) {
        const next = remaining[remaining.length - 1];
        setActiveTabId(next?.tabId || '');
        if (!next) setResponse(null);
      }
      return remaining;
    });
    setTabResponses((prev) => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });
  };

  const handleRenameTab = (tabId: string, name: string) => {
    setOpenTabs((prev) => prev.map((t) => (t.tabId === tabId ? { ...t, name } : t)));
  };

  // =========================================================
  // WORKSPACE ITEM OPERATIONS
  // =========================================================
  const handleCreateWorkspaceItem = async (
    kind: import('../../types/playground').WorkspaceItemKind,
    parentId?: string,
    name?: string,
  ) => {
    const order = getNextOrder(workspaceItems, parentId);
    const resolvedName =
      (name && name.trim()) ||
      (kind === 'request' ? 'New Request' : kind === 'folder' ? 'New Folder' : 'New Collection');
    const newItem: import('../../types/playground').WorkspaceItem = {
      id: generateId(),
      kind,
      name: resolvedName,
      parentId,
      order,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPinned: false,
    };
    try {
      const saved = await playgroundApi.createWorkspaceItem(newItem);
      setWorkspaceItems((prev) => [...prev, saved]);
      if (kind === 'request') {
        const tab = createTabFromItem(saved);
        setOpenTabs((prev) => [...prev, tab]);
        setActiveTabId(tab.tabId);
      }
    } catch (_err) {
      setWorkspaceItems((prev) => [...prev, newItem]);
      if (kind === 'request') {
        const tab = createTabFromItem(newItem);
        setOpenTabs((prev) => [...prev, tab]);
        setActiveTabId(tab.tabId);
      }
    }
  };

  const handleOpenWorkspaceItem = (item: import('../../types/playground').WorkspaceItem) => {
    if (item.kind === 'folder' || item.kind === 'collection') {
      setExpandedTreeIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
      return;
    }
    // Open in a tab (or focus existing tab)
    const existing = findTabForItem(openTabs, item.id);
    if (existing) {
      setActiveTabId(existing.tabId);
      return;
    }
    const tab = createTabFromItem(item);
    setOpenTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.tabId);
  };

  const handleWorkspaceAction = async (action: TreeAction, item: import('../../types/playground').WorkspaceItem) => {
    switch (action) {
      case 'open':
        handleOpenWorkspaceItem(item);
        break;
      case 'rename':
        // Inline rename handled in tree; this is the commit
        if (item.name) {
          try {
            const updated = await playgroundApi.updateWorkspaceItem(item.id, { name: item.name });
            setWorkspaceItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            // Also update any open tab for this item
            setOpenTabs((prev) =>
              prev.map((t) => (t.itemId === item.id ? { ...t, name: item.name } : t)),
            );
          } catch (_err) {
            setWorkspaceItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, name: item.name } : i)));
          }
        }
        break;
      case 'pin':
      case 'unpin':
        try {
          const updated = await playgroundApi.togglePinWorkspaceItem(item.id);
          setWorkspaceItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        } catch (_err) {
          setWorkspaceItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, isPinned: !i.isPinned } : i)),
          );
        }
        break;
      case 'duplicate':
        try {
          const copy = await playgroundApi.duplicateWorkspaceItem(item.id);
          setWorkspaceItems((prev) => [...prev, copy]);
        } catch (_err) {
          const copy: import('../../types/playground').WorkspaceItem = {
            ...item,
            id: generateId(),
            name: `${item.name} (Copy)`,
            order: item.order + 0.5,
            isPinned: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setWorkspaceItems((prev) => [...prev, copy]);
        }
        break;
      case 'delete':
        setConfirmDialog({
          title: 'Delete item?',
          message: `"${item.name}" and all its contents will be permanently deleted.`,
          onConfirm: async () => {
            try {
              await playgroundApi.deleteWorkspaceItem(item.id);
            } catch (_err) {
              /* fallback */
            }
            setWorkspaceItems((prev) => prev.filter((i) => i.id !== item.id));
            // Close any tabs referencing this item
            setOpenTabs((prev) => prev.filter((t) => t.itemId !== item.id));
            setConfirmDialog(null);
          },
        });
        break;
      case 'move':
        // Handled by tree's move panel
        break;
      case 'new-folder':
      case 'new-request':
      case 'new-test':
        handleCreateWorkspaceItem(
          action === 'new-folder' ? 'folder' : action === 'new-test' ? 'test' : 'request',
          item.id,
        );
        break;
      case 'replay':
        handleOpenWorkspaceItem(item);
        break;
    }
  };

  const handleMoveWorkspaceItem = async (itemId: string, parentId: string | null) => {
    try {
      const updated = await playgroundApi.moveWorkspaceItem(itemId, parentId);
      setWorkspaceItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (_err) {
      setWorkspaceItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, parentId: parentId || undefined } : i)),
      );
    }
  };

  // =========================================================
  // SAVE / DISCARD
  // =========================================================
  const handleSaveTab = async () => {
    if (!activeTab) return;
    // If tab has an itemId, update the workspace item
    if (activeTab.itemId) {
      try {
        const updated = await playgroundApi.updateWorkspaceItem(activeTab.itemId, {
          name: config.name,
          request: config,
          method: config.method,
          url: config.url,
        });
        setWorkspaceItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      } catch (_err) {
        setWorkspaceItems((prev) =>
          prev.map((i) => (i.id === activeTab.itemId ? { ...i, name: config.name, request: config, method: config.method, url: config.url } : i)),
        );
      }
    } else {
      // Save as new workspace item
      const order = getNextOrder(workspaceItems);
      const newItem = createItemFromTab(activeTab, 'request', undefined, order);
      try {
        const saved = await playgroundApi.createWorkspaceItem(newItem);
        setWorkspaceItems((prev) => [...prev, saved]);
        setOpenTabs((prev) =>
          prev.map((t) => (t.tabId === activeTab.tabId ? { ...t, itemId: saved.id, isDirty: false } : t)),
        );
      } catch (_err) {
        setWorkspaceItems((prev) => [...prev, newItem]);
        setOpenTabs((prev) =>
          prev.map((t) => (t.tabId === activeTab.tabId ? { ...t, itemId: newItem.id, isDirty: false } : t)),
        );
      }
    }
    // Mark tab as clean
    setOpenTabs((prev) =>
      prev.map((t) => (t.tabId === activeTab.tabId ? { ...t, isDirty: false } : t)),
    );
  };

  const handleDiscardTab = () => {
    if (!activeTab) return;
    setConfirmDialog({
      title: 'Discard changes?',
      message: `Unsaved changes to "${activeTab.name}" will be lost.`,
      onConfirm: () => {
        // Reload from workspace item if available, else reset
        if (activeTab.itemId) {
          const item = workspaceItems.find((i) => i.id === activeTab.itemId);
          if (item?.request) {
            setConfig(item.request);
            setOpenTabs((prev) =>
              prev.map((t) =>
                t.tabId === activeTab.tabId ? { ...t, config: item.request!, isDirty: false } : t,
              ),
            );
          }
        } else {
          const fresh = emptyRequestConfig();
          setConfig(fresh);
          setOpenTabs((prev) =>
            prev.map((t) =>
              t.tabId === activeTab.tabId ? { ...t, config: fresh, isDirty: false } : t,
            ),
          );
        }
        setConfirmDialog(null);
      },
    });
  };

  // Track dirty state when config changes
  useEffect(() => {
    if (!activeTab) return;
    // Compare with the tab's saved config
    const savedConfig = activeTab.config;
    const isDirty = JSON.stringify(config) !== JSON.stringify(savedConfig);
    if (isDirty !== activeTab.isDirty) {
      setOpenTabs((prev) =>
        prev.map((t) => (t.tabId === activeTab.tabId ? { ...t, isDirty } : t)),
      );
    }
  }, [config, activeTabId]);

  // Split resize
  const startSplitResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startRatio = splitRatio;
    const container = splitRef.current;
    const handleMove = (ev: MouseEvent) => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const delta = ((ev.clientY - startY) / rect.height) * 100;
      setSplitRatio(Math.max(20, Math.min(80, startRatio + delta)));
    };
    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  // Convert AiMsg[] to GeminiMessage[] for the API
  const aiMessagesToGemini = (msgs: AiMsg[]): GeminiMessage[] => {
    return msgs
      .filter((m): m is { id: string; role: 'user' | 'assistant'; content: string; action?: AiAction } =>
        typeof m.content === 'string',
      )
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  };

  const mergeKvItems = (
    existing: Array<{ id: string; key: string; value: string; enabled: boolean }>,
    incoming: Array<{ id: string; key: string; value: string; enabled: boolean }>,
  ) => {
    const map = new Map<string, { id: string; key: string; value: string; enabled: boolean }>();
    existing.forEach((item) => {
      if (item.key) {
        map.set(item.key.toLowerCase(), item);
      }
    });

    incoming.forEach((item) => {
      const key = item.key.toLowerCase();
      const prev = map.get(key);
      if (prev) {
        map.set(key, { ...prev, value: item.value, enabled: item.enabled });
      } else {
        map.set(key, item);
      }
    });

    const merged = [...existing];
    incoming.forEach((item) => {
      const existingIdx = merged.findIndex((h) => h.key.toLowerCase() === item.key.toLowerCase());
      if (existingIdx >= 0) {
        merged[existingIdx] = map.get(item.key.toLowerCase()) || merged[existingIdx];
      } else {
        merged.push(item);
      }
    });
    return merged;
  };

  const validatePlaygroundAction = (
    pgAction: PlaygroundAction,
  ): { valid: true } | { valid: false; reason: string } => {
    const args = (pgAction.args || {}) as Record<string, unknown>;
    const allowedMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    const allowedBodyTypes: BodyType[] = ['none', 'json', 'form-data', 'x-www-form-urlencoded', 'raw'];
    const allowedAuthTypes: AuthType[] = ['no-auth', 'api-key', 'bearer', 'basic'];
    const allowedCodeLanguages: CodeLanguage[] = [
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
    ];

    switch (pgAction.name) {
      case 'set_method': {
        const method = String(args.method || '').toUpperCase() as HttpMethod;
        if (!allowedMethods.includes(method)) {
          return { valid: false, reason: 'Invalid HTTP method.' };
        }
        return { valid: true };
      }
      case 'set_url': {
        const url = String(args.url || '').trim();
        if (!url) return { valid: false, reason: 'URL is required.' };
        return { valid: true };
      }
      case 'set_params': {
        if (!Array.isArray(args.params) || args.params.length === 0) {
          return { valid: false, reason: 'At least one query param is required.' };
        }
        const hasInvalid = (args.params as Array<Record<string, unknown>>).some(
          (p) => !String(p.key || '').trim(),
        );
        if (hasInvalid) return { valid: false, reason: 'Param key cannot be empty.' };
        return { valid: true };
      }
      case 'set_headers': {
        if (!Array.isArray(args.headers) || args.headers.length === 0) {
          return { valid: false, reason: 'At least one header is required.' };
        }
        const hasInvalid = (args.headers as Array<Record<string, unknown>>).some(
          (h) => !String(h.key || '').trim(),
        );
        if (hasInvalid) return { valid: false, reason: 'Header name cannot be empty.' };
        return { valid: true };
      }
      case 'set_body': {
        const bodyType = String(args.type || '') as BodyType;
        if (!allowedBodyTypes.includes(bodyType)) {
          return { valid: false, reason: 'Invalid body type.' };
        }
        if (bodyType === 'json' && args.json !== undefined) {
          try {
            JSON.parse(String(args.json));
          } catch {
            return { valid: false, reason: 'Body JSON is not valid JSON.' };
          }
        }
        return { valid: true };
      }
      case 'set_auth': {
        const authType = String(args.type || '') as AuthType;
        if (!allowedAuthTypes.includes(authType)) {
          return { valid: false, reason: 'Invalid auth type.' };
        }
        if (authType === 'api-key' && (!String(args.apiKeyKey || '') || !String(args.apiKeyValue || ''))) {
          return { valid: false, reason: 'API key auth requires key name and value.' };
        }
        if (authType === 'bearer' && !String(args.bearerToken || '')) {
          return { valid: false, reason: 'Bearer auth requires a token value.' };
        }
        if (authType === 'basic' && (!String(args.basicUsername || '') || !String(args.basicPassword || ''))) {
          return { valid: false, reason: 'Basic auth requires username and password.' };
        }
        return { valid: true };
      }
      case 'create_environment_variable': {
        const name = String(args.name || '').trim();
        if (!name) return { valid: false, reason: 'Variable name is required.' };
        if (args.value === undefined || args.value === null) {
          return { valid: false, reason: 'Variable value is required.' };
        }
        return { valid: true };
      }
      case 'run_request': {
        if (!config.url.trim()) {
          return { valid: false, reason: 'Cannot run request without a URL.' };
        }
        return { valid: true };
      }
      case 'save_request':
        return { valid: true };
      case 'generate_code': {
        const language = String(args.language || '') as CodeLanguage;
        if (!allowedCodeLanguages.includes(language)) {
          return { valid: false, reason: 'Unsupported code language.' };
        }
        return { valid: true };
      }
      case 'explain_error': {
        const statusCode = Number(args.statusCode || response?.status || 0);
        if (!statusCode || Number.isNaN(statusCode)) {
          return { valid: false, reason: 'Status code is required for explain_error.' };
        }
        return { valid: true };
      }
      default:
        return { valid: false, reason: 'Unknown action.' };
    }
  };

  // =========================================================
  // ACTION EXECUTOR - Applies Gemini actions to request state
  // =========================================================
  const applyPlaygroundAction = async (pgAction: PlaygroundAction): Promise<string> => {
    const validation = validatePlaygroundAction(pgAction);
    if (!validation.valid) {
      return `Unable to apply ${pgAction.name}: ${validation.reason}`;
    }

    const args = pgAction.args as Record<string, any>;
    const resultLines: string[] = [];

    switch (pgAction.name) {
      case 'set_method': {
        const method = String(args.method || '').toUpperCase() as HttpMethod;
        if (method) {
          setConfig((prev) => ({ ...prev, method }));
          resultLines.push(`Applied: method set to ${method}.`);
        }
        break;
      }

      case 'set_url': {
        const url = String(args.url || '');
        if (url) {
          setConfig((prev) => ({ ...prev, url }));
          resultLines.push(`Applied: URL updated.`);
        }
        break;
      }

      case 'set_params': {
        const params = Array.isArray(args.params) ? args.params : [];
        const items = params.map((p: any, i: number) => ({
          id: `ai-p-${Date.now()}-${i}`,
          key: String(p.key || ''),
          value: String(p.value || ''),
          enabled: p.enabled !== false,
        }));
        if (items.length > 0) {
          setConfig((prev) => ({
            ...prev,
            params: args.replace ? items : mergeKvItems(prev.params, items),
          }));
          setActiveRequestTab('params');
          resultLines.push(`Applied: ${items.length} query param(s) updated.`);
        }
        break;
      }

      case 'set_headers': {
        const headers = Array.isArray(args.headers) ? args.headers : [];
        const items = headers.map((h: any, i: number) => ({
          id: `ai-h-${Date.now()}-${i}`,
          key: String(h.key || ''),
          value: String(h.value || ''),
          enabled: h.enabled !== false,
        }));
        if (items.length > 0) {
          setConfig((prev) => ({
            ...prev,
            headers: args.replace ? items : mergeKvItems(prev.headers, items),
          }));
          setActiveRequestTab('headers');
          resultLines.push(`Applied: ${items.length} header(s) updated.`);
        }
        break;
      }

      case 'set_body': {
        const bodyType = String(args.type || 'none') as BodyType;
        setConfig((prev) => ({
          ...prev,
          body: {
            ...prev.body,
            type: bodyType,
            json: args.json !== undefined ? String(args.json) : prev.body.json,
            raw: args.raw !== undefined ? String(args.raw) : prev.body.raw,
            formData: Array.isArray(args.formData)
              ? args.formData.map((f: any, i: number) => ({
                id: `ai-f-${Date.now()}-${i}`,
                key: String(f.key || ''),
                value: String(f.value || ''),
                enabled: f.enabled !== false,
              }))
              : prev.body.formData,
            urlEncoded: Array.isArray(args.urlEncoded)
              ? args.urlEncoded.map((u: any, i: number) => ({
                id: `ai-u-${Date.now()}-${i}`,
                key: String(u.key || ''),
                value: String(u.value || ''),
                enabled: u.enabled !== false,
              }))
              : prev.body.urlEncoded,
          },
        }));
        setActiveRequestTab('body');
        resultLines.push(`Applied: body updated (${bodyType}).`);
        break;
      }

      case 'set_auth': {
        const authType = String(args.type || 'no-auth') as AuthType;
        setConfig((prev) => ({
          ...prev,
          auth: {
            type: authType,
            apiKeyKey: args.apiKeyKey !== undefined ? String(args.apiKeyKey) : prev.auth.apiKeyKey,
            apiKeyValue: args.apiKeyValue !== undefined ? String(args.apiKeyValue) : prev.auth.apiKeyValue,
            apiKeyIn: args.apiKeyIn ? (String(args.apiKeyIn) as 'header' | 'query') : prev.auth.apiKeyIn,
            bearerToken: args.bearerToken !== undefined ? String(args.bearerToken) : prev.auth.bearerToken,
            basicUsername: args.basicUsername !== undefined ? String(args.basicUsername) : prev.auth.basicUsername,
            basicPassword: args.basicPassword !== undefined ? String(args.basicPassword) : prev.auth.basicPassword,
          },
        }));
        setActiveRequestTab('auth');
        resultLines.push(`Applied: auth set to ${authType}.`);
        break;
      }

      case 'create_environment_variable': {
        const varName = String(args.name || '');
        const varValue = String(args.value || '');
        const isSecret = args.isSecret === true;
        const env =
          activeEnvironment ||
          ({
            id: `env-ai-${Date.now()}`,
            name: 'AI Environment',
            variables: {},
            secrets: {},
            isDefault: false,
          } as Environment);

        const updated: Environment = {
          ...env,
          variables: isSecret ? env.variables : { ...env.variables, [varName]: varValue },
          secrets: isSecret ? { ...env.secrets, [varName]: varValue } : env.secrets,
        };

        setActiveEnvironment(updated);
        setEnvironments((prev) => {
          const existing = prev.find((e) => e.id === updated.id);
          if (existing) {
            return prev.map((e) => (e.id === updated.id ? updated : e));
          }
          return [...prev, updated];
        });
        resultLines.push(`Applied: environment variable {{${varName}}} created.`);
        break;
      }

      case 'run_request': {
        await handleSendRequest();
        resultLines.push('Applied: request execution started.');
        break;
      }

      case 'save_request': {
        if (args.name) {
          setConfig((prev) => ({ ...prev, name: String(args.name) }));
        }
        await saveRequest();
        resultLines.push('Applied: request saved.');
        break;
      }

      case 'generate_code': {
        const lang = String(args.language || 'curl') as CodeLanguage;
        setActiveResponseTab('code');
        resultLines.push(`Applied: code view set to ${lang}.`);
        break;
      }

      case 'explain_error': {
        const statusCode = Number(args.statusCode || response?.status || 0);
        if (statusCode) {
          resultLines.push(`Status ${statusCode}: ${getStatusText(statusCode)}.`);
        }
        break;
      }

      default:
        resultLines.push('Unable to apply action: not recognized.');
    }

    return resultLines.join(' ');
  };

  const applyCopilotSuggestion = async (suggestion: CopilotSuggestion) => {
    if (!suggestion.action) return;
    const confirmation = await applyPlaygroundAction(suggestion.action);
    setCopilotSuggestions((prev) => prev.filter((item) => item.id !== suggestion.id));
    setAiMessages((prev) => [
      ...prev,
      { id: generateId(), role: 'assistant', content: renderAiResponseCard(confirmation, 'Fix applied') },
    ]);
  };

  const rejectCopilotSuggestion = (id: string) => {
    setCopilotSuggestions((prev) => prev.filter((item) => item.id !== id));
  };

  // Send a message to Gemini and handle the action-oriented response
  const sendToGemini = async (userContent: string, action: AiAction) => {
    setIsAiThinking(true);
    setIsRightExpanded(true);
    try {
      const context = buildPlaygroundContext(
        config,
        response,
        activeEnvironment?.name,
        envVariables,
      );
      const actionPrompt = getActionPrompt(action);
      const messages: GeminiMessage[] = [
        ...aiMessagesToGemini(aiMessages),
        { role: 'user', content: actionPrompt ? `${actionPrompt}\n\n${userContent}` : userContent },
      ];
      const reply = await chatWithGemini(messages, context);

      if (reply.type === 'action' && reply.action) {
        const messageId = generateId();
        const proposal: CopilotSuggestion = {
          id: `copilot-chat-${Date.now()}`,
          problem: 'Copilot identified a request change that may help.',
          why: 'It is based on the current request and response context.',
          fix: 'Apply the proposed change to the current request.',
          action: reply.action,
        };
        setAiMessages((prev) => [
          ...prev,
          {
            id: messageId,
            role: 'assistant',
            content: renderCopilotSuggestion(
              proposal,
              () => setAiMessages((messages) => messages.filter((message) => message.id !== messageId)),
              () => setAiMessages((messages) => messages.filter((message) => message.id !== messageId)),
            ),
          },
        ]);
      } else {
        setAiMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant',
            content: renderAiResponseCard(reply.text || 'No response from AI.', 'Copilot'),
          },
        ]);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'AI request failed';
      // Check if it's a key-not-configured error
      const isConfigError = errorMsg.includes('not configured') || errorMsg.includes('GEMINI_API_KEY');
      setAiMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          content: renderAiResponseCard(
            isConfigError
              ? 'Gemini API is not configured. Set the GEMINI_API_KEY environment variable in the backend .env file to enable AI features.'
              : errorMsg,
            'Error',
          ),
          action,
        },
      ]);
    } finally {
      setIsAiThinking(false);
    }
  };

  // Retry sending the last message
  const retryLastAiMessage = () => {
    const lastUserMsg = [...aiMessages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg && typeof lastUserMsg.content === 'string') {
      // Remove the last error assistant message and retry
      setAiMessages((prev) => prev.slice(0, -1));
      sendToGemini(lastUserMsg.content, lastUserMsg.action || 'ask-ai');
    }
  };

  // AI actions
  const runAiAction = (action: AiAction) => {
    const content = ACTION_LABELS[action];
    setAiMessages((prev) => [
      ...prev,
      { id: generateId(), role: 'user', content, action },
    ]);
    sendToGemini(content, action);
  };

  const sendAiMessage = () => {
    if (!aiInput.trim()) return;
    const content = aiInput.trim();
    setAiMessages((prev) => [
      ...prev,
      { id: generateId(), role: 'user', content, action: 'ask-ai' },
    ]);
    setAiInput('');
    sendToGemini(content, 'ask-ai');
  };

  // Render helpers
  const renderStatusBadge = () => {
    if (!response) return null;
    const statusClass = statusColorClass(response.status);
    return (
      <div className={`pg-status-badge pg-${statusClass}`}>
        <span className="pg-status-code">{response.status}</span>
        <span className="pg-status-text">{getStatusText(response.status)}</span>
      </div>
    );
  };

  const renderResponseHeaders = () => {
    if (!response?.headers || Object.keys(response.headers).length === 0) {
      return <div className="pg-empty-inline">No response headers</div>;
    }
    return (
      <div className="pg-headers-grid">
        {Object.entries(response.headers).map(([key, value]) => (
          <div key={key} className="pg-header-row">
            <span className="pg-header-key">{key}</span>
            <span className="pg-header-value">{value}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderResponseContent = () => {
    if (activeResponseTab === 'body') {
      return response?.body ? (
        <div className="pg-response-body">
          {isValidJson(response.body) ? (
            <pre
              className="pg-json-response"
              dangerouslySetInnerHTML={{ __html: highlightJson(formatJson(response.body)) }}
            />
          ) : (
            <pre className="pg-text-response">{response.body}</pre>
          )}
        </div>
      ) : (
        <div className="pg-empty-inline">No response body</div>
      );
    }
    if (activeResponseTab === 'json-tree') {
      return response?.body ? (
        <JsonTreeViewer body={response.body} />
      ) : (
        <div className="pg-empty-inline">No response body</div>
      );
    }
    if (activeResponseTab === 'headers') return renderResponseHeaders();
    if (activeResponseTab === 'raw')
      return (
        <div className="pg-raw-response">
          <pre>{response?.body || ''}</pre>
        </div>
      );
    if (activeResponseTab === 'code')
      return <CodeGenPanel config={config} onCopy={copyToClipboard} />;
    return null;
  };

  const renderResponseState = () => {
    if (isLoading) {
      return (
        <div className="pg-state pg-loading">
          <Loader2 size={28} className="pg-spin" />
          <span>Executing request...</span>
        </div>
      );
    }
    if (!response) {
      return (
        <div className="pg-state pg-empty">
          <Terminal size={32} />
          <p>Send a request to see the response</p>
          <p className="pg-state-sub">Build your request above and hit Send</p>
        </div>
      );
    }
    if (
      response.isTimeout ||
      response.isNetworkError ||
      response.isClientError ||
      response.isServerError
    ) {
      const isError =
        response.isTimeout ||
        response.isNetworkError ||
        response.isClientError ||
        response.isServerError;
      return (
        <div className="pg-state pg-error-state">
          <AlertCircle size={28} />
          <p>
            {response.isTimeout
              ? 'Request Timed Out'
              : response.isNetworkError
                ? 'Network Error'
                : `${response.status} ${getStatusText(response.status)}`}
          </p>
          <p className="pg-state-sub">
            {response.error || 'The request failed. See suggestions below.'}
          </p>
          {errorDiagnosis && (
            <div className="pg-error-diagnosis">
              <div className="pg-error-diagnosis-title">{errorDiagnosis.title}</div>
              <p className="pg-error-diagnosis-message">{errorDiagnosis.message}</p>
              <div className="pg-error-suggestions">
                {errorDiagnosis.suggestions.map((s, i) => (
                  <div key={i} className="pg-error-suggestion">
                    <span className="pg-error-suggestion-cause">{s.cause}</span>
                    <span className="pg-error-suggestion-fix">{s.fix}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    return renderResponseContent();
  };

  // KV rows
  const renderKvRows = (
    kind: 'params' | 'headers' | 'cookies' | 'formData' | 'urlEncoded',
    items: Array<{ id: string; key: string; value: string; enabled: boolean }>,
  ) => (
    <div className="pg-kv-list">
      {items.map((item, index) => (
        <div key={item.id} className="pg-kv-row">
          <input
            type="text"
            value={item.key}
            onChange={(e) => handleKvChange(kind, index, 'key', e.target.value)}
            placeholder="Key"
            className="pg-input pg-input-sm pg-kv-key"
          />
          <input
            type="text"
            value={item.value}
            onChange={(e) => handleKvChange(kind, index, 'value', e.target.value)}
            placeholder="Value"
            className="pg-input pg-input-sm pg-kv-value"
          />
          <button
            className="pg-icon-btn"
            onClick={() => handleKvChange(kind, index, 'enabled', !item.enabled)}
            title={item.enabled ? 'Disable' : 'Enable'}
          >
            {item.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            className="pg-icon-btn pg-danger-hover"
            onClick={() => removeKv(kind, index)}
            title="Remove"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button className="pg-add-row-btn" onClick={() => addKv(kind)}>
        <Plus size={14} />
        <span>
          Add{' '}
          {kind === 'params'
            ? 'Parameter'
            : kind === 'headers'
              ? 'Header'
              : kind === 'cookies'
                ? 'Cookie'
                : 'Field'}
        </span>
      </button>
    </div>
  );

  const renderAuthTab = () => (
    <div className="pg-panel-content pg-scroll">
      <div className="pg-auth-section">
        <label className="pg-label">Authentication Type</label>
        <select
          value={config.auth.type}
          onChange={(e) => handleAuthChange({ ...config.auth, type: e.target.value as AuthType })}
          className="pg-select"
        >
          <option value="no-auth">No Auth</option>
          <option value="api-key">API Key</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
        </select>
      </div>
      {config.auth.type === 'api-key' && (
        <div className="pg-auth-form">
          <div className="pg-form-row">
            <label>Key Name</label>
            <input
              type="text"
              value={config.auth.apiKeyKey || ''}
              onChange={(e) => handleAuthChange({ ...config.auth, apiKeyKey: e.target.value })}
              placeholder="Authorization"
              className="pg-input"
            />
          </div>
          <div className="pg-form-row">
            <label>Key Value</label>
            <input
              type="password"
              value={config.auth.apiKeyValue || ''}
              onChange={(e) => handleAuthChange({ ...config.auth, apiKeyValue: e.target.value })}
              placeholder="Your API key"
              className="pg-input"
            />
          </div>
          <div className="pg-form-row">
            <label>Add to</label>
            <select
              value={config.auth.apiKeyIn || 'header'}
              onChange={(e) =>
                handleAuthChange({ ...config.auth, apiKeyIn: e.target.value as 'header' | 'query' })
              }
              className="pg-select"
            >
              <option value="header">Header</option>
              <option value="query">Query Params</option>
            </select>
          </div>
        </div>
      )}
      {config.auth.type === 'bearer' && (
        <div className="pg-auth-form">
          <div className="pg-form-row">
            <label>Bearer Token</label>
            <input
              type="password"
              value={config.auth.bearerToken || ''}
              onChange={(e) => handleAuthChange({ ...config.auth, bearerToken: e.target.value })}
              placeholder="Your bearer token"
              className="pg-input"
            />
          </div>
        </div>
      )}
      {config.auth.type === 'basic' && (
        <div className="pg-auth-form">
          <div className="pg-form-row">
            <label>Username</label>
            <input
              type="text"
              value={config.auth.basicUsername || ''}
              onChange={(e) => handleAuthChange({ ...config.auth, basicUsername: e.target.value })}
              placeholder="Username"
              className="pg-input"
            />
          </div>
          <div className="pg-form-row">
            <label>Password</label>
            <input
              type="password"
              value={config.auth.basicPassword || ''}
              onChange={(e) => handleAuthChange({ ...config.auth, basicPassword: e.target.value })}
              placeholder="Password"
              className="pg-input"
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderBodyTab = () => (
    <div className="pg-panel-content pg-scroll">
      <div className="pg-body-typebar">
        {(['none', 'json', 'form-data', 'x-www-form-urlencoded', 'raw'] as BodyType[]).map(
          (type) => (
            <button
              key={type}
              className={`pg-body-type ${config.body.type === type ? 'active' : ''}`}
              onClick={() => handleBodyTypeChange(type)}
            >
              {type === 'none' && <BanIcon size={14} />}
              {type === 'json' && <Braces size={14} />}
              {type === 'form-data' && <UploadCloud size={14} />}
              {type === 'x-www-form-urlencoded' && <ListOrdered size={14} />}
              {type === 'raw' && <FileText size={14} />}
              <span>{type === 'x-www-form-urlencoded' ? 'form-urlencoded' : type}</span>
            </button>
          ),
        )}
      </div>

      {config.body.type === 'json' && (
        <div className="pg-editor-wrap">
          <textarea
            ref={jsonRef}
            value={config.body.json || ''}
            onChange={(e) => handleEditorVariableInput(e, 'json')}
            onBlur={() => {
              setActiveEditor(null);
              setAutocompletePos(null);
            }}
            placeholder="Enter JSON body..."
            className="pg-code-editor"
          />
          {inferredSchema.length > 0 && schemaIssues.length > 0 && (
            <div className="pg-schema-validation">
              <div className="pg-schema-validation-head">
                <Braces size={12} />
                <span>
                  Schema Validation ({schemaIssues.length} issue
                  {schemaIssues.length !== 1 ? 's' : ''})
                </span>
              </div>
              {schemaIssues.map((issue, i) => (
                <div key={i} className={`pg-schema-issue pg-schema-issue-${issue.severity}`}>
                  <span className="pg-schema-issue-path">{issue.fieldPath}</span>
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {config.body.type === 'form-data' && renderKvRows('formData', config.body.formData || [])}
      {config.body.type === 'x-www-form-urlencoded' &&
        renderKvRows('urlEncoded', config.body.urlEncoded || [])}

      {config.body.type === 'raw' && (
        <div>
          <div className="pg-raw-toolbar">
            <select
              value={config.body.rawLanguage || 'text'}
              onChange={(e) =>
                handleRawLanguageChange(e.target.value as 'text' | 'json' | 'xml' | 'html')
              }
              className="pg-select pg-select-sm"
            >
              <option value="text">Text</option>
              <option value="json">JSON</option>
              <option value="xml">XML</option>
              <option value="html">HTML</option>
            </select>
          </div>
          <textarea
            value={config.body.raw || ''}
            onChange={handleRawBodyChange}
            placeholder="Enter raw body content..."
            className="pg-code-editor"
          />
        </div>
      )}

      {config.body.type === 'none' && (
        <div className="pg-empty-inline pg-empty-pad">
          <p>This request does not have a body</p>
          <p className="pg-state-sub">Select a body type to add content</p>
        </div>
      )}
    </div>
  );

  const renderRequestTab = () => {
    switch (activeRequestTab) {
      case 'params':
        return renderKvRows('params', config.params);
      case 'headers':
        return renderKvRows('headers', config.headers);
      case 'auth':
        return renderAuthTab();
      case 'body':
        return renderBodyTab();
      case 'cookies':
        return renderKvRows('cookies', config.cookies);
      default:
        return null;
    }
  };

  // =========================================================
  // WORKSPACE HANDLERS
  // =========================================================
  const createWorkspace = () => {
    openInputModal({
      title: 'New Workspace',
      label: 'Workspace Name',
      placeholder: 'e.g. My API Workspace',
      onConfirm: async (name) => {
        try {
          const newWs = await playgroundApi.createWorkspace(name);
          setUserWorkspaces((prev) => [...prev, newWs]);
          setActiveWorkspaceId(newWs.id);
        } catch (_err) {
          const fallbackWs: UserWorkspace = {
            id: `ws-${Date.now()}`,
            name,
            isPinned: false,
            createdAt: new Date().toISOString(),
          };
          setUserWorkspaces((prev) => [...prev, fallbackWs]);
          setActiveWorkspaceId(fallbackWs.id);
        }
      },
    });
  };

  const renameWorkspace = (id: string) => {
    const ws = userWorkspaces.find((w) => w.id === id);
    if (!ws) return;
    openInputModal({
      title: 'Rename Workspace',
      label: 'Workspace Name',
      initialValue: ws.name,
      onConfirm: async (name) => {
        try {
          const updated = await playgroundApi.renameWorkspace(id, name);
          setUserWorkspaces((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
        } catch (_err) {
          setUserWorkspaces((prev) => prev.map((w) => (w.id === id ? { ...w, name } : w)));
        }
      },
    });
  };

  const togglePinWorkspace = async (id: string) => {
    try {
      const updated = await playgroundApi.togglePinWorkspace(id);
      setUserWorkspaces((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch (_err) {
      setUserWorkspaces((prev) =>
        prev.map((w) => (w.id === id ? { ...w, isPinned: !w.isPinned } : w)),
      );
    }
  };

  const handleSelectLocalEndpoint = (api: LocalApi, endpoint: ApiWorkspaceEndpoint) => {
    setSelectedApi(null);
    setSelectedVersion(null);
    setSelectedEndpoint(null);
    setSelectedLocalApi(api);
    setSelectedLocalEndpoint(endpoint);

    const newConfig = emptyRequestConfig();
    newConfig.name = `${endpoint.method} ${endpoint.path}`;
    newConfig.method = endpoint.method as HttpMethod;
    newConfig.url = `${api.baseUrl}${endpoint.path}`;

    if (endpoint.sampleRequest) {
      try {
        const parsed = JSON.parse(endpoint.sampleRequest);
        newConfig.body = { type: 'json', json: JSON.stringify(parsed, null, 2) };
      } catch {
        newConfig.body = { type: 'raw', raw: endpoint.sampleRequest, rawLanguage: 'json' };
      }
    }

    if (endpoint.sampleResponse) {
      setResponse({
        id: generateId(),
        status: 200,
        statusText: 'OK',
        timeMs: 0,
        sizeBytes: new Blob([endpoint.sampleResponse]).size,
        body: endpoint.sampleResponse,
        headers: { 'content-type': 'application/json' },
        isSuccess: true,
        isRedirect: false,
        isClientError: false,
        isServerError: false,
        isTimeout: false,
        isNetworkError: false,
      });
    } else {
      setResponse(null);
    }

    setConfig(newConfig);
  };

  const addLocalApi = () => {
    openInputModal({
      title: 'Add Local API',
      label: 'Base URL',
      placeholder: 'http://localhost:5000/api',
      onConfirm: (baseUrl) => {
        openInputModal({
          title: 'Add Local API',
          label: 'Friendly Name',
          placeholder: 'e.g. localhost:5000',
          initialValue: baseUrl.replace(/^https?:\/\//, ''),
          onConfirm: async (name) => {
            const newLocal: LocalApi = {
              id: `local-${Date.now()}`,
              name,
              baseUrl: baseUrl.trim(),
              description: 'User-added local API',
              accentColor: '#22c55e',
              source: 'local',
              isLocal: true,
              endpoints: [
                { id: `l-${Date.now()}-1`, method: 'GET', path: '/', description: 'Root endpoint' },
              ],
            };
            try {
              const saved = await playgroundApi.createLocalApi(newLocal);
              setLocalApis((prev) => [...prev, saved]);
            } catch (_err) {
              setLocalApis((prev) => [...prev, newLocal]);
            }
          },
        });
      },
    });
  };

  const deleteWorkspace = async (id: string) => {
    try {
      await playgroundApi.deleteWorkspace(id);
    } catch (_err) {
      /* ignore */
    }
    setUserWorkspaces((prev) => {
      const updated = prev.filter((w) => w.id !== id);
      if (activeWorkspaceId === id && updated.length > 0) {
        setActiveWorkspaceId(updated[0].id);
      }
      return updated;
    });
  };

  const deleteLocalApi = async (id: string) => {
    try {
      await playgroundApi.deleteLocalApi(id);
    } catch (_err) {
      /* ignore */
    }
    setLocalApis((prev) => prev.filter((a) => a.id !== id));
  };

  const deleteCollection = async (id: string) => {
    try {
      await playgroundApi.deleteCollection(id);
    } catch (_err) {
      /* ignore */
    }
    setCollections((prev) => prev.filter((c) => c.id !== id));
  };

  const deleteEnvironment = async (id: string) => {
    try {
      await playgroundApi.deleteEnvironment(id);
    } catch (_err) {
      /* ignore */
    }
    setEnvironments((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      if (activeEnvironment?.id === id) {
        setActiveEnvironment(updated[0] || null);
      }
      return updated;
    });
  };

  const openEditEnvironmentModal = (env: Environment) => {
    setEditingEnv(env);
    setEditingEnvName(env.name);
    setEditingEnvVars(
      Object.entries(env.variables || {}).map(([key, value]) => ({
        id: generateId(),
        key,
        value,
      })),
    );
    setEditingEnvSecrets(
      Object.entries(env.secrets || {}).map(([key, value]) => ({
        id: generateId(),
        key,
        value,
      })),
    );
  };

  const closeEditEnvironmentModal = () => {
    setEditingEnv(null);
  };

  const saveEnvironmentModal = async () => {
    if (!editingEnv) return;
    const variables: Record<string, string> = {};
    editingEnvVars.forEach((v) => {
      if (v.key.trim()) variables[v.key.trim()] = v.value;
    });
    const secrets: Record<string, string> = {};
    editingEnvSecrets.forEach((s) => {
      if (s.key.trim()) secrets[s.key.trim()] = s.value;
    });

    const updatedEnv: Environment = {
      ...editingEnv,
      name: editingEnvName.trim() || editingEnv.name,
      variables,
      secrets,
    };

    try {
      const saved = await playgroundApi.updateEnvironment(updatedEnv);
      setEnvironments((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
      if (activeEnvironment?.id === saved.id) {
        setActiveEnvironment(saved);
      }
    } catch (_err) {
      setEnvironments((prev) => prev.map((e) => (e.id === updatedEnv.id ? updatedEnv : e)));
      if (activeEnvironment?.id === updatedEnv.id) {
        setActiveEnvironment(updatedEnv);
      }
    }
    setEditingEnv(null);
  };

  const addConnectedApi = () => {
    openInputModal({
      title: 'Add Connected API',
      label: 'API Name',
      placeholder: 'e.g. GitHub API',
      onConfirm: (name) => {
        openInputModal({
          title: 'Add Connected API',
          label: 'Base URL',
          placeholder: 'https://api.github.com',
          onConfirm: (baseUrl) => {
            const newApi: ApiWorkspaceItem = {
              id: `connected-${Date.now()}`,
              name,
              description: 'User-connected external API',
              provider: 'User Connected',
              accentColor: '#8b5cf6',
              source: 'subscribed',
              isSubscribed: true,
              versions: [
                {
                  id: `conn-v-${Date.now()}`,
                  version: 'v1',
                  isPublished: true,
                  isSubscribed: true,
                  baseUrl: baseUrl.trim(),
                  authType: 'No Auth',
                  authConfig: { type: 'no-auth' },
                  endpoints: [],
                },
              ],
            };
            setWorkspaceApis((prev) => [...prev, newApi]);
          },
        });
      },
    });
  };

  const importApi = () => {
    openInputModal({
      title: 'Import API',
      label: 'OpenAPI / Swagger Spec',
      placeholder: 'Paste OpenAPI / Swagger spec JSON URL or raw JSON...',
      multiline: true,
      onConfirm: () => {
        alert('API import is a Pro feature. Connect via "Add API" for a quick start.');
      },
    });
  };

  const toggleGroup = (groupId: string) => {
    setExpandedApiGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleApiItem = (apiId: string) => {
    setExpandedApiIds((prev) => ({ ...prev, [apiId]: !prev[apiId] }));
  };

  const handleAiShortcut = (label: string, action: AiAction) => {
    setAiMessages((prev) => [...prev, { id: generateId(), role: 'user', content: label, action }]);
    sendToGemini(label, action);
  };

  // Auto-scroll AI chat
  useEffect(() => {
    aiChatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [aiMessages, isAiThinking]);

  // =========================================================
  // RIGHT AI SIDEBAR (Chat-based AI Copilot)
  // =========================================================
  // Context-aware AI shortcut suggestions
  const getContextualShortcuts = useMemo(() => {
    // Failed / error response
    if (
      response &&
      (response.isClientError ||
        response.isServerError ||
        response.isTimeout ||
        response.isNetworkError)
    ) {
      return [
        { id: 'diagnose-error' as AiAction, label: 'Diagnose Error' },
        { id: 'fix-request' as AiAction, label: 'Fix Request' },
        { id: 'explain-request' as AiAction, label: 'Explain Error' },
      ];
    }
    // Successful response
    if (response && response.isSuccess) {
      return [
        { id: 'explain-response' as AiAction, label: 'Explain Response' },
        { id: 'generate-code' as AiAction, label: 'Generate Code' },
        { id: 'suggest-improvements' as AiAction, label: 'Optimize' },
      ];
    }
    // Request has URL / editing
    if (config.url) {
      return [
        { id: 'generate-request' as AiAction, label: 'Generate Request' },
        { id: 'explain-request' as AiAction, label: 'Explain API' },
        { id: 'recommend-endpoint' as AiAction, label: 'Add Auth' },
      ];
    }
    // Default
    return [
      { id: 'generate-request' as AiAction, label: 'Generate Request' },
      { id: 'explain-response' as AiAction, label: 'Explain Response' },
      { id: 'generate-code' as AiAction, label: 'Generate Code' },
      { id: 'suggest-improvements' as AiAction, label: 'Optimize' },
    ];
  }, [response, config.url]);

  // =========================================================
  // AI RESPONSE CARD
  // Renders assistant responses as clean, organized cards
  // showing only the exact relevant answer - no clutter.
  // =========================================================
  const renderAiResponseCard = (text: string, label?: string) => {
    return (
      <div className="pg-ai-card">
        <div className="pg-ai-card-head">
          <Bot size={12} />
          <span>{label || 'AI Copilot'}</span>
        </div>
        <div className="pg-ai-card-body">{text}</div>
      </div>
    );
  };

  const renderCopilotSuggestion = (
    suggestion: CopilotSuggestion,
    onReject?: () => void,
    onApplied?: () => void,
  ) => (
    <div className="pg-copilot-suggestion">
      <div className="pg-copilot-suggestion-row">
        <span>Problem / Observation</span>
        <p>{suggestion.problem}</p>
      </div>
      <div className="pg-copilot-suggestion-row">
        <span>Why</span>
        <p>{suggestion.why}</p>
      </div>
      <div className="pg-copilot-suggestion-row">
        <span>Suggested Fix</span>
        <p>{suggestion.fix}</p>
      </div>
      <div className="pg-copilot-suggestion-actions">
        <button
          className="pg-copilot-fix"
          onClick={async () => {
            await applyCopilotSuggestion(suggestion);
            onApplied?.();
          }}
          disabled={!suggestion.action}
          title={suggestion.action ? 'Apply only this proposed change' : 'No automatic change is available'}
        >
          <Check size={12} /> Fix
        </button>
        <button className="pg-copilot-reject" onClick={onReject || (() => rejectCopilotSuggestion(suggestion.id))}>
          <X size={12} /> Reject
        </button>
      </div>
    </div>
  );

  const renderResponseCopilot = () => {
    if (!response || !copilotAnalysis) return null;
    return (
      <section className="pg-copilot-response" aria-live="polite">
        <div className="pg-copilot-response-head">
          <Sparkles size={14} />
          <span>Response analysis</span>
        </div>
        <p className="pg-copilot-summary">{copilotAnalysis.summary}</p>
        <div className="pg-copilot-details">
          {copilotAnalysis.details.map((detail) => (
            <div key={detail.label}>
              <span>{detail.label}</span>
              <strong>{detail.value}</strong>
            </div>
          ))}
        </div>
        <div className="pg-copilot-observations">
          <span>What to note</span>
          {copilotAnalysis.observations.map((observation) => <p key={observation}>{observation}</p>)}
        </div>
        {copilotSuggestions.length > 0 && (
          <div className="pg-copilot-suggestions">
            <span>Suggested changes</span>
            {copilotSuggestions.map((suggestion) => (
              <React.Fragment key={suggestion.id}>{renderCopilotSuggestion(suggestion)}</React.Fragment>
            ))}
          </div>
        )}
      </section>
    );
  };

  const renderRightSidebar = () => {
    if (!isRightExpanded) {
      return (
        <aside className="pg-right-rail">
          <div className="pg-rail-top">
            <button
              className="pg-rail-btn"
              onClick={() => setIsRightExpanded(true)}
              title="Expand AI sidebar"
            >
              <ChevronsLeft size={16} />
            </button>
          </div>
          <div className="pg-rail-items">
            <button
              className="pg-rail-btn active"
              onClick={() => setIsRightExpanded(true)}
              title="AI Assistant"
            >
              <Bot size={17} />
            </button>
          </div>
        </aside>
      );
    }

    return (
      <aside className="pg-right-sidebar">
        <div className="pg-ai-header">
          <div className="pg-ai-title">
            <Bot size={16} /> <span>AI Copilot</span>
          </div>
          <button
            className="pg-icon-btn"
            onClick={() => setIsRightExpanded(false)}
            title="Collapse AI sidebar"
          >
            <ChevronsRight size={16} />
          </button>
        </div>

        <div className="pg-ai-chat">
          <div className="pg-ai-messages">

            {renderResponseCopilot()}

            {/* Empty state */}
            {aiMessages.length === 0 && !copilotAnalysis && (
              <div className="pg-ai-empty">
                <Sparkles size={20} />
                <p>
                  Ask the AI assistant anything about this API, request or response.
                </p>
              </div>
            )}

            {/* AI conversation */}
            {aiMessages.map((msg) => (
              <div
                key={msg.id}
                className={`pg-ai-msg pg-ai-${msg.role}`}
              >
                {msg.content}
              </div>
            ))}

            {/* Thinking */}
            {isAiThinking && (
              <div className="pg-ai-msg pg-ai-assistant">
                <Loader2 size={13} className="pg-spin" />
                Thinking...
              </div>
            )}

            <div ref={aiChatEndRef} />
          </div>

          {/* Horizontal suggestion chips */}
          <div className="pg-ai-shortcuts">
            {getContextualShortcuts.map((sc) => (
              <button
                key={sc.id}
                className="pg-ai-chip"
                onClick={() => handleAiShortcut(sc.label, sc.id)}
              >
                {sc.label}
              </button>
            ))}

            <button
              className="pg-ai-chip"
              onClick={() => setAiMessages([])}
              title="Clear conversation"
            >
              <X size={10} />
              Clear
            </button>
          </div>

          {/* Input */}
          <div className="pg-ai-input-wrap">
            <textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ask the AI..."
              className="pg-ai-input"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendAiMessage();
                }
              }}
            />

            <button
              className="pg-ai-send"
              onClick={sendAiMessage}
              disabled={!aiInput.trim()}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </aside>
    );
  };

  // =========================================================
  // TOPBAR
  // =========================================================
  const renderTopbar = () => (
    <div className="pg-topbar">
      <div className="pg-topbar-left">
        <button className="pg-back-btn" onClick={onBackToKlyra} title="Back to Klyra">
          <ArrowLeft size={16} />
        </button>
        <div className="pg-topbar-divider" />
        <input
          type="text"
          value={config.name}
          onChange={handleNameChange}
          placeholder="Untitled Request"
          className="pg-request-name-input"
        />
      </div>
      <div className="pg-topbar-center">
        {apiProject ? (
          <div className="pg-topbar-context">
            <span className="pg-context-api">{apiProject.name}</span>
            <span className="pg-context-version">{apiProject.versions.find(version => version.id === apiProject.activeVersionId)?.semver || 'v1.0.0'} · Draft</span>
          </div>
        ) : selectedApi && (
          <div className="pg-topbar-context">
            <span className="pg-context-api">{selectedApi.name}</span>
            {selectedVersion && (
              <span className="pg-context-version">{selectedVersion.version}</span>
            )}
            {selectedEndpoint && (
              <span className="pg-context-endpoint">
                {selectedEndpoint.method} {selectedEndpoint.path}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="pg-topbar-right">
        <div className="pg-env-select-wrap">
          <Globe size={14} />
          <select
            value={activeEnvironment?.id || ''}
            onChange={(e) =>
              setActiveEnvironment(environments.find((env) => env.id === e.target.value) || null)
            }
            className="pg-env-select"
          >
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
                {env.isDefault ? ' (Default)' : ''}
              </option>
            ))}
          </select>
        </div>
        {activeTab?.isDirty && (
          <button className="pg-btn pg-btn-ghost pg-btn-sm" onClick={handleDiscardTab} title="Discard changes">
            <X size={14} /> <span>Discard</span>
          </button>
        )}
        <button className="pg-btn pg-btn-ghost pg-btn-sm" onClick={handleSaveTab} title="Save">
          <Save size={14} /> <span>Save</span>
        </button>
        <button
          className="pg-btn pg-btn-ghost pg-btn-sm"
          onClick={duplicateRequest}
          title="Duplicate"
        >
          <Copy size={14} />
        </button>
        <button className="pg-icon-btn" title="More actions">
          <MoreVertical size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="pg-root" ref={splitRef}>
      {renderTopbar()}

      <div className="pg-body">
        <WorkspaceSidebar
          isExpanded={isLeftExpanded}
          onToggleExpand={() => setIsLeftExpanded(!isLeftExpanded)}
          userWorkspaces={userWorkspaces}
          activeWorkspaceId={activeWorkspaceId}
          onWorkspaceChange={setActiveWorkspaceId}
          onCreateWorkspace={createWorkspace}
          onRenameWorkspace={renameWorkspace}
          onTogglePinWorkspace={togglePinWorkspace}
          onDeleteWorkspace={deleteWorkspace}
          workspaceTab={workspaceTab}
          onTabChange={setWorkspaceTab}
          workspaceApis={workspaceApis}
          localApis={localApis}
          apiSearch={apiSearch}
          onApiSearchChange={setApiSearch}
          expandedApiGroups={expandedApiGroups}
          expandedApiIds={expandedApiIds}
          onToggleGroup={toggleGroup}
          onToggleApiItem={toggleApiItem}
          selectedApi={selectedApi}
          selectedLocalApi={selectedLocalApi}
          selectedEndpoint={selectedEndpoint}
          selectedLocalEndpoint={selectedLocalEndpoint}
          onSelectEndpoint={handleSelectEndpoint}
          onSelectLocalEndpoint={handleSelectLocalEndpoint}
          onAddLocalApi={addLocalApi}
          onDeleteLocalApi={deleteLocalApi}
          onAddConnectedApi={addConnectedApi}
          onImportApi={importApi}
          collections={collections}
          collectionSearch={collectionSearch}
          onCollectionSearchChange={setCollectionSearch}
          onCreateCollection={createCollection}
          onDeleteCollection={deleteCollection}
          onLoadRequest={loadRequest}
          onDeleteRequestFromCollection={deleteRequestFromCollection}
          history={history}
          historySearch={historySearch}
          onHistorySearchChange={setHistorySearch}
          onClearHistory={clearHistory}
          onLoadFromHistory={loadFromHistory}
          onDeleteHistoryEntry={deleteHistoryEntry}
          environments={environments}
          activeEnvironment={activeEnvironment}
          onEnvironmentChange={setActiveEnvironment}
          onCreateEnvironment={createEnvironment}
          onEditEnvironment={openEditEnvironmentModal}
          onDeleteEnvironment={deleteEnvironment}
          workspaceItems={workspaceItems}
          workspaceSearch={workspaceSearch}
          onWorkspaceSearchChange={setWorkspaceSearch}
          onOpenWorkspaceItem={handleOpenWorkspaceItem}
          onWorkspaceAction={handleWorkspaceAction}
          onCreateWorkspaceItem={handleCreateWorkspaceItem}
          onMoveWorkspaceItem={handleMoveWorkspaceItem}
          activeWorkspaceItemId={activeTab?.itemId}
          expandedTreeIds={expandedTreeIds}
          onToggleTreeExpand={(id) =>
            setExpandedTreeIds((prev) => ({ ...prev, [id]: !prev[id] }))
          }
        />

        <div className="pg-workspace">
          {/* Request tabs */}
          <RequestTabs
            tabs={openTabs}
            activeTabId={activeTabId}
            onSelectTab={handleSelectTab}
            onCloseTab={handleCloseTab}
            onNewTab={handleNewTab}
            onRenameTab={handleRenameTab}
          />
          <div
            className="pg-request"
            style={{ height: isRequestMaximized ? '100%' : `${splitRatio}%` }}
          >
            <div className="pg-url-bar">
              <select
                value={config.method}
                onChange={(e) => handleMethodChange(e.target.value as HttpMethod)}
                className={`pg-method-select pg-method-${config.method}`}
                style={{
                  color: METHOD_COLORS[config.method] || '#fff',
                  borderColor: METHOD_COLORS[config.method] || 'var(--border-card)',
                }}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
                <option value="HEAD">HEAD</option>
                <option value="OPTIONS">OPTIONS</option>
              </select>
              <div className="pg-url-input-wrap">
                <input
                  ref={urlRef}
                  type="text"
                  value={config.url}
                  onChange={(e) => handleEditorVariableInput(e, 'url')}
                  onBlur={() => {
                    setActiveEditor(null);
                    setAutocompletePos(null);
                  }}
                  placeholder="https://api.example.com/endpoint"
                  className="pg-url-input"
                />
                {activeEditor && autocompletePos && (
                  <div
                    className="pg-autocomplete"
                    style={{ top: autocompletePos.top, left: autocompletePos.left }}
                  >
                    {filteredVariables.length > 0 ? (
                      filteredVariables.map((name) => (
                        <button
                          key={name}
                          className="pg-autocomplete-item"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            insertVariable(name);
                          }}
                        >
                          <Globe size={12} /> <span>{name}</span>
                        </button>
                      ))
                    ) : (
                      <div className="pg-autocomplete-empty">No variables found</div>
                    )}
                  </div>
                )}
              </div>
              <button className="pg-send-btn" onClick={handleSendRequest} disabled={isLoading || hasBlockingRequestIssue}>
                {isLoading ? <Loader2 size={16} className="pg-spin" /> : <Send size={16} />}
                <span>{isLoading ? 'Sending...' : 'Send'}</span>
              </button>
            </div>

            {requestReadiness.length > 0 && (
              <div className="pg-request-readiness" role="status">
                {requestReadiness.map((issue) => (
                  <button
                    key={`${issue.tab}-${issue.message}`}
                    className={`pg-request-readiness-item ${issue.severity}`}
                    onClick={() => setActiveRequestTab(issue.tab)}
                    title={`Review ${issue.tab}`}
                  >
                    <AlertCircle size={12} />
                    <span>{issue.message}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="pg-request-tabs">
              {(['params', 'authorization', 'headers', 'body', 'cookies'] as const).map((tab) => {
                const count =
                  tab === 'params'
                    ? config.params.filter((p) => p.enabled && p.key).length
                    : tab === 'headers'
                      ? config.headers.filter((h) => h.enabled && h.key).length
                      : tab === 'cookies'
                        ? config.cookies.filter((c) => c.enabled && c.key).length
                        : 0;
                const isActive = activeRequestTab === (tab === 'authorization' ? 'auth' : tab);
                return (
                  <button
                    key={tab}
                    className={`pg-request-tab ${isActive ? 'active' : ''}`}
                    onClick={() =>
                      setActiveRequestTab(tab === 'authorization' ? 'auth' : (tab as RequestTab))
                    }
                  >
                    {tab === 'params' && <ListOrdered size={13} />}
                    {tab === 'authorization' && <Shield size={13} />}
                    {tab === 'headers' && <Eye size={13} />}
                    {tab === 'body' && <Braces size={13} />}
                    {tab === 'cookies' && <Cookie size={13} />}
                    <span>
                      {tab === 'authorization'
                        ? 'Authorization'
                        : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </span>
                    {count > 0 && <span className="pg-tab-count">{count}</span>}
                  </button>
                );
              })}
            </div>

            <div className="pg-request-content">{renderRequestTab()}</div>
          </div>

          {!isRequestMaximized && (
            <div className="pg-split-handle" onMouseDown={startSplitResize}>
              <div className="pg-split-grip" />
            </div>
          )}

          <div
            className="pg-response"
            style={{ height: isRequestMaximized ? '0%' : `${100 - splitRatio}%` }}
          >
            <div className="pg-response-tabs">
              <div className="pg-response-tab-list">
                {(['body', 'json-tree', 'raw', 'headers', 'code'] as ResponseTab[]).map((tab) => (
                  <button
                    key={tab}
                    className={`pg-response-tab ${activeResponseTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveResponseTab(tab)}
                  >
                    {tab === 'body' && <Braces size={13} />}
                    {tab === 'json-tree' && <ListOrdered size={13} />}
                    {tab === 'raw' && <FileText size={13} />}
                    {tab === 'headers' && <Eye size={13} />}
                    {tab === 'code' && <Code size={13} />}

                    <span>
                      {tab === 'json-tree'
                        ? 'JSON Tree'
                        : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="pg-response-actions">
                <button
                  className="pg-icon-btn"
                  onClick={copyResponse}
                  disabled={!response?.body}
                  title="Copy response"
                >
                  <Copy size={13} />
                </button>

                <button
                  className="pg-icon-btn"
                  onClick={downloadResponse}
                  disabled={!response?.body}
                  title="Download response"
                >
                  <Download size={13} />
                </button>

                <button
                  className="pg-icon-btn"
                  onClick={() => setIsRightExpanded(!isRightExpanded)}
                  title={isRightExpanded ? 'Close AI' : 'Open AI Assistant'}
                >
                  {isRightExpanded ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
                </button>
              </div>
            </div>
            <div className="pg-response-content">
              {response && (
                <div className="pg-response-meta">
                  {renderStatusBadge()}
                  <span className="pg-response-metric">
                    <Clock size={12} /> {formatDuration(response.timeMs)}
                  </span>
                  <span className="pg-response-metric">
                    <Server size={12} /> {formatBytes(response.sizeBytes)}
                  </span>
                </div>
              )}
              {renderResponseState()}
            </div>
          </div>
        </div>

        {renderRightSidebar()}
      </div>

      {showSaveExampleModal && (
        <div className="pg-modal-overlay" onClick={() => setShowSaveExampleModal(false)}>
          <div className="pg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pg-modal-head">
              <div className="pg-modal-title">Save as API Example</div>
              <button
                className="pg-icon-btn"
                onClick={() => setShowSaveExampleModal(false)}
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div className="pg-modal-body">
              <div className="pg-form-row">
                <label>Example Name</label>
                <input
                  type="text"
                  value={exampleName}
                  onChange={(e) => setExampleName(e.target.value)}
                  placeholder="Example name"
                  className="pg-input"
                />
              </div>
              <div className="pg-form-row">
                <label>Description (optional)</label>
                <input
                  type="text"
                  value={exampleDescription}
                  onChange={(e) => setExampleDescription(e.target.value)}
                  placeholder="What does this example demonstrate?"
                  className="pg-input"
                />
              </div>
              <div className="pg-form-row">
                <label>Request</label>
                <div className="pg-ai-context-item">
                  <span className="pg-ai-context-key">Endpoint</span>
                  <span className="pg-ai-context-value">
                    {config.method} {config.url || 'No URL'}
                  </span>
                </div>
                <div className="pg-ai-context-item">
                  <span className="pg-ai-context-key">Response</span>
                  <span className="pg-ai-context-value">
                    {response
                      ? `${response.status} ${getStatusText(response.status)}`
                      : 'No response captured'}
                  </span>
                </div>
              </div>
            </div>
            <div className="pg-modal-actions">
              <button
                className="pg-btn pg-btn-ghost pg-btn-sm"
                onClick={() => setShowSaveExampleModal(false)}
              >
                Cancel
              </button>
              <button
                className="pg-btn pg-btn-primary pg-btn-sm"
                onClick={saveAsExample}
                disabled={!exampleName.trim()}
              >
                <FileCode2 size={14} />
                <span>Save Example</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {inputModal && (
        <div className="pg-modal-overlay" onClick={closeInputModal}>
          <div className="pg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pg-modal-head">
              <div className="pg-modal-title">{inputModal.title}</div>
              <button className="pg-icon-btn" onClick={closeInputModal} title="Close">
                <X size={14} />
              </button>
            </div>
            <div className="pg-modal-body">
              <div className="pg-form-row">
                <label>{inputModal.label}</label>
                {inputModal.multiline ? (
                  <textarea
                    ref={inputModalTextareaRef}
                    value={inputModalValue}
                    onChange={(e) => setInputModalValue(e.target.value)}
                    placeholder={inputModal.placeholder}
                    className="pg-input pg-input-textarea"
                    rows={4}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        confirmInputModal();
                      }
                    }}
                  />
                ) : (
                  <input
                    ref={inputModalRef}
                    type="text"
                    value={inputModalValue}
                    onChange={(e) => setInputModalValue(e.target.value)}
                    placeholder={inputModal.placeholder}
                    className="pg-input"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        confirmInputModal();
                      }
                    }}
                  />
                )}
              </div>
            </div>
            <div className="pg-modal-actions">
              <button className="pg-btn pg-btn-ghost pg-btn-sm" onClick={closeInputModal}>
                Cancel
              </button>
              <button
                className="pg-btn pg-btn-primary pg-btn-sm"
                onClick={confirmInputModal}
                disabled={!inputModalValue.trim()}
              >
                <Check size={14} />
                <span>Confirm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog && (
        <div className="pg-confirm-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="pg-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="pg-confirm-title">{confirmDialog.title}</div>
            <div className="pg-confirm-message">{confirmDialog.message}</div>
            <div className="pg-confirm-actions">
              <button className="pg-confirm-btn" onClick={() => setConfirmDialog(null)}>
                Cancel
              </button>
              <button className="pg-confirm-btn danger" onClick={confirmDialog.onConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {editingEnv && (
        <div className="pg-modal-overlay" onClick={closeEditEnvironmentModal}>
          <div className="pg-modal pg-modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="pg-modal-head">
              <div className="pg-modal-title">Edit Environment: {editingEnv.name}</div>
              <button className="pg-icon-btn" onClick={closeEditEnvironmentModal} title="Close">
                <X size={14} />
              </button>
            </div>
            <div className="pg-modal-body">
              <div className="pg-form-row">
                <label>Environment Name</label>
                <input
                  type="text"
                  value={editingEnvName}
                  onChange={(e) => setEditingEnvName(e.target.value)}
                  className="pg-input"
                  placeholder="Environment name"
                />
              </div>

              <div className="pg-env-editor-section">
                <div className="pg-env-editor-header">
                  <h4>Variables</h4>
                  <button
                    className="pg-btn pg-btn-ghost pg-btn-xs"
                    onClick={() => setEditingEnvVars([...editingEnvVars, { id: generateId(), key: '', value: '' }])}
                  >
                    <Plus size={12} /> Add Variable
                  </button>
                </div>
                <div className="pg-env-vars-list">
                  {editingEnvVars.map((varItem, index) => (
                    <div key={varItem.id} className="pg-env-var-item" style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="text"
                        value={varItem.key}
                        onChange={(e) => {
                          const newVars = [...editingEnvVars];
                          newVars[index].key = e.target.value;
                          setEditingEnvVars(newVars);
                        }}
                        className="pg-input pg-env-var-key"
                        placeholder="Key"
                      />
                      <input
                        type="text"
                        value={varItem.value}
                        onChange={(e) => {
                          const newVars = [...editingEnvVars];
                          newVars[index].value = e.target.value;
                          setEditingEnvVars(newVars);
                        }}
                        className="pg-input pg-env-var-value"
                        placeholder="Value"
                      />
                      <button
                        className="pg-icon-btn pg-danger-hover"
                        onClick={() => setEditingEnvVars(editingEnvVars.filter((_, i) => i !== index))}
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pg-env-editor-section">
                <div className="pg-env-editor-header">
                  <h4>Secrets</h4>
                  <button
                    className="pg-btn pg-btn-ghost pg-btn-xs"
                    onClick={() => setEditingEnvSecrets([...editingEnvSecrets, { id: generateId(), key: '', value: '' }])}
                  >
                    <Plus size={12} /> Add Secret
                  </button>
                </div>
                <div className="pg-env-vars-list">
                  {editingEnvSecrets.map((secretItem, index) => (
                    <div key={secretItem.id} className="pg-env-var-item">
                      <input
                        type="text"
                        value={secretItem.key}
                        onChange={(e) => {
                          const newSecrets = [...editingEnvSecrets];
                          newSecrets[index].key = e.target.value;
                          setEditingEnvSecrets(newSecrets);
                        }}
                        className="pg-input pg-env-var-key"
                        placeholder="Key"
                      />
                      <div className="pg-secret-input-wrapper">
                        <input
                          type="password"
                          value={secretItem.value}
                          onChange={(e) => {
                            const newSecrets = [...editingEnvSecrets];
                            newSecrets[index].value = e.target.value;
                            setEditingEnvSecrets(newSecrets);
                          }}
                          className="pg-input pg-env-var-value"
                          placeholder="Secret Value"
                        />
                        <span className="pg-secret-masked">••••••••</span>
                      </div>
                      <button
                        className="pg-icon-btn pg-danger-hover"
                        onClick={() => setEditingEnvSecrets(editingEnvSecrets.filter((_, i) => i !== index))}
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pg-sidebar-note pg-env-note">
                <Shield size={13} />
                <span>
                  Variables are referenced using <code>{'{{variable}}'}</code> syntax. Secrets are always masked in the UI and never exposed in logs or generated code.
                </span>
              </div>
            </div>
            <div className="pg-modal-actions">
              <button className="pg-btn pg-btn-ghost pg-btn-sm" onClick={closeEditEnvironmentModal}>
                Cancel
              </button>
              <button className="pg-btn pg-btn-primary pg-btn-sm" onClick={saveEnvironmentModal}>
                Save Environment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

type CopilotSuggestion = {
  id: string;
  problem: string;
  why: string;
  fix: string;
  action?: PlaygroundAction;
};

type CopilotResponseAnalysis = {
  summary: string;
  details: Array<{ label: string; value: string }>;
  observations: string[];
};
