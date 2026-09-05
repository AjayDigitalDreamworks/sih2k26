import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, Polyline, Marker, Popup, Tooltip } from 'react-leaflet';
import { MapZoomControls } from '@/components/admin/common/MapZoomControls';
import { ResilientTileLayer } from '@/components/admin/common/ResilientTileLayer';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Sparkles, Loader2, AlertTriangle, ShieldCheck, Navigation, Gauge, RefreshCw, Route as RouteIcon } from 'lucide-react';
import ApiClient from '@/lib/api';
import { DISTRICTS, districtById } from '@/data/geoMaster';

const RISK_COLOR = { low: '#10B981', medium: '#F59E0B', high: '#F97316', critical: '#EF4444' };

const originIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#059669;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
const destIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#DC2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export const RoutePlannerMap = () => {
  const [fromId, setFromId] = useState('kamrup');
  const [toId, setToId] = useState('sonitpur');
  const [prefer, setPrefer] = useState('safest');
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mapKey, setMapKey] = useState(0);
  const seq = useRef(0);

  const planRoute = useCallback(async (from, to, pref, silent = false) => {
    if (!from || !to || from === to) return;
    const mySeq = ++seq.current;
    setLoading(true);
    if (!silent) setError('');
    try {
      const res = await ApiClient.planRoute({
        originDistrictId: from,
        destDistrictId: to,
        prefer: pref,
      });
      if (mySeq !== seq.current) return;
      if (res?.success && res.data?.success) {
        setPlan(res.data);
        setError('');
      } else {
        setPlan(null);
        setError(res?.data?.error || res?.message || 'Could not plan this route.');
      }
    } catch (e) {
      if (mySeq !== seq.current) return;
      console.warn('Route plan failed:', e);
      setPlan(null);
      setError('Route planner unreachable - real road routing needs the ML service (port 8010).');
    } finally {
      if (mySeq === seq.current) setLoading(false);
    }
  }, []);

  // Initial real plan on mount so the map never shows an empty / off-road view
  useEffect(() => {
    planRoute('kamrup', 'sonitpur', 'safest', true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSwap = () => {
    if (fromId === toId) return;
    setFromId(toId);
    setToId(fromId);
  };

  const handlePlan = async () => {
    if (fromId === toId) {
      setError('Origin and destination must be different districts.');
      return;
    }
    await planRoute(fromId, toId, prefer);
  };

  const recommended = plan?.recommended || null;
  const legs = recommended?.legs || [];
  const alerts = plan?.alerts || [];
  const fromD = districtById(fromId);
  const toD = districtById(toId);

  const legColor = (leg) => RISK_COLOR[leg.riskLevel] || RISK_COLOR.low;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Query bar - real districts only */}
      <div className="route-query-bar" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div className="query-field-group">
          <label className="query-field-label">From (origin)</label>
          <div className="query-input-wrap">
            <MapPin size={16} color="#059669" />
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', width: '100%' }}>
              {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
        </div>

        <button type="button" onClick={handleSwap} title="Swap origin and destination"
          style={{ alignSelf: 'flex-end', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#374151' }}>
          Swap
        </button>

        <div className="query-field-group">
          <label className="query-field-label">To (destination)</label>
          <div className="query-input-wrap">
            <MapPin size={16} color="#DC2626" />
            <select value={toId} onChange={(e) => setToId(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', width: '100%' }}>
              {DISTRICTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
        </div>

        <div className="query-field-group">
          <label className="query-field-label">Preference</label>
          <div className="query-input-wrap">
            <ShieldCheck size={16} color="#3B82F6" />
            <select value={prefer} onChange={(e) => setPrefer(e.target.value)} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
              <option value="safest">Safest route (lowest risk)</option>
              <option value="shortest">Shortest route (least km)</option>
              <option value="balanced">Balanced</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
          <button className="btn btn-primary" onClick={handlePlan} disabled={loading || fromId === toId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            <span>{loading ? 'Planning on roads...' : 'Plan Route'}</span>
          </button>
        </div>
      </div>

      {/* Result summary chips */}
      {plan && recommended && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', fontWeight: 700 }}>
            <Navigation size={13} /> {recommended.totalDistanceKm ?? '--'} km | {legs.length} leg{legs.length === 1 ? '' : 's'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: RISK_COLOR[recommended.riskLevel] + '18', border: '1px solid ' + RISK_COLOR[recommended.riskLevel] + '60', color: RISK_COLOR[recommended.riskLevel], fontWeight: 700, textTransform: 'capitalize' }}>
            <Gauge size={13} /> Risk {recommended.riskScore ?? '--'}/100 | {recommended.riskLevel}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', fontWeight: 700 }}>
            <RouteIcon size={13} /> Recommended: {plan.preferred}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', fontWeight: 600 }}>
            Geometry: {plan.routingProvider === 'osrm' ? 'OSRM road network' : plan.routingProvider === 'mappls' ? 'Mappls roads' : plan.routingProvider === 'tomtom' ? 'TomTom roads' : plan.routingProvider === 'corridor' ? 'corridor' : 'road network'}
          </span>
          {plan.safest && plan.shortest && (
            <span style={{ padding: '5px 10px', borderRadius: 8, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontWeight: 600 }}>
              Safest: {plan.safest.totalDistanceKm} km (risk {plan.safest.riskScore}) | Shortest: {plan.shortest.totalDistanceKm} km (risk {plan.shortest.riskScore})
            </span>
          )}
        </div>
      )}

      {/* Risk / hazard alerts on the recommended route */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alerts.slice(0, 5).map((a, i) => {
            const hot = a.severity === 'critical' || a.severity === 'high';
            return (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 10px', borderRadius: 8, background: hot ? '#FEF2F2' : '#FFFBEB', border: '1px solid ' + (hot ? '#FECACA' : '#FDE68A'), fontSize: 12 }}>
                <AlertTriangle size={14} color={hot ? '#DC2626' : '#D97706'} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong style={{ color: hot ? '#991B1B' : '#92400E' }}>{a.title}</strong>
                  <div style={{ color: '#6B7280' }}>{a.message}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 12, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* Map with real road geometry — always visible; route draws on top once planned */}
      <div className="card" style={{ padding: '12px', position: 'relative' }}>
        {loading && !plan && (
          <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 1100, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderRadius: 999, background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 2px 10px rgba(0,0,0,.15)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}>
            <Loader2 size={14} className="spin" /> Fetching real road route...
          </div>
        )}
        <MapContainer
          key={mapKey}
          center={[26.0, 93.0]}
          zoom={6.5}
          style={{ height: '430px', width: '100%', borderRadius: 8 }}
          attributionControl={false}
          zoomControl={false}
          scrollWheelZoom={false}
        >
          <ResilientTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapZoomControls position="bottom-right" compact />

            {/* Alternate option (dashed, faint) when it differs from the recommended path */}
            {plan && plan.safest && plan.shortest && plan.safest !== plan.shortest && (() => {
              const alt = plan.preferred === 'safest' ? plan.shortest : plan.safest;
              if (!alt?.geometry || !recommended) return null;
              if (alt.totalDistanceKm === recommended.totalDistanceKm) return null;
              return (
                <Polyline positions={alt.geometry} pathOptions={{ color: '#94A3B8', weight: 2.5, opacity: 0.6, dashArray: '6, 5' }}>
                  <Tooltip sticky>
                    <strong>{plan.preferred === 'safest' ? 'Shortest alternative' : 'Safest alternative'}</strong>
                    <br />{alt.totalDistanceKm} km | risk {alt.riskScore}/100
                  </Tooltip>
                </Polyline>
              );
            })()}

            {/* Recommended route - one polyline per road leg, colored by its real risk */}
            {legs.map((leg, i) => {
              const pts = leg.geometry || [];
              if (pts.length < 2) return null;
              const color = legColor(leg);
              return (
                <Polyline
                  key={'leg-' + i}
                  positions={pts}
                  pathOptions={{ color, weight: 4.5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
                >
                  <Tooltip sticky>
                    <strong>{leg.label}</strong><br />
                    {pts.length.toLocaleString()} road points | {leg.geometrySource === 'osrm' ? 'OSRM' : leg.geometrySource === 'tomtom' ? 'TomTom' : leg.geometrySource === 'mappls' ? 'Mappls' : leg.geometrySource === 'fossgis' ? 'OSRM' : leg.geometrySource}
                  </Tooltip>
                  <Popup>
                    <div style={{ minWidth: 210, fontSize: 12 }}>
                      <strong>{leg.label}</strong>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{leg.fromName} to {leg.toName}</div>
                      <div style={{ fontSize: 12, marginTop: 6, lineHeight: 1.7 }}>
                        Distance: <strong>{leg.distanceKm} km</strong>
                        {leg.osrmDistanceKm != null && <span style={{ color: '#6B7280' }}> (road {leg.osrmDistanceKm} km{leg.osrmDurationText ? ' | ' + leg.osrmDurationText : ''})</span>}
                        <br />
                        Risk: <strong style={{ color }}>{leg.riskScore}/100 | {leg.riskLevel}</strong>
                        <br />
                        Road condition: <strong>{(leg.roadCondition || 'good').replace(/_/g, ' ')}</strong>
                        <br />
                        Rainfall: <strong>{leg.rainfallMm != null ? leg.rainfallMm + ' mm/24h' : 'n/a'}</strong>
                        <br />
                        Landslide: <strong>{leg.landslideRisk || 'n/a'}{leg.landslideProbability != null ? ' (' + Math.round(leg.landslideProbability) + '%)' : ''}</strong>
                        <br />
                        Traffic: <strong>{leg.congestionLevel || 'n/a'}</strong>
                      </div>
                    </div>
                  </Popup>
                </Polyline>
              );
            })}

            {/* District hub markers */}
            {fromD && (
              <Marker position={[fromD.lat, fromD.lng]} icon={originIcon}>
                <Popup><strong>{fromD.label}</strong><div style={{ fontSize: 11, color: '#6B7280' }}>Origin</div></Popup>
              </Marker>
            )}
            {toD && (
              <Marker position={[toD.lat, toD.lng]} icon={destIcon}>
                <Popup><strong>{toD.label}</strong><div style={{ fontSize: 11, color: '#6B7280' }}>Destination</div></Popup>
              </Marker>
            )}
          </MapContainer>

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px', fontSize: 11, color: 'var(--text-muted)', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 3, background: RISK_COLOR.low, display: 'inline-block' }} /> Low risk</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 3, background: RISK_COLOR.medium, display: 'inline-block' }} /> Medium</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 3, background: RISK_COLOR.high, display: 'inline-block' }} /> High</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 3, background: RISK_COLOR.critical, display: 'inline-block' }} /> Critical (&gt;80)</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 14, height: 3, background: '#94A3B8', display: 'inline-block', borderTop: '2px dashed #94A3B8' }} /> Alternative option</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={11} style={{ verticalAlign: 'middle' }} />
            {legs.some((l) => ['osrm', 'mappls', 'tomtom', 'fossgis'].includes(l.geometrySource))
              ? 'Lines follow the real road network (OSRM/TomTom/Mappls)'
              : 'Real corridor risk from route database'}
          </span>
        </div>

        <button type="button"
          onClick={() => { setMapKey((k) => k + 1); }}
          title="Re-center map"
          style={{ position: 'absolute', top: 22, right: 22, zIndex: 1000, width: 30, height: 30, borderRadius: 6, background: '#fff', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw size={14} color="#374151" />
        </button>
      </div>
    </div>
  );
};
