export interface KlyraUser {
  id: number;
  username: string;
  email: string | null;
  display_name: string | null;
  avatar_color: string;
}

export interface RepoSummary {
  id: string;
  name: string;
  owner_id: number;
  owner_username: string;
  description: string;
  website?: string;
  topics?: string;
  visibility: 'private' | 'public' | string;
  license: string;
  language: string;
  framework: string;
  default_branch: string;
  deploy_status: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface Collaborator {
  user_id: number;
  role: 'owner' | 'maintainer' | 'developer' | 'reviewer' | string;
  username: string;
  display_name: string | null;
  avatar_color: string;
}

export interface RepoDetail extends RepoSummary {
  role: string | null;
  collaborators: Collaborator[];
  branches: { name: string; sha: string }[];
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: string;
  email: string;
  date: string;
}

export interface BranchInfo {
  name: string;
  sha: string;
  protected: boolean;
  ahead: number;
  behind: number;
  latest_commit: CommitInfo | null;
}

export interface TreeEntry {
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  path: string;
  size?: number;
  last_commit_message?: string;
  last_commit_author?: string;
  last_updated?: string;
}

export interface DetectedEndpoint {
  method: string;
  path: string;
  sourceFile: string;
  line: number;
}

export interface SecretFinding {
  file: string;
  line: number;
  kind: string;
  snippet: string;
}

export interface Detection {
  framework: string | null;
  language: string | null;
  detectedAt: string;
  endpoints: DetectedEndpoint[];
  openapi: { file: string; title?: string; version?: string } | null;
  authRequirements: string[];
  envVariables: { name: string; example: string }[];
  dependencies: Record<string, string>;
  secrets: SecretFinding[];
  scannedFiles: number;
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  body: string;
  source_branch: string;
  target_branch: string;
  author_username: string;
  status: string;
  merged_by_username?: string;
  created_at: string;
}

export interface PullRequestDetail extends PullRequest {
  reviews: { reviewer_username: string; state: string; body: string; created_at: string; avatar_color?: string }[];
  comments: { author_username: string; body: string; created_at: string; avatar_color?: string }[];
  ahead: number;
  behind: number;
  diff: string;
  secret_findings: SecretFinding[];
}

export interface Issue {
  id: string;
  number: number;
  title: string;
  body: string;
  author_username: string;
  status: 'open' | 'closed' | string;
  created_at: string;
  closed_at?: string | null;
  comment_count?: number;
}

export interface IssueComment {
  author_username: string;
  body: string;
  created_at: string;
  avatar_color?: string;
}

export interface Release {
  id: string;
  tag_name: string;
  name: string;
  notes: string;
  prerelease: boolean;
  status: string;
  latest: boolean;
  created_by_username?: string;
  created_at: string;
  marketplace_listing_id?: string | null;
}

export interface CiRun {
  id: string;
  type: 'build' | 'test' | string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'skipped' | string;
  log: string;
  summary: string;
  branch?: string;
  commit_sha?: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface Deployment {
  id: string;
  release_tag?: string;
  environment: string;
  status: string;
  log: string;
  created_at: string;
}

export interface MarketplaceListing {
  id: string;
  release_id: string;
  release_tag?: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  pricing_type: string;
  price_cents: number;
  docs_url: string;
  requirements: string;
  status: string;
  created_at: string;
}

export interface ActivityItem {
  id: string;
  type: string;
  actor_username?: string;
  actor_color?: string;
  payload: any;
  created_at: string;
}

export interface Overview {
  readme: string | null;
  latest_commit: CommitInfo | null;
  commit_count: number;
  branch_count: number;
  tag_count: number;
  contributors: { id: number; username: string; display_name: string | null; avatar_color: string; commits: number }[];
  open_pull_requests: number;
  open_issues: number;
  endpoint_count: number;
  releases_published: number;
  latest_release: { tag_name: string; name: string; status: string; latest: boolean; prerelease: boolean; created_at: string } | null;
  build_status: string;
  test_status: string;
  deploy_status: string;
  detect_updated_at: string | null;
}

export type RepoTab =
  | 'overview' | 'code' | 'branches' | 'pulls' | 'issues' | 'collaborators'
  | 'commits' | 'releases' | 'api' | 'docs' | 'tests' | 'deployments' | 'marketplace' | 'settings';
