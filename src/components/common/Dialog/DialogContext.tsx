import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import styles from './Dialog.module.css';
import { AlertTriangle, HelpCircle, Trash2, Edit3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  icon?: React.ReactNode;
}

export interface PromptDialogOptions {
  title?: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  inputType?: string;
}

interface DialogContextData {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  prompt: (options: PromptDialogOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextData | null>(null);

type DialogState =
  | {
      type: 'confirm';
      options: ConfirmDialogOptions;
      resolve: (value: boolean) => void;
    }
  | {
      type: 'prompt';
      options: PromptDialogOptions;
      resolve: (value: string | null) => void;
    };

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [currentDialog, setCurrentDialog] = useState<DialogState | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setCurrentDialog({
        type: 'confirm',
        options,
        resolve,
      });
    });
  }, []);

  const prompt = useCallback((options: PromptDialogOptions): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(options.defaultValue || '');
      setCurrentDialog({
        type: 'prompt',
        options,
        resolve,
      });
    });
  }, []);

  useEffect(() => {
    if (currentDialog?.type === 'prompt') {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [currentDialog]);

  const handleClose = () => {
    if (!currentDialog) return;
    if (currentDialog.type === 'confirm') {
      currentDialog.resolve(false);
    } else {
      currentDialog.resolve(null);
    }
    setCurrentDialog(null);
  };

  const handleConfirmAction = () => {
    if (!currentDialog) return;
    if (currentDialog.type === 'confirm') {
      currentDialog.resolve(true);
    } else {
      currentDialog.resolve(promptValue);
    }
    setCurrentDialog(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      handleClose();
    } else if (e.key === 'Enter' && currentDialog?.type === 'prompt') {
      e.stopPropagation();
      e.preventDefault();
      handleConfirmAction();
    }
  };

  const renderIcon = (options: ConfirmDialogOptions) => {
    if (options.icon) return options.icon;
    const variant = options.variant || 'primary';
    if (variant === 'danger') {
      return <Trash2 size={20} />;
    }
    if (variant === 'warning') {
      return <AlertTriangle size={20} />;
    }
    return <HelpCircle size={20} />;
  };

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}

      {currentDialog && (
        <div className={styles.overlay} onClick={handleClose} onKeyDown={handleKeyDown}>
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {currentDialog.type === 'confirm' ? (
              <>
                <div className={styles.header}>
                  <div
                    className={`${styles.iconWrapper} ${
                      currentDialog.options.variant === 'danger'
                        ? styles.iconDanger
                        : currentDialog.options.variant === 'warning'
                        ? styles.iconWarning
                        : styles.iconPrimary
                    }`}
                  >
                    {renderIcon(currentDialog.options)}
                  </div>
                  <div className={styles.headerText}>
                    <h3 className={styles.title}>
                      {currentDialog.options.title || t('common.confirmation', 'Confirmação')}
                    </h3>
                    <p className={styles.message}>{currentDialog.options.message}</p>
                  </div>
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.cancelBtn} onClick={handleClose}>
                    {currentDialog.options.cancelText || t('common.cancel', 'Cancelar')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.confirmBtn} ${
                      currentDialog.options.variant === 'danger'
                        ? styles.confirmDanger
                        : currentDialog.options.variant === 'warning'
                        ? styles.confirmWarning
                        : styles.confirmPrimary
                    }`}
                    onClick={handleConfirmAction}
                    autoFocus
                  >
                    {currentDialog.options.confirmText || t('common.confirm', 'Confirmar')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.header}>
                  <div className={`${styles.iconWrapper} ${styles.iconPrimary}`}>
                    <Edit3 size={20} />
                  </div>
                  <div className={styles.headerText}>
                    <h3 className={styles.title}>
                      {currentDialog.options.title || t('common.prompt', 'Informe um valor')}
                    </h3>
                    {currentDialog.options.message && (
                      <p className={styles.message}>{currentDialog.options.message}</p>
                    )}
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <input
                    ref={inputRef}
                    type={currentDialog.options.inputType || 'text'}
                    className={styles.input}
                    value={promptValue}
                    onChange={(e) => setPromptValue(e.target.value)}
                    placeholder={currentDialog.options.placeholder || ''}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirmAction();
                      }
                    }}
                  />
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.cancelBtn} onClick={handleClose}>
                    {currentDialog.options.cancelText || t('common.cancel', 'Cancelar')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.confirmBtn} ${styles.confirmPrimary}`}
                    onClick={handleConfirmAction}
                  >
                    {currentDialog.options.confirmText || t('common.confirm', 'Confirmar')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export function useDialog(): DialogContextData {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
