import React, { useMemo } from 'react';
import { AlertTriangle, AlertOctagon, ShieldAlert, CheckCircle2, ChevronRight, Navigation, Bell } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

export const RecentAlertsList = () => {
  const { alerts, setCurrentPage } = useApp();

  const displayList = useMemo(() => {
    if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
      return [
        { id: 'alt-1', title: 'CRITICAL: Landslide Blockage on NH-2', severity: 'Critical', time: '12m ago', isCritical: true },
        { id: 'alt-2', title: 'Dynamic Safe Detour: AS-01-TX-8916 via NH-37', severity: 'High', time: '25m ago', isReroute: true },
        { id: 'alt-3', title: 'Road Hazard & Waterlogging Ahead · Silchar', severity: 'High', time: '1h ago', isHazard: true },
        { id: 'alt-4', title: 'Weather Warning: Heavy Rainfall in Kohima', severity: 'Medium', time: '2h ago', isWarning: true },
      ];
    }

    return alerts.slice(0, 4).map(alt => {
      const titleLower = String(alt.title || '').toLowerCase();
      const isCritical = titleLower.includes('critical') || String(alt.severity || '').toLowerCase() === 'critical';
      const isReroute = titleLower.includes('detour') || titleLower.includes('reroute');
      const severity = isCritical ? 'Critical' : isReroute ? 'High' : (alt.severity || 'Medium');

      return {
        ...alt,
        severity,
        isCritical,
        isReroute,
      };
    });
  }, [alerts]);

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px' }}>
      <div className="card-header" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 className="card-title" style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Bell size={16} color="#DC2626" />
            <span>Recent Alerts</span>
            <span style={{ fontSize: '10px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 999, padding: '1px 7px', fontWeight: 700 }}>
              {displayList.length} Active
            </span>
          </h2>
        </div>
        <button
          className="card-link"
          onClick={() => setCurrentPage('alerts')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: '12px', color: '#2563EB', fontWeight: 600 }}
        >
          <span>View All</span>
          <ChevronRight size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
        {displayList.map((alt) => {
          const isCrit = alt.isCritical || alt.severity === 'Critical';
          const isHigh = alt.severity === 'High';
          const isReroute = alt.isReroute;

          const icon = isCrit ? (
            <AlertOctagon size={16} color="#DC2626" />
          ) : isReroute ? (
            <Navigation size={16} color="#2563EB" />
          ) : isHigh ? (
            <AlertTriangle size={16} color="#EA580C" />
          ) : (
            <AlertTriangle size={16} color="#D97706" />
          );

          const badgeBg = isCrit ? '#FEF2F2' : isReroute ? '#EFF6FF' : isHigh ? '#FFFBEB' : '#F8FAFC';
          const badgeBorder = isCrit ? '#FECACA' : isReroute ? '#BFDBFE' : isHigh ? '#FDE68A' : '#E2E8F0';
          const badgeColor = isCrit ? '#DC2626' : isReroute ? '#2563EB' : isHigh ? '#D97706' : '#64748B';

          return (
            <div
              key={alt.id}
              onClick={() => setCurrentPage('alerts')}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                borderLeft: `3px solid ${isCrit ? '#DC2626' : isReroute ? '#2563EB' : isHigh ? '#EA580C' : '#CBD5E1'}`,
                backgroundColor: isCrit ? '#FFF5F5' : '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1, minWidth: 0 }}>
                <div style={{ marginTop: '2px', flexShrink: 0 }}>
                  {icon}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      fontSize: '12px',
                      color: '#0F172A',
                      fontWeight: 600,
                      lineHeight: 1.3,
                    }}
                  >
                    {alt.title}
                  </span>
                  <span style={{ fontSize: '10px', color: '#64748B' }}>
                    {alt.time || 'Today'}
                  </span>
                </div>
              </div>

              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: 999,
                  backgroundColor: badgeBg,
                  border: `1px solid ${badgeBorder}`,
                  color: badgeColor,
                  flexShrink: 0,
                  marginLeft: 4,
                }}
              >
                {alt.severity}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentAlertsList;
