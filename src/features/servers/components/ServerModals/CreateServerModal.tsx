import React, { useState } from 'react';
import styles from './Modals.module.css';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { ApiRoutes } from '../../../../core/enums';

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
  const [inviteCode, setInviteCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = serverName.trim();
    if (!trimmed) {
      toast.warning(t('server.serverNamePlaceholder'), t('server.serverName'));
      return;
    }

    setIsCreating(true);
    try {
      await httpClient.post(ApiRoutes.SERVERS, { name: trimmed });
      toast.success(t('server.createdSuccess', { name: trimmed }));
      setServerName('');
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
