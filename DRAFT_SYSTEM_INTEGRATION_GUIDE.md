# Draft & Unsaved State System — Integration Guide

## Overview

The Draft System provides:
- **Separate server and draft state** — Working copy doesn't affect live config until saved
- **Persistent drafts** — Survives navigation, refresh, network errors
- **Change tracking** — Compute diffs automatically
- **Validation** — Pre-save checks
- **Audit trail** — Immutable history of all mutations
- **Optimistic concurrency** — Detect conflicts when two users edit simultaneously

---

## Architecture

### State Model

```typescript
// Server state (live, immutable until promotion)
server: ProviderProject

// Working draft (may have unsaved changes)
draft: ProviderProject

// Unsaved indicator
hasUnsavedChanges: boolean // computed from deepEqual(server, draft)
```

### Data Flow

```
┌─────────────────────────────────┐
│    Backend /projects/:id        │
│    (Server State - Live)        │
└─────────────────┬───────────────┘
                  │
                  │ GET
                  ↓
┌─────────────────────────────────┐
│     useDraftState Hook          │
│     (Manages both states)       │
└──────┬─────────────────────┬────┘
       │                     │
       ↓                     ↓
    server               draft
    (Read)            (Editable)
                          │
                          │ updateDraft(patch)
                          ↓
                      localStorage
                   (Persists draft)
                          │
                          │ saveDraft() / discardDraft()
                          ↓
                   /draft/save endpoint
              (Promotes draft to server)
```

### Key APIs

#### Backend Routes

```
GET  /projects/:id/draft              → { server, draft }
PATCH /projects/:id/draft             → { draft, hasChanges }
POST /projects/:id/draft/changes      → [ Change ]
POST /projects/:id/draft/validate     → { ok, error?, warnings? }
POST /projects/:id/draft/save         → { project, version }
DELETE /projects/:id/draft            → { discarded }
GET  /projects/:id/audit              → [ AuditEvent ]
```

#### Frontend Hook

```typescript
const {
  server,                    // ProviderProject | null
  draft,                     // ProviderProject | null
  hasUnsavedChanges,         // boolean
  isLoading, isSaving, error,
  changes,                   // Change[]
  updateDraft,               // async (patch: Partial<ProviderProject>) => void
  saveDraft,                 // async () => Promise<ProviderProject>
  discardDraft,              // async () => void
  validateDraft,             // async () => Promise<{ok, error?, warnings?}>
  refresh,                   // async () => void
} = useDraftState(projectId);
```

---

## Usage Examples

### Example 1: Simple Edit with Auto-Save

```typescript
function ProjectConfigTab({ projectId }: { projectId: string }) {
  const draft = useDraftState(projectId);

  if (draft.isLoading) return <Spinner />;
  if (!draft.draft) return <Error />;

  return (
    <>
      {/* Show unsaved indicator */}
      <UnsavedChangesBanner
        hasUnsavedChanges={draft.hasUnsavedChanges}
        changeCount={draft.changes.length}
        isSaving={draft.isSaving}
        error={draft.error}
        onSave={draft.saveDraft}
        onReview={() => {/* show modal */}}
        onDiscard={draft.discardDraft}
      />

      {/* Edit form */}
      <Form
        initialData={draft.draft}
        onChange={(patch) => draft.updateDraft(patch)}
      />

      {/* Auto-saves every 30 seconds if unsaved */}
    </>
  );
}
```

### Example 2: Validate Before Saving

```typescript
async function handleSave() {
  // Validate draft
  const validation = await draft.validateDraft();

  if (!validation.ok) {
    showError(`Validation failed: ${validation.error}`);
    return;
  }

  if (validation.warnings?.length) {
    const proceed = await confirm(
      `Warnings: ${validation.warnings.join(', ')}\nProceed anyway?`
    );
    if (!proceed) return;
  }

  // Save draft to live
  try {
    const saved = await draft.saveDraft();
    showSuccess('Changes saved');
  } catch (err) {
    showError(err.message);
  }
}
```

### Example 3: Review Changes Before Saving

```typescript
function ChangeReviewModal({ draft }: { draft: ReturnType<typeof useDraftState> }) {
  return (
    <Modal title="Review Changes">
      <div className="changes-list">
        {draft.changes.map((change) => (
          <ChangeItem
            key={change.id}
            change={change}
            before={change.before}
            after={change.after}
            impact={change.impact}
          />
        ))}
      </div>

      <button onClick={draft.discardDraft}>Discard All</button>
      <button onClick={draft.saveDraft}>Save Changes</button>
    </Modal>
  );
}
```

### Example 4: Conflict Handling (Optimistic Concurrency)

```typescript
async function handleSave() {
  try {
    await draft.saveDraft();
  } catch (err) {
    if (err.message.includes('CONFLICT')) {
      // Version mismatch: another user saved
      const proceed = await confirm(
        'Another user made changes. Reload and try again?'
      );
      if (proceed) {
        draft.refresh(); // Reload server state
      }
      return;
    }
    throw err;
  }
}
```

