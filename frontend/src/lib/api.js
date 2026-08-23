import axios from 'axios';

function getSanitizedBaseUrl() {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string') {
    // Clean out any accidental trailing comments or spaces (e.g. "// backend")
    const cleaned = envUrl.split(/\s+|\/\/|#/)[0].trim().replace(/\/+$/, '');
    if (cleaned.startsWith('http')) return cleaned;
  }
  if (import.meta.env.PROD) {
    return 'https://savan-seeds.onrender.com';
  }
  return '';
}

const baseURL = getSanitizedBaseUrl();

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
