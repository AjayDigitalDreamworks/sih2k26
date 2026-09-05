import React from 'react';
import { ChevronRight } from 'lucide-react';
import { LineChart } from '../common/LineChart';
import { useApp } from '@/contexts/AppContext';

export const RouteStatusChart = () => {
  const { setCurrentPage, routeTrends, disruptionTrends } = useApp();
  const data = (routeTrends && routeTrends.length > 0) ? routeTrends : (disruptionTrends || []);

  const series = [
    { key: 'good', label: 'Good', color: '#10B981' },
    { key: 'moderate', label: 'Moderate', color: '#F59E0B' },
    { key: 'atRisk', label: 'At Risk', color: '#F97316' },
    { key: 'blocked', label: 'Blocked', color: '#EF4444' },
  ];

  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Route Status Overview</h2>
        <button className="card-link" onClick={() => setCurrentPage('analytics')}>
          <span>View Full Report</span><ChevronRight size={14} />
        </button>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: '-10px', top: '40%', transform: 'rotate(-90deg)', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
          No. of Routes
        </div>
        {data.length > 0 ? (
          <LineChart data={data} series={series} height={200} yMax={1500} />
        ) : (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Loading route data from database...
          </div>
        )}
      </div>
    </div>
  );
};
