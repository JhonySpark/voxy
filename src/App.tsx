import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import { ToastProvider } from './components/common/Toast/ToastContext';
import { DialogProvider } from './components/common/Dialog/DialogContext';
import { UpdateNotification } from './components/UpdateNotification';
import { AppRoutes, StorageKeys, IpcChannels } from './core/enums';
import './index.css';

function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      const existingToken = localStorage.getItem(StorageKeys.AUTH_TOKEN);
      if (!existingToken) {
        // Tenta recuperar sessão persistida do cofre nativo do Electron (ex: após atualização)
        const ipcRenderer =
          typeof window !== 'undefined' && window.require
            ? window.require('electron').ipcRenderer
            : null;
        if (ipcRenderer) {
          try {
            const saved = await ipcRenderer.invoke(IpcChannels.GET_SAVED_CREDENTIALS);
            if (saved?.token) {
              localStorage.setItem(StorageKeys.AUTH_TOKEN, saved.token);
            }
          } catch (_) {}
        }
      }
      setIsInitialized(true);
    };

    initializeAuth();
  }, []);

  const hasToken = () => !!localStorage.getItem(StorageKeys.AUTH_TOKEN);

  if (!isInitialized) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          backgroundColor: '#0b0e14',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div className="btn-spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <ToastProvider>
      <DialogProvider>
        <HashRouter>
          <UpdateNotification />
          <Routes>
            <Route path={AppRoutes.LOGIN} element={<Login />} />
            <Route path={AppRoutes.REGISTER} element={<Register />} />
            <Route path={AppRoutes.APP} element={<Dashboard />} />
            <Route path={AppRoutes.ROOT} element={<Navigate to={hasToken() ? AppRoutes.APP : AppRoutes.LOGIN} replace />} />
            <Route path="*" element={<Navigate to={hasToken() ? AppRoutes.APP : AppRoutes.LOGIN} replace />} />
          </Routes>
        </HashRouter>
      </DialogProvider>
    </ToastProvider>
  );
}

export default App;

