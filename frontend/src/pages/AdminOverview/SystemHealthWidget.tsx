import React from 'react';
import { Database, Info, Network, Server } from 'lucide-react';

import { ComponentId, ComponentStatus, SystemHealth } from '../../types/admin';

import { formatClockTime } from './format';

/**
 * System health & node status.
 *
 * The status vocabulary matches the brief — Operational, Degraded, Down — and
 * the badge markup mirrors components/billing/StatusBadge.tsx so a status pill
 * looks the same everywhere in Klyra.
 *
 * Components the backend couldn't actually probe are labelled as such rather
 * than shown green. On an operations screen, a green light that nobody checked
 * is worse than an honest gap.
 */

const STATUS_TONE: Record<ComponentStatus, { label: string; color: string }> = {
  operational: { label: 'Operational', color: 'var(--status-active)' },
  degraded: { label: 'Degraded', color: 'var(--status-beta)' },
  down: { label: 'Down', color: 'var(--status-maintenance)' },
};

const COMPONENT_ICON: Record<ComponentId, typeof Database> = {
  database: Database,
  redis: Server,
  'api-gateway': Network,
};

interface SystemHealthWidgetProps {
  health: SystemHealth;
}

export const SystemHealthWidget: React.FC<SystemHealthWidgetProps> = ({ health }) => {
  const overall = STATUS_TONE[health.overall] ?? STATUS_TONE.operational;

  return (
    <section className="sh-card card-base">
      <header className="sh-head">
        <div>
          <h2 className="sh-title">System health</h2>
          <p className="sh-subtitle">
            {health.overall === 'operational'
              ? 'All probed services are responding.'
              : health.overall === 'degraded'
                ? 'A service is responding slowly.'
                : 'A service is not responding.'}
          </p>
        </div>
        <span className="sh-badge" style={{ color: overall.color }}>
          <span className="sh-dot" style={{ backgroundColor: overall.color }} />
          {overall.label}
        </span>
      </header>

      <ul className="sh-list">
        {health.components.map((component) => {
          const tone = STATUS_TONE[component.status] ?? STATUS_TONE.operational;
          const Icon = COMPONENT_ICON[component.id] ?? Server;

          return (
            <li className="sh-row" key={component.id} data-unprobed={!component.probed}>
              <span className="sh-row-icon" aria-hidden="true">
                <Icon size={15} />
              </span>

              <div className="sh-row-body">
                <div className="sh-row-top">
                  <span className="sh-row-name">{component.label}</span>
                  <span className="sh-badge small" style={{ color: tone.color }}>
                    <span className="sh-dot" style={{ backgroundColor: tone.color }} />
                    {tone.label}
                  </span>
                  {!component.probed && (
                    <span className="sh-unprobed" title="Reported from sample data, not measured">
                      <Info size={11} aria-hidden="true" />
                      Not probed
                    </span>
                  )}
                </div>

                <p className="sh-row-message">{component.message}</p>
              </div>

              <div className="sh-row-stats">
                <span className="sh-uptime">{component.uptimePercent.toFixed(2)}%</span>
                <span className="sh-latency">
                  {component.latencyMs === null ? '—' : `${component.latencyMs}ms`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {health.components.length > 0 && (
        <p className="sh-foot">
          Last checked at {formatClockTime(health.components[0].lastCheckedAt)}
        </p>
      )}

      <style>{`
        .sh-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .sh-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .sh-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .sh-subtitle {
          margin-top: 3px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .sh-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 9px;
          border-radius: 999px;
          background-color: var(--bg-pill);
          border: 1px solid var(--border-subtle);
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .sh-badge.small {
          padding: 2px 8px;
          font-size: 10px;
        }

        .sh-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .sh-list {
          display: flex;
          flex-direction: column;
          list-style: none;
        }

        .sh-row {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          padding: 13px 0;
          border-bottom: 1px solid var(--border-subtle);
        }

        .sh-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .sh-row:first-child {
          padding-top: 0;
        }

        .sh-row[data-unprobed='true'] .sh-row-stats {
          opacity: 0.5;
        }

        .sh-row-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: var(--radius-sm);
          background-color: var(--bg-pill);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          flex-shrink: 0;
        }

        .sh-row-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sh-row-top {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sh-row-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .sh-unprobed {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: var(--text-muted);
          cursor: help;
        }

        .sh-row-message {
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .sh-row-stats {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          flex-shrink: 0;
        }

        .sh-uptime {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
        }

        .sh-latency {
          font-size: 10px;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .sh-foot {
          font-size: 11px;
          color: var(--text-muted);
        }
      `}</style>
    </section>
  );
};
