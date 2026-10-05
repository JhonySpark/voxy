import React, { useRef, useEffect, useState } from 'react';
import styles from './ParticipantCard.module.css';
import { Mic, MicOff, Maximize, Minimize, Settings, MonitorUp, Eye, X, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsSpeaking } from '@livekit/components-react';
import { StreamSettingsMenu } from '../StreamSettingsMenu/StreamSettingsMenu';
import { DevStreamDiagnostics } from '../../../../components/DevStreamDiagnostics';

import { getMediaUrl } from '../../../../core/utils/media.util';
import { ReportModal } from '../../../moderation/components/ReportModal/ReportModal';
import { ReportTargetTypeEnum } from '../../../../core/enums';

interface ParticipantCardProps {
  participant: {
    id: string;
    username: string;
    isLocal: boolean;
    track: any;
    isStreaming: boolean;
    canToggleWatch: boolean;
    streamPreviewThumbnail?: string | null;
    hasVideo: boolean;
    isMuted: boolean;
    is18Plus?: boolean;
    lkParticipant: any;
    avatarUrl?: string | null;
    displayName?: string | null;
    nativeTelemetry?: any;
  };
  isMaximized: boolean;
  isHorizontal?: boolean;
  streamVolume: number;
  isWatching: boolean;
  canAccess18Plus?: boolean;
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
  canAccess18Plus = false,
  onToggleMaximize,
  onToggleWatchStream,
  onStreamVolumeChange,
  onViewUserProfile,
}) => {
  const { t } = useTranslation();
  const isSpeaking = useIsSpeaking(p.lkParticipant);
  const [showSettings, setShowSettings] = useState(false);
  const [isReportingStream, setIsReportingStream] = useState(false);
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
      style={{
        ...(isHorizontal ? { minWidth: '280px', maxWidth: '280px' } : {}),
        cursor: (p.hasVideo || (p.isStreaming && isWatching)) ? 'pointer' : 'default',
      }}
      onClick={() => {
        // Só maximiza se tiver vídeo ou se estiver assistindo transmissão
        if (p.hasVideo || (p.isStreaming && isWatching)) {
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
          {p.is18Plus && (
            <div style={{
              position: 'absolute',
              top: 10,
              left: 10,
              backgroundColor: '#ef4444',
              color: '#fff',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '4px',
              zIndex: 3,
            }}>
              18+
            </div>
          )}
          {import.meta.env.DEV && p.track && <DevStreamDiagnostics track={p.track} nativeTelemetry={p.nativeTelemetry} />}
        </div>
      ) : p.isStreaming ? (
        p.is18Plus && !canAccess18Plus ? (
          <div
            className={styles.streamPlaceholder}
            style={{ cursor: 'not-allowed', background: '#1c1924' }}
            title="Transmissão restrita para maiores de 18 anos"
          >
            <ShieldAlert size={40} color="#ef4444" />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', marginTop: '6px' }}>
              <span style={{
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: '4px'
              }}>18+</span>
              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#f87171' }}>Transmissão +18</span>
              <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>Restrito para maiores de idade</span>
            </div>
          </div>
        ) : (
          /* Stream não assistida ainda */
          <div
            className={styles.streamPlaceholder}
            onClick={(e) => {
              e.stopPropagation();
              onToggleWatchStream();
            }}
            title={t('voice.watchStream')}
          >
            {p.is18Plus && (
              <div style={{
                position: 'absolute',
                top: 10,
                left: 10,
                backgroundColor: '#ef4444',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: '4px',
                zIndex: 3,
              }}>
                18+
              </div>
            )}
            {p.streamPreviewThumbnail && (
              <>
                <img className={styles.streamPreviewImage} src={p.streamPreviewThumbnail} alt="Prévia da transmissão" />
                <div className={styles.streamPreviewShade} />
              </>
            )}
            <MonitorUp className={styles.streamPlaceholderIcon} size={36} color="var(--brand-primary, #34d399)" />
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
        )
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

          {/* Para o dono, fechar só esconde a prévia local; a transmissão
              continua ativa. Espectadores usam a engrenagem já existente. */}
          {p.isLocal && p.isStreaming && p.canToggleWatch && isWatching && (
            <button
              type="button"
              className={styles.iconBtn}
              title="Fechar prévia"
              onClick={(e) => {
                e.stopPropagation();
                onToggleWatchStream();
              }}
            >
              <X size={14} />
            </button>
          )}

          {/* Botão de maximizar apenas quando houver vídeo ou transmissão */}
          {(p.hasVideo || p.isStreaming || isMaximized) && (
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
          )}
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
        onReport={!p.isLocal ? () => setIsReportingStream(true) : undefined}
      />

      <ReportModal
        isOpen={isReportingStream}
        onClose={() => setIsReportingStream(false)}
        targetType={ReportTargetTypeEnum.STREAM}
        targetId={p.id}
        targetName={p.displayName || p.username}
      />
    </div>
  );
};
