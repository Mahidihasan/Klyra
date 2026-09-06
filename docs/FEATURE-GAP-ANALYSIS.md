# Klyra — Feature Gap Analysis

> **Generated:** 2026-09-04 · **Baseline commit:** `d91a15c` (branch `main`)
> **Method:** Every claim below was verified against the actual source code (frontend `frontend/src/**`, backend `backend/src/**`, infrastructure and docs). Nothing is assumed missing without checking; known-limitation comments in the code itself are cited where relevant.

---

## Part 0 — What Already Exists and Works (evidence summary)

Provided as context so the gap lists are not misread. The backend is far more complete than the README suggests; the marketplace-facing surface is where the real gaps are.

### Backend — working today

| Feature | Evidence |
|---|---|
| Health endpoint `GET /api/health` | `backend/src/app.ts:30-33` |
| **Playground REST API** — full data snapshot, workspaces (create/rename/delete/pin), local APIs, collections CRUD, history, environments CRUD, unified workspace-items tree (create/update/delete/move/reorder/pin/duplicate/migrate) | `backend/src/modules/playground/playground.routes.ts` (~509 lines) |
| **Request execution proxy** — 30s timeout, `{{variable}}` substitution, bearer/basic/api-key auth, JSON / form-data / urlencoded / raw bodies, status/timing/size classification | `backend/src/modules/playground/playground.service.ts` |
| **AI Copilot backend** — Gemini chat with function-calling actions (`set_url`, `set_headers`, `set_body`, `set_auth`, `run_request`, `generate_code`, …) and automatic request inspection returning structured findings | `backend/src/modules/playground/playground.ai.ts`; routes `POST /api/playground/ai/chat`, `/ai/inspect` |
| Playground persistence (file-based, dev) to `backend/.data/playground.json` | `backend/src/modules/playground/playground.storage.ts` (real request history present in that file confirms it works) |
| **Repository platform** (untracked in git, but complete): auth (register/login/me, scrypt hashing, opaque `kly_` tokens), repos CRUD, real Git mirror import | `backend/src/modules/repos/auth.service.ts`, `repos.routes.core.ts` |
| Git Smart HTTP server (`/api/git/:repoId.git`) with token auth and a generated **pre-receive hook enforcing protected branches** | `backend/src/modules/repos/git.http.ts:14-66`, `git.service.ts:25-54` |
| Branches (create/delete/protection), paginated path-filtered commits, tree, file content, diffs, tags | `backend/src/modules/repos/repos.routes.git.ts` |
| Pull requests with **real git merge**, reviews, comments, close | `backend/src/modules/repos/repos.routes.collab.ts` |
| Issues + comments + status, collaborators (roles), activity log | `backend/src/modules/repos/repos.routes.issues.ts` |
| API detection (framework, endpoints, OpenAPI, `.env` vars, secrets) stored as `detect_json` | `backend/src/modules/repos/detect.service.ts`, `repos.routes.ops.ts:14-52` |
| **CI that really executes** — clones working copy, detects package manager, runs real `install` + `build`/`test`, records real exit codes/logs, async with polling | `backend/src/modules/repos/ci.service.ts:29-60` |
| Releases (draft from semver tag, owner-only publish, version compare with ahead/behind + patch), deployments (status from real Git tag resolution), marketplace listings (draft/create/status) | `backend/src/modules/repos/repos.routes.releases.ts` |
| Role-based authorization (owner/maintainer/developer) applied per-route | `repos.routes.core.ts:20-33`, `repos.service.ts` |
| Idempotent runtime schema bootstrap (`kr_*` tables) | `backend/src/modules/repos/repos.db.ts` |

### Frontend — working today

| Feature | Evidence |
|---|---|
| App shell with tab navigation persisted to `localStorage` (playground default), modals, command palette, mobile sidebar | `frontend/src/App.tsx` |
| **Playground page — fully wired to the backend**: request builder (params/headers/cookies/auth/body), multi-tab, environments + secrets, collections, history, workspace tree, AI action execution, code generation in 10+ languages, schema validation, error diagnosis | `frontend/src/pages/Playground/index.tsx`, `components/playground/*`, `services/api/playground.ts` |
| Client-side request execution with backend-proxy-first + browser-fetch fallback | `frontend/src/utils/playground.ts:118-122, 296-300` |
| AI integration (chat + auto-inspection) via backend proxy — API key never leaves the server | `frontend/src/services/gemini.ts:92-143` |
| **Repositories hub + repo detail — fully wired to the backend**: login/register modal, create/import repo, filters/sort/pin/search, Code page (file tree, viewer, README, detection panel), Branches, Commits, PRs (create/review/merge), Issues, Collaborators, API/Docs/Tests/Deployments/Releases/Marketplace/Settings tabs, clone URL + git instructions | `frontend/src/pages/Repositories/index.tsx`, `RepoDetail.tsx`, `CodePage.tsx`, `GitTabs.tsx`, `CollabTabs.tsx`, `OpsTabs.tsx`, `services/api/repos.ts` |
| Dev-server proxy to backend (`/api` → `http://localhost:4000`) | `frontend/vite.config.ts:11-16` |

