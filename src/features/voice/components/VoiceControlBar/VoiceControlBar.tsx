import React from 'react';
import styles from './VoiceControlBar.module.css';
import { Mic, MicOff, MonitorUp, MonitorOff, PhoneOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface VoiceControlBarProps {
  isMuted: boolean;
  isSharingScreen: boolean;
  onToggleMute: () => void;
  onToggleScreenShare: () => void;
  onDisconnect: () => void;
}

export const VoiceControlBar: React.FC<VoiceControlBarProps> = ({
  isMuted,
  isSharingScreen,
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
