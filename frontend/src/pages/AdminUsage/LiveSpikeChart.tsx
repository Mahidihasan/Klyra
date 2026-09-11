import React from 'react';
import { TimeSeriesPoint } from '../../types/adminUsage';

interface Props {
  data: TimeSeriesPoint[];
}

const PAD = { top: 20, right: 40, bottom: 30, left: 40 };

export const LiveSpikeChart: React.FC<Props> = ({ data }) => {
  if (!data || data.length < 2) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Waiting for telemetry data...
      </div>
    );
  }

  const CHART_HEIGHT = 300;
  const plotHeight = CHART_HEIGHT - PAD.top - PAD.bottom;
  
  const maxReq = Math.max(...data.map(d => d.requests), 10);
  const maxLat = Math.max(...data.map(d => d.avgLatency), 100);

  const startT = new Date(data[0].timestamp).getTime();
  const endT = new Date(data[data.length - 1].timestamp).getTime();
  const rangeT = endT - startT || 1;

  // Points for Requests (Area)
  const reqPoints = data.map(d => {
    const t = new Date(d.timestamp).getTime();
    const xPct = ((t - startT) / rangeT) * 100;
    const yPx = PAD.top + plotHeight - (d.requests / maxReq) * plotHeight;
    return { xPct, yPx };
  });

  // Points for Latency (Line)
  const latPoints = data.map(d => {
    const t = new Date(d.timestamp).getTime();
    const xPct = ((t - startT) / rangeT) * 100;
    const yPx = PAD.top + plotHeight - (d.avgLatency / maxLat) * plotHeight;
    return { xPct, yPx };
  });

  const reqPathD = reqPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.xPct} ${p.yPx}`).join(' ');
  const reqAreaD = `${reqPathD} L 100 ${PAD.top + plotHeight} L 0 ${PAD.top + plotHeight} Z`;

  const latPathD = latPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.xPct} ${p.yPx}`).join(' ');

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Left Y-axis (Requests) */}
      <div style={{ position: 'absolute', top: 0, bottom: PAD.bottom, left: 0, width: PAD.left, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#3b82f6', fontSize: '11px', paddingRight: '4px', textAlign: 'right' }}>
        <span>{maxReq}</span>
        <span>{Math.round(maxReq / 2)}</span>
        <span>0</span>
      </div>

      {/* Right Y-axis (Latency ms) */}
      <div style={{ position: 'absolute', top: 0, bottom: PAD.bottom, right: 0, width: PAD.right, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: 'var(--status-warning)', fontSize: '11px', paddingLeft: '4px', textAlign: 'left' }}>
        <span>{Math.round(maxLat)}ms</span>
        <span>{Math.round(maxLat / 2)}ms</span>
        <span>0ms</span>
      </div>

      <div style={{ position: 'absolute', top: 0, left: PAD.left, right: PAD.right, bottom: 0 }}>
        <svg width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: 'visible', display: 'block', position: 'relative' }}>
          <defs>
            <linearGradient id="reqGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          {/* Background area (Requests) */}
          <path d={reqAreaD} fill="url(#reqGradient)" vectorEffect="non-scaling-stroke" transform="scale(1, 1)" />
          <path d={reqPathD} fill="none" stroke="#3b82f6" strokeWidth="2" vectorEffect="non-scaling-stroke" />

          {/* Latency Line */}
          <path d={latPathD} fill="none" stroke="var(--status-warning)" strokeWidth="2" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* Legend */}
        <div style={{ position: 'absolute', top: 0, right: 10, display: 'flex', gap: '12px', fontSize: '11px', fontWeight: 500 }}>
          <span style={{ color: '#3b82f6' }}>— Requests/min</span>
          <span style={{ color: 'var(--status-warning)' }}>-- Latency (ms)</span>
        </div>
      </div>
    </div>
  );
};
