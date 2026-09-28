import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Activity, Server, ArrowUpRight, Clock, CheckCircle2, Loader2, Terminal, Pause, Play, Trash2, Eye, Sparkles } from 'lucide-react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [kpis, setKpis] = useState({ hits: 0, latency: 0, errorRate: 0, uptime: 99.9 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        const res = await fetch('/api/v1/admin/platform/overview', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setData(json.chartData || []);
          setKpis({
            hits: json.kpis?.hits || 0,
            latency: json.kpis?.latency || 0,
            errorRate: json.kpis?.errorRate || 0,
            uptime: json.kpis?.uptime || 99.9
          });
        }
      } catch (err) {
        console.error('Failed to fetch platform overview', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="widget-card" style={{ height: 400 }}>
        <div className="w-full h-full bg-white/5 border border-white/5 rounded-xl animate-[pulse_2s_ease-in-out_infinite]" />
      </div>
    );
  }

  const currentHits = kpis.hits;
  const currentLatency = kpis.latency;
  const errorRate = kpis.errorRate;
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
          <div className="metric-value" style={{ color: '#22c55e' }}>{errorRate.toFixed(2)}%</div>
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
// Task colour palette — cycles across jobs for the neon aesthetic
const TASK_COLORS = ['#3b82f6', '#a78bfa', '#e879f9', '#34d399'];

interface ActiveTask {
  id: string;
  name: string;
  progress: number;
  step: string;
  eta: string;
}

export const ActiveTasksWidget = () => {
  const [tasks, setTasks] = useState<ActiveTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        const res = await fetch('/api/v1/admin/queue/active-tasks', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setTasks(json.tasks || []);
        }
      } catch (err) {
        console.error('[ActiveTasksWidget] fetch failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
    // Short-poll every 2 seconds to keep the widget live
    const interval = setInterval(fetchTasks, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Clock size={18} color="var(--text-muted)" />
          <h3 className="widget-title">Active Background Tasks</h3>
        </div>
        {/* Badge shows live count, or spinner while loading */}
        {isLoading
          ? <span className="badge"><Loader2 size={12} className="spin-icon" style={{ display: 'inline' }} /> Loading</span>
          : <span className="badge">{tasks.length > 0 ? `${tasks.length} Running` : 'System Idle'}</span>
        }
      </div>

      <div className="task-list">
        {/* ── Skeleton loaders ── */}
        {isLoading && [0, 1].map((i) => (
          <div key={i} className="task-item" style={{ opacity: 0.6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="bg-white/10 h-4 w-48 rounded animate-pulse" />
              <div className="bg-white/10 h-4 w-8 rounded animate-pulse" />
            </div>
            <div className="progress-bar-bg">
              <div className="bg-white/10 h-full rounded animate-pulse" style={{ width: '60%' }} />
            </div>
            <div className="bg-white/10 h-3 w-40 rounded animate-pulse mt-2" />
          </div>
        ))}

        {/* ── Empty state ── */}
        {!isLoading && tasks.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 16px',
            gap: 10,
            color: 'var(--text-muted)',
          }}>
            <CheckCircle2 size={32} style={{ opacity: 0.3, color: '#10b981' }} />
            <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.02em' }}>System Idle</span>
            <span style={{ fontSize: 11, opacity: 0.5, textAlign: 'center' }}>No active background tasks</span>
          </div>
        )}

        {/* ── Live tasks ── */}
        {!isLoading && tasks.map((task, i) => {
          const color = TASK_COLORS[i % TASK_COLORS.length];
          return (
            <div key={task.id} className="task-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={14} className="spin-icon" color={color} />
                  {task.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{task.progress}%</div>
              </div>
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${task.progress}%`,
                    background: color,
                    transition: 'width 0.8s ease',
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'flex', gap: 8 }}>
                <span>{task.step}</span>
                <span style={{ color: 'var(--text-secondary)' }}>ETA: {task.eta}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


// ------------------------------------------------------------------
// 3. Top APIs & Gateway Stats
// ------------------------------------------------------------------

interface TopApi {
  id: string;
  name: string;
  provider: string;
  totalRequests: number;
  trend: number; // week-over-week percentage, e.g. 14.2 or -3.5
}

/** Format raw request count to a compact human-readable string. */
function formatHits(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(2)}M`;
  if (count >= 1_000)     return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export const GatewayStatsWidget = () => {
  const [apis, setApis] = useState<TopApi[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTopApis = async () => {
      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        const res = await fetch('/api/v1/admin/platform/top-apis', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setApis(json.apis || []);
        }
      } catch (err) {
        console.error('[GatewayStatsWidget] fetch failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopApis();
    // Refresh every 30s — hits data doesn't change at sub-second frequency
    const interval = setInterval(fetchTopApis, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="widget-card">
      <div className="widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Server size={18} color="var(--text-muted)" />
          <h3 className="widget-title">Gateway Load & Top APIs</h3>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* ── Skeleton loaders ── */}
        {isLoading && [0, 1, 2, 3].map((i) => (
          <div key={i} className="list-item" style={{ opacity: 0.6 }}>
            <div className="animate-pulse bg-white/5 h-16 w-full rounded-xl" />
          </div>
        ))}

        {/* ── Live API rows ── */}
        {!isLoading && apis.map((api, i) => {
          const isPositive = api.trend >= 0;
          const trendColor = isPositive ? '#4ade80' : '#f43f5e';
          const trendArrow = isPositive ? '↗' : '↘';
          const trendLabel = `${isPositive ? '+' : ''}${api.trend.toFixed(1)}%`;

          return (
            <div key={api.id} className="list-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: 'var(--text-muted)', flexShrink: 0
                }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{api.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{api.provider}</div>
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                  {formatHits(api.totalRequests)} hits
                </div>
                <div style={{
                  fontSize: 11,
                  color: trendColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2
                }}>
                  {trendArrow} {trendLabel}
                </div>
              </div>
            </div>
          );
        })}

        {/* ── Empty state ── */}
        {!isLoading && apis.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No active API data available.
          </div>
        )}
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        const res = await fetch('/api/v1/admin/platform/activity-feed', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          // Assume feed is returned ordered newest first
          setLogs(json.feed || []);
        }
      } catch (err) {
        console.error('Failed to fetch activity feed', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFeed();
  }, []);

  useEffect(() => {
    if (isPaused) return;

    const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
    const socket = io('/admin/platform', {
      auth: { token },
      transports: ['websocket']
    });

    socket.on('new-system-event', (eventLog) => {
      setLogs(prev => [eventLog, ...prev.slice(0, 49)]); // Prepend new log
    });

    return () => {
      socket.disconnect();
    };
  }, [isPaused]);

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
      <div className="terminal-body">
        {isLoading && (
           <div className="w-full h-full bg-white/5 rounded animate-[pulse_2s_ease-in-out_infinite]" />
        )}
        {!isLoading && logs.length === 0 && <div style={{ color: 'var(--text-muted)', padding: 16 }}>Waiting for incoming traffic...</div>}
        <AnimatePresence initial={false}>
          {!isLoading && logs.map((log) => (
            <motion.div 
              key={log.id} 
              className="terminal-log-line group"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              layout
            >
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
            </motion.div>
          ))}
        </AnimatePresence>
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
