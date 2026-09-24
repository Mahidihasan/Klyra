import express, { Router, Request, Response } from 'express';
import { pool } from '../../services/database.service';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { ResolvedGatewayKey } from '../api-keys/api-keys.types';

/**
 * Klyra Gateway — dev-mode request forwarding for API Build projects.
 *
 * Every project advertises a "gateway URL" of the form
 *   {GATEWAY_URL|http://localhost:PORT}/gateway/{slug}
 * Requests arriving there are looked up by project slug and forwarded to the
 * project's upstream origin, so "Test in Playground" hits a URL that actually
 * resolves instead of a fictional api.klyra.com address.
 *
 * Two rules make the advertised URL behave exactly like the API's own base URL,
 * so no caller (Playground, curl, Postman, a consumer) has to know how the API
 * is mounted internally:
 *
 *   1. API base path — the prefix the API's specification declares
 *      (`servers[0].url`, e.g. `/api/v3` for swagger-inflector / springdoc) is
 *      inserted when the caller's path does not already carry it, removed for
 *      projects flagged `stripBasePath`, and never applied twice to an upstream
 *      that already ends with it. Requests that were saved before the base path
 *      was known therefore work unchanged.
 *   2. Byte-for-byte bodies — the request body reaches the upstream exactly as
 *      the caller sent it (express.raw mounts this router, see app.ts), for
 *      every content type. Klyra's own parsers never validate or re-encode a
 *      payload on the way through.
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

const slugOf = (id: string) => {
  // Project ids are `proj-{slug}-{rand}`; fall back to the raw id.
  const m = /^proj-(.+)-[a-z0-9]{4,8}$/i.exec(id);
  return m ? m[1] : id;
};

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
  resolveDeploymentUpstream,
  resolveDeploymentKind,
  activeDeploymentRuntime,
  projectApiBasePath,
  resolveGatewayForwardPath,
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


    // Remaining path after /gateway/{slug}, resolved against the API base path
    // the project's specification declares (OpenAPI `servers[0].url`) so the
    // gateway URL behaves like the API's own base URL: the caller may address an
    // operation directly (`/gateway/{slug}/pet/1`) or include the prefix itself
    // (`/gateway/{slug}/api/v3/pet/1`) — both reach `/api/v3/pet/1` upstream.
    // Without this, every discovered operation answered 404 on the origin.
    const rest = (req.params[0] as string) || '';
    const forwardPath = resolveGatewayForwardPath({
      requestedPath: rest,
      upstream,
      basePath: projectApiBasePath(project),
      stripBasePath: project.stripBasePath === true,
    });
    const search = new URL(req.originalUrl, 'http://localhost').search;
    let target = `${upstream.replace(/\/+$/, '')}${forwardPath}`;
    if (search && search !== '?') target += search;

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
    // Bodies are forwarded byte-for-byte. The gateway must never let Klyra's own
    // body parsers interpret (and re-encode, or reject) a payload: express.json()
    // in its default strict mode answered 400 for legal JSON that is not an
    // object or array (a string body such as the sample a specification can
    // declare), and re-serialising a parsed body destroyed form-urlencoded and
    // multipart payloads. express.raw (app.ts) hands these bytes over untouched.
    const rawBody = req.body;
    const body =
      !['GET', 'HEAD'].includes(method) && Buffer.isBuffer(rawBody) && rawBody.length > 0
        ? new Uint8Array(rawBody)
        : undefined;
    if (body && !headers['content-type']) headers['content-type'] = 'application/json';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const upstreamRes = await fetch(target, { method, headers, body: body as any, signal: controller.signal, redirect: 'follow' });
      const text = await upstreamRes.text();
      res.status(upstreamRes.status);
      upstreamRes.headers.forEach((v, k) => {
        if (HOP_BY_HOP.has(k.toLowerCase()) || k.toLowerCase() === 'set-cookie') return;
        res.setHeader(k, v);
      });
      return res.send(text);
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const aborted = (err as { name?: string })?.name === 'AbortError';
    return res.status(aborted ? 504 : 502).json({
      error: aborted ? 'Upstream request timed out.' : 'Gateway forwarding failed.',
      detail: err instanceof Error ? err.message : String(err),
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