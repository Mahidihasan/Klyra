# Phase 1 Feature Designs: Enterprise Control Plane Foundation

## 1. ENVIRONMENT SWITCHER & CONTEXT

### Problem
Users don't know which environment (dev/staging/prod) they're editing. Environment is buried in tabs. Changes are made without environmental awareness.

### Solution

#### UI Component: Environment Selector
```
┌─ Klyra ──────────────────────────────────────────────┐
│ [Project: Payment API v2.4]     [🔒 Development ▼]   │
└───────────────────────────────────────────────────────┘

When clicked:
┌──────────────────────────────────┐
│ 🟢 Development  (current)        │
│ 🟡 Staging                       │
│ 🔴 Production  [🔒 locked]       │
│                                  │
│ [Switch to Staging]              │
└──────────────────────────────────┘
```

#### Persistent Header Display
```
API: Payment API
├─ Environment: Production
├─ Version: v2.4.0
├─ Status: ✅ Healthy (99.98%)
└─ [Switch] [View Diff]
```

#### Implementation Points

**Frontend (`frontend/src/context/EnvironmentContext.tsx`)**:
```typescript
export interface EnvironmentContext {
  current: 'development' | 'staging' | 'production';
  availableEnvironments: Environment[];
  isLocked: boolean;
  canSwitch: boolean;
  switchTo(env: string): Promise<void>;
  getConfig(env: string): ProjectConfig;
  compare(env1: string, env2: string): ConfigDiff;
}

// Add to each tab's header:
<EnvironmentIndicator 
  current={env} 
  locked={env === 'production' && !hasRole('ReleaseManager')}
/>
```

**Backend (`backend/src/modules/api-build/api-build.environment.ts`)**:
```typescript
export async function getEnvironmentConfig(
  projectId: string,
  environment: 'dev' | 'staging' | 'prod'
): Promise<EnvironmentConfig> {
  // Fetch environment-specific overrides
  const base = await getProject(projectId);
  const overrides = await getEnvironmentOverrides(projectId, environment);
  return merge(base, overrides);
}

export async function compareEnvironments(
  projectId: string,
  env1: string,
  env2: string
): Promise<ConfigDiff> {
  const config1 = await getEnvironmentConfig(projectId, env1);
  const config2 = await getEnvironmentConfig(projectId, env2);
  return computeDiff(config1, config2);
}
```

**Routes**:
```
GET /projects/:id/environments
GET /projects/:id/environments/:env/config
GET /projects/:id/environments/:env1/diff/:env2
PUT /projects/:id/environments/:env/config
```

**Database** (`backend/prisma/migrations/`):
```sql
CREATE TABLE api_build_environment_overrides (
  id UUID PRIMARY KEY,
  project_id VARCHAR(160),
  environment VARCHAR(20),
  config_key VARCHAR(256),
  config_value JSONB,
  override_reason TEXT,
  overridden_at TIMESTAMP,
  overridden_by VARCHAR(256),
  UNIQUE(project_id, environment, config_key)
);
```

---

## 2. DRAFT & UNSAVED STATE SYSTEM

### Problem
Users make changes and navigate away, losing work. No visibility into what's unsaved. No ability to review before committing.

### Solution

#### State Model
```typescript
// Separate server state from draft state
export interface ProjectState {
  // Immutable server state
  server: {
    id: string;
    name: string;
    version: string; // for optimistic concurrency
    config: ProjectConfig;
    lastSavedAt: string;
  };
  
  // Working draft (can be discarded)
  draft: {
    config: ProjectConfig;
    changes: Change[];
    lastModifiedAt: string;
    isValid: boolean;
  };
  
  // What's actually being edited right now
  unsavedChanges: boolean;
  
  // Pending operations
  operations: Operation[];
}
```

#### UI: Unsaved Changes Indicator
```
┌─────────────────────────────────────┐
│ ⚠️  3 unsaved changes               │
│                                     │
│ [Save Draft] [Review] [Discard]    │
└─────────────────────────────────────┘
```

