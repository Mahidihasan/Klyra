import {
  AlertCircle,
  BadgeCheck,
  Blocks,
  Cake,
  CheckCircle2,
  Flame,
  FolderGit2,
  GitCommitHorizontal,
  Loader2,
  Lock,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { STATUS_META } from '../../services/apiBuild';
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

export interface ProfileFacts {
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  projects: number;
  published: number;
  consumers: number;
  contributions: number;
  avgSuccessRate: number;
  memberSince: Date;
  completeness: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  progressLabel: string;
  Icon: typeof Rocket;
  earned: boolean;
}

const YEARS = 1000 * 60 * 60 * 24 * 365.25;

export function buildAchievements(facts: ProfileFacts): Achievement[] {
  return [
    {
      id: 'verified',
      name: 'Verified',
      description: 'Confirmed the account email address.',
      progressLabel: 'Verify your email to earn this.',
      Icon: BadgeCheck,
      earned: facts.emailVerified,
    },
    {
      id: 'guardian',
      name: 'Guardian',
      description: 'Enabled two-factor authentication.',
      progressLabel: 'Enable 2FA in Security to earn this.',
      Icon: ShieldCheck,
      earned: facts.twoFactorEnabled,
    },
    {
      id: 'shipper',
      name: 'Shipper',
      description: 'Published an API project on Klyra.',
      progressLabel: `${facts.published} of 1 published project${
        facts.published === 1 ? '' : 's'
      } — publish one to earn this.`,
      Icon: Rocket,
      earned: facts.published >= 1,
    },
    {
      id: 'architect',
      name: 'Architect',
      description: 'Built three or more API projects.',
      progressLabel: `${Math.min(facts.projects, 3)} of 3 projects created.`,
      Icon: Blocks,
      earned: facts.projects >= 3,
    },
    {
      id: 'polished',
      name: 'Polished',
      description: 'Completed the profile: avatar, bio, company, website and GitHub.',
      progressLabel: `${facts.completeness} of 5 profile fields filled.`,
      Icon: Sparkles,
      earned: facts.completeness >= 5,
    },
    {
      id: 'crowd-favorite',
      name: 'Crowd Favorite',
      description: 'Attracted five or more API consumers.',
      progressLabel: `${Math.min(facts.consumers, 5)} of 5 consumers subscribed.`,
      Icon: Users,
      earned: facts.consumers >= 5,
    },
    {
      id: 'five-nines',
      name: 'Five Nines',
      description: 'Averaged 99%+ request success across projects.',
      progressLabel: `${facts.avgSuccessRate.toFixed(1)}% average success rate.`,
      Icon: Star,
      earned: facts.projects > 0 && facts.avgSuccessRate >= 99,
    },
    {
      id: 'prolific',
      name: 'Prolific',
      description: 'Recorded twenty or more contributions.',
      progressLabel: `${Math.min(facts.contributions, 20)} of 20 contributions.`,
      Icon: Flame,
      earned: facts.contributions >= 20,
    },
    {
      id: 'veteran',
      name: 'Veteran',
      description: 'One full year on the platform.',
      progressLabel: 'Complete one year of membership.',
      Icon: Cake,
      earned: Date.now() - facts.memberSince.getTime() >= YEARS,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Stickers — GitHub-style achievement tiles                           */
/* ------------------------------------------------------------------ */

export const StickerGrid: React.FC<{ achievements: Achievement[] }> = ({ achievements }) => (
  <div className="sticker-grid">
    {achievements.map((achievement) => (
      <div
        key={achievement.id}
        className={`sticker${achievement.earned ? ' earned' : ''}`}
        title={achievement.earned ? achievement.description : achievement.progressLabel}
      >
        <span className="sticker-icon">
          <achievement.Icon size={19} />
        </span>
        <span className="sticker-body">
          <span className="sticker-name">{achievement.name}</span>
          <span className="sticker-desc">
            {achievement.earned ? achievement.description : achievement.progressLabel}
          </span>
        </span>
      </div>
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/* Contribution heatmap — 26 weeks                                     */
/* ------------------------------------------------------------------ */

const HEATMAP_WEEKS = 26;

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

export const ContributionGraph: React.FC<{ contributions: Contribution[]; loading?: boolean }> = ({
  contributions,
  loading,
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
    start.setDate(lastSunday.getDate() - (HEATMAP_WEEKS - 1) * 7);

    const columns: Array<{
      monthLabel: string | null;
      days: Array<{ key: string; count: number; future: boolean; date: Date }>;
    }> = [];
    let previousMonth = -1;
    for (let week = 0; week < HEATMAP_WEEKS; week += 1) {
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
  }, [contributions]);

  const total = useMemo(
    () =>
      contributions.filter((contribution) => {
        const date = new Date(contribution.at);
        const cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);
        cutoff.setDate(cutoff.getDate() - HEATMAP_WEEKS * 7);
        return !Number.isNaN(date.getTime()) && date >= cutoff;
      }).length,
    [contributions],
  );

  return (
    <div className={`cg-wrap${loading ? ' is-loading' : ''}`}>
      <p className="cg-total">
        {loading ? (
          'Loading activity…'
        ) : (
          <>
            <strong>{total.toLocaleString()}</strong> contribution{total === 1 ? '' : 's'} in the
            last 6 months
          </>
        )}
      </p>
      <div className="cg-scroll">
        <div className="cg-grid">
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
                          : `${day.count} contribution${day.count === 1 ? '' : 's'} on ${
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
/* Contributions feed — commit-style activity list                     */
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
        <Loader2 className="profile-spinner" size={17} /> Loading contributions…
      </div>
    );
  }
  if (contributions.length === 0) {
    return (
      <div className="feed-empty">
        <GitCommitHorizontal size={20} />
        <p>
          No contributions yet. Activity from your API projects — deploys, versions and publishes —
          will appear here.
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
          {expanded ? 'Show less' : `Show all ${contributions.length} contributions`}
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
  activityCounts: Map<string, number>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}> = ({ projects, activityCounts, loading, error, onRetry }) => {
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
          No projects yet. Create your first API project from the API Build workspace and its
          contributions will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="project-list">
      {projects.map((project) => {
        const meta = STATUS_META[project.status] ?? STATUS_META.draft;
        const commits = activityCounts.get(project.id);
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
              <p className="project-meta">
                <span>
                  {project.endpointCount} endpoint{project.endpointCount === 1 ? '' : 's'}
                </span>
                <span className="feed-dot">·</span>
                <span>
                  {project.consumers} consumer{project.consumers === 1 ? '' : 's'}
                </span>
                <span className="feed-dot">·</span>
                <span>Updated {relativeTime(project.updatedAt)}</span>
              </p>
            </div>
            <div className="project-side">
              {typeof commits === 'number' ? (
                <span className="project-commits" title="Recorded activity on this project">
                  <GitCommitHorizontal size={14} /> {commits}
                </span>
              ) : (
                <span
                  className="project-commits muted"
                  title="Activity is unavailable for this project"
                >
                  <Lock size={13} /> N/A
                </span>
              )}
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
