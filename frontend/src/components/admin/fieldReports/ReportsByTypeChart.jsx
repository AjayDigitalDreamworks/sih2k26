import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const ReportsByTypeChart = () => {
  const { reports } = useApp();
  const reportList = reports || [];

  const typeCounts = reportList.reduce((acc, r) => {
    const type = r.type || r.iconType || 'Other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const total = reportList.length || 1;
  const colors = ['#10B981', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#64748B'];
  const data = Object.entries(typeCounts).map(([label, count], i) => ({
    label, count, percentage: Math.round(count / total * 100), color: colors[i % colors.length],
  }));

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Reports by Type</h2>
      </div>
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Loading report data...</div>
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
