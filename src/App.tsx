import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import { ToastProvider } from './components/common/Toast/ToastContext';
import { DialogProvider } from './components/common/Dialog/DialogContext';
import { AppRoutes, StorageKeys } from './core/enums';
import './index.css';

function App() {
  const hasToken = () => !!localStorage.getItem(StorageKeys.AUTH_TOKEN);

  return (
    <ToastProvider>
      <DialogProvider>
        <HashRouter>
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

