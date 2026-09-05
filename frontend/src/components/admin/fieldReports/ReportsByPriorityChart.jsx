import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const ReportsByPriorityChart = () => {
  const { reports } = useApp();
  const reportList = reports || [];

  const priorityCounts = reportList.reduce((acc, r) => {
    const p = r.priority || 'Medium';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  const total = reportList.length || 1;
  const colors = { High: '#EF4444', Medium: '#F59E0B', Low: '#10B981', Informational: '#64748B' };
  const data = Object.entries(priorityCounts).map(([label, count]) => ({
    label, count, percentage: Math.round(count / total * 100), color: colors[label] || '#94A3B8',
  }));

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Reports by Priority</h2>
      </div>
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {data.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: d.color, flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: '12px' }}>{d.label}</div>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{d.count}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', minWidth: '35px', textAlign: 'right' }}>{d.percentage}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
