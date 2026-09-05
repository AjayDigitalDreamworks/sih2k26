import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const AlertsSummaryCard = () => {
  const { alerts } = useApp();
  const alertList = alerts || [];

  const summary = alertList.reduce((acc, a) => {
    const type = (a.type || 'unknown').replace(/_/g, ' ');
    const existing = acc.find(x => x.type === type);
    if (existing) existing.count++;
    else acc.push({ type, count: 1 });
    return acc;
  }, []);

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Active Alerts</h2>
      </div>
      {summary.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>No active alerts</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {summary.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <span style={{ fontSize: '13px', textTransform: 'capitalize' }}>{item.type}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#EF4444' }}>{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
