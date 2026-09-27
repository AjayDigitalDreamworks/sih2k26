import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Truck, Activity, Clock, AlertTriangle, WifiOff, TrendingUp } from 'lucide-react';

export const FleetOverviewChart = () => {
  const { vehicles } = useApp();
  const vehicleList = vehicles || [];

  const statusCounts = vehicleList.reduce((acc, v) => {
    const s = (v.statusClass || 'moving').toLowerCase();
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const total = vehicleList.length || 1;
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const categories = [
    {
      id: 'moving',
      label: 'In Transit (Moving)',
      shortLabel: 'Moving',
      count: statusCounts.moving || 0,
      color: '#10B981',
      gradient: 'from-emerald-500 to-teal-600',
      bgLight: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: Truck,
    },
    {
      id: 'idle',
      label: 'Staged / Idle',
      shortLabel: 'Idle',
      count: statusCounts.idle || 0,
      color: '#3B82F6',
      gradient: 'from-blue-500 to-indigo-600',
      bgLight: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: Clock,
    },
    {
      id: 'stopped',
      label: 'Stationary / Stopped',
      shortLabel: 'Stopped',
      count: statusCounts.stopped || 0,
      color: '#EF4444',
      gradient: 'from-rose-500 to-red-600',
      bgLight: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: AlertTriangle,
    },
    {
      id: 'delayed',
      label: 'Weather Delayed',
      shortLabel: 'Delayed',
      count: statusCounts.delayed || 0,
      color: '#F59E0B',
      gradient: 'from-amber-500 to-orange-600',
      bgLight: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: Activity,
    },
    {
      id: 'offline',
      label: 'Offline / Shadow Zone',
      shortLabel: 'Offline',
      count: statusCounts.offline || 0,
      color: '#94A3B8',
      gradient: 'from-slate-400 to-slate-600',
      bgLight: 'bg-slate-50 text-slate-700 border-slate-200',
      icon: WifiOff,
    },
  ];

  const data = categories.map((cat) => ({
    ...cat,
    percentage: Math.round((cat.count / total) * 100),
  }));

  const movingRate = Math.round(((statusCounts.moving || 0) / total) * 100);

  // Compute SVG Donut Chart Slices
  let cumulativePercent = 0;
  const strokeWidth = 14;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '20px' }}>
      <div>
        {/* Card Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)' }}>
              <Activity size={16} />
            </div>
            <div>
              <h2 className="card-title" style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Fleet Activity</h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Real-time carrier distribution</span>
            </div>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            {vehicleList.length} Units
          </span>
        </div>

        {vehicleList.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '30px' }}>
            Loading fleet data...
          </div>
        ) : (
          <>
            {/* Visual Donut Hero Section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 12px', background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '14px' }}>
              <div style={{ position: 'relative', width: '96px', height: '96px', flexShrink: 0 }}>
                <svg width="96" height="96" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                  {data.map((item, i) => {
                    const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
                    const strokeDashoffset = -((cumulativePercent / 100) * circumference);
                    cumulativePercent += item.percentage;
                    const isHovered = hoveredIdx === i;

                    return (
                      <circle
                        key={item.id}
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="transparent"
                        stroke={item.color}
                        strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        style={{
                          transition: 'all 0.3s ease',
                          cursor: 'pointer',
                          opacity: hoveredIdx !== null && !isHovered ? 0.45 : 1,
                        }}
                        onMouseEnter={() => setHoveredIdx(i)}
                        onMouseLeave={() => setHoveredIdx(null)}
                      />
                    );
                  })}
                </svg>
                {/* Center metric */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>{movingRate}%</span>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '2px' }}>Moving</span>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '20px', fontWeight: 900, color: '#0F172A' }}>{statusCounts.moving || 0}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>of {vehicleList.length} en route</span>
                </div>
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                  {statusCounts.stopped || statusCounts.delayed ? (
                    <span style={{ color: '#D97706', fontWeight: 600 }}>{(statusCounts.stopped || 0) + (statusCounts.delayed || 0)} vehicles paused/delayed</span>
                  ) : (
                    <span style={{ color: '#059669', fontWeight: 600 }}>Optimal corridor throughput</span>
                  )}
                </div>
              </div>
            </div>

            {/* Structured Breakdown List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.map((item, i) => {
                const IconComponent = item.icon;
                const isHovered = hoveredIdx === i;

                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '6px 10px',
                      borderRadius: '10px',
                      background: isHovered ? '#F1F5F9' : 'transparent',
                      transition: 'background 0.2s ease',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', backgroundColor: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, flexShrink: 0 }}>
                      <IconComponent size={12} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>{item.shortLabel}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A' }}>{item.count}</span>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', minWidth: '28px', textAlign: 'right' }}>{item.percentage}%</span>
                        </div>
                      </div>

                      {/* Progress Track */}
                      <div style={{ width: '100%', height: '5px', backgroundColor: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${item.percentage}%`,
                            backgroundColor: item.color,
                            borderRadius: '4px',
                            transition: 'width 0.6s ease',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Card Footer Metric */}
      <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748B' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <TrendingUp size={13} color="#059669" />
          <span>Active Capacity: <strong>{movingRate}%</strong></span>
        </span>
        <span style={{ color: '#059669', fontWeight: 700 }}>Telemetry Synced</span>
      </div>
    </div>
  );
};
