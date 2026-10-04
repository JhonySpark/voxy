import axios from 'axios';
import { AppRoutes, StorageKeys } from './core/enums';

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

import { logger } from './core/services/logger.service';

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url ?? '';
    const method = error.config?.method?.toUpperCase() ?? 'GET';

    // Loga erros de servidor (>= 500) ou falha total de rede para Better Stack
    if (!status || status >= 500) {
      logger.error(`API Error: ${method} ${requestUrl} [${status || 'NETWORK_ERROR'}]`, error, {
        url: requestUrl,
        method,
        status: status || 0,
        responseData: error.response?.data,
      });
    }

    // Apenas 401 significa que a credencial deixou de ser aceita. Erros de rede,
    // servidor ou permissão em um recurso específico não devem encerrar a sessão.
    const isUnauthorized = status === 401;
    const isAuthenticationRequest = requestUrl.startsWith('/auth/login') || requestUrl.startsWith('/auth/register');

    if (isUnauthorized && !isAuthenticationRequest) {
      localStorage.removeItem(StorageKeys.AUTH_TOKEN);

      // O HashRouter reage à alteração do hash sem recarregar a janela do Electron.
      if (window.location.hash !== `#${AppRoutes.LOGIN}`) {
        window.location.hash = AppRoutes.LOGIN;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
