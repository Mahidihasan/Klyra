import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ShieldAlert, UserX } from 'lucide-react';

import { adminApi, AdminApiError } from '../../services/api/admin';
import { beginImpersonation, getImpersonationSession } from '../../services/impersonation';
import { useAuth } from '../../context/AuthContext';
import {
  AdminUserList,
  AdminUserRow,
  SortDirection,
  USER_ROLES,
  UserRoleValue,
  UserSortField,
  UserStatusFilter,
  UserStatusValue,
  ViewerIdentity,
} from '../../types/adminUsers';

import { ChangeRoleModal } from './ChangeRoleModal';
import { ConfirmActionDialog } from './ConfirmActionDialog';
import { FilterDrawer } from './FilterDrawer';
import { ImpersonateDialog } from './ImpersonateDialog';
import { Pagination } from './Pagination';
import { UserAction } from './UserActionMenu';
import { UserProfileDrawer } from './UserProfileDrawer';
import { UserTable, UserTableSkeleton } from './UserTable';
import { UsersToolbar } from './UsersToolbar';

/**
 * Admin → Users.
 *
 * Every filter, sort and page is resolved server-side. Filtering a single page
 * in the browser would produce a table that disagrees with its own result
 * count, and on a marketplace the interesting accounts are rarely on page one.
 *
 * All mutations go through `runMutation`, which is the only place that decides
 * what a failed write does to the screen. Keeping that in one function is what
 * stops a half-applied optimistic update from leaving the table claiming
 * someone is suspended when the server refused.
 */

const DEFAULT_LIMIT = 25;

interface QueryState {
  search: string;
  role: UserRoleValue | null;
  status: UserStatusFilter | null;
  sort: UserSortField;
  direction: SortDirection;
  page: number;
  limit: number;
}

const INITIAL_QUERY: QueryState = {
  search: '',
  role: null,
  status: null,
  sort: 'joined',
  direction: 'desc',
  page: 1,
  limit: DEFAULT_LIMIT,
};

type LoadReason = 'initial' | 'query' | 'refresh';

type ModalState =
  | { kind: 'role'; user: AdminUserRow }
  | { kind: 'status'; user: AdminUserRow; nextStatus: UserStatusValue }
  | { kind: 'impersonate'; user: AdminUserRow }
  | null;

/** Narrow the free-form role string on the auth profile to the real enum. */
function toRoleValue(role?: string | null): UserRoleValue | null {
  const upper = role?.toUpperCase();
  return USER_ROLES.find((value) => value === upper) ?? null;
}

