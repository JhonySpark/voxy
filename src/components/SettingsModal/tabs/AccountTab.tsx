import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, RefreshCw, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { ipcRenderer } from 'electron';
import { httpClient } from '../../../infrastructure/adapters/http/http-client.adapter';
import { ApiRoutes, IpcChannels } from '../../../core/enums';
import { getMediaUrl } from '../../../core/utils/media.util';
import type { UserProfileData } from '../../../features/user/components/UserPopout/UserPopout';
import { Input } from '../../common/Input';
import { Badge } from '../../common/Badge';
import styles from './AccountTab.module.css';

export interface AccountTabProps {
  currentUser?: UserProfileData | null;
  onOpenEditProfile?: () => void;
  onProfileUpdated?: (updated: Partial<UserProfileData>) => void;
  onLogout?: () => void;
  onClose: () => void;
}

export const AccountTab: React.FC<AccountTabProps> = ({
  currentUser,
  onOpenEditProfile,
  onProfileUpdated,
  onLogout,
  onClose,
}) => {
  const { t } = useTranslation();
  const [avatarError, setAvatarError] = useState(false);

  // Alteração de Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Revalidação de Idade (Age Signals)
  const [isRevalidatingAge, setIsRevalidatingAge] = useState(false);
  const [ageFeedback, setAgeFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  useEffect(() => {
    setAvatarError(false);
  }, [currentUser?.avatarUrl]);

  const handleRevalidateAge = async () => {
    setIsRevalidatingAge(true);
    setAgeFeedback(null);
    try {
      let osSignal = { available: false };
      if (ipcRenderer) {
        try {
          const raw = await ipcRenderer.invoke(IpcChannels.GET_OS_AGE_SIGNAL);
          if (raw) {
            osSignal = typeof raw === 'string' ? JSON.parse(raw) : raw;
          }
        } catch (ipcErr) {
          console.warn('[Age Signals] Falha ao coletar sinal nativo:', ipcErr);
        }
      }

      const res = await httpClient.post<{
        success: boolean;
        user: UserProfileData;
        changed: boolean;
      }>(ApiRoutes.AUTH_SYNC_AGE_SIGNAL, { signal: osSignal });

      if (res?.success && res.user) {
        const updatedUser = res.user;
        onProfileUpdated?.(updatedUser);

        if (updatedUser.ageClassification === 'CHILD') {
          setAgeFeedback({
            type: 'error',
            message: t('user.ageRestrictedChild'),
          });
          setTimeout(() => {
            onClose();
            onLogout?.();
          }, 3000);
          return;
        }

        const oldClass = currentUser?.ageClassification || 'UNKNOWN';
        const newClass = updatedUser.ageClassification;

        const classificationLabel =
          newClass === 'ADULT'
            ? t('user.agePillAdult')
            : newClass === 'TEEN'
            ? t('user.agePillTeen')
            : newClass;

        if (oldClass !== newClass) {
          setAgeFeedback({
            type: 'success',
            message: t('user.ageUpdatedSuccess', { classification: classificationLabel }),
          });
        } else {
          setAgeFeedback({
            type: 'info',
            message: t('user.ageAlreadySynced', { classification: classificationLabel }),
          });
        }
      } else {
        setAgeFeedback({
          type: 'error',
          message: t('user.ageRevalidateError'),
        });
      }
    } catch (err: any) {
      setAgeFeedback({
        type: 'error',
        message: err.response?.data?.message || t('user.ageRevalidateError'),
      });
    } finally {
      setIsRevalidatingAge(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordFeedback({ type: 'error', message: t('user.fillAllFields') });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', message: t('user.newPasswordTooShort') });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: t('user.passwordsDoNotMatch') });
      return;
    }

    setIsChangingPassword(true);
    try {
      await httpClient.patch(ApiRoutes.USERS_CHANGE_PASSWORD, {
        currentPassword,
        newPassword,
      });
      setPasswordFeedback({ type: 'success', message: t('user.passwordChangedSuccess') });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordFeedback({
        type: 'error',
        message: err.response?.data?.message || t('user.passwordChangeError'),
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getAgePill = () => {
    if (currentUser?.ageClassification === 'ADULT') {
      return <span className={`${styles.agePill} ${styles.agePillAdult}`}>{t('user.agePillAdult')}</span>;
    }
    if (currentUser?.ageClassification === 'TEEN') {
      return <span className={`${styles.agePill} ${styles.agePillTeen}`}>{t('user.agePillTeen')}</span>;
    }
    if (currentUser?.ageClassification === 'CHILD') {
      return <span className={`${styles.agePill} ${styles.agePillChild}`}>{t('user.agePillChild')}</span>;
    }
    return <span className={`${styles.agePill} ${styles.agePillUnknown}`}>{t('user.agePillUnknown')}</span>;
  };

  return (
    <div className={styles.container}>
      {/* Card Visual de Perfil */}
      <div className={styles.profileCard}>
        <div
          className={styles.banner}
          style={{ backgroundColor: currentUser?.bannerColor || 'var(--bg-accent)' }}
        >
          {getMediaUrl(currentUser?.bannerUrl) && (
            <img
              src={getMediaUrl(currentUser?.bannerUrl)}
              alt="Banner"
              className={styles.bannerImg}
              loading="eager"
              decoding="async"
            />
          )}
        </div>
        <div className={styles.profileBody}>
          <div className={styles.profileLeft}>
            <div className={styles.avatarWrapper}>
              {getMediaUrl(currentUser?.avatarUrl) && !avatarError ? (
                <img
                  src={getMediaUrl(currentUser?.avatarUrl)}
                  alt={currentUser?.displayName || currentUser?.username}
                  className={styles.avatarImg}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <span className={styles.avatarPlaceholder}>
                  {(currentUser?.displayName || currentUser?.username || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.usernameRow}>
                <span className={styles.username}>{currentUser?.displayName || currentUser?.username || t('user.defaultUser')}</span>
                {currentUser?.role === 'ADMIN' && (
                  <Badge variant="brand" size="sm">
                    {t('common.owner')}
                  </Badge>
                )}
              </div>
              <span className={styles.tag}>@{currentUser?.username || 'usuario'}</span>
            </div>
          </div>
          {onOpenEditProfile && (
            <button
              type="button"
              className={`${styles.accountBtn} ${styles.editProfileBtn}`}
              onClick={onOpenEditProfile}
            >
              <Sparkles size={14} />
              <span>{t('user.editProfile')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. Informações da Conta */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>{t('user.accountDetails')}</span>
        <div className={styles.infoBox}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('user.displayName')}</span>
            <span className={styles.infoValue}>{currentUser?.displayName || t('user.notDefined')}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('user.username')}</span>
            <span className={styles.infoValue}>@{currentUser?.username || '-'}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('user.email')}</span>
            <span className={styles.infoValue}>{currentUser?.email || '••••••••@••••.com'}</span>
          </div>
        </div>
      </div>

      {/* 2. Faixa Etária e Proteção (Age Signals) */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            {t('user.ageSignalsTitle')}
          </span>
          {getAgePill()}
        </div>

        <div className={styles.infoBox}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('user.streamPermissions')}</span>
            <span className={styles.infoValue}>
              {currentUser?.ageClassification === 'ADULT'
                ? t('user.streamPermAdult')
                : currentUser?.ageClassification === 'TEEN'
                ? t('user.streamPermTeen')
                : t('user.streamPermRestricted')}
            </span>
          </div>

          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('user.adultServers')}</span>
            <span className={`${styles.infoValue} ${currentUser?.ageClassification === 'ADULT' ? styles.valueAllowed : styles.valueBlocked}`}>
              {currentUser?.ageClassification === 'ADULT' ? t('user.allowedAdult') : t('user.blockedAdult')}
            </span>
          </div>

          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('user.signalOrigin')}</span>
            <span className={styles.infoValue}>
              {currentUser?.ageSignalSource === 'WINDOWS_OS'
                ? t('user.signalWinRT')
                : currentUser?.ageSignalSource === 'DECLARED'
                ? t('user.signalDeclared')
                : t('user.signalNone')}
            </span>
          </div>

          {currentUser?.birthDate && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t('user.birthDate')}</span>
              <span className={styles.infoValue}>
                {new Date(currentUser.birthDate).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {ageFeedback && (
          <div
            className={`${styles.feedbackAlert} ${
              ageFeedback.type === 'success'
                ? styles.feedbackSuccess
                : ageFeedback.type === 'error'
                ? styles.feedbackError
                : styles.feedbackInfo
            }`}
          >
            {ageFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{ageFeedback.message}</span>
          </div>
        )}

        <div className={styles.revalidateRow}>
          <span className={styles.revalidateText}>
            {t('user.revalidateHint')}
          </span>
          <button
            type="button"
            className={`${styles.accountBtn} ${styles.revalidateAgeBtn}`}
            onClick={handleRevalidateAge}
            disabled={isRevalidatingAge}
          >
            <RefreshCw size={14} className={isRevalidatingAge ? styles.spinAnimation : ''} />
            <span>{isRevalidatingAge ? t('user.revalidating') : t('user.revalidateBtn')}</span>
          </button>
        </div>
      </div>

      {/* 3. Segurança / Alterar Senha */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>{t('user.securityTitle')}</span>
          <span className={styles.passwordTip}>{t('user.passwordMinLength')}</span>
        </div>

        <form onSubmit={handleChangePassword} className={styles.passwordForm}>
          <div className={styles.formGrid}>
            <Input
              type="password"
              label={t('user.currentPassword')}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              fullWidth
            />
            <Input
              type="password"
              label={t('user.newPassword')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              fullWidth
            />
            <Input
              type="password"
              label={t('user.confirmPassword')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              fullWidth
            />
          </div>

          {passwordFeedback && (
            <div
              className={`${styles.feedbackAlert} ${
                passwordFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError
              }`}
            >
              {passwordFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{passwordFeedback.message}</span>
            </div>
          )}

          <div className={styles.formActions}>
            <button
              type="submit"
              className={`${styles.accountBtn} ${styles.updatePasswordBtn}`}
              disabled={isChangingPassword}
            >
              <KeyRound size={14} />
              <span>{isChangingPassword ? t('user.updating') : t('user.updatePassword')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
