import React, { useState, useEffect, useRef } from 'react';
import styles from './AttachmentRenderer.module.css';
import { Play, Pause, FileText, Download, X } from 'lucide-react';
import api from '../../../../api';
import type { ChatAttachment } from '../ChatArea/ChatArea';

interface AttachmentRendererProps {
  attachment: ChatAttachment;
}

// Cache em memória para URLs pré-assinadas temporárias durante a sessão
const urlCache = new Map<string, { downloadUrl: string; thumbnailUrl?: string }>();

export const AttachmentRenderer: React.FC<AttachmentRendererProps> = React.memo(({ attachment }) => {
  const [urls, setUrls] = useState<{ downloadUrl?: string; thumbnailUrl?: string }>(() => {
    if (attachment.downloadUrl || attachment.url) {
      return {
        downloadUrl: attachment.downloadUrl || attachment.url,
        thumbnailUrl: attachment.thumbnailUrl,
      };
    }
    const cached = urlCache.get(attachment.id);
    if (cached) {
      return cached;
    }
    return {};
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const estimatedDuration = Math.max(1, Math.round(attachment.fileSize / 4000));
  const [duration, setDuration] = useState<number>(estimatedDuration);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState<string>('0:00');
  const [showLightbox, setShowLightbox] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const formatAudioTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Inicializa o tempo exibido com a duração estimada ou formatada
  useEffect(() => {
    if (!isPlaying) {
      setAudioCurrentTime(formatAudioTime(duration));
    }
  }, [duration, isPlaying]);

  useEffect(() => {
    // Se já tivermos a URL em cache ou passada diretamente, usamos ela
    if (urls.downloadUrl) return;

    if (urlCache.has(attachment.id)) {
      setUrls(urlCache.get(attachment.id)!);
      return;
    }

    let isMounted = true;
    const fetchSignedUrl = async () => {
      try {
        const res = await api.get(`/storage/attachment/${attachment.id}/url`);
        if (isMounted && res.data) {
          urlCache.set(attachment.id, res.data);
          setUrls(res.data);
        }
      } catch (err) {
        console.error('Erro ao buscar URL do anexo:', err);
      }
    };

    fetchSignedUrl();
    return () => {
      isMounted = false;
    };
  }, [attachment.id, urls.downloadUrl]);

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    const dur = audioRef.current.duration;
    if (isFinite(dur) && dur > 0) {
      setDuration(dur);
      if (!isPlaying) {
        setAudioCurrentTime(formatAudioTime(dur));
      }
    }
  };

  const toggleAudioPlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioRef.current.ended) {
        audioRef.current.currentTime = 0;
      }
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    const current = audioRef.current.currentTime;
    const dur =
      isFinite(audioRef.current.duration) && audioRef.current.duration > 0
        ? audioRef.current.duration
        : duration;
    setAudioProgress((current / dur) * 100);
    setAudioCurrentTime(formatAudioTime(current));
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setAudioProgress(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    const total =
      audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0
        ? audioRef.current.duration
        : duration;
    setAudioCurrentTime(formatAudioTime(total));
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const dur =
      isFinite(audioRef.current.duration) && audioRef.current.duration > 0
        ? audioRef.current.duration
        : duration;
    audioRef.current.currentTime = ratio * dur;
  };

  // 1. Renderização de Imagem
  if (attachment.fileType === 'IMAGE') {
    const displaySrc = urls.thumbnailUrl || urls.downloadUrl;
    return (
      <div className={styles.attachmentContainer}>
        <div className={styles.imageWrapper} onClick={() => setShowLightbox(true)}>
          {displaySrc ? (
            <img
              src={displaySrc}
              alt={attachment.fileName}
              className={styles.chatImage}
              loading="eager"
            />
          ) : (
            <div style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
              Carregando imagem...
            </div>
          )}
        </div>

        {/* Modal Lightbox ao clicar na imagem */}
        {showLightbox && urls.downloadUrl && (
          <div className={styles.lightboxOverlay} onClick={() => setShowLightbox(false)}>
            <button className={styles.lightboxClose} onClick={() => setShowLightbox(false)}>
              <X size={20} />
            </button>
            <img
              src={urls.downloadUrl}
              alt={attachment.fileName}
              className={styles.lightboxImage}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    );
  }

  // 2. Renderização de Áudio de Voz (WhatsApp Style)
  if (attachment.fileType === 'AUDIO') {
    return (
      <div className={styles.audioAttachment}>
        <div className={styles.audioPlayer}>
          {urls.downloadUrl && (
            <audio
              ref={audioRef}
              src={urls.downloadUrl}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={handleAudioTimeUpdate}
              onEnded={handleAudioEnded}
              preload="metadata"
            />
          )}

          <button
            type="button"
            className={styles.playButton}
            onClick={toggleAudioPlay}
            disabled={!urls.downloadUrl}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
          </button>

          <div className={styles.audioInfo}>
            <div className={styles.audioProgressBar} onClick={handleSeek}>
              <div
                className={styles.audioProgressFill}
                style={{ width: `${audioProgress}%` }}
              />
            </div>
            <div className={styles.audioTimeRow}>
              <span className={styles.audioTime}>{audioCurrentTime}</span>
              <span className={styles.audioSize}>{formatFileSize(attachment.fileSize)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. Renderização de Vídeo
  if (attachment.fileType === 'VIDEO') {
    return (
      <div className={styles.attachmentContainer}>
        <div className={styles.videoWrapper}>
          <video
            src={urls.downloadUrl}
            poster={urls.thumbnailUrl}
            controls
            playsInline
            preload="metadata"
            className={styles.chatVideo}
          />
        </div>
      </div>
    );
  }

  // 4. Renderização de Documento Geral
  return (
    <div className={styles.attachmentContainer}>
      <a
        href={urls.downloadUrl || '#'}
        target="_blank"
        rel="noopener noreferrer"
        download={attachment.fileName}
        className={styles.docCard}
      >
        <FileText size={28} className={styles.docIcon} />
        <div className={styles.docMeta}>
          <span className={styles.docName} title={attachment.fileName}>
            {attachment.fileName}
          </span>
          <span className={styles.docSize}>{formatFileSize(attachment.fileSize)}</span>
        </div>
        <Download size={18} className={styles.downloadIcon} />
      </a>
    </div>
  );
});
