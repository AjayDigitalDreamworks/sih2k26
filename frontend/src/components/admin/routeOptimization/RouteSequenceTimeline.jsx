import React from 'react';
import { MapPin, Navigation, AlertTriangle, CloudRain, Car, Clock, Mountain, ArrowRight } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

export const RouteSequenceTimeline = ({ plan, activeRouteId = 'safest' }) => {
  const { districtConnectivity } = useApp();

  const getRiskColor = (level) => {
    if (level === 'critical' || level === 'high') return '#EF4444';
    if (level === 'medium') return '#F59E0B';
    return '#10B981';
  };

  // If a real planned route is active, display the live horizontal sequence of legs
  if (plan && (plan.recommended || plan.alternatives)) {
    const activeRoute = (plan.alternatives || []).find((a) => a.id === activeRouteId) || plan.recommended;
    const legs = activeRoute?.legs || [];
    const originName = plan.origin?.name || 'Origin';
    const destName = plan.destination?.name || 'Destination';

    return (
      <div className="card" style={{ width: '100%', padding: '16px 20px', borderRadius: '16px', background: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {/* Horizontal Sequence Header */}
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#ECFDF5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', flexShrink: 0 }}>
              <Navigation size={16} />
            </div>
            <div>
              <h2 className="card-title" style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
                Route Sequence & Checkpoints
              </h2>
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                Sequential corridor legs for <span style={{ fontWeight: 700, color: '#059669' }}>{activeRoute?.name || 'Active Corridor'}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }}>
              {legs.length + 1} Waypoint Checkpoints
            </span>
            {(activeRoute?.totalDistanceKm || activeRoute?.distanceKm) && (
              <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
                {activeRoute.totalDistanceKm || activeRoute.distanceKm} km total
              </span>
            )}
          </div>
        </div>

        {/* Horizontal Stepper Cards Flow */}
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '10px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'thin' }}>
          {/* 1. Origin Node */}
          <div style={{ minWidth: '180px', maxWidth: '210px', flex: '0 0 auto', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#059669', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, flexShrink: 0, boxShadow: '0 2px 4px rgba(5,150,105,0.3)' }}>
                  <MapPin size={13} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#059669', letterSpacing: '0.05em' }}>Origin Hub</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', lineHeight: 1.3 }}>{originName}</div>
            </div>
            <div style={{ fontSize: '11px', color: '#059669', marginTop: '8px', fontWeight: 600 }}>
              Departure Hub
            </div>
          </div>

          {/* 2. Intermediate Route Legs */}
          {legs.map((leg, i) => {
            const riskColor = getRiskColor(leg.riskLevel);
            const fc = leg.forecastAtArrival;
            const fcRisk = fc?.forecast_risk_level;

            return (
              <React.Fragment key={'seq-leg-' + i}>
                <div style={{ display: 'flex', alignItems: 'center', color: '#94A3B8', flexShrink: 0, padding: '0 2px' }}>
                  <ArrowRight size={16} />
                </div>
                <div style={{ minWidth: '220px', maxWidth: '260px', flex: '0 0 auto', background: '#FFFFFF', border: `1px solid ${riskColor}35`, borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: riskColor, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: riskColor }}>
                          Leg {i + 1}
                        </span>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: `${riskColor}15`, color: riskColor, border: `1px solid ${riskColor}30` }}>
                        Risk {leg.riskScore}/100
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#1E293B', lineHeight: 1.3, marginBottom: '6px' }}>
                      {leg.label || leg.roadLabel || `Segment ${i + 1}`}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '11px', color: '#64748B' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                        <Navigation size={11} /> {leg.distanceKm} km
                      </span>
                      {leg.etaHours != null && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                          <Clock size={11} /> +{leg.etaHours}h
                        </span>
                      )}
                      {leg.climbGainM != null && leg.climbGainM > 0 && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#92400E', fontWeight: 600 }}>
                          <Mountain size={11} /> +{Math.round(leg.climbGainM)}m
                        </span>
                      )}
                      {leg.congestionLevel && leg.congestionLevel !== 'low' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#EA580C' }}>
                          <Car size={11} /> {leg.congestionLevel}
                        </span>
                      )}
                    </div>
                  </div>

                  {fc && (
                    <div style={{
                      marginTop: '8px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: (fcRisk === 'critical' || fcRisk === 'high') ? '#DC2626' : fcRisk === 'medium' ? '#D97706' : '#0284C7',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <CloudRain size={11} /> {fc.weather_desc || 'Rain'} ({fc.forecast_precip_mm} mm/h)
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          })}

          {/* 3. Connecting Arrow to Destination */}
          <div style={{ display: 'flex', alignItems: 'center', color: '#94A3B8', flexShrink: 0, padding: '0 2px' }}>
            <ArrowRight size={16} />
          </div>

          {/* 4. Destination Node */}
          <div style={{ minWidth: '180px', maxWidth: '210px', flex: '0 0 auto', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#DC2626', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, flexShrink: 0, boxShadow: '0 2px 4px rgba(220,38,38,0.3)' }}>
                  <MapPin size={13} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: '#DC2626', letterSpacing: '0.05em' }}>Destination</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', lineHeight: 1.3 }}>{destName}</div>
            </div>
            <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '8px', fontWeight: 600 }}>
              Final Delivery Point
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback if no active plan
  const districts = districtConnectivity || [];
  return (
    <div className="card" style={{ width: '100%', padding: '16px 20px', borderRadius: '16px', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
      <div className="card-header" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title" style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Route Sequence & Checkpoints</h2>
      </div>
      {districts.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', color: '#94A3B8' }}>
            <Navigation size={18} />
          </div>
          <div style={{ fontWeight: 700, color: '#1E293B', fontSize: '13px', marginBottom: '4px' }}>
            No Active Route Sequence
          </div>
          <div style={{ fontSize: '12px', maxWidth: '500px', color: '#64748B', lineHeight: '1.4' }}>
            Select origin & destination hubs in the route planner above and click <strong>Calculate Routes</strong> to generate sequential waypoint progression and weather risks.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '10px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'thin' }}>
          {districts.slice(0, 6).map((d, i) => (
            <div key={i} style={{ minWidth: '160px', flex: '0 0 auto', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: d.score >= 70 ? '#10B981' : d.score >= 50 ? '#F59E0B' : '#EF4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>{d.district}</div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Connectivity: {d.score}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
