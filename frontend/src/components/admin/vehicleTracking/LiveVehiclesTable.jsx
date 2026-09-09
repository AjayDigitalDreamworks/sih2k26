import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const LiveVehiclesTable = ({ selectedVehicleId, onSelectVehicle }) => {
  const { vehicles } = useApp();
  const [filterTab, setFilterTab] = React.useState('all');
  const vehicleList = vehicles || [];

  const delayedCount = vehicleList.filter(v => v.statusClass === 'delayed' || v.status === 'Delayed' || v.liveStatus === 'STALE').length;
  const movingCount = vehicleList.filter(v => v.statusClass === 'moving' || v.status === 'Moving').length;
  const idleCount = vehicleList.filter(v => v.statusClass === 'idle' || v.status === 'Idle').length;

  const filteredList = vehicleList.filter(v => {
    if (filterTab === 'delayed') return v.statusClass === 'delayed' || v.status === 'Delayed' || v.liveStatus === 'STALE';
    if (filterTab === 'moving') return v.statusClass === 'moving' || v.status === 'Moving';
    if (filterTab === 'idle') return v.statusClass === 'idle' || v.status === 'Idle';
    return true;
  });

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h2 className="card-title" style={{ margin: 0 }}>Fleet Telemetry & Status</h2>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click any vehicle to inspect GPS telemetry and trip metrics</div>
        </div>
        
        {/* Triage Tabs */}
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', border: 'none',
              backgroundColor: filterTab === 'all' ? '#FFFFFF' : 'transparent',
              color: filterTab === 'all' ? '#0F172A' : '#64748B',
              cursor: 'pointer',
            }}
          >
            All ({vehicleList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('delayed')}
            style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', border: 'none',
              backgroundColor: filterTab === 'delayed' ? '#FFFFFF' : 'transparent',
              color: filterTab === 'delayed' ? '#DC2626' : '#64748B',
              cursor: 'pointer',
            }}
          >
            🚨 Attention ({delayedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('moving')}
            style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', border: 'none',
              backgroundColor: filterTab === 'moving' ? '#FFFFFF' : 'transparent',
              color: filterTab === 'moving' ? '#059669' : '#64748B',
              cursor: 'pointer',
            }}
          >
            🚚 Moving ({movingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('idle')}
            style={{
              fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', border: 'none',
              backgroundColor: filterTab === 'idle' ? '#FFFFFF' : 'transparent',
              color: filterTab === 'idle' ? '#475569' : '#64748B',
              cursor: 'pointer',
            }}
          >
            🅿️ Idle ({idleCount})
          </button>
        </div>
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
            </tr>
          </thead>
          <tbody>
            {filteredList.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>No vehicles in this category.</td></tr>
            ) : filteredList.map((v, i) => (
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
                  {v.liveStatus === 'IN_DEAD_ZONE' || v.status === 'In Dead-Zone' ? (
                    <span className="status-badge" style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D' }}>
                      ⛰️ Shadow Zone
                    </span>
                  ) : (
                    <span className={`status-badge ${v.statusClass}`}>{v.status}</span>
                  )}
                </td>
                <td style={{ padding: '8px 10px' }}>{v.speed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
