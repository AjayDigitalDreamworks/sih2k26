import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const RouteSequenceTimeline = () => {
  const { districtConnectivity } = useApp();
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
