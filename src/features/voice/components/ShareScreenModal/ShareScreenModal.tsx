import React, { useState } from 'react';
import styles from './ShareScreenModal.module.css';
import { Gamepad2, AppWindow, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon?: string;
  isGame?: boolean;
}

interface ShareScreenModalProps {
  isOpen: boolean;
  categorizedSources: {
    games: DesktopSource[];
    windows: DesktopSource[];
    screens: DesktopSource[];
  };
  streamRes: '720' | '1080';
  streamFps: '30' | '60';
  onStreamResChange: (res: '720' | '1080') => void;
  onStreamFpsChange: (fps: '30' | '60') => void;
  onSelectSource: (sourceId: string) => void;
  onClose: () => void;
}

export const ShareScreenModal: React.FC<ShareScreenModalProps> = ({
  isOpen,
  categorizedSources,
  streamRes,
  streamFps,
  onStreamResChange,
  onStreamFpsChange,
  onSelectSource,
  onClose,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'games' | 'windows' | 'screens'>('games');

  if (!isOpen) return null;

  const currentList =
    activeTab === 'games'
      ? categorizedSources.games
      : activeTab === 'windows'
      ? categorizedSources.windows
      : categorizedSources.screens;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <div className={styles.iconBadge}>
              <Gamepad2 size={24} />
            </div>
            <div>
              <h2 className={styles.title}>{t('voice.shareModalTitle')}</h2>
              <span className={styles.subtitle}>
                {t('voice.shareAudio')}
              </span>
            </div>
          </div>

          <div className={styles.selectors}>
            <div className={styles.selectBox}>
              <label className={styles.selectLabel}>{t('voice.resolution')}:</label>
              <select
                className={styles.select}
                value={streamRes}
                onChange={(e) => onStreamResChange(e.target.value as any)}
              >
                <option value="720">720p</option>
                <option value="1080">1080p (Pro)</option>
              </select>
            </div>

            <div className={styles.selectBox}>
              <label className={styles.selectLabel}>{t('voice.framerate')}:</label>
              <select
                className={styles.select}
                value={streamFps}
                onChange={(e) => onStreamFpsChange(e.target.value as any)}
              >
                <option value="30">30 FPS</option>
                <option value="60">60 FPS (Ultra)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${
              activeTab === 'games' ? styles.active : styles.inactive
            }`}
            onClick={() => setActiveTab('games')}
          >
            <Gamepad2 size={16} />
            <span>Jogos</span>
            {categorizedSources.games.length > 0 && (
              <span style={{ fontSize: '0.7rem', padding: '1px 5px', borderRadius: 6, background: 'rgba(0,0,0,0.2)' }}>
                {categorizedSources.games.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`${styles.tabBtn} ${
              activeTab === 'windows' ? styles.active : styles.inactive
            }`}
            onClick={() => setActiveTab('windows')}
          >
            <AppWindow size={16} />
            <span>{t('voice.applications')} ({categorizedSources.windows.length})</span>
          </button>

          <button
            type="button"
            className={`${styles.tabBtn} ${
              activeTab === 'screens' ? styles.active : styles.inactive
            }`}
            onClick={() => setActiveTab('screens')}
          >
            <Monitor size={16} />
            <span>{t('voice.screens')} ({categorizedSources.screens.length})</span>
          </button>
        </div>

        {/* Sources Grid */}
        <div className={styles.sourceGrid}>
          {currentList.length === 0 ? (
            <div className={styles.emptyState}>
              <Gamepad2 size={42} style={{ opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: '0.95rem' }}>
                {t('voice.noSources')}
              </p>
            </div>
          ) : (
            currentList.map((s) => (
              <div
                key={s.id}
                className={`${styles.sourceCard} ${s.isGame ? styles.isGame : ''}`}
                onClick={() => onSelectSource(s.id)}
              >
                <div className={styles.thumbnailWrapper}>
                  <img src={s.thumbnail} alt={s.name} className={styles.thumbnailImg} />
                  {s.isGame && <div className={styles.gameBadge}>60 FPS PRO</div>}
                </div>
                <div className={styles.cardFooter}>
                  {s.appIcon ? (
                    <img src={s.appIcon} alt="" style={{ width: 18, height: 18, borderRadius: 3 }} />
                  ) : s.isGame ? (
                    <Gamepad2 size={16} color="var(--brand-primary, #34d399)" />
                  ) : (
                    <AppWindow size={16} color="#64748b" />
                  )}
                  <span className={styles.sourceName}>{s.name}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            {t('voice.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
