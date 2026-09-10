/**
 * Admin impersonation session handling.
 *
 * Impersonation swaps the tokens in localStorage and reloads, rather than
 * threading a "pretend to be this user" flag through every context and request.
 * A reload is the only way to be certain that nothing left in memory — a cached
 * profile, an in-flight request, a memoised permission check — is still acting
 * with the admin's rights while the screen claims to be someone else.
 *
 * The admin's own tokens are parked in a single stash key and put back on exit.
 * The refresh token is deliberately removed for the duration: leaving it in
 * place would let a 401 silently mint a fresh *admin* access token underneath an
 * impersonated session, which is the worst possible outcome — full privileges
 * behind a banner insisting you have none.
 */

import { ImpersonationGrant } from '../types/adminUsers';

const STASH_KEY = 'klyra_impersonation';
const ACCESS_KEY = 'klyra_access_token';
const REFRESH_KEY = 'klyra_refresh_token';
const USER_KEY = 'klyra_user';

export interface ImpersonationSession {
  expiresAt: string;
  target: ImpersonationGrant['target'];
  issuedBy: ImpersonationGrant['issuedBy'];
  /** The admin's own session, verbatim, to be restored on exit. */
  restore: {
    accessToken: string | null;
    refreshToken: string | null;
    user: string | null;
  };
}

function readStash(): ImpersonationSession | null {
  const raw = localStorage.getItem(STASH_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ImpersonationSession;
    if (!parsed?.expiresAt || !parsed?.target?.id || !parsed?.restore) return null;
    return parsed;
  } catch {
    // A corrupt stash is worse than none: it would strand the admin in a
    // session they can't exit. Drop it and let them sign in again.
    localStorage.removeItem(STASH_KEY);
    return null;
  }
}

export function getImpersonationSession(): ImpersonationSession | null {
  return readStash();
}

export function isExpired(session: ImpersonationSession): boolean {
  const expiry = new Date(session.expiresAt).getTime();
  return Number.isNaN(expiry) || expiry <= Date.now();
}

/** Milliseconds until the grant lapses; never negative. */
export function millisecondsRemaining(session: ImpersonationSession): number {
  const expiry = new Date(session.expiresAt).getTime();
  if (Number.isNaN(expiry)) return 0;
  return Math.max(0, expiry - Date.now());
}

/**
 * Swap into the impersonated session. The caller reloads afterwards.
 *
 * Refuses to start a second impersonation on top of a first: nesting would
 * overwrite the stashed admin session with an impersonated one, and exiting
 * would then restore a user rather than the operator.
 */
export function beginImpersonation(grant: ImpersonationGrant): void {
  if (readStash()) {
    throw new Error('Already impersonating. Exit the current session first.');
  }

  const session: ImpersonationSession = {
    expiresAt: grant.expiresAt,
    target: grant.target,
    issuedBy: grant.issuedBy,
    restore: {
      accessToken: localStorage.getItem(ACCESS_KEY),
      refreshToken: localStorage.getItem(REFRESH_KEY),
      user: localStorage.getItem(USER_KEY),
    },
  };

  localStorage.setItem(STASH_KEY, JSON.stringify(session));
  localStorage.setItem(ACCESS_KEY, grant.accessToken);
  localStorage.removeItem(REFRESH_KEY);

  // Seed the cached profile so the first paint after reload shows the target
  // rather than flashing the admin's name.
  localStorage.setItem(
    USER_KEY,
    JSON.stringify({
      id: grant.target.id,
      name: grant.target.name,
      email: grant.target.email,
      role: grant.target.role,
    }),
  );

  // The saved tab belongs to the admin's navigation, not the target's, and
  // half of it is admin-only anyway.
  localStorage.setItem('activeTab', 'home');
}

/**
 * Put the admin's session back. Safe to call when nothing is stashed.
 *
 * Returns true if a session was actually restored, so the caller knows whether
 * a reload is warranted.
 */
export function endImpersonation(): boolean {
  const session = readStash();
  if (!session) return false;

  const { accessToken, refreshToken, user } = session.restore;

  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  else localStorage.removeItem(ACCESS_KEY);

  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  else localStorage.removeItem(REFRESH_KEY);

  if (user) localStorage.setItem(USER_KEY, user);
  else localStorage.removeItem(USER_KEY);

  localStorage.removeItem(STASH_KEY);
  localStorage.setItem('activeTab', 'admin-users');

  return true;
}
