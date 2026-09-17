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

/* ==========================================================================
 * Deploy timestamps (`api_build_deployments.deployed_at`)
 *
 * This column is `TIMESTAMPTZ NOT NULL DEFAULT NOW()`, so a deployment always
 * has a moment in time — but it reaches the workspace in three different
 * shapes, depending on where the row came from:
 *
 *   1. `String(r.deployed_at)` in api-build.service.ts. node-postgres hands the
 *      service a `Date`, so the API emits `Date#toString()` output:
 *      "Wed Aug 26 2026 09:14:00 GMT+0000 (Coordinated Universal Time)"
 *   2. ISO-8601, as produced by `mockProviderApi.ts`:
 *      "2026-08-26T09:14:00.000Z"
 *   3. The demo project in `dummyApi.ts`: "2026-08-26 09:14 UTC"
 *
 * The Release History table printed that string raw, so real projects rendered
 * ~50 characters of server-local noise in the Deployed column. Everything below
 * normalises the value to a real `Date` before formatting it.
 * ======================================================================== */

/** Pinned for the same reason as pages/AdminOverview/format.ts: a release list should not read differently per teammate. */
const LOCALE = 'en-US';

/** Shown when `deployed_at` is empty or in a shape no JS engine can parse. */
export const DEPLOY_TIME_FALLBACK = '—';

/**
 * Normalises any `deployed_at` shape to a `Date`, or `null` when the value
 * carries no usable moment in time.
 *
 * `new Date(value)` alone is not enough: the ES spec only guarantees parsing of
 * ISO-8601, while shape (1) is a legacy `toString()` format and shape (3) is not
 * ISO at all. Chrome/Firefox/Node accept both, Safari's stricter parser does
 * not, so the rewritten candidates below are what keep this working in every
 * browser instead of silently falling back to a raw string.
 */
const parseDeployedAt = (deployedAt: string | null | undefined): Date | null => {
  if (typeof deployedAt !== 'string') {
    return null;
  }
  const value = deployedAt.trim();
  if (!value) {
    return null;
  }

  const candidates = [
    value,
    // Drop the trailing zone name, e.g. "GMT+0000 (Coordinated Universal Time)"
    // -> "GMT+0000", which strict parsers understand.
    value.replace(/\s*\([^)]*\)\s*$/, ''),
    // Rebuild "2026-08-26 09:14 UTC" as "2026-08-26T09:14Z": ISO-8601, with the
    // seconds field optional per the Date Time String Format.
    value.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?) UTC$/, '$1T$2Z'),
  ];
  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return null;
};

/**
 * Compact release date for the Deployed column: `Aug 26` within the current
 * year, `Aug 26, 2025` once the release is older — the year is exactly what
 * disambiguates those rows, and dropping it from recent ones keeps this column
 * narrow in a nine-column table. Matches the `LOCALE` other format helpers in
 * the app pin (e.g. pages/AdminUsers/format.ts).
 *
 * Falls back to the raw `YYYY-MM-DD` prefix (`RELEASE_DATE_PREFIX`) before
 * giving up, so an unparseable value still shows its date half.
 */
export const deployedDateLabel = (deployedAt: string | null | undefined): string => {
  const date = parseDeployedAt(deployedAt);
  if (!date) {
    const raw = typeof deployedAt === 'string' ? deployedAt.trim() : '';
    return RELEASE_DATE_PREFIX.test(raw) ? raw.slice(0, 10) : DEPLOY_TIME_FALLBACK;
  }

  const options: Intl.DateTimeFormatOptions =
    date.getFullYear() === new Date().getFullYear()
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' };
  return date.toLocaleDateString(LOCALE, options);
};

/**
 * "just now", "12m ago", "3h ago", "5d ago", "3w ago", "2mo ago", "1y ago".
 *
 * pages/AdminOverview's `formatRelativeTime` stops after a week and returns a
 * calendar date; the calendar date is already rendered next to this label, so
 * the ladder keeps climbing through weeks/months/years instead of repeating
 * itself. Months count as 30 days and years as 365 — this is a scannability aid,
 * the exact instant lives in the tooltip.
 */
export const deployedRelativeLabel = (deployedAt: string | null | undefined): string => {
  const date = parseDeployedAt(deployedAt);
  if (!date) {
    return DEPLOY_TIME_FALLBACK;
  }

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  // Clock skew between the browser and Postgres can put a brand-new deploy a
  // second or two in the future; "just now" beats "-1s ago".
  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.round(days / 7);
  if (weeks < 5) {
    return `${weeks}w ago`;
  }

  const months = Math.round(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }

  return `${Math.round(days / 365)}y ago`;
};

/**
 * Full timestamp for the Deployed cell's `title` — the hover is where the
 * precision the column cannot fit is allowed to live, e.g.
 * "Aug 26, 2026, 09:14 AM UTC".
 *
 * Unparseable values are echoed back verbatim so a malformed row stays
 * inspectable on hover instead of hiding behind the fallback dash.
 */
export const deployedTooltipLabel = (deployedAt: string | null | undefined): string => {
  const date = parseDeployedAt(deployedAt);
  if (!date) {
    const raw = typeof deployedAt === 'string' ? deployedAt.trim() : '';
    return raw || DEPLOY_TIME_FALLBACK;
  }

  return date.toLocaleString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
};
