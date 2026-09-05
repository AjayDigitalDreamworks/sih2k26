/* Real-GPS chain verification — dashboard/WebSocket side.
   Starts TRP-1001, pushes several real WEB_GPS points at a driver-realistic
   cadence, listens for Socket.IO location events as an admin (exactly like the
   admin dashboard), then checks status/current/history endpoints.
   Leaves the trip planned + history cleared afterwards (via reset script). */
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
const require = createRequire('D:/sih26/Raahi-SIH2026/frontend/');
const { io } = require('socket.io-client');

const API = 'http://localhost:5000/api';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = [];
const report = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`); };

const login = async (email, password) => {
  const r = await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return (await r.json()).data?.accessToken || '';
};

async function main() {
  const driverToken = await login('driver@raahi.gov.in', 'driver123');
  const adminToken = await login('admin@raahi.gov.in', 'admin123');
  report('driver + admin login', !!driverToken && !!adminToken);

  // Reset fixture to planned
  const reset = () => spawnSync(process.execPath, ['D:/sih26/Raahi-SIH2026/core-backend/node_modules/tsx/dist/cli.mjs', 'D:/sih26/Raahi-SIH2026/core-backend/scripts/reset-tracking.ts'], { cwd: 'D:/sih26/Raahi-SIH2026/core-backend', stdio: 'ignore', timeout: 90000 });
  report('fixture reset to planned', reset().status === 0);

  // Start trip
  const st = await (await fetch(API + '/tracking/trips/TRP-1001/start', { method: 'POST', headers: { Authorization: `Bearer ${driverToken}`, 'Content-Type': 'application/json' }, body: '{}' })).json();
  report('trip started', st?.ok || st?.success || !!st?.data);

  // Socket.IO listener authenticated as ADMIN (same room as the dashboard).
  const events = [];
  const rawEvents = [];
  let socketRef = null;
  let wsErrMsg = null;
  const wsConnected = new Promise((resolve) => {
    const s = io('http://localhost:5000', {
      auth: { token: adminToken },
      transports: ['websocket'], reconnection: false, timeout: 8000,
    });
    socketRef = s;
    const done = (ok, err) => { wsErrMsg = err || null; try { s.disconnect(); } catch {} resolve(ok); };
    s.on('connect', () => { events.push('__connected__'); rawEvents.push('connect'); resolve(true); });
    s.on('connect_error', (e) => done(false, e.message));
    s.onAny((ev, m) => {
      rawEvents.push(ev);
      if (m && typeof m === 'object' && m.vehicleId === 'AS-01-AB-1234') events.push({ ev, m });
    });
    setTimeout(() => done(true), 40000); // safety close; points run ~16.5s below
  });
  const wsOk = await wsConnected;
  report('Socket.IO tracking gateway reachable (admin)', wsOk, wsErrMsg || '');

  // Push 5 real points (Guwahati→Shillong corridor) at ~3.2s cadence — the
  // backend rate gate is TRACKING_MIN_INTERVAL_SECONDS=3, exactly like a live driver.
  const pts = [
    [26.1560, 91.7542], [26.1485, 91.7691], [26.1409, 91.7837], [26.1330, 91.7975], [26.1252, 91.8106],
  ];
  let okCount = 0; let codes = {};
  for (let i = 0; i < pts.length; i++) {
    const [lat, lng] = pts[i];
    const r = await fetch(API + '/tracking/location', {
      method: 'POST',
      headers: { Authorization: `Bearer ${driverToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicle_id: 'AS-01-AB-1234', trip_id: 'TRP-1001', latitude: lat, longitude: lng,
        accuracy: 8, speed: 11.2 + i, heading: 138 + i * 2, altitude: 61,
        gps_timestamp: new Date().toISOString(), source: 'WEB_GPS',
      }),
    });
    codes[r.status] = (codes[r.status] || 0) + 1;
    if (r.status === 200) okCount += 1;
    await sleep(3300);
  }
  report('5 real WEB_GPS points accepted (3s cadence)', okCount === pts.length, `${okCount}/5 ${JSON.stringify(codes)}`);

  // WebSocket received the broadcasts (as the admin dashboard would)
  await new Promise(r => setTimeout(r, 1500)); // let the final events arrive
  try { socketRef?.disconnect(); } catch {}
  await sleep(500);
  const locEvents = events.filter(e => e !== '__connected__' && (e.ev === 'vehicle:position' || e.ev === 'vehicle.location.updated'));
  report('WS vehicle.location.updated received', locEvents.length >= 2, `${locEvents.length} location events (raw: ${JSON.stringify(rawEvents)})`);
  const lastWs = locEvents[locEvents.length - 1]?.m;
  if (lastWs) console.log('  WS sample:', JSON.stringify({ lat: lastWs.lat, lng: lastWs.lng, speed: lastWs.speed, liveStatus: lastWs.liveStatus, source: lastWs.source }));

  // Dashboard aggregation shows LIVE + moving with real data
  const overview = await (await fetch(API + '/tracking/status', { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  const liveRow = (overview?.data?.vehicles || []).find(v => v.vehicleId === 'AS-01-AB-1234');
  report('dashboard overview: 1 LIVE vehicle', (overview?.data?.live || 0) >= 1 && liveRow?.liveStatus === 'LIVE', `live=${overview?.data?.live} status=${liveRow?.liveStatus}`);

  // Current-state endpoint reflects real coordinates
  const cur = await (await fetch(API + '/tracking/vehicles/AS-01-AB-1234/current', { headers: { Authorization: `Bearer ${driverToken}` } })).json();
  const cd = cur?.data?.lastValidGps || cur?.data?.vehicle || {};
  const realLat = cd.lat ?? cd.latitude;
  report('current endpoint: real last coords + source', realLat != null && Math.abs(realLat - 26.1252) < 0.05 && (cd.source || cd.gps_source) === 'WEB_GPS', `lat=${realLat} src=${cd.source || cd.gps_source}`);

  // History persisted with geometry
  const hist = await (await fetch(API + '/tracking/vehicles/AS-01-AB-1234/history?trip_id=TRP-1001', { headers: { Authorization: `Bearer ${driverToken}` } })).json();
  report('PostGIS history: 5 WEB_GPS points with geom', (hist?.data?.total || 0) >= 5 && hist?.data?.points?.every(p => p.source === 'WEB_GPS' && p.geomLat != null), `total=${hist?.data?.total}`);

  // Stop the trip → vehicle must drop to 0 LIVE immediately (no stale LIVE)
  await (await fetch(API + '/tracking/trips/TRP-1001/stop', { method: 'POST', headers: { Authorization: `Bearer ${driverToken}`, 'Content-Type': 'application/json' }, body: '{}' })).json();
  const overview2 = await (await fetch(API + '/tracking/status', { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  report('after stop: 0 LIVE, 0 active trips', (overview2?.data?.live || 0) === 0 && (overview2?.data?.activeTrips || 0) === 0, `live=${overview2?.data?.live} activeTrips=${overview2?.data?.activeTrips}`);

  // Restore fixture to planned for a clean handoff
  reset();

  const failed = results.filter(r => !r.ok).length;
  console.log(`\n==== ${results.length - failed}/${results.length} checks passed ====`);
  results.filter(r => !r.ok).forEach(r => console.log(`  FAIL: ${r.name}`));
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
