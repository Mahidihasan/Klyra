# ApiBuild Page Integration — Draft System Example

This document shows how to integrate the draft system into the existing `frontend/src/pages/ApiBuild/Page.tsx`.

## Current State (Before)

```typescript
// Current: Direct mutations on active project
apiBuildService.update(active.id, {
  name: newName,
  rateLimitPerMin: 500,
} as Partial<ProviderProject>);
s.refresh();
```

Issues:
- No draft state
- No unsaved indicator
- Changes apply immediately to server
- No change review
- Browser back loses changes

## New State (After)

### Step 1: Create Draft Context

```typescript
// frontend/src/pages/ApiBuild/DraftContext.tsx
import React from 'react';
import { useDraftState } from '../../hooks/useDraftState';

interface DraftContextValue extends ReturnType<typeof useDraftState> {}

export const DraftContext = React.createContext<DraftContextValue | null>(null);

export function DraftProvider({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  const draft = useDraftState(projectId);

  return (
    <DraftContext.Provider value={draft}>
      {children}
    </DraftContext.Provider>
  );
}

export function useDraft() {
  const ctx = React.useContext(DraftContext);
  if (!ctx) throw new Error('useDraft must be used inside DraftProvider');
  return ctx;
}
```

### Step 2: Update WorkspaceRedesign Component

```typescript
// frontend/src/pages/ApiBuild/WorkspaceRedesign.tsx
import { DraftProvider, useDraft } from './DraftContext';
import { UnsavedChangesBanner } from '../../components/UnsavedChangesBanner';

export function WorkspaceRedesign(props: WorkspaceRedesignProps) {
  return (
    <DraftProvider projectId={props.project.id}>
      <WorkspaceContent {...props} />
    </DraftProvider>
  );
}

function WorkspaceContent(props: WorkspaceRedesignProps) {
  const draft = useDraft();
  const [showChangeReview, setShowChangeReview] = React.useState(false);

  if (draft.isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="workspace">
      {/* Unsaved Changes Banner */}
      <UnsavedChangesBanner
        hasUnsavedChanges={draft.hasUnsavedChanges}
        changeCount={draft.changes.length}
        isSaving={draft.isSaving}
        error={draft.error}
        onSave={async () => {
          await draft.saveDraft();
          props.onUpdateProject?.({});
        }}
        onReview={() => setShowChangeReview(true)}
        onDiscard={draft.discardDraft}
      />

      {/* Tab Content */}
      <div className="workspace-content">
        {props.tab === 'overview' && <TabOverview project={draft.draft || draft.server} />}
        {props.tab === 'api' && <TabApi project={draft.draft || draft.server} />}
        {/* ... other tabs ... */}
      </div>

      {/* Change Review Modal */}
      {showChangeReview && (
        <ChangeReviewModal
          changes={draft.changes}
          onSave={draft.saveDraft}
          onDiscard={draft.discardDraft}
          onClose={() => setShowChangeReview(false)}
        />
      )}
    </div>
  );
}
```

### Step 3: Update Tab Components

Example: Update `TabOverview.tsx` to use draft and update functions

```typescript
// frontend/src/pages/ApiBuild/tabs/TabOverview.tsx
import { useDraft } from '../DraftContext';

export function TabOverview({ project }: { project: ProviderProject }) {
  const draft = useDraft();

  const handleNameChange = (newName: string) => {
    draft.updateDraft({ name: newName });
  };

  const handleRateLimitChange = (newLimit: number) => {
    draft.updateDraft({ rateLimitPerMin: newLimit });
  };

  return (
    <div className="tab-overview">
      <div className="form-group">
        <label>API Name</label>
        <input
          value={project?.name || ''}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Enter API name"
        />
        {/* Shows which state is current */}
        <small>
          {draft.hasUnsavedChanges ? '🔄 Unsaved changes' : '✓ All saved'}
        </small>
      </div>

      <div className="form-group">
        <label>Rate Limit (req/min)</label>
        <input
          type="number"
          value={project?.rateLimitPerMin || 100}
          onChange={(e) => handleRateLimitChange(Number(e.target.value))}
        />
      </div>

      {/* Show validation warnings */}
      {draft.error && (
        <div className="alert alert-error">
          ⚠️ {draft.error}
        </div>
      )}
    </div>
  );
}
```

