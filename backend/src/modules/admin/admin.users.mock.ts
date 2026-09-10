/**
 * Deterministic sample users for when Postgres is unreachable.
 *
 * Same contract as admin.mock.ts: the same seed always produces the same
 * people, so a degraded dashboard is stable across refreshes instead of
 * reshuffling every poll. Filtering, sorting and pagination are applied in
 * memory here so the table still behaves correctly while degraded — the UI
 * shouldn't quietly lose its controls just because the database is down.
 *
 * Nothing here is ever writable. Mutations fail honestly when the database is
 * gone rather than pretending to suspend a person who doesn't exist.
 */

import { seededUnit } from './admin.mock';
import {
  AdminUserList,
  AdminUserListQuery,
  AdminUserRow,
  UserRoleValue,
  UserStatusValue,
} from './admin.users.types';

const FIRST_NAMES = [
  'Ama',
  'Bilal',
  'Chen',
  'Dara',
  'Elif',
  'Farid',
  'Grace',
  'Hana',
  'Ines',
  'Jonas',
  'Kwame',
  'Lena',
  'Mateo',
  'Nadia',
  'Omar',
  'Priya',
  'Rosa',
  'Sami',
  'Tariq',
  'Yuki',
];

const LAST_NAMES = [
  'Adeyemi',
  'Barros',
  'Cakir',
  'Duarte',
  'Eriksen',
  'Farooq',
  'Gonzales',
  'Haddad',
  'Ibrahim',
  'Jensen',
  'Kaur',
  'Lindqvist',
  'Moreau',
  'Nakamura',
  'Okafor',
  'Pereira',
  'Quintana',
  'Rahman',
  'Silva',
  'Tanaka',
];

const COMPANIES = ['Northwind', 'Lumen Labs', 'Arcadia', 'Kestrel', 'Vantage', 'Brightpath'];

/** Weighted so the sample set looks like a real marketplace, not an even split. */
function roleForSeed(unit: number): UserRoleValue {
  if (unit < 0.02) return 'ADMIN';
  if (unit < 0.06) return 'MODERATOR';
  if (unit < 0.34) return 'PROVIDER';
  return 'USER';
}

function statusForSeed(unit: number): UserStatusValue {
  if (unit < 0.04) return 'BANNED';
  if (unit < 0.11) return 'SUSPENDED';
  if (unit < 0.2) return 'INACTIVE';
  return 'ACTIVE';
}

const TOTAL_MOCK_USERS = 87;

/**
 * The full sample population, built once per `now` bucket.
 *
 * `now` is quantised to the hour so repeated calls within the same hour return
 * identical joined/last-seen timestamps rather than drifting by milliseconds.
 */
export function buildMockUsers(now: Date = new Date()): AdminUserRow[] {
  const hourBucket = Math.floor(now.getTime() / 3_600_000);
  const users: AdminUserRow[] = [];

  for (let i = 0; i < TOTAL_MOCK_USERS; i += 1) {
    const seed = (i + 1) * 7919;
    const u1 = seededUnit(seed);
    const u2 = seededUnit(seed + 17);
    const u3 = seededUnit(seed + 41);
    const u4 = seededUnit(seed + 73);

    const first = FIRST_NAMES[Math.floor(u1 * FIRST_NAMES.length) % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor(u2 * LAST_NAMES.length) % LAST_NAMES.length];
    const role = roleForSeed(u3);
    const status = statusForSeed(u4);

    // Spread joins across roughly two years, newest first.
    const joinedDaysAgo = Math.floor(u1 * 720) + i;
    const joinedAt = new Date((hourBucket - joinedDaysAgo * 24) * 3_600_000);

    // A slice of accounts never verified their email — that's the derived
    // "Pending" filter, and it correlates with never having logged in.
    const isPendingVerification = u2 < 0.12;
    const lastLoginAt = isPendingVerification
      ? null
      : new Date((hourBucket - Math.floor(u3 * 480)) * 3_600_000).toISOString();

    const apisOwned = role === 'PROVIDER' ? Math.floor(u4 * 14) : Math.floor(u4 * 2);
    const apisSubscribed = Math.floor(u2 * 11);

    users.push({
      id: `mock-user-${String(i + 1).padStart(3, '0')}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@${COMPANIES[i % COMPANIES.length]
        .toLowerCase()
        .replace(/\s+/g, '')}.example`,
      avatarUrl: null,
      role,
      status,
      isPendingVerification,
      apisOwned,
      apisSubscribed,
      joinedAt: joinedAt.toISOString(),
      lastLoginAt,
    });
  }

  return users;
}

const SORTERS: Record<AdminUserListQuery['sort'], (a: AdminUserRow, b: AdminUserRow) => number> = {
  joined: (a, b) => a.joinedAt.localeCompare(b.joinedAt),
  name: (a, b) => a.name.localeCompare(b.name),
  email: (a, b) => a.email.localeCompare(b.email),
  role: (a, b) => a.role.localeCompare(b.role),
  status: (a, b) => a.status.localeCompare(b.status),
  apisOwned: (a, b) => a.apisOwned - b.apisOwned,
};

/** Apply the same filter/sort/page semantics the SQL path uses. */
export function buildMockUserList(
  query: AdminUserListQuery,
  degradedReason: string,
  now: Date = new Date(),
): AdminUserList {
  let rows = buildMockUsers(now);

  if (query.search) {
    const needle = query.search.toLowerCase();
    rows = rows.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle) ||
        row.id.toLowerCase().includes(needle),
    );
  }

  if (query.role) {
    rows = rows.filter((row) => row.role === query.role);
  }

  if (query.status === 'PENDING') {
    rows = rows.filter((row) => row.isPendingVerification);
  } else if (query.status) {
    rows = rows.filter((row) => row.status === query.status);
  }

  const sorted = [...rows].sort(SORTERS[query.sort]);
  if (query.direction === 'desc') sorted.reverse();

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.limit;

  return {
    users: sorted.slice(start, start + query.limit),
    meta: { page, limit: query.limit, total, totalPages },
    source: 'mock',
    degradedReason,
  };
}

/** Look up a single sample user, for the profile drawer while degraded. */
export function findMockUser(id: string, now: Date = new Date()): AdminUserRow | null {
  return buildMockUsers(now).find((row) => row.id === id) ?? null;
}
