import {
  KlyraUser, RepoSummary, RepoDetail, BranchInfo, CommitInfo, TreeEntry,
  Detection, PullRequest, PullRequestDetail, Issue, IssueComment, Release, CiRun,
  Deployment, MarketplaceListing, ActivityItem, Overview, Collaborator,
} from '../../types/repos';
import { developmentRequest } from './repos.dev';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const gitRemoteUrl = (repoId: string) => `${BASE}/api/git/${repoId}.git`;

function headers(): Record<string, string> {
  const token = localStorage.getItem('klyra_token') || '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (import.meta.env.DEV) return developmentRequest<T>(path, options);
  const res = await fetch(`${BASE}/api${path}`, { headers: headers(), ...options });
  if (res.status === 204) return undefined as T;
  let data: any = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`) as any;
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

const post = <T>(path: string, body?: any) =>
  request<T>(path, { method: 'POST', body: body === undefined ? '{}' : JSON.stringify(body) });

// ============================ AUTH ============================
export const authApi = {
  me: () => request<{ user: KlyraUser }>('/auth/me'),
  register: (username: string, password: string, display_name?: string) =>
    post<{ user: KlyraUser; token: string }>('/auth/register', { username, password, display_name }),
  login: (username: string, password: string) =>
    post<{ user: KlyraUser; token: string }>('/auth/login', { username, password }),
};

// ============================ REPOSITORIES ============================
export const reposApi = {
  list: () => request<RepoSummary[]>('/repos'),
  get: (id: string) => request<RepoDetail>(`/repos/${id}`),
  create: (payload: Partial<RepoSummary> & { name: string }) => post<{ id: string }>('/repos', payload),
  import: (payload: { name: string; clone_url: string; description?: string; visibility?: string; default_branch?: string }) =>
    post<{ id: string }>('/repos/import', payload),
  update: (id: string, payload: any) =>
    request<RepoDetail>(`/repos/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: string) => request<void>(`/repos/${id}`, { method: 'DELETE' }),
  overview: (id: string) => request<Overview>(`/repos/${id}/overview`),
  activity: (id: string) => request<ActivityItem[]>(`/repos/${id}/activity`),
};

// ============================ GIT ============================
export const gitApi = {
  branches: (id: string) => request<BranchInfo[]>(`/repos/${id}/branches`),
  createBranch: (id: string, name: string, from?: string) => post(`/repos/${id}/branches`, { name, from }),
  deleteBranch: (id: string, name: string) =>
    request<void>(`/repos/${id}/branches/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  toggleProtection: (id: string, name: string) => post(`/repos/${id}/branches/${encodeURIComponent(name)}/protection`),
  commits: (id: string, ref: string, page = 0, path?: string) =>
    request<{ ref: string; commits: CommitInfo[]; total: number }>(
      `/repos/${id}/commits?ref=${encodeURIComponent(ref)}&page=${page}${path ? `&path=${encodeURIComponent(path)}` : ''}`),
  commit: (id: string, sha: string) =>
    request<{ sha: string; message: string; author: string; date: string; patch: string }>(`/repos/${id}/commits/${sha}`),
  tree: (id: string, ref: string, path = '') =>
    request<{ entries: TreeEntry[]; latest_commit: CommitInfo | null }>(
      `/repos/${id}/tree?ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(path)}`),
  file: (id: string, ref: string, path: string) =>
    request<{ content: string; history: CommitInfo[]; latest_commit: CommitInfo | null }>(
      `/repos/${id}/file?ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(path)}`),
  diff: (id: string, from: string, to: string, path?: string) =>
    request<{ patch: string; ahead: number; behind: number }>(
      `/repos/${id}/diff?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${path ? `&path=${encodeURIComponent(path)}` : ''}`),
  aheadBehind: (id: string, from: string, to: string) =>
    request<{ ahead: number; behind: number }>(
      `/repos/${id}/ahead-behind?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  tags: (id: string) => request<{ name: string; sha: string; date: string }[]>(`/repos/${id}/tags`),
  createTag: (id: string, name: string, ref: string, message?: string) =>
    post(`/repos/${id}/tags`, { name, ref, message }),
};

