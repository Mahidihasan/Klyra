/**
 * Resolves the id of the user whose data protected screens should display.
 *
 * Resolution order:
 *   1. Real auth session — the user id stored by AuthContext at login
 *      (`klyra_user` in localStorage).
 *   2. frontend/.env.development  ->  VITE_DEV_USER_ID=<uuid> (dev override).
 *   3. Legacy dev escape hatch — browser console:
 *      localStorage.setItem('klyra-dev-user-id', '<uuid>')
 *
 * TODO(auth): once every backend billing endpoint reads req.user from the JWT
 * (instead of ?userId=), this can be reduced to nothing and the query param
 * dropped from services/api/billing.ts.
 */
const ENV_USER_ID = import.meta.env.VITE_DEV_USER_ID as string | undefined;

export function getDevUserId(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Real auth session wins.
  try {
    const stored = localStorage.getItem('klyra_user');
    if (stored) {
      const user = JSON.parse(stored) as { id?: string };
      if (user?.id) return user.id;
    }
  } catch {
    // Malformed cached user — fall through to dev id.
  }

  // 2. Explicit dev override.
  if (ENV_USER_ID) {
    return ENV_USER_ID;
  }

  // 3. Legacy dev escape hatch.
  return localStorage.getItem('klyra-dev-user-id');
}