#### Flow
```
User makes change
  ↓
Draft updated immediately (optimistic)
  ↓
"Unsaved changes" banner appears
  ↓
User can:
  - Save draft (to localStorage + server)
  - Review changes (show diff)
  - Discard (revert to last saved)
  ↓
Draft persists through navigation/refresh
  ↓
User can later deploy draft
```

#### Implementation

**Frontend Hook** (`frontend/src/hooks/useDraftState.ts`):
```typescript
export function useDraftState(projectId: string) {
  const [server, setServer] = useState<ProjectConfig | null>(null);
  const [draft, setDraft] = useState<ProjectConfig | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Load initial state
  useEffect(() => {
    const loadState = async () => {
      const serverConfig = await apiBuildService.getProject(projectId);
      const savedDraft = localStorage.getItem(`draft_${projectId}`);
      setServer(serverConfig);
      setDraft(savedDraft ? JSON.parse(savedDraft) : serverConfig);
    };
    loadState();
  }, [projectId]);
  
  // Warn on leave if unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);
  
  const updateDraft = (patch: Partial<ProjectConfig>) => {
    const updated = { ...draft, ...patch };
    setDraft(updated);
    localStorage.setItem(`draft_${projectId}`, JSON.stringify(updated));
    setHasUnsavedChanges(!isEqual(updated, server));
  };
  
  const saveDraft = async () => {
    await apiBuildService.saveDraft(projectId, draft);
    setServer(draft);
    setHasUnsavedChanges(false);
    localStorage.removeItem(`draft_${projectId}`);
  };
  
  const discardDraft = () => {
    setDraft(server);
    setHasUnsavedChanges(false);
    localStorage.removeItem(`draft_${projectId}`);
  };
  
  return {
    server, draft, hasUnsavedChanges,
    updateDraft, saveDraft, discardDraft
  };
}
```

**Backend Endpoints** (`backend/src/modules/api-build/api-build.routes.ts`):
```typescript
// Save draft (doesn't affect live config)
router.patch('/projects/:id/draft', async (req, res) => {
  const updated = await saveDraftConfig(req.params.id, req.body);
  ok(res, { draft: updated.draft, hasChanges: updated.hasChanges });
});

// Promote draft to live (with validation)
router.post('/projects/:id/draft/save', async (req, res) => {
  const validated = await validateDraftChanges(req.params.id);
  if (!validated.ok) {
    return fail(res, 400, 'VALIDATION_FAILED', validated.error);
  }
  const result = await promoteDraftToLive(req.params.id);
  ok(res, result);
});

// Discard draft
router.delete('/projects/:id/draft', async (req, res) => {
  await discardDraft(req.params.id);
  ok(res, { discarded: true });
});
```

**Database Schema**:
```sql
ALTER TABLE api_build_projects ADD COLUMN draft_config JSONB;
ALTER TABLE api_build_projects ADD COLUMN draft_updated_at TIMESTAMP;
ALTER TABLE api_build_projects ADD COLUMN draft_by VARCHAR(256);
```

---

## 3. CHANGE CENTER

### Problem
Users make bulk changes without understanding impact. No review mechanism. Changes are applied immediately without control.

### Solution

#### UI: Changes Panel
```
┌─────────────────────────────────────┐
│ Changes (12 pending)                │
├─────────────────────────────────────┤
│                                     │
│ Contract                            │
│ ✅ [+] POST /users                  │
│ ✅ [~] GET /users schema updated    │
│ ❌ [+] DELETE /legacy (deprecated)  │
│                                     │
│ Gateway                             │
│ ✅ [~] Rate limit: 500→1000         │
│ ✅ [~] Cache TTL: 60→30s            │
│                                     │
│ Security                            │
│ ✅ [~] OAuth scope changed          │
│                                     │
│ [Select All] [Deselect All]         │
│                                     │
│ ┌────────────────────────────────┐  │
│ │ ✅ POST /users                 │  │
│ │ Add new endpoint               │  │
│ │                                │  │
│ │ Before: —                      │  │
│ │ After: POST /users (summary)   │  │
│ │                                │  │
│ │ Consumers affected: 3          │  │
│ │ Breaking: No                   │  │
│ │                                │  │
│ │ [View full diff] [Ignore]      │  │
│ └────────────────────────────────┘  │
│                                     │
│ [Save Changes] [Deploy All]         │
└─────────────────────────────────────┘
```