---

# Section 1 — Frontend — Incomplete/Missing Features

### F-1. Marketplace home dashboard runs entirely on mock data
* **Status:** UI exists, not connected to any backend.
* **Missing:** All four API rails (Trending, Popular, Newly Launched, Recommended) plus category filtering and search operate only on hardcoded constants. There is no backend catalog API to connect to (see B-1).
* **Files:** `frontend/src/data/mockData.ts` (`MOCK_TRENDING_APIS`, `MOCK_POPULAR_APIS`, `MOCK_NEWLY_LAUNCHED_APIS`, `MOCK_RECOMMENDED_APIS`, `CATEGORIES_LIST`), `frontend/src/App.tsx:59-82`, `frontend/src/components/CategoryFilter.tsx:13`.
* **To complete:** Implement backend catalog endpoints (B-1), then replace the `MOCK_*` imports with a fetch-on-mount service; keep client-side filter/search as a fast path over server results.

### F-2. Marketplace collections are in-memory only
* **Status:** Partially implemented (UI complete, persistence absent).
* **Missing:** `collections` state is initialized from `MOCK_COLLECTIONS` and never persisted; a refresh loses user-created collections. (Note: the *Playground* collections ARE persisted via `POST /api/playground/collections` — this gap is only for the marketplace-home collections.)
* **Files:** `frontend/src/App.tsx:51`, `frontend/src/components/CreateCollectionModal.tsx`, `frontend/src/components/CollectionsWidget.tsx`.
* **To complete:** Either reuse the playground collections API or add a dedicated marketplace-collections endpoint; wire `setCollections` through an API service with optimistic updates.

### F-3. ApiTesterModal sends fake requests
* **Status:** Fully built UI; execution is simulated.
* **Missing:** `handleSend` is a `setTimeout` that fabricates 60–140 ms latency and always returns status 200 with a canned body (`ApiTesterModal.tsx:43-80`). The working backend proxy `POST /api/playground/execute` already exists and is not used.
* **Files:** `frontend/src/components/ApiTesterModal.tsx`; available backend: `backend/src/modules/playground/playground.service.ts`.
* **To complete:** Call the same `executeRequest()` helper used by the Playground (`frontend/src/utils/playground.ts:118`) with the modal's method/url/headers/body, and render the real response.

### F-4. Notifications system is decorative
* **Status:** Mock only.
* **Missing:** Bell dropdown uses `MOCK_NOTIFICATIONS`; "mark all as read" only mutates local state; no backend notification store, no unread persistence, no real-time updates.
* **Files:** `frontend/src/components/Topbar.tsx:3,21,41-43`, `frontend/src/data/mockData.ts:781`.
* **To complete:** Backend notifications module (B-6) + frontend fetch/mark-read/read-all calls; optional polling/SSE for live updates.

### F-5. Topbar user menu (Profile, API Keys, Logout) is not wired
* **Status:** Menu renders; actions are inert.
* **Missing:** No profile page/route, no API-keys screen, and Logout does not clear the `klyra_token`/`klyra_user` localStorage entries the Repositories feature depends on. There is no session bridge between the topbar user and Repositories auth.
* **Files:** `frontend/src/components/Topbar.tsx` (imports `User, Key, LogOut`); contrast with real token handling in `frontend/src/pages/Repositories/index.tsx:95-99` and `services/api/repos.ts:12-15`.
* **To complete:** A shared session context; Logout clears token/user and reloads; Profile/API Keys screens backed by the future users module (B-3).

### F-6. Dark-mode toggle has no implementation
* **Status:** Icon present, no behavior.
* **Missing:** The `Moon` icon renders in the Topbar, but a codebase-wide search found no `setTheme`, `data-theme`, or theme-class switching logic — the app is permanently dark.
* **Files:** `frontend/src/components/Topbar.tsx:2`, `frontend/src/styles/globals.css` (single dark theme).
* **To complete:** Implement a light theme via CSS custom properties + `data-theme`, or remove the dead control.

