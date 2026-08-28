import { pool } from '../../services/database.service';
import { PlaygroundData, UserWorkspace, Environment, Collection, LocalApi, HistoryEntry } from './playground.types';
import { WorkspaceItem } from './playground.workspace';

// Default user id for playground operations (since playground doesn't have auth yet)
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000000';

class PlaygroundDbStore {
  async getData(): Promise<PlaygroundData> {
    try {
      // Get all data from database tables
      const [workspaces, collections, environments, workspaceItems, history] = await Promise.all([
        this.getWorkspaces(),
        this.getCollections().catch(() => []),
        this.getEnvironments().catch(() => []),
        this.getWorkspaceItems().catch(() => []),
        this.getHistory().catch(() => [])
      ]);

      return {
        userWorkspaces: workspaces,
        workspaceApis: [], // Not implemented in DB yet
        localApis: [], // Not implemented in DB yet
        collections: collections,
        history: history,
        environments: environments,
        apiExamples: [], // Not implemented in DB yet
        workspaceItems: workspaceItems,
      };
    } catch (error) {
      console.error('Error getting playground data from DB:', error);
      // Return default data if database fails
      return {
        userWorkspaces: [
          {
            id: 'ws-space-default',
            name: 'Default Workspace',
            isPinned: true,
            isDefault: true,
            createdAt: new Date().toISOString(),
          }
        ],
        workspaceApis: [],
        localApis: [],
        collections: [],
        history: [],
        environments: [],
        apiExamples: [],
        workspaceItems: [],
      };
    }
  }

  async getWorkspaces(): Promise<UserWorkspace[]> {
    // For now, return default workspace since we don't have a workspaces table yet
    return [
      {
        id: 'ws-space-default',
        name: 'Default Workspace',
        isPinned: true,
        isDefault: true,
        createdAt: new Date().toISOString(),
      }
    ];
  }

  async getWorkspaceApis() {
    return [];
  }

  async getLocalApis(): Promise<LocalApi[]> {
    return [];
  }

  async getCollections(): Promise<Collection[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, name, description, created_at as "createdAt", updated_at as "updatedAt"
        FROM collections
        WHERE user_id = $1 AND deleted_at IS NULL
        ORDER BY created_at DESC
      `, [DEFAULT_USER_ID]);

      return result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description || '',
        color: '#10b981', // Default color since DB doesn't have color column
        requests: [], // Requests will be loaded separately
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
      }));
    } finally {
      client.release();
    }
  }

  async getHistory(): Promise<HistoryEntry[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT
          id,
          method,
          url,
          response_status as "status",
          response_body,
          latency_ms as "timeMs",
          created_at as "timestamp"
        FROM request_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50
      `, [DEFAULT_USER_ID]);

