import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { Gauge, CheckCircle2, TrendingUp, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

export const VehiclePerformanceCard = () => {
  const { vehicles } = useApp();
  const vehicleList = vehicles || [];
  const total = vehicleList.length || 1;
  const movingVehicles = vehicleList.filter(v => v.statusClass === 'moving').length;
  const delayedVehicles = vehicleList.filter(v => v.statusClass === 'delayed').length;
  const onTimeVehicles = total - delayedVehicles;
  const onScheduleRate = Math.round((onTimeVehicles / total) * 100);
  const utilizationRate = Math.round((movingVehicles / total) * 100);

  const metrics = [
    {
      label: 'On-Schedule Rate',
      value: `${onScheduleRate}%`,
      sub: 'Based on transit corridors',
      color: '#059669',
      bg: '#ECFDF5',
      border: '#A7F3D0',
      icon: CheckCircle2,
    },
    {
      label: 'Fleet Utilization',
      value: `${utilizationRate}%`,
      sub: `${movingVehicles} of ${total} units in transit`,
      color: '#2563EB',
      bg: '#EFF6FF',
      border: '#BFDBFE',
      icon: TrendingUp,
    },
    {
      label: 'Schedule Exceptions',
      value: delayedVehicles,
      sub: delayedVehicles === 0 ? 'Zero active delays' : `${delayedVehicles} units behind schedule`,
      color: delayedVehicles === 0 ? '#059669' : '#D97706',
      bg: delayedVehicles === 0 ? '#ECFDF5' : '#FFFBEB',
      border: delayedVehicles === 0 ? '#A7F3D0' : '#FDE68A',
      icon: AlertTriangle,
    },
    {
      label: 'Telematics Readiness',
      value: '99.4%',
      sub: 'GPS sync & cellular ping',
      color: '#7C3AED',
      bg: '#F5F3FF',
      border: '#DDD6FE',
      icon: Zap,
    },
  ];

  return (
    <div className="card" style={{ height: '100%', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
              }}
            >
              <Gauge size={16} />
            </div>
            <div>
              <h2 className="card-title" style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
                Vehicle Performance
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Operational efficiency benchmarks
              </span>
            </div>
          </div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '20px',
              background: '#F5F3FF',
              color: '#6D28D9',
              border: '1px solid #DDD6FE',
            }}
          >
            SLA Rating: Optimal
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {metrics.map((m, i) => {
            const IconComp = m.icon;
            return (
              <div
                key={i}
                style={{
                  padding: '12px',
                  borderRadius: '12px',
                  background: m.bg,
                  border: `1px solid ${m.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: 'transform 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>{m.label}</span>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '5px',
                      background: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: m.color,
                    }}
                  >
                    <IconComp size={11} />
                  </div>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: m.color, marginTop: '2px' }}>
                  {m.value}
                </div>
                <span style={{ fontSize: '10px', color: '#64748B', lineHeight: 1.2 }}>
                  {m.sub}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid #F1F5F9',
          paddingTop: '10px',
          marginTop: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#64748B',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ShieldCheck size={13} color="#059669" />
          <span>North-East Logistics Corridor Health</span>
        </span>
        <span style={{ color: '#059669', fontWeight: 700 }}>99.2% Uptime</span>
      </div>
    </div>
  );
};
