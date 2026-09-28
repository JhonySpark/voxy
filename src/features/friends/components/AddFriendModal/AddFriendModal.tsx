import React, { useState } from 'react';
import styles from './AddFriendModal.module.css';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { ApiRoutes } from '../../../../core/enums';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFriendAdded?: () => void;
  onFriendAction?: (targetId: string) => void;
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({
  isOpen,
  onClose,
  onFriendAdded,
  onFriendAction,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      toast.warning(t('friends.addFriendPlaceholder'), t('friends.title'));
      return;
    }

    setIsLoading(true);
    try {
      const res = await httpClient.post(ApiRoutes.FRIEND_REQUEST, { username: trimmed });
      toast.success(t('friends.requestSent', { username: trimmed }));
      setUsername('');
      onClose();
      if (onFriendAdded) onFriendAdded();
      if (onFriendAction && res?.targetId) onFriendAction(res.targetId);
    } catch (err: any) {
      const msg = err.response?.data?.message || t('friends.userNotFound');
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{t('friends.addFriend')}</h2>

        <form onSubmit={handleSubmit} className={styles.inputGroup}>
          <label className={styles.label}>{t('auth.register.username')}</label>
          <input
            type="text"
            className={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('friends.addFriendPlaceholder')}
            autoFocus
            disabled={isLoading}
          />

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isLoading}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isLoading}
            >
              {isLoading && <span className={styles.spinner} />}
              <span>{t('friends.addFriendButton')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
