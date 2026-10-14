import React, { useState } from 'react';
import { Rocket, AlertTriangle, ShieldCheck, MessageSquareHeart, X, Sparkles, Cpu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StorageKeys } from '../../core/enums';
import styles from './BetaWelcomeModal.module.css';

interface BetaWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BetaWelcomeModal: React.FC<BetaWelcomeModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (dontShowAgain) {
      localStorage.setItem(StorageKeys.BETA_WELCOME_SEEN, 'true');
    }
    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={handleConfirm} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.glowTop} />

        <button
          className={styles.closeButton}
          onClick={handleConfirm}
          aria-label={t('common.close')}
        >
          <X size={18} />
        </button>

        <div className={styles.header}>
          <div className={styles.artBadgeContainer}>
            <div className={styles.artBadge}>
              <Rocket size={34} color="#34d399" />
            </div>
          </div>

          <div className={styles.badgePill}>
            <span className={styles.pulsingDot} />
            <span>{t('auth.welcomeBetaBadge')}</span>
          </div>

          <h2 className={styles.title}>{t('auth.welcomeBetaTitle')}</h2>
          <p className={styles.subtitle}>
            {t('auth.welcomeBetaSubtitle')}
          </p>
        </div>

        <div className={styles.content}>
          <div className={styles.cardsGrid}>
            <div className={styles.infoCard}>
              <div className={styles.cardIconWrapper} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className={styles.cardTitle}>{t('auth.betaFeature1Title')}</h3>
                <p className={styles.cardDesc}>
                  {t('auth.betaFeature1Desc')}
                </p>
              </div>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.cardIconWrapper} style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
                <Cpu size={20} />
              </div>
              <div>
                <h3 className={styles.cardTitle}>{t('auth.betaFeature2Title')}</h3>
                <p className={styles.cardDesc}>
                  {t('auth.betaFeature2Desc')}
                </p>
              </div>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.cardIconWrapper} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className={styles.cardTitle}>{t('auth.betaFeature3Title')}</h3>
                <p className={styles.cardDesc}>
                  {t('auth.betaFeature3Desc')}
                </p>
              </div>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.cardIconWrapper} style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                <MessageSquareHeart size={20} />
              </div>
              <div>
                <h3 className={styles.cardTitle}>{t('auth.betaFeature4Title')}</h3>
                <p className={styles.cardDesc}>
                  {t('auth.betaFeature4Desc')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <label className={styles.dismissCheckboxLabel}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="custom-checkbox"
            />
            <span>{t('auth.dontShowAgain')}</span>
          </label>

          <button className={styles.actionButton} onClick={handleConfirm}>
            <Sparkles size={18} />
            <span>{t('auth.exploreBeta')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
