import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const RecentActivityFeed = () => {
  const { reports } = useApp();
  const reportList = (reports || []).slice(0, 5);

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Recent Activity</h2>
      </div>
      {reportList.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No recent activity</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {reportList.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: r.priority === 'High' ? '#EF4444' : r.priority === 'Medium' ? '#F59E0B' : '#10B981', marginTop: '4px', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px' }}>{r.type || 'Report'} — {r.location || ''}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.reportedOn || ''} • {r.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