// ============================ PULL REQUESTS ============================
export const pullsApi = {
  list: (id: string) => request<PullRequest[]>(`/repos/${id}/pulls`),
  get: (id: string, number: number) => request<PullRequestDetail>(`/repos/${id}/pulls/${number}`),
  create: (id: string, payload: { title: string; body?: string; source: string; target: string; reviewers?: number[] }) =>
    post<{ number: number }>(`/repos/${id}/pulls`, payload),
  review: (id: string, number: number, state: 'approved' | 'changes_requested' | 'commented', body?: string) =>
    post(`/repos/${id}/pulls/${number}/reviews`, { state, body }),
  comment: (id: string, number: number, body: string) => post(`/repos/${id}/pulls/${number}/comments`, { body }),
  merge: (id: string, number: number) => post<{ ok: boolean; merge_sha?: string; log?: string }>(`/repos/${id}/pulls/${number}/merge`),
  close: (id: string, number: number) => post(`/repos/${id}/pulls/${number}/close`),
};

// ============================ ISSUES ============================
export const issuesApi = {
  list: (id: string) => request<Issue[]>(`/repos/${id}/issues`),
  get: (id: string, number: number) =>
    request<Issue & { comments: IssueComment[] }>(`/repos/${id}/issues/${number}`),
  create: (id: string, title: string, body?: string) => post<{ number: number }>(`/repos/${id}/issues`, { title, body }),
  comment: (id: string, number: number, body: string) => post(`/repos/${id}/issues/${number}/comments`, { body }),
  setStatus: (id: string, number: number, status: 'open' | 'closed') => post(`/repos/${id}/issues/${number}/status`, { status }),
};

// ============================ COLLABORATORS ============================
export const collaboratorsApi = {
  list: (id: string) => request<Collaborator[]>(`/repos/${id}/collaborators`),
  add: (id: string, username: string, role: string) => post(`/repos/${id}/collaborators`, { username, role }),
  remove: (id: string, username: string) =>
    request<void>(`/repos/${id}/collaborators/${encodeURIComponent(username)}`, { method: 'DELETE' }),
};

// ============================ API DETECTION / CI ============================
export const apiDetectApi = {
  get: (id: string) => request<{ detected: Detection | null; manual: { framework: string; language: string } }>(`/repos/${id}/api`),
  run: (id: string) => request<Detection>(`/repos/${id}/detect`, { method: 'POST' }),
};

export const ciApi = {
  runs: (id: string) => request<CiRun[]>(`/repos/${id}/ci/runs`),
  run: (id: string, type: 'build' | 'test') => post<{ id: string }>(`/repos/${id}/ci/${type}`),
  getRun: (id: string, runId: string) => request<CiRun>(`/repos/${id}/ci/runs/${runId}`),
};

// ============================ RELEASES / DEPLOYMENTS / MARKETPLACE ============================
export const releasesApi = {
  list: (id: string) => request<{ releases: Release[]; tags: { name: string; sha: string; date: string }[] }>(`/repos/${id}/releases`),
  create: (id: string, payload: { tag_name: string; name: string; notes?: string; prerelease?: boolean }) =>
    post(`/repos/${id}/releases`, payload),
  publish: (id: string, releaseId: string) => post(`/repos/${id}/releases/${releaseId}/publish`),
  compare: (id: string, from: string, to: string) =>
    request<{ ahead: number; behind: number; commits: CommitInfo[]; patch: string }>(
      `/repos/${id}/releases/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
};

export const deploymentsApi = {
  list: (id: string) => request<Deployment[]>(`/repos/${id}/deployments`),
  create: (id: string, release_id: string, environment?: string) =>
    post<{ id: string; status: string; log: string }>(`/repos/${id}/deployments`, { release_id, environment }),
};

export const marketplaceApi = {
  list: (id: string) => request<MarketplaceListing[]>(`/repos/${id}/marketplace`),
  create: (id: string, payload: Partial<MarketplaceListing> & { release_id: string; name: string }) =>
    post<{ id: string }>(`/repos/${id}/marketplace`, payload),
  setStatus: (id: string, listingId: string, status: string) =>
    post(`/repos/${id}/marketplace/${listingId}/status`, { status }),
};
