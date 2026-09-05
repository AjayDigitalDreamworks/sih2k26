import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const LiveVehiclesTable = ({ selectedVehicleId, onSelectVehicle }) => {
  const { vehicles } = useApp();
  const vehicleList = vehicles || [];

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Live Vehicles</h2>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{vehicleList.length} tracked</span>
      </div>
      <div className="table-container" style={{ maxHeight: '340px', overflowY: 'auto' }}>
        <table className="custom-table" style={{ fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 10px' }}>ID</th>
              <th style={{ padding: '8px 10px' }}>Model</th>
              <th style={{ padding: '8px 10px' }}>Driver</th>
              <th style={{ padding: '8px 10px' }}>Status</th>
              <th style={{ padding: '8px 10px' }}>Speed</th>
              <th style={{ padding: '8px 10px' }}>Fuel</th>
            </tr>
          </thead>
          <tbody>
            {vehicleList.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>Loading vehicles...</td></tr>
            ) : vehicleList.map((v, i) => (
              <tr
                key={i}
                onClick={() => onSelectVehicle && onSelectVehicle(v.id)}
                style={{
                  cursor: onSelectVehicle ? 'pointer' : 'default',
                  backgroundColor: selectedVehicleId === v.id ? '#EFF6FF' : 'transparent',
                  transition: 'background-color 0.2s',
                }}
              >
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{v.id}</td>
                <td style={{ padding: '8px 10px' }}>{v.model}</td>
                <td style={{ padding: '8px 10px' }}>{v.driver}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span className={`status-badge ${v.statusClass}`}>{v.status}</span>
                </td>
                <td style={{ padding: '8px 10px' }}>{v.speed}</td>
                <td style={{ padding: '8px 10px' }}>{v.fuel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
