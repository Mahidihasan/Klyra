import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ShieldAlert, Zap, Globe, Server, Database } from 'lucide-react';

// Mock Node Data representing our API infrastructure
const NODES = [
  { id: 'gw-eu', label: 'EU Gateway', x: 20, y: 30, type: 'gateway', status: 'healthy' },
  { id: 'gw-us', label: 'US Gateway', x: 25, y: 70, type: 'gateway', status: 'warning' },
  { id: 'gw-ap', label: 'AP Gateway', x: 80, y: 40, type: 'gateway', status: 'healthy' },
  { id: 'auth-svc', label: 'Auth Service', x: 45, y: 20, type: 'service', status: 'healthy' },
  { id: 'pay-svc', label: 'Payment API', x: 50, y: 80, type: 'service', status: 'healthy' },
  { id: 'db-primary', label: 'Primary DB', x: 60, y: 50, type: 'database', status: 'healthy' },
  { id: 'ml-engine', label: 'ML Engine', x: 75, y: 75, type: 'service', status: 'error' },
];

// Connection lines between nodes
const CONNECTIONS = [
  { source: 'gw-eu', target: 'auth-svc' },
  { source: 'gw-us', target: 'auth-svc' },
  { source: 'gw-ap', target: 'auth-svc' },
  { source: 'auth-svc', target: 'db-primary' },
  { source: 'gw-eu', target: 'pay-svc' },
  { source: 'gw-us', target: 'pay-svc' },
  { source: 'pay-svc', target: 'db-primary' },
  { source: 'gw-ap', target: 'ml-engine' },
  { source: 'ml-engine', target: 'db-primary' },
];

interface Particle {
  id: string;
  connectionIdx: number;
  progress: number;
  speed: number;
  color: string;
}

