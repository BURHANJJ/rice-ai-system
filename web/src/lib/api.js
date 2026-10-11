import axios from 'axios';
import { auth } from './firebase';

export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

const api = axios.create({ baseURL: API_BASE });

// The backend verifies the signed-in user's Firebase ID token on every call.
api.interceptors.request.use(async (config) => {
  const token = await auth.currentUser?.getIdToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
