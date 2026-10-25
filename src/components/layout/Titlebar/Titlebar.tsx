import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTitlebar } from '../../../contexts/TitlebarContext';
import { IpcChannels } from '../../../core/enums';
import styles from './Titlebar.module.css';

const getElectronIpc = () => {
  if (typeof window !== 'undefined' && (window as unknown as { require?: (mod: string) => { ipcRenderer: unknown } }).require) {
    try {
      const electron = (window as unknown as { require: (mod: string) => { ipcRenderer: {
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
        on: (channel: string, listener: (...args: unknown[]) => void) => void;
        removeAllListeners: (channel: string) => void;
      } } }).require('electron');
      return electron.ipcRenderer;
    } catch (_) {
      return null;
    }
  }
  return null;
};

export const Titlebar: React.FC = () => {
  const location = useLocation();
  const { customTitle } = useTitlebar();
  const [isMaximized, setIsMaximized] = useState(false);

  // Determina dinamicamente o nome da tela centralizado
  const resolvedScreenTitle = useMemo(() => {
    if (customTitle && customTitle.trim().length > 0) {
      return customTitle;
    }

    const path = location.pathname.toLowerCase();
    if (path.includes('/login')) {
      return 'Entrar';
    }
    if (path.includes('/register')) {
      return 'Criar Conta';
    }
    if (path.includes('/app')) {
      return 'Chat';
    }
    return 'Voxy Chat';
  }, [customTitle, location.pathname]);

  useEffect(() => {
    const ipc = getElectronIpc();
    if (!ipc) return;

    // Checa estado inicial de maximizado
    void ipc.invoke(IpcChannels.WINDOW_IS_MAXIMIZED).then((maximized) => {
      setIsMaximized(!!maximized);
    });

    const handleMaximizeChange = (_event: unknown, maximized: unknown) => {
      setIsMaximized(!!maximized);
    };

    ipc.on(IpcChannels.WINDOW_MAXIMIZE_CHANGE, handleMaximizeChange);

    return () => {
      ipc.removeAllListeners(IpcChannels.WINDOW_MAXIMIZE_CHANGE);
    };
  }, []);

  const handleMinimize = useCallback(() => {
    const ipc = getElectronIpc();
    if (ipc) {
      void ipc.invoke(IpcChannels.WINDOW_MINIMIZE);
    }
  }, []);

  const handleMaximize = useCallback(() => {
    const ipc = getElectronIpc();
    if (ipc) {
      void ipc.invoke(IpcChannels.WINDOW_MAXIMIZE).then((max) => {
        setIsMaximized(!!max);
      });
    } else {
      // Fallback para navegador web (Fullscreen)
      if (!document.fullscreenElement) {
        void document.documentElement.requestFullscreen?.();
        setIsMaximized(true);
      } else {
        void document.exitFullscreen?.();
        setIsMaximized(false);
      }
    }
  }, []);

  const handleClose = useCallback(() => {
    const ipc = getElectronIpc();
    if (ipc) {
      void ipc.invoke(IpcChannels.WINDOW_CLOSE);
    } else {
      window.close();
    }
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    // Apenas se o clique não for nos botões de controle
    if ((e.target as HTMLElement).closest(`.${styles.controlsSection}`)) {
      return;
    }
    handleMaximize();
  }, [handleMaximize]);

  return (
    <header className={styles.titlebar} onDoubleClick={handleDoubleClick}>
      {/* Esquerda: Apenas o texto "Voxy Chat" sem qualquer ícone */}
      <div className={styles.leftSection}>
        <span className={styles.brandTitle}>Voxy Chat</span>
      </div>

      {/* Centro: Nome da tela ativa */}
      <div className={styles.centerSection}>
        <span className={styles.screenTitle}>{resolvedScreenTitle}</span>
      </div>

      {/* Direita: Ícones próprios para Minimizar, Maximizar/Restaurar e Fechar */}
      <div className={styles.controlsSection}>
        <button
          type="button"
          className={styles.controlButton}
          onClick={handleMinimize}
          title="Minimizar"
          aria-label="Minimizar"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.5 6H10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          className={styles.controlButton}
          onClick={handleMaximize}
          title={isMaximized ? "Restaurar" : "Maximizar"}
          aria-label={isMaximized ? "Restaurar" : "Maximizar"}
        >
          {isMaximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3.75 2.5H9.5C10.05 2.5 10.5 2.95 10.5 3.5V9.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <rect x="1.5" y="3.75" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          )}
        </button>

        <button
          type="button"
          className={`${styles.controlButton} ${styles.closeButton}`}
          onClick={handleClose}
          title="Fechar"
          aria-label="Fechar"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  );
};
