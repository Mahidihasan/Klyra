import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ShieldAlert, Database } from 'lucide-react';

import { adminApi, AdminApiError } from '../../services/api/admin';
import { getImpersonationSession } from '../../services/impersonation';
import { useAuth } from '../../context/AuthContext';
import { hasAdminAccess } from '../../config/adminAccess';
import {
  AdminApiList,
  AdminApiRow,
  ApiSortField,
  ApiStatusValue,
  SortDirection,
  ModerateAction,
} from '../../types/adminApis';

import { Pagination } from '../AdminUsers/Pagination';
import { ApiTable, ApiTableSkeleton, ApiAction } from './ApiTable';
import { ApisToolbar } from './ApisToolbar';
import { ApiReviewModal } from './ApiReviewModal';

const DEFAULT_LIMIT = 25;

interface QueryState {
  search: string;
  status: ApiStatusValue | null;
  categoryId: string | null;
  sort: ApiSortField;
  direction: SortDirection;
  page: number;
  limit: number;
}

const INITIAL_QUERY: QueryState = {
  search: '',
  status: null,
  categoryId: null,
  sort: 'created',
  direction: 'desc',
  page: 1,
  limit: DEFAULT_LIMIT,
};

type LoadReason = 'initial' | 'query' | 'refresh';