### Example 5: Audit Trail

```typescript
async function HistoryTab({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const auditEvents = await apiBuildService.getAuditLog(projectId, {
        limit: 50,
      });
      setEvents(auditEvents);
      setLoading(false);
    };
    load();
  }, [projectId]);

  return (
    <div className="history">
      {loading ? (
        <Spinner />
      ) : (
        events.map((event) => (
          <AuditEventRow
            key={event.id}
            event={event}
            onViewDiff={() => {/* show diff modal */}}
          />
        ))
      )}
    </div>
  );
}
```

---

## Integration Checklist

### Step 1: Database
- [ ] Run migration: `2026_09_12_002_draft_system.sql`
- [ ] Verify tables created: `api_build_audit_log`, `api_build_draft_changes`

### Step 2: Backend
- [ ] Import draft service in routes: `api-build.draft.ts`
- [ ] Verify all draft routes registered
- [ ] Test routes with curl/Postman

### Step 3: Frontend
- [ ] Import `useDraftState` hook in your component
- [ ] Replace direct `updateProject()` calls with `updateDraft()`
- [ ] Add `UnsavedChangesBanner` to component
- [ ] Test localStorage persistence (refresh page with unsaved changes)
- [ ] Test auto-save (wait 30 seconds)
- [ ] Test browser leave warning

### Step 4: User Testing
- [ ] Create new project
- [ ] Edit configuration
- [ ] Verify unsaved indicator appears
- [ ] Navigate away and return (draft persists)
- [ ] Save changes (promotes to live)
- [ ] Discard changes (reverts to server)
- [ ] Check audit log for events

---

## API Contract

### GET /projects/:id/draft

Response:
```json
{
  "success": true,
  "data": {
    "server": { /* ProviderProject */ },
    "draft": { /* ProviderProject or null */ }
  }
}
```

### PATCH /projects/:id/draft

Request:
```json
{
  "name": "Updated Name",
  "rateLimitPerMin": 500
}
```

Response:
```json
{
  "success": true,
  "data": {
    "draft": { /* full updated draft */ },
    "hasChanges": true
  }
}
```

### POST /projects/:id/draft/save

Request:
```json
{
  "version": 1  /* client's current version for optimistic concurrency */
}
```

Response (Success):
```json
{
  "success": true,
  "data": {
    "project": { /* updated server project */ },
    "version": 2
  }
}
```

Response (Conflict):
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Version conflict: client has 1, server has 2"
  }
}
```

### GET /projects/:id/audit

Query params:
- `limit=50` (default)
- `offset=0` (default)

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "projectId": "proj-...",
      "actorId": "user-123",
      "timestamp": "2026-09-12T14:22:00Z",
      "operation": "update",
      "resourceType": "project",
      "before": { /* old config */ },
      "after": { /* new config */ },
      "changeSummary": "Draft promoted to live"
    }
  ]
}
```

---

## Common Patterns

### Pattern: Controlled Form with Draft

```typescript
function ProjectForm({ projectId }: { projectId: string }) {
  const draft = useDraftState(projectId);
  const [formData, setFormData] = useState(draft.draft || {});

  // Update draft on form change (with debounce for performance)
  useEffect(() => {
    const timer = setTimeout(() => {
      draft.updateDraft(formData);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData]);

  return (
    <form>
      <input
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      {/* ... more fields ... */}
    </form>
  );
}
```

### Pattern: Toolbar with Actions

```typescript
function ProjectToolbar({ draft }: { draft: DraftState }) {
  return (
    <toolbar>
      <button
        disabled={!draft.hasUnsavedChanges}
        onClick={draft.saveDraft}
      >
        Save
      </button>

      <button
        disabled={!draft.hasUnsavedChanges}
        onClick={() => setShowChanges(true)}
      >
        Review ({draft.changes.length})
      </button>

      <button
        disabled={!draft.hasUnsavedChanges}
        onClick={draft.discardDraft}
      >
        Revert
      </button>
    </toolbar>
  );
}
```

---

## Troubleshooting

### Draft not persisting across page refresh

**Check**:
- localStorage is not full (`localStorage.setItem()` might fail)
- Key format: `draft_{projectId}`
- Browser private/incognito mode may disable localStorage

### Auto-save not working

**Check**:
- Hook effect interval is running (check console)
- Network request succeeds (check Network tab)
- No errors in console

### Conflict errors on save

**Reason**: Another user saved while you were editing

**Solution**:
- Reload the page (`draft.refresh()`)
- Re-apply your changes
- Save again

---

## Future Enhancements

1. **Selective Change Application** — Accept/reject individual changes
2. **Merge UI** — Visual merge for concurrent edits
3. **Draft Naming** — Save multiple draft versions
4. **Batch Operations** — Apply multiple changes as transaction
5. **WebSocket Sync** — Real-time multi-user editing
6. **Version History** — Access previous versions with restore
