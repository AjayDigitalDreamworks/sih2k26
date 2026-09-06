import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import ApiClient from '@/lib/api';
import { subscribeToVehiclePositions, subscribeToAlerts, subscribeToEmergency, subscribeToEmergencyCancelled } from '@/lib/socket';

const AppContext = createContext();

// Empty defaults — everything comes from real APIs
const emptyArray = [];
const emptyObject = {};

// Server vehicle row → dashboard display row (no fabricated telemetry).
// Works for both /admin/vehicles and /transporter/vehicles rows.
export const mapVehicle = (v) => ({
  id: v.id,
  model: v.model,
  driver: v.driver?.name || '—',
  status: v.status ? v.status.charAt(0).toUpperCase() + v.status.slice(1) : 'Idle',
  statusClass: v.status || 'idle',
  speed: `${v.speed || 0} km/h`,
  time: v.last_ping_at ? new Date(v.last_ping_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
  route: v.current_route || '',
  lat: v.current_lat ?? null,
  lng: v.current_lng ?? null,
  fuel: `${v.fuel_percent ?? 0}%`,
  // Real-GPS live-tracking fields (server-computed from actual timestamps)
  liveStatus: v.live_status || null,
  lastGpsAt: v.last_gps_at || null,
  trackingActive: !!v.tracking_active,
  gpsSource: v.gps_source || null,
  speedNum: v.speed || 0,
  heading: v.current_heading ?? null,
  accuracy: v.current_accuracy ?? null,
  currentTripId: v.current_trip_id || null,
});

export const AppProvider = ({ children, scope = 'admin' }) => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [activeModal, setActiveModal] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // All data — starts empty, filled by real APIs
  const [reports, setReports] = useState(emptyArray);
  const [alerts, setAlerts] = useState(emptyArray);
  const [vehicles, setVehicles] = useState(emptyArray);
  const [kpis, setKpis] = useState(null);

  // Real-time integration data
  const [weather, setWeather] = useState(emptyObject);
  const [allWeather, setAllWeather] = useState(emptyObject);
  const [aiRisk, setAiRisk] = useState(null);
  const [routeTrends, setRouteTrends] = useState(emptyArray);
  const [deliveries, setDeliveries] = useState(null);
  const [districtConnectivity, setDistrictConnectivity] = useState(emptyArray);
  const [allDistrictsSummary, setAllDistrictsSummary] = useState(emptyArray);
  const [mlHealth, setMlHealth] = useState(null);
  const [disruptionTrends, setDisruptionTrends] = useState(emptyArray);
  const [delayTrends, setDelayTrends] = useState(emptyArray);
  const [supplyChain, setSupplyChain] = useState(emptyArray);
  const [pipelineRiskScores, setPipelineRiskScores] = useState(emptyObject); // { totalRoutes, scores: { 'kamrup-sonitpur': {...} } }
  const [emergencySos, setEmergencySos] = useState(null); // real-time driver SOS { vehicleId, driver, lat, lng, timestamp }

  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((title, message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => { setToasts(prev => prev.filter(t => t.id !== id)); }, 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // District summary → context state + AI risk breakdown (real data only).
  // Uses the ML-computed composite risk_score / risk_level when present; falls
  // back to case-insensitive label matching for older payloads. "No data"/
  // unavailable feeds are never counted as Low (safe).
  const applyDistrictSummary = useCallback((raw) => {
    const summary = Array.isArray(raw) ? raw : [];
    setAllDistrictsSummary(summary);

    const levelOf = (d) => {
      if (d.risk_level != null) return String(d.risk_level).toLowerCase();
      if (d.risk_score != null) {
        const s = Number(d.risk_score);
        if (s > 80) return 'critical';
        if (s > 60) return 'high';
        if (s > 30) return 'medium';
        return 'low';
      }
      const ls = String(d.landslide_risk || '').toLowerCase();
      const fr = String(d.flood_risk || '').toLowerCase();
      const unavailable = fr === 'no data' || fr === 'unknown' || (d.flood_unavailable) || ls === 'unknown' || (d.landslide_unavailable);
      if (ls === 'very high' || ls === 'high' || fr === 'high' || fr === 'extreme') return 'high';
      if (ls === 'moderate' || fr === 'medium') return 'medium';
      if (unavailable) return 'medium'; // unknown feed — never claim it is safe
      return 'low';
    };

    let high = 0, med = 0, low = 0;
    summary.forEach((d) => {
      const lvl = levelOf(d);
      if (lvl === 'high' || lvl === 'critical') high += 1;
      else if (lvl === 'medium') med += 1;
      else low += 1;
    });

    setAiRisk({
      totalRisks: summary.length,
      lastUpdated: 'live',
      breakdown: [
        { label: 'High Risk', count: high, percentage: summary.length ? Math.round(high / summary.length * 100) : 0, color: '#EF4444' },
        { label: 'Medium Risk', count: med, percentage: summary.length ? Math.round(med / summary.length * 100) : 0, color: '#F59E0B' },
        { label: 'Low Risk', count: low, percentage: summary.length ? Math.round(low / summary.length * 100) : 0, color: '#10B981' },
      ],
    });
  }, []);

  // Live realtime refresh (weather, district summaries, ML health, corridor scores).
  const refreshRealtime = useCallback(async () => {
    const [wxRes, allWxRes, sumRes, healthRes, riskRes] = await Promise.allSettled([
      ApiClient.getWeather('kamrup'),
      ApiClient.getAllWeather(),
      ApiClient.getAllDistrictsSummary(),
      ApiClient.getMLHealth(),
      ApiClient.getPipelineRiskScores(),
    ]);
    if (wxRes.status === 'fulfilled' && wxRes.value?.success && wxRes.value.data) {
      const d = wxRes.value.data;
      setWeather({
        city: d.city || 'Guwahati',
        temp: `${d.temp_celsius ?? '--'}°C`,
        condition: d.weather_code > 20 ? 'Rainy' : d.weather_code > 10 ? 'Cloudy' : 'Clear',
        humidity: `${d.humidity_percent ?? '--'}%`,
        wind: `${d.wind_kmh ?? '--'} km/h`,
        rainfall: `${d.rainfall_24h_mm ?? 0} mm`,
        source: d.source,
      });
    }
    if (allWxRes.status === 'fulfilled' && allWxRes.value?.success && allWxRes.value.data) setAllWeather(allWxRes.value.data);
    if (sumRes.status === 'fulfilled' && sumRes.value?.success && sumRes.value.data) applyDistrictSummary(sumRes.value.data);
    if (healthRes.status === 'fulfilled' && healthRes.value?.success && healthRes.value.data) setMlHealth(healthRes.value.data);
    if (riskRes.status === 'fulfilled' && riskRes.value?.success && riskRes.value.data) setPipelineRiskScores(riskRes.value.data);
  }, [applyDistrictSummary]);

  // Fetch all data on mount — EVERYTHING from real APIs
  useEffect(() => {
    const fetchAll = async () => {
      const isAdmin = scope === 'admin';
      // DB data — transporter scope calls only its own endpoints (no 403s).
      const dbResults = await Promise.allSettled([
        isAdmin ? ApiClient.getAdminKpis() : Promise.resolve({ success: true, data: null }),
        isAdmin ? ApiClient.getAdminAlerts() : ApiClient.getTransporterAlerts(),
        isAdmin ? ApiClient.getAdminFieldReports() : Promise.resolve({ success: true, data: [] }),
        isAdmin ? ApiClient.getAdminVehicles() : ApiClient.getTransporterVehicles(),
        isAdmin ? ApiClient.getSupplyChainGaps() : ApiClient.getTransporterDeliveries(),
        isAdmin ? ApiClient.getDisruptionAnalytics() : Promise.resolve({ success: true, data: [] }),
        isAdmin ? ApiClient.getDelayAnalytics() : Promise.resolve({ success: true, data: [] }),
        isAdmin ? ApiClient.getAdminDistricts() : ApiClient.getGisDistricts(),
      ]);

      const [kpiRes, alertsRes, reportsRes, vehiclesRes, supplyRes, trendRes, delayRes, distRes] = dbResults;

      if (kpiRes.status === 'fulfilled' && kpiRes.value?.success) setKpis(kpiRes.value.data);
      if (alertsRes.status === 'fulfilled' && alertsRes.value?.success) setAlerts(alertsRes.value.data || []);
      if (reportsRes.status === 'fulfilled' && reportsRes.value?.success) setReports(reportsRes.value.data || []);
      if (supplyRes.status === 'fulfilled' && supplyRes.value?.success) {
        // Transporter scope: aggregate the real deliveries by commodity for the
        // same supply-chain breakdown widget the admin sees.
        if (scope === 'transporter') {
          const agg = {};
          (supplyRes.value.data || []).forEach(d => {
            const key = d.commodity_type || 'general';
            agg[key] = agg[key] || { commodity: key, totalWeightKg: 0, delayed: 0, delivered: 0, inTransit: 0 };
            agg[key].totalWeightKg += Number(d.weight_kg) || 0;
            if (d.status === 'delivered') agg[key].delivered += 1;
            else if (d.status === 'delayed') agg[key].delayed += 1;
            else if (d.status === 'in_transit') agg[key].inTransit += 1;
          });
          setSupplyChain(Object.values(agg));
        } else {
          setSupplyChain(supplyRes.value.data || []);
        }
      }
      if (trendRes.status === 'fulfilled' && trendRes.value?.success) setDisruptionTrends(trendRes.value.data || []);
      if (delayRes.status === 'fulfilled' && delayRes.value?.success) setDelayTrends(delayRes.value.data || []);

      if (vehiclesRes.status === 'fulfilled' && vehiclesRes.value?.success && vehiclesRes.value.data) {
        setVehicles(vehiclesRes.value.data.map(mapVehicle));
      }

      if (distRes.status === 'fulfilled' && distRes.value?.success) {
        if (scope === 'transporter' && distRes.value.data?.features) {
          // /gis/districts returns a FeatureCollection with connectivity in properties
          setDistrictConnectivity(distRes.value.data.features.map(f => ({
            district: f.properties?.name || f.properties?.id,
            score: f.properties?.connectivity_score,
            status: f.properties?.connectivity_status,
          })).filter(d => d.score != null));
        } else if (distRes.value.data) {
          setDistrictConnectivity(distRes.value.data.map(d => ({
            district: d.name,
            score: d.connectivity_score,
            status: d.connectivity_status,
          })));
        }
      }

      // Real-time integration data
      const fetchRealtime = async () => {
        // Weather
        try {
          const wxRes = await ApiClient.getWeather('kamrup');
          if (wxRes?.success && wxRes.data) {
            const d = wxRes.data;
            setWeather({
              city: d.city || 'Guwahati',
              temp: `${d.temp_celsius ?? '--'}\u00B0C`,
              condition: d.weather_code > 20 ? 'Rainy' : d.weather_code > 10 ? 'Cloudy' : 'Clear',
              humidity: `${d.humidity_percent ?? '--'}%`,
              wind: `${d.wind_kmh ?? '--'} km/h`,
              rainfall: `${d.rainfall_24h_mm ?? 0} mm`,
              source: d.source,
            });
          } else {
            console.warn('[Raahi] Weather fetch failed:', wxRes?.message || 'No data');
          }
        } catch (e) { console.warn('[Raahi] Weather error:', e.message); }

        // All districts weather
        try {
          const allWx = await ApiClient.getAllWeather();
          if (allWx?.success && allWx.data) setAllWeather(allWx.data);
        } catch (e) { /* will show empty */ }

        // District summary (flood + landslide + weather) — fire-and-forget so the ML
        // health + corridor scores below populate without waiting on this slower call.
        ApiClient.getAllDistrictsSummary()
          .then((sumRes) => { if (sumRes?.success && sumRes.data) applyDistrictSummary(sumRes.data); })
          .catch(() => { /* will show empty */ });

        // ML health
        try {
          const hRes = await ApiClient.getMLHealth();
          if (hRes?.success && hRes.data) {
            setMlHealth(hRes.data);
          } else {
            console.warn('[Raahi] ML health fetch failed:', hRes?.message || 'No data');
          }
        } catch (e) { console.warn('[Raahi] ML health error:', e.message); }

        // Real ML per-corridor risk scores (xgboost engine)
        try {
          const riskRes = await ApiClient.getPipelineRiskScores();
          if (riskRes?.success && riskRes.data) setPipelineRiskScores(riskRes.data);
        } catch (e) { console.warn('[Raahi] Pipeline risk fetch failed:', e.message); }
      };

      fetchRealtime();
    };

    fetchAll();
  }, []);

  // Refresh live real-time data every 5 minutes (weather, summaries, ML health, corridor scores)
  useEffect(() => {
    const interval = setInterval(() => { refreshRealtime(); }, 300000);
    return () => clearInterval(interval);
  }, [refreshRealtime]);

  // Socket.io
  useEffect(() => {
    const unsubVehicles = subscribeToVehiclePositions((payload) => {
      setVehicles(prev => {
        const idx = prev.findIndex(v => v.id === payload.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], lat: payload.lat, lng: payload.lng, speed: `${payload.speed} km/h`, fuel: `${payload.fuel}%`,
            status: payload.status ? payload.status.charAt(0).toUpperCase() + payload.status.slice(1) : updated[idx].status,
            statusClass: payload.status || updated[idx].statusClass,
            time: new Date(payload.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          return updated;
        }
        return [payload, ...prev];
      });
    });

    const unsubAlerts = subscribeToAlerts((newAlert) => {
      setAlerts(prev => [newAlert, ...prev]);
      addToast('Hazard Broadcast', newAlert.title || 'New alert', 'warning');
    });

    // Real-time driver SOS — prominent banner + error toast for control room.
    const unsubEmergency = subscribeToEmergency((payload) => {
      setEmergencySos(payload);
      addToast('🚨 EMERGENCY SOS', `${payload.driver || 'Driver'} on ${payload.vehicleId || 'vehicle'} needs help — tap to open alerts`, 'error');
    });
    const unsubEmergencyCancel = subscribeToEmergencyCancelled(() => {
      setEmergencySos(null);
    });

    return () => { unsubVehicles(); unsubAlerts(); unsubEmergency(); unsubEmergencyCancel(); };
  }, [addToast]);

  const openModal = (modalName, item = null) => { setActiveModal(modalName); setSelectedItem(item); };
  const closeModal = () => { setActiveModal(null); setSelectedItem(null); };

  const addFieldReport = async (newReport) => {
    try {
      // Server is the source of truth — it assigns the real id/timestamp/status.
      const res = await ApiClient.createFieldReport(newReport);
      if (res?.success && res.data) {
        setReports(prev => [res.data, ...prev]);
        addToast('Report Created', `Report ${res.data.id || res.data._id} submitted.`, 'success');
        return res.data;
      }
      addToast('Report Failed', res?.message || 'Could not submit report', 'error');
      return null;
    } catch (e) {
      addToast('Report Failed', e.message || 'Could not submit report', 'error');
      return null;
    }
  };

  const verifyReport = async (reportId) => {
    try {
      const res = await ApiClient.verifyFieldReport(reportId);
      if (res?.success && res.data) {
        setReports(prev => prev.map(r => ((r.id || r._id) === reportId ? { ...res.data } : r)));
        addToast('Report Verified', `Report ${reportId} resolved.`, 'success');
      } else {
        addToast('Verify Failed', res?.message || 'Could not verify report', 'error');
      }
    } catch (e) {
      addToast('Verify Failed', e.message || 'Could not verify report', 'error');
    }
  };

  const addVehicle = async (v) => {
    try {
      const res = await ApiClient.createVehicle(v);
      if (res?.success && res.data) {
        setVehicles(prev => [mapVehicle(res.data), ...prev]);
        addToast('Vehicle Added', `Vehicle ${res.data.id} registered.`, 'success');
        return res.data;
      }
      addToast('Vehicle Failed', res?.message || 'Could not register vehicle', 'error');
      return null;
    } catch (e) {
      addToast('Vehicle Failed', e.message || 'Could not register vehicle', 'error');
      return null;
    }
  };

  const addAlert = async (a) => {
    try {
      // Server is the source of truth — it assigns the real id/timestamp.
      const res = await ApiClient.createAlert(a);
      if (res?.success && res.data) {
        setAlerts(prev => [res.data, ...prev]);
        addToast('Alert Broadcast', a.title, 'warning');
        return res.data;
      }
      addToast('Alert Failed', res?.message || 'Could not create alert', 'error');
      return null;
    } catch (e) {
      addToast('Alert Failed', e.message || 'Could not create alert', 'error');
      return null;
    }
  };

  return (
    <AppContext.Provider value={{
      currentPage, setCurrentPage,
      sidebarCollapsed, setSidebarCollapsed,
      searchQuery, setSearchQuery,
      activeModal, openModal, closeModal,
      selectedItem, setSelectedItem,
      reports, setReports,
      alerts, setAlerts,
      vehicles, setVehicles,
      kpis,
      weather, allWeather,
      aiRisk,
      emergencySos,
      clearEmergencySos: () => setEmergencySos(null),
      routeTrends,
      deliveries, setDeliveries,
      districtConnectivity,
      allDistrictsSummary,
      mlHealth,
      disruptionTrends,
      delayTrends,
      supplyChain,
      pipelineRiskScores,
      addFieldReport, verifyReport,
      addVehicle, addAlert,
      toasts, addToast, removeToast,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
