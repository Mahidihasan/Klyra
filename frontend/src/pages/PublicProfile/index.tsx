import { AlertCircle, ArrowLeft, Briefcase, Building2, ExternalLink, Github, Globe2, Share2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import { ContributionGraph, StickerGrid } from '../Profile/overview';
import { getPublicProfile, PublicProfileApiError, PublicProfileResponse } from '../../services/api/publicProfile';
import './styles.css';

export function PublicProfilePage({ username }: { username: string }) {
  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [error, setError] = useState<PublicProfileApiError | null>(null);
  const [shareStatus, setShareStatus] = useState<'copied' | 'error' | null>(null);
  const shareStatusTimer = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setProfile(null);
    setError(null);
    getPublicProfile(username, controller.signal).then(setProfile).catch((cause) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof PublicProfileApiError ? cause : new PublicProfileApiError(0, 'Unable to load this public profile.'));
      }
    });
    return () => controller.abort();
  }, [username]);

  useEffect(() => () => {
    if (shareStatusTimer.current !== null) window.clearTimeout(shareStatusTimer.current);
  }, []);

  const shareProfile = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus('copied');
    } catch {
      setShareStatus('error');
      window.prompt('Copy this public profile link:', window.location.href);
    }
    if (shareStatusTimer.current !== null) window.clearTimeout(shareStatusTimer.current);
    shareStatusTimer.current = window.setTimeout(() => setShareStatus(null), 2000);
  };

  if (error) {
    return <main className="public-profile-state"><AlertCircle size={22} /><div><h1>{error.status === 404 ? 'Profile not found' : 'Unable to load profile'}</h1><p>{error.status === 404 ? 'This public profile does not exist or is unavailable.' : error.message}</p></div></main>;
  }
  if (!profile) return <PublicProfileSkeleton />;

  const { profile: person } = profile;
  const publicContributions = profile.activity.map((activity) => ({
    ...activity,
    projectId: 'public-profile',
    projectName: 'Public API Build',
  }));
  const initials = person.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return (
    <main className="public-profile-page profile-page">
      <a
        className="public-profile-back"
        href="/"
        onClick={() => {
          try {
            window.sessionStorage.setItem('klyra:home-navigation-loading', 'true');
          } catch {
            // Navigation should still work when session storage is unavailable.
          }
        }}
      ><ArrowLeft size={15} /> Back to Klyra</a>
      <header className="profile-header">
        <div className="profile-header-top">
          <div className="profile-avatar-wrap"><div className="profile-avatar-xl">{person.avatar_url ? <img src={person.avatar_url} alt="" /> : initials}</div></div>
          <div className="profile-identity">
            <div className="profile-name-line"><h1>{person.name}</h1></div>
            <div className="profile-handle-line"><span>@{person.username}</span></div>
            {person.bio && <p className="profile-bio-line">{person.bio}</p>}
            <div className="profile-meta-row">
              {person.job_title && <span className="profile-meta-chip"><Briefcase size={13} />{person.job_title}</span>}
              {person.company && <span className="profile-meta-chip"><Building2 size={13} />{person.company}</span>}
              {person.github && <a className="profile-meta-chip link" href={person.github} target="_blank" rel="noreferrer"><Github size={13} />GitHub</a>}
              {person.website && <a className="profile-meta-chip link" href={person.website} target="_blank" rel="noreferrer"><Globe2 size={13} />Website</a>}
            </div>
          </div>
          <div className="profile-header-actions"><button className={`public-profile-share${shareStatus === 'error' ? ' is-error' : ''}`} type="button" onClick={() => void shareProfile()} aria-live="polite"><Share2 size={15} /> {shareStatus === 'copied' ? '✓ Link copied!' : shareStatus === 'error' ? 'Unable to copy link' : 'Share Profile'}</button></div>
        </div>
      </header>

      <div className="public-profile-layout">
        <aside className="public-profile-sidebar">
          <section className="public-profile-section">
            <header className="public-profile-section-head"><p className="profile-eyebrow">ABOUT</p><h2>Developer context</h2></header>
            {person.bio && <p className="public-profile-about-copy">{person.bio}</p>}
            <div className="public-profile-about-meta">
              {person.job_title && <span><Briefcase size={13} />{person.job_title}</span>}
              {person.company && <span><Building2 size={13} />{person.company}</span>}
              {person.github && <a href={person.github} target="_blank" rel="noreferrer"><Github size={13} />GitHub</a>}
              {person.website && <a href={person.website} target="_blank" rel="noreferrer"><Globe2 size={13} />Website</a>}
            </div>
          </section>

          <section className="public-profile-section">
            <header className="public-profile-section-head"><p className="profile-eyebrow">SKILLS</p><h2>What I work with</h2></header>
            {person.skills.length > 0 ? <div className="profile-skill-list public-profile-skills">{person.skills.map((skill) => <span key={skill} className="profile-skill-chip">{skill}</span>)}</div> : <p className="public-profile-muted">No skills listed yet.</p>}
          </section>

          <section className="public-profile-section">
            <header className="public-profile-section-head"><p className="profile-eyebrow">EXPERIENCE & EDUCATION</p></header>
            <div className="public-profile-details">
              <DetailList title="Experience" entries={person.experience} primary={(entry) => entry.title} secondary={(entry) => entry.company} />
              <DetailList title="Education" entries={person.education} primary={(entry) => entry.institution} secondary={(entry) => entry.program} />
            </div>
          </section>

          <section className="public-profile-section">
            <header className="public-profile-section-head"><p className="profile-eyebrow">ACHIEVEMENTS</p><h2>Earned achievements</h2></header>
            <StickerGrid achievements={profile.achievements} />
          </section>

          <section className="public-profile-section">
            <header className="public-profile-section-head"><p className="profile-eyebrow">CERTIFICATES</p><h2>Earned certificates</h2></header>
            {profile.certificates.length ? <div className="certificate-list">{profile.certificates.map((certificate) => <article key={`${certificate.certificate_type}-${certificate.issued_at}`} className="certificate-record"><div className="certificate-mark">✓</div><div className="certificate-copy"><p className="certificate-kicker">KLYRA CERTIFICATE</p><h3>{certificate.title}</h3><p>{certificate.description}</p><p className="certificate-reason">Issued {formatDate(certificate.issued_at)}</p></div></article>)}</div> : <p className="public-profile-muted">No certificates earned yet.</p>}
          </section>
        </aside>

        <div className="public-profile-main">
          <section className="public-profile-section public-profile-activity-section">
            <header className="public-profile-section-head"><p className="profile-eyebrow">ACTIVITY</p><h2>Building in public</h2><p className="public-profile-section-sub">A 12-month view of public work and releases.</p></header>
            <ContributionGraph contributions={publicContributions} weeks={52} />
            {profile.activity.length ? <div className="feed public-profile-activity-feed">{profile.activity.map((activity) => <div key={activity.id} className="feed-row"><div className="feed-copy"><div className="feed-label">{activity.label}</div><div className="feed-meta">{formatDate(activity.at)}</div></div></div>)}</div> : <div className="public-profile-empty-activity">No public activity to show yet.</div>}
          </section>

          <section className="public-profile-section public-profile-apis-section">
            <header className="public-profile-section-head"><p className="profile-eyebrow">PUBLISHED APIS</p><h2>Published APIs</h2><p className="public-profile-section-sub">Public tools and services built on Klyra.</p></header>
            {profile.published_apis.length ? <div className="public-profile-api-grid">{profile.published_apis.map((api) => <article key={api.slug} className="public-profile-api"><div><span className="public-profile-api-category">{api.category?.name || 'API'}</span><h3>{api.name}</h3><p>{api.description}</p></div><div className="public-profile-api-meta"><span>v{api.current_version}</span><span>{api.endpoint_count} endpoint{api.endpoint_count === 1 ? '' : 's'}</span><span aria-label={`${api.star_count} stars`}>★ {api.star_count}</span>{api.documentation_url && <a href={api.documentation_url} target="_blank" rel="noreferrer">Docs <ExternalLink size={12} /></a>}</div></article>)}</div> : <p className="public-profile-muted">No published APIs yet.</p>}
          </section>
        </div>
      </div>
    </main>
  );
}

