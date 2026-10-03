import express, { Router, Request, Response } from 'express';
import { pool } from '../../services/database.service';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { ResolvedGatewayKey } from '../api-keys/api-keys.types';
import { detectUpstream } from './api-build.detect';
import { saveProject } from './api-build.service';

/**
 * Klyra Gateway — dev-mode request forwarding for API Build projects.
 *
 * Every project advertises a "gateway URL" of the form
 *   {GATEWAY_URL|http://localhost:PORT}/gateway/{slug}
 * Requests arriving there are looked up by project slug and forwarded to the
 * project's upstream origin (project.baseUrl), so "Test in Playground" hits a
 * URL that actually resolves instead of a fictional api.klyra.com address.
 *
 * Authentication:
 *   - A presented `kly…` key (Authorization: Bearer or x-api-key) is always
 *     validated against the consumer key store (api_keys) and the provider
 *     key store minted by API Build (api_build_api_keys). Invalid, expired,
 *     suspended, or revoked keys are rejected before forwarding.
 *   - Projects configured with authKind 'apiKey' additionally REQUIRE a valid
 *     key; other auth kinds stay open for local development compatibility.
 *   - On success the gateway tags the upstream request with x-klyra-* identity
 *     headers and records key usage (last_used_at).
 */
const router = Router();

const HOP_BY_HOP = new Set([
  'host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade',
  'proxy-authenticate', 'proxy-authorization', 'te', 'trailer',
  'content-length', 'content-encoding',
]);

/** Join a gateway route to an upstream URL without duplicating its mount path.
 * OpenAPI servers commonly declare `/api/v1` while the configured upstream
 * base URL already contains `/api/v1`; naive string concatenation then sends
 * `/api/v1/api/v1/...` and makes otherwise valid generated endpoints fail.
 */
function upstreamRequestUrl(upstream: string, routePath: string, search: string): string {
  const target = new URL(upstream);
  const prefix = target.pathname.replace(/\/+$/, '');
  const route = `/${String(routePath || '').replace(/^\/+|\/+$/g, '')}`;
  const prefixParts = prefix.split('/').filter(Boolean);
  const routeParts = route.split('/').filter(Boolean);
  let overlap = Math.min(prefixParts.length, routeParts.length);
  while (overlap > 0 && prefixParts.slice(-overlap).join('/') !== routeParts.slice(0, overlap).join('/')) overlap -= 1;
  target.pathname = `/${[...prefixParts, ...routeParts.slice(overlap)].join('/')}`;
  target.search = search && search !== '?' ? search : target.search;
  target.hash = '';
  return target.toString();
}

const slugOf = (id: string) => {
  // Project ids are `proj-{slug}-{rand}`; fall back to the raw id.
  const m = /^proj-(.+)-[a-z0-9]{4,8}$/i.exec(id);
  return m ? m[1] : id;
};

/* ---------------------------------------------------------------------------
 * Base-path aware forwarding.
 *
 * An OpenAPI document declares the prefix its operations are served under
 * (`servers[0].url` — `/api/v3` for the Swagger Petstore image, `/v3` for the
 * OpenAPI Petstore). A request URL that leaves that prefix out reaches the
 * container's front controller instead of the API and answers 404 — which is
 * exactly the failure the Playground showed for Petstore:
 *
 *   GET /api/gateway/balerapi/pet/findByTags            -> 404 (Jetty: /pet/…)
 *   GET /api/gateway/balerapi/api/v3/pet/findByTags     -> 200
 *
 * The gateway therefore knows the API's base path (detection records it on the
 * project) and, when a forwarded request comes back 404/405 without it, retries
 * once WITH it rather than surfacing a path-construction failure to the caller.
 * Requests that already carry the prefix, APIs served at their origin root, and
 * every non-404/405 response are forwarded exactly as before.
 * ------------------------------------------------------------------------- */

/** HTTP statuses that mean "nothing is served at this path" (same rule the
 *  detection layer uses to tell a missing mount from a present one). */
const NOT_SERVED_STATUS = new Set([404, 405]);

/**
 * Discovery results, so a project record that predates base-path detection is
 * probed once instead of on every request. A negative result is cached too: an
 * API that really serves at its root must not be probed again and again.
 */
const basePathCache = new Map<string, { basePath: string; at: number }>();
const BASE_PATH_CACHE_MS = 5 * 60 * 1000;

/**
 * Probes the deployment's own origin for the API's base path, stores it on the
 * project record (so the Playground's next import carries it) and caches it for
 * this process. A probe that finds nothing, or fails, changes nothing.
 */
