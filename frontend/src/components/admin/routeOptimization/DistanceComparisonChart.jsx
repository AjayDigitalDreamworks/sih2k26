import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const DistanceComparisonChart = () => {
  const { districtConnectivity } = useApp();
  const districts = districtConnectivity || [];

  const data = districts.slice(0, 5).map(d => ({
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