export const TrafficNexusWidget = () => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [metrics, setMetrics] = useState({ reqSec: 0, latency: 0, blocks: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Simulate real-time metrics and particle traffic
  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const token = localStorage.getItem('klyra_access_token') || localStorage.getItem('klyra_token');
        const res = await fetch('/api/v1/admin/platform/overview', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const json = await res.json();
          setMetrics({
            reqSec: json.requestsPerSecond || 12450,
            latency: json.globalLatency || 42,
            blocks: json.threatBlocks || 104
          });
        }
      } catch (err) {
        console.error('Failed to fetch nexus metrics', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOverview();
    const interval = setInterval(fetchOverview, 10000);

    const particleInterval = setInterval(() => {
      setParticles(prev => {
        // Remove particles that finished their journey (progress > 100)
        let newParticles = prev.filter(p => p.progress < 100).map(p => ({ ...p, progress: p.progress + p.speed }));
        
        // Spawn new particle randomly
        if (Math.random() > 0.3 && newParticles.length < 25) {
          const connIdx = Math.floor(Math.random() * CONNECTIONS.length);
          const isError = Math.random() > 0.85;
          newParticles.push({
            id: `p-${Date.now()}-${Math.random()}`,
            connectionIdx: connIdx,
            progress: 0,
            speed: 1 + Math.random() * 2,
            color: isError ? '#ef4444' : '#10b981' // Red or Green
          });
        }
        return newParticles;
      });
    }, 50);

    return () => {
      clearInterval(interval);
      clearInterval(particleInterval);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'error': return '#ef4444';
      default: return '#a78bfa';
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'gateway': return <Globe size={14} />;
      case 'database': return <Database size={14} />;
      case 'service': return <Server size={14} />;
      default: return <Server size={14} />;
    }
  };

  return (
    <div className="relative w-full h-[500px] rounded-2xl overflow-hidden bg-[#0a0a0f] border border-white/10 shadow-2xl flex flex-col group mt-6 mb-6">
      
      {/* Dynamic Grid Background */}
      <div 
        className="absolute inset-0 opacity-[0.03] z-0 pointer-events-none" 
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '30px 30px'
        }}
      />

      {/* Title Header */}
      <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-start pointer-events-none">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Zap className="text-fuchsia-500" size={20} />
            Traffic Nexus
          </h3>
          <p className="text-white/40 text-sm mt-1">Live Global Gateway Feed</p>
        </div>
      </div>

      {/* Abstract Map Canvas */}
      <div className="absolute inset-0 z-10">
        <svg width="100%" height="100%" className="overflow-visible">
          {/* Static Connection Lines */}
          {CONNECTIONS.map((conn, i) => {
            const sourceNode = NODES.find(n => n.id === conn.source);
            const targetNode = NODES.find(n => n.id === conn.target);
            if (!sourceNode || !targetNode) return null;
            
            return (
              <line 
                key={`line-${i}`}
                x1={`${sourceNode.x}%`} 
                y1={`${sourceNode.y}%`} 
                x2={`${targetNode.x}%`} 
                y2={`${targetNode.y}%`}
                stroke="rgba(255, 255, 255, 0.05)"
                strokeWidth={2}
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Animated Particles flowing on lines */}
          {particles.map(p => {
            const conn = CONNECTIONS[p.connectionIdx];
            const sourceNode = NODES.find(n => n.id === conn.source);
            const targetNode = NODES.find(n => n.id === conn.target);
            if (!sourceNode || !targetNode) return null;

            // Interpolate position based on progress (0-100)
            const currentX = sourceNode.x + ((targetNode.x - sourceNode.x) * (p.progress / 100));
            const currentY = sourceNode.y + ((targetNode.y - sourceNode.y) * (p.progress / 100));

            return (
              <circle 
                key={p.id}
                cx={`${currentX}%`}
                cy={`${currentY}%`}
                r={3}
                fill={p.color}
                style={{
                  filter: `drop-shadow(0 0 8px ${p.color})`,
                  transition: 'cx 0.05s linear, cy 0.05s linear'
                }}
              />
            );
          })}
        </svg>

        {/* The Nodes */}
        {NODES.map((node, i) => {
          const color = getStatusColor(node.status);
          
          return (
            <motion.div
              key={node.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center cursor-crosshair"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 200, damping: 20 }}
            >
              {/* Pulse Ring */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: `1px solid ${color}`, opacity: 0.5 }}
                animate={{ scale: [1, 1.8, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              
              {/* Node Core */}
              <div 
                className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300"
                style={{ 
                  background: `linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0))`,
                  border: `1px solid ${color}40`,
                  boxShadow: `0 0 20px ${color}20 inset`
                }}
              >
                <div style={{ color: color }}>
                  {getNodeIcon(node.type)}
                </div>
              </div>
              
              {/* Node Label */}
              <div className="absolute top-10 whitespace-nowrap bg-white/5 backdrop-blur-md px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider text-white/60 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                {node.label}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Glass Overlay Metrics */}
      <div className="absolute bottom-6 left-6 right-6 z-30 flex gap-4 pointer-events-none">
        
        {/* Metric 1 */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex-1 bg-[#0a0a0f]/40 backdrop-blur-xl border border-white/10 rounded-xl p-4 overflow-hidden relative"
        >
          <div className="absolute top-0 left-0 w-[2px] h-full bg-emerald-500" />
          <div className="flex items-center gap-2 text-white/50 text-xs font-semibold tracking-wider uppercase mb-1">
            <Activity size={14} /> Requests / Sec
          </div>
          <div className="text-3xl font-black text-white font-mono">
            {isLoading ? <div className="bg-white/10 w-24 h-8 rounded animate-pulse" /> : metrics.reqSec.toLocaleString()}
          </div>
        </motion.div>

        {/* Metric 2 */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex-1 bg-[#0a0a0f]/40 backdrop-blur-xl border border-white/10 rounded-xl p-4 overflow-hidden relative"
        >
          <div className="absolute top-0 left-0 w-[2px] h-full bg-purple-500" />
          <div className="flex items-center gap-2 text-white/50 text-xs font-semibold tracking-wider uppercase mb-1">
            <Globe size={14} /> Global Latency
          </div>
          <div className="text-3xl font-black text-white font-mono flex items-baseline gap-1">
            {isLoading ? <div className="bg-white/10 w-24 h-8 rounded animate-pulse" /> : <>{metrics.latency} <span className="text-sm text-white/40">ms</span></>}
          </div>
        </motion.div>

        {/* Metric 3 */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex-1 bg-[#0a0a0f]/40 backdrop-blur-xl border border-white/10 rounded-xl p-4 overflow-hidden relative"
        >
          <div className="absolute top-0 left-0 w-[2px] h-full bg-pink-500" />
          <div className="flex items-center gap-2 text-white/50 text-xs font-semibold tracking-wider uppercase mb-1">
            <ShieldAlert size={14} /> Threat Blocks
          </div>
          <div className="text-3xl font-black text-white font-mono">
            {isLoading ? <div className="bg-white/10 w-24 h-8 rounded animate-pulse" /> : metrics.blocks.toLocaleString()}
          </div>
        </motion.div>

      </div>
    </div>
  );
};
