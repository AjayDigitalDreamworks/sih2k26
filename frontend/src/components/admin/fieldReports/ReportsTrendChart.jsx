import React from 'react';
import { LineChart } from '../common/LineChart';
import { useApp } from '@/contexts/AppContext';

export const ReportsTrendChart = () => {
  const { reports } = useApp();
  const reportList = reports || [];

  // Group reports by date
  const dateMap = {};
  reportList.forEach(r => {
    const date = r.reportedOn ? r.reportedOn.split(' ')[0] + ' ' + (r.reportedOn.split(' ')[1] || '') : 'Unknown';
    dateMap[date] = (dateMap[date] || 0) + 1;
  });

  const data = Object.entries(dateMap).map(([date, count]) => ({ date, count }));
  const series = [{ key: 'count', label: 'Reports', color: '#3B82F6' }];

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Reports Trend</h2>
      </div>
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>Loading trend data...</div>
      ) : (
        <LineChart data={data} series={series} height={180} yMax={Math.max(...data.map(d => d.count), 10)} />
      )}
    </div>
  );
};
