/**
 * Per-row action menu.
 *
 * Items that the viewer isn't allowed to use are rendered disabled with the
 * reason attached, rather than hidden. Hiding them makes the UI look different
 * for different admins with no explanation; showing a greyed item with "You
 * cannot change your own role" teaches the rule in one glance.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Ban,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  UserCog,
  Eye,
} from 'lucide-react';

import {
  AdminUserRow,
  canChangeRole,
  canChangeStatus,
  canImpersonate,
  GuardCheck,
  ViewerIdentity,
} from '../../types/adminUsers';

export type UserAction = 'view' | 'role' | 'suspend' | 'ban' | 'reactivate' | 'impersonate';

interface MenuItem {
  id: UserAction;
  label: string;
  icon: React.ComponentType<{ size?: number | string }>;
  guard: GuardCheck;
  danger?: boolean;
}

interface Props {
  user: AdminUserRow;
  viewer: ViewerIdentity;
  onAction: (action: UserAction, user: AdminUserRow) => void;
}

const ALWAYS_ALLOWED: GuardCheck = { allowed: true };

export const UserActionMenu: React.FC<Props> = ({ user, viewer, onAction }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => setIsOpen(false), []);

  // Close on an outside click or Escape. Without the pointerdown listener the
  // menu survives clicks on other rows and two can be open at once.
  useEffect(() => {
    if (!isOpen) return undefined;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, close]);

  const isDeactivated = user.status !== 'ACTIVE';

  const items: MenuItem[] = [
    { id: 'view', label: 'View profile', icon: Eye, guard: ALWAYS_ALLOWED },
    { id: 'role', label: 'Change role', icon: UserCog, guard: canChangeRole(viewer, user) },
    {
      id: 'impersonate',
      label: 'Impersonate',
      icon: ShieldCheck,
      guard: canImpersonate(viewer, user),
    },
  ];

  if (isDeactivated) {
    items.push({
      id: 'reactivate',
      label: 'Reactivate',
      icon: PlayCircle,
      guard: canChangeStatus(viewer, user, 'ACTIVE'),
    });
  } else {
    items.push({
      id: 'suspend',
      label: 'Suspend',
      icon: PauseCircle,
      guard: canChangeStatus(viewer, user, 'SUSPENDED'),
      danger: true,
    });
  }

  if (user.status !== 'BANNED') {
    items.push({
      id: 'ban',
      label: 'Ban permanently',
      icon: Ban,
      guard: canChangeStatus(viewer, user, 'BANNED'),
      danger: true,
    });
  }

  return (
    <div className="au-menu-wrap" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="au-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Actions for ${user.name}`}
        onClick={() => setIsOpen((open) => !open)}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="au-menu" role="menu">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                className={item.danger ? 'au-menu-item au-menu-danger' : 'au-menu-item'}
                disabled={!item.guard.allowed}
                title={item.guard.reason}
                onClick={() => {
                  close();
                  onAction(item.id, user);
                }}
              >
                <Icon size={14} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
