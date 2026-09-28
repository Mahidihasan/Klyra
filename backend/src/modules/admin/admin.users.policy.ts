/**
 * Guardrails for admin-on-admin actions.
 *
 * Pure functions, no database and no Express — so they can be unit tested and
 * so the frontend can mirror the same rules to pre-disable menu items. The
 * copy in the browser is a courtesy; these functions are the enforcement point
 * and every route calls them before touching a row.
 *
 * The policy is the "strict" one chosen on 2026-09-11:
 *   - only SUPER_ADMIN and ADMIN may mutate; USER reads but never writes
 *   - nobody may change their own role or status
 *   - an ADMIN/SUPER_ADMIN account cannot be deactivated by another admin
 *   - ADMIN and SUPER_ADMIN accounts cannot be impersonated
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

/** Every write path starts here: only SUPER_ADMIN and ADMIN can touch. */
export function canMutate(actor: PolicyActor): GuardrailFailure | null {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(actor.role)) {
    return deny(
      'WRITE_REQUIRES_ADMIN',
      'Only SUPER_ADMIN or ADMIN can modify accounts.',
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
  if (['SUPER_ADMIN', 'ADMIN'].includes(target.role) && nextStatus !== 'ACTIVE') {
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
  if (['SUPER_ADMIN', 'ADMIN'].includes(target.role)) {
    return deny(
      'IMPERSONATE_PRIVILEGED',
      'Accounts with ADMIN or SUPER_ADMIN access cannot be impersonated.',
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
  const isDemotingAnAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(target.role) && !['SUPER_ADMIN', 'ADMIN'].includes(nextRole);
  if (isDemotingAnAdmin && remainingActiveAdmins <= 1) {
    return deny(
      'LAST_ADMIN',
      'This is the last active ADMIN. Promote another account before demoting this one.',
    );
  }
  return null;
}

export function canDeleteUser(actor: PolicyActor, target: PolicyTarget): GuardrailFailure | null {
  const gate = canMutate(actor);
  if (gate) return gate;

  if (actor.id === target.id) {
    return deny('SELF_DELETE', 'You cannot delete your own account.');
  }

  // Admins cannot be deleted without being demoted first, similar to status changes.
  if (['SUPER_ADMIN', 'ADMIN'].includes(target.role)) {
    return deny('ADMIN_TARGET_STATUS', 'An ADMIN account cannot be deleted. Change their role first.');
  }

  return null;
}

export function canEditUser(actor: PolicyActor, target: PolicyTarget): GuardrailFailure | null {
  const gate = canMutate(actor);
  if (gate) return gate;

  if (actor.role === 'ADMIN' && target.role === 'SUPER_ADMIN') {
    return deny('ADMIN_TARGET_ROLE', 'Access Denied: You cannot modify a SUPER_ADMIN.');
  }

  return null;
}