      return result.rows.map((row: any) => ({
        id: row.id,
        requestName: 'API Request',
        method: row.method || 'GET',
        url: row.url || '',
        status: row.status || 0,
        statusText: row.status ? getStatusText(row.status) : '',
        timeMs: row.timeMs || 0,
        timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString(),
        responseBody: row.response_body || undefined,
      }));
    } finally {
      client.release();
    }
  }

  async getEnvironments(): Promise<Environment[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, name, variables, is_active as "isActive"
        FROM environments
        WHERE user_id = $1 AND deleted_at IS NULL
        ORDER BY created_at
      `, [DEFAULT_USER_ID]);

      return result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        variables: row.variables || {},
        secrets: {}, // No secrets column in environments table
        isDefault: row.isActive || false,
      }));
    } finally {
      client.release();
    }
  }

  async getApiExamples() {
    return [];
  }

  async getWorkspaceItems(): Promise<WorkspaceItem[]> {
    const client = await pool.connect();
    try {
      // Query saved_requests for requests
      const savedRequestsResult = await client.query(`
        SELECT
          id, name, method, url, description,
          created_at as "createdAt", updated_at as "updatedAt"
        FROM saved_requests
        WHERE user_id = $1 AND deleted_at IS NULL
      `, [DEFAULT_USER_ID]);

      // Query collections for collections
      const collectionsResult = await client.query(`
        SELECT
          id, name, description,
          created_at as "createdAt", updated_at as "updatedAt"
        FROM collections
        WHERE user_id = $1 AND deleted_at IS NULL
      `, [DEFAULT_USER_ID]);

      const requestItems = savedRequestsResult.rows.map((row: any) => ({
        id: row.id,
        kind: 'request' as const,
        name: row.name,
        parentId: undefined as string | undefined,
        order: 0,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
        isPinned: false,
        request: {
          id: row.id,
          name: row.name,
          method: row.method || 'GET',
          url: row.url || '',
          params: [],
          headers: [],
          cookies: [],
          auth: { type: 'no-auth' as const },
          body: { type: 'json' as const, json: '' }
        },
        description: row.description,
        color: undefined,
        workspaceId: 'ws-space-default',
        apiId: undefined,
        endpointId: undefined,
        method: row.method,
        url: row.url,
      }));

      const collectionItems = collectionsResult.rows.map((row: any) => ({
        id: row.id,
        kind: 'collection' as const,
        name: row.name,
        parentId: undefined,
        order: 0,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
        isPinned: false,
        description: row.description,
        color: undefined,
        workspaceId: 'ws-space-default',
      }));

      // Combine and sort by createdAt
      return [...requestItems, ...collectionItems].sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    } finally {
      client.release();
    }
  }

  async createWorkspace(name: string): Promise<UserWorkspace> {
    // For now, just return a default workspace
    return {
      id: `ws-${Date.now().toString(36)}`,
      name,
      isPinned: false,
      createdAt: new Date().toISOString(),
    };
  }

  async renameWorkspace(id: string, name: string): Promise<UserWorkspace | null> {
    // Not implemented in DB yet
    return {
      id,
      name,
      isPinned: false,
      createdAt: new Date().toISOString(),
    };
  }

  async togglePinWorkspace(id: string): Promise<UserWorkspace | null> {
    // Not implemented in DB yet
    return {
      id,
      name: 'Workspace',
      isPinned: true,
      createdAt: new Date().toISOString(),
    };
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  async createApi(api: any) {
    return api;
  }

  async updateApi(api: any) {
    return api;
  }

  async deleteApi(id: string): Promise<boolean> {
    return true;
  }

  async createLocalApi(api: any): Promise<LocalApi> {
    return {
      ...api,
      id: api.id || `local-${Date.now().toString(36)}`,
      source: 'local' as const,
      isLocal: true,
      endpoints: api.endpoints || [],
    };
  }

  async deleteLocalApi(id: string): Promise<boolean> {
    return true;
  }

  async createCollection(col: any): Promise<Collection> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO collections (user_id, name, description)
        VALUES ($1, $2, $3)
        RETURNING id, name, description, created_at as "createdAt", updated_at as "updatedAt"
      `, [DEFAULT_USER_ID, col.name || 'Untitled Collection', col.description || '']);

      return {
        id: result.rows[0].id,
        name: result.rows[0].name,
        description: result.rows[0].description,
        color: col.color || '#10b981',
        requests: [],
        createdAt: result.rows[0].createdAt ? new Date(result.rows[0].createdAt).toISOString() : new Date().toISOString(),
        updatedAt: result.rows[0].updatedAt ? new Date(result.rows[0].updatedAt).toISOString() : new Date().toISOString(),
      };
    } finally {
      client.release();
    }
  }

  async updateCollection(col: any): Promise<Collection | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE collections
        SET name = $1, description = $2, updated_at = NOW()
        WHERE id = $3 AND user_id = $4 AND deleted_at IS NULL
        RETURNING id, name, description, created_at as "createdAt", updated_at as "updatedAt"
      `, [col.name, col.description, col.id, DEFAULT_USER_ID]);

      if (result.rows.length === 0) {
        return null;
      }

      return {
        id: result.rows[0].id,
        name: result.rows[0].name,
        description: result.rows[0].description,
        color: col.color || '#10b981',
        requests: [], // Requests would need to be loaded separately
        createdAt: result.rows[0].createdAt ? new Date(result.rows[0].createdAt).toISOString() : new Date().toISOString(),
        updatedAt: result.rows[0].updatedAt ? new Date(result.rows[0].updatedAt).toISOString() : new Date().toISOString(),
      };
    } finally {
      client.release();
    }
  }

  async deleteCollection(id: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE collections
        SET deleted_at = NOW()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING id
      `, [id, DEFAULT_USER_ID]);

      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  async addRequestToCollection(collectionId: string, request: any): Promise<Collection | null> {
    const client = await pool.connect();
    try {
      // First, create the saved request
      const requestResult = await client.query(`
        INSERT INTO saved_requests (user_id, name, method, url, description)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [
        DEFAULT_USER_ID,
        request.name || 'Untitled Request',
        request.config?.method || 'GET',
        request.config?.url || '',
        request.description || ''
      ]);

      const collectionResult = await client.query(`
        SELECT id, name, description, created_at as "createdAt", updated_at as "updatedAt"
        FROM collections
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      `, [collectionId, DEFAULT_USER_ID]);

      if (collectionResult.rows.length === 0) {
        return null;
      }

      return {
        id: collectionResult.rows[0].id,
        name: collectionResult.rows[0].name,
        description: collectionResult.rows[0].description,
        color: '#10b981',
        requests: [], // Would need to load all requests for this collection
        createdAt: collectionResult.rows[0].createdAt ? new Date(collectionResult.rows[0].createdAt).toISOString() : new Date().toISOString(),
        updatedAt: collectionResult.rows[0].updatedAt ? new Date(collectionResult.rows[0].updatedAt).toISOString() : new Date().toISOString(),
      };
    } finally {
      client.release();
    }
  }

  async deleteRequestFromCollection(collectionId: string, requestId: string): Promise<Collection | null> {
    const client = await pool.connect();
    try {
      // Soft-delete the saved request
      await client.query(`
        UPDATE saved_requests
        SET deleted_at = NOW()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      `, [requestId, DEFAULT_USER_ID]);

      const result = await client.query(`
        SELECT id, name, description, created_at as "createdAt", updated_at as "updatedAt"
        FROM collections
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      `, [collectionId, DEFAULT_USER_ID]);

      if (result.rows.length === 0) {
        return null;
      }

      return {
        id: result.rows[0].id,
        name: result.rows[0].name,
        description: result.rows[0].description,
        color: '#10b981',
        requests: [],
        createdAt: result.rows[0].createdAt ? new Date(result.rows[0].createdAt).toISOString() : new Date().toISOString(),
        updatedAt: result.rows[0].updatedAt ? new Date(result.rows[0].updatedAt).toISOString() : new Date().toISOString(),
      };
    } finally {
      client.release();
    }
  }

  async addHistoryEntry(entry: any): Promise<HistoryEntry> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO request_history (
          user_id, method, url, headers, query_params, body, response_status, response_body,
          response_headers, latency_ms, error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, method, url, created_at as "timestamp"
      `, [
        DEFAULT_USER_ID,
        entry.method || 'GET',
        entry.url || '',
        entry.headers || {},
        entry.queryParams || {},
        entry.body || null,
        entry.status || null,
        entry.responseBody || null,
        entry.responseHeaders || {},
        entry.timeMs || 0,
        entry.errorMessage || null
      ]);

      return {
        id: result.rows[0].id,
        requestName: entry.requestName || 'API Request',
        method: result.rows[0].method,
        url: result.rows[0].url,
        status: entry.status || 0,
        statusText: entry.statusText || '',
        timeMs: entry.timeMs || 0,
        timestamp: result.rows[0].timestamp ? new Date(result.rows[0].timestamp).toISOString() : new Date().toISOString(),
        responseBody: entry.responseBody || undefined,
        apiId: entry.apiId,
      };
    } finally {
      client.release();
    }
  }

  async deleteHistoryEntry(id: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        DELETE FROM request_history
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `, [id, DEFAULT_USER_ID]);

      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  async clearHistory() {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM request_history WHERE user_id = $1', [DEFAULT_USER_ID]);
    } finally {
      client.release();
    }
  }

  async createEnvironment(env: any): Promise<Environment> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO environments (user_id, name, variables, is_active)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, variables, is_active as "isActive"
      `, [
        DEFAULT_USER_ID,
        env.name || 'New Environment',
        env.variables || {},
        env.isDefault || false
      ]);

      return {
        id: result.rows[0].id,
        name: result.rows[0].name,
        variables: result.rows[0].variables || {},
        secrets: {}, // No secrets column in environments table
        isDefault: result.rows[0].isActive || false,
      };
    } finally {
      client.release();
    }
  }

  async updateEnvironment(env: any): Promise<Environment | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE environments
        SET name = $1, variables = $2, is_active = $3
        WHERE id = $4 AND user_id = $5 AND deleted_at IS NULL
        RETURNING id, name, variables, is_active as "isActive"
      `, [
        env.name,
        env.variables || {},
        env.isDefault || false,
        env.id,
        DEFAULT_USER_ID
      ]);

      if (result.rows.length === 0) {
        return null;
      }

      return {
        id: result.rows[0].id,
        name: result.rows[0].name,
        variables: result.rows[0].variables || {},
        secrets: {},
        isDefault: result.rows[0].isActive || false,
      };
    } finally {
      client.release();
    }
  }

  async deleteEnvironment(id: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        UPDATE environments
        SET deleted_at = NOW()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING id
      `, [id, DEFAULT_USER_ID]);

      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  async createApiExample(example: any) {
    return example;
  }

  async deleteApiExample(id: string): Promise<boolean> {
    return true;
  }

  // =========================================================
  // WORKSPACE ITEMS (unified tree model)
  // =========================================================

  async createWorkspaceItem(item: Partial<WorkspaceItem>): Promise<WorkspaceItem> {
    const client = await pool.connect();
    try {
      if (item.kind === 'collection') {
        const result = await client.query(`
          INSERT INTO collections (user_id, name, description)
          VALUES ($1, $2, $3)
          RETURNING id, name, created_at as "createdAt", updated_at as "updatedAt"
        `, [DEFAULT_USER_ID, item.name || 'Untitled', item.description || '']);

        return {
          id: result.rows[0].id,
          kind: 'collection' as const,
          name: result.rows[0].name,
          parentId: item.parentId,
          order: item.order ?? 0,
          createdAt: result.rows[0].createdAt ? new Date(result.rows[0].createdAt).toISOString() : new Date().toISOString(),
          updatedAt: result.rows[0].updatedAt ? new Date(result.rows[0].updatedAt).toISOString() : new Date().toISOString(),
          isPinned: Boolean(item.isPinned),
          description: item.description,
          color: item.color,
          workspaceId: item.workspaceId || 'ws-space-default',
        };
      } else {
        // Default to request
        const result = await client.query(`
          INSERT INTO saved_requests (user_id, name, method, url, description)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, name, method, url, description, created_at as "createdAt", updated_at as "updatedAt"
        `, [
          DEFAULT_USER_ID,
          item.name || 'Untitled',
          item.method || 'GET',
          item.url || '',
          item.description || ''
        ]);

        return {
          id: result.rows[0].id,
          kind: 'request' as const,
          name: result.rows[0].name,
          parentId: item.parentId,
          order: item.order ?? 0,
          createdAt: result.rows[0].createdAt ? new Date(result.rows[0].createdAt).toISOString() : new Date().toISOString(),
          updatedAt: result.rows[0].updatedAt ? new Date(result.rows[0].updatedAt).toISOString() : new Date().toISOString(),
          isPinned: Boolean(item.isPinned),
          collectionId: item.collectionId,
          request: {
            id: result.rows[0].id,
            name: result.rows[0].name,
            method: result.rows[0].method,
            url: result.rows[0].url,
            params: [],
            headers: [],
            cookies: [],
            auth: { type: 'no-auth' as const },
            body: { type: 'json' as const, json: '' }
          },
          description: result.rows[0].description,
          color: item.color,
          workspaceId: item.workspaceId || 'ws-space-default',
          apiId: item.apiId,
          endpointId: item.endpointId,
          method: result.rows[0].method,
          url: result.rows[0].url,
        };
      }
    } finally {
      client.release();
    }
  }

  async updateWorkspaceItem(id: string, patch: Partial<WorkspaceItem>): Promise<WorkspaceItem | null> {
    const client = await pool.connect();
    try {
      // Try updating saved_requests first
      const requestResult = await client.query(`
        UPDATE saved_requests
        SET name = COALESCE($1, name),
            method = COALESCE($2, method),
            url = COALESCE($3, url),
            updated_at = NOW()
        WHERE id = $4 AND user_id = $5 AND deleted_at IS NULL
        RETURNING id, name, method, url, created_at as "createdAt", updated_at as "updatedAt"
      `, [patch.name || null, patch.method || null, patch.url || null, id, DEFAULT_USER_ID]);

      if (requestResult.rows.length > 0) {
        return {
          id: requestResult.rows[0].id,
          kind: 'request' as const,
          name: requestResult.rows[0].name,
          parentId: patch.parentId,
          order: patch.order ?? 0,
          createdAt: requestResult.rows[0].createdAt ? new Date(requestResult.rows[0].createdAt).toISOString() : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPinned: Boolean(patch.isPinned),
          request: patch.request,
          description: patch.description,
          color: patch.color,
          workspaceId: patch.workspaceId || 'ws-space-default',
          method: requestResult.rows[0].method,
          url: requestResult.rows[0].url,
        };
      }

      // Try updating collections
      const collectionResult = await client.query(`
        UPDATE collections
        SET name = COALESCE($1, name),
            description = COALESCE($2, description),
            updated_at = NOW()
        WHERE id = $3 AND user_id = $4 AND deleted_at IS NULL
        RETURNING id, name, created_at as "createdAt", updated_at as "updatedAt"
      `, [patch.name || null, patch.description || null, id, DEFAULT_USER_ID]);

      if (collectionResult.rows.length > 0) {
        return {
          id: collectionResult.rows[0].id,
          kind: 'collection' as const,
          name: collectionResult.rows[0].name,
          parentId: patch.parentId,
          order: patch.order ?? 0,
          createdAt: collectionResult.rows[0].createdAt ? new Date(collectionResult.rows[0].createdAt).toISOString() : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPinned: Boolean(patch.isPinned),
          description: patch.description,
          color: patch.color,
          workspaceId: patch.workspaceId || 'ws-space-default',
        };
      }

      return null;
    } finally {
      client.release();
    }
  }

  async deleteWorkspaceItem(id: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      // Try to delete from saved_requests first
      const requestResult = await client.query(`
        UPDATE saved_requests
        SET deleted_at = NOW()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING id
      `, [id, DEFAULT_USER_ID]);

      if (requestResult.rows.length > 0) {
        return true;
      }

      // Try to delete from collections
      const collectionResult = await client.query(`
        UPDATE collections
        SET deleted_at = NOW()
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING id
      `, [id, DEFAULT_USER_ID]);

      return collectionResult.rows.length > 0;
    } finally {
      client.release();
    }
  }

  async moveWorkspaceItem(id: string, parentId: string | null, order?: number): Promise<WorkspaceItem | null> {
    // Not fully implemented in DB yet - no parent_id column in saved_requests
    // Return a mock item for now
    const existing = await this.getWorkspaceItems();
    const item = existing.find((i) => i.id === id);
    if (!item) return null;

    return {
      ...item,
      parentId: parentId || undefined,
      order: order || item.order,
      updatedAt: new Date().toISOString(),
    };
  }

  async reorderWorkspaceItem(id: string, order: number): Promise<WorkspaceItem | null> {
    // Not fully implemented in DB yet
    const existing = await this.getWorkspaceItems();
    const item = existing.find((i) => i.id === id);
    if (!item) return null;

    return {
      ...item,
      order,
      updatedAt: new Date().toISOString(),
    };
  }

  async togglePinWorkspaceItem(id: string): Promise<WorkspaceItem | null> {
    // Not fully implemented in DB yet - is_pinned doesn't exist in saved_requests
    const existing = await this.getWorkspaceItems();
    const item = existing.find((i) => i.id === id);
    if (!item) return null;

    return {
      ...item,
      isPinned: !item.isPinned,
      updatedAt: new Date().toISOString(),
    };
  }

  async duplicateWorkspaceItem(id: string): Promise<WorkspaceItem | null> {
    const client = await pool.connect();
    try {
      // Try to get the original item from saved_requests
      const requestResult = await client.query(`
        SELECT id, name, method, url, description
        FROM saved_requests
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
      `, [id, DEFAULT_USER_ID]);

      if (requestResult.rows.length > 0) {
        const original = requestResult.rows[0];
        const copyResult = await client.query(`
          INSERT INTO saved_requests (user_id, name, method, url, description)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, name, method, url, description, created_at as "createdAt", updated_at as "updatedAt"
        `, [
          DEFAULT_USER_ID,
          `${original.name} (Copy)`,
          original.method,
          original.url,
          original.description
        ]);

        return {
          id: copyResult.rows[0].id,
          kind: 'request' as const,
          name: copyResult.rows[0].name,
          parentId: undefined,
          order: 0,
          createdAt: copyResult.rows[0].createdAt ? new Date(copyResult.rows[0].createdAt).toISOString() : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isPinned: false,
          request: {
            id: copyResult.rows[0].id,
            name: copyResult.rows[0].name,
            method: copyResult.rows[0].method,
            url: copyResult.rows[0].url,
            params: [],
            headers: [],
            cookies: [],
            auth: { type: 'no-auth' as const },
            body: { type: 'json' as const, json: '' }
          },
          description: copyResult.rows[0].description,
          color: undefined,
          workspaceId: 'ws-space-default',
        };
      }

      return null;
    } finally {
      client.release();
    }
  }

  // Migration: build workspace items from existing collections/requests
  async migrateFromLegacy(): Promise<WorkspaceItem[]> {
    return this.getWorkspaceItems();
  }
}

function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return statusTexts[status] || 'Unknown';
}

export const playgroundDbStore = new PlaygroundDbStore();