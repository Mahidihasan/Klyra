import { pool } from '../../services/database.service';
import { buildProfileAchievements, sanitizeEducation, sanitizeExperience, sanitizeSkills } from '../auth/auth.service';
import type { UserMetadata } from '../auth/auth.types';
import { CertificatesService } from '../certificates/certificates.service';
import type { PublicProfileActivity, PublicProfileApi, PublicProfileApiPricingPlan, PublicProfileResponse } from './public-profile.types';

const USERNAME_PATTERN = /^[a-z][a-z0-9_-]{1,28}[a-z0-9]$/;

interface AchievementMetrics {
  published_api_count: number | string;
  active_subscriber_count: number | string;
  api_version_count: number | string;
}

export interface PublicUsernameSearchResult {
  username: string;
  name: string;
  avatar_url: string | null;
}

function numberValue(value: number | string | null | undefined): number {
  return Number(value) || 0;
}

function endpointCountFromSpec(apiSpec: unknown): number {
  if (!apiSpec || typeof apiSpec !== 'object') return 0;
  const paths = (apiSpec as { paths?: unknown }).paths;
  if (!paths || typeof paths !== 'object') return 0;

  let count = 0;
  for (const operations of Object.values(paths as Record<string, unknown>)) {
    if (!operations || typeof operations !== 'object') continue;
    for (const method of Object.keys(operations)) {
      if (['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())) {
        count += 1;
      }
    }
  }
  return count;
}

export class PublicProfileService {
  static async searchUsernames(query: string, excludeUserId?: string): Promise<PublicUsernameSearchResult[]> {
    const term = query.trim();
    if (!term) return [];

    const values = [`%${term}%`];
    const excludeCurrentUser = excludeUserId ? ' AND u.id <> $2' : '';
    if (excludeUserId) values.push(excludeUserId);

    const result = await pool.query<PublicUsernameSearchResult>(
      `SELECT u.username, u.name, u.avatar_url
       FROM users u
       WHERE u.username ILIKE $1 AND u.deleted_at IS NULL${excludeCurrentUser}
       ORDER BY LOWER(u.username) ASC
       LIMIT 8`,
      values,
    );
    return result.rows;
  }

  static async getByUsername(username: string, viewerUserId?: string): Promise<PublicProfileResponse | null> {
    if (!USERNAME_PATTERN.test(username.toLowerCase())) return null;

    // This intentionally selects only data which contributes to the public DTO.
    const userResult = await pool.query(
      `SELECT u.id, u.name, u.username, u.avatar_url, u.bio, u.company, u.website,
              u.metadata, u.created_at, u.email_verified_at, u.two_factor_enabled
       FROM users u
       WHERE LOWER(u.username) = LOWER($1) AND u.deleted_at IS NULL`,
      [username],
    );
    const user = userResult.rows[0];
    if (!user) return null;

    const [metricsResult, certificates, apisResult, activityResult] = await Promise.all([
      pool.query<AchievementMetrics>(
        `SELECT COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'PUBLISHED') AS published_api_count,
                COUNT(DISTINCT us.id) AS active_subscriber_count,
                COUNT(DISTINCT av.id) AS api_version_count
         FROM apis a
         LEFT JOIN user_subscriptions us ON us.api_id = a.id AND us.status = 'ACTIVE'
         LEFT JOIN api_versions av ON av.api_id = a.id
         WHERE a.owner_id = $1 AND a.deleted_at IS NULL`,
        [user.id],
      ),
      CertificatesService.getPublicIssuedCertificates(user.id),
      pool.query(
        `SELECT a.id, a.slug, a.name, a.description, a.current_version, a.docs_url,
                c.name AS category_name, c.slug AS category_slug, a.pricing_model, a.tags,
                a.api_spec, a.last_published_at, a.updated_at,
                (SELECT COUNT(*) FROM api_stars s WHERE s.api_id = a.id) AS star_count
         FROM apis a
         LEFT JOIN categories c ON c.id = a.category_id
         WHERE a.owner_id = $1 AND a.status = 'PUBLISHED'
           AND a.is_public = true AND a.deleted_at IS NULL
         ORDER BY COALESCE(a.last_published_at, a.updated_at) DESC`,
        [user.id],
      ),
      pool.query<PublicProfileActivity>(
        `SELECT activity.id, activity.label, activity.kind, activity.created_at AS at
         FROM api_build_activity activity
         JOIN api_build_projects project ON project.id = activity.project_id
         WHERE project.project->>'ownerId' = $1
           AND project.project @> '{"published": true, "visibility": "public"}'::jsonb
           AND activity.created_at >= NOW() - INTERVAL '12 months'
         ORDER BY activity.created_at DESC`,
        [user.id],
      ),
    ]);

    const apiIds = apisResult.rows.map((api) => api.id);
    const plansResult = apiIds.length === 0 ? { rows: [] as any[] } : await pool.query(
      `SELECT api_id, name, slug, description, price, currency, billing_interval, features, rate_limit
       FROM subscription_plans
       WHERE api_id = ANY($1::uuid[]) AND is_active = true AND deleted_at IS NULL
       ORDER BY price ASC`,
      [apiIds],
    );
    const pricingByApi = new Map<string, PublicProfileApiPricingPlan[]>();
    for (const plan of plansResult.rows) {
      const pricing = pricingByApi.get(plan.api_id) ?? [];
      pricing.push({
        name: plan.name, slug: plan.slug, description: plan.description,
        price: numberValue(plan.price), currency: plan.currency, billing_interval: plan.billing_interval,
        features: Array.isArray(plan.features) ? plan.features : [], rate_limit: plan.rate_limit === null ? null : numberValue(plan.rate_limit),
      });
      pricingByApi.set(plan.api_id, pricing);
    }

    const metadata: UserMetadata = user.metadata || {};
    const personalInfo = metadata.personal_info || {};
    const metrics = metricsResult.rows[0] ?? { published_api_count: 0, active_subscriber_count: 0, api_version_count: 0 };
    const publishedApis: PublicProfileApi[] = apisResult.rows.map((api) => ({
      slug: api.slug, name: api.name, description: api.description, current_version: api.current_version,
      documentation_url: api.docs_url,
      category: api.category_name ? { name: api.category_name, slug: api.category_slug } : null,
      pricing_model: api.pricing_model, tags: Array.isArray(api.tags) ? api.tags : [],
      endpoint_count: endpointCountFromSpec(api.api_spec), pricing: pricingByApi.get(api.id) ?? [],
      published_at: api.last_published_at, updated_at: api.updated_at,
      star_count: Number(api.star_count || 0), viewer_has_starred: false,
    }));

    if (viewerUserId && publishedApis.length > 0) {
      const starred = await pool.query(
        'SELECT api_id FROM api_stars WHERE user_id = $1 AND api_id = ANY($2::uuid[])',
        [viewerUserId, apisResult.rows.map((api) => api.id)],
      );
      const starredIds = new Set(starred.rows.map((row) => String(row.api_id)));
      for (let index = 0; index < publishedApis.length; index += 1) {
        publishedApis[index].viewer_has_starred = starredIds.has(String(apisResult.rows[index].id));
      }
    }

    return {
      profile: {
        name: user.name, username: user.username, avatar_url: user.avatar_url,
        job_title: personalInfo.job_title || null, company: user.company, bio: user.bio,
        github: personalInfo.github_url || null, website: user.website,
        skills: sanitizeSkills(metadata.skills), experience: sanitizeExperience(metadata.experience),
        education: sanitizeEducation(metadata.education),
      },
      achievements: buildProfileAchievements(user, metrics),
      certificates,
      published_apis: publishedApis,
      activity: activityResult.rows,
    };
  }
}
