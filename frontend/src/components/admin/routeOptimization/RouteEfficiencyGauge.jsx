import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const RouteEfficiencyGauge = () => {
  const { districtConnectivity } = useApp();
  const districts = districtConnectivity || [];
  const avgScore = districts.length ? Math.round(districts.reduce((s, d) => s + d.score, 0) / districts.length) : 0;

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Route Efficiency</div>
      <div style={{ fontSize: '36px', fontWeight: 700, color: avgScore >= 70 ? '#10B981' : avgScore >= 50 ? '#F59E0B' : '#EF4444' }}>
        {avgScore}%
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Avg connectivity score</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{districts.length} districts monitored</div>
    </div>
  );
};
