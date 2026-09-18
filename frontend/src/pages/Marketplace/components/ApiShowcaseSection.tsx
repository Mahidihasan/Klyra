import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  ShieldCheck,
  Zap,
  Terminal,
  ExternalLink,
  ChevronRight,
  Layers,
  Sparkles,
  Users,
  Award,
  Video,
  CheckCircle2,
  Clock,
  Radio,
  FileCode,
  Lock,
} from 'lucide-react';
import { CatalogApi } from '../../../services/api/catalog';

interface ApiShowcaseSectionProps {
  api: CatalogApi;
  onOpenProvider?: (providerId: string) => void;
  onOpenTester?: (api: CatalogApi) => void;
  isSubscribed?: boolean;
  onSubscribe?: () => void;
}

interface ShowcaseChapter {
  id: string;
  title: string;
  duration: string;
  badge: string;
  description: string;
  videoUrl: string;
  highlights: string[];
  sampleEndpoint: string;
}

export const ApiShowcaseSection: React.FC<ApiShowcaseSectionProps> = ({
  api,
  onOpenProvider,
  onOpenTester,
  isSubscribed = false,
  onSubscribe,
}) => {
  const isFreeApi = api.pricingModel === 'FREE';
  const canAccess = isSubscribed || isFreeApi;
  const chapters: ShowcaseChapter[] = [
    {
      id: 'quickstart',
      title: 'Quickstart & Authentication',
      duration: '1:18',
      badge: 'Getting Started',
      description: `Watch how to obtain an ephemeral sandbox key, configure client headers, and dispatch the first test query in under 60 seconds.`,
      videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      highlights: [
        'Instant API Key provisioning with zero billing required for sandbox',
        'TLS 1.3 encrypted handshake with Bearer token authentication',
        'Standard JSON response format with request ID headers for debugging',
      ],
      sampleEndpoint: `curl -X GET "${api.baseUrl || 'https://api.klyra.dev'}/v1/health" \\
  -H "Authorization: Bearer klyra_sandbox_token" \\
  -H "Accept: application/json"`,
    },
    {
      id: 'agent',
      title: 'Production Agent Tool-Calling',
      duration: '2:40',
      badge: 'Agent Architecture',
      description: `See an autonomous LangChain agent invoke ${api.name} to answer complex multi-turn prompts and execute structured data synthesis.`,
      videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      highlights: [
        'Strict JSON schema prevents model hallucinations and format drifting',
        `Sub-${api.latencyMs}ms P99 roundtrip keeps agent conversational UI fluid`,
        'Built-in idempotency keys ensure fail-safe tool retry execution',
      ],
      sampleEndpoint: `// LangChain / Vercel AI SDK Integration
const result = await generateText({
  model: openai("gpt-4o"),
  tools: { [api.slug || "apiTool"]: klyraToolDefinition },
  prompt: "Synthesize latest metrics using ${api.name}"
});`,
    },
    {
      id: 'stress',
      title: 'Edge Latency & Stress Benchmarks',
      duration: '1:55',
      badge: 'Performance & SLA',
      description: `Real-time load test simulating 5,000 concurrent requests across 8 global edge regions, showcasing sustained ${api.uptimePercentage}% SLA.`,
      videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      highlights: [
        `Median response time observed: ${Math.round(api.latencyMs * 0.85)}ms globally`,
        'Zero dropped packets under sustained 2,500 req/sec burst concurrency',
        'Automated multi-region failover triggered in < 80ms without downtime',
      ],
      sampleEndpoint: `k6 run --vus 500 --duration 30s benchmark.js
✓ status is 200 (100%)
✓ http_req_duration p(95) < ${api.latencyMs}ms
✓ failure rate: 0.00%`,
    },
  ];

  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [videoProgress, setVideoProgress] = useState(25);
  const videoRef = useRef<HTMLVideoElement>(null);

  const activeChapter = chapters[activeChapterIndex];

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const progress = (videoRef.current.currentTime / (videoRef.current.duration || 1)) * 100;
    setVideoProgress(progress);
  };

  const handleSelectChapter = (index: number) => {
    setActiveChapterIndex(index);
    setIsPlaying(false);
    setVideoProgress(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.pause();
    }
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  return (
    <div className="ass-container">
      {/* Header Banner */}
      <div className="ass-header">
        <div className="ass-header-left">
          <div className="ass-kicker">
            <Video size={13} />
            <span>PROVIDER SHOWCASE & MEDIA DEMO</span>
          </div>
          <h2 className="ass-title">Experience {api.name} in Production</h2>
          <p className="ass-subtitle">
            Inspect real-time developer workflows, production benchmarks, and agent tool-calling
            patterns directly from verified maintainers.
          </p>
        </div>
        <div className="ass-header-badge">
          <span className="ass-live-indicator" />
          <span>Interactive Showcase</span>
        </div>
      </div>

      {/* Main Media Showcase Grid */}
      <div className="ass-grid">
        {/* Left Column: Cinematic Video Player */}
        <div className="ass-player-col">
          <div className="ass-player-wrapper">
            <div className="ass-player-ambient-glow" />
            <div className="ass-video-container">
              <video
                ref={videoRef}
                src={activeChapter.videoUrl}
                poster={api.logoUrl}
                muted={isMuted}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                playsInline
                className="ass-video"
              />

              {/* Big Play Button Overlay when paused */}
              {!isPlaying && (
                <div className="ass-video-overlay-play" onClick={togglePlay}>
                  <div className="ass-play-btn-circle">
                    <Play size={28} className="ass-play-icon" />
                  </div>
                  <div className="ass-overlay-title">
                    <h4>{activeChapter.title}</h4>
                    <span>Click to start interactive preview</span>
                  </div>
                </div>
              )}

              {/* Top Meta Overlay */}
              <div className="ass-video-top-bar">
                <span className="ass-badge-chapter">
                  Chapter {activeChapterIndex + 1} of {chapters.length}: {activeChapter.badge}
                </span>
                <span className="ass-badge-res">1080p 60fps Sandbox Demo</span>
              </div>

              {/* Bottom Custom Media Controls */}
              <div className="ass-controls-bar">
                {/* Scrubber */}
                <div
                  className="ass-scrubber"
                  onClick={(e) => {
                    if (!videoRef.current) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickPos = (e.clientX - rect.left) / rect.width;
                    videoRef.current.currentTime = clickPos * (videoRef.current.duration || 1);
                  }}
                >
                  <div className="ass-scrubber-track">
                    <div className="ass-scrubber-fill" style={{ width: `${videoProgress}%` }} />
                  </div>
                </div>

                <div className="ass-controls-row">
                  <div className="ass-controls-left">
                    <button className="ass-ctrl-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                      {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <button className="ass-ctrl-btn" onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
                      {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <span className="ass-time-display">
                      {activeChapter.duration}
                    </span>
                  </div>

                  <div className="ass-controls-right">
                    <span className="ass-chapter-title-tiny">{activeChapter.title}</span>
                    <button className="ass-ctrl-btn" onClick={handleFullscreen} title="Fullscreen">
                      <Maximize2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chapter Selector Strip */}
          <div className="ass-chapters-strip">
            {chapters.map((chap, idx) => (
              <button
                key={chap.id}
                className={`ass-chapter-card ${activeChapterIndex === idx ? 'active' : ''}`}
                onClick={() => handleSelectChapter(idx)}
              >
                <div className="ass-chapter-num">0{idx + 1}</div>
                <div className="ass-chapter-info">
                  <div className="ass-chapter-top">
                    <span className="ass-chapter-label">{chap.badge}</span>
                    <span className="ass-chapter-time">{chap.duration}</span>
                  </div>
                  <h4 className="ass-chapter-heading">{chap.title}</h4>
                </div>
                {activeChapterIndex === idx && <span className="ass-active-pip" />}
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Provider Context & Chapter Snapshot */}
        <div className="ass-sidebar-col">
          {/* Provider Card */}
          <div className="ass-provider-card">
            <div className="ass-provider-header">
              <div className="ass-provider-avatar-box">
                {api.ownerAvatarUrl ? (
                  <img src={api.ownerAvatarUrl} alt={api.ownerName} className="ass-provider-avatar" />
                ) : (
                  <div className="ass-provider-avatar-ph">{api.ownerName.charAt(0)}</div>
                )}
                <div className="ass-verified-dot" title="Verified Tier-1 Provider">
                  <ShieldCheck size={12} color="#fff" />
                </div>
              </div>
              <div className="ass-provider-titles">
                <div className="ass-provider-name-row">
                  <h4>{api.ownerName}</h4>
                  <span className="ass-verified-label">
                    <ShieldCheck size={11} /> Verified Partner
                  </span>
                </div>
                <span className="ass-provider-company">
                  {api.ownerCompany || 'Official API Maintainer'}
                </span>
              </div>
            </div>

            <p className="ass-provider-statement">
              "We maintain {api.name} to deliver enterprise-grade deterministic reliability with
              guaranteed sub-{api.latencyMs}ms response latency for production workloads."
            </p>

            <div className="ass-provider-metrics">
              <div className="ass-pm-box">
                <span className="ass-pm-val">{'< 15m'}</span>
                <span className="ass-pm-lbl">Avg Response</span>
              </div>
              <div className="ass-pm-box">
                <span className="ass-pm-val">4.9 ★</span>
                <span className="ass-pm-lbl">SLA Rating</span>
              </div>
              <div className="ass-pm-box">
                <span className="ass-pm-val">Tier 1</span>
                <span className="ass-pm-lbl">Gold Status</span>
              </div>
            </div>

            {onOpenProvider && (
              <button
                className="ass-provider-action-btn"
                onClick={() => onOpenProvider(api.ownerId)}
              >
                <span>View Maintainer Profile</span>
                <ExternalLink size={13} />
              </button>
            )}
          </div>

          {/* Active Chapter Details & Key Highlights */}
          <div className="ass-chapter-details-card">
            <div className="ass-cd-header">
              <Sparkles size={14} className="ass-cd-icon" />
              <span>KEY DEMO TAKEAWAYS</span>
            </div>
            <h4 className="ass-cd-title">{activeChapter.title}</h4>
            <p className="ass-cd-desc">{activeChapter.description}</p>

            <div className="ass-highlights-list">
              {activeChapter.highlights.map((highlight, i) => (
                <div key={i} className="ass-highlight-item">
                  <CheckCircle2 size={14} className="ass-h-check" />
                  <span>{highlight}</span>
                </div>
              ))}
            </div>

            {/* Code Snapshot */}
            <div className="ass-endpoint-snapshot">
              <div className="ass-es-top">
                <div className="ass-es-label">
                  <FileCode size={12} />
                  <span>Runnable Snapshot</span>
                </div>
                <span className={`ass-es-badge ${!canAccess ? 'locked' : ''}`}>
                  {canAccess ? 'Ready to execute' : 'Preview (Locked)'}
                </span>
              </div>
              <div className="ass-code-body-wrapper">
                <pre className={`ass-es-code ${!canAccess ? 'blurred-code' : ''}`}>
                  <code>
                    {canAccess
                      ? activeChapter.sampleEndpoint
                      : activeChapter.sampleEndpoint.split('\n').slice(0, 2).join('\n') +
                        '\n// ... [remaining snippet locked]'}
                  </code>
                </pre>
                {!canAccess && (
                  <div className="ass-code-blur-overlay">
                    <button className="ass-unlock-code-btn" onClick={onSubscribe}>
                      <Lock size={13} />
                      <span>Subscribe to unlock full code</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {onOpenTester && (
              canAccess ? (
                <button
                  className="ass-launch-tester-btn subscribed"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('klyra:open-playground', {
                        detail: {
                          repoId: api.id,
                          repoName: api.name,
                          baseUrl: api.baseUrl,
                        },
                      })
                    );
                  }}
                >
                  <Terminal size={15} />
                  <span>Open in Playground</span>
                  <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  className="ass-launch-tester-btn locked"
                  onClick={onSubscribe}
                  title="Subscription required to launch interactive sandbox"
                >
                  <Lock size={14} className="ass-lock-icon" />
                  <span>Subscription Required</span>
                  <span className="ass-sub-pill">Unlock Sandbox</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <style>{`
        .ass-container {
          display: flex;
          flex-direction: column;
          gap: 22px;
          animation: fadeIn 0.3s ease;
        }

        .ass-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .ass-kicker {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent-purple);
          margin-bottom: 4px;
        }

        .ass-title {
          font-size: 24px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.01em;
          margin-bottom: 6px;
        }

        .ass-subtitle {
          font-size: 13.5px;
          color: var(--text-secondary);
          max-width: 720px;
          line-height: 1.6;
        }

        .ass-header-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          flex-shrink: 0;
        }

        .ass-live-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--status-active);
          box-shadow: 0 0 8px var(--status-active);
        }

        /* Grid */
        .ass-grid {
          display: grid;
          grid-template-columns: 1.35fr 1fr;
          gap: 20px;
          align-items: stretch;
          min-height: 480px;
        }

        /* Player Column */
        .ass-player-col {
          display: flex;
          flex-direction: column;
          gap: 14px;
          height: 100%;
          justify-content: space-between;
        }

        .ass-player-wrapper {
          position: relative;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .ass-player-ambient-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(139, 92, 246, 0.25), transparent 70%);
          filter: blur(28px);
          opacity: 0.7;
          pointer-events: none;
        }

        .ass-video-container {
          position: relative;
          flex: 1;
          min-height: 380px;
          background: #06070a;
          border-radius: var(--radius-xl);
          border: 1px solid rgba(139, 92, 246, 0.35);
          overflow: hidden;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
        }

        .ass-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          flex: 1;
        }

        /* Overlay Play */
        .ass-video-overlay-play {
          position: absolute;
          inset: 0;
          background: rgba(8, 9, 15, 0.65);
          backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .ass-video-overlay-play:hover {
          background: rgba(8, 9, 15, 0.5);
        }

        .ass-play-btn-circle {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--accent-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 28px rgba(139, 92, 246, 0.6);
          transition: transform 0.2s ease;
        }

        .ass-video-overlay-play:hover .ass-play-btn-circle {
          transform: scale(1.08);
        }

        .ass-play-icon {
          color: #fff;
          margin-left: 3px;
        }

        .ass-overlay-title {
          text-align: center;
        }

        .ass-overlay-title h4 {
          font-size: 16px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 2px;
        }

        .ass-overlay-title span {
          font-size: 11.5px;
          color: var(--text-secondary);
        }

        /* Video Top Bar */
        .ass-video-top-bar {
          position: absolute;
          top: 14px;
          left: 16px;
          right: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          pointer-events: none;
        }

        .ass-badge-chapter {
          background: rgba(11, 12, 20, 0.82);
          backdrop-filter: blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 999px;
        }

        .ass-badge-res {
          background: rgba(11, 12, 20, 0.82);
          backdrop-filter: blur(6px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: var(--status-active);
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 999px;
        }

        /* Bottom Controls */
        .ass-controls-bar {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(to top, rgba(5, 6, 10, 0.92) 0%, transparent 100%);
          padding: 10px 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ass-scrubber {
          width: 100%;
          height: 8px;
          display: flex;
          align-items: center;
          cursor: pointer;
        }

        .ass-scrubber-track {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 999px;
          overflow: hidden;
          position: relative;
        }

        .ass-scrubber-fill {
          height: 100%;
          background: var(--accent-gradient);
          transition: width 0.1s linear;
        }

        .ass-controls-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ass-controls-left,
        .ass-controls-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ass-ctrl-btn {
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.85;
          transition: opacity 0.15s;
        }

        .ass-ctrl-btn:hover {
          opacity: 1;
          color: var(--accent-purple);
        }

        .ass-time-display {
          font-size: 11px;
          font-family: var(--font-mono);
          color: #cbd5e1;
        }

        .ass-chapter-title-tiny {
          font-size: 11px;
          color: var(--text-secondary);
          font-weight: 500;
        }

        /* Chapter Cards Strip */
        .ass-chapters-strip {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .ass-chapter-card {
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          text-align: left;
          position: relative;
          transition: all 0.2s ease;
        }

        .ass-chapter-card:hover {
          background: var(--bg-card-hover);
          border-color: rgba(139, 92, 246, 0.3);
        }

        .ass-chapter-card.active {
          background: rgba(139, 92, 246, 0.1);
          border-color: var(--accent-purple);
        }

        .ass-chapter-num {
          font-size: 16px;
          font-weight: 800;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .ass-chapter-card.active .ass-chapter-num {
          color: var(--accent-purple);
        }

        .ass-chapter-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .ass-chapter-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ass-chapter-label {
          font-size: 10px;
          font-weight: 700;
          color: var(--accent-purple);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .ass-chapter-time {
          font-size: 10px;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .ass-chapter-heading {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ass-active-pip {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent-purple);
        }

        /* Sidebar Column */
        .ass-sidebar-col {
          display: flex;
          flex-direction: column;
          gap: 14px;
          height: 100%;
          min-height: 0;
        }

        .ass-provider-card {
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 0 0 auto;
        }

        .ass-chapter-details-card {
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
          justify-content: space-between;
        }

        .ass-provider-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ass-provider-avatar-box {
          position: relative;
          width: 44px;
          height: 44px;
          flex-shrink: 0;
        }

        .ass-provider-avatar {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }

        .ass-provider-avatar-ph {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: var(--accent-gradient);
          color: #fff;
          font-size: 18px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ass-verified-dot {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid var(--bg-card);
        }

        .ass-provider-titles {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
          flex: 1;
        }

        .ass-provider-name-row {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }

        .ass-provider-name-row h4 {
          font-size: 14.5px;
          font-weight: 700;
          color: var(--text-primary);
          white-space: nowrap;
        }

        .ass-verified-label {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 10px;
          font-weight: 700;
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.12);
          padding: 2px 8px;
          border-radius: 999px;
          white-space: nowrap;
          line-height: 1.4;
          flex-shrink: 0;
        }

        .ass-provider-company {
          font-size: 11.5px;
          color: var(--text-muted);
        }

        .ass-provider-statement {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.55;
          font-style: italic;
          border-left: 2px solid var(--accent-purple);
          padding-left: 10px;
        }

        .ass-provider-metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          background: var(--bg-input);
          padding: 10px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
        }

        .ass-pm-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .ass-pm-val {
          font-size: 13px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .ass-pm-lbl {
          font-size: 9.5px;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .ass-provider-action-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px;
          border-radius: var(--radius-md);
          background: var(--bg-pill);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .ass-provider-action-btn:hover {
          color: var(--text-primary);
          border-color: var(--accent-purple);
        }

        /* Chapter Details Card */
        .ass-cd-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: var(--accent-purple);
        }

        .ass-cd-icon {
          color: var(--accent-purple);
        }

        .ass-cd-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .ass-cd-desc {
          font-size: 12.5px;
          color: var(--text-secondary);
          line-height: 1.55;
        }

        .ass-highlights-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ass-highlight-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.45;
        }

        .ass-h-check {
          color: var(--status-active);
          flex-shrink: 0;
          margin-top: 2px;
        }

        /* Snapshot */
        .ass-endpoint-snapshot {
          background: #090a10;
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .ass-es-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid var(--border-subtle);
          font-size: 10.5px;
          color: var(--text-muted);
        }

        .ass-es-label {
          display: flex;
          align-items: center;
          gap: 5px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .ass-es-badge {
          color: var(--status-active);
          font-size: 9.5px;
          font-weight: 700;
        }

        .ass-es-code {
          padding: 10px 12px;
          margin: 0;
          font-family: var(--font-mono);
          font-size: 11px;
          color: #a78bfa;
          overflow-x: auto;
          white-space: pre-wrap;
          line-height: 1.5;
        }

        .ass-launch-tester-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px;
          border-radius: var(--radius-md);
          background: var(--accent-gradient);
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          box-shadow: var(--shadow-purple);
          transition: all 0.2s;
        }

        .ass-launch-tester-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.1);
        }

        .ass-code-body-wrapper {
          position: relative;
          overflow: hidden;
        }

        .ass-es-code.blurred-code {
          filter: blur(3px);
          user-select: none;
          -webkit-user-select: none;
          pointer-events: none;
          opacity: 0.55;
        }

        .ass-code-blur-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, rgba(9, 10, 16, 0.2) 0%, rgba(9, 10, 16, 0.82) 55%, rgba(9, 10, 16, 0.95) 100%);
          backdrop-filter: blur(2px);
          z-index: 5;
        }

        .ass-unlock-code-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(139, 92, 246, 0.22);
          border: 1px solid rgba(167, 139, 250, 0.55);
          color: #e2e8f0;
          font-size: 11.5px;
          font-weight: 600;
          padding: 7px 16px;
          border-radius: 999px;
          cursor: pointer;
          box-shadow: 0 4px 20px rgba(139, 92, 246, 0.35);
          backdrop-filter: blur(8px);
          transition: all 0.2s ease;
          animation: assPulseUnlockPill 2.8s ease-in-out infinite;
        }

        .ass-unlock-code-btn:hover {
          background: rgba(139, 92, 246, 0.4);
          border-color: rgba(192, 132, 252, 0.9);
          color: #fff;
          transform: translateY(-1px) scale(1.02);
          box-shadow: 0 6px 24px rgba(139, 92, 246, 0.55);
        }

        @keyframes assPulseUnlockPill {
          0%, 100% {
            border-color: rgba(167, 139, 250, 0.4);
            box-shadow: 0 4px 16px rgba(139, 92, 246, 0.25);
          }
          50% {
            border-color: rgba(192, 132, 252, 0.85);
            box-shadow: 0 4px 24px rgba(192, 132, 252, 0.45);
          }
        }

        .ass-es-badge.locked {
          color: #fbbf24;
        }

        .ass-launch-tester-btn.locked {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.4);
          color: #fbbf24;
          box-shadow: 0 0 12px rgba(245, 158, 11, 0.15);
          animation: assBtnLockedPulse 2.4s ease-in-out infinite;
        }

        .ass-launch-tester-btn.locked:hover {
          background: rgba(245, 158, 11, 0.18);
          border-color: rgba(245, 158, 11, 0.7);
          color: #fef08a;
          transform: translateY(-1px);
        }

        @keyframes assBtnLockedPulse {
          0%, 100% { box-shadow: 0 0 10px rgba(245, 158, 11, 0.12); }
          50% { box-shadow: 0 0 18px rgba(245, 158, 11, 0.3); }
        }

        .ass-sub-pill {
          background: rgba(245, 158, 11, 0.2);
          color: #fde68a;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-left: 4px;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .ass-grid {
            grid-template-columns: 1fr;
          }
          .ass-chapters-strip {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
