export const gisApi = {
  async getRoutes(): Promise<any> {
    const { apiClient } = await import('./client');
    try {
      const res = await apiClient.get('/gis/routes');
      return res.data?.data || res.data;
    } catch { return { features: [] }; }
  },
  async getDistricts(): Promise<any[]> {
    const { apiClient } = await import('./client');
    try {
      const res = await apiClient.get('/gis/districts');
      return res.data?.data || res.data || [];
    } catch { return []; }
  },
  async getNearby(lat: number, lng: number, radiusKm: number = 25, layer?: string): Promise<any> {
    const { apiClient } = await import('./client');
    try {
      const params: any = { lat, lng, radius_km: radiusKm };
      if (layer) params.layer = layer;
      const res = await apiClient.get('/gis/nearby', { params });
      return res.data?.data || res.data;
    } catch { return null; }
  },
  async getFloodRisk(): Promise<any> {
    const { apiClient } = await import('./client');
    try {
      const res = await apiClient.get('/gis/risk/flood');
      return res.data?.data || res.data;
    } catch { return null; }
  },
  async getLandslideRisk(): Promise<any> {
    const { apiClient } = await import('./client');
    try {
      const res = await apiClient.get('/gis/risk/landslide');
      return res.data?.data || res.data;
    } catch { return null; }
  },
  async getVehicles(): Promise<any[]> {
    const { apiClient } = await import('./client');
    try {
      const res = await apiClient.get('/gis/vehicles');
      return res.data?.data || res.data || [];
    } catch { return []; }
  },
};

export default gisApi;
