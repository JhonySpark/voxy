import React, { createContext, useContext, useState, useCallback } from 'react';
import styles from './Toast.module.css';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastTypeEnum } from '../../../core/enums';

export type ToastType = ToastTypeEnum;

export interface ToastItem {
  id: string;
  type: ToastType | ToastTypeEnum;
  title?: string;
  message: string;
  duration?: number;
  isExiting?: boolean;
}

interface ToastContextData {
  showToast: (options: { type: ToastType | ToastTypeEnum; message: string; title?: string; duration?: number }) => void;
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
  };
}


const ToastContext = createContext<ToastContextData | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const showToast = useCallback(
    ({ type, message, title, duration = 4000 }: { type: ToastType; message: string; title?: string; duration?: number }) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, type, message, title, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toast = {
    success: (message: string, title?: string) => showToast({ type: 'success', message, title: title || 'Sucesso' }),
    error: (message: string, title?: string) => showToast({ type: 'error', message, title: title || 'Atenção' }),
    warning: (message: string, title?: string) => showToast({ type: 'warning', message, title: title || 'Aviso' }),
    info: (message: string, title?: string) => showToast({ type: 'info', message, title: title || 'Informação' }),
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} />;
      case 'error':
        return <AlertCircle size={18} />;
      case 'warning':
        return <AlertTriangle size={18} />;
      case 'info':
        return <Info size={18} />;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      <div className={styles.toastContainer}>
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`${styles.toast} ${styles[item.type]} ${item.isExiting ? styles.exiting : ''}`}
          >
            <div className={styles.iconWrapper}>{getIcon(item.type)}</div>
            <div className={styles.content}>
              {item.title && <div className={styles.title}>{item.title}</div>}
              <div className={styles.message}>{item.message}</div>
            </div>
            <button
              className={styles.closeButton}
              onClick={() => removeToast(item.id)}
              aria-label="Fechar notificação"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
