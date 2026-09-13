import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { TrafficRange, TrafficSeries, TRAFFIC_RANGE_OPTIONS } from '../../types/admin';

import { formatBucketLabel, formatBucketTooltip, formatCompact, formatInteger } from './format';

/**
 * Traffic & error-rate chart.
 *
 * Drawn as plain SVG, following pages/Billing/SpendingChart.tsx — the project
 * still has no charting dependency, and this screen isn't the place to add one.
 *
 * Two layers on one plot:
 *   - stacked areas for request volume by response class (2xx / 4xx / 5xx)
 *   - a neutral dashed line for the error rate, on its own right-hand axis
 *
 * The overlay earns its keep: healthy platforms serve so many 2xx that a 5xx
 * band is a few pixels tall, so a rate spike is invisible in the stack. The
 * line is deliberately non-categorical in colour so it reads as an annotation
 * over the three coloured series rather than a fourth category.
 */

const CHART_HEIGHT = 268;
const PAD = { top: 18, right: 50, bottom: 28, left: 54 };
const Y_TICKS = 4;

/** 2xx uses the brand violet: it's the baseline volume, not a "good" signal. */
const SERIES = [
  { key: 'success', label: '2xx', color: '#8b5cf6', description: 'Successful' },
  { key: 'clientError', label: '4xx', color: '#f59e0b', description: 'Client errors' },
  { key: 'serverError', label: '5xx', color: '#ef4444', description: 'Server errors' },
] as const;

interface TrafficChartProps {
  traffic: TrafficSeries;
  range: TrafficRange;
  onRangeChange: (range: TrafficRange) => void;
  /** True while a range switch is in flight, so the toggle can disable. */
  isBusy?: boolean;
}

/** Round an axis maximum up to a readable value (1, 2, 2.5, 5 or 10 × 10ⁿ). */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step =
    normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Measure the container so the SVG can be drawn in real pixels.
 *
 * A viewBox would be less code, but it scales the axis text with the container
 * and forces a coordinate transform on every hover. Real pixels keep labels at
 * their intended size and make hit-testing a subtraction.
 */
function useElementWidth(ref: React.RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });

    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, [ref]);

  return width;
}