### F-7. Repositories frontend never talks to the real backend in development
* **Status:** Works in production builds; deliberately mocked in dev — blocks end-to-end verification.
* **Missing:** `frontend/src/services/api/repos.ts:17-19` short-circuits **every** repos/auth call to fixtures when `import.meta.env.DEV` is true (`developmentRequest` in `repos.dev.ts`). Also, `RepositoriesPage` seeds the user as `developmentUser` in dev (`index.tsx:34-37`), so the login/register modal is bypassed and the backend's `/auth/*` endpoints are unreachable from the dev UI.
* **Files:** `frontend/src/services/api/repos.ts`, `frontend/src/services/api/repos.dev.ts`, `frontend/src/pages/Repositories/index.tsx:11-17,34-37`.
* **To complete:** Gate the fixture layer behind an explicit opt-in (e.g. `VITE_USE_MOCK_REPOS=true`) instead of `import.meta.env.DEV`, so `pnpm dev` against the real backend exercises auth, repos, PRs, CI, and detection.

### F-8. No client-side router; deep-linking is hash-string based
* **Status:** Works minimally; diverges from documented intent.
* **Missing:** README promises React Router v6; actual navigation is `activeTab` state + ad-hoc `window.location.hash` regex for `#/repo/<id>` with a hand-rolled `popstate` listener. No URLs for marketplace tabs, no 404, no route-level code splitting.
* **Files:** `frontend/src/App.tsx:30-37,54-56`, `frontend/src/pages/Repositories/index.tsx:42-55`; `react-router-dom` is not in `frontend/package.json`.
* **To complete:** Introduce `react-router-dom` with routes `/`, `/playground`, `/build`, `/repositories`, `/repo/:id/:tab?`, plus a NotFound page; keep the saved-tab as a redirect.

### F-9. "Analytics" tab shows hardcoded rows
* **Status:** Static UI.
* **Missing:** Request-history and env-variable rows are literal hardcoded objects (OpenAI/Stripe/WeatherAPI samples) — while the Playground already has a real, persisted history API (`GET /api/playground/data` → `history`) that is not consumed here.
* **Files:** `frontend/src/components/TabViews.tsx:120-166`.
* **To complete:** Feed this tab from `playgroundApi.fetchPlaygroundData()` history + environments; defer real usage/revenue analytics to B-5.

### F-10. API Builder is a self-contained client-side app
* **Status:** Substantial UI (versions, docs preview, test view, publish modal, import) — zero backend integration.
* **Missing:** Projects persist only to `localStorage` (`klyra-api-projects`); the **Publish API** flow (`PublishModal` → `handlePublish`) only writes `state.publish` locally and never creates a repo, release, or marketplace listing; pricing/visibility/license inputs are dead-end state. No linkage exists between a built API and the Repositories/Marketplace systems that DO exist.
* **Files:** `frontend/src/pages/ApiBuilder/index.tsx:1624-1630, 1740, 2094-2096, 2463`, `frontend/src/components/ApiBuildEntry.tsx:51-56`.
* **To complete:** Define the pipeline (builder project → repo → tag/release → marketplace listing — all backend primitives already exist), add backend-backed project persistence, and a publish action chaining `reposApi.create` → git push/import → `releasesApi` → `marketplaceApi.create`.

### F-11. Playground "My APIs / Connected APIs / API Examples" sources are empty by design
* **Status:** Types and UI hooks exist; data source never implemented.
* **Missing:** The DB-backed playground store returns `[]` with comments `// Not implemented in DB yet` for `workspaceApis`, `localApis`, and `apiExamples` (`playground.db-storage.ts:22-27`); there is no "subscribed APIs" concept anywhere in the system. Local APIs work only via the file-based store.
* **Files:** `backend/src/modules/playground/playground.db-storage.ts`, `frontend/src/types/playground.ts` (`ApiSource = 'my-apis' \| 'subscribed' \| 'recent'`), `frontend/src/components/playground/WorkspaceSidebar.tsx`.
* **To complete:** Decide the source of truth (subscriptions require B-1/B-2); implement DB tables for local APIs + examples; surface subscribed APIs from the future subscription module.

