import React from 'react';
import { useApp } from '@/contexts/AppContext';

export const VehiclePerformanceCard = () => {
  const { vehicles } = useApp();
  const vehicleList = vehicles || [];
  const onTimeVehicles = vehicleList.filter(v => v.statusClass !== 'delayed').length;
  const onScheduleRate = vehicleList.length ? Math.round((onTimeVehicles / vehicleList.length) * 100) : 100;

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header" style={{ marginBottom: '12px' }}>
        <h2 className="card-title" style={{ margin: 0 }}>Vehicle Performance</h2>
      </div>
      {vehicleList.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '20px' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Total Vehicles</span>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>{vehicleList.length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>On-Schedule Rate</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#059669' }}>{onScheduleRate}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Active Vehicles</span>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>{vehicleList.filter(v => v.statusClass === 'moving').length}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Delayed Vehicles</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#F59E0B' }}>{vehicleList.filter(v => v.statusClass === 'delayed').length}</span>
          </div>
        </div>
      )}
    </div>
  );
};
