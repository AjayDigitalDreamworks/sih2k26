import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const RecentTripsTable = () => {
  const { vehicles } = useApp();
  const vehicleList = (vehicles || []).slice(0, 5);

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Recent Trips</h2>
      </div>
      <div className="table-container">
        <table className="custom-table" style={{ fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 10px' }}>Vehicle</th>
              <th style={{ padding: '8px 10px' }}>Driver</th>
              <th style={{ padding: '8px 10px' }}>Route</th>
              <th style={{ padding: '8px 10px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {vehicleList.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>Loading trips...</td></tr>
            ) : vehicleList.map((v, i) => (
              <tr key={i}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{v.id}</td>
                <td style={{ padding: '8px 10px' }}>{v.driver}</td>
                <td style={{ padding: '8px 10px' }}>{v.route || '--'}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span className={`status-badge ${v.statusClass}`}>{v.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
