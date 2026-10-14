import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Volume2, AlertCircle } from 'lucide-react';
import { soundService } from '../../../core/services/sound.service';
import type { NotificationSettings } from '../../../core/services/notification-settings.service';
import { Button } from '../../common/Button';
import styles from './NotificationsTab.module.css';

export interface NotificationsTabProps {
  notifSettings: NotificationSettings;
  updateNotifSettings: (updates: Partial<NotificationSettings>) => void;
  runInBackground: boolean;
  onToggleRunInBackground: () => void;
}

export const NotificationsTab: React.FC<NotificationsTabProps> = ({
  notifSettings,
  updateNotifSettings,
  runInBackground,
  onToggleRunInBackground,
}) => {
  const { t } = useTranslation();
  const [isTestingNotifSound, setIsTestingNotifSound] = useState(false);

  const handleTestSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTestingNotifSound(true);
    soundService.testSound();
    setTimeout(() => setIsTestingNotifSound(false), 800);
  };

  return (
    <div className={styles.container}>
      {/* Controles Mestres */}
      <div
        className={styles.subcard}
        onClick={() =>
          updateNotifSettings({ desktopNotifications: !notifSettings.desktopNotifications })
        }
      >
        <div className={styles.subcardContent}>
          <div className={styles.subcardTitle}>{t('settings.desktopNotifications')}</div>
          <div className={styles.subcardDesc}>{t('settings.desktopNotificationsDesc')}</div>
        </div>
        <div
          className={`${styles.checkbox} ${
            notifSettings.desktopNotifications ? styles.checkboxChecked : ''
          }`}
        >
          <Check size={14} strokeWidth={3} />
        </div>
      </div>

      <div
        className={styles.subcard}
        onClick={() => updateNotifSettings({ soundEnabled: !notifSettings.soundEnabled })}
      >
        <div className={styles.subcardContent}>
          <div className={styles.subcardTitle}>{t('settings.alertSounds')}</div>
          <div className={styles.subcardDesc}>
            {t('settings.notifications.soundDesc')}
          </div>
        </div>
        <div className={styles.subcardActions}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestSound}
            leftIcon={<Volume2 size={13} />}
          >
            {isTestingNotifSound ? t('settings.notifications.testing') : t('settings.notifications.testSound')}
          </Button>
          <div
            className={`${styles.checkbox} ${
              notifSettings.soundEnabled ? styles.checkboxChecked : ''
            }`}
          >
            <Check size={14} strokeWidth={3} />
          </div>
        </div>
      </div>

      {/* Callout Informativo */}
      <div className={styles.infoBanner}>
        <AlertCircle size={16} className={styles.infoBannerIcon} />
        <span>
          {t('settings.notifications.dndNotice')}
        </span>
      </div>

      {/* Categorias Específicas */}
      <div className={styles.sectionHeader}>{t('settings.notifications.categories')}</div>

      <div className={styles.categoriesGrid}>
        {/* Mensagens Diretas */}
        <div
          className={styles.subcard}
          onClick={() => updateNotifSettings({ directMessages: !notifSettings.directMessages })}
        >
          <div className={styles.subcardContent}>
            <div className={styles.subcardTitle}>{t('settings.notifications.dms')}</div>
            <div className={styles.subcardDesc}>{t('settings.notifications.dmsDesc')}</div>
          </div>
          <div
            className={`${styles.checkbox} ${
              notifSettings.directMessages ? styles.checkboxChecked : ''
            }`}
          >
            <Check size={14} strokeWidth={3} />
          </div>
        </div>

        <div
          className={styles.subcard}
          onClick={() => updateNotifSettings({ dmSound: !notifSettings.dmSound })}
        >
          <div className={styles.subcardContent}>
            <div className={styles.subcardTitle}>{t('settings.notifications.dmSound')}</div>
            <div className={styles.subcardDesc}>{t('settings.notifications.dmSoundDesc')}</div>
          </div>
          <div
            className={`${styles.checkbox} ${notifSettings.dmSound ? styles.checkboxChecked : ''}`}
          >
            <Check size={14} strokeWidth={3} />
          </div>
        </div>

        {/* Convites de Amizade */}
        <div
          className={styles.subcard}
          onClick={() => updateNotifSettings({ friendRequests: !notifSettings.friendRequests })}
        >
          <div className={styles.subcardContent}>
            <div className={styles.subcardTitle}>{t('settings.notifications.friends')}</div>
            <div className={styles.subcardDesc}>{t('settings.notifications.friendsDesc')}</div>
          </div>
          <div
            className={`${styles.checkbox} ${
              notifSettings.friendRequests ? styles.checkboxChecked : ''
            }`}
          >
            <Check size={14} strokeWidth={3} />
          </div>
        </div>

        <div
          className={styles.subcard}
          onClick={() => updateNotifSettings({ friendSound: !notifSettings.friendSound })}
        >
          <div className={styles.subcardContent}>
            <div className={styles.subcardTitle}>{t('settings.notifications.friendSound')}</div>
            <div className={styles.subcardDesc}>{t('settings.notifications.friendSoundDesc')}</div>
          </div>
          <div
            className={`${styles.checkbox} ${notifSettings.friendSound ? styles.checkboxChecked : ''}`}
          >
            <Check size={14} strokeWidth={3} />
          </div>
        </div>

        {/* Menções */}
        <div
          className={styles.subcard}
          onClick={() => updateNotifSettings({ mentions: !notifSettings.mentions })}
        >
          <div className={styles.subcardContent}>
            <div className={styles.subcardTitle}>{t('settings.notifications.mentions')}</div>
            <div className={styles.subcardDesc}>{t('settings.notifications.mentionsDesc')}</div>
          </div>
          <div
            className={`${styles.checkbox} ${notifSettings.mentions ? styles.checkboxChecked : ''}`}
          >
            <Check size={14} strokeWidth={3} />
          </div>
        </div>

        <div
          className={styles.subcard}
          onClick={() => updateNotifSettings({ mentionSound: !notifSettings.mentionSound })}
        >
          <div className={styles.subcardContent}>
            <div className={styles.subcardTitle}>{t('settings.notifications.mentionSound')}</div>
            <div className={styles.subcardDesc}>{t('settings.notifications.mentionSoundDesc')}</div>
          </div>
          <div
            className={`${styles.checkbox} ${
              notifSettings.mentionSound ? styles.checkboxChecked : ''
            }`}
          >
            <Check size={14} strokeWidth={3} />
          </div>
        </div>
      </div>

      {/* Executar em Segundo Plano */}
      <div className={styles.subcard} onClick={onToggleRunInBackground}>
        <div className={styles.subcardContent}>
          <div className={styles.subcardTitle}>{t('settings.notifications.background')}</div>
          <div className={styles.subcardDesc}>
            {t('settings.notifications.backgroundDesc')}
          </div>
        </div>
        <div
          className={`${styles.checkbox} ${runInBackground ? styles.checkboxChecked : ''}`}
        >
          <Check size={14} strokeWidth={3} />
        </div>
      </div>
    </div>
  );
};
