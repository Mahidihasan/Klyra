import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  ShieldCheck,
  Cpu,
  Layers,
  Code2,
  Copy,
  Check,
  Terminal,
  Activity,
  Workflow,
  ExternalLink,
  ChevronRight,
  Gauge,
  Lock,
  Boxes,
  Tag as TagIcon,
  Flame,
} from 'lucide-react';
import { CatalogApi } from '../../../services/api/catalog';

interface ApiOverviewSectionProps {
  api: CatalogApi;
  onOpenTester?: (api: CatalogApi) => void;
}

export const ApiOverviewSection: React.FC<ApiOverviewSectionProps> = ({ api, onOpenTester }) => {
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<'agent' | 'stream' | 'batch'>('agent');
  const [copiedCode, setCopiedCode] = useState(false);
  const [activePillar, setActivePillar] = useState<number | null>(null);

  // Workflow scenario definitions tailored to provide interactive AI value
  const workflowScenarios = {
    agent: {
      title: 'Agent Tool-Calling (Function Execution)',
      badge: 'LLM & Autonomous Agents',
      description: `Autonomous LLM agents leverage ${api.name}'s strict OpenAPI schemas to invoke real-time actions without hallucinations.`,
      inputLabel: 'Agent Decision Engine (LangChain / Vercel AI SDK)',
      inputPayload: `// Tool definition for ${api.name}
const toolCall = await agent.invoke({
  action: "${api.slug || 'query'}.execute",
  parameters: {
    context: "production_cluster_01",
    mode: "autonomous_agent_v2",
    timeoutMs: ${api.latencyMs ? Math.round(api.latencyMs * 1.5) : 300}
  }
});`,
      outputLabel: 'Deterministic Model Response',
      outputPayload: `{
  "status": "success",
  "verifiedBy": "Klyra Protocol Gateway",
  "latency": "${api.latencyMs}ms",
  "executionTrace": {
    "tool": "${api.name}",
    "category": "${api.categoryName}",
    "deterministicOutput": true,
    "tokensConsumed": 42
  }
}`,
    },
    stream: {
      title: 'Real-Time Edge Streaming & Synthesis',
      badge: 'Sub-millisecond Streaming',
      description: `Ingest high-frequency data streams directly into your UI or vector embeddings with guaranteed P99 latency of ${api.latencyMs}ms.`,
      inputLabel: 'Edge Client Subscription',
      inputPayload: `// Stream real-time data chunks from ${api.baseUrl || 'https://api.klyra.dev'}
const stream = await fetch("${api.baseUrl || 'https://api.klyra.dev'}/stream", {
  headers: { "Authorization": "Bearer klyra_live_..." }
});

for await (const chunk of stream.body) {
  processLiveChunk(chunk); // Instantaneous edge arrival
}`,
      outputLabel: 'Live SSE Feed Preview',
      outputPayload: `data: { "event": "update", "timestamp": "${new Date().toISOString()}", "load": "optimal" }
data: { "event": "metrics", "throughput": "2,400 req/s", "p99": "${api.latencyMs}ms" }
data: { "event": "health", "uptime": "${api.uptimePercentage}%", "status": "nominal" }`,
    },
    batch: {
      title: 'High-Throughput Parallel Pipelines',
      badge: 'Enterprise Batch Processing',
      description: `Execute mass operations with automatic rate-limit throttling, retry backoff, and idempotent deduplication keys.`,
      inputLabel: 'Batch Request Payload (JSON Array)',
      inputPayload: `// Batch orchestrator dispatching parallel tasks
const response = await fetch("${api.baseUrl || 'https://api.klyra.dev'}/batch", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Idempotency-Key": "req_batch_8992" },
  body: JSON.stringify({
    tasks: Array.from({ length: 50 }).map((_, i) => ({ id: i, priority: "high" }))
  })
});`,
      outputLabel: 'Orchestrated Job Summary',
      outputPayload: `{
  "batchId": "batch_orchestration_99812",
  "totalProcessed": 50,
  "successful": 50,
  "concurrency": "auto_scaled",
  "avgLatencyPerItem": "${Math.max(12, Math.round(api.latencyMs / 3))}ms"
}`,
    },
  };

  const currentScenario = workflowScenarios[activeWorkflowTab];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const engineeringPillars = [
    {
      id: 1,
      icon: Gauge,
      badge: `${api.latencyMs}ms P99 Latency`,
      title: 'Low-Latency Anycast Routing',
      description: `Globally deployed edge network with intelligent caching layers ensuring average response times stay under ${api.latencyMs}ms even under burst loads.`,
      metric: `${api.latencyMs}ms`,
      metricLabel: 'Edge Latency',
      gradient: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.05))',
      borderAccent: 'rgba(99, 102, 241, 0.35)',
    },
    {
      id: 2,
      icon: ShieldCheck,
      badge: `${api.uptimePercentage}% Uptime SLA`,
      title: 'High Availability & Resilience',
      description: `Multi-region redundant failover clusters with automatic health checks and circuit breakers guaranteeing uninterrupted business continuity.`,
      metric: `${api.uptimePercentage}%`,
      metricLabel: 'SLA Guarantee',
      gradient: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(16, 185, 129, 0.05))',
      borderAccent: 'rgba(34, 197, 94, 0.35)',
    },
    {
      id: 3,
      icon: Cpu,
      badge: 'Zero-Friction DX',
      title: 'Type-Safe SDKs & Schemas',
      description: `First-class OpenAPI 3.1 specifications with auto-generated TypeScript, Python, and Go definitions for deterministic payload handling.`,
      metric: '100% Typed',
      metricLabel: 'Schema Verification',
      gradient: 'linear-gradient(135deg, rgba(217, 70, 239, 0.15), rgba(168, 85, 247, 0.05))',
      borderAccent: 'rgba(217, 70, 239, 0.35)',
    },
    {
      id: 4,
      icon: Lock,
      badge: 'Enterprise Guardrails',
      title: 'Strict Security & Idempotency',
      description: `End-to-end TLS 1.3 encryption, automatic rate-limit headers, token rotation, and idempotency guarantees for financial-grade safety.`,
      metric: 'TLS 1.3',
      metricLabel: 'Hardware Secured',
      gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(99, 102, 241, 0.05))',
      borderAccent: 'rgba(59, 130, 246, 0.35)',
    },
  ];

  return (
    <div className="aos-container">
      {/* Capability Highlights Bar */}
      <div className="aos-meta-strip">
        <div className="aos-meta-item">
          <Sparkles size={15} className="aos-meta-icon purple" />
          <span>AI Tool-Calling Ready</span>
          <span className="aos-meta-pill">MCP & LangChain</span>
        </div>
        <div className="aos-meta-divider" />
        <div className="aos-meta-item">
          <Activity size={15} className="aos-meta-icon green" />
          <span>Real-time Telemetry</span>
          <span className="aos-meta-pill">Active ({api.latencyMs}ms)</span>
        </div>
        <div className="aos-meta-divider" />
        <div className="aos-meta-item">
          <ShieldCheck size={15} className="aos-meta-icon blue" />
          <span>Production Ready</span>
          <span className="aos-meta-pill">{api.uptimePercentage}% SLA</span>
        </div>
        <div className="aos-meta-divider" />
        <div className="aos-meta-item">
          <Boxes size={15} className="aos-meta-icon orange" />
          <span>Architecture</span>
          <span className="aos-meta-pill">v{api.currentVersion} REST</span>
        </div>
      </div>

      {/* AI Value Proposition - Interactive Canvas */}
      <section className="aos-ai-section">
        <div className="aos-ai-header">
          <div className="aos-ai-badge">
            <Sparkles size={14} />
            <span>AI VALUE PROPOSITION</span>
          </div>
          <h2 className="aos-ai-title">
            Turn {api.categoryName} into Autonomous Agent & Product Capabilities
          </h2>
          <p className="aos-ai-subtitle">
            {api.description} Seamlessly integrate structured endpoints into LLM reasoning loops,
            streaming frontends, and automated workflows without brittle scraping or unreliable
            parsing.
          </p>
        </div>

        {/* Interactive Scenario Tabs */}
        <div className="aos-ai-sandbox">
          <div className="aos-sandbox-nav">
            <button
              className={`aos-nav-tab ${activeWorkflowTab === 'agent' ? 'active' : ''}`}
              onClick={() => setActiveWorkflowTab('agent')}
            >
              <Cpu size={14} />
              <span>AI Agent Tool-Calling</span>
              <span className="aos-tab-tag">Recommended</span>
            </button>
            <button
              className={`aos-nav-tab ${activeWorkflowTab === 'stream' ? 'active' : ''}`}
              onClick={() => setActiveWorkflowTab('stream')}
            >
              <Zap size={14} />
              <span>Edge Streaming Feed</span>
            </button>
            <button
              className={`aos-nav-tab ${activeWorkflowTab === 'batch' ? 'active' : ''}`}
              onClick={() => setActiveWorkflowTab('batch')}
            >
              <Workflow size={14} />
              <span>Parallel Pipeline</span>
            </button>
          </div>

          <div className="aos-sandbox-body">
            <div className="aos-sandbox-info">
              <div className="aos-scenario-meta">
                <span className="aos-scenario-badge">{currentScenario.badge}</span>
                <h4>{currentScenario.title}</h4>
                <p>{currentScenario.description}</p>
              </div>

              <div className="aos-sandbox-features">
                <div className="aos-feature-point">
                  <Check size={14} className="aos-check-icon" />
                  <span>Strict schema validation reduces model hallucinations to 0%</span>
                </div>
                <div className="aos-feature-point">
                  <Check size={14} className="aos-check-icon" />
                  <span>Sub-{api.latencyMs}ms roundtrip maintains fluid streaming conversational UI</span>
                </div>
                <div className="aos-feature-point">
                  <Check size={14} className="aos-check-icon" />
                  <span>Idempotent key support prevents duplicate LLM tool retries</span>
                </div>
              </div>

              {onOpenTester && (
                <div className="aos-sandbox-action">
                  <button className="aos-test-btn" onClick={() => onOpenTester(api)}>
                    <Terminal size={14} />
                    <span>Run Live In API Tester</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>

            {/* Code / Payload Previewer */}
            <div className="aos-sandbox-code-col">
              <div className="aos-code-window">
                <div className="aos-code-topbar">
                  <div className="aos-window-dots">
                    <span className="dot red" />
                    <span className="dot yellow" />
                    <span className="dot green" />
                  </div>
                  <span className="aos-code-title">{currentScenario.inputLabel}</span>
                  <button
                    className="aos-copy-code-btn"
                    onClick={() => handleCopy(currentScenario.inputPayload)}
                    title="Copy code snippet"
                  >
                    {copiedCode ? <Check size={12} color="#22c55e" /> : <Copy size={12} />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="aos-code-block">
                  <code>{currentScenario.inputPayload}</code>
                </pre>
              </div>

              <div className="aos-code-window output-window">
                <div className="aos-code-topbar">
                  <div className="aos-output-indicator">
                    <span className="status-ping" />
                    <span>{currentScenario.outputLabel}</span>
                  </div>
                  <span className="aos-pill-latency">{api.latencyMs}ms</span>
                </div>
                <pre className="aos-code-block output">
                  <code>{currentScenario.outputPayload}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why This API Is Useful - Engineering Pillars */}
      <section className="aos-pillars-section">
        <div className="aos-section-header">
          <div className="aos-section-kicker">
            <Layers size={13} />
            <span>ARCHITECTURAL ADVANTAGES</span>
          </div>
          <h2 className="aos-section-title">Why Engineering Teams Choose {api.name}</h2>
          <p className="aos-section-subtitle">
            Engineered for mission-critical reliability, observable performance, and zero-overhead
            developer ergonomics.
          </p>
        </div>

        <div className="aos-pillars-grid">
          {engineeringPillars.map((pillar) => {
            const Icon = pillar.icon;
            const isHovered = activePillar === pillar.id;
            return (
              <div
                key={pillar.id}
                className={`aos-pillar-card ${isHovered ? 'hovered' : ''}`}
                onMouseEnter={() => setActivePillar(pillar.id)}
                onMouseLeave={() => setActivePillar(null)}
                style={{
                  borderColor: isHovered ? pillar.borderAccent : 'var(--border-card)',
                  background: isHovered ? pillar.gradient : 'var(--bg-card)',
                }}
              >
                <div className="aos-pillar-top">
                  <div className="aos-pillar-icon-box">
                    <Icon size={18} />
                  </div>
                  <span className="aos-pillar-badge">{pillar.badge}</span>
                </div>
                <h3 className="aos-pillar-title">{pillar.title}</h3>
                <p className="aos-pillar-desc">{pillar.description}</p>
                <div className="aos-pillar-footer">
                  <div className="aos-pillar-metric-val">{pillar.metric}</div>
                  <span className="aos-pillar-metric-lbl">{pillar.metricLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Product Deep Dive & Structured Tags */}
      <section className="aos-details-section">
        <div className="aos-details-grid">
          <div className="aos-deep-dive-card">
            <span className="aos-section-kicker">
              <Code2 size={13} />
              <span>PRODUCT PERSPECTIVE</span>
            </span>
            <h3 className="aos-deep-title">Designed for scalable modern stacks</h3>
            <p className="aos-deep-desc">
              {api.longDescription || api.description ||
                `${api.name} provides clean RESTful interfaces designed for teams demanding fast iteration cycles and reliable SLAs. With built-in versioning and strict semantic payloads, you can ship features faster with minimal breaking changes.`}
            </p>

            <div className="aos-specs-matrix">
              <div className="aos-spec-item">
                <span className="aos-spec-label">Base URL</span>
                <span className="aos-spec-value">
                  <code>{api.baseUrl || 'https://api.klyra.dev'}</code>
                </span>
              </div>
              <div className="aos-spec-item">
                <span className="aos-spec-label">Protocol</span>
                <span className="aos-spec-value">HTTPS / TLS 1.3 / HTTP/2</span>
              </div>
              <div className="aos-spec-item">
                <span className="aos-spec-label">Auth Method</span>
                <span className="aos-spec-value">Bearer Token / API Key Header</span>
              </div>
              <div className="aos-spec-item">
                <span className="aos-spec-label">Provider SLA</span>
                <span className="aos-spec-value highlight">{api.uptimePercentage}% Guarantee</span>
              </div>
            </div>
          </div>

          {/* Tags & Ecosystem Fit */}
          {api.tags && api.tags.length > 0 && (
            <div className="aos-ecosystem-card">
              <span className="aos-section-kicker">
                <TagIcon size={13} />
                <span>INTEGRATION TAGS & ECOSYSTEM</span>
              </span>
              <h3 className="aos-deep-title">Supported Tags & Categories</h3>
              <p className="aos-deep-desc">
                Classified under high-reliability {api.categoryName.toLowerCase()} APIs. Ready for
                microservices, serverless functions, and agentic workflows.
              </p>
              <div className="aos-tags-cloud">
                <span className="aos-tag-pill primary">
                  <Flame size={12} />
                  <span>{api.categoryName}</span>
                </span>
                {api.tags.map((tag) => (
                  <span key={tag} className="aos-tag-pill">
                    #{tag}
                  </span>
                ))}
                <span className="aos-tag-pill subtle">OpenAPI 3.1</span>
                <span className="aos-tag-pill subtle">JSON REST</span>
              </div>

              {api.docsUrl && (
                <div className="aos-docs-link-wrap">
                  <a
                    href={api.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="aos-docs-action-link"
                  >
                    <span>Read Provider Technical Docs</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <style>{`
        .aos-container {
          display: flex;
          flex-direction: column;
          gap: 28px;
          animation: fadeIn 0.3s ease;
        }

        /* Meta Capability Strip */
        .aos-meta-strip {
          display: flex;
          align-items: center;
          gap: 16px;
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          padding: 12px 20px;
          flex-wrap: wrap;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }

        .aos-meta-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          color: var(--text-secondary);
        }

        .aos-meta-icon {
          flex-shrink: 0;
        }

        .aos-meta-icon.purple { color: var(--accent-purple); }
        .aos-meta-icon.green { color: var(--status-active); }
        .aos-meta-icon.blue { color: #3b82f6; }
        .aos-meta-icon.orange { color: #f59e0b; }

        .aos-meta-pill {
          background: var(--bg-pill);
          border: 1px solid var(--border-subtle);
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .aos-meta-divider {
          width: 1px;
          height: 16px;
          background: var(--border-card);
        }

        /* AI Section */
        .aos-ai-section {
          background: radial-gradient(ellipse at top right, rgba(139, 92, 246, 0.12), transparent 70%),
                      radial-gradient(ellipse at bottom left, rgba(99, 102, 241, 0.08), transparent 70%),
                      var(--bg-card);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: var(--radius-xl);
          padding: 28px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
        }

        .aos-ai-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(217, 70, 239, 0.25));
          border: 1px solid rgba(168, 85, 247, 0.4);
          color: var(--text-accent);
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 4px 12px;
          border-radius: 999px;
          margin-bottom: 12px;
        }

        .aos-ai-title {
          font-size: 24px;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1.3;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }

        .aos-ai-subtitle {
          font-size: 13.5px;
          color: var(--text-secondary);
          line-height: 1.65;
          max-width: 820px;
          margin-bottom: 24px;
        }

        /* Interactive AI Sandbox */
        .aos-ai-sandbox {
          background: var(--bg-input);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .aos-sandbox-nav {
          display: flex;
          background: rgba(11, 12, 18, 0.7);
          border-bottom: 1px solid var(--border-card);
          overflow-x: auto;
        }

        .aos-nav-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 18px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--text-muted);
          border: none;
          background: none;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .aos-nav-tab:hover {
          color: var(--text-primary);
        }

        .aos-nav-tab.active {
          color: var(--accent-purple);
          border-bottom-color: var(--accent-purple);
          background: rgba(139, 92, 246, 0.08);
        }

        .aos-tab-tag {
          font-size: 9.5px;
          background: rgba(139, 92, 246, 0.2);
          color: var(--text-accent);
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .aos-sandbox-body {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 24px;
          padding: 24px;
        }

        .aos-sandbox-info {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 20px;
        }

        .aos-scenario-badge {
          font-size: 10px;
          font-weight: 700;
          color: var(--accent-purple);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 6px;
          display: inline-block;
        }

        .aos-scenario-meta h4 {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 8px;
        }

        .aos-scenario-meta p {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .aos-sandbox-features {
          display: flex;
          flex-direction: column;
          gap: 10px;
          background: rgba(255, 255, 255, 0.02);
          padding: 14px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
        }

        .aos-feature-point {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.45;
        }

        .aos-check-icon {
          color: var(--status-active);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .aos-sandbox-action {
          margin-top: auto;
        }

        .aos-test-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: var(--radius-md);
          background: var(--accent-gradient);
          color: #fff;
          font-size: 12.5px;
          font-weight: 600;
          box-shadow: var(--shadow-purple);
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .aos-test-btn:hover {
          transform: translateY(-1px);
          filter: brightness(1.1);
        }

        /* Code Column */
        .aos-sandbox-code-col {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .aos-code-window {
          background: #090a10;
          border: 1px solid var(--border-card);
          border-radius: var(--radius-md);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .aos-code-window.output-window {
          border-color: rgba(34, 197, 94, 0.25);
          background: #080a0e;
        }

        .aos-code-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid var(--border-subtle);
          font-size: 11px;
          color: var(--text-muted);
        }

        .aos-window-dots {
          display: flex;
          gap: 5px;
        }

        .aos-window-dots .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .aos-window-dots .dot.red { background: #ef4444; opacity: 0.7; }
        .aos-window-dots .dot.yellow { background: #f59e0b; opacity: 0.7; }
        .aos-window-dots .dot.green { background: #22c55e; opacity: 0.7; }

        .aos-code-title {
          font-weight: 600;
          color: var(--text-secondary);
        }

        .aos-copy-code-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10.5px;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-subtle);
          padding: 2px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .aos-copy-code-btn:hover {
          color: var(--text-primary);
          border-color: var(--accent-purple);
        }

        .aos-output-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--status-active);
          font-weight: 600;
        }

        .status-ping {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--status-active);
          box-shadow: 0 0 6px var(--status-active);
        }

        .aos-pill-latency {
          font-size: 10px;
          background: rgba(34, 197, 94, 0.12);
          color: var(--status-active);
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: 700;
        }

        .aos-code-block {
          padding: 12px;
          margin: 0;
          font-family: var(--font-mono);
          font-size: 11.5px;
          line-height: 1.55;
          color: #cbd5e1;
          overflow-x: auto;
          white-space: pre;
          max-height: 150px;
        }

        .aos-code-block.output {
          color: #86efac;
          max-height: 120px;
        }

        /* Pillars Section */
        .aos-pillars-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .aos-section-header {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .aos-section-kicker {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent-purple);
        }

        .aos-section-title {
          font-size: 22px;
          font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .aos-section-subtitle {
          font-size: 13px;
          color: var(--text-secondary);
          max-width: 680px;
        }

        .aos-pillars-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }

        .aos-pillar-card {
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-card);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
        }

        .aos-pillar-card.hovered {
          transform: translateY(-3px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        }

        .aos-pillar-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .aos-pillar-icon-box {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          background: var(--bg-pill);
          border: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-accent);
        }

        .aos-pillar-badge {
          font-size: 10px;
          font-weight: 700;
          color: var(--text-muted);
          background: var(--bg-pill);
          padding: 2px 7px;
          border-radius: 999px;
          border: 1px solid var(--border-subtle);
        }

        .aos-pillar-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.3;
        }

        .aos-pillar-desc {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.55;
          flex: 1;
        }

        .aos-pillar-footer {
          display: flex;
          align-items: baseline;
          gap: 6px;
          border-top: 1px solid var(--border-subtle);
          padding-top: 12px;
          margin-top: auto;
        }

        .aos-pillar-metric-val {
          font-size: 17px;
          font-weight: 800;
          color: var(--text-primary);
        }

        .aos-pillar-metric-lbl {
          font-size: 10.5px;
          color: var(--text-muted);
        }

        /* Product Deep Dive & Details */
        .aos-details-section {
          margin-top: 4px;
        }

        .aos-details-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 20px;
        }

        .aos-deep-dive-card,
        .aos-ecosystem-card {
          background: var(--bg-card);
          border: 1px solid var(--border-card);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .aos-deep-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .aos-deep-desc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .aos-specs-matrix {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          background: var(--bg-input);
          padding: 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
          margin-top: 4px;
        }

        .aos-spec-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .aos-spec-label {
          font-size: 10.5px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .aos-spec-value {
          font-size: 12.5px;
          color: var(--text-primary);
          font-weight: 500;
        }

        .aos-spec-value code {
          font-family: var(--font-mono);
          font-size: 11.5px;
          color: var(--text-accent);
          word-break: break-all;
        }

        .aos-spec-value.highlight {
          color: var(--status-active);
          font-weight: 700;
        }

        .aos-tags-cloud {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 6px;
        }

        .aos-tag-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 600;
          padding: 5px 11px;
          border-radius: 999px;
          background: var(--bg-pill);
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
          transition: all 0.15s;
        }

        .aos-tag-pill.primary {
          background: var(--accent-subtle);
          border-color: var(--accent-subtle-border);
          color: var(--text-accent);
        }

        .aos-tag-pill.subtle {
          color: var(--text-muted);
          border-style: dashed;
        }

        .aos-docs-link-wrap {
          margin-top: auto;
          padding-top: 14px;
          border-top: 1px solid var(--border-subtle);
        }

        .aos-docs-action-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--accent-purple);
          transition: all 0.15s;
        }

        .aos-docs-action-link:hover {
          color: #c4b5fd;
          text-decoration: underline;
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .aos-pillars-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .aos-details-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .aos-sandbox-body {
            grid-template-columns: 1fr;
          }
          .aos-pillars-grid {
            grid-template-columns: 1fr;
          }
          .aos-meta-strip {
            flex-direction: column;
            align-items: flex-start;
          }
          .aos-meta-divider {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};
