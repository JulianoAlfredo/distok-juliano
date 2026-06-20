import axios from 'axios';

/**
 * Client HTTP central. Injeta o JWT e trata 401 (sessão expirada).
 *
 * baseURL:
 *  - dev: usa '/api/v1' (o Vite faz proxy para http://localhost:3000 — ver vite.config.ts)
 *  - produção: defina VITE_API_URL no build (ex.: https://api.distok.com.br/api/v1).
 *    Se a API for servida no MESMO domínio do front (via proxy/.htaccess), mantenha '/api/v1'.
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
});

const TOKEN_KEY = 'distok_token';

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      setToken(null);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);
