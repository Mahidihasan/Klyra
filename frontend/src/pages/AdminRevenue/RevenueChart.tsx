import React from 'react';
import { TimeSeriesPoint } from '../../types/adminRevenue';

interface Props {
  data: TimeSeriesPoint[];
  range: '7d' | '30d' | '1y';
}

const PAD = { top: 20, right: 20, bottom: 30, left: 60 };

export const RevenueChart: React.FC<Props> = ({ data, range }) => {
  // If we don't have enough data to draw a line, show a placeholder
  if (!data || data.length < 2) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        Not enough data to display chart.
      </div>
    );
  }

  const CHART_HEIGHT = 300;
  const plotHeight = CHART_HEIGHT - PAD.top - PAD.bottom;
  
  const minVol = 0;
  const maxVol = Math.max(...data.map(d => d.volume), 100); // give it some headroom
  const maxVolPadded = maxVol * 1.1; 

  const startT = new Date(data[0].date).getTime();
  const endT = new Date(data[data.length - 1].date).getTime();
  const rangeT = endT - startT || 1;

  // Format Y-axis labels
  const yLabels = [
    maxVolPadded,
    maxVolPadded * 0.75,
    maxVolPadded * 0.5,
    maxVolPadded * 0.25,
    0
  ];

  const formatY = (v: number) => {
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
    return `$${Math.round(v)}`;
  };

  const formatX = (dateStr: string) => {
    const d = new Date(dateStr);
    if (range === '1y') {
      return d.toLocaleDateString('en-US', { month: 'short' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Build the path coordinates for a 100% width, fixed height SVG.
  // We use percentages for X so it scales responsively.
  const points = data.map(d => {
    const t = new Date(d.date).getTime();
    const xPct = ((t - startT) / rangeT) * 100;
    const yPx = PAD.top + plotHeight - (d.volume / maxVolPadded) * plotHeight;
    return { xPct, yPx, volume: d.volume, dateStr: d.date };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.xPct} ${p.yPx}`).join(' ');
  // Area needs to close down to the bottom
  const areaD = `${pathD} L 100 ${PAD.top + plotHeight} L 0 ${PAD.top + plotHeight} Z`;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Y-axis labels */}
      <div style={{ position: 'absolute', top: 0, bottom: PAD.bottom, left: 0, width: PAD.left, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11px', paddingRight: '8px', textAlign: 'right' }}>
        {yLabels.map((v, i) => (
          <span key={i} style={{ marginTop: i === 0 ? PAD.top - 6 : 0 }}>{formatY(v)}</span>
        ))}
      </div>

      {/* SVG Container */}
      <div style={{ position: 'absolute', top: 0, left: PAD.left, right: PAD.right, bottom: 0 }}>
        
        {/* Horizontal grid lines overlay */}
        <div style={{ position: 'absolute', top: PAD.top, bottom: PAD.bottom, left: 0, right: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
           {yLabels.map((_, i) => (
             <div key={i} style={{ borderBottom: '1px dashed var(--border-subtle)', width: '100%' }} />
           ))}
        </div>

        <svg
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          style={{ overflow: 'visible', display: 'block', position: 'relative', zIndex: 1 }}
        >
          {/* Gradient definition */}
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--status-success)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--status-success)" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          {/* Background area */}
          <path
            d={areaD}
            fill="url(#revenueGradient)"
            vectorEffect="non-scaling-stroke"
            // We use standard SVG coords where X is percentage using coordinate tricks:
            transform="scale(1, 1)"
          />

          {/* Stroke line */}
          <path
            d={pathD}
            fill="none"
            stroke="var(--status-success)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />

          {/* Data Points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={`${p.xPct}%`}
              cy={p.yPx}
              r="4"
              fill="var(--bg-base)"
              stroke="var(--status-success)"
              strokeWidth="2"
            >
               <title>{formatX(p.dateStr)}: {formatCurrency(p.volume)}</title>
            </circle>
          ))}
        </svg>

        {/* X-axis labels */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: PAD.bottom, display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '11px', paddingTop: '8px' }}>
          <span>{formatX(data[0].date)}</span>
          {data.length > 2 && <span>{formatX(data[Math.floor(data.length / 2)].date)}</span>}
          <span>{formatX(data[data.length - 1].date)}</span>
        </div>
      </div>
    </div>
  );
};
