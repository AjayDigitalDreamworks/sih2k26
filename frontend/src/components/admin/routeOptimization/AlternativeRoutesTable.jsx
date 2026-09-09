import React from 'react';
import { CheckCircle2, Navigation, Route as RouteIcon, ShieldAlert, ShieldCheck } from 'lucide-react';
import ApiClient from '@/lib/api';

export const AlternativeRoutesTable = ({ routes, plan, activeRouteId = 'safest', onSelectRoute }) => {
  const [dbAlternates, setDbAlternates] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // If plan with alternatives is provided directly, we don't need to load DB routes
    if (plan && plan.alternatives && plan.alternatives.length > 0) {
      setLoading(false);
      return;
    }

    const fetchRoutes = async () => {
      try {
        let rows = routes;
        if (!rows) {
          const res = await ApiClient.getAdminRoutes().catch(() => null);
          if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
            rows = res.data;
          } else {
            const gis = await ApiClient.getGisRoutes().catch(() => null);
            if (gis?.success && gis.data?.features) {
              rows = gis.data.features.map((f) => f.properties);
            }
          }
        }
        if (Array.isArray(rows) && rows.length > 0) {
          setDbAlternates(rows.map((r) => ({
            id: r.id,
            name: r.name || 'Route',
            distance: `${r.distance_km || 0} km`,
            time: `${r.avg_travel_hours || 0}h`,
            risk: r.current_risk_score || 0,
            status: r.status || 'unknown',
          })));
        }
      } catch (e) {}
      setLoading(false);
    };
    fetchRoutes();
  }, [routes, plan]);

  // If a dynamic plan with alternatives is active, render the real alternatives
  if (plan && plan.alternatives && plan.alternatives.length > 0) {
    return (
      <div className="card" style={{ height: '100%' }}>
        <div className="card-header" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>Alternative Routes</h2>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Select a route to view its road sequence, live risks and telemetry
            </div>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: '#ECFDF5', color: '#065F46' }}>
            {plan.alternatives.length} options
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {plan.alternatives.map((alt) => {
            const isActive = alt.id === activeRouteId;
            const dist = alt.totalDistanceKm || alt.distanceKm || '--';
            const time = alt.timeText || (alt.avgTravelHours ? `${alt.avgTravelHours} hrs` : '--');
            const isSafe = (alt.riskScore || 0) <= 30;

            return (
              <div
                key={alt.id}
                onClick={() => onSelectRoute && onSelectRoute(alt.id)}
                style={{
                  padding: '12px 14px',
                  backgroundColor: isActive ? '#ECFDF5' : '#F8FAFC',
                  borderRadius: '8px',
                  border: isActive ? '1.5px solid #10B981' : '1px solid #E2E8F0',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 2px 6px rgba(16,185,129,0.12)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: isActive ? '#065F46' : 'var(--text-primary)' }}>
                      {alt.name}
                    </span>
                    {alt.isRecommended && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: '#DBEAFE', color: '#1E40AF' }}>
                        Recommended
                      </span>
                    )}
                    {alt.isMultiModal && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#E0F2FE', color: '#0369A1', border: '1px solid #BAE6FD' }}>
                        🚢 NW-2 Ro-Ro Waterway
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Navigation size={12} /> {dist} km
                    </span>
                    <span>•</span>
                    <span>{time}</span>
                    <span>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: isSafe ? '#059669' : '#DC2626', fontWeight: 600 }}>
                      {isSafe ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                      Risk: {alt.riskScore}/100 ({alt.riskLevel})
                    </span>
                  </div>
                  {alt.waterCrossing && (
                    <div style={{ fontSize: '11px', color: '#0369A1', marginTop: '4px', fontWeight: 500 }}>
                      Vessel: <strong>{alt.waterCrossing.vesselName}</strong> • Bypasses steep mountain grades • Saves ~90 min transit time ({alt.waterCrossing.carbonSavedKg || 42} kg CO₂ ESG)
                    </div>
                  )}
                </div>

                <div>
                  {isActive ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 12px',
                        borderRadius: '6px',
                        background: '#059669',
                        color: '#FFFFFF',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      <CheckCircle2 size={13} /> Active
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectRoute) onSelectRoute(alt.id);
                      }}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        border: '1px solid #CBD5E1',
                        background: '#FFFFFF',
                        color: '#334155',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Select Route
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback to database routes if no active plan
  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Alternative Routes</h2>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Loading routes from database...</div>
      ) : dbAlternates.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No route data available</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {dbAlternates.map((r, i) => (
            <div key={i} style={{ padding: '10px 12px', backgroundColor: i === 0 ? '#ecfdf5' : '#f8fafc', borderRadius: '6px', border: i === 0 ? '1px solid #d1fae5' : '1px solid transparent' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{r.distance} • {r.time} • Risk: {r.risk}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