export const TrafficChart: React.FC<TrafficChartProps> = ({
  traffic,
  range,
  onRangeChange,
  isBusy = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(containerRef);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { points, bucketMinutes, totals } = traffic;

  const geometry = useMemo(() => {
    const plotWidth = Math.max(width - PAD.left - PAD.right, 1);
    const plotHeight = CHART_HEIGHT - PAD.top - PAD.bottom;

    const stackTotals = points.map((p) => p.success + p.clientError + p.serverError);
    const rates = points.map((p, i) =>
      stackTotals[i] === 0 ? 0 : ((p.clientError + p.serverError) / stackTotals[i]) * 100,
    );

    const volumeMax = niceCeiling(Math.max(...stackTotals, 1));
    // Floor the rate axis at 5% so a quiet, healthy period doesn't magnify
    // ordinary noise into an alarming-looking mountain.
    const rateMax = niceCeiling(Math.max(...rates, 5));

    const step = plotWidth / Math.max(points.length - 1, 1);
    const xAt = (index: number) => PAD.left + index * step;
    const yVolume = (value: number) => PAD.top + (1 - value / volumeMax) * plotHeight;
    const yRate = (value: number) => PAD.top + (1 - value / rateMax) * plotHeight;

    return {
      plotWidth,
      plotHeight,
      stackTotals,
      rates,
      volumeMax,
      rateMax,
      step,
      xAt,
      yVolume,
      yRate,
    };
  }, [points, width]);

  const bands = useMemo(() => {
    if (points.length === 0 || width === 0) return [];
    const { xAt, yVolume } = geometry;

    let lower = points.map(() => 0);

    return SERIES.map((series) => {
      const upper = points.map((point, i) => lower[i] + point[series.key]);

      const top = upper.map((value, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yVolume(value)}`);
      const bottom = lower
        .map((value, i) => ({ value, i }))
        .reverse()
        .map(({ value, i }) => `L${xAt(i)},${yVolume(value)}`);

      const path = `${top.join('')}${bottom.join('')}Z`;
      lower = upper;

      return { ...series, path };
    });
  }, [geometry, points, width]);

  const ratePath = useMemo(() => {
    if (points.length === 0 || width === 0) return '';
    const { xAt, yRate, rates } = geometry;
    return rates.map((value, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yRate(value)}`).join('');
  }, [geometry, points, width]);

  const xLabels = useMemo(() => {
    if (points.length === 0) return [];
    const count = width < 520 ? 3 : width < 760 ? 5 : 7;
    const last = points.length - 1;
    const indices = Array.from({ length: count }, (_, i) =>
      Math.round((i * last) / Math.max(count - 1, 1)),
    );
    return [...new Set(indices)];
  }, [points, width]);

  /** Map a pointer position to the nearest bucket. */
  const indexFromClientX = useCallback(
    (clientX: number): number | null => {
      const svg = containerRef.current?.querySelector('svg');
      if (!svg || points.length === 0) return null;

      const rect = svg.getBoundingClientRect();
      const offset = clientX - rect.left - PAD.left;
      const index = Math.round(offset / geometry.step);
      return Math.min(Math.max(index, 0), points.length - 1);
    },
    [geometry.step, points.length],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      setActiveIndex(indexFromClientX(event.clientX));
    },
    [indexFromClientX],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<SVGSVGElement>) => {
      if (points.length === 0) return;

      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        setActiveIndex((current) => {
          const next = (current ?? (delta > 0 ? -1 : points.length)) + delta;
          return Math.min(Math.max(next, 0), points.length - 1);
        });
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        setActiveIndex(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setActiveIndex(points.length - 1);
      } else if (event.key === 'Escape') {
        setActiveIndex(null);
      }
    },
    [points.length],
  );

  const activePoint = activeIndex === null ? null : points[activeIndex] ?? null;
  const activeTotal = activeIndex === null ? 0 : geometry.stackTotals[activeIndex] ?? 0;
  const activeRate = activeIndex === null ? 0 : geometry.rates[activeIndex] ?? 0;

  const activeSummary = activePoint
    ? `${formatBucketTooltip(activePoint.timestamp, bucketMinutes)}: ${formatInteger(
        activeTotal,
      )} requests, ${activeRate.toFixed(1)}% errors`
    : '';

  const hasTraffic = totals.total > 0;

  return (
    <section className="tc-card card-base">
      <header className="tc-head">
        <div>
          <h2 className="tc-title">Traffic &amp; error rate</h2>
          <p className="tc-subtitle">
            {hasTraffic
              ? `${formatInteger(totals.total)} requests · ${totals.errorRatePercent}% errored`
              : 'No requests recorded in this window.'}
          </p>
        </div>

        <div className="tc-ranges" role="group" aria-label="Time range">
          {TRAFFIC_RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`tc-range ${range === option.id ? 'active' : ''}`}
              aria-pressed={range === option.id}
              disabled={isBusy}
              onClick={() => onRangeChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className="tc-legend">
        {SERIES.map((series) => (
          <span className="tc-legend-item" key={series.key}>
            <span className="tc-swatch" style={{ backgroundColor: series.color }} />
            <span className="tc-legend-label">{series.label}</span>
            <span className="tc-legend-value">{formatCompact(totals[series.key])}</span>
          </span>
        ))}
        <span className="tc-legend-item">
          <span className="tc-swatch dashed" />
          <span className="tc-legend-label">Error rate</span>
          <span className="tc-legend-value">{totals.errorRatePercent}%</span>
        </span>
      </div>

      <div className="tc-plot" ref={containerRef}>
        {width > 0 && points.length > 0 && (
          <svg
            width={width}
            height={CHART_HEIGHT}
            className="tc-svg"
            role="img"
            tabIndex={0}
            aria-label={`Requests over the last ${range}. ${formatInteger(
              totals.total,
            )} requests, ${totals.errorRatePercent}% errors. Use arrow keys to inspect each point.`}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setActiveIndex(null)}
            onKeyDown={handleKeyDown}
            onBlur={() => setActiveIndex(null)}
          >
            <defs>
              {SERIES.map((series) => (
                <linearGradient
                  id={`tc-fill-${series.key}`}
                  key={series.key}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={series.color} stopOpacity="0.55" />
                  <stop offset="100%" stopColor={series.color} stopOpacity="0.16" />
                </linearGradient>
              ))}
            </defs>

            {/* Horizontal gridlines and the volume axis. */}
            {Array.from({ length: Y_TICKS + 1 }, (_, i) => {
              const value = (geometry.volumeMax / Y_TICKS) * i;
              const y = geometry.yVolume(value);
              return (
                <g key={`grid-${i}`}>
                  <line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={y}
                    y2={y}
                    className="tc-gridline"
                  />
                  <text x={PAD.left - 10} y={y + 4} className="tc-axis-label end">
                    {formatCompact(value)}
                  </text>
                  <text x={width - PAD.right + 10} y={y + 4} className="tc-axis-label rate">
                    {Math.round((geometry.rateMax / Y_TICKS) * i)}%
                  </text>
                </g>
              );
            })}

            {bands.map((band) => (
              <path key={band.key} d={band.path} fill={`url(#tc-fill-${band.key})`} stroke="none" />
            ))}

            <path d={ratePath} className="tc-rate-line" />

            {/* Time axis. */}
            {xLabels.map((index) => (
              <text
                key={`x-${index}`}
                x={geometry.xAt(index)}
                y={CHART_HEIGHT - 8}
                className="tc-axis-label middle"
              >
                {formatBucketLabel(points[index].timestamp, bucketMinutes)}
              </text>
            ))}

            {activeIndex !== null && activePoint && (
              <g className="tc-cursor">
                <line
                  x1={geometry.xAt(activeIndex)}
                  x2={geometry.xAt(activeIndex)}
                  y1={PAD.top}
                  y2={CHART_HEIGHT - PAD.bottom}
                  className="tc-crosshair"
                />
                <circle
                  cx={geometry.xAt(activeIndex)}
                  cy={geometry.yVolume(activeTotal)}
                  r={4}
                  className="tc-dot volume"
                />
                <circle
                  cx={geometry.xAt(activeIndex)}
                  cy={geometry.yRate(activeRate)}
                  r={3.5}
                  className="tc-dot rate"
                />
              </g>
            )}
          </svg>
        )}

        {activePoint && (
          <div
            className="tc-tooltip"
            style={{
              left: geometry.xAt(activeIndex as number),
              transform:
                geometry.xAt(activeIndex as number) > width / 2
                  ? 'translate(calc(-100% - 14px), 0)'
                  : 'translate(14px, 0)',
            }}
          >
            <p className="tc-tooltip-time">
              {formatBucketTooltip(activePoint.timestamp, bucketMinutes)}
            </p>
            {SERIES.map((series) => (
              <p className="tc-tooltip-row" key={series.key}>
                <span className="tc-swatch" style={{ backgroundColor: series.color }} />
                <span className="tc-tooltip-label">{series.description}</span>
                <span className="tc-tooltip-value">{formatInteger(activePoint[series.key])}</span>
              </p>
            ))}
            <p className="tc-tooltip-row total">
              <span className="tc-tooltip-label">Error rate</span>
              <span className="tc-tooltip-value">{activeRate.toFixed(1)}%</span>
            </p>
          </div>
        )}

        {!hasTraffic && width > 0 && (
          <p className="tc-empty">
            Nothing to plot yet — no requests were recorded in this window.
          </p>
        )}
      </div>

      <p className="tc-sr" aria-live="polite">
        {activeSummary}
      </p>

      <style>{`
        .tc-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .tc-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }

        .tc-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .tc-subtitle {
          margin-top: 3px;
          font-size: 12px;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }

        .tc-ranges {
          display: flex;
          gap: 6px;
        }

        .tc-range {
          height: 28px;
          padding: 0 12px;
          border-radius: 999px;
          background-color: var(--bg-pill);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
        }

        .tc-range:hover:not(:disabled) {
          color: var(--text-primary);
          border-color: rgba(139, 92, 246, 0.35);
        }

        .tc-range.active {
          background-color: rgba(139, 92, 246, 0.14);
          border-color: rgba(139, 92, 246, 0.45);
          color: var(--text-accent);
        }

        .tc-range:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .tc-legend {
          display: flex;
          gap: 18px;
          flex-wrap: wrap;
        }

        .tc-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .tc-swatch {
          width: 9px;
          height: 9px;
          border-radius: 2px;
          flex-shrink: 0;
        }

        .tc-swatch.dashed {
          width: 12px;
          height: 0;
          border-radius: 0;
          border-top: 2px dashed rgba(248, 250, 252, 0.75);
        }

        .tc-legend-label {
          font-size: 11px;
          color: var(--text-muted);
        }

        .tc-legend-value {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          font-variant-numeric: tabular-nums;
        }

        .tc-plot {
          position: relative;
          width: 100%;
          min-height: ${CHART_HEIGHT}px;
        }

        .tc-svg {
          display: block;
          overflow: visible;
          touch-action: pan-y;
        }

        .tc-svg:focus {
          outline: none;
        }

        .tc-svg:focus-visible {
          outline: 2px solid var(--accent-purple);
          outline-offset: 4px;
          border-radius: 6px;
        }

        .tc-gridline {
          stroke: rgba(255, 255, 255, 0.05);
          stroke-width: 1;
          shape-rendering: crispEdges;
        }

        .tc-axis-label {
          fill: var(--text-muted);
          font-size: 10px;
          font-family: var(--font-mono);
        }

        .tc-axis-label.end { text-anchor: end; }
        .tc-axis-label.middle { text-anchor: middle; }
        .tc-axis-label.rate { text-anchor: start; opacity: 0.65; }

        .tc-rate-line {
          fill: none;
          stroke: rgba(248, 250, 252, 0.75);
          stroke-width: 1.5;
          stroke-dasharray: 4 3;
          stroke-linejoin: round;
        }

        .tc-crosshair {
          stroke: rgba(255, 255, 255, 0.22);
          stroke-width: 1;
          shape-rendering: crispEdges;
        }

        .tc-dot {
          stroke: var(--bg-card);
          stroke-width: 2;
        }

        .tc-dot.volume { fill: var(--accent-purple); }
        .tc-dot.rate { fill: #f8fafc; }

        .tc-tooltip {
          position: absolute;
          top: 12px;
          z-index: 2;
          min-width: 168px;
          padding: 10px 12px;
          border-radius: var(--radius-md);
          background-color: var(--bg-sidebar);
          border: 1px solid var(--border-card);
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
          pointer-events: none;
        }

        .tc-tooltip-time {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 7px;
        }

        .tc-tooltip-row {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          line-height: 1.9;
        }

        .tc-tooltip-row.total {
          margin-top: 5px;
          padding-top: 6px;
          border-top: 1px solid var(--border-subtle);
        }

        .tc-tooltip-label {
          color: var(--text-muted);
        }

        .tc-tooltip-value {
          margin-left: auto;
          color: var(--text-primary);
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }

        .tc-empty {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          color: var(--text-muted);
          text-align: center;
          padding: 0 24px;
        }

        /* Announced to screen readers as the keyboard cursor moves. */
        .tc-sr {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
          border: 0;
        }

        @media (max-width: 640px) {
          .tc-legend { gap: 12px; }
        }
      `}</style>
    </section>
  );
};
