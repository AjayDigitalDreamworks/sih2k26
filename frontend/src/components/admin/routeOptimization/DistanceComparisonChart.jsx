import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const DistanceComparisonChart = ({ plan, activeRouteId = 'safest' }) => {
  const { districtConnectivity } = useApp();

  // If a real plan with alternatives exists, show distance comparison
  if (plan && plan.alternatives && plan.alternatives.length > 0) {
    const alts = plan.alternatives;
    const maxDist = Math.max(...alts.map((a) => a.totalDistanceKm || a.distanceKm || 1), 1);

    return (
      <div className="card" style={{ height: '100%' }}>
        <div className="card-header" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Alternative Distance Comparison</h2>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Real km (OSRM)</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {alts.map((alt) => {
            const dist = alt.totalDistanceKm || alt.distanceKm || 0;
            const pct = Math.min(100, Math.round((dist / maxDist) * 100));
            const isActive = alt.id === activeRouteId;

            return (
              <div key={alt.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '110px', fontSize: '12px', fontWeight: isActive ? 700 : 500, color: isActive ? '#065F46' : 'var(--text-primary)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {alt.name}
                </div>
                <div style={{ flex: 1, height: '22px', backgroundColor: '#F1F5F9', borderRadius: '6px', overflow: 'hidden', padding: '2px' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      backgroundColor: isActive ? '#10B981' : '#64748B',
                      borderRadius: '4px',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
                <div style={{ width: '55px', fontSize: '12px', fontWeight: 700, color: isActive ? '#059669' : '#475569', flexShrink: 0 }}>
                  {dist} km
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback to district connectivity if no active plan
  const districts = districtConnectivity || [];
  const data = districts.slice(0, 5).map((d) => ({
    name: d.district,
    score: d.score,
  }));

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>District Connectivity Comparison</h2>
      </div>
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '100px', fontSize: '12px', textAlign: 'right', flexShrink: 0 }}>{d.name}</div>
              <div style={{ flex: 1, height: '20px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${d.score}%`, backgroundColor: d.score >= 70 ? '#10B981' : d.score >= 50 ? '#F59E0B' : '#EF4444', borderRadius: '4px' }} />
              </div>
              <div style={{ width: '35px', fontSize: '12px', fontWeight: 600 }}>{d.score}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