#### Change Object
```typescript
export interface Change {
  id: string;
  type: 'add' | 'modify' | 'delete';
  category: 'contract' | 'gateway' | 'security' | 'environment';
  resource: string; // endpoint path, policy name, etc.
  before: unknown;
  after: unknown;
  impact: {
    affectedConsumers: string[];
    isBreaking: boolean;
    requiresApproval: boolean;
    riskLevel: 'low' | 'medium' | 'high';
  };
  isSelected: boolean;
}
```

#### Implementation

**Compute Changes** (`backend/src/modules/api-build/api-build.changes.ts`):
```typescript
export async function computeChanges(
  projectId: string,
  draftConfig: ProjectConfig
): Promise<Change[]> {
  const current = await getProject(projectId);
  const changes: Change[] = [];
  
  // Compute endpoint changes
  const endpointDiff = computeEndpointDiff(
    current.endpoints,
    draftConfig.endpoints
  );
  changes.push(...endpointDiff);
  
  // Compute policy changes
  const policyDiff = computePolicyDiff(
    current.policies,
    draftConfig.policies
  );
  changes.push(...policyDiff);
  
  // Analyze impact
  for (const change of changes) {
    change.impact = await analyzeImpact(projectId, change);
  }
  
  return changes;
}

export async function analyzeImpact(
  projectId: string,
  change: Change
): Promise<Change['impact']> {
  // Check which consumers use affected resource
  const affectedConsumers = await findAffectedConsumers(
    projectId,
    change.resource
  );
  
  // Check if breaking
  const isBreaking = detectBreakingChange(change);
  
  return {
    affectedConsumers: affectedConsumers.map(c => c.id),
    isBreaking,
    requiresApproval: isBreaking || affectedConsumers.length > 5,
    riskLevel: isBreaking ? 'high' : 'medium'
  };
}
```

**Frontend Components** (`frontend/src/components/ChangeCenter.tsx`):
```typescript
export function ChangeCenter() {
  const { draft, server } = useDraftState();
  const [changes, setChanges] = useState<Change[]>([]);
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    const compute = async () => {
      const computed = await apiBuildService.computeChanges(draft);
      setChanges(computed);
    };
    compute();
  }, [draft]);
  
  const toggleChange = (changeId: string) => {
    const updated = new Set(selectedChanges);
    if (updated.has(changeId)) updated.delete(changeId);
    else updated.add(changeId);
    setSelectedChanges(updated);
  };
  
  const applySelectedChanges = async () => {
    const toApply = changes.filter(c => selectedChanges.has(c.id));
    await apiBuildService.applyChanges(toApply);
    // Refresh and clear selection
  };
  
  return (
    <div className="change-center">
      <header>
        <h2>Changes ({changes.length} pending)</h2>
        <button onClick={() => setSelectedChanges(new Set(changes.map(c => c.id)))}>
          Select All
        </button>
        <button onClick={() => setSelectedChanges(new Set())}>
          Deselect All
        </button>
      </header>
      
      <div className="changes-list">
        {changes.map(change => (
          <ChangeItem
            key={change.id}
            change={change}
            isSelected={selectedChanges.has(change.id)}
            onToggle={() => toggleChange(change.id)}
          />
        ))}
      </div>
      
      <footer>
        <button onClick={applySelectedChanges} disabled={selectedChanges.size === 0}>
          Apply Selected Changes
        </button>
      </footer>
    </div>
  );
}
```

---

## 4. OPERATIONS RESOURCE MODEL

### Problem
Long-running operations (deploy, import, sync) are invisible. Users don't know if action succeeded. Can't cancel or retry.

### Solution

#### Operation Object
```typescript
export interface Operation {
  id: string;
  projectId: string;
  type: 'DEPLOY' | 'IMPORT' | 'SYNC' | 'ROLLBACK' | 'MIGRATE' | 'ROTATE_KEY';
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  progress: {
    current: number;
    total: number;
    percentage: number;
    stage: string;
  };
  input: unknown;
  output?: unknown;
  error?: {
    code: string;
    message: string;
    details: unknown;
  };
  logs: string[];
  warnings: string[];
  timestamps: {
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
  };
  actor: {
    id: string;
    email: string;
  };
  actions: {
    canCancel: boolean;
    canRetry: boolean;
    canRollback: boolean;
  };
}
```

