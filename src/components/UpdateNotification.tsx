import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, RefreshCw, X, AlertCircle } from 'lucide-react';
import { ipcRenderer } from 'electron';
import { useTranslation } from 'react-i18next';
import { AppUpdateStatus, IpcChannels } from '../core/enums';
import './UpdateNotification.css';

interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export const UpdateNotification: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<AppUpdateStatus>(AppUpdateStatus.IDLE);
  const [version, setVersion] = useState<string>('');
  const [progress, setProgress] = useState<UpdateProgress>({
    percent: 0,
    transferred: 0,
    total: 0,
    bytesPerSecond: 0,
  });
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (!ipcRenderer) return;

    const onAvailable = (_: unknown, data: { version: string }) => {
      setVersion(data.version);
      setStatus(AppUpdateStatus.AVAILABLE);
      setDismissed(false);
    };

    const onProgress = (_: unknown, data: UpdateProgress) => {
      setProgress(data);
      setStatus(AppUpdateStatus.DOWNLOADING);
      setDismissed(false);
    };

    const onDownloaded = (_: unknown, data: { version: string }) => {
      setVersion(data.version);
      setStatus(AppUpdateStatus.DOWNLOADED);
      setDismissed(false);
    };

    const onError = () => {
      setStatus(AppUpdateStatus.ERROR);
    };

    ipcRenderer.on(IpcChannels.APP_UPDATE_AVAILABLE, onAvailable);
    ipcRenderer.on(IpcChannels.APP_UPDATE_PROGRESS, onProgress);
    ipcRenderer.on(IpcChannels.APP_UPDATE_DOWNLOADED, onDownloaded);
    ipcRenderer.on(IpcChannels.APP_UPDATE_ERROR, onError);

    return () => {
      ipcRenderer.removeListener(IpcChannels.APP_UPDATE_AVAILABLE, onAvailable);
      ipcRenderer.removeListener(IpcChannels.APP_UPDATE_PROGRESS, onProgress);
      ipcRenderer.removeListener(IpcChannels.APP_UPDATE_DOWNLOADED, onDownloaded);
      ipcRenderer.removeListener(IpcChannels.APP_UPDATE_ERROR, onError);
    };
  }, []);

  if (status === AppUpdateStatus.IDLE || dismissed) {
    return null;
  }

  const handleInstall = () => {
    try {
      ipcRenderer.invoke(IpcChannels.RESTART_AND_INSTALL);
    } catch (err) {
      console.error('Erro ao reiniciar para instalar:', err);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="update-notification-toast">
      <div className="update-toast-header">
        <div className="update-toast-left">
          <div className={`update-toast-icon ${status === AppUpdateStatus.DOWNLOADING ? 'downloading' : ''}`}>
            {status === AppUpdateStatus.DOWNLOADED ? (
              <CheckCircle size={18} />
            ) : status === AppUpdateStatus.ERROR ? (
              <AlertCircle size={18} color="#ffb4ab" />
            ) : (
              <Download size={18} />
            )}
          </div>
          <div>
            <div className="update-toast-title">
              {status === AppUpdateStatus.DOWNLOADED
                ? t('update.ready', { version })
                : status === AppUpdateStatus.ERROR
                ? t('update.failed')
                : t('update.available', { version })}
            </div>
            <div className="update-toast-subtitle">
              {status === AppUpdateStatus.DOWNLOADED
                ? t('update.readyDesc')
                : status === AppUpdateStatus.DOWNLOADING
                ? t('update.downloadingDesc', { percent: progress.percent })
                : status === AppUpdateStatus.ERROR
                ? t('update.failedDesc')
                : t('update.startingDesc')}
            </div>
          </div>
        </div>

        <button 
          className="update-toast-close"
          onClick={() => setDismissed(true)}
          title={t('common.close')}
        >
          <X size={15} />
        </button>
      </div>

      {status === AppUpdateStatus.DOWNLOADING && (
        <div className="update-progress-container">
          <div className="update-progress-bar-bg">
            <div 
              className="update-progress-bar-fill" 
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="update-progress-stats">
            <span>{formatBytes(progress.transferred)} / {formatBytes(progress.total)}</span>
            <span>{progress.bytesPerSecond ? `${(progress.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s` : ''}</span>
          </div>
        </div>
      )}

      {status === AppUpdateStatus.DOWNLOADED && (
        <div className="update-toast-actions">
          <button 
            className="update-btn-dismiss"
            onClick={() => setDismissed(true)}
          >
            {t('update.later')}
          </button>
          <button 
            className="update-btn-install"
            onClick={handleInstall}
          >
            <RefreshCw size={13} />
            <span>{t('update.restartNow')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UpdateNotification;
