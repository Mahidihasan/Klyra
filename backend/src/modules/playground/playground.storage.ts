import fs from 'fs';
import path from 'path';
import process from 'process';
import { PlaygroundData, UserWorkspace, Environment, Collection, LocalApi } from './playground.types';
import { WorkspaceItem, WorkspaceItemKind } from './playground.workspace';

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'playground.json');

const DEFAULT_DATA: PlaygroundData = {
  userWorkspaces: [
    {
      id: 'ws-space-default',
      name: 'Default Workspace',
      isPinned: true,
      isDefault: true,
      createdAt: new Date().toISOString(),
    },
  ],
  workspaceApis: [],
  localApis: [],
  collections: [],
  history: [],
  environments: [
    {
      id: 'env-dev',
      name: 'Development',
      variables: { BASE_URL: 'https://api.example.com' },
      secrets: {},
      isDefault: true,
    },
    {
      id: 'env-prod',
      name: 'Production',
      variables: { BASE_URL: 'https://api.example.com' },
      secrets: {},
    },
  ],
  apiExamples: [],
  workspaceItems: [],
};

class PlaygroundStore {
  private data: PlaygroundData;

  constructor() {
    this.ensureFile();
    this.data = this.readFromDisk();
  }

  private ensureFile() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
    }
  }

  private readFromDisk(): PlaygroundData {
    try {
      const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      return {
        userWorkspaces: Array.isArray(parsed.userWorkspaces) ? parsed.userWorkspaces : DEFAULT_DATA.userWorkspaces,
        workspaceApis: Array.isArray(parsed.workspaceApis) ? parsed.workspaceApis : [],
        localApis: Array.isArray(parsed.localApis) ? parsed.localApis : [],
        collections: Array.isArray(parsed.collections) ? parsed.collections : [],
        history: Array.isArray(parsed.history) ? parsed.history : [],
        environments: Array.isArray(parsed.environments) ? parsed.environments : DEFAULT_DATA.environments,
        apiExamples: Array.isArray(parsed.apiExamples) ? parsed.apiExamples : [],
        workspaceItems: Array.isArray(parsed.workspaceItems) ? parsed.workspaceItems : [],
      };
    } catch {
      return { ...DEFAULT_DATA };
    }
  }

  private persist() {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('Persist error:', e);
    }
  }

  getData(): PlaygroundData {
    return this.data;
  }

  getWorkspaces(): UserWorkspace[] {
    return this.data.userWorkspaces;
  }

  getWorkspaceApis() {
    return this.data.workspaceApis;
  }

  getLocalApis(): LocalApi[] {
    return this.data.localApis;
  }

  getCollections(): Collection[] {
    return this.data.collections;
  }

  getHistory() {
    return this.data.history;
  }

  getEnvironments(): Environment[] {
    return this.data.environments;
  }

  getApiExamples() {
    return this.data.apiExamples;
  }

  getWorkspaceItems(): WorkspaceItem[] {
    return this.data.workspaceItems;
  }

  createWorkspace(name: string): UserWorkspace {
    const ws: UserWorkspace = {
      id: `ws-${Date.now().toString(36)}`,
      name,
      isPinned: false,
      createdAt: new Date().toISOString(),
    };
    this.data.userWorkspaces.push(ws);
    this.persist();
    return ws;
  }

  renameWorkspace(id: string, name: string): UserWorkspace | null {
    const ws = this.data.userWorkspaces.find((w) => w.id === id);
    if (!ws) return null;
    ws.name = name;
    this.persist();
    return ws;
  }

  togglePinWorkspace(id: string): UserWorkspace | null {
    const ws = this.data.userWorkspaces.find((w) => w.id === id);
    if (!ws) return null;
    ws.isPinned = !ws.isPinned;
    this.persist();
    return ws;
  }

  deleteWorkspace(id: string): boolean {
    const i = this.data.userWorkspaces.findIndex((w) => w.id === id);
    if (i === -1) return false;
    this.data.userWorkspaces.splice(i, 1);
    this.persist();
    return true;
  }

  createApi(api: any) {
    this.data.workspaceApis.push(api);
    this.persist();
    return api;
  }

  updateApi(api: any) {
    const i = this.data.workspaceApis.findIndex((a) => a.id === api.id);
    if (i === -1) return null;
    this.data.workspaceApis[i] = api;
    this.persist();
    return api;
  }

  deleteApi(id: string): boolean {
    const i = this.data.workspaceApis.findIndex((a) => a.id === id);
    if (i === -1) return false;
    this.data.workspaceApis.splice(i, 1);
    this.persist();
    return true;
  }

  createLocalApi(api: any): LocalApi {
    const newApi: LocalApi = {
      ...api,
      id: api.id || `local-${Date.now().toString(36)}`,
      source: 'local',
      isLocal: true,
      endpoints: api.endpoints || [],
    };
    this.data.localApis.push(newApi);
    this.persist();
    return newApi;
  }

  deleteLocalApi(id: string): boolean {
    const i = this.data.localApis.findIndex((a) => a.id === id);
    if (i === -1) return false;
    this.data.localApis.splice(i, 1);
    this.persist();
    return true;
  }

  createCollection(col: any): Collection {
    const newCol: Collection = {
      id: col.id || `col-${Date.now().toString(36)}`,
      name: col.name || 'Untitled Collection',
      description: col.description || '',
      color: col.color || '#10b981',
      requests: col.requests || [],
      createdAt: col.createdAt || new Date().toISOString(),
      updatedAt: col.updatedAt || new Date().toISOString(),
    };
    this.data.collections.unshift(newCol);
    this.persist();
    return newCol;
  }

  updateCollection(col: any): Collection | null {
    const i = this.data.collections.findIndex((c) => c.id === col.id);
    if (i === -1) return null;
    this.data.collections[i] = { ...this.data.collections[i], ...col, updatedAt: new Date().toISOString() };
    this.persist();
    return this.data.collections[i];
  }

  deleteCollection(id: string): boolean {
    const i = this.data.collections.findIndex((c) => c.id === id);
    if (i === -1) return false;
    this.data.collections.splice(i, 1);
    this.persist();
    return true;
  }

  addRequestToCollection(collectionId: string, request: any): Collection | null {
    const col = this.data.collections.find((c) => c.id === collectionId);
    if (!col) return null;
    col.requests.push(request);
    col.updatedAt = new Date().toISOString();
    this.persist();
    return col;
  }

  deleteRequestFromCollection(collectionId: string, requestId: string): Collection | null {
    const col = this.data.collections.find((c) => c.id === collectionId);
    if (!col) return null;
    col.requests = col.requests.filter((r) => r.id !== requestId);
    col.updatedAt = new Date().toISOString();
    this.persist();
    return col;
  }

  addHistoryEntry(entry: any) {
    const newEntry = {
      ...entry,
      id: entry.id || `hist-${Date.now().toString(36)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
    };
    this.data.history.unshift(newEntry);
    this.data.history = this.data.history.slice(0, 100);
    this.persist();
    return newEntry;
  }

  deleteHistoryEntry(id: string): boolean {
    const i = this.data.history.findIndex((h) => h.id === id);
    if (i === -1) return false;
    this.data.history.splice(i, 1);
    this.persist();
    return true;
  }

  clearHistory() {
    this.data.history = [];
    this.persist();
  }

  createEnvironment(env: any): Environment {
    const newEnv: Environment = {
      id: env.id || `env-${Date.now().toString(36)}`,
      name: env.name || 'New Environment',
      variables: env.variables || {},
      secrets: env.secrets || {},
      isDefault: Boolean(env.isDefault),
    };
    this.data.environments.push(newEnv);
    this.persist();
    return newEnv;
  }

  updateEnvironment(env: any): Environment | null {
    const i = this.data.environments.findIndex((e) => e.id === env.id);
    if (i === -1) return null;
    this.data.environments[i] = env;
    this.persist();
    return env;
  }

  deleteEnvironment(id: string): boolean {
    const i = this.data.environments.findIndex((e) => e.id === id);
    if (i === -1) return false;
    this.data.environments.splice(i, 1);
    this.persist();
    return true;
  }

  createApiExample(example: any) {
    const newExample = {
      ...example,
      id: example.id || `example-${Date.now().toString(36)}`,
      createdAt: example.createdAt || new Date().toISOString(),
      updatedAt: example.updatedAt || new Date().toISOString(),
    };
    this.data.apiExamples.unshift(newExample);
    this.persist();
    return newExample;
  }

  deleteApiExample(id: string): boolean {
    const i = this.data.apiExamples.findIndex((e) => e.id === id);
    if (i === -1) return false;
    this.data.apiExamples.splice(i, 1);
    this.persist();
    return true;
  }

  // =========================================================
  // WORKSPACE ITEMS (unified tree model)
  // =========================================================

  createWorkspaceItem(item: Partial<WorkspaceItem>): WorkspaceItem {
    const now = new Date().toISOString();
    const newItem: WorkspaceItem = {
      id: item.id || `wi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      kind: item.kind || 'request',
      name: item.name || 'Untitled',
      parentId: item.parentId,
      order: item.order ?? this.data.workspaceItems.length,
      createdAt: now,
      updatedAt: now,
      isPinned: Boolean(item.isPinned),
      collectionId: item.collectionId,
      request: item.request,
      description: item.description,
      color: item.color,
      workspaceId: item.workspaceId,
      apiId: item.apiId,
      endpointId: item.endpointId,
      method: item.method,
      url: item.url,
    };
    this.data.workspaceItems.push(newItem);
    this.persist();
    return newItem;
  }

  updateWorkspaceItem(id: string, patch: Partial<WorkspaceItem>): WorkspaceItem | null {
    const item = this.data.workspaceItems.find((i) => i.id === id);
    if (!item) return null;
    Object.assign(item, patch, { updatedAt: new Date().toISOString() });
    this.persist();
    return item;
  }

  deleteWorkspaceItem(id: string): boolean {
    // Also delete descendants (children of this item)
    const toDelete = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      this.data.workspaceItems.forEach((item) => {
        if (item.parentId && toDelete.has(item.parentId) && !toDelete.has(item.id)) {
          toDelete.add(item.id);
          changed = true;
        }
      });
    }
    const before = this.data.workspaceItems.length;
    this.data.workspaceItems = this.data.workspaceItems.filter((i) => !toDelete.has(i.id));
    if (this.data.workspaceItems.length === before) return false;
    this.persist();
    return true;
  }

  moveWorkspaceItem(id: string, parentId: string | null, order?: number): WorkspaceItem | null {
    const item = this.data.workspaceItems.find((i) => i.id === id);
    if (!item) return null;
    item.parentId = parentId || undefined;
    if (order !== undefined) item.order = order;
    item.updatedAt = new Date().toISOString();
    this.persist();
    return item;
  }

  reorderWorkspaceItem(id: string, order: number): WorkspaceItem | null {
    const item = this.data.workspaceItems.find((i) => i.id === id);
    if (!item) return null;
    item.order = order;
    item.updatedAt = new Date().toISOString();
    this.persist();
    return item;
  }

  togglePinWorkspaceItem(id: string): WorkspaceItem | null {
    const item = this.data.workspaceItems.find((i) => i.id === id);
    if (!item) return null;
    item.isPinned = !item.isPinned;
    item.updatedAt = new Date().toISOString();
    this.persist();
    return item;
  }

  duplicateWorkspaceItem(id: string): WorkspaceItem | null {
    const item = this.data.workspaceItems.find((i) => i.id === id);
    if (!item) return null;
    const now = new Date().toISOString();
    const copy: WorkspaceItem = {
      ...item,
      id: `wi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${item.name} (Copy)`,
      parentId: item.parentId,
      order: item.order + 0.5,
      createdAt: now,
      updatedAt: now,
      isPinned: false,
    };
    this.data.workspaceItems.push(copy);
    this.persist();
    return copy;
  }

  // Migration: build workspace items from existing collections/requests
  migrateFromLegacy(): WorkspaceItem[] {
    if (this.data.workspaceItems.length > 0) return this.data.workspaceItems;
    const now = new Date().toISOString();
    const items: WorkspaceItem[] = [];
    let order = 0;
    this.data.collections.forEach((col) => {
      const colItem: WorkspaceItem = {
        id: `wi-col-${col.id}`,
        kind: 'collection',
        name: col.name,
        order: order++,
        createdAt: col.createdAt || now,
        updatedAt: col.updatedAt || now,
        isPinned: false,
        description: col.description,
        color: col.color,
      };
      items.push(colItem);
      col.requests.forEach((req) => {
        items.push({
          id: `wi-req-${req.id}`,
          kind: 'request',
          name: req.name,
          parentId: colItem.id,
          order: order++,
          createdAt: req.createdAt || now,
          updatedAt: req.updatedAt || now,
          isPinned: false,
          collectionId: col.id,
          request: req.config,
          method: req.config.method,
          url: req.config.url,
        });
      });
    });
    this.data.workspaceItems = items;
    this.persist();
    return items;
  }
}

export const playgroundStore = new PlaygroundStore();