#### UI: Operations Panel
```
┌─────────────────────────────────────────────┐
│ Operations (Active: 1, Recent: 5)           │
├─────────────────────────────────────────────┤
│                                             │
│ DEPLOY v2.4.0 → Production        ▶ 65%    │
│ Started 2 min ago by alex@...     ⏱  3m   │
│                                             │
│ ┌─────────────────────────────────┐         │
│ │████████████████░░░░░░░░░░░░░░░│ 65%      │
│ └─────────────────────────────────┘         │
│                                             │
│ Stage: Deploying to canary (25%)            │
│ [Pause] [Rollback] [Cancel]                 │
│                                             │
│ Recent                                      │
│ ├─ IMPORT OpenAPI ✅ completed 5m ago       │
│ ├─ SYNC changes ✅ completed 12m ago       │
│ └─ DEPLOY v2.3.9 ✅ completed 1h ago       │
│                                             │
└─────────────────────────────────────────────┘
```

#### Implementation

**Backend** (`backend/src/modules/api-build/api-build.operations.ts`):
```typescript
export async function createOperation(
  projectId: string,
  type: Operation['type'],
  input: unknown
): Promise<Operation> {
  const op: Operation = {
    id: generateId('op'),
    projectId,
    type,
    status: 'queued',
    progress: { current: 0, total: 100, percentage: 0, stage: 'queued' },
    input,
    logs: [],
    warnings: [],
    timestamps: { createdAt: new Date().toISOString() },
    actor: { id: actorId, email: actorEmail },
    actions: { canCancel: true, canRetry: false, canRollback: false }
  };
  
  await pool.query(
    'INSERT INTO api_build_operations (id, project_id, data) VALUES ($1, $2, $3)',
    [op.id, projectId, JSON.stringify(op)]
  );
  
  return op;
}

export async function updateOperationProgress(
  operationId: string,
  current: number,
  total: number,
  stage: string,
  log?: string
) {
  const percentage = Math.round((current / total) * 100);
  const update = {
    progress: { current, total, percentage, stage }
  };
  if (log) {
    update['$push'] = { logs: log };
  }
  
  await pool.query(
    'UPDATE api_build_operations SET data = jsonb_set(data, ...) WHERE id = $1',
    [operationId]
  );
}

export async function completeOperation(
  operationId: string,
  status: 'succeeded' | 'failed',
  output?: unknown,
  error?: Operation['error']
) {
  await pool.query(
    `UPDATE api_build_operations 
     SET data = $1 
     WHERE id = $2`,
    [
      JSON.stringify({
        status,
        output,
        error,
        'timestamps.completedAt': new Date().toISOString()
      }),
      operationId
    ]
  );
}
```

**Database**:
```sql
CREATE TABLE api_build_operations (
  id VARCHAR(160) PRIMARY KEY,
  project_id VARCHAR(160),
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  INDEX (project_id, created_at DESC)
);
```

