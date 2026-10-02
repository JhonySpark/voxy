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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Apenas 401 significa que a credencial deixou de ser aceita. Erros de rede,
    // servidor ou permissÃ£o em um recurso especÃ­fico nÃ£o devem encerrar a sessÃ£o.
    const isUnauthorized = error.response?.status === 401;
    const requestUrl = error.config?.url ?? '';
    const isAuthenticationRequest = requestUrl.startsWith('/auth/login') || requestUrl.startsWith('/auth/register');

    if (isUnauthorized && !isAuthenticationRequest) {
      localStorage.removeItem(StorageKeys.AUTH_TOKEN);

      // O HashRouter reage Ã  alteraÃ§Ã£o do hash sem recarregar a janela do Electron.
      if (window.location.hash !== `#${AppRoutes.LOGIN}`) {
        window.location.hash = AppRoutes.LOGIN;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
