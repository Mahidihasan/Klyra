import React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, MoreHorizontal, CheckCircle, XCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

import { AdminApiRow, ApiSortField, SortDirection } from '../../types/adminApis';

interface Column {
  id: ApiSortField | 'owner' | 'category' | 'endpoints' | 'visibility' | 'actions';
  label: string;
  sortable: boolean;
  align?: 'end';
}

const COLUMNS: Column[] = [
  { id: 'name', label: 'API & Version', sortable: true },
  { id: 'owner', label: 'Owner', sortable: false },
  { id: 'category', label: 'Category', sortable: false },
  { id: 'endpoints', label: 'Endpoints', sortable: false, align: 'end' },
  { id: 'totalRequests', label: 'Daily Reqs', sortable: true, align: 'end' },
  { id: 'rating', label: 'Health', sortable: true },
  { id: 'status', label: 'Status', sortable: true },
  { id: 'visibility', label: 'Visibility', sortable: false },
  { id: 'actions', label: '', sortable: false },
];

export type ApiAction = 'review' | 'approve' | 'reject' | 'deprecate';

interface Props {
  apis: AdminApiRow[];
  sort: ApiSortField;
  direction: SortDirection;
  onSortChange: (field: ApiSortField) => void;
  onAction: (action: ApiAction, api: AdminApiRow) => void;
  isRefreshing?: boolean;
}

export const ApiTable: React.FC<Props> = ({
  apis,
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
                    onClick={() => onSortChange(column.id as ApiSortField)}
                  >
                    <span>{column.label}</span>
                    <SortIcon size={12} aria-hidden="true" />
                  </button>
                ) : (
                  <span>{column.label}</span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>

      <tbody>
        {apis.map((api) => (
          <tr key={api.id}>
            <td>
              <div className="au-identity">
                {api.logoUrl ? (
                  <img src={api.logoUrl} alt="" className="au-avatar-img" />
                ) : (
                  <div className="au-avatar-fallback">{api.name.charAt(0).toUpperCase()}</div>
                )}
                <span className="au-identity-text">
                  <span className="au-name">{api.name}</span>
                  <span className="au-last-seen">v{api.currentVersion}</span>
                </span>
              </div>
            </td>

            <td>
              <div className="au-identity" style={{ gap: '8px' }}>
                {api.ownerAvatarUrl ? (
                  <img src={api.ownerAvatarUrl} alt="" className="au-avatar-img" style={{ width: 24, height: 24 }} />
                ) : (
                  <div className="au-avatar-fallback" style={{ width: 24, height: 24, fontSize: 10 }}>
                    {api.ownerName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="au-name" style={{ fontSize: 12 }}>{api.ownerName}</span>
              </div>
            </td>

            <td>
              <span className="au-joined">{api.categoryName || 'Uncategorized'}</span>
            </td>

            <td data-align="end">
              <span className="au-name">{api.endpointsCount}</span>
            </td>

            <td data-align="end">
              <span className="au-name">{api.dailyRequestCount.toLocaleString()}</span>
            </td>

            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '40px', height: '4px', background: 'var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: \`\${api.healthScore}%\`, height: '100%', background: api.healthScore > 70 ? 'var(--status-active)' : api.healthScore > 40 ? 'var(--status-beta)' : 'var(--status-error)' }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round(api.healthScore)}</span>
              </div>
            </td>

            <td>
              <span
                className="au-badge"
                data-status={
                  api.status === 'PUBLISHED' ? 'active' :
                  api.status === 'PENDING' ? 'beta' :
                  api.status === 'REJECTED' ? 'error' : 'offline'
                }
              >
                {api.status}
              </span>
            </td>

            <td>
               <span className="au-joined" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {api.isDeprecated ? (
                  <><AlertCircle size={12} color="var(--status-error)" /> Deprecated</>
                ) : api.isPublic ? (
                  <><Eye size={12} /> Public</>
                ) : (
                  <><EyeOff size={12} /> Private</>
                )}
              </span>
            </td>

            <td data-align="end">
              <button
                className="au-ghost-btn"
                onClick={() => onAction('review', api)}
                style={{ padding: '4px 8px', fontSize: '11px', height: '26px' }}
              >
                Review
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const ApiTableSkeleton: React.FC<{ rows?: number }> = ({ rows = 8 }) => (
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