async function discoverProjectBasePath(
  project: Record<string, unknown>,
  projectId: string,
  upstream: string,
): Promise<string> {
  const cached = basePathCache.get(projectId);
  if (cached && Date.now() - cached.at < BASE_PATH_CACHE_MS) return cached.basePath;

  let discovered = '';
  try {
    const detection = await detectUpstream(upstream, '', 5000);
    if (detection.found && detection.basePath) discovered = normalizeApiBasePath(detection.basePath);
  } catch {
    // Unreachable or spec-less upstream: keep today's behaviour (forward as-is).
  }
  basePathCache.set(projectId, { basePath: discovered, at: Date.now() });
  if (discovered) {
    const stored =
      project.detection && typeof project.detection === 'object'
        ? (project.detection as Record<string, unknown>)
        : {};
    await saveProject({
      ...project,
      id: projectId,
      detection: { ...stored, basePath: discovered },
    }).catch(() => undefined);
  }
  return discovered;
}

/** Extracts a Klyra-issued key from the request, if the caller presented one. */
function extractKlyraKey(req: Request): string | null {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.trim().startsWith('kly')) return header.trim();
  const authorization = req.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice(7).trim();
    if (token.startsWith('kly')) return token;
  }
  return null;
}

import {
  apiSubPathWithBasePath,
  normalizeApiBasePath,
  projectApiBasePath,
  resolveDeploymentUpstream,
  resolveDeploymentKind,
  activeDeploymentRuntime,
} from './api-build.deployment';

