import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { LanguageEnum, StorageKeys } from '../../../core/enums';
import { Badge } from '../../common/Badge';
import styles from './AppearanceTab.module.css';

export const AppearanceTab: React.FC = () => {
  const { t, i18n } = useTranslation();

  return (
    <div className={styles.container}>
      {/* Idioma */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>{t('settings.language')}</label>
        <div className={styles.selectWrapper}>
          <select
            className={styles.select}
            value={i18n.language}
            onChange={(e) => {
              i18n.changeLanguage(e.target.value);
              localStorage.setItem(StorageKeys.LANGUAGE, e.target.value);
            }}
          >
            <option value={LanguageEnum.PT}>Português (Brasil)</option>
            <option value={LanguageEnum.EN}>English (US)</option>
            <option value={LanguageEnum.ES}>Español</option>
          </select>
          <ChevronDown size={16} className={styles.selectChevron} />
        </div>
      </div>

      {/* Tema Visual */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>{t('settings.theme')}</label>
        <div className={styles.themeCard}>
          <div>
            <div className={styles.themeTitle}>{t('settings.themeObsidianMint')}</div>
            <div className={styles.themeDesc}>{t('settings.themeObsidianMintDesc')}</div>
          </div>
          <Badge variant="brand" size="sm">
            {t('common.active')}
          </Badge>
        </div>
      </div>
    </div>
  );
};
