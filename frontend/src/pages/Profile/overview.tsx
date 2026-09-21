import {
  AlertCircle,
  BadgeCheck,
  Cake,
  CheckCircle2,
  FolderGit2,
  GitCommitHorizontal,
  Loader2,
  Rocket,
  ShieldCheck,
  Users,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { STATUS_META } from '../../services/apiBuild';
import type { ProfileAchievement, ProfileCertificate } from '../../services/api/auth';
import type { ProviderProject } from '../../types/apibuild';

/* ==========================================================================
 * Overview building blocks for the Profile page: achievement stickers,
 * the contribution heatmap, the contributions (commit) feed and the
 * user's project list. All data is derived from real backend records.
 * ========================================================================== */

export interface ActivityEntry {
  id: string;
  label: string;
  kind: string;
  at: string;
}

export interface Contribution extends ActivityEntry {
  projectId: string;
  projectName: string;
}

/* ------------------------------------------------------------------ */
/* Compact UI achievement stickers. These are not formal certificates. */
/* ------------------------------------------------------------------ */

const AchievementIcon: React.FC<{ id: ProfileAchievement['id'] }> = ({ id }) => {
  switch (id) {
    case 'origin': return <Rocket size={19} />;
    case 'momentum': return <Users size={19} />;
    case 'ascendant': return <GitCommitHorizontal size={19} />;
    case 'legacy': return <Cake size={19} />;
    case 'distinction': return <BadgeCheck size={19} />;
    case 'vanguard': return <ShieldCheck size={19} />;
  }
};

const ACHIEVEMENT_REASONS: Record<ProfileAchievement['id'], string> = {
  origin: 'Published your first API',
  momentum: 'Reached 5 active subscribers',
  ascendant: 'Released multiple API versions',
  legacy: 'Been on Klyra for 1 year',
  distinction: 'Verified Account',
  vanguard: 'Two-Factor Authentication Enabled',
};

export const StickerGrid: React.FC<{ achievements: ProfileAchievement[] }> = ({ achievements }) => {
  if (achievements.length === 0) {
    return <p className="achievement-empty">No achievements earned yet.</p>;
  }

  return (
    <div className="sticker-grid" aria-label="Earned achievements">
      {achievements.map((achievement) => {
        const tooltipId = `achievement-${achievement.id}-reason`;
        return (
          <div
            key={achievement.id}
            className="sticker earned"
            tabIndex={0}
            aria-describedby={tooltipId}
          >
            <span className="sticker-icon">
              <AchievementIcon id={achievement.id} />
            </span>
            <span className="sticker-body">
              <span className="sticker-name">{achievement.name}</span>
            </span>
            <span id={tooltipId} role="tooltip" className="achievement-tooltip">
              {ACHIEVEMENT_REASONS[achievement.id]}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const CertificateList: React.FC<{ certificates: ProfileCertificate[]; userName: string }> = ({ certificates, userName }) => {
  if (certificates.length === 0) return null;
  return (
    <div className="certificate-list" aria-label="Issued certificates">
      {certificates.map((certificate) => (
        <article key={certificate.id} className="certificate-record">
          <div className="certificate-mark"><BadgeCheck size={20} /></div>
          <div className="certificate-copy">
            <p className="certificate-kicker">KLYRA CERTIFICATE</p>
            <h3>{certificate.title}</h3>
            <p>Awarded to {userName}. Issued {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(certificate.issued_at))}.</p>
            <p className="certificate-reason">{certificate.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Contribution heatmap — 26 weeks                                     */
/* ------------------------------------------------------------------ */

const DEFAULT_HEATMAP_WEEKS = 26;

const localDateKey = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const heatLevel = (count: number): number =>
  count <= 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4;

export const ContributionGraph: React.FC<{ contributions: Contribution[]; loading?: boolean; weeks?: number }> = ({
  contributions,
  loading,
  weeks = DEFAULT_HEATMAP_WEEKS,
}) => {
  const grid = useMemo(() => {
    const counts = new Map<string, number>();
    for (const contribution of contributions) {
      const date = new Date(contribution.at);
      if (Number.isNaN(date.getTime())) {
        continue;
      }
      const key = localDateKey(date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - today.getDay());
    const start = new Date(lastSunday);
    start.setDate(lastSunday.getDate() - (weeks - 1) * 7);

    const columns: Array<{
      monthLabel: string | null;
      days: Array<{ key: string; count: number; future: boolean; date: Date }>;
    }> = [];
    let previousMonth = -1;
    for (let week = 0; week < weeks; week += 1) {
      const days: Array<{ key: string; count: number; future: boolean; date: Date }> = [];
      for (let day = 0; day < 7; day += 1) {
        const date = new Date(start);
        date.setDate(start.getDate() + week * 7 + day);
        days.push({
          key: localDateKey(date),
          count: counts.get(localDateKey(date)) ?? 0,
          future: date > today,
          date,
        });
      }
      const firstMonth = days[0].date.getMonth();
      const monthLabel = firstMonth !== previousMonth ? MONTH_SHORT[firstMonth] : null;
      previousMonth = firstMonth;
      columns.push({ monthLabel, days });
    }
    return columns;
  }, [contributions, weeks]);

  const total = useMemo(
    () =>
      contributions.filter((contribution) => {
        const date = new Date(contribution.at);
        const cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);
        cutoff.setDate(cutoff.getDate() - weeks * 7);
        return !Number.isNaN(date.getTime()) && date >= cutoff;
      }).length,
    [contributions, weeks],
  );

  return (
    <div
      className={`cg-wrap${loading ? ' is-loading' : ''}`}
      style={{ '--contribution-weeks': weeks } as React.CSSProperties}
    >
      <p className="cg-total">
        {loading ? (
          'Loading activity…'
        ) : (
          <>
            <strong>{total.toLocaleString()}</strong> activity event{total === 1 ? '' : 's'} in the
            last {weeks === 52 ? '12 months' : '6 months'}
          </>
        )}
      </p>
      <div className="cg-scroll">
        <div className="cg-grid" style={{ minWidth: weeks * 11 + 26 }}>
          <div className="cg-months" aria-hidden="true">
            {grid.map((column, index) => (
              <span key={`m-${index}`} className="cg-month">
                {column.monthLabel ?? ''}
              </span>
            ))}
          </div>
          <div className="cg-body">
            <div className="cg-days" aria-hidden="true">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>
            <div className="cg-columns">
              {grid.map((column, index) => (
                <div key={`c-${index}`} className="cg-column">
                  {column.days.map((day) => (
                    <span
                      key={day.key}
                      className={`cg-cell l${heatLevel(day.count)}${day.future ? ' future' : ''}`}
                      title={
                        day.future
                          ? undefined
                          : `${day.count} activity event${day.count === 1 ? '' : 's'} on ${
                              MONTH_SHORT[day.date.getMonth()]
                            } ${day.date.getDate()}, ${day.date.getFullYear()}`
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="cg-legend" aria-hidden="true">
            <span>Less</span>
            <span className="cg-cell l0" />
            <span className="cg-cell l1" />
            <span className="cg-cell l2" />
            <span className="cg-cell l3" />
            <span className="cg-cell l4" />
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Activity feed                                                        */
/* ------------------------------------------------------------------ */

const FeedIcon: React.FC<{ kind: string }> = ({ kind }) => {
  if (kind === 'ok') {
    return <CheckCircle2 size={15} className="feed-icon ok" />;
  }
  if (kind === 'warning') {
    return <AlertCircle size={15} className="feed-icon warning" />;
  }
  if (kind === 'critical') {
    return <AlertCircle size={15} className="feed-icon critical" />;
  }
  return <GitCommitHorizontal size={15} className="feed-icon info" />;
};

export function relativeTime(value: string | Date | null): string {
  if (!value) {
    return '—';
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) {
    return 'just now';
  }
  if (seconds < 3600) {
    return `${Math.max(1, Math.round(seconds / 60))}m ago`;
  }
  if (seconds < 86400) {
    return `${Math.round(seconds / 3600)}h ago`;
  }
  if (seconds < 86400 * 30) {
    return `${Math.round(seconds / 86400)}d ago`;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}

export const ContributionsFeed: React.FC<{ contributions: Contribution[]; loading?: boolean }> = ({
  contributions,
  loading,
}) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? contributions : contributions.slice(0, 8);

  if (loading) {
    return (
      <div className="feed-empty">
        <Loader2 className="profile-spinner" size={17} /> Loading activity…
      </div>
    );
  }
  if (contributions.length === 0) {
    return (
      <div className="feed-empty">
        <GitCommitHorizontal size={20} />
        <p>
          No activity yet. Events from available API Build projects — deploys, versions and
          publishes — will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="feed">
      {visible.map((contribution) => (
        <div key={`${contribution.projectId}-${contribution.id}`} className="feed-row">
          <FeedIcon kind={contribution.kind} />
          <div className="feed-copy">
            <p className="feed-label">{contribution.label}</p>
            <p className="feed-meta">
              <span className="feed-project">{contribution.projectName}</span>
              <span className="feed-dot">·</span>
              <span>{relativeTime(contribution.at)}</span>
            </p>
          </div>
        </div>
      ))}
      {contributions.length > 8 && (
        <button
          type="button"
          className="feed-more"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Show less' : `Show all ${contributions.length} activity events`}
        </button>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Projects list                                                       */
/* ------------------------------------------------------------------ */

const VISIBILITY_LABEL: Record<ProviderProject['visibility'], string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
};

export const ProjectsList: React.FC<{
  projects: ProviderProject[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}> = ({ projects, loading, error, onRetry }) => {
  if (loading) {
    return (
      <div className="feed-empty">
        <Loader2 className="profile-spinner" size={17} /> Loading projects…
      </div>
    );
  }
  if (error) {
    return (
      <div className="feed-empty">
        <AlertCircle size={20} />
        <p>{error}</p>
        <button type="button" className="profile-secondary-btn" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  if (projects.length === 0) {
    return (
      <div className="feed-empty">
        <FolderGit2 size={20} />
        <p>
          No API Build projects are available yet. Create a project from the API Build workspace
          to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="project-list">
      {projects.map((project) => {
        const meta = STATUS_META[project.status] ?? STATUS_META.draft;
        return (
          <div key={project.id} className="project-row">
            <span className="project-dot" style={{ background: meta.color }} title={meta.label} />
            <div className="project-copy">
              <div className="project-title">
                <span className="project-name">{project.name}</span>
                <span className="project-chip" title="Latest version">
                  {project.version}
                </span>
                <span className="project-chip">
                  {VISIBILITY_LABEL[project.visibility] ?? 'Private'}
                </span>
              </div>
              <p className="project-desc">{project.description || 'No description provided.'}</p>
            </div>
            <div className="project-side">
              <span className="project-status" style={{ color: meta.color }}>
                {meta.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
