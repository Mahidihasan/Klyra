import {
  ApiCategory,
  CreateProjectInput,
  DetectionResult,
  DraftChange,
  ProviderProject,
  ProviderProjectStatus,
  SourceConfig,
} from '../types/apibuild';
import { OperationRecord, ResourceHistoryEntry } from '../types/operations';

/* ==========================================================================
 * apiBuildService — thin, typed client for the API Build backend.
 *
 * The backend (backend/src/modules/api-build) is the single source of truth:
 * projects, endpoints, versions, plans, consumers, keys, activity, logs,
 * incidents, alert rules, usage and insights all live in Postgres. There is
 * no localStorage cache, no seeded demo data and no simulated detection —
 * every value the UI shows comes from the database or from live probes.
 * ========================================================================== */

export const PROJECTS_ROOT = '/api/api-build/projects';
const JOB_ROOT = '/api/api-build/jobs';
const CATEGORY_ROOT = '/api/api-build/categories';
const DETECT_ROOT = '/api/api-build/detect';
const UPLOAD_ROOT = '/api/api-build/upload-project';

export const STATUS_META: Record<ProviderProjectStatus, { label: string; color: string }> = {
  healthy: { label: 'Healthy', color: '#22c55e' },
  deploying: { label: 'Deploying', color: '#f59e0b' },
  failed: { label: 'Failed', color: '#ef4444' },
  paused: { label: 'Paused', color: '#64748b' },
  degraded: { label: 'Degraded', color: '#f59e0b' },
  draft: { label: 'Draft', color: '#a78bfa' },
  published: { label: 'Published', color: '#22c55e' },
};

/** Offline fallback labels only; the live taxonomy comes from GET /categories. */
export const DEFAULT_CATEGORIES = [
  'AI / Developer Tools',
  'Media',
  'Finance',
  'Communication',
  'E-commerce',
  'Weather',
  'DevOps',
];

