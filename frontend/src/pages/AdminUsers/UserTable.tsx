/**
 * The users data table.
 *
 * Purely presentational: it renders whatever page of rows it's handed and
 * reports clicks upward. All fetching, filtering and paging state lives in the
 * page so the table can't disagree with the controls above it.
 */

import React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

import { AdminUserRow, SortDirection, UserSortField, ViewerIdentity } from '../../types/adminUsers';

import { formatJoinedDate, formatLastSeen } from './format';
import { CountPair, RoleBadge, StatusBadge, SubscriptionTierBadge, UserAvatar } from './UserBadges';
import { UserAction, UserActionMenu } from './UserActionMenu';

interface Column {
  id: UserSortField | 'apis' | 'actions' | 'plan';
  label: string;
  sortable: boolean;
  /** Right-aligned numeric columns read better against the value, not the edge. */
  align?: 'end';
}

const COLUMNS: Column[] = [
  { id: 'name', label: 'User', sortable: true },
  { id: 'email', label: 'Email', sortable: true },
  { id: 'role', label: 'Role', sortable: true },
  { id: 'plan', label: 'Plan', sortable: false },
  { id: 'apisOwned', label: 'APIs owned / subscribed', sortable: true, align: 'end' },
  { id: 'joined', label: 'Joined', sortable: true },
  { id: 'status', label: 'Status', sortable: true },
  { id: 'actions', label: '', sortable: false },
];

interface Props {
  users: AdminUserRow[];
  viewer: ViewerIdentity;
  sort: UserSortField;
  direction: SortDirection;
  onSortChange: (field: UserSortField) => void;
  onAction: (action: UserAction, user: AdminUserRow) => void;
  /** Dims the body during a background refresh without collapsing the layout. */
  isRefreshing?: boolean;
}

export const UserTable: React.FC<Props> = ({
  users,
  viewer,
  sort,
  direction,
  onSortChange,
  onAction,
  isRefreshing,
}) => (
  <div className="au-table-scroll">
    <table className="au-table" data-refreshing={isRefreshing ? 'true' : undefined}>
      <thead>
        <tr>
          {COLUMNS.map((column) => {
            const isSorted = column.sortable && column.id === sort;
            const SortIcon = !isSorted ? ChevronsUpDown : direction === 'asc' ? ArrowUp : ArrowDown;

            return (
              <th
                key={column.id}
                scope="col"
                data-align={column.align}
                aria-sort={
                  isSorted ? (direction === 'asc' ? 'ascending' : 'descending') : undefined
                }
              >
                {column.sortable ? (
                  <button
                    type="button"
                    className={isSorted ? 'au-sort au-sort-active' : 'au-sort'}
                    onClick={() => onSortChange(column.id as UserSortField)}
                  >
                    <span>{column.label}</span>
                    <SortIcon size={12} aria-hidden="true" />
                  </button>
                ) : (
                  <span className="au-sr-only">Actions</span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>

      <tbody>
        {users.map((user) => (
          <tr key={user.id}>
            <td>
              <button
                type="button"
                className="au-identity"
                onClick={() => onAction('view', user)}
                title={`Open ${user.name}'s profile`}
              >
                <UserAvatar user={user} />
                <span className="au-identity-text">
                  <span className="au-name">{user.name || 'Unnamed account'}</span>
                  <span className="au-last-seen">{formatLastSeen(user.lastLoginAt)}</span>
                </span>
              </button>
            </td>

            <td>
              <span className="au-email" title={user.email}>
                {user.email}
              </span>
            </td>

            <td>
              <RoleBadge role={user.role} />
            </td>

            <td>
              <SubscriptionTierBadge tier={user.subscriptionTier} />
            </td>

            <td data-align="end">
              <CountPair owned={user.apisOwned} subscribed={user.apisSubscribed} />
            </td>

            <td>
              <span className="au-joined">{formatJoinedDate(user.joinedAt)}</span>
            </td>

            <td>
              <StatusBadge
                status={user.status}
                isPendingVerification={user.isPendingVerification}
              />
            </td>

            <td data-align="end">
              <UserActionMenu user={user} viewer={viewer} onAction={onAction} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** Placeholder rows sized to the real ones, so the table doesn't jump on load. */
export const UserTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 8 }) => (
  <div className="au-table-scroll">
    <table className="au-table">
      <thead>
        <tr>
          {COLUMNS.map((column) => (
            <th key={column.id} scope="col" data-align={column.align}>
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }, (_, index) => (
          <tr key={index} aria-hidden="true">
            {COLUMNS.map((column) => (
              <td key={column.id}>
                <span className="au-skeleton" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
