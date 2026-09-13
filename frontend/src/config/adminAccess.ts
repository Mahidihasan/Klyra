/**
 * Who may see the admin screens in the client.
 *
 * This is presentation only — it decides whether the ADMIN nav section is
 * rendered. The real gate lives in backend/src/modules/admin/admin.routes.ts,
 * which checks the role on the JWT and answers 403 regardless of what the
 * browser believes. Keep the two role lists in step.
 */

/** Mirrors ADMIN_ROLES in backend/src/modules/admin/admin.routes.ts. */
const ADMIN_ROLES = new Set(['ADMIN', 'MODERATOR']);

export function isAdminRole(role?: string | null): boolean {
  return Boolean(role && ADMIN_ROLES.has(role.toUpperCase()));
}

/**
 * Dev-only escape hatch, matching the one in services/api/admin.ts so the
 * screen can be previewed before an admin account exists locally:
 *
 *   localStorage.setItem('klyra-dev-role', 'ADMIN')
 *
 * `import.meta.env.DEV` is false in any production build, so this branch is
 * dropped at build time rather than shipped and trusted.
 */
function getDevAdminRole(): string | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  return localStorage.getItem('klyra-dev-role');
}

/** True when the admin navigation should be offered to this user. */
export function hasAdminAccess(role?: string | null): boolean {
  return isAdminRole(role) || isAdminRole(getDevAdminRole());
}
