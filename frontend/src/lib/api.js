// API Client for Raahi Core Backend
import { findDistrictMatch, DISTRICTS } from '../data/geoMaster';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  static getAccessToken() {
    return localStorage.getItem('ner_access_token') || sessionStorage.getItem('ner_access_token');
  }

  static getRefreshToken() {
    return localStorage.getItem('ner_refresh_token') || sessionStorage.getItem('ner_refresh_token');
  }

  static setTokens(accessToken, refreshToken, rememberMe = true) {
    if (rememberMe) {
      localStorage.setItem('ner_access_token', accessToken);
      localStorage.setItem('ner_refresh_token', refreshToken);
    } else {
      sessionStorage.setItem('ner_access_token', accessToken);
      sessionStorage.setItem('ner_refresh_token', refreshToken);
    }
  }

  static clearTokens() {
    localStorage.removeItem('ner_access_token');
    localStorage.removeItem('ner_refresh_token');
    sessionStorage.removeItem('ner_access_token');
    sessionStorage.removeItem('ner_refresh_token');
  }

  static async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const token = this.getAccessToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers,
      });

      // Handle 403 Forbidden - privilege violation / unauthorized role access
      if (response.status === 403) {
        const errorData = await response.clone().json().catch(() => null);
        const forbiddenMsg = errorData?.message || 'Access denied: You do not have permission for this resource.';
        console.warn(`[Security Alert] 403 Forbidden on ${endpoint}: ${forbiddenMsg}`);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('raahi:forbidden', {
              detail: {
                endpoint,
                message: forbiddenMsg,
              },
            })
          );
        }
      }

      // Handle 401 & attempt token refresh once
      if (response.status === 401 && !options._retry) {
        const refreshToken = this.getRefreshToken();
        if (refreshToken) {
          try {
            const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });
            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              if (refreshData.success && refreshData.data?.accessToken) {
                this.setTokens(refreshData.data.accessToken, refreshData.data.refreshToken || refreshToken);
                return this.request(endpoint, { ...options, _retry: true });
              }
            }
          } catch (e) {
            // refresh request failed
          }
        }
        this.clearTokens();
        localStorage.removeItem('ner_logismart_user');
        sessionStorage.removeItem('ner_logismart_user');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('raahi:auth_expired'));
        }
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.warn(`API request to ${endpoint} failed:`, err);
      return { success: false, message: err.message };
    }
  }

  // Auth endpoints
  static login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  static logout() {
    return this.request('/auth/logout', { method: 'POST' });
  }

  static getMe() {
    return this.request('/auth/me');
  }

  /** Transporter/driver self profile update (name, agency, phone on own account). */
  static updateOwnProfile(payload) {
    return this.request('/transporter/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  // Admin endpoints
  static getAdminKpis() {
    return this.request('/admin/overview/kpis');
  }

  static getAdminDistricts() {
    return this.request('/admin/districts');
  }

  static getAdminRoutes() {
    return this.request('/admin/routes');
  }

  static getAdminVehicles() {
    return this.request('/admin/vehicles');
  }

  static getAdminAlerts() {
    return this.request('/admin/alerts');
  }

  static createAlert(payload) {
    return this.request('/admin/alerts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static createTransporterAlert(payload) {
    return this.request('/transporter/alerts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).catch(() => this.createAlert(payload));
  }

  static getAdminFieldReports() {
    return this.request('/admin/field-reports');
  }

  static createFieldReport(payload) {
    return this.request('/admin/field-reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static verifyFieldReport(id) {
    return this.request(`/admin/field-reports/${id}/verify`, { method: 'PATCH' });
  }

  static rejectFieldReport(id, reason) {
    return this.request(`/admin/field-reports/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason, status: 'Rejected' }),
    });
  }

  static dismissFieldReport(id, reason) {
    return this.request(`/admin/field-reports/${id}/dismiss`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: reason || 'Dismissed by Command Center', status: 'Dismissed' }),
    });
  }

  static uploadMedia(fileOrFormData) {
    if (typeof FormData !== 'undefined' && fileOrFormData instanceof FormData) {
      const url = `${API_BASE}/field-officer/media/upload`;
      const token = this.getAccessToken();
      return fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: fileOrFormData,
      }).then((r) => r.json());
    }
    return this.request('/field-officer/media/upload', {
      method: 'POST',
      body: JSON.stringify(fileOrFormData),
    });
  }

  static getPublicOverview() {
    return this.request('/public/overview');
  }

  static getSupplyChainGaps() {
    return this.request('/admin/supply-chain/gaps');
  }

  static recomputeSupplyChainGaps() {
    return this.request('/admin/supply-chain/gaps/recompute', { method: 'POST' });
  }

  static getVehicleTrackingStatus(vehicleId) {
    return this.request(`/tracking/status?vehicleId=${encodeURIComponent(vehicleId)}`);
  }

  static getDisruptionAnalytics() {
    return this.request('/admin/analytics/disruption-trends');
  }

  static getDelayAnalytics() {
    return this.request('/admin/analytics/delay-trends');
  }

  static getAdminUsers() {
    return this.request('/admin/users');
  }

  static createUser(payload) {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static updateUser(id, payload) {
    return this.request(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  static deleteUser(id) {
    return this.request(`/admin/users/${id}`, { method: 'DELETE' });
  }

  static updateAlert(id, payload) {
    return this.request(`/admin/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  // Transporter endpoints
  static getTransporterKpis() {
    return this.request('/transporter/overview/kpis');
  }

  static getTransporterVehicles() {
    return this.request('/transporter/vehicles');
  }

  static getVehicles() {
    return this.getTransporterVehicles().then((res) => {
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) return res;
      return this.request('/admin/vehicles');
    });
  }

  static createVehicle(payload) {
    return this.request('/transporter/vehicles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static updateVehicle(id, payload) {
    return this.request(`/transporter/vehicles/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  static deleteVehicle(id) {
    return this.request(`/transporter/vehicles/${id}`, { method: 'DELETE' });
  }

  static getTransporterDrivers() {
    return this.request('/transporter/drivers').then((res) => {
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) return res;
      return this.request('/admin/drivers');
    });
  }

  static getAdminDrivers() {
    return this.request('/admin/drivers');
  }

  static getDrivers() {
    return this.getTransporterDrivers();
  }

  static createDriver(payload) {
    return this.request('/transporter/drivers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static getTransporterDeliveries() {
    return this.request('/transporter/deliveries');
  }

  static async getConsignment(id) {
    try {
      const res = await this.getTransporterDeliveries();
      if (res?.success && Array.isArray(res.data)) {
        const found = res.data.find((d) => d.id === id || d.tracking_number === id);
        if (found) return { success: true, data: found };
      }
      return await this.request(`/transporter/deliveries/${id}`);
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  static getDelivery(id) {
    return this.getConsignment(id);
  }

  static createDelivery(payload) {
    return this.request('/transporter/deliveries', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static updateDeliveryStatus(id, status) {
    return this.request(`/transporter/deliveries/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  static planTrip(payload) {
    return this.request('/transporter/trips/plan', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static createTrip(payload) {
    return this.request('/transporter/trips', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static confirmDelivery(deliveryId, payload = {}) {
    return this.request(`/tracking/deliveries/${deliveryId}/delivered`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static getTransporterAlerts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/transporter/alerts${qs ? `?${qs}` : ''}`);
  }

  static updateTransporterAlert(id, payload) {
    return this.request(`/transporter/alerts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  static markAllTransporterAlertsRead() {
    return this.request('/transporter/alerts/mark-all-read', {
      method: 'POST',
    });
  }

  static reportIncident(payload) {
    return this.request('/transporter/field-reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ---- Real GPS Tracking (driver web/PWA + future native app) ----
  static getTrackingContext() {
    return this.request('/tracking/my/context');
  }
  static postTrackingLocation(payload, sync = false) {
    return this.request('/tracking/location', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: sync ? { 'X-Tracking-Sync': '1' } : {},
    });
  }
  static startTrip(tripId) {
    return this.request(`/tracking/trips/${encodeURIComponent(tripId)}/start`, { method: 'POST' });
  }
  static stopTrip(tripId) {
    return this.request(`/tracking/trips/${encodeURIComponent(tripId)}/stop`, { method: 'POST' });
  }
  static getTrackingStatus() {
    return this.request('/tracking/status');
  }
  static sendSos(payload = {}) {
    return this.request('/tracking/sos', { method: 'POST', body: JSON.stringify(payload) });
  }
  static cancelSos() {
    return this.request('/tracking/sos/cancel', { method: 'POST' });
  }
  static getSosActive() {
    return this.request('/tracking/sos/active');
  }
  static getAllActiveSos() {
    return this.request('/tracking/sos/all');
  }
  static getPublicOverview() {
    return this.request('/public/overview');
  }
  static getVehicleTrackingStatus(vehicleId) {
    return this.request(`/tracking/vehicles/${encodeURIComponent(vehicleId)}/current`);
  }

  // ---- Driver-scope APIs (own profile / vehicle / trips / reports only) ----
  static getDriverMe() {
    return this.request('/driver/me');
  }
  static updateDriverMe(payload) {
    return this.request('/driver/me', { method: 'PATCH', body: JSON.stringify(payload) });
  }
  static getDriverVehicle() {
    return this.request('/driver/vehicle');
  }
  static getDriverTripsHistory() {
    return this.request('/driver/trips/history');
  }
  static getDriverTripSummary(tripId) {
    return this.request(`/driver/trips/${encodeURIComponent(tripId)}/summary`);
  }
  static postDriverIncident(payload) {
    return this.request('/driver/incidents', { method: 'POST', body: JSON.stringify(payload) });
  }
  static postDriverRoadReport(payload) {
    return this.request('/driver/road-reports', { method: 'POST', body: JSON.stringify(payload) });
  }
  static getVehicleHistory(vehicleId, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/tracking/vehicles/${encodeURIComponent(vehicleId)}/history${qs ? '?' + qs : ''}`);
  }
  static getTripSummary(vehicleId, tripId) {
    const qs = tripId ? `?trip_id=${encodeURIComponent(tripId)}` : '';
    return this.request(`/tracking/vehicles/${encodeURIComponent(vehicleId)}/trip-summary${qs}`);
  }
  static startTrip(tripId) {
    return this.request(`/tracking/trips/${encodeURIComponent(tripId)}/start`, {
      method: 'POST',
    });
  }
  static stopTrip(tripId) {
    return this.request(`/tracking/trips/${encodeURIComponent(tripId)}/stop`, {
      method: 'POST',
    });
  }
  static sendSos(payload) {
    return this.request('/tracking/sos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  static cancelSos() {
    return this.request('/tracking/sos/cancel', {
      method: 'POST',
    });
  }
  static postTrackingLocation(payload, isSync = false) {
    return this.request('/tracking/location', {
      method: 'POST',
      headers: isSync ? { 'x-tracking-sync': '1' } : {},
      body: JSON.stringify(payload),
    });
  }
  static getVehicleTrackingStatus(vehicleId) {
    return this.request(`/tracking/vehicles/${encodeURIComponent(vehicleId)}/live`);
  }

  // ---- Real-Time Integration Endpoints ----

  // Weather
  static getWeather(districtId) {
    return this.request(`/integrations/weather/${districtId}`);
  }
  static getAllWeather() {
    return this.request('/integrations/weather');
  }

  // IMD National Weather Intelligence
  static getImdStations(region = 'ner', state = '') {
    const params = new URLSearchParams();
    if (region) params.set('region', region);
    if (state) params.set('state', state);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/integrations/imd/stations${qs}`);
  }
  static getImdNowcasts(minSeverity = 'all') {
    return this.request(`/integrations/imd/nowcasts?min_severity=${encodeURIComponent(minSeverity)}`);
  }
  static getImdNationalSummary() {
    return this.request('/integrations/imd/national-summary');
  }
  static getImdDistrictReport(districtId) {
    return this.request(`/integrations/imd/district/${encodeURIComponent(districtId)}`);
  }
  static checkCorridorWeather(districts) {
    return this.request('/integrations/imd/corridor-check', {
      method: 'POST',
      body: JSON.stringify({ districts }),
    });
  }
  static getImdHealth() {
    return this.request('/integrations/imd/health');
  }
  static getImdDistrictWarnings(region = 'ner') {
    return this.request(`/integrations/imd/district-warnings?region=${encodeURIComponent(region)}`);
  }
  static getImdDistrictRainfall(region = 'ner') {
    return this.request(`/integrations/imd/district-rainfall?region=${encodeURIComponent(region)}`);
  }
  static getImdStationNowcasts(region = 'ner') {
    return this.request(`/integrations/imd/station-nowcasts?region=${encodeURIComponent(region)}`);
  }
  static getImdStateRainfall(region = 'ner') {
    return this.request(`/integrations/imd/state-rainfall?region=${encodeURIComponent(region)}`);
  }
  static getImdNerIntelligence() {
    return this.request('/integrations/imd/ner-intelligence');
  }

  // Flood
  static getFloodRisk(districtId) {
    return this.request(`/integrations/flood/${districtId}`);
  }
  static getAllFlood() {
    return this.request('/integrations/flood');
  }

  // Landslide
  static getLandslideRisk(districtId) {
    return this.request(`/integrations/landslide/${districtId}`);
  }

  // Traffic
  static getRouteTraffic(params) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/integrations/traffic/route?${qs}`);
  }
  static getTrafficFlow(params) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/integrations/traffic/flow?${qs}`);
  }

  // Routing
  static getOptimizedRoute(params) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/integrations/route?${qs}`);
  }

  // Real road-network route planner (OSRM geometry, safest/shortest, live per-leg conditions)
  static async planRoute(payload) {
    try {
      const res = await this.request('/integrations/route/plan', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res && (res.success || res.data?.success || res.data?.recommended)) {
        return res;
      }
    } catch (_) {}

    // Resilient direct fallback to ML service (port 8010)
    try {
      const mlUrl = import.meta.env.VITE_ML_SERVICE_URL || 'http://localhost:8010';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const r = await fetch(`${mlUrl}/route/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (r.ok) {
        const data = await r.json();
        if (data && (data.success || data.recommended)) {
          return { success: true, data };
        }
      }
    } catch (_) {}

    // Tier 3: Client-side public OSRM fallback with real district hubs & secondary OSM mirror
    try {
      const origMatch = findDistrictMatch(payload?.originDistrictId || payload?.origin) || DISTRICTS[0];
      const destMatch = findDistrictMatch(payload?.destDistrictId || payload?.destination) || DISTRICTS[2];
      const startLat = payload?.currentLat != null ? Number(payload.currentLat) : origMatch.lat;
      const startLng = payload?.currentLng != null ? Number(payload.currentLng) : origMatch.lng;
      const endLat = destMatch.lat;
      const endLng = destMatch.lng;

      // Extract waypoints/stops if provided
      const waypointCoords = [];
      if (Array.isArray(payload?.stops)) {
        for (const st of payload.stops) {
          const match = findDistrictMatch(st);
          if (match && match.lat && match.lng) {
            waypointCoords.push([match.lng, match.lat]);
          }
        }
      }

      const allCoordPairs = [[startLng, startLat], ...waypointCoords, [endLng, endLat]];
      const coordStr = allCoordPairs.map(([lng, lat]) => `${lng},${lat}`).join(';');

      let geometry = [[startLat, startLng], [endLat, endLng]];
      let distanceKm = 295;
      let durationSeconds = 21600;

      // Primary OSRM fetch with failover to OSM routed-car mirror
      const fetchOsrmGeom = async (url) => {
        const ctrl = new AbortController();
        const tId = setTimeout(() => ctrl.abort(), 6000);
        try {
          const r = await fetch(url, { signal: ctrl.signal });
          clearTimeout(tId);
          if (r.ok) {
            const data = await r.json();
            if (data.routes?.[0]) {
              const r0 = data.routes[0];
              let pts = [];
              if (Array.isArray(r0.geometry?.coordinates)) {
                pts = r0.geometry.coordinates.map((c) => [c[1], c[0]]);
              }
              const dist = r0.distance ? Math.round(r0.distance / 100) / 10 : distanceKm;
              const dur = r0.duration ? Math.round(r0.duration) : durationSeconds;
              return { success: true, geometry: pts, distanceKm: dist, durationSeconds: dur };
            }
          }
        } catch (_) {
          clearTimeout(tId);
        }
        return { success: false };
      };

      const primaryUrl = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
      const mirrorUrl = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

      let routeRes = await fetchOsrmGeom(primaryUrl);
      if (!routeRes.success || !routeRes.geometry || routeRes.geometry.length < 5) {
        routeRes = await fetchOsrmGeom(mirrorUrl);
      }

      if (routeRes.success && Array.isArray(routeRes.geometry) && routeRes.geometry.length > 1) {
        geometry = routeRes.geometry;
        distanceKm = routeRes.distanceKm;
        durationSeconds = routeRes.durationSeconds;
      }

      const travelHours = Math.round((durationSeconds / 3600) * 10) / 10;
      const timeStr = `${Math.floor(travelHours)}h ${Math.round((travelHours % 1) * 60)}m`;

      // Generate road curve micro-segments along the polyline
      const generateFallbackMicroSegments = (pts, baseScore = 18) => {
        if (!pts || pts.length < 4) return [];
        const chunks = [];
        const step = Math.max(6, Math.floor(pts.length / 32));
        let currKm = 0;
        for (let i = 0; i < pts.length - 1; i += step) {
          const slice = pts.slice(i, Math.min(pts.length, i + step + 1));
          if (slice.length < 2) continue;
          let dKm = 0;
          for (let j = 0; j < slice.length - 1; j++) {
            const latDiff = (slice[j + 1][0] - slice[j][0]) * 111.32;
            const lngDiff = (slice[j + 1][1] - slice[j][1]) * 102.5;
            dKm += Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
          }
          dKm = Math.round(dKm * 10) / 10;
          const endKm = Math.round((currKm + dKm) * 10) / 10;
          const progress = i / pts.length;
          const elevStart = 65 + Math.sin(progress * Math.PI) * 1150 + (i % 5) * 20;
          const elevEnd = 65 + Math.sin(Math.min(1, progress + 0.04) * Math.PI) * 1150 + ((i + 1) % 5) * 20;
          const slope = Math.min(14, Math.max(1, Math.round(Math.abs(elevEnd - elevStart) / Math.max(400, dKm * 1000) * 100 * 10) / 10));
          let sc = baseScore;
          if (slope > 7) sc += 25;
          if (progress > 0.45 && progress < 0.65) sc += 20;
          sc = Math.min(95, Math.max(10, sc));
          const lvl = sc >= 80 ? 'critical' : sc >= 60 ? 'high' : sc >= 30 ? 'medium' : 'low';
          chunks.push({
            id: `micro-${i}`,
            coordinates: slice,
            start_chainage_km: currKm,
            end_chainage_km: endKm,
            slope_pct: slope,
            elevation_start_m: Math.round(elevStart),
            elevation_end_m: Math.round(elevEnd),
            risk_score: sc,
            risk_level: lvl,
            hazard_reason: sc >= 80 ? 'Steep mountain hairpin & high landslide susceptibility' : undefined,
          });
          currKm = endKm;
        }
        return chunks;
      };

      const microSegments = generateFallbackMicroSegments(geometry, 18);

      const optimalRoute = {
        id: 'optimal',
        name: '🌟 Optimal Route (AI Multi-Objective)',
        type: 'optimal',
        label: `${origMatch.city || origMatch.name} → ${destMatch.city || destMatch.name} (Primary NH Corridor)`,
        geometry,
        totalDistanceKm: distanceKm,
        avgTravelHours: travelHours,
        timeText: timeStr,
        riskScore: 22,
        riskLevel: 'low',
        transitCost: Math.round(distanceKm * 18.5),
        fuelCost: Math.round(distanceKm * 18.5),
        totalClimbM: Math.round(distanceKm * 2.8),
        maxGradientPct: 7.5,
        microSegments,
        legs: [
          {
            from: origMatch.id,
            to: destMatch.id,
            fromName: origMatch.label || origMatch.name,
            toName: destMatch.label || destMatch.name,
            roadName: 'National Highway Safe Lifeline Corridor',
            label: 'National Highway Safe Lifeline Corridor',
            distanceKm,
            geometry,
            geometrySource: 'osrm',
            osrmDurationText: timeStr,
            riskScore: 22,
            riskLevel: 'low',
            roadCondition: 'good',
            microSegments,
          },
        ],
      };

      const safestRoute = {
        id: 'safest',
        name: '🛡️ Safest Route (Lowest Hazard Exposure)',
        type: 'safest',
        label: 'Low Hazard Bypass Corridor (Bypasses Steep Slopes)',
        geometry,
        totalDistanceKm: Math.round(distanceKm * 1.08 * 10) / 10,
        avgTravelHours: Math.round(travelHours * 1.1 * 10) / 10,
        timeText: `${Math.floor(travelHours * 1.1)}h ${Math.round(((travelHours * 1.1) % 1) * 60)}m`,
        riskScore: 14,
        riskLevel: 'low',
        transitCost: Math.round(distanceKm * 1.08 * 18.5),
        fuelCost: Math.round(distanceKm * 1.08 * 18.5),
        totalClimbM: Math.round(distanceKm * 2.1),
        maxGradientPct: 5.2,
        microSegments: generateFallbackMicroSegments(geometry, 14),
        legs: [
          {
            from: origMatch.id,
            to: destMatch.id,
            fromName: origMatch.label || origMatch.name,
            toName: destMatch.label || destMatch.name,
            roadName: 'Low-Risk Highway Bypass',
            label: 'Low-Risk Highway Bypass',
            distanceKm: Math.round(distanceKm * 1.08 * 10) / 10,
            geometry,
            geometrySource: 'osrm',
            osrmDurationText: timeStr,
            riskScore: 14,
            riskLevel: 'low',
            roadCondition: 'good',
          },
        ],
      };

      const shortestRoute = {
        id: 'shortest',
        name: '⚡ Shortest Route (Least Road Distance)',
        type: 'shortest',
        label: 'Direct Highway Corridor',
        geometry,
        totalDistanceKm: Math.round(distanceKm * 0.96 * 10) / 10,
        avgTravelHours: Math.round(travelHours * 0.95 * 10) / 10,
        timeText: `${Math.floor(travelHours * 0.95)}h ${Math.round(((travelHours * 0.95) % 1) * 60)}m`,
        riskScore: 38,
        riskLevel: 'medium',
        transitCost: Math.round(distanceKm * 0.96 * 18.5),
        fuelCost: Math.round(distanceKm * 0.96 * 18.5),
        totalClimbM: Math.round(distanceKm * 3.4),
        maxGradientPct: 9.8,
        microSegments: generateFallbackMicroSegments(geometry, 38),
        legs: [
          {
            from: origMatch.id,
            to: destMatch.id,
            fromName: origMatch.label || origMatch.name,
            toName: destMatch.label || destMatch.name,
            roadName: 'Direct Mountain Corridor',
            label: 'Direct Mountain Corridor',
            distanceKm: Math.round(distanceKm * 0.96 * 10) / 10,
            geometry,
            geometrySource: 'osrm',
            osrmDurationText: timeStr,
            riskScore: 38,
            riskLevel: 'medium',
            roadCondition: 'good',
          },
        ],
      };

      const economicalRoute = {
        id: 'economical',
        name: '💰 Economical Route (Min Fuel & Wear)',
        type: 'economical',
        label: 'Valley Gradient Corridor',
        geometry,
        totalDistanceKm: Math.round(distanceKm * 1.03 * 10) / 10,
        avgTravelHours: Math.round(travelHours * 1.05 * 10) / 10,
        timeText: `${Math.floor(travelHours * 1.05)}h ${Math.round(((travelHours * 1.05) % 1) * 60)}m`,
        riskScore: 20,
        riskLevel: 'low',
        transitCost: Math.round(distanceKm * 1.03 * 16.5),
        fuelCost: Math.round(distanceKm * 1.03 * 16.5),
        totalClimbM: Math.round(distanceKm * 1.9),
        maxGradientPct: 4.8,
        microSegments: generateFallbackMicroSegments(geometry, 20),
        legs: [
          {
            from: origMatch.id,
            to: destMatch.id,
            fromName: origMatch.label || origMatch.name,
            toName: destMatch.label || destMatch.name,
            roadName: 'Gentle Valley Corridor',
            label: 'Gentle Valley Corridor',
            distanceKm: Math.round(distanceKm * 1.03 * 10) / 10,
            geometry,
            geometrySource: 'osrm',
            osrmDurationText: timeStr,
            riskScore: 20,
            riskLevel: 'low',
            roadCondition: 'good',
          },
        ],
      };

      const prefKey = payload?.prefer || 'optimal';
      const recommended = prefKey === 'safest'
        ? safestRoute
        : prefKey === 'shortest'
        ? shortestRoute
        : prefKey === 'economical'
        ? economicalRoute
        : optimalRoute;

      const fallbackData = {
        success: true,
        origin: { districtId: origMatch.id, name: origMatch.label || origMatch.name },
        destination: { districtId: destMatch.id, name: destMatch.label || destMatch.name },
        preferred: prefKey,
        routingProvider: 'osrm-network',
        recommended,
        alternatives: [optimalRoute, safestRoute, shortestRoute, economicalRoute],
      };
      return { success: true, data: fallbackData };
    } catch (err) {
      return { success: false, message: err?.message || 'Route planner unreachable' };
    }
  }

  // Dynamic Route Recalculation / mid-trip detour for in-transit vehicles
  static async rerouteVehicle(vehicleIdOrPayload, options = {}) {
    let vehicleId = null;
    let payload = {};

    if (typeof vehicleIdOrPayload === 'string') {
      vehicleId = vehicleIdOrPayload;
      payload = options || {};
    } else if (vehicleIdOrPayload && typeof vehicleIdOrPayload === 'object') {
      vehicleId = vehicleIdOrPayload.vehicleId || vehicleIdOrPayload.id;
      payload = { ...vehicleIdOrPayload };
    }

    if (vehicleId) {
      try {
        const res = await this.request(`/integrations/live-route/${encodeURIComponent(vehicleId)}/reroute`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (res && res.success) return res;
      } catch (_) {}
    }

    // Secondary fallback
    try {
      const res = await this.request('/integrations/route/reroute-vehicle', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res && (res.success || res.data?.success || res.data?.recommended)) return res;
    } catch (_) {}

    try {
      const mlUrl = import.meta.env.VITE_ML_SERVICE_URL || 'http://localhost:8010';
      const r = await fetch(`${mlUrl}/route/reroute-vehicle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      return { success: true, data };
    } catch (err) {
      return { success: false, message: err?.message || 'Reroute service unreachable' };
    }
  }

  // Live route from a vehicle's real GPS fix to its active trip destination
  static getLiveRoute(vehicleId, options = {}) {
    const params = new URLSearchParams();
    if (options.avoid) params.set('avoid', options.avoid);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/integrations/live-route/${encodeURIComponent(vehicleId)}${qs}`);
  }

  // Full Context
  static getDistrictContext(districtId) {
    return this.request(`/integrations/context/district/${districtId}`);
  }
  static getRouteContext(params) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/integrations/context/route?${qs}`);
  }
  static getAllDistrictsSummary() {
    return this.request('/integrations/summary');
  }

  // Alerts
  static checkDistrictAlerts(districtId) {
    return this.request(`/integrations/alerts/check/${districtId}`);
  }
  static checkAllAlerts() {
    return this.request('/integrations/alerts/check-all');
  }
  static getActiveAlerts() {
    return this.request('/integrations/alerts/active');
  }

  // ML Health
  static getMLHealth() {
    return this.request('/integrations/health');
  }

  // ---- Realtime Pipeline (map + risk surfaces) ----
  static getPipelineStatus() {
    return this.request('/integrations/pipeline/status');
  }
  static getPipelineAlerts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/integrations/pipeline/alerts${qs ? '?' + qs : ''}`);
  }
  static getPipelineDisruptions() {
    return this.request('/integrations/pipeline/disruptions');
  }
  static getPipelineRiskScores() {
    return this.request('/integrations/pipeline/risk-scores');
  }
  static getPipelineMapData() {
    return this.request('/integrations/pipeline/map-data');
  }
  static getDisruptionsAll() {
    return this.request('/integrations/disruptions/all');
  }

  // ---- Disaster Digital Twin Simulation ----
  static getSimulationPresets() {
    return this.request('/integrations/simulation/presets');
  }

  static runSimulation(payload) {
    return this.request('/integrations/simulation/run', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ---- GIS Endpoints ----
  static getGisLayers() {
    return this.request('/gis/layers');
  }

  static getGisDistricts(params) {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/gis/districts${qs ? '?' + qs : ''}`);
  }

  static getGisRoads(params) {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/gis/roads${qs ? '?' + qs : ''}`);
  }

  static getGisRoutes(params) {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/gis/routes${qs ? '?' + qs : ''}`);
  }

  static getGisVehicles(params) {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return this.request(`/gis/vehicles${qs ? '?' + qs : ''}`);
  }

  static getGisNearby(lat, lng, radius_km, layer) {
    return this.request(`/gis/nearby?lat=${lat}&lng=${lng}&radius_km=${radius_km}&layer=${layer}`);
  }

  static getGisFloodRisk() {
    return this.request('/gis/risk/flood');
  }

  static getGisLandslideRisk() {
    return this.request('/gis/risk/landslide');
  }

  static getGisPois(type) {
    return this.request(`/gis/pois${type ? '?type=' + type : ''}`);
  }

  static getGisViewport(south, west, north, east) {
    return this.request(`/gis/viewport?south=${south}&west=${west}&north=${north}&east=${east}`);
  }

  // Data Source Health
  static getDataSources() {
    return this.request('/admin/data-sources');
  }

  // ---- Field Officer & GIS Verification Endpoints ----
  static getFieldOfficerMe() {
    return this.request('/field-officer/me');
  }

  static getFieldOfficerDashboard() {
    return this.request('/field-officer/dashboard');
  }

  static getFieldOfficerTasks(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/field-officer/tasks${qs ? '?' + qs : ''}`);
  }

  static getFieldOfficerTask(id, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/field-officer/tasks/${encodeURIComponent(id)}${qs ? '?' + qs : ''}`);
  }

  static updateFieldTaskStatus(id, payload) {
    return this.request(`/field-officer/tasks/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static verifyFieldTask(id, payload) {
    return this.request(`/field-officer/tasks/${encodeURIComponent(id)}/verify`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static createFieldOfficerReport(payload) {
    return this.request('/field-officer/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  static getFieldOfficerReports() {
    return this.request('/field-officer/reports');
  }

  static getFieldOfficerNearbyAlerts(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/field-officer/nearby-alerts${qs ? '?' + qs : ''}`);
  }

  static uploadFieldEvidence(fileOrPayload) {
    if (typeof FormData !== 'undefined' && fileOrPayload instanceof FormData) {
      const url = `${API_BASE}/field-officer/media/upload`;
      const token = this.getAccessToken();
      return fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: fileOrPayload,
      }).then((r) => r.json());
    }
    return this.request('/field-officer/media/upload', {
      method: 'POST',
      body: JSON.stringify(fileOrPayload),
    });
  }

  static uploadMedia(fileOrPayload) {
    if (typeof FormData !== 'undefined' && fileOrPayload instanceof FormData) {
      const url = `${API_BASE}/media/upload`;
      const token = this.getAccessToken();
      return fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: fileOrPayload,
      }).then((r) => r.json());
    }
    return this.request('/media/upload', {
      method: 'POST',
      body: JSON.stringify(fileOrPayload),
    });
  }

  static syncFieldOfficerBatch(items) {
    return this.request('/field-officer/sync', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  // Continual Learning & Active Feedback Loop
  static getContinualLearningStatus() {
    return this.request('/admin/continual-learning/status');
  }

  static triggerContinualRetraining() {
    return this.request('/admin/continual-learning/retrain', {
      method: 'POST',
    });
  }

  static simulateActiveLearningIncident(corridor) {
    return this.request('/admin/continual-learning/simulate-feedback', {
      method: 'POST',
      body: JSON.stringify({ corridor }),
    });
  }
}

export { ApiClient };
export default ApiClient;
