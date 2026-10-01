import React, { useRef, useEffect, useState } from 'react';
import styles from './ParticipantCard.module.css';
import { Mic, MicOff, Maximize, Minimize, Settings, MonitorUp, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsSpeaking } from '@livekit/components-react';
import { StreamSettingsMenu } from '../StreamSettingsMenu/StreamSettingsMenu';
import { DevStreamDiagnostics } from '../../../../components/DevStreamDiagnostics';

import { getMediaUrl } from '../../../../core/utils/media.util';

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
    avatarUrl?: string | null;
    displayName?: string | null;
    nativeTelemetry?: any;
  };
  isMaximized: boolean;
  isHorizontal?: boolean;
  streamVolume: number;
  isWatching: boolean;
  onToggleMaximize: () => void;
  onToggleWatchStream: () => void;
  onStreamVolumeChange: (vol: number) => void;
  onViewUserProfile?: (userId: string) => void;
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
  onViewUserProfile,
}) => {
  const { t } = useTranslation();
  const isSpeaking = useIsSpeaking(p.lkParticipant);
  const [showSettings, setShowSettings] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarMedia = getMediaUrl(p.avatarUrl);

  useEffect(() => {
    setAvatarFailed(false);
  }, [p.avatarUrl]);

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
          {import.meta.env.DEV && p.track && <DevStreamDiagnostics track={p.track} nativeTelemetry={p.nativeTelemetry} />}
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
          <div 
            className={styles.avatarCircle}
            onClick={(e) => {
              if (onViewUserProfile) {
                e.stopPropagation();
                onViewUserProfile(p.id);
              }
            }}
            style={{ cursor: onViewUserProfile ? 'pointer' : 'default', overflow: 'hidden', position: 'relative' }}
            title={`Ver perfil de ${p.username}`}
          >
            {avatarMedia && !avatarFailed ? (
              <img
                src={avatarMedia}
                alt={p.username}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {p.username === t('chat.you') ? 'ME' : p.username.charAt(0).toUpperCase()}
              </span>
            )}
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
        <span 
          className={styles.participantName}
          onClick={(e) => {
            if (onViewUserProfile) {
              e.stopPropagation();
              onViewUserProfile(p.id);
            }
          }}
          style={{ cursor: onViewUserProfile ? 'pointer' : 'default' }}
          title={`Ver perfil de ${p.username}`}
        >
          {p.displayName || p.username}
        </span>
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
