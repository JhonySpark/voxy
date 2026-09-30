import React, { useState, useRef, useEffect } from 'react';
import styles from './Modals.module.css';
import { Camera, Image as ImageIcon, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { ApiRoutes, RealtimeEvents } from '../../../../core/enums';
import { realtimeClient } from '../../../../infrastructure/adapters/realtime/socket-realtime.adapter';
import type { ServerItem } from '../ServerSidebar/ServerSidebar';
import { getMediaUrl } from '../../../../core/utils/media.util';

interface ServerSettingsModalProps {
  isOpen: boolean;
  server: ServerItem;
  onClose: () => void;
  onServerUpdated: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  server,
  onClose,
  onServerUpdated,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [serverName, setServerName] = useState(server.name);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(server.iconUrl || null);
  const [iconError, setIconError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setServerName(server.name);
      setIconPreview(server.iconUrl || null);
      setIconFile(null);
      setIconError(false);
    }
  }, [isOpen, server]);

  if (!isOpen) return null;

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('user.invalidImageType', 'Por favor, selecione uma imagem válida.'));
      return;
    }

    setIconFile(file);
    const objectUrl = URL.createObjectURL(file);
    setIconPreview(objectUrl);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = serverName.trim();
    if (!trimmed) {
      toast.warning(t('server.serverNamePlaceholder'), t('server.serverName'));
      return;
    }

    setIsSaving(true);
    try {
      // 1. Atualizar nome se mudou
      if (trimmed !== server.name) {
        await httpClient.patch(`${ApiRoutes.SERVERS}/${server.id}`, { name: trimmed });
      }

      // 2. Upload de novo ícone se selecionado
      if (iconFile) {
        const formData = new FormData();
        formData.append('file', iconFile);
        await httpClient.post(`/storage/server/${server.id}/icon`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast.success(t('server.savedSuccess', 'Servidor atualizado com sucesso!'));
      onServerUpdated();
      realtimeClient.emit(RealtimeEvents.SERVER_UPDATED, { serverId: server.id });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao atualizar configurações do servidor.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className={styles.title}>{t('server.settingsTitle', 'Visão Geral do Servidor')}</h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.cancelButton}
            style={{ padding: '4px 8px', minWidth: 'auto', border: 'none', background: 'transparent' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className={styles.inputGroup}>
          <div className={styles.iconUploadSection}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleIconChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <div
              className={styles.iconPreviewWrapper}
              onClick={() => fileInputRef.current?.click()}
              title={t('server.changeIcon', 'Alterar ícone do servidor')}
            >
              {getMediaUrl(iconPreview) && !iconError ? (
                <img
                  src={getMediaUrl(iconPreview)}
                  alt="Ícone preview"
                  className={styles.iconPreviewImg}
                  onError={() => setIconError(true)}
                />
              ) : (
                <div className={styles.iconPlaceholder}>
                  <Camera size={24} />
                </div>
              )}
              <div className={styles.iconOverlay}>
                <ImageIcon size={20} />
              </div>
            </div>
            <span className={styles.iconUploadHint}>
              {t('server.iconChangeHint', 'Clique para alterar o ícone')}
            </span>
          </div>

          <label className={styles.label}>{t('server.serverName')}</label>
          <input
            type="text"
            className={styles.input}
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            placeholder={t('server.serverNamePlaceholder')}
            disabled={isSaving}
          />

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isSaving}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSaving}
            >
              {isSaving ? <span className={styles.spinner} /> : <Check size={16} />}
              <span>{isSaving ? t('common.saving', 'Salvando...') : t('common.save')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
