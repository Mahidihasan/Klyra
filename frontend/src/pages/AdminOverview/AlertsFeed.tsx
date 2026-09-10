import React from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

import { AlertSeverity, PlatformAlert } from '../../types/admin';

import { formatRelativeTime } from './format';

/**
 * Recent platform alerts.
 *
 * Severity drives colour, icon and the left rule — one signal encoded three
 * ways so it survives both a quick glance and a colour-blind reader.
 */

const SEVERITY: Record<AlertSeverity, { label: string; color: string; icon: typeof Info }> = {
  critical: { label: 'Critical', color: 'var(--status-maintenance)', icon: AlertOctagon },
  warning: { label: 'Warning', color: 'var(--status-beta)', icon: AlertTriangle },
  info: { label: 'Info', color: 'var(--text-accent)', icon: Info },
};

interface AlertsFeedProps {
  alerts: PlatformAlert[];
}

export const AlertsFeed: React.FC<AlertsFeedProps> = ({ alerts }) => {
  const unacknowledged = alerts.filter((alert) => !alert.acknowledged).length;

  return (
    <section className="af-card card-base">
      <header className="af-head">
        <div>
          <h2 className="af-title">Recent alerts</h2>
          <p className="af-subtitle">
            {alerts.length === 0
              ? 'Nothing raised recently.'
              : `${unacknowledged} of ${alerts.length} still need a look.`}
          </p>
        </div>
      </header>

      {alerts.length === 0 ? (
        <div className="af-empty">
          <CheckCircle2 size={20} aria-hidden="true" />
          <p>No alerts in the last 24 hours. Anything the platform raises will show up here.</p>
        </div>
      ) : (
        <ul className="af-list">
          {alerts.map((alert) => {
            const tone = SEVERITY[alert.severity] ?? SEVERITY.info;
            const Icon = tone.icon;

            return (
              <li
                className="af-item"
                key={alert.id}
                data-acknowledged={alert.acknowledged}
                // Severity colour is passed as a custom property so the icon,
                // label and left rule stay in sync from one source.
                style={{ '--af-tone': tone.color } as React.CSSProperties}
              >
                <span className="af-item-icon" aria-hidden="true">
                  <Icon size={14} />
                </span>

                <div className="af-item-body">
                  <div className="af-item-top">
                    <span className="af-item-title">{alert.title}</span>
                    <time className="af-item-time" dateTime={alert.createdAt}>
                      {formatRelativeTime(alert.createdAt)}
                    </time>
                  </div>

                  <p className="af-item-desc">{alert.description}</p>

                  <div className="af-item-meta">
                    <span className="af-item-severity">{tone.label}</span>
                    <span className="af-item-source">{alert.source}</span>
                    {alert.acknowledged && <span className="af-item-ack">Acknowledged</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <style>{`
        .af-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .af-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .af-subtitle {
          margin-top: 3px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .af-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          list-style: none;
          max-height: 340px;
          overflow-y: auto;
        }

        .af-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 11px 12px;
          border-radius: var(--radius-md);
          background-color: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-subtle);
          border-left: 2px solid var(--af-tone);
        }

        .af-item[data-acknowledged='true'] {
          opacity: 0.6;
        }

        .af-item-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 1px;
          color: var(--af-tone);
          flex-shrink: 0;
        }

        .af-item-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .af-item-top {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
        }

        .af-item-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .af-item-time {
          font-size: 10px;
          color: var(--text-muted);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .af-item-desc {
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.55;
          max-width: 62ch;
        }

        .af-item-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 2px;
        }

        .af-item-severity {
          font-size: 10px;
          font-weight: 600;
          color: var(--af-tone);
        }

        .af-item-source {
          font-size: 10px;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .af-item-ack {
          font-size: 10px;
          color: var(--text-muted);
        }

        .af-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 32px 20px;
          text-align: center;
          color: var(--text-muted);
        }

        .af-empty p {
          font-size: 12px;
          line-height: 1.55;
          max-width: 40ch;
        }
      `}</style>
    </section>
  );
};
