import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, RefreshCw, X, AlertCircle } from 'lucide-react';
import { ipcRenderer } from 'electron';
import './UpdateNotification.css';

interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export const UpdateNotification: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'available' | 'downloading' | 'downloaded' | 'error'>('idle');
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
      setStatus('available');
      setDismissed(false);
    };

    const onProgress = (_: unknown, data: UpdateProgress) => {
      setProgress(data);
      setStatus('downloading');
      setDismissed(false);
    };

    const onDownloaded = (_: unknown, data: { version: string }) => {
      setVersion(data.version);
      setStatus('downloaded');
      setDismissed(false);
    };

    const onError = () => {
      setStatus('error');
    };

    ipcRenderer.on('app-update-available', onAvailable);
    ipcRenderer.on('app-update-progress', onProgress);
    ipcRenderer.on('app-update-downloaded', onDownloaded);
    ipcRenderer.on('app-update-error', onError);

    return () => {
      ipcRenderer.removeListener('app-update-available', onAvailable);
      ipcRenderer.removeListener('app-update-progress', onProgress);
      ipcRenderer.removeListener('app-update-downloaded', onDownloaded);
      ipcRenderer.removeListener('app-update-error', onError);
    };
  }, []);

  if (status === 'idle' || dismissed) {
    return null;
  }

  const handleInstall = () => {
    try {
      ipcRenderer.invoke('RESTART_AND_INSTALL');
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
          <div className={`update-toast-icon ${status === 'downloading' ? 'downloading' : ''}`}>
            {status === 'downloaded' ? (
              <CheckCircle size={18} />
            ) : status === 'error' ? (
              <AlertCircle size={18} color="#ffb4ab" />
            ) : (
              <Download size={18} />
            )}
          </div>
          <div>
            <div className="update-toast-title">
              {status === 'downloaded'
                ? `Atualização pronta (v${version})`
                : status === 'error'
                ? 'Falha ao baixar atualização'
                : `Nova versão encontrada! (v${version})`}
            </div>
            <div className="update-toast-subtitle">
              {status === 'downloaded'
                ? 'O download foi concluído com sucesso.'
                : status === 'downloading'
                ? `Baixando em segundo plano... ${progress.percent}%`
                : status === 'error'
                ? 'Verifique sua conexão ou tente mais tarde.'
                : 'Iniciando download automático...'}
            </div>
          </div>
        </div>

        <button 
          className="update-toast-close"
          onClick={() => setDismissed(true)}
          title="Fechar aviso"
        >
          <X size={15} />
        </button>
      </div>

      {status === 'downloading' && (
        <div className="update-progress-container">
          <div className="update-progress-bar-bg">
            <div 
              className="update-progress-bar-fill" 
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="update-progress-stats">
            <span>{formatBytes(progress.transferred)} de {formatBytes(progress.total)}</span>
            <span>{progress.bytesPerSecond ? `${(progress.bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s` : ''}</span>
          </div>
        </div>
      )}

      {status === 'downloaded' && (
        <div className="update-toast-actions">
          <button 
            className="update-btn-dismiss"
            onClick={() => setDismissed(true)}
          >
            Depois
          </button>
          <button 
            className="update-btn-install"
            onClick={handleInstall}
          >
            <RefreshCw size={13} />
            <span>Reiniciar Agora</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UpdateNotification;
