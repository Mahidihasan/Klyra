import React, { useState, useEffect } from 'react';
import {
  X, Star, Globe, Building2, Calendar, Users, ExternalLink,
  Shield, ArrowRight,
} from 'lucide-react';
import { ProviderProfileResponse, CatalogApi, catalogApi } from '../../services/api/catalog';

interface ProviderProfileModalProps {
  providerId: string;
  onClose: () => void;
  onSelectApi: (api: CatalogApi) => void;
}

export const ProviderProfileModal: React.FC<ProviderProfileModalProps> = ({
  providerId,
  onClose,
  onSelectApi,
}) => {
  const [profile, setProfile] = useState<ProviderProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    catalogApi.getProviderProfile(providerId)
      .then(setProfile)
      .catch((e) => setError(e.message || 'Failed to load provider'))
      .finally(() => setLoading(false));
  }, [providerId]);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  return (
    <div className="ppm-overlay" onClick={onClose}>
      <div className="ppm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button className="ppm-close" onClick={onClose}><X size={18} /></button>

        {loading ? (
          <div className="ppm-loading">
            <div className="ppm-skel-avatar" />
            <div className="ppm-skel-line w60" />
            <div className="ppm-skel-line w40" />
            <div className="ppm-skel-line w80" />
          </div>
        ) : error ? (
          <div className="ppm-error">
            <p>Could not load provider profile.</p>
            <button className="ppm-retry-btn" onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : profile ? (
          <>
            {/* Profile Header */}
            <div className="ppm-header">
              <div className="ppm-avatar-wrap">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" className="ppm-avatar" />
                ) : (
                  <div className="ppm-avatar-placeholder">
                    {profile.name.charAt(0).toUpperCase()}
                  </div>
                )}
                {profile.isVerified && (
                  <div className="ppm-verified-badge" title="Verified Provider">
                    <Shield size={12} />
                  </div>
                )}
              </div>

              <div className="ppm-header-info">
                <h2 className="ppm-name">{profile.name}</h2>
                {profile.company && (
                  <span className="ppm-company">
                    <Building2 size={13} /> {profile.company}
                  </span>
                )}
                {profile.bio && <p className="ppm-bio">{profile.bio}</p>}
              </div>
            </div>

            {/* Stats Row */}
            <div className="ppm-stats">
              <div className="ppm-stat">
                <span className="ppm-stat-value">{profile.totalPublishedApis}</span>
                <span className="ppm-stat-label">Published APIs</span>
              </div>
              <div className="ppm-stat">
                <span className="ppm-stat-value">
                  {profile.totalSubscribers > 1000
                    ? `${(profile.totalSubscribers / 1000).toFixed(1)}k`
                    : profile.totalSubscribers}
                </span>
                <span className="ppm-stat-label">Subscribers</span>
              </div>
              <div className="ppm-stat">
                <span className="ppm-stat-value">
                  <Star size={14} fill="#f59e0b" stroke="#f59e0b" />
                  {profile.averageRating.toFixed(1)}
                </span>
                <span className="ppm-stat-label">Avg Rating</span>
              </div>
              <div className="ppm-stat">
                <span className="ppm-stat-value">
                  <Calendar size={14} />
                  {formatDate(profile.memberSince).split(' ').slice(0, 2).join(' ')}
                </span>
                <span className="ppm-stat-label">Member Since</span>
              </div>
            </div>

            {/* Links */}
            <div className="ppm-links">
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noreferrer" className="ppm-link">
                  <Globe size={13} /> Website
                </a>
              )}
            </div>

            {/* API Portfolio */}
            <div className="ppm-portfolio">
              <h3 className="ppm-portfolio-title">
                Published APIs ({profile.apis.length})
              </h3>
              {profile.apis.length === 0 ? (
                <p className="ppm-no-apis">No published APIs yet.</p>
              ) : (
                <div className="ppm-api-list">
                  {profile.apis.map((api) => (
                    <div
                      key={api.id}
                      className="ppm-api-row"
                      onClick={() => { onSelectApi(api); onClose(); }}
                    >
                      <div className="ppm-api-logo">
                        {api.logoUrl ? (
                          <img src={api.logoUrl} alt="" />
                        ) : (
                          <div className="ppm-api-logo-ph">{api.name.charAt(0)}</div>
                        )}
                      </div>
                      <div className="ppm-api-info">
                        <span className="ppm-api-name">{api.name}</span>
                        <span className="ppm-api-desc">{api.description}</span>
                      </div>
                      <div className="ppm-api-meta">
                        <span className="ppm-api-rating">
                          <Star size={11} fill="#f59e0b" stroke="#f59e0b" />
                          {api.rating.toFixed(1)}
                        </span>
                        <ArrowRight size={14} className="ppm-api-arrow" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}

        <style>{`
          .ppm-overlay {
            position: fixed;
            inset: 0;
            z-index: 10000;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            animation: ppmFadeIn 0.2s ease;
          }

          @keyframes ppmFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          .ppm-modal {
            width: 100%;
            max-width: 560px;
            max-height: 85vh;
            overflow-y: auto;
            background: var(--bg-modal);
            border: 1px solid var(--border-card);
            border-radius: var(--radius-xl);
            padding: 28px;
            position: relative;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
            gap: 20px;
            animation: ppmSlideUp 0.25s ease;
          }

          @keyframes ppmSlideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .ppm-close {
            position: absolute;
            top: 16px;
            right: 16px;
            background: var(--bg-card-hover);
            border: none;
            color: var(--text-muted);
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.15s;
          }

          .ppm-close:hover { color: var(--text-primary); background: var(--bg-card-active); }

          /* Header */
          .ppm-header {
            display: flex;
            gap: 16px;
            align-items: flex-start;
          }

          .ppm-avatar-wrap {
            position: relative;
            flex-shrink: 0;
          }

          .ppm-avatar, .ppm-avatar-placeholder {
            width: 64px;
            height: 64px;
            border-radius: 50%;
          }

          .ppm-avatar { object-fit: cover; }

          .ppm-avatar-placeholder {
            background: var(--accent-gradient);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: 800;
            color: #fff;
          }

          .ppm-verified-badge {
            position: absolute;
            bottom: -2px;
            right: -2px;
            width: 22px;
            height: 22px;
            background: #22c55e;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            border: 2px solid var(--bg-modal);
          }

          .ppm-header-info {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .ppm-name {
            font-size: 22px;
            font-weight: 800;
            color: var(--text-primary);
          }

          .ppm-company {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 13px;
            color: var(--text-secondary);
          }

          .ppm-bio {
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.5;
            margin-top: 4px;
          }

          /* Stats */
          .ppm-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
          }

          .ppm-stat {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            padding: 12px 8px;
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: var(--radius-md);
          }

          .ppm-stat-value {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 15px;
            font-weight: 700;
            color: var(--text-primary);
          }

          .ppm-stat-label {
            font-size: 10px;
            color: var(--text-muted);
            text-align: center;
          }

          /* Links */
          .ppm-links {
            display: flex;
            gap: 8px;
          }

          .ppm-link {
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 6px 12px;
            border-radius: var(--radius-md);
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            color: var(--text-secondary);
            font-size: 12px;
            text-decoration: none;
            transition: all 0.15s;
          }

          .ppm-link:hover {
            color: var(--accent-purple);
            border-color: rgba(139, 92, 246, 0.3);
          }

          /* Portfolio */
          .ppm-portfolio-title {
            font-size: 14px;
            font-weight: 700;
            color: var(--text-primary);
            margin-bottom: 12px;
          }

          .ppm-no-apis {
            font-size: 13px;
            color: var(--text-muted);
            text-align: center;
            padding: 20px;
          }

          .ppm-api-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }

          .ppm-api-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            border-radius: var(--radius-md);
            cursor: pointer;
            transition: all 0.15s;
          }

          .ppm-api-row:hover {
            background: var(--bg-card-hover);
          }

          .ppm-api-logo img, .ppm-api-logo-ph {
            width: 32px;
            height: 32px;
            border-radius: var(--radius-sm);
          }

          .ppm-api-logo img { object-fit: cover; }

          .ppm-api-logo-ph {
            background: var(--accent-gradient);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 800;
            color: #fff;
          }

          .ppm-api-info {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
          }

          .ppm-api-name {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .ppm-api-desc {
            font-size: 11px;
            color: var(--text-muted);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .ppm-api-meta {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
          }

          .ppm-api-rating {
            display: flex;
            align-items: center;
            gap: 3px;
            font-size: 12px;
            font-weight: 600;
            color: var(--text-primary);
          }

          .ppm-api-arrow { color: var(--text-muted); }

          /* Loading/Error */
          .ppm-loading, .ppm-error {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            padding: 40px 20px;
          }

          .ppm-skel-avatar {
            width: 64px; height: 64px; border-radius: 50%;
            background: var(--bg-card-hover); animation: shimmer 1.5s infinite;
          }

          .ppm-skel-line {
            height: 12px; border-radius: 6px;
            background: var(--bg-card-hover); animation: shimmer 1.5s infinite;
          }

          .ppm-skel-line.w60 { width: 60%; }
          .ppm-skel-line.w40 { width: 40%; }
          .ppm-skel-line.w80 { width: 80%; }

          .ppm-error p { color: var(--text-muted); font-size: 13px; }

          .ppm-retry-btn {
            padding: 6px 14px;
            border-radius: var(--radius-md);
            background: var(--accent-gradient);
            color: #fff;
            border: none;
            font-size: 12px;
            cursor: pointer;
          }

          @media (max-width: 600px) {
            .ppm-stats { grid-template-columns: repeat(2, 1fr); }
          }
        `}</style>
      </div>
    </div>
  );
};
