import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  Search,
  ArrowRight,
  Code2,
  GitBranch,
  Shield,
  Globe,
  Terminal,
  Layers,
  Sparkles,
  Zap,
  Check,
  CheckCircle2,
  Play,
  Copy,
  Server,
  Key,
  Users,
  Lock,
  Workflow,
  Menu,
  X,
  ExternalLink,
  ChevronRight,
  Cpu,
  BarChart3,
} from 'lucide-react';
import klyraLogo from '../../assets/images/klyra_logo.png';
import { HeroOrbitAnimation } from './components/HeroOrbitAnimation';
import './LandingPage.css';

interface LandingPageProps {
  onOpenLogin: () => void;
  onOpenRegister: (email?: string) => void;
}

type LangTab = 'curl' | 'typescript' | 'python' | 'go';
const HERO_TITLE = 'Where the world builds, tests, and scales APIs.';

const CODE_SNIPPETS: Record<LangTab, { code: React.ReactNode; filename: string }> = {
  curl: {
    filename: 'test-endpoint.sh',
    code: (
      <>
        <span className="gh-code-comment"># 1. Authenticate with Klyra Edge Gateway</span>
        <br />
        <span className="gh-code-keyword">curl</span> -X POST https://api.klyra.dev/v1/checkout/session \
        <br />
        &nbsp;&nbsp;-H <span className="gh-code-string">"Authorization: Bearer kly_live_9a87f2..."</span> \
        <br />
        &nbsp;&nbsp;-H <span className="gh-code-string">"Content-Type: application/json"</span> \
        <br />
        &nbsp;&nbsp;-d <span className="gh-code-string">'{`{`}</span>
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span className="gh-code-property">"customer_id"</span>: <span className="gh-code-string">"cus_8941f2"</span>,
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span className="gh-code-property">"currency"</span>: <span className="gh-code-string">"USD"</span>,
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span className="gh-code-property">"amount"</span>: <span className="gh-code-number">4900</span>,
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span className="gh-code-property">"sandbox"</span>: <span className="gh-code-keyword">true</span>
        <br />
        &nbsp;&nbsp;<span className="gh-code-string">{`}'`}</span>
      </>
    ),
  },
  typescript: {
    filename: 'client.ts',
    code: (
      <>
        <span className="gh-code-keyword">import</span> {`{ KlyraClient }`} <span className="gh-code-keyword">from</span> <span className="gh-code-string">'@klyra/sdk'</span>;
        <br /><br />
        <span className="gh-code-keyword">const</span> client = <span className="gh-code-keyword">new</span> <span className="gh-code-func">KlyraClient</span>({`{`}
        <br />
        &nbsp;&nbsp;apiKey: process.env.<span className="gh-code-property">KLYRA_API_KEY</span>,
        <br />
        &nbsp;&nbsp;environment: <span className="gh-code-string">'sandbox'</span>,
        <br />
        {`}`});
        <br /><br />
        <span className="gh-code-keyword">const</span> session = <span className="gh-code-keyword">await</span> client.checkout.<span className="gh-code-func">createSession</span>({`{`}
        <br />
        &nbsp;&nbsp;customerId: <span className="gh-code-string">'cus_8941f2'</span>,
        <br />
        &nbsp;&nbsp;amount: <span className="gh-code-number">4900</span>,
        <br />
        &nbsp;&nbsp;currency: <span className="gh-code-string">'USD'</span>,
        <br />
        {`}`});
        <br />
        console.<span className="gh-code-func">log</span>(session.url);
      </>
    ),
  },
  python: {
    filename: 'service.py',
    code: (
      <>
        <span className="gh-code-keyword">from</span> klyra <span className="gh-code-keyword">import</span> KlyraClient
        <br /><br />
        client = <span className="gh-code-func">KlyraClient</span>(
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;api_key=<span className="gh-code-string">"kly_live_9a87f2..."</span>,
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;env=<span className="gh-code-string">"sandbox"</span>
        <br />
        )
        <br /><br />
        session = client.checkout.<span className="gh-code-func">create_session</span>(
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;customer_id=<span className="gh-code-string">"cus_8941f2"</span>,
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;amount=<span className="gh-code-number">4900</span>,
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;currency=<span className="gh-code-string">"USD"</span>
        <br />
        )
        <br />
        <span className="gh-code-keyword">print</span>(session.id, session.status)
      </>
    ),
  },
  go: {
    filename: 'main.go',
    code: (
      <>
        <span className="gh-code-keyword">package</span> main
        <br /><br />
        <span className="gh-code-keyword">import</span> (
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span className="gh-code-string">"context"</span>
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;<span className="gh-code-string">"github.com/klyra/sdk-go"</span>
        <br />
        )
        <br /><br />
        <span className="gh-code-keyword">func</span> <span className="gh-code-func">main</span>() {`{`}
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;client := klyra.<span className="gh-code-func">NewClient</span>(<span className="gh-code-string">"kly_live_9a87f2..."</span>)
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;resp, _ := client.Checkout.<span className="gh-code-func">CreateSession</span>(ctx, &klyra.SessionParams{`{`}
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;CustomerID: <span className="gh-code-string">"cus_8941f2"</span>,
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Amount: <span className="gh-code-number">4900</span>,
        <br />
        &nbsp;&nbsp;&nbsp;&nbsp;{`}`})
        <br />
        {`}`}
      </>
    ),
  },
};

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenLogin, onOpenRegister }) => {
  const [heroEmail, setHeroEmail] = useState('');
  const [finaleEmail, setFinaleEmail] = useState('');
  const [heroTitleLength, setHeroTitleLength] = useState(0);
  const [activeLang, setActiveLang] = useState<LangTab>('curl');
  const [isExecuting, setIsExecuting] = useState(false);
  const [execCount, setExecCount] = useState(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const title = HERO_TITLE;
    let length = 0;
    let deleting = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const advanceTitle = () => {
      if (!deleting) {
        length += 1;
        setHeroTitleLength(length);
        if (length === title.length) {
          deleting = true;
          timeoutId = setTimeout(advanceTitle, 1100);
          return;
        }
        timeoutId = setTimeout(advanceTitle, 72);
        return;
      }

      length -= 1;
      setHeroTitleLength(length);
      if (length === 0) {
        deleting = false;
        timeoutId = setTimeout(advanceTitle, 450);
        return;
      }
      timeoutId = setTimeout(advanceTitle, 42);
    };

    timeoutId = setTimeout(advanceTitle, 250);
    return () => clearTimeout(timeoutId);
  }, []);

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenRegister(heroEmail);
  };

  const handleFinaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenRegister(finaleEmail);
  };

  const handleSimulateExecution = () => {
    setIsExecuting(true);
    setTimeout(() => {
      setIsExecuting(false);
      setExecCount((prev) => prev + 1);
    }, 450);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="gh-landing-container">
      {/* Background ambient pattern */}
      <div className="gh-ambient-canvas" />

      {/* ==========================================================================
          GITHUB-INSPIRED NAVIGATION HEADER
          ========================================================================== */}
      <header className="gh-nav-header">
        <div className="gh-nav-inner">
          <div className="gh-nav-left">
            <div className="gh-nav-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <img src={klyraLogo} alt="Klyra Logo" className="gh-nav-logo" />
              <span className="gh-nav-brand-text">KLYRA</span>
            </div>

            <ul className="gh-nav-links">
              {/* Product Flyout */}
              <li className="gh-nav-link-item">
                <button type="button" className="gh-nav-link" onClick={() => scrollToSection('productivity')}>
                  Product <ChevronDown size={14} />
                </button>
                <div className="gh-dropdown-flyout">
                  <div className="gh-dropdown-item" onClick={() => scrollToSection('productivity')}>
                    <div className="gh-dropdown-icon">
                      <Code2 size={16} />
                    </div>
                    <div>
                      <span className="gh-dropdown-title">Visual API Builder</span>
                      <span className="gh-dropdown-desc">Design routes, models, and real-time mocks visually</span>
                    </div>
                  </div>
                  <div className="gh-dropdown-item" onClick={() => scrollToSection('collaboration')}>
                    <div className="gh-dropdown-icon">
                      <GitBranch size={16} />
                    </div>
                    <div>
                      <span className="gh-dropdown-title">Git-Backed Repositories</span>
                      <span className="gh-dropdown-desc">Branch, review diffs, and validate contracts</span>
                    </div>
                  </div>
                  <div className="gh-dropdown-item" onClick={() => scrollToSection('security')}>
                    <div className="gh-dropdown-icon">
                      <Shield size={16} />
                    </div>
                    <div>
                      <span className="gh-dropdown-title">Zero-Trust Gateway</span>
                      <span className="gh-dropdown-desc">Token scoping, rate limits, and threat defense</span>
                    </div>
                  </div>
                  <div className="gh-dropdown-item" onClick={() => scrollToSection('scale')}>
                    <div className="gh-dropdown-icon">
                      <Globe size={16} />
                    </div>
                    <div>
                      <span className="gh-dropdown-title">Global Marketplace</span>
                      <span className="gh-dropdown-desc">Monetize and distribute APIs worldwide</span>
                    </div>
                  </div>
                </div>
              </li>

              {/* Solutions Flyout */}
              <li className="gh-nav-link-item">
                <button type="button" className="gh-nav-link" onClick={() => scrollToSection('collaboration')}>
                  Solutions <ChevronDown size={14} />
                </button>
                <div className="gh-dropdown-flyout">
                  <div className="gh-dropdown-item" onClick={() => scrollToSection('collaboration')}>
                    <div className="gh-dropdown-icon">
                      <Users size={16} />
                    </div>
                    <div>
                      <span className="gh-dropdown-title">Engineering Teams</span>
                      <span className="gh-dropdown-desc">Unify backend and frontend API workflows</span>
                    </div>
                  </div>
                  <div className="gh-dropdown-item" onClick={() => scrollToSection('security')}>
                    <div className="gh-dropdown-icon">
                      <Lock size={16} />
                    </div>
                    <div>
                      <span className="gh-dropdown-title">Enterprise Security</span>
                      <span className="gh-dropdown-desc">SOC2 compliance and strict access audits</span>
                    </div>
                  </div>
                  <div className="gh-dropdown-item" onClick={() => scrollToSection('scale')}>
                    <div className="gh-dropdown-icon">
                      <Zap size={16} />
                    </div>
                    <div>
                      <span className="gh-dropdown-title">API Monetization</span>
                      <span className="gh-dropdown-desc">Metered usage billing and developer portals</span>
                    </div>
                  </div>
                </div>
              </li>

              <li className="gh-nav-link-item">
                <button type="button" className="gh-nav-link" onClick={() => scrollToSection('scale')}>
                  Marketplace
                </button>
              </li>

              <li className="gh-nav-link-item">
                <button type="button" className="gh-nav-link" onClick={() => scrollToSection('pricing')}>
                  Pricing
                </button>
              </li>

              <li className="gh-nav-link-item">
                <button type="button" className="gh-nav-link" onClick={() => scrollToSection('productivity')}>
                  Docs
                </button>
              </li>
            </ul>
          </div>

          <div className="gh-nav-right">
            {/* Search Input Box */}
            <div className="gh-nav-search-bar" onClick={() => onOpenLogin()}>
              <Search size={14} />
              <span>Search or jump to...</span>
              <span className="gh-search-key">/</span>
            </div>

            {/* GitHub-Inspired Login & Sign Up UI designed specifically for the Landing Page */}
            <div className="gh-nav-auth">
              <button
                type="button"
                className="gh-btn-signin"
                onClick={onOpenLogin}
                id="gh-landing-signin-btn"
              >
                Sign in
              </button>
              <button
                type="button"
                className="gh-btn-signup"
                onClick={() => onOpenRegister()}
                id="gh-landing-signup-btn"
              >
                Sign up
              </button>
            </div>

            {/* Mobile Hamburger */}
            <button
              type="button"
              className="gh-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div style={{
            background: '#0d1117',
            borderBottom: '1px solid var(--gh-border)',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <button
              type="button"
              className="gh-nav-link"
              style={{ textAlign: 'left', width: '100%' }}
              onClick={() => scrollToSection('productivity')}
            >
              Product & Features
            </button>
            <button
              type="button"
              className="gh-nav-link"
              style={{ textAlign: 'left', width: '100%' }}
              onClick={() => scrollToSection('collaboration')}
            >
              Collaboration & Repositories
            </button>
            <button
              type="button"
              className="gh-nav-link"
              style={{ textAlign: 'left', width: '100%' }}
              onClick={() => scrollToSection('scale')}
            >
              Marketplace
            </button>
            <button
              type="button"
              className="gh-nav-link"
              style={{ textAlign: 'left', width: '100%' }}
              onClick={() => scrollToSection('pricing')}
            >
              Pricing
            </button>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--gh-border)' }}>
              <button
                type="button"
                className="gh-btn-signin"
                style={{ flex: 1, textAlign: 'center' }}
                onClick={() => { setMobileMenuOpen(false); onOpenLogin(); }}
              >
                Sign in
              </button>
              <button
                type="button"
                className="gh-btn-signup"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => { setMobileMenuOpen(false); onOpenRegister(); }}
              >
                Sign up
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ==========================================================================
          MAIN CONTAINER WITH GITHUB'S VISUAL SPINE (VERTICAL CONNECTING LINE)
          ========================================================================== */}
      <main className="gh-main-layout">
        <div className="gh-content-container">
          {/* Continuous Vertical Spine connecting sections */}
          <div className="gh-vertical-spine">
            <div className="gh-spine-node purple" style={{ top: 120 }}>
              <Code2 size={16} />
            </div>
            <div className="gh-spine-node cyan" style={{ top: 1100 }}>
              <GitBranch size={16} />
            </div>
            <div className="gh-spine-node green" style={{ top: 2000 }}>
              <Shield size={16} />
            </div>
            <div className="gh-spine-node amber" style={{ top: 2850 }}>
              <Globe size={16} />
            </div>
          </div>

          {/* ==========================================================================
              HERO SECTION
              ========================================================================== */}
          <section className="gh-hero-section">
            <div className="gh-announcement-pill" onClick={() => onOpenRegister()}>
              <span className="gh-badge-sparkle">New</span>
              <span>Announcing Klyra 2.0: Instant API Sandboxing & OpenAPI Engine</span>
              <ChevronRight size={14} />
            </div>

                        {/* Circular/orbital API animation on the right side of the hero section */}
            <HeroOrbitAnimation />

            <h1 className="gh-hero-heading" aria-label={HERO_TITLE}>
              <span className="gh-hero-title-layout" aria-hidden="true">
                <span className="gh-hero-title-base">Where the world</span>
                <span className="gh-hero-gradient-text">builds, tests, and scales APIs.</span>
              </span>
              <span className="gh-hero-title-animated" aria-hidden="true">
                <span className="gh-hero-title-base">
                  {HERO_TITLE.slice(0, heroTitleLength).slice(0, 15) || '\u00a0'}
                </span>
                <span className="gh-hero-gradient-text">
                  {HERO_TITLE.slice(16).split('').map((character, index) => (
                    <span key={index} style={{ visibility: index < heroTitleLength - 16 ? 'visible' : 'hidden' }}>
                      {character}
                    </span>
                  ))}
                </span>
              </span>
            </h1>

            <p className="gh-hero-description">
              The AI-native platform for modern API engineering. Design visual endpoints, test in isolated sandboxes,
              collaborate with Git-backed versioning, and monetize in the global developer marketplace.
            </p>

            {/* GitHub Signature Hero CTA: Input + Sign Up Button */}
            <div className="gh-hero-cta-wrapper">
              <form className="gh-hero-form" onSubmit={handleHeroSubmit}>
                <input
                  type="email"
                  className="gh-hero-input"
                  placeholder="Enter your email address"
                  value={heroEmail}
                  onChange={(e) => setHeroEmail(e.target.value)}
                />
                <button type="submit" className="gh-hero-submit-btn">
                  <span>Sign up for Klyra</span>
                  <ArrowRight size={15} />
                </button>
              </form>

              <button
                type="button"
                className="gh-hero-trial-link"
                onClick={() => onOpenRegister()}
              >
                <span>Start a free trial</span>
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Hero Social Credibility Bar */}
            <div className="gh-hero-stats-row">
              <div className="gh-stat-item">
                <span className="gh-stat-dot" />
                <span><strong>50,000+</strong> developers building</span>
              </div>
              <div className="gh-stat-item">
                <span>·</span>
                <span><strong>10,000,000+</strong> monthly API calls</span>
              </div>
              <div className="gh-stat-item">
                <span>·</span>
                <span><strong>99.999%</strong> edge SLA uptime</span>
              </div>
            </div>

            {/* ==========================================================================
                INTERACTIVE SHOWCASE (GitHub-Style Code & Sandbox Mockup)
                ========================================================================== */}
            <div className="gh-interactive-showcase">
              <div className="gh-window-header">
                <div className="gh-window-controls">
                  <span className="gh-control-dot red" />
                  <span className="gh-control-dot yellow" />
                  <span className="gh-control-dot green" />
                </div>

                <div className="gh-window-title">
                  <span>api.klyra.dev/v1/checkout/session</span>
                  <span className="gh-window-title-badge">SANDBOX ACTIVE</span>
                </div>

                <div className="gh-window-actions">
                  <div className="gh-lang-tabs">
                    {(['curl', 'typescript', 'python', 'go'] as LangTab[]).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        className={`gh-lang-tab ${activeLang === tab ? 'active' : ''}`}
                        onClick={() => setActiveLang(tab)}
                      >
                        {tab.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="gh-execute-btn"
                    onClick={handleSimulateExecution}
                    disabled={isExecuting}
                  >
                    <Play size={12} fill="#4ade80" />
                    <span>{isExecuting ? 'Running...' : 'Run Request'}</span>
                  </button>
                </div>
              </div>

              <div className="gh-showcase-body">
                {/* Code Window */}
                <div className="gh-showcase-code">
                  <div style={{ color: '#6e7681', fontSize: 11, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Terminal size={12} />
                    <span>{CODE_SNIPPETS[activeLang].filename}</span>
                  </div>
                  <div>{CODE_SNIPPETS[activeLang].code}</div>
                </div>

                {/* Live Sandbox Response Window */}
                <div className="gh-showcase-response">
                  <div className="gh-res-meta">
                    <span className="gh-res-status">
                      <CheckCircle2 size={13} />
                      <span>200 OK</span>
                    </span>
                    <div className="gh-res-timing">
                      <span>⚡ 14ms</span>
                      <span>📦 284 B</span>
                      <span>#req-{execCount}</span>
                    </div>
                  </div>

                  <div className="gh-res-json">
{`{
  "status": "success",
  "data": {
    "session_id": "cs_live_9f83a2c5e4",
    "customer": "cus_8941f2",
    "currency": "USD",
    "amount_total": 4900,
    "payment_status": "authorized",
    "rate_limit_remaining": 4998,
    "gateway_latency_ms": 14.2
  },
  "signature": "kly_sig_sec_e2910fa"
}`}
                  </div>
                </div>
              </div>
              <div className="gh-sandbox-demo-cursor" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M5 2.5 19.5 14l-6.2.7 3.4 5.7-2.7 1.6-3.4-5.8-3.3 5.1L5 2.5Z" />
                </svg>
              </div>
              <span className="gh-sandbox-demo-copied" aria-hidden="true">
                <Copy size={12} /> Copied
              </span>
            </div>
          </section>

          {/* ==========================================================================
              CUSTOMER LOGOS / MARQUEE
              ========================================================================== */}
          <section className="gh-logos-section">
            <h3 className="gh-logos-heading">
              Trusted by engineering teams and API-first builders worldwide
            </h3>
            <div className="gh-logos-grid">
              <div className="gh-logo-badge">▲ Vercel</div>
              <div className="gh-logo-badge">⚡ Supabase</div>
              <div className="gh-logo-badge">☁ Cloudflare</div>
              <div className="gh-logo-badge">✦ OpenAI</div>
              <div className="gh-logo-badge">◈ Stripe</div>
              <div className="gh-logo-badge">🐳 Docker</div>
              <div className="gh-logo-badge">🟧 Postman</div>
              <div className="gh-logo-badge">◬ Prisma</div>
            </div>
          </section>

          {/* ==========================================================================
              PILLAR 1: PRODUCTIVITY (Visual Builder & Testing)
              ========================================================================== */}
          <section id="productivity" className="gh-section">
            <div className="gh-section-tag purple">
              <Code2 size={15} />
              <span>Productivity</span>
            </div>

            <h2 className="gh-section-title">
              Accelerate your development cycle from hours to seconds.
            </h2>
            <p className="gh-section-desc">
              Design REST, GraphQL, and Webhook APIs visually with auto-generated schemas, real-time contract validation,
              and instant sandbox environments.
            </p>

            <div className="gh-bento-grid">
              {/* Card 1: Visual API Builder Preview */}
              <div className="gh-bento-card gh-bento-col-8">
                <div className="gh-bento-icon purple">
                  <Workflow size={22} />
                </div>
                <h3 className="gh-bento-title">Visual API Builder & Real-Time Mocking</h3>
                <p className="gh-bento-text">
                  Construct endpoints with a visual drag-and-drop workflow. Automatically synthesize realistic test data,
                  simulate edge latency, and validate JSON payloads against OpenAPI 3.1 standards.
                </p>

                <div className="gh-preview-box">
                  <div className="gh-endpoint-row">
                    <span className="gh-method-pill post">POST</span>
                    <span className="gh-endpoint-path">/v1/auth/token/rotate</span>
                    <span className="gh-endpoint-badge">Schema Validated ✓</span>
                  </div>
                  <div className="gh-endpoint-row">
                    <span className="gh-method-pill get">GET</span>
                    <span className="gh-endpoint-path">/v1/analytics/realtime/stream</span>
                    <span className="gh-endpoint-badge">WebSocket Ready</span>
                  </div>
                  <div className="gh-endpoint-row">
                    <span className="gh-method-pill put">PUT</span>
                    <span className="gh-endpoint-path">/v1/billing/subscriptions/:id</span>
                    <span className="gh-endpoint-badge">Idempotency Key</span>
                  </div>
                </div>
              </div>

              {/* Card 2: One-Click SDK Generation */}
              <div className="gh-bento-card gh-bento-col-4">
                <div className="gh-bento-icon purple">
                  <Cpu size={22} />
                </div>
                <h3 className="gh-bento-title">Automated Multi-Language SDKs</h3>
                <p className="gh-bento-text">
                  Compile production-ready client libraries for TypeScript, Python, Go, and Java with full type definitions and retry logic.
                </p>
                <div className="gh-preview-box" style={{ fontSize: 11 }}>
                  <div style={{ color: '#4ade80', marginBottom: 4 }}>✓ @klyra/sdk-node (v2.4.0)</div>
                  <div style={{ color: '#38bdf8', marginBottom: 4 }}>✓ klyra-python (v2.4.0)</div>
                  <div style={{ color: '#a78bfa' }}>✓ klyra-go (v2.4.0)</div>
                </div>
              </div>

              {/* Card 3: AI Schema Copilot */}
              <div className="gh-bento-card gh-bento-col-12">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div className="gh-bento-icon purple" style={{ display: 'inline-flex', marginBottom: 12 }}>
                      <Sparkles size={20} />
                    </div>
                    <h3 className="gh-bento-title">AI Schema Copilot</h3>
                    <p className="gh-bento-text" style={{ maxWidth: 700, marginBottom: 0 }}>
                      Describe your API requirements in plain English. Klyra synthesizes robust OpenAPI specifications,
                      generates request validation schemas, and defines comprehensive test suites instantly.
                    </p>
                  </div>
                  <div className="gh-copilot-demo" aria-label="Copilot prompt and response animation">
                    <div className="gh-copilot-demo-prompt">
                      <span className="gh-copilot-demo-user">You</span>
                      <span className="gh-copilot-demo-typed">Create a POST endpoint for user signups</span>
                      <span className="gh-copilot-demo-caret" />
                      <span className="gh-copilot-demo-enter">↵</span>
                    </div>
                    <div className="gh-copilot-demo-response">
                      <span className="gh-copilot-demo-bot"><Sparkles size={13} /> Copilot</span>
                      <span>Generated <code>POST /users</code> with email validation and a 201 response.</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="gh-btn-signup"
                    onClick={() => onOpenRegister()}
                  >
                    <span>Try Copilot in Sandbox</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ==========================================================================
              PILLAR 2: COLLABORATION (Git-Backed Repositories)
              ========================================================================== */}
          <section id="collaboration" className="gh-section">
            <div className="gh-section-tag cyan">
              <GitBranch size={15} />
              <span>Collaboration</span>
            </div>

            <h2 className="gh-section-title">
              Built for high-velocity API teams.
            </h2>
            <p className="gh-section-desc">
              Manage your APIs like source code. Branch, diff breaking changes, conduct team reviews,
              and deploy with zero downtime.
            </p>

            <div className="gh-bento-grid">
              {/* Card 1: Visual Diffs & Breaking Change Detection */}
              <div className="gh-bento-card gh-bento-col-8">
                <div className="gh-bento-icon cyan">
                  <GitBranch size={22} />
                </div>
                <h3 className="gh-bento-title">Branch-Based Previews & Visual Diffs</h3>
                <p className="gh-bento-text">
                  Automated contract change detection highlights deprecated attributes, newly required fields,
                  and response status changes before merging pull requests.
                </p>

                <div className="gh-diff-box">
                  <div className="gh-diff-line added">
                    <span>+</span>
                    <span>parameters.required: ["idempotency_key", "customer_email"]</span>
                  </div>
                  <div className="gh-diff-line removed">
                    <span>-</span>
                    <span>deprecated: true (v1/legacy/checkout)</span>
                  </div>
                  <div className="gh-diff-line unchanged">
                    <span> </span>
                    <span>response.schema: "#/components/schemas/CheckoutSessionV2"</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Team Access & Role-Based Workspaces */}
              <div className="gh-bento-card gh-bento-col-4">
                <div className="gh-bento-icon cyan">
                  <Users size={22} />
                </div>
                <h3 className="gh-bento-title">Team Workspaces & RBAC</h3>
                <p className="gh-bento-text">
                  Isolate development environments, assign granular reviewer permissions, and enforce deployment approval policies.
                </p>
                <div className="gh-preview-box">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span>Tech Lead</span>
                    <span style={{ color: '#4ade80' }}>Admin</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span>Frontend Eng</span>
                    <span style={{ color: '#38bdf8' }}>Developer</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Contractor</span>
                    <span style={{ color: '#f59e0b' }}>Tester</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ==========================================================================
              PILLAR 3: SECURITY & GOVERNANCE
              ========================================================================== */}
          <section id="security" className="gh-section">
            <div className="gh-section-tag green">
              <Shield size={15} />
              <span>Security & Governance</span>
            </div>

            <h2 className="gh-section-title">
              Bank-grade security from first commit to production.
            </h2>
            <p className="gh-section-desc">
              Zero-trust architecture, automated secret rotation, rate limiting, and DDoS protection baked directly into the gateway.
            </p>

            <div className="gh-bento-grid">
              {/* Card 1: Key Management & Scoping */}
              <div className="gh-bento-card gh-bento-col-4">
                <div className="gh-bento-icon green">
                  <Key size={22} />
                </div>
                <h3 className="gh-bento-title">Granular Token Scopes</h3>
                <p className="gh-bento-text">
                  Scope API keys by HTTP method, route, IP CIDR block, and monthly spending budget.
                </p>
                <div className="gh-preview-box">
                  <div style={{ color: '#4ade80', marginBottom: 4 }}>• Scope: read:transactions</div>
                  <div style={{ color: '#4ade80', marginBottom: 4 }}>• IP: 192.168.1.0/24</div>
                  <div style={{ color: '#38bdf8' }}>• Rate Limit: 10,000 req/min</div>
                </div>
              </div>

              {/* Card 2: Automated Threat Forensics */}
              <div className="gh-bento-card gh-bento-col-4">
                <div className="gh-bento-icon green">
                  <Shield size={22} />
                </div>
                <h3 className="gh-bento-title">Threat Forensics</h3>
                <p className="gh-bento-text">
                  Real-time machine learning monitors incoming payloads to intercept SQL injections, credential stuffing, and DDoS spikes.
                </p>
                <div className="gh-preview-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4ade80' }}>
                    <span>DDoS Shield</span>
                    <span>ACTIVE</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, color: '#38bdf8' }}>
                    <span>Anomaly Filter</span>
                    <span>0 DETECTED</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Compliance & Audit Logs */}
              <div className="gh-bento-card gh-bento-col-4">
                <div className="gh-bento-icon green">
                  <Lock size={22} />
                </div>
                <h3 className="gh-bento-title">Compliance Ready</h3>
                <p className="gh-bento-text">
                  SOC2 Type II and HIPAA compliant immutable audit logging with instant export capabilities.
                </p>
                <div className="gh-preview-box">
                  <div style={{ color: '#c9d1d9' }}>SOC2 Type II Certified</div>
                  <div style={{ color: '#8b949e', marginTop: 4 }}>256-bit AES at rest & TLS 1.3</div>
                </div>
              </div>
            </div>
          </section>

          {/* ==========================================================================
              PILLAR 4: SCALE & MARKETPLACE (Global Distribution)
              ========================================================================== */}
          <section id="scale" className="gh-section">
            <div className="gh-section-tag amber">
              <Globe size={15} />
              <span>Scale & Monetize</span>
            </div>

            <h2 className="gh-section-title">
              Turn developer tools into high-growth digital revenue.
            </h2>
            <p className="gh-section-desc">
              Publish your APIs to the Klyra Marketplace. Handle metering, subscriptions, usage-based billing,
              and payouts with integrated developer storefronts.
            </p>

            <div className="gh-bento-grid">
              <div className="gh-stat-card gh-bento-col-3">
                <div className="gh-stat-number">10M+</div>
                <div className="gh-stat-label">Daily API Transactions</div>
              </div>

              <div className="gh-stat-card gh-bento-col-3">
                <div className="gh-stat-number">99.999%</div>
                <div className="gh-stat-label">Enterprise SLA Uptime</div>
              </div>

              <div className="gh-stat-card gh-bento-col-3">
                <div className="gh-stat-number">&lt;15ms</div>
                <div className="gh-stat-label">Global Edge Latency</div>
              </div>

              <div className="gh-stat-card gh-bento-col-3">
                <div className="gh-stat-number">140+</div>
                <div className="gh-stat-label">Countries Supported</div>
              </div>
            </div>
          </section>

          {/* ==========================================================================
              PRICING TIERS SECTION (GitHub Style)
              ========================================================================== */}
          <section id="pricing" className="gh-pricing-section">
            <div className="gh-section-tag purple" style={{ justifyContent: 'center' }}>
              <Zap size={15} />
              <span>Pricing</span>
            </div>

            <h2 className="gh-section-title" style={{ margin: '0 auto 16px auto' }}>
              Transparent pricing that scales with your growth.
            </h2>
            <p className="gh-section-desc" style={{ margin: '0 auto 50px auto' }}>
              Start for free with comprehensive developer features, then upgrade when your team is ready to scale.
            </p>

            <div className="gh-pricing-grid">
              {/* Tier 1: Free Developer */}
              <div className="gh-price-card">
                <h3 className="gh-plan-name">Developer</h3>
                <p className="gh-plan-desc">Essential tools for individual developers and rapid prototyping.</p>
                <div className="gh-plan-price">
                  <span>$0</span>
                  <span className="gh-price-cycle">/ month forever</span>
                </div>

                <button
                  type="button"
                  className="gh-plan-btn"
                  onClick={() => onOpenRegister()}
                >
                  Get started free
                </button>

                <ul className="gh-plan-features">
                  <li className="gh-feature-item">
                    <Check size={16} />
                    <span>Up to 10,000 monthly API calls</span>
                  </li>
                  <li className="gh-feature-item">
                    <Check size={16} />
                    <span>Visual API Builder & Testing Sandbox</span>
                  </li>
                  <li className="gh-feature-item">
                    <Check size={16} />
                    <span>3 Public API Repositories</span>
                  </li>
                  <li className="gh-feature-item">
                    <Check size={16} />
                    <span>Community support</span>
                  </li>
                </ul>
              </div>

              {/* Tier 2: Pro / Team */}
              <div className="gh-price-card featured">
                <div className="gh-price-badge">Most Popular</div>
                <h3 className="gh-plan-name">Team Pro</h3>
                <p className="gh-plan-desc">For growing engineering teams shipping production microservices.</p>
                <div className="gh-plan-price">
                  <span>$19</span>
                  <span className="gh-price-cycle">/ user / month</span>
                </div>

                <button
                  type="button"
                  className="gh-plan-btn primary"
                  onClick={() => onOpenRegister()}
                >
                  Start free 14-day trial
                </button>

                <ul className="gh-plan-features">
                  <li className="gh-feature-item">
                    <Check size={16} />
                    <span>1,000,000 monthly API calls</span>
                  </li>
                  <li className="gh-feature-item">
                    <Check size={16} />
                    <span>Branch previews & visual diffs</span>
                  </li>
                  <li className="gh-feature-item">
                    <Check size={16} />
                    <span>Multi-language SDK auto-generation</span>
                  </li>
                  <li className="gh-feature-item">
                    <Check size={16} />
                    <span>Custom domain & SSL termination</span>
                  </li>
                  <li className="gh-feature-item">
                    <Check size={16} />
                    <span>Priority email & Slack support</span>
                  </li>
                </ul>
              </div>

              {/* Tier 3: Enterprise */}
              <div className="gh-price-card">
                <h3 className="gh-plan-name">Enterprise</h3>
                <p className="gh-plan-desc">Dedicated infrastructure, strict compliance, and custom SLAs.</p>
                <div className="gh-plan-price">
                  <span>Custom</span>
                  <span className="gh-price-cycle">volume pricing</span>
                </div>

                <button
                  type="button"
                  className="gh-plan-btn"
                  onClick={() => onOpenLogin()}
                >
                  Contact sales
                </button>

                <ul className="gh-plan-features">
                  <li className="gh-feature-item">
                    <Check size={16} />
                    <span>Unlimited API calls & edge throughput</span>
                  </li>
                  <li className="gh-feature-item">
                    <Check size={16} />
                    <span>Dedicated clusters & VPC peering</span>
                  </li>
                  <li className="gh-feature-item">
                    <Check size={16} />
                    <span>SOC2 Type II & HIPAA audit reports</span>
                  </li>
                  <li className="gh-feature-item">
                    <Check size={16} />
                    <span>SAML / SSO & advanced RBAC</span>
                  </li>
                  <li className="gh-feature-item">
                    <Check size={16} />
                    <span>24/7 dedicated solutions engineer</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* ==========================================================================
              GRAND FINALE CALL TO ACTION (GitHub Cosmic Nebula Banner)
              ========================================================================== */}
          <section className="gh-finale-section">
            <div className="gh-finale-banner">
              <h2 className="gh-finale-heading">
                The future of APIs is being built on Klyra.
              </h2>
              <p className="gh-finale-sub">
                Join over 50,000 developers building, testing, and distributing high-performance APIs.
              </p>

              <div className="gh-finale-cta-group">
                <form className="gh-finale-form" onSubmit={handleFinaleSubmit}>
                  <input
                    type="email"
                    className="gh-finale-input"
                    placeholder="Enter your work email"
                    value={finaleEmail}
                    onChange={(e) => setFinaleEmail(e.target.value)}
                  />
                  <button type="submit" className="gh-finale-btn">
                    Sign up for Klyra
                  </button>
                </form>

                <button
                  type="button"
                  className="gh-finale-signin-link"
                  onClick={onOpenLogin}
                >
                  Already have an account? Sign in →
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ==========================================================================
          FOOTER (GitHub Detailed Multi-Column Layout)
          ========================================================================== */}
      <footer className="gh-footer">
        <div className="gh-footer-inner">
          <div className="gh-footer-grid">
            <div className="gh-footer-brand-col">
              <div className="gh-footer-brand-title">
                <img src={klyraLogo} alt="Klyra Logo" style={{ width: 26, height: 26, borderRadius: 6 }} />
                <span>KLYRA</span>
              </div>
              <p style={{ lineHeight: 1.6, maxWidth: 300 }}>
                The next-generation API marketplace and developer platform. Where modern software connects and scales.
              </p>
            </div>

            <div>
              <h4 className="gh-footer-col-title">Product</h4>
              <ul className="gh-footer-links">
                <li><a className="gh-footer-link" onClick={() => scrollToSection('productivity')}>Visual API Builder</a></li>
                <li><a className="gh-footer-link" onClick={() => scrollToSection('productivity')}>Sandbox Playground</a></li>
                <li><a className="gh-footer-link" onClick={() => scrollToSection('collaboration')}>Git Repositories</a></li>
                <li><a className="gh-footer-link" onClick={() => scrollToSection('scale')}>Marketplace</a></li>
                <li><a className="gh-footer-link" onClick={() => scrollToSection('pricing')}>Pricing</a></li>
              </ul>
            </div>

            <div>
              <h4 className="gh-footer-col-title">Platform</h4>
              <ul className="gh-footer-links">
                <li><a className="gh-footer-link" onClick={() => onOpenLogin()}>Developer Hub</a></li>
                <li><a className="gh-footer-link" onClick={() => onOpenLogin()}>API Documentation</a></li>
                <li><a className="gh-footer-link" onClick={() => onOpenLogin()}>SDK Downloads</a></li>
                <li><a className="gh-footer-link" onClick={() => onOpenLogin()}>CLI Tools</a></li>
                <li><a className="gh-footer-link" onClick={() => onOpenLogin()}>System Status</a></li>
              </ul>
            </div>

            <div>
              <h4 className="gh-footer-col-title">Solutions</h4>
              <ul className="gh-footer-links">
                <li><a className="gh-footer-link" onClick={() => scrollToSection('collaboration')}>Enterprise</a></li>
                <li><a className="gh-footer-link" onClick={() => scrollToSection('collaboration')}>Startups</a></li>
                <li><a className="gh-footer-link" onClick={() => scrollToSection('security')}>Financial Services</a></li>
                <li><a className="gh-footer-link" onClick={() => scrollToSection('productivity')}>AI Agents & LLMs</a></li>
                <li><a className="gh-footer-link" onClick={() => scrollToSection('security')}>DevSecOps</a></li>
              </ul>
            </div>

            <div>
              <h4 className="gh-footer-col-title">Company</h4>
              <ul className="gh-footer-links">
                <li><a className="gh-footer-link" onClick={() => onOpenLogin()}>About Us</a></li>
                <li><a className="gh-footer-link" onClick={() => onOpenLogin()}>Blog</a></li>
                <li><a className="gh-footer-link" onClick={() => onOpenLogin()}>Careers</a></li>
                <li><a className="gh-footer-link" onClick={() => onOpenLogin()}>Press & Media</a></li>
                <li><a className="gh-footer-link" onClick={() => onOpenLogin()}>Security</a></li>
              </ul>
            </div>
          </div>

          <div className="gh-footer-bottom">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span>© 2026 Klyra, Inc. All rights reserved.</span>
              <div className="gh-footer-status">
                <span className="gh-status-dot" />
                <span>All systems operational</span>
              </div>
            </div>

            <div className="gh-social-icons">
              <span className="gh-social-link" title="GitHub" onClick={() => onOpenLogin()} style={{ cursor: 'pointer' }}>GitHub</span>
              <span className="gh-social-link" title="X (Twitter)" onClick={() => onOpenLogin()} style={{ cursor: 'pointer' }}>X</span>
              <span className="gh-social-link" title="Discord" onClick={() => onOpenLogin()} style={{ cursor: 'pointer' }}>Discord</span>
              <span className="gh-social-link" title="LinkedIn" onClick={() => onOpenLogin()} style={{ cursor: 'pointer' }}>LinkedIn</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
