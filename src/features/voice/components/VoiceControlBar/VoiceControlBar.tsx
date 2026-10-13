import React from 'react';
import styles from './VoiceControlBar.module.css';
import { Mic, MicOff, MonitorUp, MonitorOff, PhoneOff, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface VoiceControlBarProps {
  isMuted: boolean;
  isSharingScreen: boolean;
  streamViewersCount?: number;
  onToggleMute: () => void;
  onToggleScreenShare: () => void;
  onDisconnect: () => void;
}

export const VoiceControlBar: React.FC<VoiceControlBarProps> = ({
  isMuted,
  isSharingScreen,
  streamViewersCount,
  onToggleMute,
  onToggleScreenShare,
  onDisconnect,
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={`${styles.button} ${styles.micButton} ${isMuted ? styles.muted : ''}`}
        onClick={onToggleMute}
        title={isMuted ? t('voice.unmute') : t('voice.mute')}
      >
        {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
      </button>

      <div className={styles.screenButtonWrapper}>
        <button
          type="button"
          className={`${styles.button} ${styles.screenButton} ${
            isSharingScreen ? styles.active : ''
          }`}
          onClick={onToggleScreenShare}
          title={isSharingScreen ? t('voice.stopShare') : t('voice.shareScreen')}
        >
          {isSharingScreen ? <MonitorOff size={22} /> : <MonitorUp size={22} />}
        </button>
        {isSharingScreen && typeof streamViewersCount === 'number' && (
          <span className={styles.screenViewersBadge} title={`${streamViewersCount} assistindo`}>
            <Eye size={11} />
            <span>{streamViewersCount}</span>
          </span>
        )}
      </div>

      <button
        type="button"
        className={`${styles.button} ${styles.disconnectButton}`}
        onClick={onDisconnect}
        title={t('voice.disconnect')}
      >
        <PhoneOff size={22} />
      </button>
    </div>
  );
};
