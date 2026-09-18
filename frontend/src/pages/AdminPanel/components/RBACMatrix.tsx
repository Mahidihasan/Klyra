import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Save, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Data ────────────────────────────────────────────────────────────────────

const PERMISSIONS = [
  { id: 'view_dashboard',  label: 'View Analytics Dashboard',    category: 'General'         },
  { id: 'view_revenue',    label: 'View Financial Data',         category: 'General'         },
  { id: 'manage_users',    label: 'Suspend / Ban Users',         category: 'User Management' },
  { id: 'manage_roles',    label: 'Assign Roles & Tiers',        category: 'User Management' },
  { id: 'impersonate',     label: 'Impersonate Users',           category: 'User Management' },
  { id: 'approve_apis',    label: 'Approve / Reject APIs',       category: 'API Management'  },
  { id: 'delete_apis',     label: 'Deprecate / Delete APIs',     category: 'API Management'  },
  { id: 'curate_market',   label: 'Curate Marketplace Featured', category: 'API Management'  },
  { id: 'manage_gateway',  label: 'Configure Gateway Limits',    category: 'Security'        },
  { id: 'revoke_keys',     label: 'Revoke API Keys',             category: 'Security'        },
  { id: 'view_logs',       label: 'View Security Logs',          category: 'Security'        },
  { id: 'manage_billing',  label: 'Process Refunds',             category: 'Billing'         },
  { id: 'manage_plans',    label: 'Edit Subscription Plans',     category: 'Billing'         },
];

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'USER'] as const;

type Role = typeof ROLES[number];

const INITIAL_MATRIX: Record<Role, Record<string, boolean>> = {
  'SUPER_ADMIN': PERMISSIONS.reduce((a, p) => ({ ...a, [p.id]: true }), {}),
  'ADMIN':       {},
  'USER':        {},
};

