# Klyra API Studio — Architecture, Hosting & Deployment Flow

> Analysis/documentation only. Describes the code as it exists today (backend `src/modules/api-build`, frontend `src/pages/ApiBuild`).

---

## 1. Architecture overview

Klyra is a single-process Express backend that hosts both the **control plane** (API Studio CRUD, deployments, operations) and the **data plane** (the `/api/gateway` forwarder). Postgres (Neon in dev) is the only durable store; Docker (via the host's Docker CLI) is the runtime for user APIs. Redis/Bull, Nginx and S3 are declared in the README/compose files but are **not** used by the API Studio pipeline.

```
Browser (React, :3000, Vite proxy)
   │  REST /api/api-build/*          REST /api/gateway/{slug}/*
   ▼
Express backend (:4000)  ──  api-build module ──► Postgres (api_build_* tables)
   │  control plane: routes → operations → deploy pipeline
   │  data plane:    /api/gateway → resolve upstream → fetch()
   ▼
Docker CLI (spawn) ──► klyra-api-network: klyra-api-{slug}-{version} containers
```

### Component responsibilities

| Component | File(s) | Responsibility |
|---|---|---|
| API Studio UI | `frontend/src/pages/ApiBuild/*` (`Page.tsx`, `Wizard1–8`, `ProjectsDashboard`) | Wizard, workspace tabs, polls operation progress every 700 ms |
| Frontend API client | `frontend/src/services/apiBuild.ts` | Typed REST client; POST `/operations`, GET operation, upload ZIP |
| Control-plane routes | `backend/src/modules/api-build/api-build.routes.ts` | `/api/api-build/*`: projects, endpoints, versions, plans, keys, deployments, logs, operations, upload, detect |
| Operation system | `api-build.operations.ts` | Durable async ops (`api_build_operations`): `queued→validating→running→succeeded/failed/cancelled`, progress+log reports, retry/cancel, crash reaper |
| Deploy pipeline | `api-build.deploy.ts` | Single orchestrator for external + docker deployments; persists deployment rows & project runtime |
| Docker runtime | `api-build.docker.ts` | Real `docker` CLI calls: diagnostic, network, build, pull, run, inspect, readiness |
| Source ingest | `api-build.upload.ts` | ZIP extraction (Zip-Slip safe, ≤50 MB), GitHub shallow clone, Dockerfile/EXPOSE detection |
| Gateway | `api-build.gateway.ts` | `/api/gateway/{slug}/*`: key auth, health gating, forwarding |
| Deployment model | `api-build.deployment.ts` | Gateway URL builder, kind resolution (`external`/`docker`), upstream resolution, client sanitization |
| Telemetry worker | `api-build.telemetry.ts` | 60 s health probes of live projects → logs/usage/incidents |
| Deploy queue | `api-build.queue.ts` | `api_build_jobs` worker (`FOR UPDATE SKIP LOCKED`), started in `server.ts` |
| Storage | `api-build.service.ts` + `services/database.service.ts` | Raw SQL via `pg` Pool; projects as JSONB |
| Postgres | `infrastructure/database/*.sql` migrations | 69 tables incl. all `api_build_*` |
| Marketplace/catalog | `modules/catalog`, `modules/provider` | `apis`/`api_versions` tables; **separate** from `api_build_projects` (publish only flips flags on the project JSON) |

## 2. Creating an API in API Studio

1. **Wizard 1 (Project)** — `POST /api/api-build/projects` → `newProjectRecord()`: id `proj-{slug}-{rand6}`, `status:'draft'`, `version:'v1.0.0'`, `sourceKind` (`existing|github|docker`), and a canonical `gatewayUrl` from `buildGatewayUrl(slug)`. `ensureProjectDefaults()` inserts version `v1.0.0` (`api_build_versions`), Free/Pro/Business plans (`api_build_plans`) and an activity row.
2. **Wizard 2 (Source)**:
   - *existing*: `baseUrl` probe.
   - *github*: `POST /projects/:id/source/github` → `git clone --depth 1 --single-branch` into `backend/.data/api-build-uploads/upl-*`; detect Dockerfile, build context, `EXPOSE` port; persist `repository/branch` on the project.
   - *docker*: `image` mode (reference string) or `folder` mode (ZIP → `POST /upload-project`, sandboxed extraction, Dockerfile + port detection).
3. **Wizard 3 (Detect)** — `detectUpstream()` probes reachability then common spec paths (`/openapi.json`, `/swagger.json`, `/v3/api-docs`, …); `extractOperations()` → `api_build_endpoints`. Container sources defer discovery to the deploy pipeline (85 % step).
4. **Wizard 4 (Configure)** — auth kind, rate limit, health path, timeouts, environment.
5. **Wizard 5 (Deploy)** — frontend `Page.tsx` creates a real `deploy` operation and polls it.
