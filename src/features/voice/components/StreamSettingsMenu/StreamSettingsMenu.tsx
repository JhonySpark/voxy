import React from 'react';
import styles from './StreamSettingsMenu.module.css';
import { Volume2, VolumeX, Eye, EyeOff, ShieldAlert, Activity } from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '../../../../hooks/useClickOutside';

interface StreamSettingsMenuProps {
  isOpen: boolean;
  participantId: string;
  isWatching: boolean;
  streamVolume: number;
  onVolumeChange: (val: number) => void;
  onToggleWatch: () => void;
  onClose: () => void;
  onReport?: () => void;
  showDiagnosticsOption?: boolean;
  isDiagnosticsOpen?: boolean;
  onToggleDiagnostics?: () => void;
}

export const StreamSettingsMenu: React.FC<StreamSettingsMenuProps> = ({
  isOpen,
  isWatching,
  streamVolume,
  onVolumeChange,
  onToggleWatch,
  onClose,
  onReport,
  showDiagnosticsOption,
  isDiagnosticsOpen,
  onToggleDiagnostics,
}) => {
  const { t } = useTranslation();
  const menuRef = useClickOutside<HTMLDivElement>(onClose, isOpen);

  if (!isOpen) return null;

  const isMuted = streamVolume === 0;

  return (
    <div ref={menuRef} className={styles.menuContainer} onClick={(e) => e.stopPropagation()}>
      <div className={styles.menuHeader}>
        <span>{t('voice.streamSettings')}</span>
      </div>

      <div className={styles.volumeSection}>
        <div className={styles.volumeHeader}>
          <label className={styles.label}>{t('voice.streamVolume')}</label>
          <span className={styles.volumeValue}>{streamVolume}%</span>
        </div>
        <Slider.Root
          className="slider-root"
          value={[streamVolume]}
          max={200}
          step={1}
          onValueChange={(vals) => onVolumeChange(vals[0])}
        >
          <Slider.Track className="slider-track">
            <Slider.Range className="slider-range" />
          </Slider.Track>
          <Slider.Thumb className="slider-thumb" />
        </Slider.Root>
      </div>

      <button
        type="button"
        className={styles.muteButton}
        onClick={() => onVolumeChange(isMuted ? 100 : 0)}
      >
        {isMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}
        <span>{isMuted ? t('voice.unmuteStream') : t('voice.muteStream')}</span>
      </button>

      <button
        type="button"
        className={`${styles.watchButton} ${isWatching ? styles.stopWatch : styles.startWatch}`}
        onClick={() => {
          onToggleWatch();
          onClose();
        }}
      >
        {isWatching ? <EyeOff size={16} /> : <Eye size={16} />}
        <span>{isWatching ? t('voice.stopWatching') : t('voice.watchStream')}</span>
      </button>

      {showDiagnosticsOption && onToggleDiagnostics && (
        <button
          type="button"
          className={styles.diagnosticsButton}
          onClick={() => {
            onToggleDiagnostics();
            onClose();
          }}
          title={t('voice.toggleDiagnostics')}
        >
          <Activity size={16} />
          <span>{isDiagnosticsOpen ? t('voice.hideDiagnostics') : t('voice.streamDiagnostics')}</span>
        </button>
      )}

      {onReport && (
        <button
          type="button"
          className={styles.reportButton}
          onClick={() => {
            onClose();
            onReport();
          }}
        >
          <ShieldAlert size={16} />
          <span>{t('moderation.reportStreamButton')}</span>
        </button>
      )}
    </div>
  );
};
