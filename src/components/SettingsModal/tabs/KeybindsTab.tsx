import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './KeybindsTab.module.css';

export const KeybindsTab: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <div className={styles.subcard}>
        <div>
          <div className={styles.subcardTitle}>{t('settings.muteKeybind')}</div>
          <div className={styles.subcardDesc}>{t('settings.muteKeybindDesc')}</div>
        </div>
        <kbd className={styles.kbd}>Ctrl + Shift + M</kbd>
      </div>

      <div className={styles.subcard}>
        <div>
          <div className={styles.subcardTitle}>{t('settings.deafenKeybind')}</div>
          <div className={styles.subcardDesc}>{t('settings.deafenKeybindDesc')}</div>
        </div>
        <kbd className={styles.kbd}>Ctrl + Shift + D</kbd>
      </div>
    </div>
  );
};
