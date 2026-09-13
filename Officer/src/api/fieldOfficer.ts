import { apiClient } from './client';

export const fieldOfficerApi = {
  async getMe(): Promise<any> {
    const res = await apiClient.get('/field-officer/me');
    return res.data?.data || res.data;
  },
  async getDashboard(): Promise<any> {
    const res = await apiClient.get('/field-officer/dashboard');
    return res.data?.data || res.data;
  },
  async getTasks(params?: Record<string, string>): Promise<any[]> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await apiClient.get('/field-officer/tasks' + query);
    return res.data?.data || res.data || [];
  },
  async getTask(id: string): Promise<any> {
    const res = await apiClient.get('/field-officer/tasks/' + encodeURIComponent(id));
    return res.data?.data || res.data;
  },
  async updateTaskStatus(id: string, payload: any): Promise<any> {
    const res = await apiClient.post('/field-officer/tasks/' + encodeURIComponent(id) + '/status', payload);
    return res.data?.data || res.data;
  },
  async verifyTask(id: string, payload: any): Promise<any> {
    const res = await apiClient.post('/field-officer/tasks/' + encodeURIComponent(id) + '/verify', payload);
    return res.data?.data || res.data;
  },
  async createReport(payload: any): Promise<any> {
    const res = await apiClient.post('/field-officer/reports', payload);
    return res.data?.data || res.data;
  },
  async getReports(): Promise<any[]> {
    const res = await apiClient.get('/field-officer/reports');
    return res.data?.data || res.data || [];
  },
  async getNearbyAlerts(params?: Record<string, string>): Promise<any[]> {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    const res = await apiClient.get('/field-officer/nearby-alerts' + query);
    return res.data?.data || res.data || [];
    const d = res.data?.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.hazards)) return d.hazards;
    if (Array.isArray(d?.alerts)) return d.alerts;
    if (Array.isArray(res.data?.hazards)) return res.data.hazards;
    if (Array.isArray(res.data)) return res.data;
    return [];
  },
  async uploadEvidence(fileOrPayload: any): Promise<any> {
    if (typeof FormData !== 'undefined' && fileOrPayload instanceof FormData) {
      const token =
        (typeof window !== 'undefined' && window.localStorage.getItem('ner_access_token'));
      const url = apiClient.defaults.baseURL + '/field-officer/media/upload';
      return fetch(url, {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: fileOrPayload,
      }).then(r => r.json());
    }
    return apiClient.post('/field-officer/media/upload', fileOrPayload).then(r => r.data);
  },
  async syncBatch(items: any[]): Promise<any> {
    const res = await apiClient.post('/field-officer/sync', { items });
    return res.data?.data || res.data;
  },
};

export default fieldOfficerApi;
