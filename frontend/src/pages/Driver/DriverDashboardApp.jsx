import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Navigation, Truck, MapPin, Wifi, WifiOff, Satellite, Play, Square, RefreshCw, TriangleAlert, Activity, Siren, PhoneOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDriverTracking } from '@/hooks/useDriverTracking';

const card = {
  background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16,
  padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const pill = (color, bg) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
  color, background: bg, padding: '4px 10px', borderRadius: 999, border: `1px solid ${color}33`,
});

export default function DriverDashboardApp() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const t = useDriverTracking();
  const [, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(i); }, []);

  const handleSos = async () => {
    if (t.sosActive) {
      if (window.confirm('Cancel the active SOS? Admins will be notified that you are safe.')) {
        await t.cancelSos();
      }
      return;
    }
    if (window.confirm('Send EMERGENCY SOS to the control room?\nYour live GPS location will be shared with admins.')) {
      await t.sendSos();
    }
  };

  const isDriver = user?.backendRole === 'driver';
  if (!isDriver) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A', color: '#fff', fontFamily: 'Inter,sans-serif' }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>RAAHI Driver App</h1>
          <p style={{ color: '#94A3B8' }}>This account is not a driver account.</p>
          <button onClick={() => { logout(); navigate('/login'); }} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 10, border: 'none', background: '#10B981', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Sign in as Driver
          </button>
        </div>
      </div>
    );
  }

  const vehicle = t.ctx?.vehicle;
  const trip = t.ctx?.trip;
  const gps = t.gps;
  const ageSec = t.lastUploadAgeSec != null && t.lastUploadAgeSec !== 0 ? t.lastUploadAgeSec : t.trackingLive ? 0 : null;

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6FA', fontFamily: "'Inter','Segoe UI',sans-serif", paddingBottom: 150 }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0F766E,#065F46)', color: '#fff', padding: '18px 20px 54px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 520, margin: '0 auto' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>RAAHI <span style={{ fontWeight: 400, opacity: 0.75, fontSize: 13 }}>DRIVER</span></div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{user?.name} · {user?.emailOrPhone || ''}</div>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '-36px auto 0', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {t.ctxError && !t.ctx && (
          <div style={{ ...card, borderColor: '#FCA5A5', display: 'flex', alignItems: 'center', gap: 10 }}>
            <TriangleAlert color="#DC2626" size={18} />
            <div style={{ fontSize: 13, color: '#7F1D1D' }}>{t.ctxError}</div>
          </div>
        )}
        {t.loadingCtx ? (
          <div style={{ ...card, textAlign: 'center', color: '#6B7280', fontSize: 14 }}>Loading your assignment…</div>
        ) : (
          <>
            {/* Vehicle card */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck size={22} color="#2563EB" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>Vehicle</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>{vehicle?.id || '—'}</div>
                </div>
                {vehicle && (
                  <span style={{ fontSize: 11, color: '#6B7280', textAlign: 'right' }}>{vehicle.model}<br />{vehicle.type}</span>
                )}
              </div>
              {!vehicle && <div style={{ fontSize: 13, color: '#9CA3AF' }}>No vehicle assigned to this driver.</div>}
            </div>

            {/* Trip card */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={22} color="#059669" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase' }}>Trip</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                    {trip ? `${trip.origin || '—'} → ${trip.destination || '—'}` : t.lastCompleted ? `${t.lastCompleted.origin || '—'} → ${t.lastCompleted.destination || '—'}` : 'No active trip'}
                  </div>
                </div>
                {trip && <span style={pill(trip.status === 'in_transit' ? '#059669' : '#D97706', trip.status === 'in_transit' ? '#ECFDF5' : '#FFFBEB')}>{trip.status.toUpperCase()}</span>}
                {!trip && t.lastCompleted && <span style={pill('#059669', '#ECFDF5')}>✓ COMPLETED</span>}
              </div>
              {trip && (
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                  Trip ID {trip.id} · ETA {trip.eta ? new Date(trip.eta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                </div>
              )}
              {!trip && t.lastCompleted && (
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                  Trip ID {t.lastCompleted.id} completed at {new Date(t.lastCompleted.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Waiting for the next assignment.
                </div>
              )}

              {trip && trip.status === 'planned' && (
                <button
                  onClick={t.startTrip}
                  disabled={t.tripBusy}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 12, background: '#059669', color: '#fff', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer' }}
                >
                  <Play size={18} /> {t.tripBusy ? 'Starting…' : 'START TRIP'}
                </button>
              )}
              {trip && trip.status === 'in_transit' && (
                <button
                  onClick={t.stopTrip}
                  disabled={t.tripBusy}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', borderRadius: 12, background: '#DC2626', color: '#fff', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer' }}
                >
                  <Square size={18} /> {t.tripBusy ? 'Stopping…' : 'STOP TRIP'}
                </button>
              )}
              {trip && trip.status === 'completed' && (
                <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#059669', padding: 8 }}>✓ Trip completed</div>
              )}
            </div>

            {/* GPS card */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Satellite size={18} color="#2563EB" />
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>GPS</div>
                {t.gpsReady && <span style={pill('#059669', '#ECFDF5')}>🟢 READY</span>}
                {t.permission === 'denied' && <span style={pill('#DC2626', '#FEF2F2')}>PERMISSION DENIED</span>}
                {t.permission === 'unsupported' && <span style={pill('#DC2626', '#FEF2F2')}>UNSUPPORTED</span>}
                {t.gpsError && t.permission !== 'denied' && <span style={pill('#D97706', '#FFFBEB')}>UNAVAILABLE</span>}
                {!t.gps && !t.gpsError && t.permission === 'prompt' && <span style={pill('#D97706', '#FFFBEB')}>REQUESTING…</span>}
              </div>

              {t.permission === 'denied' && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 10, fontSize: 13, color: '#7F1D1D', marginBottom: 8 }}>
                  Location permission was denied. Allow location for this site in your browser, then tap <b>Enable GPS</b>.
                </div>
              )}

              {t.gpsError && t.permission !== 'denied' && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: 10, fontSize: 13, color: '#92400E', marginBottom: 8 }}>
                  {t.gpsError}. GPS fixes are not being sent while unavailable — nothing is fabricated.
                </div>
              )}

              {t.gps && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <Metric label="Latitude" value={t.gps.lat?.toFixed(6)} />
                  <Metric label="Longitude" value={t.gps.lng?.toFixed(6)} />
                  <Metric label="Accuracy" value={gps?.accuracy != null ? `${Math.round(gps.accuracy)} m${gps.accuracy > 150 ? ' (low)' : ''}` : '—'} />
                  <Metric label="Speed" value={gps?.speed != null ? `${Math.round(gps.speed)} km/h` : '—'} />
                  <Metric label="Heading" value={gps?.heading != null ? `${Math.round(gps.heading)}°` : '—'} />
                  <Metric label="GPS fix time" value={gps?.gpsTimestamp ? new Date(gps.gpsTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'} />
                </div>
              )}

              {!t.gpsReady && !t.gpsError && t.permission !== 'denied' && (
                <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>Waiting for the first real GPS fix…</div>
              )}

              {(!t.watchActive || t.permission === 'denied' || t.gpsError) && (
                <button onClick={t.startWatching} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 10, background: '#1D4ED8', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14 }}>
                  <Navigation size={16} /> {t.gpsError && t.permission !== 'denied' ? 'RETRY GPS' : 'ENABLE GPS'}
                </button>
              )}
            </div>

            {/* Connection / Upload card */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                {t.online ? <Wifi size={18} color="#059669" /> : <WifiOff size={18} color="#D97706" />}
                <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#111827' }}>
                  {t.online ? 'Internet: CONNECTED' : 'Internet: CONNECTION LOST'}
                </div>
                {t.syncState === 'LIVE' && <span style={pill('#059669', '#ECFDF5')}>🟢 TRACKING LIVE</span>}
                {t.syncState === 'PENDING' && <span style={pill('#D97706', '#FFFBEB')}>PENDING ({t.pendingCount})</span>}
                {t.syncState === 'CONNECTION_LOST' && <span style={pill('#D97706', '#FFFBEB')}>🟡 CONNECTION LOST</span>}
                {t.syncState === 'SYNCED' && <span style={pill('#2563EB', '#EFF6FF')}>SYNCED</span>}
                {t.syncState === 'IDLE' && <span style={pill('#9CA3AF', '#F3F4F6')}>IDLE</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Metric label="Tracking" value={t.tripStarted ? (t.trackingLive ? '🟢 ACTIVE' : 'ACTIVE · syncing') : (t.lastCompleted ? 'OFF (trip completed)' : 'OFF (start trip)')} />
                <Metric label="Last upload" value={ageSec == null ? '—' : `${ageSec}s ago`} />
                <Metric label="Pending points" value={String(t.pendingCount)} />
                <Metric label="Source" value="WEB_GPS (real browser GPS)" />
              </div>

              {t.uploadError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 10, fontSize: 12, color: '#991B1B', marginTop: 10 }}>
                  {t.uploadError}
                </div>
              )}
              {!t.online && (
                <div style={{ background: '#FFFBEB', borderRadius: 10, padding: 10, fontSize: 12, color: '#92400E', marginTop: 10 }}>
                  GPS collection continues. Points are stored on this device and will sync automatically when the connection returns (original GPS timestamps preserved).
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={t.reload} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  <RefreshCw size={14} /> Refresh assignment
                </button>
                <button onClick={() => navigate('/')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, border: '1px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  <Activity size={14} /> Raahi portal
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* SOS / EMERGENCY — fixed action button */}
      <div style={{ position: 'fixed', bottom: 18, left: 0, right: 0, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '0 16px' }}>
        {t.sosActive && (
          <div style={{ background: '#7F1D1D', color: '#FEE2E2', borderRadius: 12, padding: '10px 16px', fontSize: 13, fontWeight: 700, textAlign: 'center', maxWidth: 460, width: '100%', border: '1px solid #FCA5A5' }}>
            🚨 SOS ACTIVE — emergency alert sent to the control room with your live location. Tap the button below to cancel when you are safe.
          </div>
        )}
        {t.sosError && !t.sosActive && (
          <div style={{ background: '#FEF2F2', color: '#991B1B', borderRadius: 12, padding: '10px 16px', fontSize: 12, fontWeight: 600, textAlign: 'center', maxWidth: 460, width: '100%', border: '1px solid #FECACA' }}>
            {t.sosError}
          </div>
        )}
        <button
          onClick={handleSos}
          disabled={t.sosBusy || !t.ctx?.vehicle}
          style={{
            width: 'min(92%, 460px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '16px', borderRadius: 999,
            background: t.sosActive ? 'linear-gradient(135deg,#B45309,#92400E)' : 'linear-gradient(135deg,#DC2626,#991B1B)',
            color: '#fff', fontWeight: 900, fontSize: 17, letterSpacing: 0.5,
            border: '3px solid ' + (t.sosActive ? '#F59E0B' : '#FCA5A5'),
            cursor: t.ctx?.vehicle && !t.sosBusy ? 'pointer' : 'not-allowed',
            opacity: t.ctx?.vehicle ? 1 : 0.5,
            boxShadow: t.sosActive ? '0 4px 20px rgba(245,158,11,0.5)' : '0 4px 20px rgba(220,38,38,0.45)',
            animation: t.sosActive ? 'none' : 'sosPulse 2s infinite',
          }}
        >
          {t.sosActive ? <PhoneOff size={22} /> : <Siren size={22} />}
          {t.sosBusy ? 'WAIT…' : t.sosActive ? 'CANCEL SOS' : '🚨 SOS — EMERGENCY'}
        </button>
        {!t.ctx?.vehicle && (
          <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>SOS needs an assigned vehicle</span>
        )}
      </div>

      <style>{`
        @keyframes sosPulse {
          0% { box-shadow: 0 0 0 0 rgba(220,38,38,0.55); }
          70% { box-shadow: 0 0 0 18px rgba(220,38,38,0); }
          100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
        }
      `}</style>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginTop: 2, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}
