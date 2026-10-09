import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
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
  avatarUrl?: string | null;
}

interface ToastContextData {
  showToast: (options: {
    type: ToastType | ToastTypeEnum;
    message: string;
    title?: string;
    duration?: number;
    avatarUrl?: string | null;
  }) => void;
  toast: {
    success: (message: string, title?: string, avatarUrl?: string | null) => void;
    error: (message: string, title?: string) => void;
    warning: (message: string, title?: string, avatarUrl?: string | null) => void;
    info: (message: string, title?: string, avatarUrl?: string | null) => void;
  };
}

const ToastContext = createContext<ToastContextData | null>(null);

const ToastIcon: React.FC<{ item: ToastItem }> = ({ item }) => {
  const [imgError, setImgError] = useState(false);

  if (item.avatarUrl && !imgError) {
    return (
      <img
        src={item.avatarUrl}
        alt=""
        className={styles.avatar}
        onError={() => setImgError(true)}
      />
    );
  }

  switch (item.type) {
    case 'success':
      return <CheckCircle2 size={18} />;
    case 'error':
      return <AlertCircle size={18} />;
    case 'warning':
      return <AlertTriangle size={18} />;
    case 'info':
    default:
      return <Info size={18} />;
  }
};

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
    ({
      type,
      message,
      title,
      duration = 4000,
      avatarUrl,
    }: {
      type: ToastType | ToastTypeEnum;
      message: string;
      title?: string;
      duration?: number;
      avatarUrl?: string | null;
    }) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, type, message, title, duration, avatarUrl };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toast = useMemo(
    () => ({
      success: (message: string, title?: string, avatarUrl?: string | null) =>
        showToast({ type: 'success', message, title: title || 'Sucesso', avatarUrl }),
      error: (message: string, title?: string) =>
        showToast({ type: 'error', message, title: title || 'Atenção' }),
      warning: (message: string, title?: string, avatarUrl?: string | null) =>
        showToast({ type: 'warning', message, title: title || 'Aviso', avatarUrl }),
      info: (message: string, title?: string, avatarUrl?: string | null) =>
        showToast({ type: 'info', message, title: title || 'Informação', avatarUrl }),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      <div className={styles.toastContainer}>
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`${styles.toast} ${styles[item.type]} ${item.isExiting ? styles.exiting : ''}`}
          >
            <div className={styles.iconWrapper}>
              <ToastIcon item={item} />
            </div>
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