function PublicProfileSkeleton() {
  return (
    <main className="public-profile-page profile-page public-profile-skeleton" aria-busy="true" aria-label="Loading public profile">
      <header className="profile-header">
        <div className="profile-header-top">
          <div className="profile-avatar-wrap"><div className="public-profile-skeleton-block public-profile-skeleton-avatar" /></div>
          <div className="profile-identity">
            <div className="public-profile-skeleton-block public-profile-skeleton-name" />
            <div className="public-profile-skeleton-block public-profile-skeleton-username" />
            <div className="public-profile-skeleton-block public-profile-skeleton-bio" />
            <div className="public-profile-skeleton-meta"><span /><span /><span /></div>
          </div>
          <div className="public-profile-skeleton-block public-profile-skeleton-share" />
        </div>
      </header>
      <div className="public-profile-layout">
        <aside className="public-profile-sidebar">
          <section className="public-profile-section public-profile-skeleton-card">
          <SkeletonCardHeader titleWidth="150px" />
          <div className="public-profile-skeleton-chips"><span /><span /><span /><span /></div>
          <div className="public-profile-skeleton-details"><SkeletonDetailList /><SkeletonDetailList /></div>
          </section>
          <SkeletonProfileCard titleWidth="165px"><div className="public-profile-skeleton-achievements"><span /><span /><span /></div></SkeletonProfileCard>
          <SkeletonProfileCard titleWidth="145px"><div className="public-profile-skeleton-certificate"><span /><div><i /><i /><i /></div></div></SkeletonProfileCard>
        </aside>
        <div className="public-profile-main">
          <SkeletonProfileCard titleWidth="80px"><div className="public-profile-skeleton-activity"><span /><span /><span /></div></SkeletonProfileCard>
          <SkeletonProfileCard titleWidth="125px"><div className="public-profile-skeleton-apis"><span /><span /></div></SkeletonProfileCard>
        </div>
      </div>
    </main>
  );
}

