import axios from 'axios';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;
// Default to same-origin so cookies work (dev proxy and reverse-proxy deployments)
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
