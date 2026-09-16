/**
 * Formatting helpers for the API Build workspace.
 *
 * Release dates come from `api_build_versions.released_at`, which is nullable by
 * design: the schema declares `released_at TIMESTAMPTZ` (no NOT NULL) and
 * `ensureProjectDefaults()` seeds every project with a `v1.0.0` draft row that
 * has never been released. The backend therefore returns `releasedAt: null`
 * (`VersionRow.releasedAt` is `string | null`), so UI code must never assume a
 * string. Doing so crashed the Versions/Development tabs with:
 *   TypeError: Cannot read properties of null (reading 'slice')
 */

/** Matches the `YYYY-MM-DD` prefix of an ISO/Postgres timestamp. */
const RELEASE_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

/** Shown for drafts/imports whose release date is missing or malformed. */
export const UNRELEASED_LABEL = 'not released yet';

/**
 * Renders a nullable version release timestamp as an inline status phrase —
 * `released 2026-03-11` for published rows, `not released yet` for drafts.
 * Safe for `null`, `undefined`, `''` and malformed values.
 */
export const releaseStatusLabel = (releasedAt: string | null | undefined): string => {
  if (typeof releasedAt !== 'string') {
    return UNRELEASED_LABEL;
  }
  const value = releasedAt.trim();
  if (!RELEASE_DATE_PREFIX.test(value)) {
    return UNRELEASED_LABEL;
  }
  return `released ${value.slice(0, 10)}`;
};
