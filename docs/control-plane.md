# Klyra API Control Plane — Phase 1 Architecture

This document describes the control-plane primitives added to the API Build
module, what is backed by the database, and where the deliberate integration
boundaries are for the next phases (per the Phase 1 checklist: operations,
change management, audit, environment control, real async states).

## Backend primitives (all durable, in Postgres)

### Operations (`api_build_operations`)

Every long-running mutation is a durable row with
`id / type / state / progress / actor / environment / payload / logs / warnings
/ errors / result / timestamps`.

- **State machine** (enforced by `canTransition`, shared with the frontend):
  `queued → validating → running → succeeded | failed`,
  `queued|validating|running → cancelled`, `failed|cancelled → queued` (retry).
  `succeeded` is immutable.
- **API surface** (all under `/api/api-build`):
  - `POST /projects/:id/operations` — create (`deploy | rollback | publish |
    import | sync | migrate | rotate_key | bulk_policy_update | health_probe |
    delete`), returns `202` with the row.
  - `GET /projects/:id/operations` — list, filter by `state` / `type`.
  - `GET /projects/:id/operations/:opId` — poll for live progress.
  - `POST /projects/:id/operations/:opId/cancel` — only while non-terminal.
  - `POST /projects/:id/operations/:opId/retry` — only `failed`/`cancelled`.
- **Executor**: `runOperation()` in `api-build.operations.ts` performs real
  work (deploy writes a real deployment row and flips project state; rollback
  re-points the project to a recorded deployment; publish flips
  visibility/status; bulk update patches endpoints). Every transition is
  persisted before side effects, so a crash leaves a truthful row.
- **Worker boundary**: execution is currently an in-process async worker
  (`execute()`), plus `startOperationReaper()` (runs from `server.ts`) that
  fails rows stuck non-terminal beyond 10 minutes. Moving to BullMQ / a
  separate worker service only requires re-implementing `execute()` — the
  HTTP API and row schema are unchanged.
- **Upgrade path (SSE/WebSocket)**: the frontend polls
  `GET /projects/:id/operations/:opId`; replace `useOperations`' polling with
  an SSE subscription when the backend ships a `/operations/stream` endpoint.

### Resource history (`api_build_resource_history`)

Immutable versioned snapshots per `(project, resourceType, resourceId)` with
`before/after/actor/reason/version_no`.

- `PUT /projects/:id` now records history + audit entries for every changed
  top-level key (actor from `x-actor-id`, reason from `x-change-reason`).
- `GET /projects/:id/history?resourceType=&resourceId=&limit=` — list versions.
- `POST /projects/:id/history/restore` — re-applies a snapshot **through the
  normal update path** (which records its own history + audit rows). History is
  never rewritten.

### Audit log (`api_build_audit_log`, pre-existing)

`GET /projects/:id/audit` returns the immutable event stream. Operations,
publishes, deploys, rollbacks, draft promotions and project updates all append
to it. Surfaced by the new **Audit** tab (filters + diff view + restore).

## Frontend surfaces

- **Operations monitor** (`OperationsMonitor.tsx`) — persistent bottom bar with
  real backend progress while any operation is running; opens the
  **OperationDrawer** (logs / errors / payload / result, cancel + retry).
- **`useOperations` hook** — polls only while something is non-terminal;
  `start/cancel/retry` wrap the service. Authoritative state stays server-side.
- **Change Center** — `ChangeReviewModal` now supports per-change
  accept/reject with a blast-radius summary; `promoteSelected()` applies only
  the accepted changes through the draft → validate → promote path
  (optimistic-concurrency preserved). Unticked changes remain as a draft.
- **Audit tab** — audit events (search + type/operation filters + before/after
  diff) and resource history (version list + restore).
- **Environment selector** — segmented Development/Staging/Production control
  in the command bar, persisted per project (`localStorage`).
- **Build wizard / publish** — the deploy and publish steps now create real
  backend operations and mirror backend progress into the wizard phases; the
  previous client-side fake timers are gone.

## Deliberate boundaries (not fake-implemented)

1. **Environment-scoped configuration.** The selector is UI context only; the
   project row stores a single environment. Phase 2 adds
   `API_ENVIRONMENT` config overlays (config hierarchy, env diff, promote).
   The UI is shaped so the selector can drive an env-scoped fetch without
   redesign.
2. **Canary / deployment strategies.** The deploy operation accepts a
   `strategy` in its payload and records it, but only `rolling` executes
   today. Canary/blue-green land with the release system (Phase 3).
3. **SSE/WebSocket progress.** Polling now; SSE is a drop-in upgrade path
   (see Operations above).
4. **Permission-aware gating.** Operations record an actor; role checks are
   enforced at the API layer. Rich permission metadata in responses
   (`requiredPermission`, `yourRole`) arrives with the teams/roles phase.

## Tests

`backend/src/__tests__/operations.test.ts` covers the operation state machine
(terminal/cancellable/retryable, lifecycle, illegal transitions) with the
built-in `node:test` runner — run with `npm test` in `backend/`.