**Frontend** (`frontend/src/components/OperationsPanel.tsx`):
```typescript
export function OperationsPanel({ projectId }: { projectId: string }) {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [activeOp, setActiveOp] = useState<Operation | null>(null);
  
  // Real-time updates via WebSocket
  useEffect(() => {
    const ws = new WebSocket(`wss://klyra.dev/ws/operations/${projectId}`);
    
    ws.onmessage = (e) => {
      const op: Operation = JSON.parse(e.data);
      setOperations(prev => {
        const idx = prev.findIndex(o => o.id === op.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = op;
          return updated;
        }
        return [op, ...prev];
      });
    };
    
    return () => ws.close();
  }, [projectId]);
  
  const handleCancel = async (opId: string) => {
    await apiBuildService.cancelOperation(projectId, opId);
  };
  
  return (
    <div className="operations-panel">
      <div className="operations-list">
        {operations.filter(o => o.status !== 'completed').map(op => (
          <OperationCard
            key={op.id}
            operation={op}
            onCancel={() => handleCancel(op.id)}
            onClick={() => setActiveOp(op)}
          />
        ))}
      </div>
      
      {activeOp && (
        <OperationDetail operation={activeOp} onClose={() => setActiveOp(null)} />
      )}
    </div>
  );
}
```

---

## 5. OPTIMISTIC CONCURRENCY CONTROL

### Problem
Two users editing same resource results in silent overwrites (last-write-wins).

### Solution

#### Version Field
```sql
ALTER TABLE api_build_projects ADD COLUMN version INTEGER DEFAULT 1;
```

#### Conflict Handling
```typescript
// Frontend
const saveProject = async (projectId: string, patch: Partial<ProviderProject>) => {
  try {
    const result = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: {
        'If-Match': currentVersion.toString() // Attach version
      },
      body: JSON.stringify(patch)
    });
    
    if (result.status === 409) {
      const { currentVersion: serverVersion, data: serverData } = await result.json();
      showConflictModal({
        clientVersion: patch,
        serverVersion: serverData,
        onResolve: (resolution) => {
          // Retry with resolved version
        }
      });
    }
  } catch (e) { /* ... */ }
};

// Backend
router.put('/projects/:id', async (req, res) => {
  const clientVersion = parseInt(req.headers['if-match'] || '0');
  const current = await getProject(req.params.id);
  
  if (current.version !== clientVersion) {
    return res.status(409).json({
      error: 'CONFLICT',
      currentVersion: current.version,
      data: current
    });
  }
  
  const updated = await updateProject(req.params.id, {
    ...req.body,
    version: current.version + 1
  });
  
  res.json(updated);
});
```

---

## 6. RESOURCE HISTORY & AUDIT LOG

### Problem
Users can't see who changed what. No rollback option. Debugging is difficult.

### Solution

#### Audit Log Table
```sql
CREATE TABLE api_build_audit_log (
  id UUID PRIMARY KEY,
  project_id VARCHAR(160),
  actor_id VARCHAR(256),
  actor_email VARCHAR(256),
  timestamp TIMESTAMP DEFAULT NOW(),
  resource_type VARCHAR(50), -- 'project', 'endpoint', 'policy', etc.
  resource_id VARCHAR(256),
  operation VARCHAR(20), -- 'create', 'update', 'delete'
  before JSONB,
  after JSONB,
  change_summary TEXT,
  request_id VARCHAR(256),
  context JSONB,
  INDEX (project_id, timestamp DESC)
);
```

#### UI: History Tab
```
┌─────────────────────────────────┐
│ History (Last 30 days)          │
├─────────────────────────────────┤
│                                 │
│ Sep 12, 14:22  UPDATE           │
│ Alex changed rate limit         │
│ Project → Gateway → Rate Limit  │
│ 500 → 1000 requests/min         │
│ Reason: Enterprise traffic      │
│ [View diff] [Rollback]          │
│                                 │
│ Sep 12, 13:15  DEPLOY           │
│ Alex deployed v2.4.0            │
│ Staging → Production (canary)   │
│ [View operation] [View logs]    │
│                                 │
│ Sep 12, 10:45  UPDATE           │
│ System updated endpoint         │
│ Added health check              │
│                                 │
│ Filter: [All] [Updates] [Deploys] │
└─────────────────────────────────┘
```

#### Implementation
See session memory for full technical details.

---

## REFERENCES

- **Current Frontend**: `frontend/src/pages/ApiBuild/`
- **Current Backend**: `backend/src/modules/api-build/`
- **Existing Types**: `frontend/src/types/apibuild.ts`
- **Existing Services**: `frontend/src/services/apiBuild.ts`

---

## NEXT STEPS

1. **Start with Draft System** (item #2) — foundation for all other features
2. **Add Authorization** (item #8) — gate all mutations
3. **Implement Operations** (item #4) — visibility for async work
4. **Add Audit Log** (item #6) — immutable history
5. **Polish UX** — empty states, async states, error handling

This phased approach ensures core business logic is solid before adding UI refinements.