const ROLE_COLORS: Record<Role, string> = {
  'SUPER_ADMIN': 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  'ADMIN':       'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  'USER':        'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

const CATEGORIES = Array.from(new Set(PERMISSIONS.map(p => p.category)));

// ─── NeonToggle ───────────────────────────────────────────────────────────────

const NeonToggle = ({ enabled, onToggle, locked }: { enabled: boolean; onToggle: () => void; locked?: boolean }) => (
  <div
    role="switch"
    aria-checked={enabled}
    onClick={locked ? undefined : onToggle}
    className={`relative w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${
      locked    ? 'opacity-40 cursor-not-allowed' :
      enabled   ? 'bg-indigo-500 cursor-pointer shadow-[0_0_16px_rgba(99,102,241,0.55)]' :
                  'bg-white/10 cursor-pointer hover:bg-white/15'
    }`}
  >
    <motion.div
      layout
      animate={{ x: enabled ? 16 : 0 }}
      transition={{ type: 'spring', stiffness: 600, damping: 35 }}
      className={`w-4 h-4 rounded-full shadow-md ${enabled && !locked ? 'bg-white' : 'bg-white/60'}`}
    />
  </div>
);

// ─── CrosshairCell ────────────────────────────────────────────────────────────

const CrosshairCell = ({
  row, col, hoveredRow, hoveredCol, setHover, children,
}: {
  row: number; col: number;
  hoveredRow: number | null; hoveredCol: number | null;
  setHover: (r: number | null, c: number | null) => void;
  children: React.ReactNode;
}) => {
  const isRowHighlighted = hoveredRow === row;
  const isColHighlighted = hoveredCol === col;
  const isIntersection   = isRowHighlighted && isColHighlighted;

  return (
    <td
      onMouseEnter={() => setHover(row, col)}
      onMouseLeave={() => setHover(null, null)}
      className={`transition-colors duration-100 text-center px-4 py-3 ${
        isIntersection   ? 'bg-indigo-500/15' :
        isRowHighlighted ? 'bg-white/[0.03]' :
        isColHighlighted ? 'bg-white/[0.025]' :
        ''
      }`}
    >
      {children}
    </td>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const RBACMatrix = () => {
  const [matrix, setMatrix]     = useState<Record<Role, Record<string, boolean>>>(INITIAL_MATRIX);
  const [original, setOriginal] = useState<Record<Role, Record<string, boolean>>>(INITIAL_MATRIX);
  const [pending, setPending]   = useState<Set<string>>(new Set());
  const [hoveredRow, setRow]    = useState<number | null>(null);
  const [hoveredCol, setCol]    = useState<number | null>(null);
  
  useEffect(() => {
    const fetchMatrix = async () => {
      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        const res = await fetch('/api/v1/admin/rbac/roles', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const fetchedMatrix: any = { ...INITIAL_MATRIX };
          data.data.forEach((item: any) => {
            const r = item.role;
            if (fetchedMatrix[r]) {
              item.permissions.forEach((p: string) => {
                if (p === '*') {
                  PERMISSIONS.forEach(perm => fetchedMatrix[r][perm.id] = true);
                } else {
                  fetchedMatrix[r][p] = true;
                }
              });
            }
          });
          setMatrix(fetchedMatrix);
          setOriginal(fetchedMatrix);
        }
      } catch (err) {
        console.error('Failed to fetch RBAC matrix', err);
      }
    };
    fetchMatrix();
  }, []);

  const setHover = useCallback((r: number | null, c: number | null) => {
    setRow(r); setCol(c);
  }, []);

  const togglePermission = (role: Role, permId: string) => {
    if (role === 'SUPER_ADMIN') return;
    const key = `${role}::${permId}`;
    const newVal = !matrix[role]?.[permId];

    setMatrix(prev => ({
      ...prev,
      [role]: { ...prev[role], [permId]: newVal },
    }));

    setPending(prev => {
      const next = new Set(prev);
      // If toggled back to original, remove from pending
      if (newVal === original[role]?.[permId]) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const discardChanges = () => {
    setMatrix(INITIAL_MATRIX);
    setPending(new Set());
  };

  const saveChanges = async () => {
    try {
      const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
      const updates = ROLES.map(role => {
        const perms = PERMISSIONS.filter(p => matrix[role]?.[p.id]).map(p => p.id);
        if (role === 'SUPER_ADMIN') perms.push('*');
        return { role, permissions: perms };
      });
      const res = await fetch('/api/v1/admin/rbac/roles', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ updates })
      });
      if (res.ok) {
        setPending(new Set());
        setOriginal(matrix);
        import('react-hot-toast').then(m => m.default.success('RBAC updated successfully'));
      }
    } catch (err) {
      console.error('Failed to save changes', err);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-32 relative">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck size={22} className="text-indigo-400" />
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">RBAC Permission Matrix</h2>
          <p className="text-[13px] text-white/40 mt-0.5">Toggle granular permissions per role. Changes are not live until saved.</p>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="rounded-2xl border border-white/5 overflow-auto bg-[#0a0a0f] shadow-2xl">
        <table className="w-full border-collapse text-left" style={{ minWidth: 720 }}>

          {/* Sticky Header */}
          <thead className="sticky top-0 z-20">
            <tr>
              {/* Empty corner */}
              <th className="px-6 py-4 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/5 w-64">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/30">Permission</span>
              </th>
              {ROLES.map((role, ci) => (
                <th
                  key={role}
                  onMouseEnter={() => setHover(null, ci)}
                  onMouseLeave={() => setHover(null, null)}
                  className={`px-4 py-4 text-center bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/5 transition-colors ${
                    hoveredCol === ci ? 'bg-white/[0.03]' : ''
                  }`}
                >
                  <span className={`inline-flex px-3 py-1 rounded-full text-[12px] font-bold border ${ROLE_COLORS[role]}`}>
                    {role}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {CATEGORIES.map(cat => (
              <React.Fragment key={cat}>
                {/* Category divider */}
                <tr>
                  <td
                    colSpan={ROLES.length + 1}
                    className="px-6 py-2 bg-white/[0.015] border-y border-white/5 text-[11px] font-bold uppercase tracking-widest text-white/30"
                  >
                    {cat}
                  </td>
                </tr>

                {/* Permission rows */}
                {PERMISSIONS.filter(p => p.category === cat).map((perm, rowIdx) => {
                  const absRow = PERMISSIONS.indexOf(perm);
                  return (
                    <tr
                      key={perm.id}
                      className="border-b border-white/[0.04] group"
                    >
                      {/* Permission label */}
                      <td
                        onMouseEnter={() => setHover(absRow, null)}
                        onMouseLeave={() => setHover(null, null)}
                        className={`px-6 py-3.5 text-[13px] font-medium transition-colors ${
                          hoveredRow === absRow ? 'text-white bg-white/[0.03]' : 'text-white/70'
                        }`}
                      >
                        {perm.label}
                      </td>

                      {/* Toggle cells */}
                      {ROLES.map((role, ci) => {
                        const key = `${role}::${perm.id}`;
                        const isModified = pending.has(key);
                        return (
                          <CrosshairCell
                            key={key}
                            row={absRow}
                            col={ci}
                            hoveredRow={hoveredRow}
                            hoveredCol={hoveredCol}
                            setHover={setHover}
                          >
                            <div className="flex items-center justify-center gap-2">
                                <NeonToggle
                                  enabled={!!matrix[role]?.[perm.id]}
                                  onToggle={() => togglePermission(role, perm.id)}
                                  locked={role === 'SUPER_ADMIN'}
                                />
                              {/* Modified indicator */}
                              {isModified && (
                                <motion.div
                                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                                  className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                                />
                              )}
                            </div>
                          </CrosshairCell>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Unsaved Changes Dock — slides up from bottom */}
      <AnimatePresence>
        {pending.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 rounded-full
                       bg-[#1a1a28]/90 backdrop-blur-2xl border border-indigo-500/30
                       shadow-[0_8px_40px_rgba(99,102,241,0.35),0_2px_8px_rgba(0,0,0,0.8)]"
          >
            {/* Amber dot */}
            <motion.div
              className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
            <span className="text-[13px] font-semibold text-white/80">
              <span className="text-amber-400 font-bold">{pending.size}</span> unsaved change{pending.size !== 1 ? 's' : ''}
            </span>

            <div className="w-px h-4 bg-white/10 mx-1" />

            <button
              onClick={discardChanges}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-white/50 hover:text-white transition-colors"
            >
              <RotateCcw size={14} /> Discard
            </button>

            <button
              onClick={saveChanges}
              className="flex items-center gap-2 text-[13px] font-bold text-white px-5 py-2 rounded-full
                         bg-indigo-500 hover:bg-indigo-600 transition-colors
                         shadow-[0_0_20px_rgba(99,102,241,0.5)]"
            >
              <Save size={14} /> Save Changes
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
