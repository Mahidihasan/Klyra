export interface PublicProfileAchievement {
  id: 'origin' | 'momentum' | 'ascendant' | 'legacy' | 'distinction' | 'vanguard';
  name: string;
  description: string;
  detail: string;
}

export interface PublicUsernameSearchResult {
  username: string;
  name: string;
  avatar_url: string | null;
}

export interface PublicProfileCertificate {
  certificate_type: 'MARKETPLACE_IMPACT' | 'SECURITY_VERIFIED';
  title: string;
  description: string;
  issued_at: string;
  published_api_count: number;
  active_subscriber_count: number;
  api_version_count: number;
  criteria_version: number;
}

export interface PublicProfileResponse {
  profile: {
    name: string;
    username: string;
    avatar_url: string | null;
    job_title: string | null;
    company: string | null;
    bio: string | null;
    github: string | null;
    website: string | null;
    skills: string[];
    experience: Array<{ title: string; company: string; start_date: string; end_date: string | null; is_current: boolean; description: string | null }>;
    education: Array<{ institution: string; program: string; start_date: string; end_date: string | null; is_current: boolean; description: string | null }>;
  };
  achievements: PublicProfileAchievement[];
  certificates: PublicProfileCertificate[];
  published_apis: Array<{
    slug: string;
    name: string;
    description: string;
    current_version: string;
    documentation_url: string | null;
    category: { name: string; slug: string } | null;
    pricing_model: string;
    tags: string[];
    endpoint_count: number;
    pricing: Array<{ name: string; slug: string; description: string | null; price: number; currency: string; billing_interval: string; features: string[]; rate_limit: number | null }>;
    published_at: string | null;
    updated_at: string;
    star_count: number;
    viewer_has_starred: boolean;
  }>;
  activity: Array<{ id: string; label: string; kind: string; at: string }>;
}

export class PublicProfileApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function getPublicProfile(username: string, signal?: AbortSignal): Promise<PublicProfileResponse> {
  const token = localStorage.getItem('klyra_access_token');
  const response = await fetch(`/api/users/${encodeURIComponent(username)}/profile`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new PublicProfileApiError(response.status, body?.error || 'Unable to load this public profile.');
  }
  return response.json();
}

export async function searchPublicUsernames(query: string, signal?: AbortSignal): Promise<PublicUsernameSearchResult[]> {
  const token = localStorage.getItem('klyra_access_token');
  const response = await fetch(`/api/users/search?query=${encodeURIComponent(query)}`, {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new PublicProfileApiError(response.status, 'Unable to search public usernames.');
  return response.json();
}
