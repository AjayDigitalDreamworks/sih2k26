import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const VehiclesStatusBarChart = () => {
  const { vehicles } = useApp();
  const vehicleList = vehicles || [];

  const statusCounts = vehicleList.reduce((acc, v) => {
    const s = (v.statusClass || 'moving').toLowerCase();
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const bars = [
    { label: 'Moving', count: statusCounts.moving || 0, color: '#047857' },
    { label: 'Idle', count: statusCounts.idle || 0, color: '#3B82F6' },
    { label: 'Stopped', count: statusCounts.stopped || 0, color: '#EF4444' },
    { label: 'Delayed', count: statusCounts.delayed || 0, color: '#F59E0B' },
    { label: 'Offline', count: statusCounts.offline || 0, color: '#94A3B8' },
  ];

  const maxVal = Math.max(...bars.map(b => b.count), 1);

  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom: '8px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Vehicles by Status</h2>
      </div>

      <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '12px', padding: '10px 0 0 0', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
          <span>{maxVal}</span>
          <span>{Math.round(maxVal * 0.75)}</span>
          <span>{Math.round(maxVal * 0.5)}</span>
          <span>{Math.round(maxVal * 0.25)}</span>
          <span>0</span>
        </div>

        {bars.map((b, i) => {
          const heightPercent = maxVal > 0 ? (b.count / maxVal) * 100 : 0;

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                flex: 1,
                height: '100%',
                justifyContent: 'flex-end',
                marginLeft: i === 0 ? '24px' : '0',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {b.count}
              </span>
              <div
                style={{
                  width: '100%',
                  maxWidth: '36px',
                  height: Math.max(heightPercent, 2) + '%',
                  backgroundColor: b.color,
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.4s ease',
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
