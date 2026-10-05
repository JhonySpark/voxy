import React, { useRef, useState, useEffect } from "react";
import styles from "./MaximizedStreamView.module.css";
import { Settings, Fullscreen, Minimize, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { VideoRenderer } from "../VideoRenderer/VideoRenderer";
import { StreamSettingsMenu } from "../StreamSettingsMenu/StreamSettingsMenu";
import { DevStreamDiagnostics } from "../../../../components/DevStreamDiagnostics";
import { ReportModal } from "../../../moderation/components/ReportModal/ReportModal";
import { ReportTargetTypeEnum } from "../../../../core/enums";

import { getMediaUrl } from '../../../../core/utils/media.util';

interface MaximizedStreamViewProps {
  participant: {
    id: string;
    username: string;
    isLocal: boolean;
    track: any;
    isStreaming: boolean;
    canToggleWatch: boolean;
    hasVideo: boolean;
    isMuted: boolean;
    avatarUrl?: string | null;
    displayName?: string | null;
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
  const [isReportingStream, setIsReportingStream] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const avatarMedia = getMediaUrl(participant.avatarUrl);

  useEffect(() => {
    setAvatarFailed(false);
  }, [participant.avatarUrl]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
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
        padding: isFullscreen ? 0 : "1rem",
        gap: isFullscreen ? 0 : "1rem",
      }}
    >
      <div
        ref={fullscreenContainerRef}
        onMouseMove={handleContainerMouseMove}
        className={`${styles.fullscreenWrapper} ${isFullscreen ? styles.isFullscreen : ""} ${
          isFullscreen && !showControls ? styles.hideCursor : ""
        }`}
      >
        {participant.hasVideo ? (
          <>
            <VideoRenderer
              track={participant.track}
              className={styles.videoElement}
            />
            {import.meta.env.DEV && participant.track && (
              <DevStreamDiagnostics
                track={participant.track}
                nativeTelemetry={participant.nativeTelemetry}
              />
            )}
          </>
        ) : (
          <div className={styles.avatarPlaceholder}>
            {avatarMedia && !avatarFailed ? (
              <img
                src={avatarMedia}
                alt={participant.username}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <span>
                {participant.username === t("chat.you")
                  ? "ME"
                  : participant.username.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        )}

        {/*         {isFullscreen && (
          <button
            type="button"
            onClick={() => void document.exitFullscreen()}
            className={styles.exitFullscreenButton}
            title={t('voice.exitFullscreen', 'Sair da Tela Cheia')}
          >
            <Minimize size={18} />
            <span>Sair da tela cheia</span>
          </button>
        )} */}

        <div
          className={styles.userBadge}
          style={{ opacity: showControls ? 1 : 0 }}
        >
          {participant.displayName || participant.username}
        </div>

        <div
          className={styles.controlsBar}
          style={{
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? "auto" : "none",
          }}
        >
          {participant.isLocal && participant.isStreaming && participant.canToggleWatch && isWatching && (
            <button
              onClick={() => {
                onToggleWatchStream();
                onRestoreGrid();
              }}
              className={styles.controlButton}
              title="Fechar prévia"
            >
              <X size={20} />
            </button>
          )}

          {!participant.isLocal && participant.isStreaming && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={styles.controlButton}
              title={t("voice.streamSettings", "Configurações da Transmissão")}
            >
              <Settings size={20} />
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className={styles.controlButton}
            title={
              isFullscreen
                ? t("voice.exitFullscreen", "Sair da Tela Cheia")
                : t("voice.fullscreen", "Tela Cheia")
            }
          >
            {isFullscreen ? <Minimize size={20} /> : <Fullscreen size={20} />}
          </button>

          <button
            onClick={onRestoreGrid}
            className={styles.controlButton}
            title={t("voice.restoreGrid", "Restaurar Grid")}
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
          onReport={!participant.isLocal ? () => setIsReportingStream(true) : undefined}
        />
      </div>

      <ReportModal
        isOpen={isReportingStream}
        onClose={() => setIsReportingStream(false)}
        targetType={ReportTargetTypeEnum.STREAM}
        targetId={participant.id}
        targetName={participant.displayName || participant.username}
      />
    </div>
  );
};
