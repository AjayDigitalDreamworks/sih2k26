import axios from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const resolveBackendUrl = (): string => {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    return process.env.EXPO_PUBLIC_BACKEND_URL;
  }
  if (Platform.OS === 'web') {
    return 'https://backendcoreapp.onrender.com';
  }
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `https://backendcoreapp.onrender.com`;
    }
  }
  if (Platform.OS === 'android') {
    return 'https://backendcoreapp.onrender.com';
  }
  return 'https://backendcoreapp.onrender.com';
};

export const BACKEND_URL = resolveBackendUrl();
export const API_BASE_URL = `${BACKEND_URL}/api`;

let cachedAccessToken: string | null = null;
let cachedRefreshToken: string | null = null;

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (key.includes('access') && cachedAccessToken) return cachedAccessToken;
      if (key.includes('refresh') && cachedRefreshToken) return cachedRefreshToken;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          const val = window.localStorage.getItem(key);
          if (val) {
            if (key.includes('access')) cachedAccessToken = val;
            if (key.includes('refresh')) cachedRefreshToken = val;
            return val;
          }
        }
        return null;
      }
      const val = await SecureStore.getItemAsync(key);
      if (val) {
        if (key.includes('access')) cachedAccessToken = val;
        if (key.includes('refresh')) cachedRefreshToken = val;
      }
      return val;
    } catch { return null; }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (key.includes('access')) cachedAccessToken = value;
      if (key.includes('refresh')) cachedRefreshToken = value;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch {}
  },
  async removeItem(key: string): Promise<void> {
    try {
      if (key.includes('access')) cachedAccessToken = null;
      if (key.includes('refresh')) cachedRefreshToken = null;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
        return;
      }
      await SecureStore.deleteItemAsync(key);
    } catch {}
  },
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 25000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await storage.getItem('ner_access_token') || await storage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await storage.getItem('ner_refresh_token') || await storage.getItem('refreshToken');
        if (refreshToken) {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          if (res.data?.success && res.data?.data?.accessToken) {
            const newAccess = res.data.data.accessToken;
            const newRefresh = res.data.data.refreshToken || refreshToken;
            await storage.setItem('ner_access_token', newAccess);
            await storage.setItem('ner_refresh_token', newRefresh);
            originalRequest.headers.Authorization = `Bearer ${newAccess}`;
            return apiClient(originalRequest);
          }
        }
      } catch {}
      await storage.removeItem('ner_access_token');
      await storage.removeItem('ner_refresh_token');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
