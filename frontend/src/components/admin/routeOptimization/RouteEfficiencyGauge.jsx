import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const RouteEfficiencyGauge = ({ plan, activeRouteId = 'safest' }) => {
  const { districtConnectivity } = useApp();

  // If a real plan exists, calculate route efficiency for the active route
  if (plan && (plan.recommended || plan.alternatives)) {
    const activeRoute = (plan.alternatives || []).find((a) => a.id === activeRouteId) || plan.recommended;
    const risk = activeRoute?.riskScore || 0;
    const dist = activeRoute?.totalDistanceKm || activeRoute?.distanceKm || 15;
    const effScore = Math.max(35, Math.min(99, Math.round(100 - risk * 0.6 - dist * 0.12)));

    const scoreColor = effScore >= 75 ? '#10B981' : effScore >= 55 ? '#F59E0B' : '#EF4444';
    const statusText = effScore >= 75 ? 'Optimal Efficiency' : effScore >= 55 ? 'Moderate Delay Risk' : 'High Congestion / Risk';

    return (
      <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Route Efficiency</div>
        <div style={{ fontSize: '36px', fontWeight: 700, color: scoreColor }}>
          {effScore}%
        </div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: scoreColor, marginTop: '4px' }}>
          {statusText}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {activeRoute?.name || 'Active route'} ({dist} km)
        </div>
      </div>
    );
  }

  // Fallback to average district connectivity
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