### F-12. "Pro" AI gating is cosmetic
* **Status:** Banner exists; no gating or billing behind it.
* **Missing:** `PgAiProBanner` offers an upgrade with no plan model, no payment flow, and no server-side check restricting `/api/playground/ai/*` to paid users (AI routes are open to all).
* **Files:** `frontend/src/components/playground/PgAiProBanner.tsx`; open backend routes `playground.routes.ts:462-493`.
* **To complete:** Requires the subscription/billing backend (B-2) plus a server-side plan-check middleware on AI routes; frontend then gates the banner/buttons off the session plan.

### F-13. Command palette indexes only mock content
* **Status:** Working UI, limited data.
* **Missing:** Search covers only the `apis`/`collections` props — the `MOCK_*` arrays. Playground items and repositories (the real, backend-backed content) are not searchable.
* **Files:** `frontend/src/components/CommandPalette.tsx:14-16`, `frontend/src/App.tsx` (props passed).
* **To complete:** Register playground workspace items and the repo list as palette sources.

### F-14. No frontend tests, error boundary, or normalized error strategy
* **Status:** Absent.
* **Missing:** README advertises Jest + React Testing Library; there are no test files, no `ErrorBoundary`, and each page implements its own `try/catch + error string` pattern. A fetch rejection outside a tab's guard unmounts nothing gracefully.
* **Files:** `frontend/package.json` (no test tooling), `frontend/src/App.tsx`.
* **To complete:** Add Vitest + RTL (matches Vite), one root `ErrorBoundary`, and a shared async-data helper to normalize the loading/error states currently repeated across the Repositories tabs.

---

# Section 2 — Backend — Incomplete/Missing Features

> Everything in `backend/src/modules/repos/**` is currently **untracked in git** (`git status` shows `?? backend/src/modules/repos/`) — commit it; losing that directory would remove the majority of the working backend.

### B-1. Marketplace catalog & category APIs — missing entirely
* **Status:** Documented, not implemented.
* **Missing:** The documented v1 API surface (`docs/api/v1/apis.md`, `docs/api/v1/categories.md`, `docs/architecture/api-design.md`) specifies `/v1/apis` (list/search/detail/versions/endpoints) and `/v1/categories`; no module, route, or table exists for a public API catalog. `infrastructure/database/schema.sql` defines the intended `apis`/`categories` tables but is never applied. The only "marketplace" that exists is per-repo listings inside the repos module (owner-scoped, no public browsing).
* **Files:** `docs/api/v1/apis.md`, `docs/api/v1/categories.md`, `infrastructure/database/schema.sql`, current partial: `repos.routes.releases.ts` (marketplace listings CRUD only).
* **To complete:** New `modules/catalog` with public read endpoints (published listings, search, categories), backed by the schema.sql tables or a migration; frontend F-1/F-13 then connect.

### B-2. Subscriptions & payments (Stripe) — missing entirely
* **Status:** Documented with full API spec; zero code.
* **Missing:** `/v1/subscriptions` (plans, mine, create/update/cancel) and `/v1/payments` (checkout, webhook) per `docs/api/v1/subscriptions.md` and `docs/api/v1/payments.md`. `.env.example` reserves `STRIPE_*` keys but no Stripe SDK is installed; no subscription/payment tables exist at runtime; marketplace listings store `pricing_type`/`price_cents` that nothing consumes.
* **Files:** `docs/api/v1/subscriptions.md`, `docs/api/v1/payments.md`, `.env.example:33-36`, `backend/package.json` (no `stripe` dep).
* **To complete:** Add `stripe`, subscription plans + subscription tables, webhook handler, and plan-gating middleware (also unblocks F-12).

### B-3. Users module — profile, API keys, avatar upload — missing
* **Status:** Partial: auth primitives exist (scrypt + tokens), everything user-facing is absent.
* **Missing:** Documented `/v1/users` endpoints (profile get/update, password change, avatar upload, per-user API keys per `docs/api/v1/users.md`). Notably, the **Cloudinary storage service and multer upload utils are fully written but have no route using them** — `storage.service.ts`, `config/cloudinary.ts`, `utils/fileUpload.ts` are dead code today. There is also no token revocation/logout endpoint; `kr_tokens` rows live forever.
* **Files:** `backend/src/services/storage.service.ts`, `backend/src/config/cloudinary.ts`, `backend/src/utils/fileUpload.ts` (unused), `backend/src/modules/repos/auth.service.ts:66-79` (no expiry/revocation), `docs/api/v1/users.md`.
* **To complete:** `modules/users` with profile CRUD wired to the existing upload service, an API-keys table + CRUD, and `DELETE /auth/logout` (or token expiry column).

