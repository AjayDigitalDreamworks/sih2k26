import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Filter,
  Plus,
  Radio,
  MapPin,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import ApiClient from '@/lib/api';
import { useApp } from '@/contexts/AppContext';
import { useLang } from '@/contexts/LanguageContext';

// Normalise severities (DB broadcast alerts are 'High/Medium/Low', the ML engine
// emits 'critical/high/medium/low') into one display + filter group.
const sevLabel = (s) => {
  const v = String(s || '').toLowerCase();
  if (v === 'critical') return 'Critical';
  if (v === 'high') return 'High';
  if (v === 'medium') return 'Medium';
  if (v === 'low') return 'Low';
  return 'Low';
};
const sevGroup = (s) => {
  const v = String(s || '').toLowerCase();
  if (v === 'critical' || v === 'high') return 'High';
  if (v === 'medium') return 'Medium';
  return 'Low';
};
const sevColor = (s) => {
  const g = sevGroup(s);
  return g === 'High' ? '#EF4444' : g === 'Medium' ? '#F59E0B' : '#10B981';
};
const pretty = (id) => (id || '').split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const hhmm = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const AlertsPage = () => {
  const { openModal, addToast } = useApp();
  const { lang, localizeAlert } = useLang();
  const [filterGroup, setFilterGroup] = useState('All');
  const [dbAlerts, setDbAlerts] = useState([]);      // broadcast / admin alerts (DB)
  const [mlAlerts, setMlAlerts] = useState([]);      // real-time ML risk-engine alerts
  const [mlLoading, setMlLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);

  const load = useCallback(async () => {
    const [dbRes, mlRes] = await Promise.allSettled([
      ApiClient.getAdminAlerts(),
      ApiClient.getPipelineAlerts({ active: 'true', limit: '60' }),
    ]);
    if (dbRes.status === 'fulfilled' && dbRes.value?.success) setDbAlerts(Array.isArray(dbRes.value.data) ? dbRes.value.data : []);
    if (mlRes.status === 'fulfilled' && mlRes.value?.success && mlRes.value.data) {
      const list = mlRes.value.data.alerts || mlRes.value.data;
      setMlAlerts(Array.isArray(list) ? list : []);
    }
    setMlLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60000); // keep AI risk alerts current
    return () => clearInterval(iv);
  }, [load]);

  const handleResolve = async (alert) => {
    setResolvingId(alert.id);
    try {
      const res = await ApiClient.updateAlert(alert.id, { status: 'resolved' });
      if (res?.success) {
        addToast('Alert Resolved', `"${alert.title}" marked resolved — corridor risk refresh triggered.`, 'success');
        load();
      } else {
        addToast('Resolve Failed', res?.message || 'Could not resolve the alert', 'error');
      }
    } catch (e) {
      addToast('Resolve Failed', e.message || 'Could not resolve the alert', 'error');
    }
    setResolvingId(null);
  };

  // Broadcast rows (manual / from DB).
  const broadcastRows = dbAlerts
    .filter((a) => String(a.status || 'active') !== 'resolved')
    .map((a) => ({
      id: a.id,
      title: a.title || a.message || 'Alert',
      message: a.message || '',
      severity: sevLabel(a.severity),
      location: a.location || a.districtId || 'Northeast Corridor',
      time: a.time || hhmm(a.createdAt),
      source: 'broadcast',
      raw: a,
    }));

  // Real-time AI risk-engine rows (route scores, disruptions — auto-clear when risk drops).
  const mlRows = mlAlerts
    .filter((a) => String(a.status || 'active') !== 'resolved')
    .map((a) => {
      const route = (a.title || '').replace(/^HIGH RISK:\s*/i, '').split(' (Score')[0];
      return {
        id: a.id,
        title: a.title || 'Route risk alert',
        message: a.message || '',
        severity: sevLabel(a.severity),
        location: a.districtId ? pretty(a.districtId) : (route || 'Northeast Corridor'),
        time: hhmm(a.createdAt),
        source: 'ml',
        raw: a,
      };
    });

  const allRows = [...mlRows, ...broadcastRows];
  const highCount = allRows.filter((r) => sevGroup(r.severity) === 'High').length;
  const medCount = allRows.filter((r) => sevGroup(r.severity) === 'Medium').length;
  const lowCount = allRows.filter((r) => sevGroup(r.severity) === 'Low').length;

  const filtered = filterGroup === 'All'
    ? allRows
    : allRows.filter((r) => sevGroup(r.severity) === filterGroup);

  return (
    <div className="alerts-page" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div className="page-header-row">
        <div className="page-title-group">
          <h1>
            <Bell size={24} color="#EF4444" />
            Alerts & Notifications Command Center
          </h1>
          <p>Live AI route-risk alerts from the ML engine + operator broadcasts.</p>
        </div>

        <button className="btn btn-danger" onClick={() => openModal('createAlert')}>
          <Plus size={16} />
          <span>Broadcast New Alert</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={14} /> Filter Severity:
          </span>
          {[
            { id: 'All', label: 'All Alerts', count: allRows.length, color: 'var(--text-main)' },
            { id: 'High', label: 'Critical / High', count: highCount, color: '#EF4444' },
            { id: 'Medium', label: 'Warning / Med', count: medCount, color: '#F59E0B' },
            { id: 'Low', label: 'Advisory / Low', count: lowCount, color: '#10B981' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterGroup(item.id)}
              className={`btn ${filterGroup === item.id ? 'btn-primary' : 'btn-outline'}`}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: filterGroup === item.id ? undefined : 'var(--border-color)',
              }}
            >
              <span>{item.label}</span>
              <span
                style={{
                  background: filterGroup === item.id ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                  color: filterGroup === item.id ? '#fff' : item.color,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                {item.count}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-outline"
            onClick={() => { setRefreshing(true); load(); }}
            style={{ padding: '4px 10px', fontSize: '12px' }}
            title="Refresh alerts now"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Active Alerts: <strong>{allRows.length}</strong>
            {' '}(<span style={{ color: '#7C3AED' }}>{mlRows.length} AI engine</span>
            {' · '}{broadcastRows.length} broadcast)
          </span>
        </div>
      </div>

      {/* Alerts Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {mlLoading && allRows.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Loading live AI risk alerts…
          </div>
        )}

        {!mlLoading && filtered.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)', fontSize: '13px' }}>
            <CheckCircle2 size={22} color="#10B981" style={{ margin: '0 auto 8px', display: 'block' }} />
            No {filterGroup === 'All' ? '' : filterGroup.toLowerCase() + ' '}alerts right now — corridors are moving normally.
          </div>
        )}

        {filtered.map((alert) => {
          const locAlert = localizeAlert ? localizeAlert(alert, lang) : alert;
          const isHigh = sevGroup(alert.severity) === 'High';
          const isMedium = sevGroup(alert.severity) === 'Medium';
          const isMl = alert.source === 'ml';

          return (
            <div
              key={alert.id}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                borderLeft: `5px solid ${sevColor(alert.severity)}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: 0 }}>
                <div style={{ marginTop: '2px', flexShrink: 0 }}>
                  {isHigh ? (
                    <AlertOctagon size={22} color="#EF4444" />
                  ) : isMedium ? (
                    <AlertTriangle size={22} color="#F59E0B" />
                  ) : (
                    <CheckCircle2 size={22} color="#10B981" />
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {locAlert.title || alert.title}
                    </span>
                    {isMl ? (
                      <span className="badge badge-high" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#EDE9FE', color: '#6D28D9', border: '1px solid #DDD6FE' }}>
                        <Cpu size={10} /> AI engine
                      </span>
                    ) : (
                      <span className="badge badge-medium" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#F3F4F6', color: '#4B5563', border: '1px solid #E5E7EB' }}>
                        <Radio size={10} /> Broadcast
                      </span>
                    )}
                    <span className={`badge badge-${isHigh ? 'high' : isMedium ? 'medium' : 'low'}`}>
                      {locAlert.severity || alert.severity}
                    </span>
                  </div>

                  {(locAlert.message || alert.message) && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{locAlert.message || alert.message}</div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={13} /> {alert.location}
                    </span>
                    <span>🕒 {alert.time}</span>
                    {isMl && <span style={{ color: '#7C3AED' }}>Auto-clears when corridor risk drops</span>}
                  </div>
                </div>
              </div>

              {!isMl && (
                <button
                  className="btn btn-outline"
                  style={{ fontSize: '12px', padding: '6px 12px', flexShrink: 0 }}
                  disabled={resolvingId === alert.id}
                  onClick={() => handleResolve(alert.raw || alert)}
                >
                  {resolvingId === alert.id ? 'Resolving…' : 'Mark Resolved'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AlertsPage;