export const AdminApisPage: React.FC = () => {
  const { user: authUser } = useAuth();

  const [query, setQuery] = useState<QueryState>(INITIAL_QUERY);
  const [list, setList] = useState<AdminApiList | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [reviewApi, setReviewApi] = useState<AdminApiRow | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const requestRef = useRef<AbortController | null>(null);
  const listRef = useRef<AdminApiList | null>(null);
  listRef.current = list;

  // View modes
  const [viewMode, setViewMode] = useState<'inventory' | 'queue'>('inventory');

  // Sync queue mode with status filter
  useEffect(() => {
    if (viewMode === 'queue') {
      patchQuery({ status: 'PENDING' });
    } else if (query.status === 'PENDING') {
      patchQuery({ status: null });
    }
  }, [viewMode]);

  const load = useCallback(async (next: QueryState, reason: LoadReason) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    setIsBusy(true);
    if (reason !== 'refresh') setError(null);

    try {
      const data = await adminApi.listApis(
        {
          page: next.page,
          limit: next.limit,
          search: next.search || null,
          status: next.status,
          categoryId: next.categoryId,
          sort: next.sort,
          direction: next.direction,
        },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setList(data);
      setError(null);
    } catch (err) {
      if (controller.signal.aborted || (err as Error).name === 'AbortError') return;
      if (reason === 'refresh' && listRef.current) return;
      setError(err instanceof Error ? err : new Error('Failed to load APIs'));
    } finally {
      if (!controller.signal.aborted) setIsBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(query, listRef.current === null ? 'initial' : 'query');
  }, [query, load]);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const patchQuery = useCallback((patch: Partial<QueryState>) => {
    setQuery((current) => ({
      ...current,
      ...patch,
      page: patch.page ?? 1,
    }));
  }, []);

  const handleSortChange = useCallback((field: ApiSortField) => {
    setQuery((current) => ({
      ...current,
      sort: field,
      direction:
        current.sort === field
          ? current.direction === 'asc'
            ? 'desc'
            : 'asc'
          : field === 'created'
          ? 'desc'
          : 'asc',
      page: 1,
    }));
  }, []);

  const closeModal = useCallback(() => {
    setReviewApi(null);
    setMutationError(null);
  }, []);

  const handleAction = useCallback((action: ApiAction, api: AdminApiRow) => {
    setMutationError(null);
    if (action === 'review') {
      setReviewApi(api);
    }
  }, []);

  const handleModerateConfirm = useCallback(async (action: ModerateAction, reason: string) => {
    if (!reviewApi) return;
    setIsSaving(true);
    setMutationError(null);
    try {
      await adminApi.moderateApi(reviewApi.id, action, reason);
      setReviewApi(null);
      setToast(\`API \${reviewApi.name} has been \${action.toLowerCase()}.\`);
      void load(query, 'refresh');
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'The action could not be completed.');
    } finally {
      setIsSaving(false);
    }
  }, [reviewApi, load, query]);


  const header = (
    <div className="au-header">
      <div>
        <h1 className="au-title">APIs Inventory</h1>
        <p className="au-subtitle">
          Monitor and moderate all APIs across the platform.
        </p>
      </div>
      {list && (
        <span className="au-source" data-source={list.source}>
          <span className="au-source-dot" />
          {list.source === 'live' ? 'Live data' : 'Sample data'}
        </span>
      )}
    </div>
  );

  if (getImpersonationSession()) {
    return (
      <div className="au-page">
        {header}
        <div className="au-notice card-base">
          <ShieldAlert size={20} aria-hidden="true" />
          <h3>Not available while impersonating</h3>
          <p>
            Exit the impersonated session using the banner at the top of the screen to return to
            your own admin account.
          </p>
        </div>
        <AdminApisStyles />
      </div>
    );
  }

  if (error && !list) {
    const adminError = error instanceof AdminApiError ? error : null;

    return (
      <div className="au-page">
        {header}
        <div className="au-notice card-base">
          {adminError?.isForbidden || adminError?.isUnauthorized ? (
            <>
              <ShieldAlert size={20} aria-hidden="true" />
              <h3>
                {adminError.isForbidden ? 'Your account is not an admin' : 'Sign in to continue'}
              </h3>
              <p>
                API management is limited to accounts with the ADMIN or MODERATOR role.
              </p>
            </>
          ) : (
            <>
              <AlertTriangle size={20} aria-hidden="true" />
              <h3>Couldn&apos;t load APIs</h3>
              <p>{error.message}</p>
              <button
                type="button"
                className="au-primary-btn"
                onClick={() => void load(query, 'initial')}
              >
                Try again
              </button>
            </>
          )}
        </div>
        <AdminApisStyles />
      </div>
    );
  }

  return (
    <div className="au-page">
      {header}

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px', marginBottom: '8px' }}>
        <button
          className={\`au-ghost-btn \${viewMode === 'inventory' ? 'active-tab-btn' : ''}\`}
          onClick={() => setViewMode('inventory')}
        >
          All APIs Inventory
        </button>
        <button
          className={\`au-ghost-btn \${viewMode === 'queue' ? 'active-tab-btn' : ''}\`}
          onClick={() => setViewMode('queue')}
        >
          Pending Approval Queue
          {viewMode !== 'queue' && query.status !== 'PENDING' && (
            <span className="au-filter-count" style={{ marginLeft: 6, background: 'var(--status-beta)', color: '#111827' }}>!</span>
          )}
        </button>
      </div>

      <ApisToolbar
        search={query.search}
        status={query.status}
        categoryId={query.categoryId}
        total={list?.meta.total ?? 0}
        isBusy={isBusy}
        onSearchChange={(search) => patchQuery({ search })}
        onStatusChange={(status) => patchQuery({ status })}
        onOpenFilters={() => {}}
        onRefresh={() => void load(query, 'refresh')}
      />

      <div className="au-table-card card-base">
        {!list ? (
          <ApiTableSkeleton rows={query.limit > 25 ? 12 : 8} />
        ) : list.apis.length === 0 ? (
          <div className="au-empty">
            <Database size={22} aria-hidden="true" />
            <h3>No APIs match these filters</h3>
            <p>Try a broader search, or clear the category and status filters.</p>
            <button
              type="button"
              className="au-ghost-btn"
              onClick={() => setQuery({ ...INITIAL_QUERY, limit: query.limit })}
            >
              Reset filters
            </button>
          </div>
        ) : (
          <ApiTable
            apis={list.apis}
            sort={query.sort}
            direction={query.direction}
            onSortChange={handleSortChange}
            onAction={handleAction}
            isRefreshing={isBusy}
          />
        )}

        {list && list.apis.length > 0 && (
          <Pagination
            meta={list.meta}
            isBusy={isBusy}
            onPageChange={(page) => patchQuery({ page })}
            onLimitChange={(limit) => patchQuery({ limit })}
          />
        )}
      </div>

      {reviewApi && (
        <ApiReviewModal
          api={reviewApi}
          isSaving={isSaving}
          error={mutationError}
          onConfirm={handleModerateConfirm}
          onClose={closeModal}
        />
      )}

      {toast && (
        <div className="au-toast" role="status">
          {toast}
        </div>
      )}

      <AdminApisStyles />
    </div>
  );
};

const AdminApisStyles: React.FC = () => (
  <style>{`
    .active-tab-btn {
      background-color: rgba(139, 92, 246, 0.1) !important;
      color: var(--accent-purple) !important;
      border-color: rgba(139, 92, 246, 0.3) !important;
    }
  `}</style>
);