const handleGateway = async (req: Request, res: Response): Promise<Response> => {
  try {
    const slug = String(req.params.slug || '');
    if (!slug) return res.status(400).json({ error: 'Gateway slug is required.' });

    // Validate any presented API key before doing anything else.
    const presentedKey = extractKlyraKey(req);
    let resolvedKey: ResolvedGatewayKey | null = null;
    if (presentedKey) {
      const resolved = await ApiKeysService.resolveGatewayKey(presentedKey);
      if (!resolved.ok) return res.status(resolved.status).json({ error: resolved.reason });
      resolvedKey = resolved.key;
    }

    // Find the project whose slug (or id) matches. The project JSON is the
    // source of truth, same as the rest of the api-build module.
    const result = await pool.query('SELECT id, project FROM api_build_projects');
    const row = result.rows.find((r: Record<string, unknown>) => {
      const project = r.project as Record<string, unknown> | null;
      if (!project) return false;
      const projectSlug = String(project.slug ?? '') || slugOf(String(r.id));
      return projectSlug === slug || String(r.id) === slug;
    });
    const project = row?.project as Record<string, unknown> | undefined;
    if (!project) return res.status(404).json({ error: `No API project is registered under "/gateway/${slug}".` });

    // A key bound to a specific API Build project is only valid for that project.
    if (resolvedKey?.projectId && resolvedKey.projectId !== String(row?.id)) {
      return res.status(403).json({ error: 'This API key is not valid for this API project.' });
    }

    // The key must actually be authorized for this project.
    if (resolvedKey) {
      const authorized =
        (resolvedKey.projectId && resolvedKey.projectId === String(row!.id)) ||
        (resolvedKey.apiSlug && resolvedKey.apiSlug === slug);
      if (!authorized) {
        return res.status(403).json({ error: 'This API key is not valid for the requested API.' });
      }
      // Record usage so the API Keys page can show last-used activity.
      if (resolvedKey.userId) {
        void pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [resolvedKey.keyId]).catch(() => undefined);
      } else {
        void pool.query('UPDATE api_build_api_keys SET last_used = NOW() WHERE id = $1', [resolvedKey.keyId]).catch(() => undefined);
      }
    } else if (String(project.authKind ?? 'none') === 'apiKey') {
      return res.status(401).json({ error: 'API key required. Pass it via the Authorization header (Bearer kly…) or x-api-key.' });
    }

    // Check Docker deployment status before routing
    const depKind = resolveDeploymentKind(project);
    if (depKind === 'docker') {
      const dep = (project.deployment as Record<string, unknown> | undefined) || {};
      const status = String(dep.status || '').toLowerCase();
      if (status !== 'healthy' && status !== 'healthy-external') {
        return res.status(503).json({
          error: `API container for "${slug}" is not currently healthy (status: ${status || 'pending'}). Deploy the container to enable gateway forwarding.`,
        });
      }
    }

    const upstream = resolveDeploymentUpstream(project);
    if (!upstream) {
      return res.status(502).json({ error: 'This project has no active upstream or container origin configured yet.' });
    }


    // Remaining path after /gateway/{slug}; preserve the caller's query string.
    const rest = (req.params[0] as string) || '';
    const search = new URL(req.originalUrl, 'http://localhost').search;
    let target: string;
    try {
      target = upstreamRequestUrl(upstream, rest, search);
    } catch {
      return res.status(502).json({ error: 'The configured upstream URL is invalid.' });
    }

    const headers: Record<string, string> = {};
    Object.entries(req.headers).forEach(([k, v]) => {
      if (HOP_BY_HOP.has(k.toLowerCase())) return;
      headers[k] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
    });

    // The gateway consumed the Klyra credential — forward identity instead of
    // the raw secret. A non-Klyra Authorization header is passed through as-is.
    if (resolvedKey && presentedKey) {
      if (headers.authorization === `Bearer ${presentedKey}`) delete headers.authorization;
      delete headers['x-api-key'];
      if (resolvedKey.userId) headers['x-klyra-user-id'] = resolvedKey.userId;
      headers['x-klyra-key-id'] = resolvedKey.keyId;
      headers['x-klyra-key-name'] = encodeURIComponent(resolvedKey.keyName);
    }

    const method = req.method.toUpperCase();
    const hasBody = !['GET', 'HEAD'].includes(method);
    const body = hasBody
      ? (Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : JSON.stringify(req.body ?? {}))
      : undefined;
    if (hasBody && body !== undefined && !Buffer.isBuffer(req.body)) {
      headers['content-type'] = headers['content-type'] || 'application/json';
    }

    /**
     * Forwards once and buffers the response, so a 404/405 can still be turned
     * into a path-corrected retry before anything is written to the client.
     */
    const forward = async (url: string) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const upstreamRes = await fetch(url, {
          method,
          headers,
          body: body as any,
          signal: controller.signal,
          redirect: 'follow',
        });
        const text = await upstreamRes.text();
        const forwardedHeaders: Record<string, string> = {};
        upstreamRes.headers.forEach((v, k) => {
          // fetch() decodes compressed responses before text() reads them, so
          // forwarding the original encoding header would corrupt the body.
          if (HOP_BY_HOP.has(k.toLowerCase()) || ['set-cookie', 'content-encoding'].includes(k.toLowerCase())) return;
          forwardedHeaders[k] = v;
        });
        return { status: upstreamRes.status, headers: forwardedHeaders, text };
      } finally {
        clearTimeout(timeout);
      }
    };

    const sendUpstream = (result: { status: number; headers: Record<string, string>; text: string }): Response => {
      res.status(result.status);
      Object.entries(result.headers).forEach(([key, value]) => res.setHeader(key, value));
      return res.send(result.text);
    };

    let outcome = await forward(target);

    // A 404/405 from the upstream is the signature of a request that omitted the
    // API's base path (Petstore answers 404 for `/pet/findByTags` and 200 for
    // `/api/v3/pet/findByTags`). Retry once with the base path detection
    // recorded for this project — lazily discovered and stored when the record
    // predates base-path support.
    if (NOT_SERVED_STATUS.has(outcome.status)) {
      const basePath =
        projectApiBasePath(project) || (await discoverProjectBasePath(project, String(row!.id), upstream));
      const prefixed = apiSubPathWithBasePath(rest, basePath);
      if (prefixed) {
        const retried = await forward(upstreamRequestUrl(upstream, prefixed, search));
        if (!NOT_SERVED_STATUS.has(retried.status)) {
          console.warn(
            `[gateway] ${slug}: ${method} ${rest || '/'} answered ${outcome.status}; retried under the API base path ${basePath} (HTTP ${retried.status}).`,
          );
          outcome = retried;
        }
      }
    }

    return sendUpstream(outcome);
  } catch (err) {
    const aborted = (err as { name?: string })?.name === 'AbortError';
    const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
    const code = String(cause?.code || '');
    const unreachable = ['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET'].includes(code);
    return res.status(aborted ? 504 : unreachable ? 503 : 502).json({
      error: aborted
        ? 'Upstream request timed out.'
        : unreachable
          ? 'The configured upstream is unavailable. Check that the API container is running, then redeploy if needed.'
          : 'Gateway forwarding failed.',
      detail: code || (err instanceof Error ? err.message : String(err)),
    });
  }
};

// /gateway/{slug}/<any path> — the advertised gateway route.
router.all('/:slug/*', (req: Request, res: Response) => {
  void handleGateway(req, res);
});

// Bare /gateway/{slug} — same lookup with an empty sub-path.
router.all('/:slug', (req: Request, res: Response) => {
  (req.params as Record<string, string>)[0] = '';
  void handleGateway(req, res);
});

export default router;
