import React, { useState, useRef } from 'react';
import styles from './Modals.module.css';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { ApiRoutes } from '../../../../core/enums';
import type { ServerItem } from '../ServerSidebar/ServerSidebar';

interface CreateServerModalProps {
  isOpen: boolean;
  serverId?: string;
  onClose: () => void;
  onServerCreated: () => void;
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  onClose,
  onServerCreated,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [serverName, setServerName] = useState('');
  const [is18Plus, setIs18Plus] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = serverName.trim();
    if (!trimmed) {
      toast.warning(t('server.serverNamePlaceholder'), t('server.serverName'));
      return;
    }

    setIsCreating(true);
    try {
      const newServer = await httpClient.post<ServerItem>(ApiRoutes.SERVERS, {
        name: trimmed,
        is18Plus,
      });

      if (iconFile && newServer?.id) {
        const formData = new FormData();
        formData.append('file', iconFile);
        await httpClient.post(`/storage/server/${newServer.id}/icon`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast.success(t('server.createdSuccess', { name: trimmed }));
      setServerName('');
      setIconFile(null);
      setIconPreview(null);
      onClose();
      onServerCreated();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('server.invalidInvite'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteCode.trim();
    if (!trimmed) {
      toast.warning(t('server.joinServerPlaceholder'), t('server.joinServer'));
      return;
    }

    setIsJoining(true);
    try {
      await httpClient.post(ApiRoutes.SERVERS_JOIN, { inviteCode: trimmed });
      toast.success(t('server.joinedSuccess'));
      setInviteCode('');
      onClose();
      onServerCreated();
    } catch (err: any) {
      toast.error(t('server.invalidInvite'));
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{t('server.createServer')}</h2>

        <form onSubmit={handleCreate} className={styles.inputGroup}>
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
              title={t('server.uploadIcon', 'Escolher ícone do servidor')}
            >
              {iconPreview ? (
                <img src={iconPreview} alt="Ícone preview" className={styles.iconPreviewImg} />
              ) : (
                <div className={styles.iconPlaceholder}>
                  <Camera size={24} />
                </div>
              )}
              <div className={styles.iconOverlay}>
                <ImageIcon size={20} />
              </div>
            </div>
            <span className={styles.iconUploadHint}>{t('server.iconHint', 'Ícone opcional (clique para escolher)')}</span>
          </div>

          <label className={styles.label}>{t('server.serverName')}</label>
          <input
            type="text"
            className={styles.input}
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
            placeholder={t('server.serverNamePlaceholder')}
            autoFocus
            disabled={isCreating || isJoining}
          />

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            marginTop: '0.25rem',
            userSelect: 'none',
          }}>
            <input
              type="checkbox"
              checked={is18Plus}
              onChange={(e) => setIs18Plus(e.target.checked)}
              style={{ accentColor: '#ef4444', width: 16, height: 16, cursor: 'pointer' }}
            />
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                backgroundColor: is18Plus ? '#ef4444' : '#334155',
                color: '#fff',
                padding: '1px 6px',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontWeight: 700
              }}>18+</span>
              <span>Servidor restrito para maiores de 18 anos (+18)</span>
            </span>
          </label>

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isCreating || isJoining}
            >
              {isCreating && <span className={styles.spinner} />}
              <span>{t('server.createServerButton')}</span>
            </button>
          </div>
        </form>

        <div className={styles.divider}>
          <div className={styles.dividerLine} />
          <span className={styles.dividerText}>OU</span>
          <div className={styles.dividerLine} />
        </div>

        <form onSubmit={handleJoin} className={styles.inputGroup}>
          <label className={styles.label}>{t('server.joinServer')}</label>
          <input
            type="text"
            className={styles.input}
            placeholder={t('server.joinServerPlaceholder')}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            disabled={isCreating || isJoining}
          />
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isCreating || isJoining}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isCreating || isJoining}
            >
              {isJoining && <span className={styles.spinner} />}
              <span>{t('server.joinServerButton')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
