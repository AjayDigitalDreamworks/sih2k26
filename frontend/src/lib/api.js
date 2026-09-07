// API Client for Raahi Core Backend

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
        ...options,
        headers,
      });

      // Handle 401 & attempt token refresh once
      if (response.status === 401 && !options._retry) {
        const refreshToken = this.getRefreshToken();
        if (refreshToken) {
          try {
            const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
              method: 'POST',
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
            this.clearTokens();
          }
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
      body: JSON.stringify({ reason }),
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

  static getSupplyChainGaps() {
    return this.request('/admin/supply-chain/gaps');
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

  static getTransporterDeliveries() {
    return this.request('/transporter/deliveries');
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

  static getTransporterAlerts() {
    return this.request('/transporter/alerts');
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
      const r = await fetch(`${mlUrl}/route/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      return { success: true, data };
    } catch (err) {
      return { success: false, message: err?.message || 'Route planner unreachable' };
    }
  }

  // Live route from a vehicle's real GPS fix to its active trip destination
  static getLiveRoute(vehicleId) {
    return this.request(`/integrations/live-route/${encodeURIComponent(vehicleId)}`);
  }

  // Dynamic Route Recalculation for an in-transit vehicle
  static rerouteVehicle(vehicleId, options = {}) {
    return this.request(`/integrations/live-route/${encodeURIComponent(vehicleId)}/reroute`, {
      method: 'POST',
      body: JSON.stringify(options),
    });
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
}

export default ApiClient;