### Step 4: Update State Hook

Modify `state.ts` to use draft context instead of local state:

```typescript
// frontend/src/pages/ApiBuild/state.ts
// Keep existing useApiBuild for wizard flow
// New pages will use useDraft() from context

export function useApiBuild(onPlayground: () => void) {
  // ... existing wizard state remains unchanged ...
  return { /* ... */ };
}

// New hook for workspace (uses draft system)
export function useApiBuildWorkspace(projectId: string) {
  const draft = useDraft();

  const handleUpdate = async (patch: Partial<ProviderProject>) => {
    await draft.updateDraft(patch);
  };

  const handleSave = async () => {
    const result = await draft.saveDraft();
    // Refresh composed project in parent
    return result;
  };

  return {
    project: draft.draft || draft.server,
    hasUnsavedChanges: draft.hasUnsavedChanges,
    isLoading: draft.isLoading,
    isSaving: draft.isSaving,
    changes: draft.changes,
    update: handleUpdate,
    save: handleSave,
    discard: draft.discardDraft,
    validate: draft.validateDraft,
  };
}
```

### Step 5: Handle Concurrent Edits

```typescript
// Handle the 409 Conflict error when saving
async function handleSaveWithConflictRecovery() {
  try {
    await draft.saveDraft();
    showSuccess('Changes saved');
  } catch (err: any) {
    if (err.message.includes('CONFLICT') || err.message.includes('409')) {
      const userChoice = await showDialog({
        title: 'Concurrent Edit Detected',
        message: 'Another user made changes. Reload and try again?',
        buttons: ['Reload', 'Keep My Changes', 'Cancel']
      });

      if (userChoice === 'Reload') {
        draft.refresh(); // Reload from server
      } else if (userChoice === 'Keep My Changes') {
        // User can manually re-apply changes and save again
        await draft.saveDraft(); // Retry
      }
    } else {
      showError(err.message);
    }
  }
}
```

---

## Before/After Comparison

### Before (Current Implementation)

```typescript
// Direct mutation — risky, no draft
const handleUpdate = async (patch: Partial<ProviderProject>) => {
  await apiBuildService.update(active.id, patch);
  s.refresh(); // Full refresh
  // Navigation away loses unsaved changes
  // No audit trail
};
```

**Problems**:
- ❌ Changes apply immediately
- ❌ No unsaved indicator
- ❌ Concurrent edits overwrite silently
- ❌ Navigation loses work
- ❌ No change review
- ❌ No audit trail

### After (Draft System)

```typescript
// Working draft — safe, reversible
const { draft, updateDraft, saveDraft, discardDraft, hasUnsavedChanges } = useDraftState(projectId);

const handleUpdate = async (patch: Partial<ProviderProject>) => {
  await updateDraft(patch); // Updates draft, not server
  // Change persists to localStorage
  // UI shows "unsaved" indicator
  // Can discard or review before saving
};

const handleSave = async () => {
  const validation = await validateDraft();
  if (!validation.ok) {
    showError(validation.error);
    return;
  }
  await saveDraft(); // Promotes draft to server
  // Immutable audit event recorded
};
```

**Benefits**:
- ✅ Changes are reversible
- ✅ Persistent across navigation
- ✅ Change review before saving
- ✅ Conflict detection (version mismatch)
- ✅ Auto-save every 30 seconds
- ✅ Browser leave warning
- ✅ Immutable audit trail
- ✅ localStorage fallback for network errors

---

## Migration Checklist

### Phase 1: Add Draft System (Non-Breaking)

