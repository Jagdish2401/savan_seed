import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'https://savan-seeds.onrender.com';

export const api = axios.create({
  baseURL,
  withCredentials: true,
});
