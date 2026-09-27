import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import {
  AlertTriangle,
  ShieldAlert,
  CloudRain,
  Navigation,
  Clock,
  Radio,
  Flame,
  ExternalLink,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';

export const AlertsSummaryCard = () => {
  const { alerts, setCurrentPage } = useApp();
  const alertList = alerts || [];
  const [filter, setFilter] = useState('all'); // 'all' | 'critical' | 'hazards'

  // Normalization dictionary for alert categories
  const NORMALIZED_TYPES = {
    emergency_sos: {
      label: 'Emergency SOS Distress',
      severity: 'critical',
      icon: Flame,
      color: '#DC2626',
      bg: '#FEF2F2',
      border: '#FECACA',
    },
    landslide: {
      label: 'Landslide & Rockfall',
      severity: 'critical',
      icon: AlertTriangle,
      color: '#B91C1C',
      bg: '#FEF2F2',
      border: '#FECACA',
    },
    flood: {
      label: 'Flash Flood & Inundation',
      severity: 'critical',
      icon: CloudRain,
      color: '#1D4ED8',
      bg: '#EFF6FF',
      border: '#BFDBFE',
    },
    accident: {
      label: 'Accident & Collision',
      severity: 'critical',
      icon: AlertTriangle,
      color: '#E11D48',
      bg: '#FFF1F2',
      border: '#FECDD3',
    },
    blocked_road: {
      label: 'Road Corridor Blocked',
      severity: 'high',
      icon: ShieldAlert,
      color: '#C2410C',
      bg: '#FFF7ED',
      border: '#FED7AA',
    },
    road_block: {
      label: 'Road Corridor Blocked',
      severity: 'high',
      icon: ShieldAlert,
      color: '#C2410C',
      bg: '#FFF7ED',
      border: '#FED7AA',
    },
    dynamic_reroute: {
      label: 'Active Dynamic Detours',
      severity: 'high',
      icon: Navigation,
      color: '#6D28D9',
      bg: '#F5F3FF',
      border: '#DDD6FE',
    },
    hazard_warning: {
      label: 'Corridor Hazard Warning',
      severity: 'warning',
      icon: AlertTriangle,
      color: '#B45309',
      bg: '#FFFBEB',
      border: '#FDE68A',
    },
    prolonged_stop: {
      label: 'Prolonged Telematics Stop',
      severity: 'warning',
      icon: Clock,
      color: '#B45309',
      bg: '#FFFBEB',
      border: '#FDE68A',
    },
    weather: {
      label: 'Severe Weather Advisory',
      severity: 'warning',
      icon: CloudRain,
      color: '#0369A1',
      bg: '#F0F9FF',
      border: '#BAE6FD',
    },
    route_risk: {
      label: 'High Route Vulnerability',
      severity: 'warning',
      icon: ShieldAlert,
      color: '#B45309',
      bg: '#FFFBEB',
      border: '#FDE68A',
    },
    config_missing: {
      label: 'Telematics Diagnostics',
      severity: 'info',
      icon: Radio,
      color: '#475569',
      bg: '#F8FAFC',
      border: '#E2E8F0',
    },
  };

  // Group, normalize, and sum counts
  const aggregatedMap = {};

  alertList.forEach((a) => {
    const rawKey = (a.type || 'unknown').toLowerCase().trim().replace(/[\s-]+/g, '_');
    const matchedKey =
      rawKey.includes('sos') ? 'emergency_sos'
      : rawKey.includes('landslide') ? 'landslide'
      : rawKey.includes('flood') ? 'flood'
      : rawKey.includes('accident') ? 'accident'
      : rawKey.includes('block') ? 'blocked_road'
      : rawKey.includes('reroute') ? 'dynamic_reroute'
      : rawKey.includes('hazard') ? 'hazard_warning'
      : rawKey.includes('stop') ? 'prolonged_stop'
      : rawKey.includes('weather') ? 'weather'
      : rawKey.includes('risk') ? 'route_risk'
      : rawKey.includes('config') ? 'config_missing'
      : rawKey;

    const meta = NORMALIZED_TYPES[matchedKey] || {
      label: rawKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      severity: 'warning',
      icon: AlertTriangle,
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A',
    };

    if (!aggregatedMap[meta.label]) {
      aggregatedMap[meta.label] = {
        ...meta,
        count: 0,
      };
    }
    aggregatedMap[meta.label].count += 1;
  });

  const allSummary = Object.values(aggregatedMap).sort((a, b) => {
    // Sort critical first, then high, then warning, then count desc
    const priority = { critical: 3, high: 2, warning: 1, info: 0 };
    const pDiff = (priority[b.severity] || 0) - (priority[a.severity] || 0);
    if (pDiff !== 0) return pDiff;
    return b.count - a.count;
  });

  const criticalCount = allSummary
    .filter((s) => s.severity === 'critical')
    .reduce((sum, s) => sum + s.count, 0);

  const filteredSummary = allSummary.filter((item) => {
    if (filter === 'critical') return item.severity === 'critical';
    if (filter === 'hazards') return item.severity === 'critical' || item.severity === 'high';
    return true;
  });

  const handleOpenAlerts = () => {
    if (setCurrentPage) {
      setCurrentPage('alerts');
    } else {
      window.dispatchEvent(new CustomEvent('raahi:navigate', { detail: { page: 'alerts' } }));
    }
  };

  return (
    <div
      className="card"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '20px',
      }}
    >
      <div>
        {/* Card Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.25)',
              }}
            >
              <ShieldAlert size={16} />
            </div>
            <div>
              <h2 className="card-title" style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
                Active Alerts
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Corridor & fleet safety incidents
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenAlerts}
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '20px',
              background: '#FEF2F2',
              color: '#DC2626',
              border: '1px solid #FECACA',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="Open comprehensive Alerts & Notifications page"
          >
            <span>Alerts Hub</span>
            <ExternalLink size={11} />
          </button>
        </div>

        {/* Quick Severity Filter Tabs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
            marginBottom: '12px',
            background: '#F1F5F9',
            padding: '3px',
            borderRadius: '10px',
          }}
        >
          <button
            type="button"
            onClick={() => setFilter('all')}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: filter === 'all' ? '#FFFFFF' : 'transparent',
              color: filter === 'all' ? '#0F172A' : '#64748B',
              boxShadow: filter === 'all' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            All ({allSummary.reduce((acc, c) => acc + c.count, 0)})
          </button>
          <button
            type="button"
            onClick={() => setFilter('critical')}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: filter === 'critical' ? '#FEF2F2' : 'transparent',
              color: filter === 'critical' ? '#DC2626' : '#64748B',
              boxShadow: filter === 'critical' ? '0 1px 3px rgba(220,38,38,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Critical ({criticalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('hazards')}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              background: filter === 'hazards' ? '#FFF7ED' : 'transparent',
              color: filter === 'hazards' ? '#C2410C' : '#64748B',
              boxShadow: filter === 'hazards' ? '0 1px 3px rgba(194,65,12,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Hazards
          </button>
        </div>

        {/* Scrollable Alerts List */}
        {filteredSummary.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '36px 16px',
              color: '#059669',
              background: '#ECFDF5',
              borderRadius: '12px',
              border: '1px dashed #A7F3D0',
            }}
          >
            <CheckCircle2 size={24} style={{ margin: '0 auto 6px auto' }} />
            <div style={{ fontSize: '13px', fontWeight: 700 }}>No Active Hazards Detected</div>
            <span style={{ fontSize: '11px', color: '#065F46' }}>All monitored transport corridors are clear</span>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxHeight: '235px',
              overflowY: 'auto',
              paddingRight: '4px',
            }}
          >
            {filteredSummary.map((item, i) => {
              const IconComp = item.icon;
              return (
                <div
                  key={i}
                  onClick={handleOpenAlerts}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: item.bg,
                    border: `1px solid ${item.border}`,
                    borderRadius: '10px',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        background: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: item.color,
                        flexShrink: 0,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                      }}
                    >
                      <IconComp size={12} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#0F172A',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.label}
                      </div>
                      <span
                        style={{
                          fontSize: '9.5px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          color: item.color,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {item.severity}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        color: item.color,
                        background: '#FFFFFF',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: `1px solid ${item.border}`,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      }}
                    >
                      {item.count}
                    </span>
                    <ChevronRight size={13} color="#94A3B8" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card Footer Metric */}
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
        <span>
          Critical Level:{' '}
          <strong style={{ color: criticalCount > 0 ? '#DC2626' : '#059669' }}>
            {criticalCount > 0 ? `${criticalCount} Urgent Items` : 'Normal Operations'}
          </strong>
        </span>
        <button
          type="button"
          onClick={handleOpenAlerts}
          style={{
            background: 'none',
            border: 'none',
            color: '#DC2626',
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
            fontSize: '11px',
          }}
        >
          Manage All &rarr;
        </button>
      </div>
    </div>
  );
};
