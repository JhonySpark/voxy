import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n';
import App from './App.tsx';
import { GlobalErrorBoundary } from './components/common/ErrorBoundary/GlobalErrorBoundary';
import { logger } from './core/services/logger.service';

// Captura erros globais não tratados na janela do navegador / Electron
window.addEventListener('error', (event) => {
  logger.error('Unhandled Window Error', event.error || event.message, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled Promise Rejection', event.reason, {
    reason: String(event.reason),
  });
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);

