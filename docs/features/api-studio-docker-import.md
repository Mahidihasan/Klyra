# API Studio — Importing a Project from Docker

> **Feature documentation** — How the API Studio (API Build) "Deploy a container" flow works end to end: the wizard, project persistence, OpenAPI discovery, the real Docker container lifecycle, gateway routing, and the deploy queue. This document describes one source kind of the API Build workflow and does not describe the complete Klyra platform.

---

## Table of Contents

1. [Overview](#overview)
2. [What "import by Docker" means](#what-import-by-docker-means)
3. [The wizard flow (frontend)](#the-wizard-flow-frontend)
4. [Project creation and persistence](#project-creation-and-persistence)
5. [Detection and endpoint import](#detection-and-endpoint-import)
6. [Deployment model and kind resolution](#deployment-model-and-kind-resolution)
7. [The real Docker container lifecycle](#the-real-docker-container-lifecycle)
8. [Gateway routing](#gateway-routing)
9. [The deploy queue](#the-deploy-queue)
10. [Configuration (environment variables)](#configuration-environment-variables)
11. [Naming conventions](#naming-conventions)
12. [Security: what never leaves the backend](#security-what-never-leaves-the-backend)
13. [End-to-end sequence](#end-to-end-sequence)
14. [Current implementation status and caveats](#current-implementation-status-and-caveats)
15. [Implementation reference (file map)](#implementation-reference-file-map)

---

## Overview

API Studio (the "API Build" module, reachable from the sidebar button **API Studio**) is the provider workflow for creating an API project. The projects dashboard offers three ways to bring an API in:

> *"Connect an existing API, or deploy from GitHub or Docker. Manage, version, monetize and publish it to the Klyra marketplace."*

The **Docker import** path lets a provider run any OCI container image — from Docker Hub, GHCR, ECR, GCR, or a private registry — as a Klyra-hosted API. Klyra pulls (or builds) the image, starts a real container on a shared Docker network, health-checks it, and fronts it with the Klyra gateway so it becomes a governed, monetizable API product.

Nothing in the container lifecycle is simulated: the image is pulled (or the uploaded project is built) with the real Docker CLI, a real container is started on the shared Klyra network, and a deployment is only reported **healthy** after a real readiness check answers (automatic path discovery, a configured HTTP endpoint such as `/health`, or a raw TCP socket probe). Every failure surfaces as an exception — a failed deploy never produces a healthy record.

---

## What "import by Docker" means

API Studio supports three `sourceKind` values (`frontend/src/types/apibuild.ts`):

| `sourceKind` | Wizard choice | Meaning | Default deployment kind |
|---|---|---|---|
| `existing` | *Connect an existing API* | Proxy an already-running HTTPS origin. | `external` (gateway fronts the upstream, no hosting) |
| `github` | *Deploy from GitHub* | Build from repository source with branch-aware releases. | `docker` (Klyra-hosted container) |
| `docker` | *Deploy a container* | Run an OCI image from any registry. | `docker` (Klyra-hosted container) |

The import-by-Docker flow is the `docker` source kind, which supports two source modes that converge on the same deployment pipeline:

- **OCI Image** — the provider supplies a **container image reference** (pulled with `docker pull`).
- **Project Folder** — the provider uploads a project **ZIP archive** containing a `Dockerfile`; Klyra extracts it safely, detects the Dockerfile path, build context and `EXPOSE` port, then builds the image with `docker build`.

Both modes accept an optional **OpenAPI URL** and a **readiness strategy**. Klyra runs the resulting image and publishes the API under the project's gateway URL.

---

## The wizard flow (frontend)

Implemented in `frontend/src/pages/ApiBuild/Wizard2.tsx` (`StepSource`, step 2 of 8).

When the provider selects **Deploy a container**, the wizard first offers a dual source selector — **OCI Image** or **Project Folder** — and then collects:

| Mode | Field | Binding | Default | Purpose |
|---|---|---|---|---|
| both | Internal port | `dockerPort` | detected from `EXPOSE`, else `8080` | The port the container listens on inside |
| both | OpenAPI URL (optional) | `openApiUrl` | auto-discovery | Direct link to the API specification, used by detection |
| both | Readiness check mode | `readinessMode` | `auto` | `Automatic` (path discovery) · `HTTP Endpoint` · `TCP Port` |
| both | Health check HTTP path | `readinessPath` | `/health` | Only when mode is `HTTP Endpoint` |
| OCI Image | Container image | `dockerImage` | — | Full image reference, e.g. `ghcr.io/organization/service-api:latest` |
| Project Folder | Project ZIP | `dockerUploadId` | — | Uploaded archive; the backend returns the detected project name |
| Project Folder | Dockerfile path | `dockerfilePath` | `./Dockerfile` | Detected then editable |
| Project Folder | Build context | `buildContext` | `./` | Detected then editable |

Validation runs before continuing: *"Enter a container image reference."* for image mode and *"Upload a project folder ZIP before continuing."* for folder mode. The wizard copy advertises the registries supported: **Docker Hub, GHCR, ECR, GCR, or a private registry**.

The Project Folder mode uploads via `apiBuildService.uploadProjectFolder(file)` (`POST /api/api-build/upload-project`, multipart field `file`, ≤ 50 MB); the response supplies the detected project name, Dockerfile path, build context and `EXPOSE` port that pre-fill the form.

After the source step, the wizard continues through **Detect → Configure → Deploy → Product → Pricing → Publish** (8 steps total), reusing the same pipeline as the other source kinds.

### GitHub sources (obtain source → build)

Selecting **Deploy from GitHub** and submitting a repository runs a real acquisition step before the Detect step renders:

1. `POST /api/api-build/projects/:id/source/github` validates the repository URL (https or scp-style ssh only — no whitespace, shell metacharacters or `..` traversal) and the branch name (no leading `-`, no `..`).
2. The backend shallow-clones the repository (`git clone --depth 1 --single-branch`, array argv — never a shell) into the isolated uploads sandbox. A missing branch falls back to the repository default branch instead of failing.
3. The clone is inspected for `Dockerfile`, build context and `EXPOSE` port; those facts plus `repository`/`branch` are persisted on the project and reused by the deploy pipeline (no second clone).
4. On failure (bad URL, git unavailable, private repo, missing Dockerfile) the Detect step states the reason and nothing is deployed.

Because the container does not exist yet, `/detect` returns a *deferred discovery* payload for container sources instead of an error: the OpenAPI specification is discovered by the deploy pipeline once the container reports healthy, and the endpoints are imported automatically.

### Progress reporting

Every long step reports a real percentage:

| Step | Progress source |
|---|---|
| Detect (Source step) | Staged percentages from the wizard: project creation → source acquisition (clone / upstream probe) → specification scan → finalize |
| Project Folder upload | Real transfer percentage reported by `XMLHttpRequest.upload.onprogress` (the service falls back to `fetch` when no progress callback is supplied) |
| Deploy | The durable operation row's `progress`, polled every 700 ms; the step also renders the operation's real log lines (batched by the backend) and flips to a failed state with the pipeline error when the operation fails |

---

## Project creation and persistence

- The wizard creates the project via `POST /api/api-build/projects`.
- The route builds the record with `newProjectRecord()` (`api-build.routes.ts`), storing:
  - `sourceKind: 'docker'` (from the wizard)
  - a canonical `gatewayUrl` computed at creation from the slug via `buildGatewayUrl(slug)` — `{GATEWAY_URL | http://localhost:4000}/api/gateway/{slug}`
  - default status `draft`, version `v1.0.0`, health check path `/health`
- Projects are stored as JSON in the `api_build_projects` table (`project` JSONB column). The container image reference and port ride along in the project JSON (`dockerImage`, `dockerPort`) so the deploy pipeline can act on them later.
- Read-time healing normalizes stale `gatewayUrl` values on every read (`normalizeProjectGatewayUrl`), so older records are upgraded in place without a data migration.

---

## Detection and endpoint import

Implemented in `backend/src/modules/api-build/api-build.detect.ts` and exposed through the routes.

1. `detectUpstream(baseUrl, explicitSpecUrl)` probes the API for reachability (6 s timeout) and then tries common specification paths: `/openapi.json`, `/swagger.json`, `/api/openapi.json`, `/v3/api-docs`, `/api-docs`, `/openapi.yaml`, `/openapi.yml`, `/swagger.yaml` (12 s timeout each). An explicit `openApiUrl` from the wizard skips path guessing.
2. The document is parsed as JSON first, with a deliberately conservative YAML subset fallback (enough for standard `paths`/methods/spec metadata).
3. `inspect()` produces a `DetectionPayload`: OpenAPI version, endpoint count, schema count, auth kind (`securitySchemes`), title/description, servers, and a detected endpoint list.
4. `extractOperations()` converts the payload into `ImportableEndpoint` records — method, path, inferred category, parameters, request/response samples, auth requirement, rate limit — ready for the relational catalog.
5. The wizard imports them with `POST /projects/:id/endpoints/import`, which calls `importEndpoints()` to write the project's endpoint catalog (`api_build_endpoints`).

For a Docker-sourced project the base URL is derived from the image configuration (the exposed port on the container host/URL the provider confirmed in the Configure step); if the image ships no spec, the catalog can be defined manually in the workspace instead.

---

## Deployment model and kind resolution

Implemented in `backend/src/modules/api-build/api-build.deployment.ts` — the single source of truth for the deployment model shared by the gateway, the deploy pipeline, telemetry, and the routes layer.

- `DeploymentKind = 'external' | 'docker'`. The legacy kind `'klyra'` (used by the setup wizard before real Docker hosting existed) is mapped to `'docker'` everywhere for backward compatibility.
- `resolveDeploymentKind(project, payload)` decides which pipeline a deploy request takes:
  1. An explicit `kind`/`deploymentKind` in the request payload wins (`docker`/`klyra` → `docker`, `external` → `external`).
  2. Otherwise the stored `deployment.kind` is honored (legacy values normalized).
  3. Otherwise the default: a project with `sourceKind === 'existing'` **and** an upstream `baseUrl` is `external`; everything else — including GitHub and Docker imports — defaults to `docker` (Klyra-hosted container).
- Docker-specific runtime facts (`internalUrl`, `hostUrl`, `upstream`, `internalPort`, `hostPort`) are computed here and stripped from every client-facing payload (see [Security](#security-what-never-leaves-the-backend)).
- Naming helpers produce Docker-safe identifiers: `sanitizeContainerToken()` enforces the container/image charset `[a-z0-9][a-z0-9_.-]*`, and `containerNameFor()` / `imageNameFor()` derive the names (see [Naming conventions](#naming-conventions)).

---

## The real Docker container lifecycle

Implemented in `backend/src/modules/api-build/api-build.docker.ts`. This module performs the actual container lifecycle using the **Docker CLI** (`spawn('docker', args)`, 10–15 minute timeouts, stdout/stderr streamed into the deploy log). All functions throw on failure; callers record the failure instead of a healthy deployment.

| Function | Docker command | Purpose |
|---|---|---|
| `isDockerAvailable()` | `docker version --format '{{.Server.Version}}'` | Detects a usable daemon. Never throws; returns `false` when Docker is missing (the UI shows `DockerUnavailableError`'s message: *"Start Docker (or install it) and retry the deployment."*) |
| `ensureNetwork(log)` | `docker network create {name}` | Idempotently creates the shared Klyra API network (`KLYRA_DOCKER_NETWORK`, default `klyra-api-network`); "already exists" is accepted |
| `buildImage(contextDir, tag, log)` | `docker build -t {tag} {contextDir}` | Builds an image from a generated artifact (used for GitHub/built-in sources) |
| `pullImage(image, log)` | `docker pull {image}` | **The Docker import path** — pulls the user-provided image before running it |
| `runContainer(opts)` | `docker run -d --name {name} --network {network} --restart unless-stopped [{-p host:internal}] {image}` | Starts the deployment container (details below) |
| `removeContainer(name)` | `docker rm -f {name}` | Force-removes a container |
| `startContainer(name)` | `docker start {name}` | Restarts an existing stopped container |
| `inspectContainer(name)` | `docker inspect -f '{{.State.Status}} {{.State.Running}}'` | Runtime state probe (`null` when the container doesn't exist) |
| `getContainerLogs(name, tail)` | `docker logs --tail {n} {name}` | Last n lines of container output for the deployment log viewer |
| `inspectImageExposedPorts(image)` | `docker inspect --format '{{json .Config.ExposedPorts}}'` | Reads the image metadata to auto-detect the internal port when the provider does not set one |
| `waitForReadiness(baseUrl, log, opts)` | HTTP fetch / TCP socket | The flexible readiness gate — `auto`, `http` or `tcp` (see [Health gate](#health-gate)) |
| `waitForHealth(baseUrl, log)` | HTTP fetch | Backward-compatible wrapper that polls `{baseUrl}/health` (equivalent to `waitForReadiness` in `http` mode) |

### Container start: two runtime modes

`runContainer()` first removes only the container of the exact same name (same project **and** same version), leaving containers of other versions untouched so multiple versions can coexist. Then:

- **`KLYRA_DOCKER_RUNTIME=host` (backend runs on the host — typical development):** The container publishes its port on loopback only: `127.0.0.1:{hostPort}:{internalPort}`, starting at `KLYRA_API_PORT_BASE` (default `41000`). On port conflicts ("address already in use" / "port is already allocated"), it retries with the next port for up to 10 attempts. The gateway then uses the `hostUrl` (`http://127.0.0.1:{hostPort}`).
- **`KLYRA_DOCKER_RUNTIME=docker` (default — backend itself is containerized, production layout):** **No host port is published at all.** The API container is reachable only through the internal Docker network via container DNS (`http://{containerName}:{internalPort}`), which is what the gateway forwards to.

In both modes the internal port defaults to `KLYRA_API_INTERNAL_PORT` (`8080`).

### Health gate

`waitForReadiness(baseUrl, log, { mode, path, port, openApiUrl, attempts, delayMs })` is the final gate (defaults: 40 attempts, 500 ms apart, 2 s per HTTP attempt, `KlyraDockerDeploy/1.0` user agent). It never assumes `/health`:

- **`auto`** — probes candidate paths in order: the configured `readinessPath` (when set), the OpenAPI URL path (when relative), then `/`, then `/health`.
- **`http`** — probes only the configured endpoint (default `/health`).
- **`tcp`** — opens a raw `net.Socket` to `host:port`; success is a completed TCP connection.

Any status below 500 (including 3xx, and 401/403 which prove the runtime is up and enforcing auth) counts as ready. If no candidate answers within the attempt budget, the pipeline throws *"Container did not become ready"*, the container is removed, and the deployment plus project are recorded as **failed** — never healthy.

---

## Gateway routing

Implemented in `backend/src/modules/api-build/api-build.gateway.ts`; mounted at `/api/gateway` in `backend/src/app.ts`.

1. A request arrives at `{GATEWAY_URL | http://localhost:4000}/api/gateway/{slug}/...`.
2. The project is looked up by slug (or id) in `api_build_projects`.
3. Any presented Klyra key (`Authorization: Bearer kly…` or `x-api-key: kly…`) is validated against the consumer key store (`api_keys`) and the provider key store (`api_build_api_keys`) before forwarding; invalid, expired, suspended, or revoked keys are rejected. Projects with `authKind: 'apiKey'` require a key outright.
4. The upstream target is resolved by `resolveDeploymentUpstream()`:
   - **live docker deployment** → container URL (Docker DNS by default; loopback URL when `KLYRA_DOCKER_RUNTIME=host`)
   - **external deployment** → the recorded upstream
   - **fallback** → `project.baseUrl`
5. Hop-by-hop headers are stripped, the caller's path and query string are preserved, and on success the upstream request is tagged with `x-klyra-*` identity headers (the gateway consumed the raw credential). Key usage (`last_used_at`) is recorded.

The browser, the Playground, and every consumer only ever see the gateway URL — never container DNS names or internal ports.

---

## The deploy queue

Implemented in `backend/src/modules/api-build/api-build.queue.ts`; started with the server (`startApiBuildQueue()` in `backend/src/server.ts`, polls every 1.5 s).

- `POST /projects/:id/deployments` with `{ enqueue: true }` queues a deploy job and returns `202 { jobId, status }`.
- The worker claims the next queued job with `FOR UPDATE SKIP LOCKED` (safe with multiple workers), probes the deployment health (`probeProjectHealth`), records a durable deployment row (`api_build_deployments`) plus an activity entry, and marks the job completed.
- Status is derived from the live probe result: `healthy` or `failed` — never simulated.
- Long-running mutations (deploy, rollback, publish, import) are durable rows in `api_build_operations` (`api-build.operations.ts`), giving progress, actor, environment, and a crash-recovery reaper (`startOperationReaper`).

The frontend deploy step (`Wizard5.tsx`) and the workspace **Deployments** tab render the phases **Queued → Building → Deploying → Healthy** (or **Failed**), with the streamed `[docker] …` log lines shown in the deploy log panel.

---

## Configuration (environment variables)

| Variable | Default | Used by | Purpose |
|---|---|---|---|
| `KLYRA_DOCKER_BIN` | *(auto-discovered)* | `resolveDockerBin` | Explicit path to the docker CLI (e.g. `C:\Program Files\Docker\Docker\resources\bin\docker.exe`). When unset, Klyra probes Docker Desktop's install locations and then PATH |
| `DOCKER_HOST` | *(local socket)* | Docker CLI (inherited) | Point the pipeline at a daemon on another machine (`tcp://host:2375`, `ssh://user@host`) — no code change needed, the CLI honours it |
| `KLYRA_DOCKER_NETWORK` | `klyra-api-network` | `ensureNetwork`, `runContainer` | Shared bridge network the backend and API containers communicate over (container DNS names — never localhost) |
| `KLYRA_DOCKER_RUNTIME` | `docker` | `runContainer`, `resolveDeploymentUpstream` | `host` when the backend runs on the host (dev): ports published on `127.0.0.1`; `docker` when the backend is itself containerized (prod): no host port |
| `KLYRA_API_PORT_BASE` | `41000` | `runContainer` (host mode) | First loopback port to try; auto-increments on conflicts (up to 10 attempts) |
| `KLYRA_API_INTERNAL_PORT` | `8080` | `DEFAULT_INTERNAL_PORT` | Port the generated/listening API uses inside the container |
| `GATEWAY_URL` | `http://localhost:4000` | `backendOrigin()` | Public origin the gateway answers on (browser-facing); used to build every `gatewayUrl` |
| `PORT` | `4000` | `backendOrigin()` | Backend port fallback for the gateway origin |

Example for host-mode development (add to `.env.development` when needed):

```bash
KLYRA_DOCKER_RUNTIME=host        # backend on host; containers publish 127.0.0.1:41000+
KLYRA_API_PORT_BASE=41000        # first loopback port for published containers
KLYRA_API_INTERNAL_PORT=8080     # port inside the container
KLYRA_DOCKER_NETWORK=klyra-api-network
# KLYRA_DOCKER_BIN=C:\Program Files\Docker\Docker\resources\bin\docker.exe
# DOCKER_HOST=ssh://user@docker-host   # use a remote daemon instead of local Docker
```

### Docker runtime discovery & diagnosis

`resolveDockerBin()` (`api-build.docker.ts`) finds the CLI in this order:

1. **`KLYRA_DOCKER_BIN`** — explicit override (absolute path or a bare command name resolved through PATH).
2. **Well-known install locations** — on Windows, Docker Desktop's `resources\bin\docker.exe` under `%ProgramFiles%`, `%ProgramFiles(x86)%` and `%LOCALAPPDATA%`. This matters when the backend process was started from an environment whose PATH does not include Docker.
3. **`docker` on PATH** — resolved by the OS.

`getDockerDiagnostic()` then reports one of three states, and the deploy failure message is built from it (so the wizard shows an actionable sentence instead of a generic error):

| `problem` | Meaning | What the user sees |
|---|---|---|
| `ok` | CLI found **and** the daemon answered `docker version` | `Docker daemon available (<bin>)` in the pipeline log |
| `cli-missing` | The `docker` executable could not be spawned (ENOENT) | "The Docker CLI was not found on this host (checked PATH and the Docker Desktop install locations). Install Docker Desktop, or set `KLYRA_DOCKER_BIN` … you can also set `DOCKER_HOST` …" |
| `daemon-unreachable` | CLI found, but `docker version` could not reach the daemon | "Docker CLI found at `<bin>` but the daemon is not reachable (`<first stderr line>`). Start Docker Desktop — or set `DOCKER_HOST` … — and retry the deployment." |

Either way the deployment is recorded as **failed** (never healthy) and the wizard offers a one-click **Retry deployment** button.

---

## Naming conventions

Derived in `api-build.deployment.ts`; tokens are sanitized to Docker's `[a-z0-9][a-z0-9_.-]*` charset:

| Artifact | Pattern | Example |
|---|---|---|
| Container | `klyra-api-{slug}-{version}` | `klyra-api-weather-api-v1-0-0` |
| Image (built) | `klyra-api-{slug}:{version}` | `klyra-api-weather-api:v1.0.0` |
| Network | `KLYRA_DOCKER_NETWORK` | `klyra-api-network` |
| Project id | `proj-{slug}-{rand}` | `proj-weather-api-k3f9` |
| Gateway URL | `{origin}/api/gateway/{slug}` | `http://localhost:4000/api/gateway/weather-api` |

---

## Security: what never leaves the backend

`sanitizeDeploymentForClient()` and `sanitizeProjectForClient()` strip these fields from every project/deployment payload before it is returned to the frontend:

- `upstream` — what the gateway actually forwards to
- `internalUrl` — container DNS URL (e.g. `http://klyra-api-weather-api-v1-0-0:8080`)
- `hostUrl` — loopback URL in host runtime mode
- `internalPort` / `hostPort` — port mappings

Docker internals live only in this module, in the deploy pipeline, and inside the backend's database. Additionally:

- The legacy kind `'klyra'` is normalized to `'docker'` in responses.
- Gateway credentials are consumed by the gateway and replaced with `x-klyra-*` identity headers before forwarding.
- API keys are stored hash-only; plaintext is returned once at creation.

---

## End-to-end sequence

```
Provider (API Studio UI)                Backend (api-build module)             Docker host
────────────────────────                ──────────────────────────             ───────────
1. New project wizard
   └─ "Deploy a container"
      image, port, OpenAPI URL
2. POST /projects (sourceKind=docker) ──▶ project row: gatewayUrl, slug,
      gatewayUrl preview                 defaults, wizard source config
3. Detect step ────────────────────────▶ detectUpstream(base/openApiUrl)
   endpoints preview                    probe /health + spec paths
4. Import endpoints ───────────────────▶ POST /endpoints/import
                                        api_build_endpoints catalog
5. Deploy (enqueue) ───────────────────▶ 202 { jobId } ─┐
                                        queue worker: claim (SKIP LOCKED)
6.                                             │        ┌─▶ isDockerAvailable()
                                               │        ├─▶ ensureNetwork(klyra-api-network)
                                               │        ├─▶ pullImage(ghcr.io/org/service-api:latest)
                                               │        ├─▶ runContainer(klyra-api-{slug}-{version})
                                               │        │     host mode:  -p 127.0.0.1:41000:8080
                                               │        │     docker mode: no host port, container DNS
                                               │        └─▶ waitForHealth({upstream}/health) ×40
7. Workspace Deployments tab ◀────────── deployment row (healthy|failed)
   Playground hits gateway URL          + activity + operation record
8. Consumer request ───────────────────▶ /api/gateway/{slug}/*  ───▶ container upstream
   (kly… key validated)                 x-klyra-* identity headers
```

---

## Current implementation status and caveats

- **The Docker deployment pipeline is fully implemented and wired end to end.** `backend/src/modules/api-build/api-build.deploy.ts` is the single orchestration service invoked by:
  - the HTTP deploy path (`api-build.routes.ts` → operation `deploy` → `api-build.operations.ts#executeDeploy`),
  - the durable deploy queue (`api-build.queue.ts`, which routes `docker` jobs to `deployProject()` and `external` jobs to `probeProjectHealth()`).
- **Two Docker source modes converge on one pipeline:** `dockerSourceMode: 'image'` (pull an OCI reference) and `dockerSourceMode: 'folder'` (upload a project ZIP; the backend extracts it safely, detects the `Dockerfile`/`EXPOSE` port/build context, and builds the image).
- **Project Folder / ZIP upload is available** at `POST /api/api-build/upload-project` (multipart field `file`, ≤ 50 MB) and can be re-inspected via `GET /api/api-build/uploads/:uploadId`. Extraction enforces ZIP-Slip/absolute-path rejection, a 200 MB extracted-size cap and a 2,000-file cap inside `backend/.data/api-build-uploads/`.
- **Readiness is configurable** per project: `readinessMode: 'auto' | 'http' | 'tcp'` and optional `readinessPath`. `waitForReadiness()` in `api-build.docker.ts` implements all three; `waitForHealth()` remains as a backward-compatible `/health` wrapper. 401/403 answers count as proof the runtime is live; 5xx and refused connections fail the deployment.
- **Docker daemon requirement:** on a host without Docker, `isDockerAvailable()` returns false and the pipeline fails deterministically with `DockerUnavailableError` — the project and the deployment row are recorded as `failed`, never fake `healthy`. No Docker daemon is required to run the automated test suite.
- **Version coexistence:** replacing a container targets `containerNameFor(slug, version)` only, so deploying `v1.1.0` never removes the `v1.0.0` container. Failed/superseded containers are removed to avoid orphans.
- **Automated coverage:** `backend/src/__tests__/docker.deploy.test.ts` (pipeline units, readiness modes incl. failure paths, naming, image-reference hardening), `upload.security.test.ts` (ZIP-Slip/absolute-path rejection via raw crafted archives, quotas, Dockerfile/EXPOSE detection) and `gateway.docker.test.ts` (container vs external upstream resolution, failed-container gating, client sanitization) — all runnable without Docker or a database.
- **Live Docker execution:** every docker step (build, pull, run, inspect, network) is a real `spawn('docker', args[])` call with array arguments (no shell interpolation), so it requires a machine with the Docker CLI available to exercise for real.
- The `KLYRA_DOCKER_*` / `KLYRA_API_*` environment variables are not yet present in `.env.development`; defaults are code-provided.
- `getContainerLogs()` / `inspectContainer()` are ready for a container-log viewer but no route exposes them yet.

---

## Implementation reference (file map)

| Area | File |
|---|---|
| Projects dashboard ("API Studio" entry, source badges) | `frontend/src/pages/ApiBuild/ProjectsDashboard.tsx` |
| Source step — Docker fields (`dockerImage`, `dockerPort`, `openApiUrl`) | `frontend/src/pages/ApiBuild/Wizard2.tsx` |
| Deploy step — phases and log panel | `frontend/src/pages/ApiBuild/Wizard5.tsx` |
| Deployments tab | `frontend/src/pages/ApiBuild/tabs/TabDeployments.tsx` |
| Frontend types (`ApiSourceKind`, `DeployPhase`, `DeploymentInfo`) | `frontend/src/types/apibuild.ts` |
| REST routes (projects, endpoints/import, deployments, activity) | `backend/src/modules/api-build/api-build.routes.ts` |
| Detection & OpenAPI extraction | `backend/src/modules/api-build/api-build.detect.ts` |
| Deployment model, kind resolution, naming, sanitization | `backend/src/modules/api-build/api-build.deployment.ts` |
| Single orchestration pipeline for all Docker deployments | `backend/src/modules/api-build/api-build.deploy.ts` |
| Real Docker lifecycle (network/pull/build/run/inspect/readiness) | `backend/src/modules/api-build/api-build.docker.ts` |
| Secure project ZIP ingestion, Dockerfile/EXPOSE detection | `backend/src/modules/api-build/api-build.upload.ts` |
| Deploy queue worker | `backend/src/modules/api-build/api-build.queue.ts` |
| Durable operations (deploy/rollback/import) | `backend/src/modules/api-build/api-build.operations.ts` |
| Gateway (request forwarding, key validation) | `backend/src/modules/api-build/api-build.gateway.ts` |
| Gateway mount at `/api/gateway` | `backend/src/app.ts` |
| Service bootstrap (queue + telemetry + reaper) | `backend/src/server.ts` |
| Tests: pipeline, readiness modes, naming, image hardening | `backend/src/__tests__/docker.deploy.test.ts` |
| Tests: ZIP-Slip/absolute-path rejection, quotas, Dockerfile detection | `backend/src/__tests__/upload.security.test.ts` |
| Tests: container vs external upstream resolution, client sanitization | `backend/src/__tests__/gateway.docker.test.ts` |

