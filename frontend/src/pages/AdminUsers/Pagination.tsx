/**
 * Pagination footer for the users table.
 *
 * Shows a windowed page list rather than every page number: with a few thousand
 * accounts the full list is unusable, and the useful jumps are first, last, and
 * a couple either side of where you are.
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { PaginationMeta } from '../../types/adminUsers';

/** Pages shown either side of the current one before falling back to an ellipsis. */
const WINDOW = 1;

/** Page-size options. 25 is the default; 100 matches the server's own ceiling. */
const PAGE_SIZES = [25, 50, 100];

type PageItem = number | 'gap-start' | 'gap-end';

export function buildPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 1) return [1];

  const pages = new Set<number>([1, totalPages]);
  for (let candidate = page - WINDOW; candidate <= page + WINDOW; candidate += 1) {
    if (candidate >= 1 && candidate <= totalPages) pages.add(candidate);
  }

  const ordered = Array.from(pages).sort((a, b) => a - b);
  const items: PageItem[] = [];

  ordered.forEach((value, index) => {
    const previous = ordered[index - 1];
    if (previous !== undefined && value - previous > 1) {
      // Two distinct keys so React never sees duplicate ellipsis siblings.
      items.push(value > page ? 'gap-end' : 'gap-start');
    }
    items.push(value);
  });

  return items;
}

interface Props {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  isBusy: boolean;
}

export const Pagination: React.FC<Props> = ({ meta, onPageChange, onLimitChange, isBusy }) => {
  const { page, limit, total, totalPages } = meta;

  const firstRow = total === 0 ? 0 : (page - 1) * limit + 1;
  const lastRow = Math.min(page * limit, total);

  return (
    <div className="au-pagination">
      <div className="au-page-size">
        <label htmlFor="au-limit">Rows</label>
        <select
          id="au-limit"
          value={limit}
          disabled={isBusy}
          onChange={(event) => onLimitChange(Number(event.target.value))}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <p className="au-page-range">
        {total === 0 ? 'No results' : `${firstRow}–${lastRow} of ${total.toLocaleString('en-US')}`}
      </p>

      <nav className="au-pager" aria-label="Pagination">
        <button
          type="button"
          className="au-pager-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || isBusy}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} aria-hidden="true" />
        </button>

        {buildPageItems(page, totalPages).map((item) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              className={item === page ? 'au-pager-btn au-pager-current' : 'au-pager-btn'}
              onClick={() => onPageChange(item)}
              disabled={isBusy}
              aria-current={item === page ? 'page' : undefined}
            >
              {item}
            </button>
          ) : (
            <span key={item} className="au-pager-gap" aria-hidden="true">
              …
            </span>
          ),
        )}

        <button
          type="button"
          className="au-pager-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages || isBusy}
          aria-label="Next page"
        >
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
};
