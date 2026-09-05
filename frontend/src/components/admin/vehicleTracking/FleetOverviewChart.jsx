import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const FleetOverviewChart = () => {
  const { vehicles } = useApp();
  const vehicleList = vehicles || [];

  const statusCounts = vehicleList.reduce((acc, v) => {
    const s = (v.statusClass || 'moving').toLowerCase();
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const total = vehicleList.length || 1;
  const data = [
    { label: 'Moving', count: statusCounts.moving || 0, percentage: Math.round((statusCounts.moving || 0) / total * 100), color: '#10B981' },
    { label: 'Idle', count: statusCounts.idle || 0, percentage: Math.round((statusCounts.idle || 0) / total * 100), color: '#3B82F6' },
    { label: 'Stopped', count: statusCounts.stopped || 0, percentage: Math.round((statusCounts.stopped || 0) / total * 100), color: '#EF4444' },
    { label: 'Delayed', count: statusCounts.delayed || 0, percentage: Math.round((statusCounts.delayed || 0) / total * 100), color: '#F59E0B' },
    { label: 'Offline', count: statusCounts.offline || 0, percentage: Math.round((statusCounts.offline || 0) / total * 100), color: '#94A3B8' },
  ];

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Fleet Status</h2>
      </div>
      {vehicleList.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>Loading fleet data...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {data.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: '13px' }}>{item.label}</div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.count}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '35px', textAlign: 'right' }}>{item.percentage}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
