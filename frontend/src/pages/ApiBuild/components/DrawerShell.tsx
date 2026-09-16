import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Minimize2, Maximize2 } from 'lucide-react';

/**
 * Shared enterprise slide-over drawer shell.
 *
 * User control:
 *  - ESC / overlay click to close (suppressed while `lockClose` is set)
 *  - Width presets (S / M / L) plus a drag handle on the left edge for free resize
 *  - Width preference persists per drawer (localStorage, keyed by `storageKey`)
 *  - Body scroll locks while open; focus moves into the panel and is restored on close
 *  - Tab is trapped inside the dialog while it is open
 *
 * Theme: uses the existing kly-* CSS variables from styles-professional.css.
 */
export const DrawerShell: React.FC<{
  open: boolean;
  onClose: () => void;
  /** Primary heading — string or custom node (badges, method tags…). */
  title: React.ReactNode;
  /** Secondary line under the title. */
  subtitle?: React.ReactNode;
  /** Optional row rendered directly under the header (action buttons, tabs…). */
  toolbar?: React.ReactNode;
  /** Optional pinned footer. */
  footer?: React.ReactNode;
  /** When true, ESC / overlay click do not close (e.g. unsaved form). */
  lockClose?: boolean;
  /** localStorage key used to remember the user's width choice. */
  storageKey?: string;
  /** Accessible name for the dialog when `title` is a custom node. */
  ariaLabel?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, subtitle, toolbar, footer, lockClose = false, storageKey, ariaLabel, children }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const WIDTHS = { s: 480, m: 680, l: 900 } as const;
  const SIZE_ORDER: (keyof typeof WIDTHS)[] = ['s', 'm', 'l'];
  const [size, setSize] = useState<keyof typeof WIDTHS>('m');
  const [customWidth, setCustomWidth] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // Restore the user's last width for this drawer.
  useEffect(() => {
    if (!open || !storageKey) return;
    try {
      const saved = localStorage.getItem(`kly-drawer-w:${storageKey}`);
      if (saved) {
        const parsed = JSON.parse(saved) as { size?: keyof typeof WIDTHS; width?: number };
        if (parsed.size && parsed.size in WIDTHS) setSize(parsed.size);
        setCustomWidth(typeof parsed.width === 'number' ? parsed.width : null);
      } else {
        setSize('m');
        setCustomWidth(null);
      }
    } catch { /* ignore corrupt prefs */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, storageKey]);

  const persist = useCallback((nextSize: keyof typeof WIDTHS, nextWidth: number | null) => {
    if (!storageKey) return;
    try { localStorage.setItem(`kly-drawer-w:${storageKey}`, JSON.stringify({ size: nextSize, width: nextWidth })); } catch { /* ignore */ }
  }, [storageKey]);

  const applySize = (next: keyof typeof WIDTHS) => {
    setSize(next);
    setCustomWidth(null);
    persist(next, null);
    setDragging(false);
  };

  // ESC to close + focus trap + body scroll lock + focus restore.
  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lockClose) { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose, lockClose]);

  // Drag-to-resize from the left edge (clamped: smallest preset → generous max).
  const onDragStart = (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const w = Math.round(window.innerWidth - e.clientX);
      const max = Math.min(window.innerWidth - 24, WIDTHS.l * 1.4);
      setCustomWidth(Math.max(WIDTHS.s, Math.min(max, w)));
    };
    const onUp = () => {
      setDragging(false);
      setCustomWidth((w) => {
        // Snap to the closest preset when within 28px, otherwise keep the free width.
        const snap = w != null ? SIZE_ORDER.find((s) => Math.abs(WIDTHS[s] - w) <= 28) : undefined;
        if (snap) setSize(snap);
        persist(snap ?? size, snap ? null : w ?? null);
        return snap ? null : w;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, persist, size]);

  if (!open) return null;

  const width = customWidth ?? WIDTHS[size];

  return (
    <div
      className={`kly-drawer-overlay${dragging ? ' dragging' : ''}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !lockClose) onClose(); }}
    >
      <div
        ref={panelRef}
        className="kly-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
        tabIndex={-1}
        style={{ width, maxWidth: '100vw', outline: 'none' }}
      >
        {/* Drag handle — grab to resize the drawer */}
        <div className="kly-drawer-resize" onPointerDown={onDragStart} title="Drag to resize" aria-hidden="true" />

        {/* Header */}
        <div className="kly-drawer-head">
          <div className="kly-drawer-head-info">
            <div className="kly-drawer-title-row">{title}</div>
            {subtitle && <div className="kly-drawer-subtitle">{subtitle}</div>}
          </div>
          <div className="kly-drawer-head-tools">
            <button
              type="button"
              className="kly-btn-icon kly-drawer-close"
              onClick={onClose}
              title={lockClose ? 'Close' : 'Close (Esc)'}
              aria-label="Close panel"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {toolbar && <div className="kly-drawer-toolbar">{toolbar}</div>}

        <div className="kly-drawer-body">{children}</div>

        {footer && <div className="kly-drawer-foot">{footer}</div>}
      </div>
    </div>
  );
};
