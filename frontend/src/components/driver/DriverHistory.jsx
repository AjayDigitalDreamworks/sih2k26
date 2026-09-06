import React, { useEffect, useState } from 'react';
import { History, RefreshCw, Route } from 'lucide-react';
import ApiClient from '@/lib/api';

const fmt = (d) => (d ? new Date(d).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export default function DriverHistory() {
  const [history, setHistory] = useState(null); // null = loading, [] = none
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const res = await ApiClient.getDriverTripsHistory();
      if (res?.success) setHistory(res.data || []);
      else setError(res?.message || 'Could not load trip history');
    } catch (e) {
      setError(e.message || 'Could not load trip history');
    }
  };

  useEffect(() => { load(); }, []);

  const toggleSummary = async (trip) => {
    if (openId === trip.id) { setOpenId(null); setSummary(null); return; }
    setOpenId(trip.id);
    setSummary(null);
    setLoadingSummary(true);
    try {
      const res = await ApiClient.getDriverTripSummary(trip.id);
      if (res?.success) setSummary(res.data);
      else setSummary({ unavailable: res?.message || 'Summary unavailable' });
    } catch {
      setSummary({ unavailable: 'Summary unavailable' });
    } finally {
      setLoadingSummary(false);
    }
  };

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '30px 12px', color: '#B91C1C', fontSize: 13 }}>
        {error}
        <div><button onClick={load} style={{ marginTop: 12, padding: '8px 18px', borderRadius: 10, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Retry</button></div>
      </div>
    );
  }
  if (history === null) {
    return <div style={{ textAlign: 'center', padding: 30, color: '#6B7280', fontSize: 13 }}>Loading trip history…</div>;
  }
  if (history.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '36px 16px', color: '#6B7280' }}>
        <History size={34} style={{ margin: '0 auto 10px', display: 'block', color: '#9CA3AF' }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>No completed trips yet</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>When you finish a trip it will appear here with real GPS distance and duration.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {history.map((t) => (
        <div key={t.id} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
          <button
            onClick={() => toggleSummary(t)}
            style={{ width: '100%', textAlign: 'left', padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer' }}
          >
            <div style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>{t.vehicle?.id || t.vehicle_id || 'Vehicle'} · {t.id}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginTop: 2 }}>
              {t.origin || '—'} → {t.destination || '—'}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>
              {fmt(t.started_at)} → {fmt(t.actual_arrival_at)}
              <span style={{ color: t.status === 'completed' ? '#059669' : '#D97706', fontWeight: 700, marginLeft: 8 }}>
                {t.status === 'completed' ? '✓ COMPLETED' : 'CANCELED'}
              </span>
            </div>
          </button>
          {openId === t.id && (
            <div style={{ borderTop: '1px solid #EEF2F7', padding: '12px 14px', background: '#F8FAFC' }}>
              {loadingSummary && <div style={{ fontSize: 12, color: '#6B7280' }}>Computing summary from real GPS history…</div>}
              {summary && !summary.unavailable && summary.hasData !== false && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <Stat label="Distance" value={summary.distanceKm != null ? `${summary.distanceKm} km` : '—'} />
                  <Stat label="Duration" value={summary.durationMinutes != null ? `${Math.round(summary.durationMinutes)} min` : '—'} />
                  <Stat label="Top speed" value={summary.topSpeedKmh != null ? `${summary.topSpeedKmh} km/h` : '—'} />
                  <Stat label="Avg speed" value={summary.avgSpeedKmh != null ? `${summary.avgSpeedKmh} km/h` : '—'} />
                  <Stat label="Stops" value={summary.stopCount != null ? String(summary.stopCount) : '—'} />
                  <Stat label="GPS points" value={summary.pointCount != null ? String(summary.pointCount) : '—'} />
                </div>
              )}
              {summary && (summary.unavailable || summary.hasData === false) && (
                <div style={{ fontSize: 12, color: '#6B7280', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Route size={15} /> {summary.unavailable || (summary.reason === 'NO_GPS' ? 'No GPS points recorded for this trip.' : 'No GPS data recorded for this trip.')}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 8px' }}>
      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>{value}</div>
    </div>
  );
}