- [ ] Add `DraftContext` provider to `WorkspaceRedesign`
- [ ] Add `UnsavedChangesBanner` component
- [ ] Wire up to one tab (e.g., `TabOverview`)
- [ ] Test draft persistence
- [ ] Test save flow

### Phase 2: Migrate All Tabs

- [ ] Update `TabApi` to use draft
- [ ] Update `TabSettings` to use draft
- [ ] Update `TabDeployments` to use draft
- [ ] Update `TabPlans` to use draft
- [ ] Update `TabConsumers` to use draft
- [ ] Test all tabs together

### Phase 3: Conflict Handling

- [ ] Add conflict dialog
- [ ] Test with simulated concurrent edit
- [ ] Test reload recovery

### Phase 4: Audit & History

- [ ] Add `HistoryTab` showing audit log
- [ ] Add diff viewer for audit events
- [ ] Test audit events are recorded

---

## Testing Strategy

### Unit Tests

```typescript
// tests/useDraftState.test.ts
describe('useDraftState', () => {
  it('should load server state on mount', async () => {
    const { result } = renderHook(() => useDraftState('proj-123'));
    await waitFor(() => expect(result.current.server).toBeDefined());
  });

  it('should persist draft to localStorage', async () => {
    const { result } = renderHook(() => useDraftState('proj-123'));
    act(() => result.current.updateDraft({ name: 'Updated' }));
    expect(localStorage.getItem('draft_proj-123')).toBeDefined();
  });

  it('should detect unsaved changes', async () => {
    const { result } = renderHook(() => useDraftState('proj-123'));
    act(() => result.current.updateDraft({ name: 'Updated' }));
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('should save draft to server', async () => {
    const { result } = renderHook(() => useDraftState('proj-123'));
    act(() => result.current.updateDraft({ name: 'Updated' }));
    await act(async () => result.current.saveDraft());
    expect(result.current.hasUnsavedChanges).toBe(false);
  });
});
```

### Integration Tests

```typescript
// tests/DraftIntegration.test.tsx
describe('Draft System Integration', () => {
  it('should survive navigation', async () => {
    const { rerender } = render(<ApiBuildPage />);
    // Make changes
    fireEvent.change(screen.getByLabelText('API Name'), { target: { value: 'New Name' } });
    // Navigate away
    rerender(<DashboardPage />);
    // Navigate back
    rerender(<ApiBuildPage />);
    // Changes should persist
    expect(screen.getByLabelText('API Name')).toHaveValue('New Name');
  });

  it('should warn before leaving with unsaved changes', async () => {
    render(<ApiBuildPage />);
    fireEvent.change(screen.getByLabelText('API Name'), { target: { value: 'New Name' } });
    
    const event = new BeforeUnloadEvent('beforeunload');
    fireEvent(window, event);
    
    expect(event.defaultPrevented).toBe(true);
  });
});
```

---

## Rollout Plan

1. **Week 1**: Implement and test on one tab (TabOverview)
2. **Week 2**: Migrate remaining tabs, handle conflicts
3. **Week 3**: Add history/audit UI
4. **Week 4**: Deploy to staging, user testing
5. **Week 5**: Deploy to production

---

## Key Files Modified

| File | Changes |
|------|---------|
| `Page.tsx` | Wrap with `DraftProvider` |
| `WorkspaceRedesign.tsx` | Add `UnsavedChangesBanner`, use `useDraft()` |
| `TabOverview.tsx` | Use `useDraft()` instead of direct updates |
| `TabApi.tsx` | Use `useDraft()` instead of direct updates |
| ... all tabs | Use `useDraft()` instead of direct updates |
| `state.ts` | Add `useApiBuildWorkspace()` hook |

## Key Files Created

| File | Purpose |
|------|---------|
| `DraftContext.tsx` | Provides draft state to all tabs |
| `UnsavedChangesBanner.tsx` | Visual indicator + actions |
| `ChangeReviewModal.tsx` | Review changes before saving |
| `HistoryTab.tsx` | Audit log viewer |
