/**
 * useAutomatedAlerts — Monitors real-time data streams and auto-generates
 * alerts when hazard thresholds are breached.
 *
 * Categories:
 *   1. Blocked Roads       – corridor risk > 80 or district road_blocked
 *   2. Inaccessible Regions – connectivity < 30 or high flood/landslide risk
 *   3. Delayed Deliveries  – vehicles stationary > 30 min on active trip
 *   4. High-Risk Corridors – pipeline risk score > 70
 *
 * De-duplicates via fingerprints (category + location + 15-min time window).
 */
import { useEffect, useRef, useCallback } from 'react';

// Fingerprint window (ms) — suppress duplicates within this window
const DEDUP_WINDOW = 15 * 60 * 1000; // 15 minutes

const makeFingerprintKey = (category, location) =>
  `${category}::${String(location).toLowerCase().replace(/\s+/g, '_')}`;

export default function useAutomatedAlerts({
  allDistrictsSummary = [],
  pipelineRiskScores = {},
  vehicles = [],
  weather = {},
  alerts = [],
  addToast,
  setAlerts,
  playAlertSound,
  showBrowserNotification,
}) {
  const fingerprintsRef = useRef(new Map()); // key → lastFiredTs

  // Purge stale fingerprints every minute
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const fp = fingerprintsRef.current;
      for (const [key, ts] of fp.entries()) {
        if (now - ts > DEDUP_WINDOW) fp.delete(key);
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const isDuplicate = useCallback((category, location) => {
    const key = makeFingerprintKey(category, location);
    const last = fingerprintsRef.current.get(key);
    if (last && Date.now() - last < DEDUP_WINDOW) return true;
    fingerprintsRef.current.set(key, Date.now());
    return false;
  }, []);

  const emitAlert = useCallback((alertObj) => {
    if (!setAlerts) return;
    setAlerts((prev) => [alertObj, ...prev]);
    if (addToast) {
      const typeLabel = alertObj.severity === 'Critical' ? 'error' : 'warning';
      addToast('🚨 Auto Alert', alertObj.title, typeLabel);
    }
    if (playAlertSound) {
      const severityKey = alertObj.severityType || 'medium';
      playAlertSound(severityKey, alertObj.autoCategory);
    }
    if (showBrowserNotification) {
      showBrowserNotification(
        `⚠ ${alertObj.title}`,
        alertObj.message || alertObj.subtitle || 'New automated alert from Raahi monitoring.',
        { tag: `raahi-auto-${alertObj.id}` }
      );
    }
  }, [setAlerts, addToast, playAlertSound, showBrowserNotification]);

  // ── District-based alert checks ─────────────────────────────────
  useEffect(() => {
    if (!allDistrictsSummary || allDistrictsSummary.length === 0) return;

    allDistrictsSummary.forEach((d) => {
      const name = d.name || d.district || d.district_id || 'Unknown';
      const riskScore = Number(d.risk_score) || 0;
      const riskLevel = String(d.risk_level || '').toLowerCase();
      const connectivityScore = d.connectivity_score != null ? Number(d.connectivity_score) : null;
      const floodRisk = String(d.flood_risk || '').toLowerCase();
      const landslideRisk = String(d.landslide_risk || '').toLowerCase();
      const roadBlocked = d.road_blocked || d.roadBlocked;

      // 1. Blocked Roads
      if (roadBlocked || riskScore > 80 || riskLevel === 'critical') {
        if (!isDuplicate('blockedRoad', name)) {
          emitAlert({
            id: `auto-blocked-${name}-${Date.now()}`,
            title: `Road Blockage — ${name}`,
            message: `Critical disruption detected in ${name} district. Risk score: ${riskScore}. Seek alternate corridor.`,
            subtitle: `Automated blockage detection — risk score ${riskScore}`,
            severity: 'Critical',
            severityType: 'high',
            status: 'Active',
            isRead: false,
            category: 'roadblock',
            autoCategory: 'blockedRoad',
            origin: name,
            destination: 'Alternate Route Required',
            timestamp: new Date().toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            createdAtDate: new Date(),
            reportedBy: 'Raahi Automated Monitoring System',
          });
        }
      }

      // 2. Inaccessible Regions
      if (
        (connectivityScore != null && connectivityScore < 30) ||
        floodRisk === 'high' || floodRisk === 'extreme' ||
        landslideRisk === 'very high' || landslideRisk === 'high'
      ) {
        if (!isDuplicate('inaccessible', name)) {
          const reasons = [];
          if (connectivityScore != null && connectivityScore < 30) reasons.push(`connectivity ${connectivityScore}%`);
          if (floodRisk === 'high' || floodRisk === 'extreme') reasons.push(`flood risk: ${floodRisk}`);
          if (landslideRisk === 'very high' || landslideRisk === 'high') reasons.push(`landslide risk: ${landslideRisk}`);

          emitAlert({
            id: `auto-inaccessible-${name}-${Date.now()}`,
            title: `Region Inaccessible — ${name}`,
            message: `${name} flagged as potentially inaccessible. Factors: ${reasons.join(', ')}.`,
            subtitle: `Automated inaccessibility warning — ${reasons.join(', ')}`,
            severity: connectivityScore != null && connectivityScore < 15 ? 'Critical' : 'Medium',
            severityType: connectivityScore != null && connectivityScore < 15 ? 'high' : 'medium',
            status: 'Active',
            isRead: false,
            category: floodRisk === 'high' || floodRisk === 'extreme' ? 'flood' : 'landslide',
            autoCategory: floodRisk === 'high' || floodRisk === 'extreme' ? 'flood' : 'landslide',
            origin: name,
            destination: 'Region Access Restricted',
            timestamp: new Date().toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            createdAtDate: new Date(),
            reportedBy: 'Raahi GIS & Weather Intelligence',
          });
        }
      }
    });
  }, [allDistrictsSummary, isDuplicate, emitAlert]);

  // ── Pipeline corridor risk checks ──────────────────────────────
  useEffect(() => {
    if (!pipelineRiskScores?.scores) return;

    Object.entries(pipelineRiskScores.scores).forEach(([corridor, data]) => {
      const score = Number(data?.risk_score || data?.score || 0);
      if (score > 70) {
        const corridorName = corridor.replace(/-/g, ' → ').replace(/_/g, ' ');
        if (!isDuplicate('highRiskCorridor', corridor)) {
          emitAlert({
            id: `auto-corridor-${corridor}-${Date.now()}`,
            title: `High-Risk Corridor — ${corridorName}`,
            message: `Transport corridor "${corridorName}" has a composite risk score of ${score}. Exercise caution or re-route.`,
            subtitle: `Pipeline corridor risk score: ${score}`,
            severity: score > 85 ? 'Critical' : 'Medium',
            severityType: score > 85 ? 'high' : 'medium',
            status: 'Active',
            isRead: false,
            category: 'roadblock',
            autoCategory: 'highRiskCorridor',
            origin: corridorName.split(' → ')[0] || corridorName,
            destination: corridorName.split(' → ')[1] || 'Corridor End',
            timestamp: new Date().toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            createdAtDate: new Date(),
            reportedBy: 'Raahi Risk Pipeline Engine',
          });
        }
      }
    });
  }, [pipelineRiskScores, isDuplicate, emitAlert]);

  // ── Delayed delivery checks (vehicle stationary > 30 min) ──────
  useEffect(() => {
    if (!vehicles || vehicles.length === 0) return;

    vehicles.forEach((v) => {
      // Only check vehicles that are on active trips
      if (!v.currentTripId && v.statusClass !== 'in_transit') return;
      if (v.speedNum > 2) return; // moving — not stalled

      // Check if last ping was > 30 min ago
      const lastPing = v.lastGpsAt || v.time;
      if (!lastPing) return;

      let lastPingDate;
      try {
        // Handle both ISO strings and "HH:MM" format
        if (typeof lastPing === 'string' && lastPing.includes(':') && lastPing.length <= 5) {
          // It's just "HH:MM" — construct today's date
          const [h, m] = lastPing.split(':');
          lastPingDate = new Date();
          lastPingDate.setHours(Number(h), Number(m), 0, 0);
        } else {
          lastPingDate = new Date(lastPing);
        }
      } catch { return; }

      if (Number.isNaN(lastPingDate.getTime())) return;

      const stalledMs = Date.now() - lastPingDate.getTime();
      const stalledMin = Math.round(stalledMs / 60000);

      if (stalledMin >= 30 && stalledMin < 600) { // between 30 min and 10 hrs (ignore stale data)
        if (!isDuplicate('delayedDelivery', v.id)) {
          emitAlert({
            id: `auto-delay-${v.id}-${Date.now()}`,
            title: `Delivery Delayed — Vehicle ${v.model || v.id}`,
            message: `Vehicle ${v.model || v.id} (${v.driver || 'Unknown driver'}) has been stationary for ${stalledMin} minutes on an active trip.`,
            subtitle: `No movement detected for ${stalledMin} min`,
            severity: stalledMin > 60 ? 'Critical' : 'Medium',
            severityType: stalledMin > 60 ? 'high' : 'medium',
            status: 'Active',
            isRead: false,
            category: 'roadblock',
            autoCategory: 'delayedDelivery',
            origin: v.route || 'Active Route',
            destination: `Vehicle ${v.model || v.id}`,
            timestamp: new Date().toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
            createdAtDate: new Date(),
            reportedBy: 'Raahi Fleet Monitoring',
            locationCoords: v.lat && v.lng ? [v.lat, v.lng] : null,
          });
        }
      }
    });
  }, [vehicles, isDuplicate, emitAlert]);
}
