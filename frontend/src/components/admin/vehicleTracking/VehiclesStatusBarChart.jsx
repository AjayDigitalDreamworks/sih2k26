import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { BarChart3, Truck, Clock, AlertTriangle, Activity, WifiOff, Gauge } from 'lucide-react';

export const VehiclesStatusBarChart = () => {
  const { vehicles } = useApp();
  const vehicleList = vehicles || [];
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const statusCounts = vehicleList.reduce((acc, v) => {
    const s = (v.statusClass || 'moving').toLowerCase();
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const bars = [
    { label: 'Moving', count: statusCounts.moving || 0, color: '#059669', gradient: 'linear-gradient(180deg, #10B981 0%, #059669 100%)', lightBg: '#ECFDF5', icon: Truck },
    { label: 'Idle', count: statusCounts.idle || 0, color: '#2563EB', gradient: 'linear-gradient(180deg, #3B82F6 0%, #1D4ED8 100%)', lightBg: '#EFF6FF', icon: Clock },
    { label: 'Stopped', count: statusCounts.stopped || 0, color: '#DC2626', gradient: 'linear-gradient(180deg, #EF4444 0%, #B91C1C 100%)', lightBg: '#FEF2F2', icon: AlertTriangle },
    { label: 'Delayed', count: statusCounts.delayed || 0, color: '#D97706', gradient: 'linear-gradient(180deg, #F59E0B 0%, #B45309 100%)', lightBg: '#FFFBEB', icon: Activity },
    { label: 'Offline', count: statusCounts.offline || 0, color: '#64748B', gradient: 'linear-gradient(180deg, #94A3B8 0%, #475569 100%)', lightBg: '#F8FAFC', icon: WifiOff },
  ];

  const maxVal = Math.max(...bars.map(b => b.count), 5);
  const total = vehicleList.length || 1;

  // Compute average speed among moving vehicles
  const movingVehicles = vehicleList.filter(v => v.statusClass === 'moving');
  const avgSpeed = movingVehicles.length > 0
    ? Math.round(movingVehicles.reduce((acc, v) => acc + (parseFloat(v.speed) || 45), 0) / movingVehicles.length)
    : 42;

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px' }}>
      <div>
        {/* Card Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 2px 6px rgba(59, 130, 246, 0.25)' }}>
              <BarChart3 size={16} />
            </div>
            <div>
              <h2 className="card-title" style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Vehicles by Status</h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Operational state breakdown</span>
            </div>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
            Telemetry Peak: {maxVal}
          </span>
        </div>

        {/* Visual Chart Area */}
        <div style={{
          height: '185px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '16px 8px 0 32px',
          position: 'relative',
          background: 'linear-gradient(180deg, #FAFAFA 0%, #FFFFFF 100%)',
          borderRadius: '16px',
          border: '1px solid #F1F5F9',
          marginBottom: '14px',
        }}>
          {/* Subtle Grid Guidelines & Y-axis labels */}
          {[1, 0.75, 0.5, 0.25, 0].map((step, idx) => {
            const val = Math.round(maxVal * step);
            const bottomPos = `${step * 72 + 20}%`;
            return (
              <React.Fragment key={idx}>
                <div style={{ position: 'absolute', left: '8px', bottom: bottomPos, fontSize: '9px', fontWeight: 600, color: '#94A3B8' }}>
                  {val}
                </div>
                <div style={{ position: 'absolute', left: '28px', right: '12px', bottom: bottomPos, height: '1px', background: '#F1F5F9', pointerEvents: 'none' }} />
              </React.Fragment>
            );
          })}

          {bars.map((b, i) => {
            const heightPercent = maxVal > 0 ? (b.count / maxVal) * 100 : 0;
            const isHovered = hoveredIdx === i;
            const IconComp = b.icon;

            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  flex: 1,
                  height: '100%',
                  justifyContent: 'flex-end',
                  cursor: 'pointer',
                  zIndex: 2,
                }}
              >
                {/* Floating pill badge */}
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: isHovered ? b.color : '#1E293B',
                    background: isHovered ? b.lightBg : 'transparent',
                    padding: '1px 6px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    boxShadow: isHovered ? `0 2px 6px ${b.color}25` : 'none',
                  }}
                >
                  {b.count}
                </span>

                {/* Bar Track Background + Fill */}
                <div
                  style={{
                    width: '100%',
                    maxWidth: '42px',
                    height: '110px',
                    background: '#F1F5F9',
                    borderRadius: '8px 8px 3px 3px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: '2px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: `${Math.max(heightPercent, 4)}%`,
                      background: b.gradient,
                      borderRadius: '6px 6px 2px 2px',
                      boxShadow: isHovered ? `0 -2px 10px ${b.color}50` : 'none',
                      transition: 'height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.2s',
                      transform: isHovered ? 'scaleY(1.02)' : 'scaleY(1)',
                    }}
                  />
                </div>

                {/* Category Icon & Label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                  <IconComp size={10} color={isHovered ? b.color : '#64748B'} />
                  <span style={{ fontSize: '10.5px', fontWeight: isHovered ? 700 : 600, color: isHovered ? b.color : '#64748B' }}>
                    {b.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Fleet KPI Quick Mini-Pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          <div style={{ padding: '6px 8px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center' }}>
            <span style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Moving</span>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#059669' }}>
              {Math.round(((statusCounts.moving || 0) / total) * 100)}%
            </div>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center' }}>
            <span style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Staged</span>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#2563EB' }}>
              {statusCounts.idle || 0} units
            </div>
          </div>
          <div style={{ padding: '6px 8px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center' }}>
            <span style={{ fontSize: '9.5px', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Delayed</span>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#D97706' }}>
              {statusCounts.delayed || 0} units
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer Metric */}
      <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748B' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Gauge size={13} color="#3B82F6" />
          <span>Avg Speed: <strong>{avgSpeed} km/h</strong></span>
        </span>
        <span style={{ color: '#2563EB', fontWeight: 700 }}>Telemetry Stream</span>
      </div>
    </div>
  );
};
