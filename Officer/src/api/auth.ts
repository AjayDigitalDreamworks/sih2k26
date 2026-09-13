import { apiClient, storage } from './client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  districtId?: string | null;
  transporterId?: string | null;
  agency?: string | null;
  phone?: string | null;
}

export interface LoginResponseData {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  async login(identifier: string, password: string): Promise<LoginResponseData> {
    const res = await apiClient.post('/auth/login', { email: identifier.trim(), password });
    const data: LoginResponseData = res.data?.data || res.data;
    if (data?.accessToken) await storage.setItem('ner_access_token', data.accessToken);
    if (data?.refreshToken) await storage.setItem('ner_refresh_token', data.refreshToken);
    return data;
  },
  async logout(): Promise<void> {
    try { await apiClient.post('/auth/logout'); } catch {}
    finally {
      await storage.removeItem('ner_access_token');
      await storage.removeItem('ner_refresh_token');
    }
  },
  async getMe(): Promise<AuthUser> {
    const res = await apiClient.get('/auth/me');
    return res.data?.data || res.data;
  },
};
