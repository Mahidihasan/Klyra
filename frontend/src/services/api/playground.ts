import {
  PlaygroundData,
  UserWorkspace,
  LocalApi,
  Collection,
  HistoryEntry,
  Environment,
  RequestConfig,
  PlaygroundResponse,
  SavedRequest,
  WorkspaceItem,
} from '../../types/playground';

const API_BASE_URL = '/api/playground';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const json = JSON.parse(errorText);
      if (json.error) errorMessage = json.error;
    } catch {
      if (errorText) errorMessage = errorText;
    }
    throw new Error(errorMessage);
  }
  if (res.status === 204) {
    return {} as T;
  }
  return res.json();
}

export const playgroundApi = {
  // Full data loader
  async fetchPlaygroundData(): Promise<PlaygroundData> {
    const res = await fetch(`${API_BASE_URL}/data`);
    return handleResponse<PlaygroundData>(res);
  },

  // Workspaces
  async createWorkspace(name: string): Promise<UserWorkspace> {
    const res = await fetch(`${API_BASE_URL}/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return handleResponse<UserWorkspace>(res);
  },

  async renameWorkspace(id: string, name: string): Promise<UserWorkspace> {
    const res = await fetch(`${API_BASE_URL}/workspaces/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return handleResponse<UserWorkspace>(res);
  },

  async togglePinWorkspace(id: string): Promise<UserWorkspace> {
    const res = await fetch(`${API_BASE_URL}/workspaces/${id}/pin`, {
      method: 'POST',
    });
    return handleResponse<UserWorkspace>(res);
  },

  async deleteWorkspace(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/workspaces/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  // Local APIs
  async createLocalApi(api: LocalApi): Promise<LocalApi> {
    const res = await fetch(`${API_BASE_URL}/local-apis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(api),
    });
    return handleResponse<LocalApi>(res);
  },

  async deleteLocalApi(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/local-apis/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  // Collections
  async createCollection(collection: Partial<Collection>): Promise<Collection> {
    const res = await fetch(`${API_BASE_URL}/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collection),
    });
    return handleResponse<Collection>(res);
  },

  async updateCollection(collection: Collection): Promise<Collection> {
    const res = await fetch(`${API_BASE_URL}/collections/${collection.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collection),
    });
    return handleResponse<Collection>(res);
  },

  async deleteCollection(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/collections/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  async addRequestToCollection(collectionId: string, request: SavedRequest): Promise<Collection> {
    const res = await fetch(`${API_BASE_URL}/collections/${collectionId}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return handleResponse<Collection>(res);
  },

  async deleteRequestFromCollection(collectionId: string, requestId: string): Promise<Collection> {
    const res = await fetch(
      `${API_BASE_URL}/collections/${collectionId}/requests/${requestId}`,
      { method: 'DELETE' },
    );
    return handleResponse<Collection>(res);
  },

  // History
  async addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): Promise<HistoryEntry> {
    const res = await fetch(`${API_BASE_URL}/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    return handleResponse<HistoryEntry>(res);
  },

  async clearHistory(): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/history`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  async deleteHistoryEntry(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/history/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  // Environments
  async createEnvironment(env: Partial<Environment>): Promise<Environment> {
    const res = await fetch(`${API_BASE_URL}/environments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(env),
    });
    return handleResponse<Environment>(res);
  },

  async updateEnvironment(env: Environment): Promise<Environment> {
    const res = await fetch(`${API_BASE_URL}/environments/${env.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(env),
    });
    return handleResponse<Environment>(res);
  },

  async deleteEnvironment(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/environments/${id}`, {
      method: 'DELETE',
    });
    return handleResponse<void>(res);
  },

  // Execute request via backend proxy
  async executeRequest(
    config: RequestConfig,
    environment: Environment | null,
  ): Promise<PlaygroundResponse> {
    const res = await fetch(`${API_BASE_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, environment }),
    });
    return handleResponse<PlaygroundResponse>(res);
  },

  // ============ Workspace Items (unified tree) ============
  async getWorkspaceItems(): Promise<WorkspaceItem[]> {
    const res = await fetch(`${API_BASE_URL}/workspace-items`);
    return handleResponse<WorkspaceItem[]>(res);
  },

  async migrateWorkspaceItems(): Promise<WorkspaceItem[]> {
    const res = await fetch(`${API_BASE_URL}/workspace-items/migrate`, { method: 'POST' });
    return handleResponse<WorkspaceItem[]>(res);
  },

  async createWorkspaceItem(item: Partial<WorkspaceItem>): Promise<WorkspaceItem> {
    const res = await fetch(`${API_BASE_URL}/workspace-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return handleResponse<WorkspaceItem>(res);
  },

  async updateWorkspaceItem(id: string, patch: Partial<WorkspaceItem>): Promise<WorkspaceItem> {
    const res = await fetch(`${API_BASE_URL}/workspace-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return handleResponse<WorkspaceItem>(res);
  },

  async deleteWorkspaceItem(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/workspace-items/${id}`, { method: 'DELETE' });
    return handleResponse<void>(res);
  },

  async moveWorkspaceItem(id: string, parentId: string | null, order?: number): Promise<WorkspaceItem> {
    const res = await fetch(`${API_BASE_URL}/workspace-items/${id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId, order }),
    });
    return handleResponse<WorkspaceItem>(res);
  },

  async reorderWorkspaceItem(id: string, order: number): Promise<WorkspaceItem> {
    const res = await fetch(`${API_BASE_URL}/workspace-items/${id}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
    return handleResponse<WorkspaceItem>(res);
  },

  async togglePinWorkspaceItem(id: string): Promise<WorkspaceItem> {
    const res = await fetch(`${API_BASE_URL}/workspace-items/${id}/pin`, { method: 'POST' });
    return handleResponse<WorkspaceItem>(res);
  },

  async duplicateWorkspaceItem(id: string): Promise<WorkspaceItem> {
    const res = await fetch(`${API_BASE_URL}/workspace-items/${id}/duplicate`, { method: 'POST' });
    return handleResponse<WorkspaceItem>(res);
  },
};
