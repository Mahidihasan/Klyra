          {latencyLine.length > 0 && (
            <svg viewBox="0 0 300 60" className="latencyLegend" preserveAspectRatio="none" aria-hidden="true">
              <polyline
                points={latencyLine.map((v, i) => `${(i / Math.max(latencyLine.length - 1, 1)) * 300},${58 - v * 54}`).join(' ')}
                fill="none"
                stroke="#a855f7"
                strokeWidth="1.5"
                opacity="0.85"
              />
            </svg>
          )}
          {latencyLine.length > 0 && (