/** Performs a request and unwraps the backend envelope. Throws on failure. */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    let message = `Request failed (HTTP ${response.status})`;
    try {
      const errBody = (await response.json()) as { error?: { message?: string } };
      message = errBody?.error?.message || message;
    } catch {
      /* keep default message */
    }
    throw new Error(message);
  }
  const body = (await response.json()) as { success: boolean; data: T };
  return body.data;
}
export const apiBuildService = {
  /* -------------------------------------------------------------- *
   * Projects — the backend composes the full ProviderProject record. *
   * -------------------------------------------------------------- */
  async list(): Promise<ProviderProject[]> {
    return api(PROJECTS_ROOT);
  },
  async get(id: string): Promise<ProviderProject | null> {
    try {
      return await api<ProviderProject>(`${PROJECTS_ROOT}/${encodeURIComponent(id)}`);
    } catch {
      return null;
    }
  },
  async create(input: CreateProjectInput): Promise<ProviderProject> {
    return api(PROJECTS_ROOT, { method: 'POST', body: JSON.stringify(input) });
  },
  async update(id: string, patch: Partial<ProviderProject>): Promise<ProviderProject | null> {
    try {
      return await api(`${PROJECTS_ROOT}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
    } catch {
      return null;
    }
  },
  async remove(id: string): Promise<boolean> {
    try {
      const result = await api<{ deleted: boolean }>(`${PROJECTS_ROOT}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return result.deleted;
    } catch {
      return false;
    }
  },
  /** Live upstream detection via the backend proxy. Throws when the backend or
   *  the upstream is unreachable — the caller surfaces the real reason; there
   *  is no offline simulation anymore. */
  async detect(source: SourceConfig): Promise<DetectionResult> {
    const sent: {
      baseUrl?: string;
      openApiUrl?: string;
      repository?: string;
      dockerImage?: string;
    } = {};
    const base = source.baseUrl?.trim() || '';
    if (base) sent.baseUrl = base;
    if (source.openApiUrl?.trim()) sent.openApiUrl = source.openApiUrl.trim();
    if (source.repository?.trim()) sent.repository = source.repository.trim();
    if (source.dockerImage?.trim()) sent.dockerImage = source.dockerImage.trim();
    return api(DETECT_ROOT, { method: 'POST', body: JSON.stringify(sent) });
  },
  /** Imports endpoint operations discovered from the upstream spec. */
  async importEndpoints(
    projectId: string,
    source: { baseUrl?: string; openApiUrl?: string; endpoints?: unknown[] },
  ): Promise<number> {
    const result = await api<{ imported: number }>(
      `${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/endpoints/import`,
      { method: 'POST', body: JSON.stringify(source) },
    );
    return result.imported;
  },
  async updateEndpoint(
    projectId: string,
    endpointId: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    await api(
      `${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/endpoints/${encodeURIComponent(
        endpointId,
      )}`,
      { method: 'PUT', body: JSON.stringify(patch) },
    );
  },
  /** Clones a GitHub repository as a buildable container source (obtain source
   *  step). Returns the discovered Dockerfile path, build context and port. */
  async prepareGitHubSource(
    projectId: string,
    input: { repository: string; branch?: string },
  ): Promise<{
    uploadId: string;
    projectName: string;
    dockerfilePath: string;
    buildContext: string;
    detectedPort: number;
    fileCount: number;
    repository: string;
    branch: string;
  }> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/source/github`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  /** Uploads a project ZIP archive and inspects its Dockerfile and context.
   *  When `onProgress` is supplied the request is sent with XMLHttpRequest so
   *  the UI can show a real transfer percentage (fetch cannot report upload
   *  progress). The response contract is identical either way. */
  async uploadProjectFolder(
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<{
    uploadId: string;
    projectName: string;
    dockerfilePath: string;
    buildContext: string;
    detectedPort: number;
    fileCount: number;
    totalSizeBytes: number;
  }> {
    type UploadData = {
      uploadId: string;
      projectName: string;
      dockerfilePath: string;
      buildContext: string;
      detectedPort: number;
      fileCount: number;
      totalSizeBytes: number;
    };
    type UploadResponse = {
      success?: boolean;
      data?: UploadData;
      error?: { message?: string };
    };
    const formData = new FormData();
    formData.append('file', file);

    if (onProgress) {
      return new Promise<UploadData>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', UPLOAD_ROOT);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
          }
        };
        xhr.onload = () => {
          let parsed: UploadResponse | null = null;
          try {
            parsed = JSON.parse(xhr.responseText) as UploadResponse;
          } catch {
            parsed = null;
          }
          if (xhr.status >= 200 && xhr.status < 300 && parsed?.data) {
            onProgress(100);
            resolve(parsed.data);
            return;
          }
          reject(new Error(parsed?.error?.message || `Upload failed (HTTP ${xhr.status}).`));
        };
        xhr.onerror = () => reject(new Error('Upload failed: network error.'));
        xhr.send(formData);
      });
    }

    const response = await fetch(UPLOAD_ROOT, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
        message?: string;
      };
      throw new Error(err.error?.message || err.message || 'Upload failed');
    }
    const body = (await response.json()) as {
      success: boolean;
      data: {
        uploadId: string;
        projectName: string;
        dockerfilePath: string;
        buildContext: string;
        detectedPort: number;
        fileCount: number;
        totalSizeBytes: number;
      };
    };
    return body.data;
  },
  async requestDeploy(id: string): Promise<{ jobId: string; status: string }> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(id)}/deployments`, {
      method: 'POST',
      body: JSON.stringify({ enqueue: true }),
    });
  },
  async getRemoteProject(id: string): Promise<ProviderProject> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(id)}`);
  },
  async waitForDeploy(jobId: string, attempts = 30): Promise<'completed' | 'failed' | 'pending'> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      const job = await api<{ status: string }>(`${JOB_ROOT}/${encodeURIComponent(jobId)}`);
      if (job.status === 'completed') return 'completed';
      if (job.status === 'failed') return 'failed';
    }
    return 'pending';
  },
  /** Empty array when the backend has no projects or is unreachable — the UI
   *  must show real empty states, never fabricated data. */
  async hydrate(): Promise<ProviderProject[]> {
    try {
      return await api(PROJECTS_ROOT);
    } catch {
      return [];
    }
  },
  /* -------------------------------------------------------------- *
   * Resources — generic so pages keep their own domain types.        *
   * -------------------------------------------------------------- */
  async listEndpoints<T = unknown>(projectId: string): Promise<T[]> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/endpoints`);
  },
  async listVersions<T = unknown>(projectId: string): Promise<T[]> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/versions`);
  },
  async createVersion<T = unknown>(
    projectId: string,
    version: Record<string, unknown>,
  ): Promise<T> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/versions`, {
      method: 'POST',
      body: JSON.stringify(version),
    });
  },
  async updateVersion<T = unknown>(
    projectId: string,
    versionId: string,
    patch: Record<string, unknown>,
  ): Promise<T> {
    return api(
      `${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`,
      { method: 'PUT', body: JSON.stringify(patch) },
    );
  },
  async listPlans<T = unknown>(projectId: string): Promise<T[]> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/plans`);
  },
  async createPlan<T = unknown>(projectId: string, plan: Record<string, unknown>): Promise<T> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/plans`, {
      method: 'POST',
      body: JSON.stringify(plan),
    });
  },
  async updatePlan<T = unknown>(
    projectId: string,
    planId: string,
    patch: Record<string, unknown>,
  ): Promise<T> {
    return api(
      `${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/plans/${encodeURIComponent(planId)}`,
      { method: 'PUT', body: JSON.stringify(patch) },
    );
  },
  async deletePlan(projectId: string, planId: string): Promise<boolean> {
    try {
      const result = await api<{ deleted: boolean }>(
        `${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/plans/${encodeURIComponent(planId)}`,
        { method: 'DELETE' },
      );
      return result.deleted;
    } catch {
      return false;
    }
  },
  async listConsumers<T = unknown>(projectId: string): Promise<T[]> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/consumers`);
  },
  async createConsumer<T = unknown>(
    projectId: string,
    consumer: Record<string, unknown>,
  ): Promise<T> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/consumers`, {
      method: 'POST',
      body: JSON.stringify(consumer),
    });
  },
  async updateConsumer<T = unknown>(
    projectId: string,
    consumerId: string,
    patch: Record<string, unknown>,
  ): Promise<T> {
    return api(
      `${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/consumers/${encodeURIComponent(
        consumerId,
      )}`,
      { method: 'PUT', body: JSON.stringify(patch) },
    );
  },
  /** Creates a credential. The response carries the one-time plaintext secret. */
  async createKey<T = unknown>(
    projectId: string,
    input: { label: string; consumer?: string; plan?: string; environment?: 'live' | 'test' },
  ): Promise<T> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/keys`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  async updateKey<T = unknown>(
    projectId: string,
    keyId: string,
    patch: Record<string, unknown>,
  ): Promise<T> {
    return api(
      `${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/keys/${encodeURIComponent(keyId)}`,
      { method: 'PUT', body: JSON.stringify(patch) },
    );
  },
  async listActivity<T = unknown>(projectId: string): Promise<T[]> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/activity`);
  },
  async listDeployments<T = unknown>(projectId: string): Promise<T[]> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/deployments`);
  },
  async listLogs<T = unknown>(
    projectId: string,
    options: { limit?: number; method?: string; path?: string; status?: number } = {},
  ): Promise<T[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.method && options.method !== 'ALL') params.set('method', options.method);
    if (options.path) params.set('path', options.path);
    if (options.status) params.set('status', String(options.status));
    const qs = params.toString();
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/logs${qs ? `?${qs}` : ''}`);
  },
  async listIncidents<T = unknown>(projectId: string): Promise<T[]> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/incidents`);
  },
  async updateIncident<T = unknown>(
    projectId: string,
    incidentId: string,
    patch: Record<string, unknown>,
  ): Promise<T> {
    return api(
      `${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/incidents/${encodeURIComponent(
        incidentId,
      )}`,
      { method: 'PUT', body: JSON.stringify(patch) },
    );
  },
  async listAlertRules<T = unknown>(projectId: string): Promise<T[]> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/alerts`);
  },
  async saveAlertRule<T = unknown>(projectId: string, rule: Record<string, unknown>): Promise<T> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/alerts`, {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  },
  async deleteAlertRule(projectId: string, ruleId: string): Promise<boolean> {
    try {
      const result = await api<{ deleted: boolean }>(
        `${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/alerts/${encodeURIComponent(ruleId)}`,
        { method: 'DELETE' },
      );
      return result.deleted;
    } catch {
      return false;
    }
  },
  async getInsights<T = unknown>(projectId: string): Promise<T[]> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/insights`);
  },
  async getAnalytics<T = unknown>(projectId: string): Promise<T> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/analytics`);
  },
  /** One real upstream health probe (same machinery the telemetry worker uses). */
  async runHealthProbe<T = unknown>(projectId: string): Promise<T> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/health`, { method: 'POST' });
  },

  /* -------------------------------------------------------------- *
   * Marketplace categories — live taxonomy from the backend.         *
   * -------------------------------------------------------------- */
  async getCategories(): Promise<string[]> {
    try {
      const rows = await api<{ name: string }[]>(CATEGORY_ROOT);
      return rows.map((row) => row.name);
    } catch {
      return [...DEFAULT_CATEGORIES];
    }
  },
  async addCategory(name: string): Promise<ApiCategory | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    try {
      return await api<ApiCategory>(CATEGORY_ROOT, {
        method: 'POST',
        body: JSON.stringify({ name: trimmed }),
      });
    } catch {
      return null;
    }
  },

  /* -------------------------------------------------------------- *
   * Draft & Unsaved State — manage working copies and changes.      *
   * -------------------------------------------------------------- */

  /** Get current draft and server state. */
  async getDraftState<T = unknown>(
    projectId: string,
  ): Promise<{ server: T | null; draft: T | null }> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/draft`);
  },

  /** Update draft configuration (does not affect live). */
  async updateDraftConfig<T = unknown>(
    projectId: string,
    config: T,
  ): Promise<{ draft: T; hasChanges: boolean }> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/draft`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    });
  },

  /** Compute changes between draft and live. */
  async computeDraftChanges(projectId: string, config: unknown): Promise<DraftChange[]> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/draft/changes`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  /** Validate draft before saving. */
  async validateDraft<T = unknown>(
    projectId: string,
    config: T,
  ): Promise<{ ok: boolean; error?: string; warnings?: string[] }> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/draft/validate`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  /** Save draft to live (promote draft to server state). */
  async saveDraftToLive<T = unknown>(projectId: string, config: T): Promise<T> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/draft/save`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  /** Discard draft (revert to server state). */
  async discardDraft(projectId: string): Promise<boolean> {
    const result = await api<{ discarded: boolean }>(
      `${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/draft`,
      {
        method: 'DELETE',
      },
    );
    return result.discarded;
  },

  /** Get audit log for a project. */
  async getAuditLog<T = unknown>(
    projectId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<T[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));
    const qs = params.toString();
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/audit${qs ? `?${qs}` : ''}`);
  },

  /* -------------------------------------------------------------- *
   * Operations — universal async execution surface.                 *
   * POST /projects/:id/operations, GET list/get, cancel, retry.    *
   * -------------------------------------------------------------- */
  async createOperation<T = OperationRecord>(
    projectId: string,
    input: {
      type: string;
      environment?: string;
      payload?: Record<string, unknown>;
      reason?: string;
      resource?: string;
    },
  ): Promise<T> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/operations`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  async listOperations<T = OperationRecord>(
    projectId: string,
    options: { limit?: number; state?: string; type?: string } = {},
  ): Promise<T[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.state) params.set('state', options.state);
    if (options.type) params.set('type', options.type);
    const qs = params.toString();
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/operations${qs ? `?${qs}` : ''}`);
  },
  async getOperation<T = OperationRecord>(projectId: string, operationId: string): Promise<T> {
    return api(
      `${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/operations/${encodeURIComponent(
        operationId,
      )}`,
    );
  },
  async cancelOperation<T = OperationRecord>(projectId: string, operationId: string): Promise<T> {
    return api(
      `${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/operations/${encodeURIComponent(
        operationId,
      )}/cancel`,
      { method: 'POST' },
    );
  },
  async retryOperation<T = OperationRecord>(projectId: string, operationId: string): Promise<T> {
    return api(
      `${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/operations/${encodeURIComponent(
        operationId,
      )}/retry`,
      { method: 'POST' },
    );
  },

  /* -------------------------------------------------------------- *
   * Resource history — immutable versioned snapshots + restore.    *
   * -------------------------------------------------------------- */
  async listHistory<T = ResourceHistoryEntry>(
    projectId: string,
    options: { resourceType?: string; resourceId?: string; limit?: number } = {},
  ): Promise<T[]> {
    const params = new URLSearchParams();
    if (options.resourceType) params.set('resourceType', options.resourceType);
    if (options.resourceId) params.set('resourceId', options.resourceId);
    if (options.limit) params.set('limit', String(options.limit));
    const qs = params.toString();
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/history${qs ? `?${qs}` : ''}`);
  },
  async restoreHistoryVersion<T = ProviderProject>(
    projectId: string,
    resourceType: string,
    versionNo: number,
  ): Promise<T> {
    return api(`${PROJECTS_ROOT}/${encodeURIComponent(projectId)}/history/restore`, {
      method: 'POST',
      body: JSON.stringify({ resourceType, versionNo }),
    });
  },
};