export const AdminUsersPage: React.FC = () => {
  const { user: authUser } = useAuth();

  const [query, setQuery] = useState<QueryState>(INITIAL_QUERY);
  const [list, setList] = useState<AdminUserList | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<AdminUserRow | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Bumped after every successful write so the open profile drawer refetches.
  const [reloadToken, setReloadToken] = useState(0);

  const requestRef = useRef<AbortController | null>(null);
  const listRef = useRef<AdminUserList | null>(null);
  listRef.current = list;

  const viewer: ViewerIdentity = {
    id: authUser?.id ?? null,
    role: toRoleValue(authUser?.role),
  };

  // ---- Loading ------------------------------------------------------------

  const load = useCallback(async (next: QueryState, reason: LoadReason) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;

    setIsBusy(true);
    if (reason !== 'refresh') setError(null);

    try {
      const data = await adminApi.listUsers(
        {
          page: next.page,
          limit: next.limit,
          search: next.search || null,
          role: next.role,
          status: next.status,
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
      setError(err instanceof Error ? err : new Error('Failed to load users'));
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

  /**
   * Any change other than paging returns to page one: staying on page 7 while
   * narrowing a filter to three results shows an empty table and reads as "no
   * matches" rather than "wrong page".
   */
  const patchQuery = useCallback((patch: Partial<QueryState>) => {
    setQuery((current) => ({
      ...current,
      ...patch,
      page: patch.page ?? 1,
    }));
  }, []);

  const handleSortChange = useCallback((field: UserSortField) => {
    setQuery((current) => ({
      ...current,
      sort: field,
      // Re-clicking the active column flips it; a new column starts ascending,
      // except for dates where "newest first" is the useful default.
      direction:
        current.sort === field
          ? current.direction === 'asc'
            ? 'desc'
            : 'asc'
          : field === 'joined'
          ? 'desc'
          : 'asc',
      page: 1,
    }));
  }, []);

  // ---- Mutations ----------------------------------------------------------

  const closeModal = useCallback(() => {
    setModal(null);
    setMutationError(null);
  }, []);

  /**
   * One funnel for every write. On success it closes the dialog, reports what
   * happened, and refetches; on failure it leaves the dialog open with the
   * server's own message, because the dialog is where the correction is made.
   */
  const runMutation = useCallback(
    async (label: string, action: () => Promise<void>) => {
      setIsSaving(true);
      setMutationError(null);
      try {
        await action();
        setModal(null);
        setToast(label);
        setReloadToken((token) => token + 1);
        void load(query, 'refresh');
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : 'The change could not be saved.');
      } finally {
        setIsSaving(false);
      }
    },
    [load, query],
  );

  const handleRoleConfirm = useCallback(
    (user: AdminUserRow, role: UserRoleValue) =>
      runMutation(`${user.name || user.email} is now ${role.toLowerCase()}.`, async () => {
        await adminApi.updateUserRole(user.id, role);
      }),
    [runMutation],
  );

  const handleStatusConfirm = useCallback(
    (user: AdminUserRow, status: UserStatusValue, reason: string) =>
      runMutation(`${user.name || user.email} is now ${status.toLowerCase()}.`, async () => {
        await adminApi.updateUserStatus(user.id, status, reason || undefined);
      }),
    [runMutation],
  );

  const handleImpersonateConfirm = useCallback(async (user: AdminUserRow) => {
    setIsSaving(true);
    setMutationError(null);
    try {
      const grant = await adminApi.impersonateUser(user.id);
      beginImpersonation(grant);
      // Deliberately no state cleanup: the reload discards this tree entirely,
      // and clearing the saving flag first would flash an enabled button.
      window.location.reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Impersonation was refused.');
      setIsSaving(false);
    }
  }, []);

  const handleAction = useCallback((action: UserAction, user: AdminUserRow) => {
    setMutationError(null);
    switch (action) {
      case 'view':
        setProfileUser(user);
        break;
      case 'role':
        setModal({ kind: 'role', user });
        break;
      case 'suspend':
        setModal({ kind: 'status', user, nextStatus: 'SUSPENDED' });
        break;
      case 'ban':
        setModal({ kind: 'status', user, nextStatus: 'BANNED' });
        break;
      case 'reactivate':
        setModal({ kind: 'status', user, nextStatus: 'ACTIVE' });
        break;
      case 'impersonate':
        setModal({ kind: 'impersonate', user });
        break;
      default:
        break;
    }
  }, []);

  // ---- Render -------------------------------------------------------------

  const header = (
    <div className="au-header">
      <div>
        <h1 className="au-title">Users</h1>
        <p className="au-subtitle">
          Every account on the marketplace, with the roles and access they hold.
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

  // An impersonated session must never reach an admin screen. The server
  // refuses these writes anyway, but showing the table at all would imply the
  // opposite.
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
        <AdminUsersStyles />
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
                User management is limited to accounts with the ADMIN or MODERATOR role. Moderators
                can read this screen but not change anything on it.
              </p>
            </>
          ) : (
            <>
              <AlertTriangle size={20} aria-hidden="true" />
              <h3>Couldn&apos;t load users</h3>
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
        <AdminUsersStyles />
      </div>
    );
  }

  return (
    <div className="au-page">
      {header}

      {list?.source === 'mock' && (
        <div className="au-degraded">
          <AlertTriangle size={15} aria-hidden="true" />
          <p>
            {list.degradedReason ??
              'Live data is unavailable, so this is sample data. Changes will not be saved.'}
          </p>
        </div>
      )}

      <UsersToolbar
        search={query.search}
        role={query.role}
        status={query.status}
        total={list?.meta.total ?? 0}
        isBusy={isBusy}
        onSearchChange={(search) => patchQuery({ search })}
        onRoleChange={(role) => patchQuery({ role })}
        onStatusChange={(status) => patchQuery({ status })}
        onOpenFilters={() => setIsFiltersOpen(true)}
        onRefresh={() => void load(query, 'refresh')}
      />

      <div className="au-table-card card-base">
        {!list ? (
          <UserTableSkeleton rows={query.limit > 25 ? 12 : 8} />
        ) : list.users.length === 0 ? (
          <div className="au-empty">
            <UserX size={22} aria-hidden="true" />
            <h3>No users match these filters</h3>
            <p>Try a broader search, or clear the role and status filters.</p>
            <button
              type="button"
              className="au-ghost-btn"
              onClick={() => setQuery({ ...INITIAL_QUERY, limit: query.limit })}
            >
              Reset filters
            </button>
          </div>
        ) : (
          <UserTable
            users={list.users}
            viewer={viewer}
            sort={query.sort}
            direction={query.direction}
            onSortChange={handleSortChange}
            onAction={handleAction}
            isRefreshing={isBusy}
          />
        )}

        {list && list.users.length > 0 && (
          <Pagination
            meta={list.meta}
            isBusy={isBusy}
            onPageChange={(page) => patchQuery({ page })}
            onLimitChange={(limit) => patchQuery({ limit })}
          />
        )}
      </div>

      {isFiltersOpen && (
        <FilterDrawer
          isOpen={isFiltersOpen}
          role={query.role}
          status={query.status}
          onRoleChange={(role) => patchQuery({ role })}
          onStatusChange={(status) => patchQuery({ status })}
          onClear={() => patchQuery({ role: null, status: null })}
          onClose={() => setIsFiltersOpen(false)}
        />
      )}

      {profileUser && (
        <UserProfileDrawer
          user={profileUser}
          viewer={viewer}
          reloadToken={reloadToken}
          onAction={handleAction}
          onClose={() => setProfileUser(null)}
        />
      )}

      {modal?.kind === 'role' && (
        <ChangeRoleModal
          user={modal.user}
          viewer={viewer}
          isSaving={isSaving}
          error={mutationError}
          onConfirm={(role) => void handleRoleConfirm(modal.user, role)}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'status' && (
        <ConfirmActionDialog
          user={modal.user}
          viewer={viewer}
          nextStatus={modal.nextStatus}
          isSaving={isSaving}
          error={mutationError}
          onConfirm={(status, reason) => void handleStatusConfirm(modal.user, status, reason)}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'impersonate' && (
        <ImpersonateDialog
          user={modal.user}
          viewer={viewer}
          isSaving={isSaving}
          error={mutationError}
          onConfirm={() => void handleImpersonateConfirm(modal.user)}
          onClose={closeModal}
        />
      )}

      {toast && (
        <div className="au-toast" role="status">
          {toast}
        </div>
      )}

      <AdminUsersStyles />
    </div>
  );
};

/**
 * Styles for the whole Users module.
 *
 * Colocated in one block, matching AdminOverview: the `au-` prefix is the
 * namespace, and keeping every rule in the page that owns it means a component
 * can never be deleted while its styles quietly survive in a shared sheet.
 */
const AdminUsersStyles: React.FC = () => (
  <style>{`
    .au-page {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .au-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .au-title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .au-subtitle {
      margin-top: 4px;
      font-size: 13px;
      color: var(--text-muted);
    }

    .au-source {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 32px;
      padding: 0 12px;
      border-radius: var(--radius-md);
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      background-color: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.25);
      color: var(--status-active);
    }

    .au-source[data-source='mock'] {
      background-color: rgba(245, 158, 11, 0.08);
      border-color: rgba(245, 158, 11, 0.3);
      color: var(--status-beta);
    }

    .au-source-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: currentColor;
    }

    .au-degraded {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 11px 14px;
      border-radius: var(--radius-md);
      background-color: rgba(245, 158, 11, 0.07);
      border: 1px solid rgba(245, 158, 11, 0.25);
      color: var(--status-beta);
    }

    .au-degraded p {
      font-size: 12px;
      line-height: 1.5;
    }

    .au-spin {
      animation: au-spin 0.9s linear infinite;
    }

    @keyframes au-spin {
      to { transform: rotate(360deg); }
    }

    /* ---------------------------------------------------------- toolbar -- */

    .au-toolbar {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .au-toolbar-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .au-toolbar-meta {
      justify-content: space-between;
      min-height: 24px;
    }

    .au-search {
      position: relative;
      display: flex;
      align-items: center;
      flex: 1;
      min-width: 240px;
      max-width: 420px;
    }

    .au-search-icon {
      position: absolute;
      left: 11px;
      color: var(--text-muted);
      pointer-events: none;
    }

    .au-search-input {
      width: 100%;
      height: 36px;
      padding: 0 34px 0 33px;
      border-radius: var(--radius-md);
      background-color: var(--bg-input);
      border: 1px solid var(--border-card);
      color: var(--text-primary);
      font-size: 13px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .au-search-input::placeholder {
      color: var(--text-muted);
    }

    .au-search-input:focus {
      border-color: var(--accent-subtle-border);
      box-shadow: 0 0 0 3px var(--accent-subtle);
    }

    .au-search-input::-webkit-search-cancel-button {
      appearance: none;
    }

    .au-search-clear {
      position: absolute;
      right: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      color: var(--text-muted);
      cursor: pointer;
    }

    .au-search-clear:hover {
      background-color: var(--bg-pill);
      color: var(--text-primary);
    }

    .au-filter-btn,
    .au-refresh-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      height: 36px;
      padding: 0 14px;
      border-radius: var(--radius-md);
      background-color: var(--bg-card);
      border: 1px solid var(--border-card);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease;
    }

    .au-filter-btn:hover,
    .au-refresh-btn:hover:not(:disabled) {
      border-color: var(--accent-subtle-border);
      color: var(--text-primary);
    }

    .au-filter-btn.active {
      border-color: rgba(34, 211, 238, 0.4);
      color: #67e8f9;
      background-color: rgba(34, 211, 238, 0.07);
    }

    .au-refresh-btn:disabled {
      opacity: 0.55;
      cursor: default;
    }

    .au-filter-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 17px;
      height: 17px;
      padding: 0 5px;
      border-radius: 9px;
      background-color: rgba(34, 211, 238, 0.2);
      color: #a5f3fc;
      font-size: 10.5px;
      font-variant-numeric: tabular-nums;
    }

    .au-result-count {
      font-size: 12px;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    .au-chips {
      display: flex;
      align-items: center;
      gap: 7px;
      flex-wrap: wrap;
    }

    .au-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 260px;
      height: 24px;
      padding: 0 4px 0 10px;
      border-radius: 12px;
      background-color: var(--bg-pill);
      border: 1px solid var(--border-card);
      color: var(--text-secondary);
      font-size: 11.5px;
    }

    .au-chip-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .au-chip button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      color: var(--text-muted);
      cursor: pointer;
    }

    .au-chip button:hover {
      background-color: rgba(255, 255, 255, 0.08);
      color: var(--text-primary);
    }

    /* ------------------------------------------------------------ table -- */

    .au-table-card {
      padding: 0;
      overflow: hidden;
    }

    .au-table-scroll {
      overflow-x: auto;
    }

    .au-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      transition: opacity 0.15s ease;
    }

    .au-table[data-refreshing='true'] tbody {
      opacity: 0.55;
    }

    .au-table th {
      position: sticky;
      top: 0;
      z-index: 1;
      padding: 0 14px;
      height: 38px;
      text-align: left;
      white-space: nowrap;
      background-color: var(--bg-card-hover);
      border-bottom: 1px solid var(--border-card);
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .au-table th[data-align='end'],
    .au-table td[data-align='end'] {
      text-align: right;
    }

    .au-table td {
      padding: 9px 14px;
      border-bottom: 1px solid var(--border-subtle);
      vertical-align: middle;
    }

    .au-table tbody tr:last-child td {
      border-bottom: none;
    }

    .au-table tbody tr:hover {
      background-color: var(--bg-card-hover);
    }

    .au-sort {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: inherit;
      font: inherit;
      letter-spacing: inherit;
      text-transform: inherit;
      cursor: pointer;
    }

    .au-sort:hover {
      color: var(--text-secondary);
    }

    .au-sort-active {
      color: var(--text-accent);
    }

    .au-identity {
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: 260px;
      text-align: left;
      cursor: pointer;
    }

    .au-identity-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .au-name {
      color: var(--text-primary);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .au-identity:hover .au-name {
      color: var(--text-accent);
    }

    .au-last-seen,
    .au-joined {
      font-size: 11.5px;
      color: var(--text-muted);
    }

    .au-email {
      display: inline-block;
      max-width: 240px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--text-secondary);
      vertical-align: middle;
    }

    .au-joined {
      font-variant-numeric: tabular-nums;
    }

    .au-skeleton {
      display: block;
      height: 12px;
      border-radius: 4px;
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.03) 25%,
        rgba(255, 255, 255, 0.07) 50%,
        rgba(255, 255, 255, 0.03) 75%
      );
      background-size: 600px 100%;
      animation: au-shimmer 1.4s ease-in-out infinite;
    }

    @keyframes au-shimmer {
      0% { background-position: -300px 0; }
      100% { background-position: 600px 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .au-skeleton,
      .au-spin { animation: none; }
    }

    .au-sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* ----------------------------------------------------------- badges -- */

    .au-avatar {
      flex-shrink: 0;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid var(--border-card);
    }

    .au-avatar-fallback {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .au-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      height: 21px;
      padding: 0 9px;
      border-radius: 11px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      background-color: rgba(34, 211, 238, 0.1);
      border: 1px solid rgba(34, 211, 238, 0.28);
      color: #67e8f9;
    }

    .au-role-badge[data-role='USER'] {
      background-color: rgba(148, 163, 184, 0.1);
      border-color: rgba(148, 163, 184, 0.25);
      color: var(--text-secondary);
    }

    .au-role-badge[data-role='MODERATOR'] {
      background-color: var(--accent-subtle);
      border-color: var(--accent-subtle-border);
      color: var(--text-accent);
    }

    .au-role-badge[data-role='ADMIN'] {
      background-color: rgba(217, 70, 239, 0.12);
      border-color: rgba(217, 70, 239, 0.35);
      color: #f0abfc;
    }

    .au-status-cell {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .au-status-badge {
      background-color: rgba(34, 197, 94, 0.1);
      border-color: rgba(34, 197, 94, 0.28);
      color: var(--status-active);
    }

    .au-status-badge[data-status='INACTIVE'] {
      background-color: rgba(148, 163, 184, 0.1);
      border-color: rgba(148, 163, 184, 0.25);
      color: var(--text-secondary);
    }

    .au-status-badge[data-status='SUSPENDED'] {
      background-color: rgba(245, 158, 11, 0.1);
      border-color: rgba(245, 158, 11, 0.3);
      color: var(--status-beta);
    }

    .au-status-badge[data-status='BANNED'] {
      background-color: rgba(239, 68, 68, 0.12);
      border-color: rgba(239, 68, 68, 0.32);
      color: var(--status-maintenance);
    }

    .au-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: currentColor;
    }

    .au-pending-badge {
      background-color: rgba(245, 158, 11, 0.08);
      border-color: rgba(245, 158, 11, 0.22);
      color: var(--status-beta);
      cursor: help;
    }

    .au-counts {
      display: inline-flex;
      align-items: baseline;
      gap: 4px;
      font-variant-numeric: tabular-nums;
      color: var(--text-secondary);
    }

    .au-count-sep {
      color: var(--text-muted);
      opacity: 0.6;
    }

    .au-count-zero {
      color: var(--text-muted);
      opacity: 0.6;
    }

    /* ------------------------------------------------------- action menu -- */

    .au-menu-wrap {
      position: relative;
      display: inline-flex;
    }

    .au-menu-trigger {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
    }

    .au-menu-trigger:hover,
    .au-menu-trigger[aria-expanded='true'] {
      background-color: var(--bg-card-active);
      color: var(--text-primary);
    }

    .au-menu {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      z-index: 40;
      display: flex;
      flex-direction: column;
      min-width: 194px;
      padding: 5px;
      border-radius: var(--radius-md);
      background-color: var(--bg-modal);
      border: 1px solid var(--border-card);
      box-shadow: var(--shadow-md);
    }

    .au-menu-item {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 7px 9px;
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      font-size: 12.5px;
      text-align: left;
      cursor: pointer;
    }

    .au-menu-item:hover:not(:disabled) {
      background-color: var(--bg-card-active);
      color: var(--text-primary);
    }

    .au-menu-item:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .au-menu-danger:hover:not(:disabled) {
      background-color: rgba(239, 68, 68, 0.12);
      color: #fca5a5;
    }

    /* ---------------------------------------------------------- overlays -- */

    .au-drawer-overlay,
    .au-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background-color: rgba(3, 4, 9, 0.62);
      backdrop-filter: blur(2px);
    }

    .au-drawer-overlay {
      display: flex;
      justify-content: flex-end;
    }

    .au-modal-overlay {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .au-drawer {
      display: flex;
      flex-direction: column;
      width: min(460px, 100%);
      height: 100%;
      background-color: var(--bg-modal);
      border-left: 1px solid var(--border-card);
      box-shadow: var(--shadow-md);
      animation: au-slide-in 0.18s ease-out;
    }

    @keyframes au-slide-in {
      from { transform: translateX(18px); opacity: 0.6; }
    }

    @media (prefers-reduced-motion: reduce) {
      .au-drawer { animation: none; }
    }

    .au-drawer-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px;
      border-bottom: 1px solid var(--border-card);
    }

    .au-drawer-head h2 {
      font-size: 16px;
      font-weight: 700;
    }

    .au-drawer-body {
      flex: 1;
      overflow-y: auto;
      padding: 18px 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .au-drawer-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 14px 20px;
      border-top: 1px solid var(--border-card);
    }

    .au-icon-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      flex-shrink: 0;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      cursor: pointer;
    }

    .au-icon-btn:hover {
      background-color: var(--bg-card-active);
      color: var(--text-primary);
    }

    /* ---------------------------------------------------- filter drawer -- */

    .au-filter-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
      border: none;
    }

    .au-filter-group legend {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 10px;
    }

    .au-filter-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .au-filter-pill {
      height: 30px;
      padding: 0 13px;
      border-radius: 15px;
      background-color: var(--bg-pill);
      border: 1px solid var(--border-card);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: border-color 0.15s ease, color 0.15s ease;
    }

    .au-filter-pill:hover {
      border-color: var(--accent-subtle-border);
      color: var(--text-primary);
    }

    .au-filter-pill.active {
      background-color: rgba(34, 211, 238, 0.12);
      border-color: rgba(34, 211, 238, 0.42);
      color: #67e8f9;
      font-weight: 600;
    }

    .au-filter-note {
      font-size: 11.5px;
      line-height: 1.55;
      color: var(--text-muted);
    }

    /* --------------------------------------------------- profile drawer -- */

    .au-profile-identity {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .au-profile-email {
      font-size: 12px;
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .au-profile-head-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .au-profile-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .au-facts {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 14px 16px;
    }

    .au-fact dt {
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 3px;
    }

    .au-fact dd {
      font-size: 12.5px;
      color: var(--text-secondary);
      word-break: break-word;
    }

    .au-fact dd a {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .au-mono {
      font-family: var(--font-mono);
      font-size: 11.5px;
      color: var(--text-accent);
    }

    .au-profile-section h3 {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 9px;
    }

    .au-profile-bio {
      font-size: 12.5px;
      line-height: 1.6;
      color: var(--text-secondary);
    }

    .au-muted {
      font-size: 12.5px;
      color: var(--text-muted);
    }

    .au-activity {
      display: flex;
      flex-direction: column;
      gap: 2px;
      list-style: none;
    }

    .au-activity li {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 2px 10px;
      padding: 8px 10px;
      border-radius: var(--radius-sm);
      background-color: var(--bg-card);
    }

    .au-activity-action {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .au-activity-time {
      grid-row: 1 / span 2;
      grid-column: 2;
      align-self: center;
      font-size: 11px;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .au-activity-meta {
      font-size: 11px;
      color: var(--text-muted);
    }

    /* ----------------------------------------------------------- modals -- */

    .au-modal {
      display: flex;
      flex-direction: column;
      gap: 14px;
      width: min(520px, 100%);
      max-height: 100%;
      overflow-y: auto;
      padding: 22px;
      border-radius: var(--radius-lg);
      background-color: var(--bg-modal);
      border: 1px solid var(--border-card);
      box-shadow: var(--shadow-md);
    }

    .au-modal-title {
      font-size: 17px;
      font-weight: 700;
    }

    .au-modal-title[data-destructive='true'] {
      color: #fca5a5;
    }

    .au-modal-subject {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 11px 13px;
      border-radius: var(--radius-md);
      background-color: var(--bg-card);
      border: 1px solid var(--border-card);
    }

    .au-modal-subject > div {
      flex: 1;
      min-width: 0;
    }

    .au-modal-subject-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .au-modal-subject-email {
      font-size: 11.5px;
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .au-modal-body {
      font-size: 12.5px;
      line-height: 1.65;
      color: var(--text-secondary);
    }

    .au-modal-points {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-left: 18px;
      font-size: 12px;
      line-height: 1.55;
      color: var(--text-muted);
    }

    .au-modal-foot {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 2px;
    }

    /* ------------------------------------------------------ role picker -- */

    .au-role-picker {
      display: flex;
      flex-direction: column;
      gap: 8px;
      border: none;
    }

    .au-role-picker:disabled {
      opacity: 0.55;
    }

    .au-role-option {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 11px 13px;
      border-radius: var(--radius-md);
      background-color: var(--bg-card);
      border: 1px solid var(--border-card);
      cursor: pointer;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }

    .au-role-option:hover {
      border-color: var(--accent-subtle-border);
    }

    .au-role-option.selected {
      border-color: rgba(34, 211, 238, 0.45);
      background-color: rgba(34, 211, 238, 0.06);
    }

    .au-role-option input {
      margin-top: 2px;
      accent-color: #22d3ee;
    }

    .au-role-option-body {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }

    .au-role-option-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .au-role-current {
      padding: 1px 7px;
      border-radius: 9px;
      background-color: var(--bg-pill);
      border: 1px solid var(--border-card);
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .au-role-option-hint {
      font-size: 11.5px;
      line-height: 1.5;
      color: var(--text-muted);
    }

    /* ----------------------------------------------------------- fields -- */

    .au-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      position: relative;
    }

    .au-field-label {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .au-field-optional {
      font-weight: 400;
      color: var(--text-muted);
    }

    .au-input,
    .au-textarea {
      width: 100%;
      padding: 9px 11px;
      border-radius: var(--radius-md);
      background-color: var(--bg-input);
      border: 1px solid var(--border-card);
      color: var(--text-primary);
      font-size: 12.5px;
      line-height: 1.5;
      resize: vertical;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .au-input:focus,
    .au-textarea:focus {
      border-color: var(--accent-subtle-border);
      box-shadow: 0 0 0 3px var(--accent-subtle);
    }

    .au-field-count {
      align-self: flex-end;
      font-size: 10.5px;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    /* ---------------------------------------------------------- buttons -- */

    .au-primary-btn,
    .au-danger-btn,
    .au-ghost-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      height: 34px;
      padding: 0 16px;
      border-radius: var(--radius-md);
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s ease, border-color 0.15s ease;
    }

    .au-primary-btn {
      border: none;
      background: var(--accent-gradient);
      color: #ffffff;
    }

    .au-primary-btn:hover:not(:disabled) {
      background: var(--accent-gradient-hover);
    }

    .au-danger-btn {
      border: 1px solid rgba(239, 68, 68, 0.45);
      background-color: rgba(239, 68, 68, 0.14);
      color: #fca5a5;
    }

    .au-danger-btn:hover:not(:disabled) {
      background-color: rgba(239, 68, 68, 0.24);
    }

    .au-ghost-btn {
      background-color: transparent;
      border: 1px solid var(--border-card);
      color: var(--text-secondary);
    }

    .au-ghost-btn:hover:not(:disabled) {
      border-color: var(--accent-subtle-border);
      color: var(--text-primary);
    }

    .au-primary-btn:disabled,
    .au-danger-btn:disabled,
    .au-ghost-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    /* ------------------------------------------------------- pagination -- */

    .au-pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
      padding: 11px 14px;
      border-top: 1px solid var(--border-card);
    }

    .au-page-size {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 11.5px;
      color: var(--text-muted);
    }

    .au-page-size select {
      height: 28px;
      padding: 0 6px;
      border-radius: var(--radius-sm);
      background-color: var(--bg-input);
      border: 1px solid var(--border-card);
      color: var(--text-secondary);
      font-size: 11.5px;
      cursor: pointer;
    }

    .au-page-range {
      font-size: 11.5px;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    .au-pager {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .au-pager-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
      padding: 0 7px;
      border-radius: var(--radius-sm);
      border: 1px solid transparent;
      color: var(--text-secondary);
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      cursor: pointer;
    }

    .au-pager-btn:hover:not(:disabled) {
      background-color: var(--bg-card-active);
      color: var(--text-primary);
    }

    .au-pager-btn:disabled {
      opacity: 0.35;
      cursor: default;
    }

    .au-pager-current {
      background-color: rgba(34, 211, 238, 0.12);
      border-color: rgba(34, 211, 238, 0.4);
      color: #67e8f9;
      font-weight: 600;
    }

    .au-pager-gap {
      padding: 0 2px;
      color: var(--text-muted);
    }

    /* ------------------------------------------------- notices & states -- */

    .au-notice,
    .au-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 9px;
      padding: 44px 24px;
      text-align: center;
      color: var(--text-muted);
    }

    .au-notice {
      align-items: flex-start;
      text-align: left;
      padding: 28px 24px;
    }

    .au-notice h3,
    .au-empty h3 {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .au-notice p,
    .au-empty p {
      font-size: 13px;
      line-height: 1.6;
      max-width: 62ch;
    }

    .au-inline-error,
    .au-inline-warning {
      display: flex;
      align-items: flex-start;
      gap: 9px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      font-size: 12px;
      line-height: 1.55;
    }

    .au-inline-error {
      background-color: rgba(239, 68, 68, 0.09);
      border: 1px solid rgba(239, 68, 68, 0.28);
      color: #fca5a5;
    }

    .au-inline-warning {
      background-color: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.26);
      color: var(--status-beta);
    }

    .au-inline-error svg,
    .au-inline-warning svg {
      flex-shrink: 0;
      margin-top: 1px;
    }

    .au-toast {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 1200;
      max-width: 360px;
      padding: 12px 16px;
      border-radius: var(--radius-md);
      background-color: var(--bg-modal);
      border: 1px solid rgba(34, 197, 94, 0.35);
      box-shadow: var(--shadow-md);
      color: var(--text-primary);
      font-size: 12.5px;
    }

    /* ------------------------------------------------------- responsive -- */

    @media (max-width: 900px) {
      .au-facts { grid-template-columns: minmax(0, 1fr); }
      .au-table { min-width: 780px; }
    }

    @media (max-width: 640px) {
      .au-search { max-width: none; }
      .au-pagination { justify-content: center; }
    }
  `}</style>
);

export default AdminUsersPage;
