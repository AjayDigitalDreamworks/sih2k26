import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { Navigation, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';

export const DistanceComparisonChart = ({ plan, activeRouteId = 'safest' }) => {
  const { districtConnectivity } = useApp();

  // If a real plan with alternatives exists, show distance comparison as clean cards
  if (plan && plan.alternatives && plan.alternatives.length > 0) {
    const alts = plan.alternatives;

    return (
      <div className="card" style={{ height: '100%' }}>
        <div className="card-header" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Route Distance Comparison</h2>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>OSRM Real-Road</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alts.map((alt) => {
            const dist = alt.totalDistanceKm || alt.distanceKm || 0;
            const isActive = alt.id === activeRouteId;
            const isSafe = (alt.riskScore || 0) <= 30;
            const profileIcon = alt.id === 'optimal' ? '🌟'
              : alt.id === 'safest' ? '🛡️'
              : alt.id === 'shortest' ? '⚡'
              : alt.id === 'economical' ? '💰' : '🔀';

            return (
              <div
                key={alt.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: isActive ? '#ECFDF5' : '#F8FAFC',
                  border: isActive ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>{profileIcon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: isActive ? 700 : 600,
                      color: isActive ? '#065F46' : '#1E293B',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {alt.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      {isSafe
                        ? <ShieldCheck size={11} color="#10B981" />
                        : <ShieldAlert size={11} color="#EF4444" />}
                      <span>Risk {alt.riskScore}/100</span>
                      {alt.avgTravelHours && (
                        <>
                          <span style={{ color: '#CBD5E1' }}>·</span>
                          <Clock size={11} />
                          <span>{alt.avgTravelHours}h</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: isActive ? '#059669' : '#334155', lineHeight: 1 }}>
                    {dist}
                    <span style={{ fontSize: '11px', fontWeight: 600, marginLeft: '2px' }}>km</span>
                  </div>
                  {isActive && (
                    <div style={{ fontSize: '10px', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
                      Active
                    </div>
                  )}
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
        <h2 className="card-title" style={{ margin: 0 }}>District Connectivity</h2>
      </div>
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '28px 16px', fontSize: '12px' }}>
          Evaluate a corridor above to compare distance across routes.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data.map((d, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: '#F8FAFC',
              borderRadius: '8px',
              border: '1px solid #E2E8F0',
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B' }}>{d.name}</div>
              <div style={{
                fontSize: '12px',
                fontWeight: 700,
                color: d.score >= 70 ? '#059669' : d.score >= 50 ? '#D97706' : '#DC2626',
                padding: '2px 8px',
                borderRadius: '6px',
                background: d.score >= 70 ? '#ECFDF5' : d.score >= 50 ? '#FEF3C7' : '#FEF2F2',
              }}>
                {d.score}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
