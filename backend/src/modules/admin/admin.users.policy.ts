/**
 * Guardrails for admin-on-admin actions.
 *
 * Pure functions, no database and no Express — so they can be unit tested and
 * so the frontend can mirror the same rules to pre-disable menu items. The
 * copy in the browser is a courtesy; these functions are the enforcement point
 * and every route calls them before touching a row.
 *
 * The policy is the "strict" one chosen on 2026-09-11:
 *   - only ADMIN may mutate; MODERATOR reads but never writes
 *   - nobody may change their own role or status
 *   - an ADMIN account cannot be deactivated by another admin
 *   - ADMIN and MODERATOR accounts cannot be impersonated
 */

import { GuardrailFailure, UserRoleValue, UserStatusValue } from './admin.users.types';

export interface PolicyActor {
  id: string;
  role: UserRoleValue;
}

export interface PolicyTarget {
  id: string;
  role: UserRoleValue;
}

function deny(code: GuardrailFailure['code'], message: string): GuardrailFailure {
  return { code, message };
}

/** Every write path starts here: MODERATOR can look, only ADMIN can touch. */
export function canMutate(actor: PolicyActor): GuardrailFailure | null {
  if (actor.role !== 'ADMIN') {
    return deny(
      'WRITE_REQUIRES_ADMIN',
      'Only an ADMIN can modify accounts. MODERATOR access is read-only.',
    );
  }
  return null;
}

/**
 * Role changes.
 *
 * Note what is deliberately *allowed*: demoting another ADMIN. Combined with
 * `canChangeStatus` refusing to deactivate an ADMIN, that leaves exactly one
 * route for removing a compromised admin — demote first, then suspend — and
 * both halves land in the audit log. Blocking this too would make an ADMIN
 * account permanently untouchable from the dashboard.
 */
export function canChangeRole(actor: PolicyActor, target: PolicyTarget): GuardrailFailure | null {
  const gate = canMutate(actor);
  if (gate) return gate;

  if (actor.id === target.id) {
    return deny('SELF_ROLE_CHANGE', 'You cannot change your own role. Ask another admin to do it.');
  }

  return null;
}

/** Status changes, including suspend and ban. */
export function canChangeStatus(
  actor: PolicyActor,
  target: PolicyTarget,
  nextStatus: UserStatusValue,
): GuardrailFailure | null {
  const gate = canMutate(actor);
  if (gate) return gate;

  if (actor.id === target.id) {
    return deny(
      'SELF_STATUS_CHANGE',
      'You cannot change your own status. This prevents locking yourself out.',
    );
  }

  // Any non-ACTIVE status is a deactivation; admins are shielded from all of
  // them. Reactivating a fellow admin stays allowed.
  if (target.role === 'ADMIN' && nextStatus !== 'ACTIVE') {
    return deny(
      'ADMIN_TARGET_STATUS',
      'An ADMIN account cannot be deactivated. Change their role first, then suspend.',
    );
  }

  return null;
}

/** Impersonation is the narrowest gate of the three. */
export function canImpersonate(actor: PolicyActor, target: PolicyTarget): GuardrailFailure | null {
  const gate = canMutate(actor);
  if (gate) return gate;

  if (actor.id === target.id) {
    return deny('SELF_IMPERSONATION', 'You are already signed in as this account.');
  }

  // Impersonating a peer would be a lateral privilege move that the audit
  // trail could not meaningfully constrain.
  if (target.role === 'ADMIN' || target.role === 'MODERATOR') {
    return deny(
      'IMPERSONATE_PRIVILEGED',
      'Accounts with ADMIN or MODERATOR access cannot be impersonated.',
    );
  }

  return null;
}

/**
 * Refuse a demotion that would leave the platform with no active admin.
 *
 * Needs a count the pure functions above cannot do, so the service supplies it.
 */
export function guardLastAdmin(
  target: PolicyTarget,
  nextRole: UserRoleValue,
  remainingActiveAdmins: number,
): GuardrailFailure | null {
  const isDemotingAnAdmin = target.role === 'ADMIN' && nextRole !== 'ADMIN';
  if (isDemotingAnAdmin && remainingActiveAdmins <= 1) {
    return deny(
      'LAST_ADMIN',
      'This is the last active ADMIN. Promote another account before demoting this one.',
    );
  }
  return null;
}
