import React, { useState } from 'react';
import styles from './Modals.module.css';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { ApiRoutes, ChannelTypeEnum } from '../../../../core/enums';

interface CreateChannelModalProps {
  isOpen: boolean;
  serverId: string;
  onClose: () => void;
  onChannelCreated: () => void;
  onChannelSocketEmit?: () => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  serverId,
  onClose,
  onChannelCreated,
  onChannelSocketEmit,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<ChannelTypeEnum>(ChannelTypeEnum.TEXT);
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = channelName.trim();
    if (!trimmed) {
      toast.warning(t('channel.channelNamePlaceholder'), t('channel.channelName'));
      return;
    }

    setIsCreating(true);
    try {
      await httpClient.post(`${ApiRoutes.CHANNELS}/${serverId}`, {
        name: trimmed,
        type: channelType,
      });
      toast.success(t('channel.createdSuccess', { name: trimmed }));
      setChannelName('');
      onClose();
      onChannelCreated();
      if (onChannelSocketEmit) onChannelSocketEmit();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{t('channel.createChannel')}</h2>

        <form onSubmit={handleSubmit} className={styles.inputGroup}>
          <label className={styles.label}>{t('channel.channelType')}</label>
          <select
            className={styles.input}
            value={channelType}
            onChange={(e) => setChannelType(e.target.value as ChannelTypeEnum)}
            disabled={isCreating}
          >
            <option value={ChannelTypeEnum.TEXT}>{t('channel.typeText')}</option>
            <option value={ChannelTypeEnum.VOICE}>{t('channel.typeVoice')}</option>
          </select>

          <label className={styles.label} style={{ marginTop: '0.5rem' }}>
            {t('channel.channelName')}
          </label>
          <input
            type="text"
            className={styles.input}
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            placeholder={t('channel.channelNamePlaceholder')}
            autoFocus
            disabled={isCreating}
          />

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isCreating}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isCreating}
            >
              {isCreating && <span className={styles.spinner} />}
              <span>{t('channel.createChannel')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