### B-4. Reviews & ratings — missing
* **Status:** Documented (`docs/api/v1/apis.md` reviews section); zero implementation.
* **Missing:** No reviews/ratings tables, endpoints, or aggregation (average rating shown on mock cards only). Marketplace listings have no rating fields.
* **Files:** `docs/api/v1/apis.md`, `infrastructure/database/schema.sql` (intended tables), nothing in `backend/src`.
* **To complete:** `kr_*` or catalog-schema reviews table, endpoints under the catalog module, aggregate into listing payloads (feeds F-1).

### B-5. Analytics, usage metering & monitoring — missing
* **Status:** Documented (`docs/api/v1/apis.md` analytics, README "Analytics & Monitoring"); not implemented. The only monitoring infra is unconfigured Prometheus/Grafana env flags.
* **Missing:** No request-usage tracking for marketplace APIs, no revenue analytics, no dashboards, no `/metrics` endpoint. The repos module logs activity events (`kr_activity`) but nothing aggregates them into analytics.
* **Files:** `.env.example:62-64`, `docs/api/v1/apis.md`, `docker-compose.prod.yml` (monitoring stack assumed).
* **To complete:** Usage events table populated by the API gateway/proxy layer, aggregation endpoints, and optionally `prom-client` `/metrics`.

### B-6. Notifications backend — missing
* **Status:** Nothing server-side (frontend gap F-4 depends on this).
* **Missing:** No notifications table, endpoints, or event producers (release published, PR merged, CI failure are all natural triggers already flowing through `logActivity`).
* **Files:** `backend/src` (no notifications module), `docs/README` feature list.
* **To complete:** `kr_notifications` table + list/unread-count/mark-read endpoints; emit from existing activity-logged events.

### B-7. AI endpoints beyond the Playground — missing
* **Status:** Documented `/v1/ai` module (docs generation, security auditing, API idea generation via OpenAI per README/`.env.example:24-25`); only the Playground's Gemini chat/inspect exists.
* **Missing:** No OpenAI integration anywhere, no doc-generation or security-audit endpoints. `.env.example` still lists `OPENAI_API_KEY` while the code uses `@google/genai` exclusively.
* **Files:** `docs/api/v1/ai.md`, `.env.example:24-25`, existing partial: `backend/src/modules/playground/playground.ai.ts`.
* **To complete:** Either implement `/v1/ai` with Gemini (drop the OpenAI env var) or add OpenAI; reuse the playground.ai patterns (function calling, structured output).

### B-8. Auth & API hardening gaps
* **Status:** Functional but minimal; several documented protections absent.
* **Missing:**
  * No JWT/refresh-token scheme despite `.env.example:18-22` (`JWT_SECRET`, refresh secrets) and README claims — actual auth is never-expiring opaque tokens in `kr_tokens` with no logout.
  * No rate limiting (`RATE_LIMIT_*` env vars unused), no `helmet`, no request logging/validation middleware, no graceful DB error surfacing.
  * CORS is a wildcard `*` (`app.ts:10-18`) ignoring `CORS_ORIGIN`; Git-Protocol header is allowed but credentials are also sent cross-origin by the raw fetch client.
  * In non-production, `authOptional` auto-authenticates a shared `development` user (`auth.service.ts:113-120`) — intentional for dev, but it means any unauthenticated request can read/write repos whenever `NODE_ENV !== 'production'`; worth a stricter dev opt-in flag.
* **Files:** `backend/src/app.ts`, `backend/src/modules/repos/auth.service.ts`, `.env.example:18-22,51-56`.
* **To complete:** Token expiry + revocation, rate limiter, helmet, CORS from env, and an explicit `KLYRA_DEV_AUTOAUTH=true` guard.

### B-9. Playground PostgreSQL persistence is a half-built path
* **Status:** File-based store is the active implementation; DB store exists but is explicitly stubbed.
* **Missing:** `playground.routes.ts:2-5` (comment) deliberately uses the file-based `playgroundStore` and says "Switch back to playgroundDbStore when PostgreSQL-based persistence is ready". In `playground.db-storage.ts`: workspaces have "no table yet" (hardcoded default workspace), and `workspaceApis`, `localApis`, `apiExamples` return `[]` with `// Not implemented in DB yet`. All playground data is single-tenant (`DEFAULT_USER_ID` constant) — no per-user scoping, and no link between playground data and `kr_users`. It also reads a `collections` table from the infra schema that the runtime code never creates.
* **Files:** `backend/src/modules/playground/playground.routes.ts:2-5`, `playground.db-storage.ts:5-65`, `playground.storage.ts` (active).
* **To complete:** Create `kr_playground_*` tables (or reuse infra schema), implement the remaining store methods, add per-user scoping keyed off `req.klyraUser`, then switch routes to the DB store behind a feature flag.

