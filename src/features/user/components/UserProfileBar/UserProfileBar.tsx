import React, { useState } from 'react';
import { PhoneCall, PhoneOff, Settings, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './UserProfileBar.module.css';
import { UserPopout, type UserProfileData } from '../UserPopout/UserPopout';
import { SettingsTabEnum } from '../../../../core/enums';
import { getMediaUrl } from '../../../../core/utils/media.util';

export interface ConnectedVoiceChannelInfo {
  channelId: string;
  serverId: string;
  name: string;
}

export interface UserProfileBarProps {
  user: UserProfileData;
  connectedVoiceChannel: ConnectedVoiceChannelInfo | null;
  onDisconnectVoice: () => void;
  onOpenSettings: (tab?: SettingsTabEnum) => void;
  onOpenEditProfile: () => void;
  onLogout: () => void;
}

export const UserProfileBar: React.FC<UserProfileBarProps> = ({
  user,
  connectedVoiceChannel,
  onDisconnectVoice,
  onOpenSettings,
  onOpenEditProfile,
  onLogout,
}) => {
  const { t } = useTranslation();
  const [isPopoutOpen, setIsPopoutOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const displayName = user.displayName || user.username || 'User';
  const avatarMedia = getMediaUrl(user.avatarUrl);

  React.useEffect(() => {
    setAvatarError(false);
  }, [avatarMedia]);

  return (
    <div className={styles.container}>
      {/* Popout Rápido do Usuário */}
      <UserPopout
        isOpen={isPopoutOpen}
        onClose={() => setIsPopoutOpen(false)}
        user={user}
        onOpenEditProfile={onOpenEditProfile}
        onOpenAccountSettings={() => onOpenSettings(SettingsTabEnum.ACCOUNT)}
      />

      {connectedVoiceChannel && (
        <div className={styles.activeCallBar}>
          <div className={styles.activeCallInfo}>
            <span className={styles.activeCallTitle}>
              <PhoneCall size={14} /> {t('voice.connected')}
            </span>
            <span className={styles.activeCallChannelName}>
              {connectedVoiceChannel.name}
            </span>
          </div>
          <button
            className={styles.disconnectBtn}
            onClick={onDisconnectVoice}
            title={t('voice.cancel')}
            aria-label={t('voice.cancel')}
          >
            <PhoneOff size={18} />
          </button>
        </div>
      )}

      <div className={styles.userProfileBar}>
        {/* Bloco clicável para abrir o Popout de Perfil */}
        <div
          className={styles.userClickable}
          onClick={() => setIsPopoutOpen((prev) => !prev)}
          title={t('user.viewProfile', 'Ver perfil')}
        >
          <div className={styles.avatarWrapper}>
            {avatarMedia && !avatarError ? (
              <img
                src={avatarMedia}
                alt={displayName}
                className={styles.avatarImg}
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className={styles.avatar}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className={styles.statusDot} />
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>{displayName}</span>
            <span className={styles.userHandle}>@{user.username}</span>
          </div>
        </div>

        <button
          className={styles.actionBtn}
          onClick={() => onOpenSettings()}
          title={t('settings.title')}
          aria-label={t('settings.title')}
        >
          <Settings size={18} />
        </button>
        <button
          className={styles.actionBtn}
          onClick={onLogout}
          title={t('settings.logout')}
          aria-label={t('settings.logout')}
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
};

