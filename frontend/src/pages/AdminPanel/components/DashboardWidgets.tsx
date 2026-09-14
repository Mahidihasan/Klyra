import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Activity, Server, ArrowUpRight, Clock, CheckCircle2, Loader2, Terminal, Pause, Play, Trash2, Eye, Sparkles } from 'lucide-react';

// ------------------------------------------------------------------
// API Pulse Node-Graph Canvas Widget
// ------------------------------------------------------------------
const ApiPulseCanvas = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: any[] = [];
    
    const handleResize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const nodes = [
      { id: 1, x: 0.1, y: 0.5, radius: 4, color: '#a78bfa' }, // Source
      { id: 2, x: 0.4, y: 0.2, radius: 3, color: '#60a5fa' }, // Edge 1
      { id: 3, x: 0.4, y: 0.8, radius: 3, color: '#60a5fa' }, // Edge 2
      { id: 4, x: 0.7, y: 0.5, radius: 6, color: '#8b5cf6' }, // Gateway
      { id: 5, x: 0.9, y: 0.3, radius: 4, color: '#34d399' }, // DB 1
      { id: 6, x: 0.9, y: 0.7, radius: 4, color: '#34d399' }, // DB 2
    ];

    const edges = [
      { from: 1, to: 2 }, { from: 1, to: 3 },
      { from: 2, to: 4 }, { from: 3, to: 4 },
      { from: 4, to: 5 }, { from: 4, to: 6 }
    ];

    const createParticle = () => {
      const edge = edges[Math.floor(Math.random() * edges.length)];
      const fromNode = nodes.find(n => n.id === edge.from)!;
      const toNode = nodes.find(n => n.id === edge.to)!;
      particles.push({
        edge,
        progress: 0,
        speed: 0.01 + Math.random() * 0.015,
        startX: fromNode.x, startY: fromNode.y,
        endX: toNode.x, endY: toNode.y,
        color: fromNode.color
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;

      // Draw edges
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      edges.forEach(e => {
        const from = nodes.find(n => n.id === e.from)!;
        const to = nodes.find(n => n.id === e.to)!;
        ctx.beginPath();
        ctx.moveTo(from.x * w, from.y * h);
        // Curved line
        ctx.bezierCurveTo(
          from.x * w + (to.x - from.x) * w * 0.5, from.y * h,
          from.x * w + (to.x - from.x) * w * 0.5, to.y * h,
          to.x * w, to.y * h
        );
        ctx.stroke();
      });

      // Draw particles
      particles.forEach((p, i) => {
        p.progress += p.speed;
        if (p.progress >= 1) {
          particles.splice(i, 1);
          return;
        }
        // Calculate curve position
        const cp1x = p.startX * w + (p.endX - p.startX) * w * 0.5;
        const cp1y = p.startY * h;
        const cp2x = p.startX * w + (p.endX - p.startX) * w * 0.5;
        const cp2y = p.endY * h;
        
        const t = p.progress;
        const x = Math.pow(1-t, 3) * (p.startX * w) + 3*Math.pow(1-t, 2)*t * cp1x + 3*(1-t)*Math.pow(t, 2) * cp2x + Math.pow(t, 3) * (p.endX * w);
        const y = Math.pow(1-t, 3) * (p.startY * h) + 3*Math.pow(1-t, 2)*t * cp1y + 3*(1-t)*Math.pow(t, 2) * cp2y + Math.pow(t, 3) * (p.endY * h);

        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
      });

      // Draw nodes
      nodes.forEach(n => {
        ctx.fillStyle = n.color;
        ctx.shadowColor = n.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(n.x * w, n.y * h, n.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      if (Math.random() < 0.2) createParticle();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
};

// ------------------------------------------------------------------
// 1. Real-Time Traffic & API Health Widget
// ------------------------------------------------------------------
export const RealTimeTrafficWidget = () => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    // Generate initial realistic time-series data
    const initialData = Array.from({ length: 20 }).map((_, i) => ({
      time: new Date(Date.now() - (20 - i) * 1000).toLocaleTimeString([], { second: '2-digit' }),
      hits: Math.floor(Math.random() * 500) + 200,
      latency: Math.floor(Math.random() * 50) + 10,
    }));
    setData(initialData);

    const interval = setInterval(() => {
      setData(prev => {
        const newData = [...prev.slice(1)];
        newData.push({
          time: new Date().toLocaleTimeString([], { second: '2-digit' }),
          hits: Math.floor(Math.random() * 500) + 200,
          latency: Math.floor(Math.random() * 50) + 10,
        });
        return newData;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const currentHits = data.length > 0 ? data[data.length - 1].hits : 0;
  const currentLatency = data.length > 0 ? data[data.length - 1].latency : 0;
  const uptimeStatus = currentLatency > 60 ? 'yellow' : 'green';

  return (
    <div className="widget-card" style={{ height: 400 }}>
      <div className="widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Activity size={18} color="var(--text-muted)" />
          <h3 className="widget-title">Live Traffic & Health</h3>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div className="status-indicator">
            <span className={`pulse-dot ${uptimeStatus}`}></span>
            99.9% Uptime
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="metric-label">Live Gateway Hits/sec</div>
          <div className="metric-value">{currentHits} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>req/s</span></div>
          {/* Micro-sparkline behind text */}
          <div style={{ position: 'absolute', bottom: -5, left: -5, right: -5, height: 35, zIndex: -1, opacity: 0.2, pointerEvents: 'none' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <Line type="monotone" dataKey="hits" stroke="#8b5cf6" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="metric-label">P95 Latency</div>
          <div className="metric-value">{currentLatency} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>ms</span></div>
          {/* Micro-sparkline behind text */}
          <div style={{ position: 'absolute', bottom: -5, left: -5, right: -5, height: 35, zIndex: -1, opacity: 0.2, pointerEvents: 'none' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <Line type="monotone" dataKey="latency" stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <div className="metric-label">5xx Error Rate</div>
          <div className="metric-value" style={{ color: '#22c55e' }}>0.01%</div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, marginTop: 16, position: 'relative', borderRadius: 12, overflow: 'hidden', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.02)' }}>
        <ApiPulseCanvas />
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// 2. Long-Running Task UI
// ------------------------------------------------------------------
export const ActiveTasksWidget = () => {
  return (
    <div className="widget-card">
      <div className="widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Clock size={18} color="var(--text-muted)" />
          <h3 className="widget-title">Active Background Tasks</h3>
        </div>
        <span className="badge">2 Running</span>
      </div>

      <div className="task-list">
        {/* Task 1 */}
        <div className="task-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={14} className="spin-icon" color="#3b82f6" /> 
              Syncing Global Redis Cache
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>45%</div>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: '45%', background: '#3b82f6' }}></div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 8 }}>
            <span>Step 2/4: Rehydrating Edge Nodes...</span>
            <span style={{ color: 'var(--text-secondary)' }}>ETA: 4m 12s</span>
          </div>
        </div>

        {/* Task 2 */}
        <div className="task-item">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={14} className="spin-icon" color="#a78bfa" /> 
              Generating Monthly Invoice Reports
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>89%</div>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: '89%', background: '#a78bfa' }}></div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 8 }}>
            <span>Step 5/5: Compressing PDFs...</span>
            <span style={{ color: 'var(--text-secondary)' }}>ETA: 15s</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// 3. Top APIs & Gateway Stats
// ------------------------------------------------------------------
export const GatewayStatsWidget = () => {
  const topApis = [
    { name: 'Stable Diffusion XL API', provider: 'usr_8x2a', hits: '1.2M', trend: '+14%' },
    { name: 'Global Weather v2', provider: 'system', hits: '850K', trend: '+5%' },
    { name: 'Financial Sentiment Analysis', provider: 'usr_abc', hits: '430K', trend: '-2%' },
    { name: 'DeepSeek Coder LLM', provider: 'usr_llm', hits: '320K', trend: '+45%' },
  ];

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Server size={18} color="var(--text-muted)" />
          <h3 className="widget-title">Gateway Load & Top APIs</h3>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {topApis.map((api, i) => (
          <div key={i} className="list-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{api.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{api.provider}</div>
              </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>{api.hits} hits</div>
              <div style={{ fontSize: 11, color: api.trend.startsWith('+') ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                {api.trend} {api.trend.startsWith('+') && <ArrowUpRight size={10} />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// 4. Live Gateway Feed Terminal Widget
// ------------------------------------------------------------------
export const LiveGatewayFeedWidget = () => {
  const [logs, setLogs] = useState<{ id: string; timestamp: string; status: number; method: string; path: string; latency: number; msg?: string }[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPaused) return;
    
    const endpoints = [
      { method: 'GET', path: '/api/v1/users' },
      { method: 'POST', path: '/api/v1/payments' },
      { method: 'GET', path: '/api/v2/products' },
      { method: 'PUT', path: '/api/v1/settings' },
      { method: 'DELETE', path: '/api/v1/cache' },
      { method: 'GET', path: '/api/v1/analytics/pulse' },
      { method: 'POST', path: '/api/v1/auth/exchange' }
    ];

    const interval = setInterval(() => {
      const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
      const isError = Math.random() > 0.85;
      const isRateLimit = Math.random() > 0.95;
      
      let status = 200;
      if (isRateLimit) status = 429;
      else if (isError) status = 500;
      else if (ep.method === 'POST') status = 201;

      const newLog = {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString().split('T')[1].substring(0, 12),
        status,
        method: ep.method,
        path: ep.path,
        latency: Math.floor(Math.random() * 150) + 10,
        msg: isRateLimit ? 'RATE LIMITED' : (isError ? 'INTERNAL ERROR' : '')
      };

      setLogs(prev => [...prev.slice(-49), newLog]);
    }, Math.random() * 500 + 150);

    return () => clearInterval(interval);
  }, [isPaused]);

  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isPaused]);

  const getStatusColor = (status: number) => {
    if (status >= 500) return '#ef4444';
    if (status >= 400) return '#f59e0b';
    if (status >= 200) return '#22c55e';
    return '#a78bfa';
  };

  return (
    <div className="widget-card terminal-feed-card" style={{ height: 400, padding: 0 }}>
      <div className="terminal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Terminal size={16} color="var(--text-muted)" />
          <h3 className="widget-title" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, textTransform: 'uppercase' }}>Gateway Tail</h3>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="terminal-btn" onClick={() => setIsPaused(!isPaused)}>
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button className="terminal-btn" onClick={() => setLogs([])}>
            <Trash2 size={14} />
            Clear
          </button>
        </div>
      </div>
      <div className="terminal-body" ref={scrollRef}>
        {logs.length === 0 && <div style={{ color: 'var(--text-muted)', padding: 16 }}>Waiting for incoming traffic...</div>}
        {logs.map((log) => (
          <div key={log.id} className="terminal-log-line group">
            <span style={{ color: 'var(--text-muted)', marginRight: 12, minWidth: 100, display: 'inline-block' }}>[{log.timestamp}]</span>
            <span style={{ color: getStatusColor(log.status), fontWeight: 700, width: 45, display: 'inline-block' }}>{log.status}</span>
            <span style={{ color: '#a78bfa', fontWeight: 600, width: 60, display: 'inline-block' }}>{log.method}</span>
            <span style={{ color: '#e2e8f0', flex: 1 }}>{log.path}</span>
            {log.msg && <span style={{ color: getStatusColor(log.status), marginLeft: 12 }}>- {log.msg}</span>}
            {!log.msg && <span style={{ color: 'var(--text-secondary)', marginLeft: 12 }}>- {log.latency}ms</span>}
            
            <button className="payload-btn">
              <Eye size={14} />
              Payload
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// 5. AI Insights Widget
// ------------------------------------------------------------------
export const AiInsightsWidget = () => {
  return (
    <div className="widget-card ai-insights-card" style={{ height: 'auto', padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Sparkles size={18} color="#a78bfa" className="ai-pulse-icon" />
        <h3 className="widget-title" style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Copilot Briefing</h3>
      </div>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Traffic is up <strong style={{ color: '#22c55e' }}>20%</strong> today. Server loads are stable across all edge nodes. 
        <strong style={{ color: '#f59e0b', margin: '0 6px' }}>3 APIs</strong> are pending security review.
      </p>
    </div>
  );
};
