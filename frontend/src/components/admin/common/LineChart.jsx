import React, { useState } from 'react';

export const LineChart = ({
  data = [],
  series = [],
  height = 200,
  yMax = null,
  showLegend = true,
  className = '',
}) => {
  const [hoverIndex, setHoverIndex] = useState(null);

  if (!data.length || !series.length) return null;

  const padding = { top: 20, right: 24, bottom: 30, left: 36 };
  const width = 600; // viewBox internal units

  // Calculate max value across series
  const maxVal = Math.max(
    ...data.flatMap((d) =>
      series.map((s) => (typeof d[s.key] === 'number' ? d[s.key] : 0))
    ),
    1
  );

  const computedMax = yMax || Math.ceil(maxVal * 1.25);

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (index) => padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
  const getY = (value) => height - padding.bottom - (Math.max(value, 0) / computedMax) * chartHeight;

  const activeItem = hoverIndex !== null && hoverIndex >= 0 && hoverIndex < data.length ? data[hoverIndex] : null;

  return (
    <div className={`line-chart-container ${className}`} style={{ width: '100%', position: 'relative' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
      >
        {/* Horizontal Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = height - padding.bottom - ratio * chartHeight;
          const val = Math.round(ratio * computedMax);
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#E2E8F0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                fill="#94A3B8"
                fontSize="10"
                fontWeight="500"
                textAnchor="end"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.map((d, i) => {
          const x = getX(i);
          const isHovered = hoverIndex === i;
          return (
            <text
              key={i}
              x={x}
              y={height - 8}
              fill={isHovered ? '#0F172A' : '#94A3B8'}
              fontSize="10"
              fontWeight={isHovered ? '700' : '500'}
              textAnchor="middle"
            >
              {d.date || d.label}
            </text>
          );
        })}

        {/* Vertical hover indicator line */}
        {hoverIndex !== null && (
          <line
            x1={getX(hoverIndex)}
            y1={padding.top}
            x2={getX(hoverIndex)}
            y2={height - padding.bottom}
            stroke="#94A3B8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.8"
          />
        )}

        {/* Lines for each series */}
        {series.map((s) => {
          const points = data.map((d, i) => `${getX(i)},${getY(d[s.key] || 0)}`).join(' ');

          return (
            <g key={s.key}>
              <polyline
                fill="none"
                stroke={s.color}
                strokeWidth="2.5"
                points={points}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Dots */}
              {data.map((d, i) => {
                const val = d[s.key] || 0;
                const isHovered = hoverIndex === i;
                return (
                  <circle
                    key={i}
                    cx={getX(i)}
                    cy={getY(val)}
                    r={isHovered ? 5.5 : 3.5}
                    fill={s.color}
                    stroke="#FFFFFF"
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    style={{ transition: 'r 0.15s ease' }}
                  />
                );
              })}
            </g>
          );
        })}

        {/* Interactive Hover Columns */}
        {data.map((d, i) => {
          const x = getX(i);
          const colWidth = chartWidth / Math.max(data.length - 1, 1);
          return (
            <rect
              key={i}
              x={x - colWidth / 2}
              y={padding.top}
              width={colWidth}
              height={chartHeight}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{ cursor: 'pointer' }}
            />
          );
        })}
      </svg>

      {/* Floating Hover Tooltip */}
      {activeItem && hoverIndex !== null && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 15,
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)',
            color: 'white',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '11px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 10,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <strong style={{ color: '#E2E8F0' }}>{activeItem.date || activeItem.label}:</strong>
          <div style={{ display: 'flex', gap: '8px' }}>
            {series.map(s => (
              <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
                <span>{s.label}: <b>{activeItem[s.key] ?? 0}</b></span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            marginTop: '10px',
            flexWrap: 'wrap',
          }}
        >
          {series.map((s) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
              <span
                style={{
                  width: '12px',
                  height: '3px',
                  backgroundColor: s.color,
                  borderRadius: '2px',
                }}
              />
              <span style={{ color: '#475569', fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LineChart;
