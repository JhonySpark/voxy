import React, { useRef, useEffect, useState } from 'react';
import styles from './ParticipantCard.module.css';
import { Mic, MicOff, Maximize, Minimize, Settings, MonitorUp, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsSpeaking } from '@livekit/components-react';
import { StreamSettingsMenu } from '../StreamSettingsMenu/StreamSettingsMenu';
import { DevStreamDiagnostics } from '../../../../components/DevStreamDiagnostics';

interface ParticipantCardProps {
  participant: {
    id: string;
    username: string;
    isLocal: boolean;
    track: any;
    isStreaming: boolean;
    hasVideo: boolean;
    isMuted: boolean;
    lkParticipant: any;
    nativeTelemetry?: any;
  };
  isMaximized: boolean;
  isHorizontal?: boolean;
  streamVolume: number;
  isWatching: boolean;
  onToggleMaximize: () => void;
  onToggleWatchStream: () => void;
  onStreamVolumeChange: (vol: number) => void;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant: p,
  isMaximized,
  isHorizontal = false,
  streamVolume,
  isWatching,
  onToggleMaximize,
  onToggleWatchStream,
  onStreamVolumeChange,
}) => {
  const { t } = useTranslation();
  const isSpeaking = useIsSpeaking(p.lkParticipant);
  const [showSettings, setShowSettings] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !p.track) return;
    p.track.attach(el);
    return () => {
      p.track.detach(el);
    };
  }, [p.track]);

  return (
    <div
      className={`${styles.card} ${isSpeaking ? styles.speaking : ''}`}
      style={
        isHorizontal
          ? { minWidth: '280px', maxWidth: '280px' }
          : undefined
      }
      onClick={() => {
        // Clica para maximizar ou alternar
        if (!p.isStreaming || isWatching) {
          onToggleMaximize();
        }
      }}
    >
      {/* Video Content */}
      {p.hasVideo ? (
        <div className={styles.videoWrapper}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={styles.videoElement}
          />
          {p.track && <DevStreamDiagnostics track={p.track} nativeTelemetry={p.nativeTelemetry} />}
        </div>
      ) : p.isStreaming && !p.isLocal ? (
        /* Stream não assistida ainda */
        <div
          className={styles.streamPlaceholder}
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatchStream();
          }}
          title={t('voice.watchStream')}
        >
          <MonitorUp size={36} color="var(--brand-primary, #34d399)" />
          <button
            type="button"
            className={styles.watchBtn}
            onClick={(e) => {
              e.stopPropagation();
              onToggleWatchStream();
            }}
          >
            <Eye size={16} />
            <span>{t('voice.watchStream')}</span>
          </button>
        </div>
      ) : (
        /* Avatar Fallback */
        <div className={styles.avatarFallback}>
          <div className={styles.avatarCircle}>
            {p.username === t('chat.you') ? 'ME' : p.username.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Top Controls Bar */}
      <div className={styles.topBar}>
        <div
          className={`${styles.micBadge} ${
            p.isMuted ? styles.muted : styles.unmuted
          }`}
        >
          {p.isMuted ? <MicOff size={14} /> : <Mic size={14} />}
        </div>

        <div className={styles.topActions}>
          {/* Botão de configuração de stream visível mesmo no card minimizado */}
          {!p.isLocal && p.isStreaming && (
            <button
              type="button"
              className={styles.iconBtn}
              title={t('voice.streamQuality')}
              onClick={(e) => {
                e.stopPropagation();
                setShowSettings((prev) => !prev);
              }}
            >
              <Settings size={14} />
            </button>
          )}

          <button
            type="button"
            className={styles.iconBtn}
            title={isMaximized ? t('common.close') : t('voice.watchStream')}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMaximize();
            }}
          >
            {isMaximized ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        </div>
      </div>

      {/* Bottom Name Bar */}
      <div className={styles.bottomBar}>
        <span className={styles.participantName}>{p.username}</span>
      </div>

      {/* Menu flutuante de configurações da transmissão */}
      <StreamSettingsMenu
        isOpen={showSettings}
        participantId={p.id}
        isWatching={isWatching}
        streamVolume={streamVolume}
        onVolumeChange={onStreamVolumeChange}
        onToggleWatch={onToggleWatchStream}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};
