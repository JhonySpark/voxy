import React from 'react';
import styles from './Modals.module.css';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import type { ServerItem } from '../ServerSidebar/ServerSidebar';


interface InviteServerModalProps {
  isOpen: boolean;
  server: ServerItem | null;
  onClose: () => void;
}

export const InviteServerModal: React.FC<InviteServerModalProps> = ({
  isOpen,
  server,
  onClose,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  if (!isOpen || !server) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(server.id);
    toast.success(t('server.inviteCopied'));
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>
          {t('server.inviteTitle')} - {server.name}
        </h2>

        <div className={styles.inputGroup}>
          <label className={styles.label}>{t('server.inviteSubtitle')}</label>
          <input
            type="text"
            className={`${styles.input} ${styles.inviteCodeBox}`}
            readOnly
            value={server.id}
            onClick={handleCopy}
            title={t('server.copyInvite')}
          />
        </div>

        <div className={styles.actions} style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className={styles.submitButton}
            style={{ width: '100%' }}
            onClick={handleCopy}
          >
            {t('server.copyInvite')}
          </button>
        </div>
      </div>
    </div>
  );
};
