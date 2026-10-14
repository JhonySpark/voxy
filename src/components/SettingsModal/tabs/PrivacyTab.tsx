import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import styles from './PrivacyTab.module.css';

export interface PrivacyTabProps {
  gamePresence: boolean;
  onToggleGamePresence: () => void;
}

export const PrivacyTab: React.FC<PrivacyTabProps> = ({
  gamePresence,
  onToggleGamePresence,
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <div className={styles.subcard} onClick={onToggleGamePresence}>
        <div>
          <div className={styles.subcardTitle}>{t('settings.gameDetection')}</div>
          <div className={styles.subcardDesc}>{t('settings.gameDetectionDesc')}</div>
        </div>
        <div className={`${styles.checkbox} ${gamePresence ? styles.checkboxChecked : ''}`}>
          <Check size={14} strokeWidth={3} />
        </div>
      </div>
    </div>
  );
};
