import React from 'react';
import { MapPin, Navigation, AlertTriangle, CloudRain, Car, Clock, Mountain } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

export const RouteSequenceTimeline = ({ plan, activeRouteId = 'safest' }) => {
  const { districtConnectivity } = useApp();

  // If a real planned route is active, display the live sequence of legs
  if (plan && (plan.recommended || plan.alternatives)) {
    const activeRoute = (plan.alternatives || []).find((a) => a.id === activeRouteId) || plan.recommended;
    const legs = activeRoute?.legs || [];
    const originName = plan.origin?.name || 'Origin';
    const destName = plan.destination?.name || 'Destination';

    const getRiskColor = (level) => {
      if (level === 'critical' || level === 'high') return '#EF4444';
      if (level === 'medium') return '#F59E0B';
      return '#10B981';
    };

    return (
      <div className="card" style={{ height: '100%' }}>
        <div className="card-header" style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>Route Sequence</h2>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Sequential legs for <span style={{ fontWeight: 700, color: '#059669' }}>{activeRoute?.name || 'Active Route'}</span>
            </div>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: '#ECFDF5', color: '#065F46' }}>
            {legs.length + 1} points
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {/* Origin Node */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '6px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#059669', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, boxShadow: '0 2px 4px rgba(5,150,105,0.3)' }}>
                <MapPin size={13} />
              </div>
              <div style={{ width: '2px', height: '24px', backgroundColor: '#CBD5E1' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{originName}</div>
              <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>Origin Dispatch Hub</div>
            </div>
          </div>

          {/* Road Leg Segments */}
          {legs.map((leg, i) => {
            const riskColor = getRiskColor(leg.riskLevel);
            const isLast = i === legs.length - 1;
            const fc = leg.forecastAtArrival;
            const fcRisk = fc?.forecast_risk_level;

            return (
              <div key={'seq-leg-' + i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '6px 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: riskColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>
                    {i + 1}
                  </div>
                  <div style={{ width: '2px', height: isLast ? '24px' : '36px', backgroundColor: '#CBD5E1' }} />
                </div>
                <div style={{ flex: 1, background: '#F8FAFC', padding: '8px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '4px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{leg.label || leg.roadLabel}</span>
                    {leg.etaHours != null && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} /> +{leg.etaHours}h
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                      <Navigation size={11} /> {leg.distanceKm} km
                    </span>
                    <span style={{ color: riskColor, fontWeight: 700 }}>
                      Risk: {leg.riskScore}/100 ({leg.riskLevel})
                    </span>
                    {leg.climbGainM != null && leg.climbGainM > 0 && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#92400E', fontWeight: 600 }}>
                        <Mountain size={11} /> +{Math.round(leg.climbGainM)}m {leg.maxGradientPct ? `(${leg.maxGradientPct}%)` : ''}
                      </span>
                    )}
                    {fc && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontWeight: 700,
                        color: (fcRisk === 'critical' || fcRisk === 'high') ? '#DC2626' : fcRisk === 'medium' ? '#D97706' : '#0284C7',
                        background: (fcRisk === 'critical' || fcRisk === 'high') ? '#FEF2F2' : '#F0F9FF',
                        padding: '1px 5px',
                        borderRadius: 4,
                      }}>
                        <CloudRain size={11} /> ETA: {fc.weather_desc || 'Rain'} ({fc.forecast_precip_mm} mm/h)
                      </span>
                    )}
                    {leg.congestionLevel && leg.congestionLevel !== 'low' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#EA580C' }}>
                        <Car size={11} /> {leg.congestionLevel}
                      </span>
                    )}
                    {leg.isFerryLeg && (
                      <span style={{ fontSize: '10px', background: '#E0F2FE', color: '#0369A1', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        🚢 IWAI Ro-Ro Vessel Crossing • {leg.riverCurrent || 'Current: Safe'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}


          {/* Destination Node */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '6px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#DC2626', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, boxShadow: '0 2px 4px rgba(220,38,38,0.3)' }}>
                <MapPin size={13} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{destName}</div>
              <div style={{ fontSize: '11px', color: '#DC2626', fontWeight: 600 }}>Destination Hub</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback to district connectivity if no active plan
  const districts = districtConnectivity || [];
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Route Sequence</h2>
      </div>
      {districts.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Loading route data...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {districts.slice(0, 6).map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '8px 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: d.score >= 70 ? '#10B981' : d.score >= 50 ? '#F59E0B' : '#EF4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>
                  {i + 1}
                </div>
                {i < districts.length - 1 && <div style={{ width: '2px', height: '20px', backgroundColor: '#e2e8f0' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{d.district}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Connectivity: {d.score}%</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
