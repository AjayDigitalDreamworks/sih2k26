import React from 'react';
import { useApp } from '@/contexts/AppContext';
import ApiClient from '@/lib/api';

export const AlternativeRoutesTable = ({ routes }) => {
  const [alternates, setAlternates] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchRoutes = async () => {
      try {
        // Prefed (transporter page) or fetched from admin/GIS (admin page).
        let rows = routes;
        if (!rows) {
          const res = await ApiClient.getAdminRoutes().catch(() => null);
          if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
            rows = res.data;
          } else {
            // Role-agnostic fallback: /gis/routes FeatureCollection
            const gis = await ApiClient.getGisRoutes().catch(() => null);
            if (gis?.success && gis.data?.features) {
              rows = gis.data.features.map((f) => f.properties);
            }
          }
        }
        if (Array.isArray(rows) && rows.length > 0) {
          setAlternates(rows.map((r) => ({
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
  }, []);

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Alternative Routes</h2>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Loading routes from database...</div>
      ) : alternates.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No route data available</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {alternates.map((r, i) => (
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
