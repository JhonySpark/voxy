import React, { useRef, useState, useEffect } from 'react';
import styles from './MaximizedStreamView.module.css';
import { Settings, Fullscreen, Minimize } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { VideoRenderer } from '../VideoRenderer/VideoRenderer';
import { StreamSettingsMenu } from '../StreamSettingsMenu/StreamSettingsMenu';
import { DevStreamDiagnostics } from '../../../../components/DevStreamDiagnostics';

interface MaximizedStreamViewProps {
  participant: {
    id: string;
    username: string;
    isLocal: boolean;
    track: any;
    isStreaming: boolean;
    hasVideo: boolean;
    isMuted: boolean;
    nativeTelemetry?: any;
  };
  isWatching: boolean;
  streamVolume: number;
  onStreamVolumeChange: (val: number) => void;
  onToggleWatchStream: () => void;
  onRestoreGrid: () => void;
}

export const MaximizedStreamView: React.FC<MaximizedStreamViewProps> = ({
  participant,
  isWatching,
  streamVolume,
  onStreamVolumeChange,
  onToggleWatchStream,
  onRestoreGrid,
}) => {
  const { t } = useTranslation();
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleContainerMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isFullscreen) {
        setShowControls(false);
      }
    }, 2500);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      fullscreenContainerRef.current?.requestFullscreen();
    }
  };

  return (
    <div
      className={styles.container}
      style={{
        padding: isFullscreen ? 0 : '1rem',
        gap: isFullscreen ? 0 : '1rem',
      }}
    >
      <div
        ref={fullscreenContainerRef}
        onMouseMove={handleContainerMouseMove}
        className={`${styles.fullscreenWrapper} ${isFullscreen ? styles.isFullscreen : ''} ${
          isFullscreen && !showControls ? styles.hideCursor : ''
        }`}
      >
        {participant.hasVideo ? (
          <>
            <VideoRenderer track={participant.track} className={styles.videoElement} />
            {participant.track && <DevStreamDiagnostics track={participant.track} nativeTelemetry={participant.nativeTelemetry} />}
          </>
        ) : (
          <div className={styles.avatarPlaceholder}>
            {participant.username === t('chat.you') ? 'ME' : participant.username.charAt(0).toUpperCase()}
          </div>
        )}

        <div className={styles.userBadge} style={{ opacity: showControls ? 1 : 0 }}>
          {participant.username}
        </div>

        <div
          className={styles.controlsBar}
          style={{
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? 'auto' : 'none',
          }}
        >
          {!participant.isLocal && participant.isStreaming && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={styles.controlButton}
              title={t('voice.streamSettings', 'Configurações da Transmissão')}
            >
              <Settings size={20} />
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className={styles.controlButton}
            title={isFullscreen ? t('voice.exitFullscreen', 'Sair da Tela Cheia') : t('voice.fullscreen', 'Tela Cheia')}
          >
            {isFullscreen ? <Minimize size={20} /> : <Fullscreen size={20} />}
          </button>

          <button
            onClick={onRestoreGrid}
            className={styles.controlButton}
            title={t('voice.restoreGrid', 'Restaurar Grid')}
          >
            <Minimize size={20} />
          </button>
        </div>

        <StreamSettingsMenu
          isOpen={showSettings}
          participantId={participant.id}
          isWatching={isWatching}
          streamVolume={streamVolume}
          onVolumeChange={onStreamVolumeChange}
          onToggleWatch={onToggleWatchStream}
          onClose={() => setShowSettings(false)}
        />
      </div>
    </div>
  );
};
