import axios from 'axios';
import { AppRoutes, StorageKeys, ApiRoutes, IpcChannels } from './core/enums';
import { logger } from './core/services/logger.service';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(StorageKeys.AUTH_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function getStoredCredentials(): Promise<{ email?: string; password?: string } | null> {
  const ipcRenderer =
    typeof window !== 'undefined' && window.require
      ? window.require('electron').ipcRenderer
      : null;

  if (ipcRenderer) {
    try {
      const creds = await ipcRenderer.invoke(IpcChannels.GET_SAVED_CREDENTIALS);
      if (creds?.email && creds?.password) {
        return creds;
      }
    } catch (_) {}
  }

  const email = localStorage.getItem(StorageKeys.SAVED_EMAIL);
  const password = localStorage.getItem(StorageKeys.SAVED_PASSWORD);
  if (email && password) {
    return { email, password };
  }

  return null;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url ?? '';
    const method = originalRequest?.method?.toUpperCase() ?? 'GET';

    // Loga erros de servidor (>= 500) ou falha total de rede para Better Stack
    if (!status || status >= 500) {
      logger.error(`API Error: ${method} ${requestUrl} [${status || 'NETWORK_ERROR'}]`, error, {
        url: requestUrl,
        method,
        status: status || 0,
        responseData: error.response?.data,
      });
    }

    const isUnauthorized = status === 401;
    const isAuthenticationRequest =
      requestUrl.startsWith('/auth/login') ||
      requestUrl.startsWith('/auth/register');

    if (isUnauthorized && !isAuthenticationRequest && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      // Se já houver uma renovação em andamento, aguarda e reutiliza o novo token
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((newToken: string) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;

      try {
        const creds = await getStoredCredentials();
        if (creds?.email && creds?.password) {
          // Re-autentica de forma transparente em background
          const loginRes = await axios.post(
            `${import.meta.env.VITE_API_URL}${ApiRoutes.AUTH_LOGIN}`,
            { email: creds.email, password: creds.password },
          );

          const newToken = loginRes.data?.access_token;
          if (newToken) {
            localStorage.setItem(StorageKeys.AUTH_TOKEN, newToken);

            const ipcRenderer =
              typeof window !== 'undefined' && window.require
                ? window.require('electron').ipcRenderer
                : null;
            if (ipcRenderer) {
              try {
                await ipcRenderer.invoke(IpcChannels.SAVE_CREDENTIALS, {
                  email: creds.email,
                  password: creds.password,
                  token: newToken,
                  rememberMe: true,
                });
              } catch (_) {}
            }

            onRefreshed(newToken);
            isRefreshing = false;

            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          }
        }
      } catch (refreshErr) {
        logger.warn('Silent re-login failed', { error: (refreshErr as any)?.message });
      } finally {
        isRefreshing = false;
      }

      // Se a re-autenticação falhou totalmente (ex: senha alterada ou conta suspensa), limpa a sessão
      localStorage.removeItem(StorageKeys.AUTH_TOKEN);
      if (window.location.hash !== `#${AppRoutes.LOGIN}`) {
        window.location.hash = AppRoutes.LOGIN;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