function SkeletonCardHeader({ titleWidth }: { titleWidth: string }) {
  return <header className="profile-card-head"><div><span className="public-profile-skeleton-block public-profile-skeleton-eyebrow" /><span className="public-profile-skeleton-block public-profile-skeleton-title" style={{ width: titleWidth }} /></div></header>;
}

function SkeletonProfileCard({ titleWidth, children }: { titleWidth: string; children: React.ReactNode }) {
  return <section className="public-profile-section public-profile-skeleton-card"><SkeletonCardHeader titleWidth={titleWidth} />{children}</section>;
}

function SkeletonDetailList() {
  return <div className="public-profile-skeleton-detail-list"><span /><span /><span /></div>;
}

function DetailList<T extends { start_date: string; end_date: string | null; is_current: boolean }>({ title, entries, primary, secondary }: { title: string; entries: T[]; primary: (entry: T) => string; secondary: (entry: T) => string }) {
  return <section><h3>{title}</h3>{entries.length ? <div className="profile-detail-list">{entries.map((entry, index) => <article className="profile-detail-item" key={`${primary(entry)}-${index}`}><strong>{primary(entry)}</strong><span>{secondary(entry)}</span><p>{entry.start_date} — {entry.is_current ? 'Present' : entry.end_date}</p></article>)}</div> : <p className="achievement-empty">No {title.toLowerCase()} listed.</p>}</section>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
