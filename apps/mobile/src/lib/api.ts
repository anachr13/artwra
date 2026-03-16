import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { supabase } from './supabase';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor: attach Supabase JWT
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }

    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// Response interceptor: handle 401 → sign out
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut();
      // Auth store will detect session change via onAuthStateChange
    }
    return Promise.reject(error);
  }
);

export default api;
