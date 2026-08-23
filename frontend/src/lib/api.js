import axios from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? 'https://savan-seeds.onrender.com' : '');
// Default to same-origin in dev, fallback to Render backend in production
const baseURL = rawBaseUrl ? String(rawBaseUrl).replace(/\/+$/, '') : '';

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
