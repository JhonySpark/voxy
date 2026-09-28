import React from 'react';
import { PhoneCall, PhoneOff, Settings, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './UserProfileBar.module.css';

export interface ConnectedVoiceChannelInfo {
  channelId: string;
  serverId: string;
  name: string;
}

export interface UserProfileBarProps {
  username: string;
  connectedVoiceChannel: ConnectedVoiceChannelInfo | null;
  onDisconnectVoice: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const UserProfileBar: React.FC<UserProfileBarProps> = ({
  username,
  connectedVoiceChannel,
  onDisconnectVoice,
  onOpenSettings,
  onLogout,
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
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
        <div className={styles.avatar}>
          {username ? username.charAt(0).toUpperCase() : 'ME'}
        </div>
        <div className={styles.userInfo}>
          <span className={styles.userName}>{username || 'User'}</span>
        </div>
        <button
          className={styles.actionBtn}
          onClick={onOpenSettings}
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
