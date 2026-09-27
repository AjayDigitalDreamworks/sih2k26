import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { Truck, Navigation, ArrowRight, User, ShieldCheck } from 'lucide-react';

export const RecentTripsTable = () => {
  const { vehicles } = useApp();
  const vehicleList = (vehicles || []).slice(0, 5);

  const getStatusBadge = (v) => {
    const s = (v.statusClass || 'moving').toLowerCase();
    const map = {
      moving: { label: 'In Transit', bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
      idle: { label: 'Staged / Idle', bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
      stopped: { label: 'Stopped', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
      delayed: { label: 'Delayed', bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
      offline: { label: 'Offline', bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
    };
    const conf = map[s] || map.moving;
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 700,
          background: conf.bg,
          color: conf.color,
          border: `1px solid ${conf.border}`,
        }}
      >
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: conf.color }} />
        {conf.label}
      </span>
    );
  };

  return (
    <div className="card" style={{ height: '100%', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 2px 6px rgba(5, 150, 105, 0.25)',
            }}
          >
            <Navigation size={16} />
          </div>
          <div>
            <h2 className="card-title" style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
              Recent Telematics Dispatches
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Active corridor vehicle movements
            </span>
          </div>
        </div>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 8px',
            borderRadius: '20px',
            background: '#F1F5F9',
            color: '#475569',
          }}
        >
          {vehicleList.length} Latest Trips
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', textAlign: 'left' }}>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Vehicle</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Driver</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Corridor Route</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', textAlign: 'right' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {vehicleList.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No active carrier trips recorded
                </td>
              </tr>
            ) : (
              vehicleList.map((v, i) => (
                <tr
                  key={v.id || i}
                  style={{
                    borderBottom: '1px solid #F1F5F9',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          background: '#ECFDF5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#059669',
                          flexShrink: 0,
                        }}
                      >
                        <Truck size={13} />
                      </div>
                      <div>
                        <strong style={{ fontSize: '12.5px', color: '#0F172A', display: 'block', lineHeight: 1.2 }}>
                          {v.id}
                        </strong>
                        <span style={{ fontSize: '10.5px', color: '#64748B' }}>
                          {v.model || v.plateNumber || 'Commercial Carrier'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#334155', fontWeight: 600 }}>
                      <User size={12} color="#94A3B8" />
                      <span>{v.driver || 'Assigned Driver'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F1F5F9', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', color: '#334155', fontWeight: 600 }}>
                      <span>{v.route ? v.route.split('→')[0]?.trim() || v.route : 'Guwahati'}</span>
                      <ArrowRight size={10} color="#64748B" />
                      <span>{v.route ? v.route.split('→')[1]?.trim() || 'Silchar' : 'Dest'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                    {getStatusBadge(v)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
