import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

export const DistrictConnectivityTable = () => {
  const { setCurrentPage, districtConnectivity } = useApp();
  const districtsList = districtConnectivity || [];

  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>District-wise Connectivity</h2>
        <button className="card-link" onClick={() => setCurrentPage('analytics')}>
          <span>View All</span><ChevronRight size={14} />
        </button>
      </div>
      <div className="table-container">
        <table className="custom-table" style={{ fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 12px' }}>District</th>
              <th style={{ padding: '8px 12px' }}>Connectivity Status</th>
              <th style={{ padding: '8px 12px' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {districtsList.length === 0 ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>Loading district data...</td></tr>
            ) : districtsList.map((d, i) => (
              <tr key={i}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{d.district}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span className={`badge ${d.status === 'accessible' ? 'badge-resolved' : d.status === 'partial' ? 'badge-pending' : 'badge-high'}`}>
                    {(d.status || 'unknown').replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
                    <div className="progress-bar-container" style={{ flex: 1 }}>
                      <div className={`progress-bar-fill ${d.score >= 70 ? 'success' : 'warning'}`} style={{ width: `${d.score}%` }} />
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, minWidth: '32px' }}>{d.score}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} /><span>Optimal (&gt;70%)</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} /><span>Caution (50-70%)</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} /><span>Impacted (&lt;50%)</span></div>
      </div>
    </div>
  );
};