### B-10. Declared tech stack (Prisma, Redis, Bull) is unused — README/docs mismatch
* **Status:** Dependencies installed; zero usage.
* **Missing:** `@prisma/client`/`prisma` are in `backend/package.json` but there is no `backend/prisma/schema.prisma` (docs claim it exists at `backend/prisma/schema.prisma`); `pg` is used directly. Redis and Bull are claimed by README/docker-compose docs but no client/queue code or dependency exists. No `/api/v1/docs` endpoint exists despite README's "API Documentation: http://localhost:4000/api/v1/docs".
* **Files:** `backend/package.json:16,28`, `README.md:20-28,105,127`, `docs/architecture/database-schema.md:245-248`, `docs/developer/setup-guide.md:81`.
* **To complete:** Either remove Prisma/Redis/Bull claims and dependencies (align README to the actual `pg`-based stack) or actually adopt them; add Swagger/OpenAPI served at `/api/v1/docs` to match the docs.

### B-11. No tests and no migration tooling on the backend
* **Status:** `jest` script exists (`backend/package.json:12`) but there are zero test files anywhere; schema is created by runtime `CREATE TABLE IF NOT EXISTS` DDL.
* **Missing:** Unit/integration tests for the substantial pure logic (git.service, detect.service, playground.service variable substitution, ci.service script planning); no migration framework — the runtime `ensureReposSchema()` bootstrap diverges from `infrastructure/database/schema.sql` (which defines a different, richer marketplace schema that is never applied), so the intended production schema and the actual one have drifted.
* **Files:** `backend/src/modules/repos/repos.db.ts`, `infrastructure/database/schema.sql`, `backend/package.json`.
* **To complete:** Add `node-pg-migrate` (or Prisma Migrate if adopted) with the real `kr_*` schema, reconcile with `schema.sql`, and add Jest/Vitest coverage starting with the services listed above.

### B-12. Marketplace listings & deployments are record-keeping only
* **Status:** Implemented endpoints, shallow semantics.
* **Missing:** Marketplace listings have no public discovery/browse surface (owner sees own listings only; nothing enforces pricing, no purchase flow — depends on B-2/B-1). Deployments create a `kr_deployments` row whose status is derived from whether the release tag resolves in Git — no artifact is built or shipped to any environment; `deploy_status` on the repo is bookkeeping. CI writes are real, but there is no artifact storage or deploy pipeline behind "Deploy".
* **Files:** `backend/src/modules/repos/repos.routes.releases.ts:79-100+`, `repos.db.ts` (`kr_deployments`, `kr_marketplace_listings`).
* **To complete:** Define what "deployment" means for Klyra (e.g. spin a preview container, register a gateway route for the released API), or rename/re-scope the UI to "release records" until a real target exists.

### B-13. Database service is minimal
* **Status:** Works, but fragile defaults.
* **Missing:** `database.service.ts` is a bare `pg` Pool with hardcoded fallback credentials, no connection-error handling, no SSL option, no pool tuning, and `database.service.ts` is separate from the `DATABASE_URL` that `.env.example`/docker-compose define (env var names differ: `DB_USER/DB_HOST/...` vs `DATABASE_URL`/`POSTGRES_*`).
* **Files:** `backend/src/services/database.service.ts`, `.env.example:8-12`.
* **To complete:** Parse `DATABASE_URL` when present (fall back to discrete vars), add `pool.on('error')` handling, SSL for production, and match docker-compose env names.

---

## Cross-cutting priority notes

1. **Commit the untracked backend** — `backend/src/modules/repos/**` (14 files) is the core of the product right now and is not in git.
2. **Highest-value chain:** B-1 (catalog) → F-1 (home page) → B-2 (subscriptions) → F-12 (Pro gating) — this is the path from "developer platform" to "marketplace".
3. **Quickest wins:** F-3 (wire ApiTesterModal to the existing execute proxy), F-7 (dev-mode env flag for repos API), F-9 (feed Analytics tab from real playground history), B-13 (DATABASE_URL support).
4. **Documentation debt:** README's tech stack (Prisma, Redis, Redux, Tailwind, React Router, Stripe, OpenAI) describes a project that largely doesn't exist yet; the actual stack is Express + pg + file storage, React + Vite + plain fetch + CSS. Either implement or rewrite the README to match Sections above.







