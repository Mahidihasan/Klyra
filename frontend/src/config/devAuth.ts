/**
 * Temporary stand-in for the real auth session.
 *
 * The backend has no auth middleware yet, so protected endpoints accept
 * `?userId=<uuid>` in development. Every call site reads the id from here so
 * that when auth lands, only this file changes.
 *
 * Set it either way:
 *   1. frontend/.env.development  ->  VITE_DEV_USER_ID=<uuid>
 *   2. browser console            ->  localStorage.setItem('klyra-dev-user-id', '<uuid>')
 */
const ENV_USER_ID = import.meta.env.VITE_DEV_USER_ID as string | undefined;

export function getDevUserId(): string | null {
  if (ENV_USER_ID) {
    return ENV_USER_ID;
  }
  if (typeof window !== 'undefined') {
    return localStorage.getItem('klyra-dev-user-id');
  }
  return null;
}
