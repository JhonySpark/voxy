import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  LiveKitRoom,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import {
  Track,
  LocalVideoTrack,
  LocalAudioTrack,
  VideoQuality,
  RoomEvent,
} from 'livekit-client';
import api from '../../../../api';
import styles from './VoiceRoom.module.css';
import chatConnectedSound from '../../../../assets/sounds/chat_connected.wav';
import chatDisconnectedSound from '../../../../assets/sounds/chat_disconected.wav';
import { useTranslation } from 'react-i18next';
import { ParticipantCard } from '../ParticipantCard/ParticipantCard';
import { VoiceControlBar } from '../VoiceControlBar/VoiceControlBar';
import { ShareScreenModal } from '../ShareScreenModal/ShareScreenModal';
import { SelectiveAudioRenderer } from '../SelectiveAudioRenderer';
import { MaximizedStreamView } from '../MaximizedStreamView/MaximizedStreamView';
import { ApiRoutes, IpcChannels, StreamFramerate, StreamResolution } from '../../../../core/enums';

declare const window: any;
const ipcRenderer = typeof window !== 'undefined' && window.require ? window.require('electron').ipcRenderer : null;

const MAX_STREAM_PREVIEW_BYTES = 24_000;

async function createStreamPreviewThumbnail(source: string | null): Promise<string | null> {
  if (!source) return null;

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const width = Math.min(320, image.naturalWidth || 320);
      const height = Math.max(1, Math.round(width * (image.naturalHeight || 180) / (image.naturalWidth || 320)));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return resolve(null);

      context.drawImage(image, 0, 0, width, height);
      const thumbnail = canvas.toDataURL('image/jpeg', 0.55);
      resolve(thumbnail.length <= MAX_STREAM_PREVIEW_BYTES ? thumbnail : null);
    };
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function getStreamPreviewThumbnail(metadata?: string): string | null {
  try {
    const thumbnail = JSON.parse(metadata || '{}').streamPreviewThumbnail;
    return typeof thumbnail === 'string'
      && thumbnail.length <= MAX_STREAM_PREVIEW_BYTES
      && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(thumbnail)
      ? thumbnail
      : null;
  } catch {
    return null;
  }
}

export interface VoiceRoomProps {
  channelId: string;
  serverId: string;
  myId: string;
  myUsername: string;
  userAgeClassification?: 'UNKNOWN' | 'CHILD' | 'TEEN' | 'ADULT';
  isMuted?: boolean;
  onDisconnect: () => void;
  onParticipantsChange: (participants: { id: string; username: string; isMuted?: boolean }[]) => void;
  onMuteChange?: (isMuted: boolean) => void;
  audioInput?: string;
  audioOutput?: string;
  userVolumes: Record<string, number>;
  onVolumeChange: (id: string, volume: number) => void;
  onSpeakersChange?: (speakers: string[]) => void;
  livekitUrl?: string;
  onViewUserProfile?: (userId: string) => void;
}

// Global hook in RTCPeerConnection to inject high bitrate floor and ceiling in SDP WebRTC
if (typeof window !== 'undefined' && window.RTCPeerConnection && !(window as any).__voxy_sdp_hooked) {
  (window as any).__voxy_sdp_hooked = true;
  const origSetLocalDescription = window.RTCPeerConnection.prototype.setLocalDescription;
  window.RTCPeerConnection.prototype.setLocalDescription = function (desc?: RTCLocalSessionDescriptionInit) {
    if (desc && desc.sdp && (desc.type === 'offer' || desc.type === 'answer')) {
      try {
        let sdp = desc.sdp;
        // Injeta limite de bandwidth na seção de vídeo de forma segura sem quebrar o BUNDLE
        sdp = sdp.replace(/(m=video\s+\d+\s+[^\r\n]*)/gi, `$1\r\nb=AS:16000\r\nb=TIAS:16000000`);
        desc = new RTCSessionDescription({ type: desc.type, sdp }) as any;
      } catch (err) {
        console.warn('[Voxy WebRTC] Erro ao otimizar SDP:', err);
      }
    }
    return (origSetLocalDescription as any).apply(this, [desc]);
  };
}

export const VoiceRoom: React.FC<VoiceRoomProps> = (props) => {
  const { t } = useTranslation();
  const [token, setToken] = useState<string>('');
  const [error, setError] = useState<string>('');

  const livekitUrl = import.meta.env.VITE_LIVEKIT_URL || 'wss://voxy-livekit.d4rkside.com.br';

  const roomOptions = useMemo(() => {
    return {
      adaptiveStream: false,
      dynacast: false,
      publishDefaults: {
        videoCodec: 'vp8' as const,
        degradationPreference: 'maintain-framerate' as RTCDegradationPreference,
        simulcast: false,
        screenShareEncoding: {
          maxBitrate: 12_000_000,
          maxFramerate: 60,
          priority: 'high' as const,
        },
      },
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let playedConnect = false;

    const timer = setTimeout(() => {
      if (mounted) {
        const audio = new Audio(chatConnectedSound);
        audio.volume = 0.3;
        audio.play().catch(console.error);
        playedConnect = true;
      }
    }, 1200);

    const fetchToken = async () => {
      try {
        const res = await api.post(`${ApiRoutes.CHANNELS}/${props.channelId}/voice-token`);
        if (mounted) {
          setToken(res.data.token);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.response?.data?.message || err.message);
        }
      }
    };

    fetchToken();

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (playedConnect) {
        const audioDisconnect = new Audio(chatDisconnectedSound);
        audioDisconnect.volume = 0.3;
        audioDisconnect.play().catch(console.error);
      }
    };
  }, [props.channelId]);

  if (error) {
    return (
      <div className={styles.connectingOverlay}>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button className="btn-primary" onClick={props.onDisconnect}>
          {t('voice.cancel')}
        </button>
      </div>
    );
  }

  if (!token) {
    return (
      <div className={styles.connectingOverlay}>
        <div className="btn-spinner" style={{ width: '32px', height: '32px' }} />
        <p>{t('voice.connecting')}</p>
      </div>
    );
  }

  const handleDisconnected = () => {
    // A transmissão nativa é um processo independente do LiveKitRoom do
    // renderer; encerra-o antes de limpar o estado da chamada.
    void ipcRenderer?.invoke('STOP_NATIVE_STREAM').catch(() => undefined);
    props.onDisconnect();
  };

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect={true}
      audio={props.audioInput ? { deviceId: props.audioInput } : true}
      video={false}
      options={roomOptions}
      onDisconnected={handleDisconnected}
      data-lk-theme="default"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <VoiceRoomInner {...props} livekitUrl={livekitUrl} />
    </LiveKitRoom>
  );
};

const VoiceRoomInner: React.FC<VoiceRoomProps> = ({
  onDisconnect,
  onParticipantsChange,
  onMuteChange,
  userVolumes,
  onSpeakersChange,
  livekitUrl,
  channelId,
  userAgeClassification,
  onViewUserProfile,
  isMuted: isMutedProp,
}) => {
  const { t } = useTranslation();
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const screenTracks = useTracks([Track.Source.ScreenShare]);
  const [screenTrack, setScreenTrack] = useState<LocalVideoTrack | null>(null);
  const [isNativeStreaming, setIsNativeStreaming] = useState(false);
  const [streamPreviewThumbnail, setStreamPreviewThumbnail] = useState<string | null>(null);
  const [nativeTelemetry, setNativeTelemetry] = useState<{ fps: number; mbps: number; encodeMs: number; totalFrames: number } | null>(null);
  const [internalMuted, setInternalMuted] = useState(false);
  const isMuted = typeof isMutedProp === 'boolean' ? isMutedProp : internalMuted;

  useEffect(() => {
    if (typeof isMutedProp === 'boolean' && localParticipant) {
      localParticipant.setMicrophoneEnabled(!isMutedProp).catch(console.error);
    }
  }, [isMutedProp, localParticipant]);
  const [showSources, setShowSources] = useState(false);
  const [categorizedSources, setCategorizedSources] = useState<{ games: any[]; windows: any[]; screens: any[] }>({
    games: [],
    windows: [],
    screens: [],
  });

  const [streamRes, setStreamRes] = useState<StreamResolution>(StreamResolution.HD_720);
  const [streamFps, setStreamFps] = useState<StreamFramerate>(StreamFramerate.FPS_30);
  const [shareGameAudio, setShareGameAudio] = useState(true);
  const [showDevDiagnostics, setShowDevDiagnostics] = useState(false);
  const [streamVolumes, setStreamVolumes] = useState<Record<string, number>>({});
  const [watchingStreams, setWatchingStreams] = useState<Set<string>>(new Set());
  const [maximizedId, setMaximizedId] = useState<string | null>(null);

  const prevParticipantsCount = useRef(0);
  const isInitialLoad = useRef(true);

  // Garante que o processo WGC/NVENC não sobreviva à saída da sala, inclusive
  // quando a desconexão é causada por rede, navegação ou desmontagem do React.
  useEffect(() => {
    return () => {
      void ipcRenderer?.invoke('STOP_NATIVE_STREAM').catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key !== 'F8' && event.code !== 'F8' && event.keyCode !== 119) || event.repeat) return;
      event.preventDefault();
      setShowDevDiagnostics((visible) => !visible);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Escuta telemetria do Pipeline Nativo C++ (WGC + NVENC + LiveKit C++)
  useEffect(() => {
    if (!ipcRenderer) return;

    const handleTelemetry = (_event: any, data: any) => {
      setNativeTelemetry(data);
    };

    const handleStopped = (_event: any, data: any) => {
      console.warn('[Voxy Stream] Stream nativo encerrado:', data);
      setIsNativeStreaming(false);
      setNativeTelemetry(null);
      setStreamPreviewThumbnail(null);
    };

    const handleNativeLog = (_event: any, data: { type: string; text: string }) => {
      if (data.type === 'stderr') {
        console.error(`%c[NativeStream C++] ${data.text}`, 'color: #ef4444; font-weight: bold;');
      } else if (data.type === 'exit') {
        console.warn(`%c[NativeStream C++] ${data.text}`, 'color: #eab308; font-weight: bold;');
      } else {
        console.log(`%c[NativeStream C++] ${data.text}`, 'color: #10b981;');
      }
    };

    ipcRenderer.on('NATIVE_STREAM_TELEMETRY', handleTelemetry);
    ipcRenderer.on('NATIVE_STREAM_STOPPED', handleStopped);
    ipcRenderer.on('NATIVE_STREAM_LOG', handleNativeLog);

    return () => {
      ipcRenderer.removeListener('NATIVE_STREAM_TELEMETRY', handleTelemetry);
      ipcRenderer.removeListener('NATIVE_STREAM_STOPPED', handleStopped);
      ipcRenderer.removeListener('NATIVE_STREAM_LOG', handleNativeLog);
    };
  }, []);

  // Notifica participantes para a barra/sidebar e toca som ao conectar novo participante
  useEffect(() => {
    const realParticipants = participants.filter((p) => !p.identity.endsWith('#screen'));

    onParticipantsChange(
      realParticipants.map((p) => ({
        id: p.identity,
        username: p.name || p.identity,
        isMuted: !p.isMicrophoneEnabled,
      }))
    );

    if (!isInitialLoad.current && prevParticipantsCount.current > 0) {
      if (realParticipants.length > prevParticipantsCount.current) {
        const audio = new Audio(chatConnectedSound);
        audio.volume = 0.3;
        audio.play().catch(console.error);
      }
    }

    prevParticipantsCount.current = realParticipants.length;
    isInitialLoad.current = false;
  }, [participants, onParticipantsChange]);

  // Escuta palestrantes ativos para feedback de fala
  useEffect(() => {
    if (!room || !onSpeakersChange) return;

    const handleSpeakersChanged = (speakers: any[]) => {
      onSpeakersChange(speakers.map((s) => s.identity));
    };

    room.on(RoomEvent.ActiveSpeakersChanged, handleSpeakersChanged);
    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, handleSpeakersChanged);
    };
  }, [room, onSpeakersChange]);

  // Gerenciamento de subscrição seletiva para economizar banda e cortar áudio não assistido
  useEffect(() => {
    participants.forEach((p) => {
      if (!p.isLocal) {
        const screenVideoPub = p.getTrackPublication(Track.Source.ScreenShare) as any;
        const screenAudioPub = p.getTrackPublication(Track.Source.ScreenShareAudio) as any;
        
        // Se for um participante de tela (#screen), o ID base é o ID do usuário correspondente
        const baseId = p.identity.endsWith('#screen') ? p.identity.slice(0, -'#screen'.length) : p.identity;
        
        // Não faça loopback automático da transmissão nativa do próprio usuário.
        // Ela volta da SFU como um participante "#screen" e decodificá-la sem
        // necessidade consome CPU continuamente. A prévia passa a ser opt-in.
        const isWatching = watchingStreams.has(baseId) || watchingStreams.has(p.identity);
        
        [screenVideoPub, screenAudioPub].forEach(pub => {
          if (pub) {
            if (typeof pub.setSubscribed === 'function' && pub.isSubscribed !== isWatching) {
              console.log('[Voxy Stream] Configurando subscrição de', p.identity, '-> isWatching =', isWatching);
              pub.setSubscribed(isWatching);
            }
            if (isWatching && pub.kind === 'video') {
              if (typeof pub.setVideoQuality === 'function') {
                pub.setVideoQuality(VideoQuality.HIGH);
              }
              if (typeof pub.setVideoFPS === 'function') {
                pub.setVideoFPS(60);
              }
            }
          }
        });
      }
    });
  }, [participants, watchingStreams]);

  // "Assistir" vale somente para a publicação atual. Se o streamer cair, a
  // publicação de tela some e removemos a intenção salva; quando o emissor
  // iniciar outra live, cada espectador deverá clicar novamente para assistir.
  useEffect(() => {
    const activeStreamOwners = new Set<string>();
    participants.forEach((p) => {
      const screenPublication = p.getTrackPublication(Track.Source.ScreenShare);
      if (screenPublication) {
        activeStreamOwners.add(
          p.identity.endsWith('#screen') ? p.identity.slice(0, -'#screen'.length) : p.identity,
        );
      }
    });

    setWatchingStreams((previous) => {
      const next = new Set([...previous].filter((id) => activeStreamOwners.has(id)));
      return next.size === previous.size ? previous : next;
    });
    setMaximizedId((current) => current && !activeStreamOwners.has(current) ? null : current);
  }, [participants]);

  const toggleWatchStream = (id: string) => {
    setWatchingStreams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (maximizedId === id) {
          setMaximizedId(null);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    if (isMutedProp === undefined) {
      setInternalMuted(nextMuted);
    }
    if (localParticipant) {
      localParticipant.setMicrophoneEnabled(!nextMuted).catch(console.error);
    }
    if (onMuteChange) {
      onMuteChange(nextMuted);
    }
  };

  const fetchDesktopSources = async () => {
    if (!ipcRenderer) return;
    try {
      let catSources = { games: [], windows: [], screens: [] };
      try {
        catSources = await ipcRenderer.invoke(IpcChannels.DESKTOP_CAPTURER_GET_CATEGORIZED_SOURCES);
      } catch {
        const raw = await ipcRenderer.invoke(IpcChannels.DESKTOP_CAPTURER_GET_SOURCES, {
          types: ['window', 'screen'],
          thumbnailSize: { width: 320, height: 180 },
        });
        catSources = {
          games: [],
          windows: raw.filter((s: any) => s.id.startsWith('window:')),
          screens: raw.filter((s: any) => s.id.startsWith('screen:')),
        };
      }
      setCategorizedSources(catSources);
      setShowSources(true);
    } catch (e) {
      console.error('Failed to fetch sources:', e);
    }
  };

  const toggleScreenShare = async () => {
    if (isNativeStreaming) {
      try {
        await ipcRenderer?.invoke('STOP_NATIVE_STREAM');
      } catch (err) {
        console.error('Error stopping native stream', err);
      }
      setIsNativeStreaming(false);
      setNativeTelemetry(null);
      setStreamPreviewThumbnail(null);
      return;
    }

    if (screenTrack) {
      try {
        await localParticipant.unpublishTrack(screenTrack);
        screenTrack.stop();
      } catch (err) {
        console.error('Error stopping screen share', err);
      }
      setScreenTrack(null);
      return;
    }

    if (ipcRenderer) {
      fetchDesktopSources();
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 2560, max: 3840 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 60, max: 60 },
          },
          audio: true,
        });
        const vTrack = stream.getVideoTracks()[0];
        const aTrack = stream.getAudioTracks()[0];

        if ('contentHint' in vTrack) {
          (vTrack as any).contentHint = 'motion';
        }

        const lkTrack = new LocalVideoTrack(vTrack);
        await localParticipant.publishTrack(lkTrack, {
          name: 'screen_share',
          source: Track.Source.ScreenShare,
          simulcast: false,
          videoCodec: 'vp8',
          // @ts-ignore
          degradationPreference: 'maintain-framerate',
          screenShareEncoding: {
            maxBitrate: 12000000,
            maxFramerate: 60,
            priority: 'high',
          },
          videoEncoding: {
            maxBitrate: 12000000,
            maxFramerate: 60,
            priority: 'high',
          },
        });
        setScreenTrack(lkTrack);

        if (lkTrack.sender) {
          try {
            const params = lkTrack.sender.getParameters();
            if (params.encodings && params.encodings.length > 0) {
              params.encodings[0].maxBitrate = 12000000;
              (params.encodings[0] as any).minBitrate = 6000000;
              params.encodings[0].maxFramerate = 60;
              params.encodings[0].scaleResolutionDownBy = 1.0;
              if ('networkPriority' in params.encodings[0]) {
                (params.encodings[0] as any).networkPriority = 'high';
              }
              // @ts-ignore
              params.degradationPreference = 'maintain-framerate';
              await lkTrack.sender.setParameters(params);
            }
          } catch (err) {
            console.warn('[Voxy WebRTC] Erro ao aplicar sender parameters:', err);
          }
        }

        vTrack.onended = () => {
          console.log('[Voxy Stream] Captura displayMedia encerrada pelo usuário/sistema.');
          toggleScreenShare();
        };

        if (aTrack) {
          const lkAudioTrack = new LocalAudioTrack(aTrack);
          await localParticipant.publishTrack(lkAudioTrack, {
            name: 'screen_audio',
            source: Track.Source.ScreenShareAudio,
          });
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const selectSource = async (sourceId: string, shareAudio: boolean = false, is18Plus: boolean = false) => {
    setShowSources(false);
    console.log('[Voxy Stream] selectSource chamado para fonte:', sourceId, { shareAudio, is18Plus });

    try {
      // Reaproveita a miniatura já gerada pelo seletor como pôster estático.
      // Isso dá contexto visual sem assinar/decodificar a própria live.
      const selectedSource = [
        ...categorizedSources.games,
        ...categorizedSources.windows,
        ...categorizedSources.screens,
      ].find((source: any) => source.id === sourceId);
      const selectedThumbnail = await createStreamPreviewThumbnail(
        typeof selectedSource?.thumbnail === 'string' ? selectedSource.thumbnail : null,
      );
      const is1080 = streamRes === StreamResolution.FHD_1080;
      const targetFps = streamFps === StreamFramerate.FPS_60 ? 60 : 30;
      const isWindow = sourceId.startsWith('window:');
      const hwndMatch = sourceId.match(/^window:(\d+)/);

      // Checa se o Pipeline Nativo C++ (WGC + NVENC + LiveKit C++) está disponível
      const isNativeSupported = isWindow && hwndMatch && ipcRenderer 
        ? await ipcRenderer.invoke('IS_NATIVE_STREAM_SUPPORTED').catch((err: unknown) => {
            console.warn('[Voxy Stream] Erro ao checar IS_NATIVE_STREAM_SUPPORTED:', err);
            return false;
          })
        : false;

      console.log('[Voxy Stream] Avaliação do stream nativo:', { isWindow, hwndMatch: hwndMatch?.[1], isNativeSupported });

      if (isNativeSupported && hwndMatch) {
        console.log('[Voxy Stream] Ativando Pipeline Nativo Zero-Copy (WGC + NVENC + LiveKit C++)...');
        const hwnd = hwndMatch[1];
        const targetWidth = is1080 ? 1920 : 1280;
        const targetHeight = is1080 ? 1080 : 720;
        const targetBitrate = is1080 ? (targetFps === 60 ? 15000000 : 10000000) : (targetFps === 60 ? 10000000 : 8000000);

        try {
          console.log('[Voxy Stream] Solicitando token de tela no backend...');
          const res = await api.post(`${ApiRoutes.CHANNELS}/${channelId}/voice-token?screen=true`);
          const streamToken = res.data.token;
          console.log('[Voxy Stream] Token recebido com sucesso. Disparando voxy_native_streamer...');

          await ipcRenderer.invoke('START_NATIVE_STREAM', {
            url: livekitUrl,
            token: streamToken,
            hwnd,
            width: targetWidth,
            height: targetHeight,
            fps: targetFps,
            bitrate: targetBitrate,
            thumbnail: selectedThumbnail || undefined,
            captureProcessAudio: shareAudio,
          });

          setIsNativeStreaming(true);
          setStreamPreviewThumbnail(selectedThumbnail);

          try {
            const existingMetadata = JSON.parse(localParticipant?.metadata || '{}');
            await localParticipant?.setMetadata(JSON.stringify({
              ...existingMetadata,
              is18Plus,
              streamPreviewThumbnail: selectedThumbnail,
            }));
          } catch (_) {}

          // O áudio do jogo é publicado pelo WASAPI por processo no streamer
          // nativo. Não inicie o loopback do Chromium: ele inclui a chamada.
          if (shareAudio && !isNativeSupported) {
            try {
              const aStream = await (navigator.mediaDevices as any).getUserMedia({
                audio: { mandatory: { chromeMediaSource: 'desktop' } },
                video: false,
              });
              const aTrack = aStream.getAudioTracks()[0];
              if (aTrack) {
                const lkAudioTrack = new LocalAudioTrack(aTrack);
                await localParticipant.publishTrack(lkAudioTrack, {
                  name: 'screen_audio',
                  source: Track.Source.ScreenShareAudio,
                });
              }
            } catch (err) {
              console.warn('[Voxy] Falha ao capturar áudio do sistema:', err);
            }
          }
          return;
        } catch (err) {
          console.error('[Voxy] Falha ao iniciar stream nativo, fazendo fallback para WebRTC padrão:', err);
        }
      }

      console.log('[Voxy Stream] Usando pipeline WebRTC padrão para captura de desktop...');
      const constraints: any = {
        // O fallback WebRTC nunca captura o mix do sistema, para não enviar
        // as vozes remotas de volta para a transmissão.
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: is1080 ? 1920 : 1280,
            maxWidth: is1080 ? 3840 : 2560,
            minHeight: is1080 ? 1080 : 720,
            maxHeight: is1080 ? 1080 : 720,
            minFrameRate: targetFps,
            maxFrameRate: targetFps,
          },
        },
      };

      const stream = await (navigator.mediaDevices as any).getUserMedia(constraints);
      const vTrack = stream.getVideoTracks()[0];
      const aTrack = stream.getAudioTracks()[0];

      if ('contentHint' in vTrack) {
        (vTrack as any).contentHint = 'motion';
      }

      const lkTrack = new LocalVideoTrack(vTrack);
      lkTrack.source = Track.Source.ScreenShare;
      const targetBitrate = is1080 ? (targetFps === 60 ? 12000000 : 8000000) : (targetFps === 60 ? 7000000 : 5000000);
      const minBitrate = is1080 ? (targetFps === 60 ? 6000000 : 4000000) : (targetFps === 60 ? 3500000 : 2500000);

      await localParticipant.publishTrack(lkTrack, {
        name: 'screen_share',
        source: Track.Source.ScreenShare,
        simulcast: false,
        videoCodec: 'vp8',
        // @ts-ignore
        degradationPreference: 'maintain-framerate',
        screenShareEncoding: {
          maxBitrate: targetBitrate,
          maxFramerate: targetFps,
          priority: 'high',
        },
        videoEncoding: {
          maxBitrate: targetBitrate,
          maxFramerate: targetFps,
          priority: 'high',
        },
      });
      if (selectedThumbnail || is18Plus) {
        try {
          const existingMetadata = JSON.parse(localParticipant.metadata || '{}');
          await localParticipant.setMetadata(JSON.stringify({
            ...existingMetadata,
            is18Plus: is18Plus === true,
            streamPreviewThumbnail: selectedThumbnail,
          }));
        } catch (error) {
          console.warn('[Voxy Stream] Could not publish stream thumbnail metadata:', error);
        }
      }
      setScreenTrack(lkTrack);
      setStreamPreviewThumbnail(selectedThumbnail);

      if (lkTrack.sender) {
        try {
          const params = lkTrack.sender.getParameters();
          if (params.encodings && params.encodings.length > 0) {
            params.encodings[0].maxBitrate = targetBitrate;
            (params.encodings[0] as any).minBitrate = minBitrate;
            params.encodings[0].maxFramerate = targetFps;
            params.encodings[0].scaleResolutionDownBy = 1.0;
            if ('networkPriority' in params.encodings[0]) {
              (params.encodings[0] as any).networkPriority = 'high';
            }
            // @ts-ignore
            params.degradationPreference = 'maintain-framerate';
            await lkTrack.sender.setParameters(params);
          }
        } catch (err) {
          console.warn('[Voxy WebRTC] Erro ao aplicar sender parameters:', err);
        }
      }

      vTrack.onended = () => {
        console.log('[Voxy Stream] Captura getUserMedia encerrada pelo usuário/sistema.');
        toggleScreenShare();
      };

      if (aTrack && shareAudio) {
        const lkAudioTrack = new LocalAudioTrack(aTrack);
        await localParticipant.publishTrack(lkAudioTrack, {
          name: 'screen_audio',
          source: Track.Source.ScreenShareAudio,
        });
      }
    } catch (e) {
      console.error('[Voxy Stream] Erro em selectSource:', e);
    }
  };

  // Agrupa participantes virtuais de tela (`userId#screen`)
  const screenParticipants = new Map<string, any>();
  participants.forEach((p) => {
    if (p.identity.endsWith('#screen')) {
      const baseId = p.identity.slice(0, -'#screen'.length);
      screenParticipants.set(baseId, p);
    }
  });

  // Mapeia tracks de tela recebidas ativas via useTracks
  const screenTrackMap = new Map<string, any>();
  screenTracks.forEach((tr) => {
    const vTrack = tr.publication?.videoTrack || (tr as any).track;
    if (vTrack) {
      screenTrackMap.set(tr.participant.identity, vTrack);
    }
  });

  const allParticipants = participants
    .filter((p) => !p.identity.endsWith('#screen'))
    .map((p) => {
      const screenPart = screenParticipants.get(p.identity);
      const screenPartPub = screenPart?.getTrackPublication(Track.Source.ScreenShare);
      const directPub = p.getTrackPublication(Track.Source.ScreenShare);
      const screenSharePub = screenPartPub || directPub;

      const remoteScreenVideo = screenTrackMap.get(`${p.identity}#screen`) 
        || screenTrackMap.get(p.identity) 
        || screenSharePub?.videoTrack;

      const isStreaming = p.isLocal ? (!!screenTrack || isNativeStreaming || !!screenSharePub) : !!screenSharePub;
      // O fallback WebRTC usa a track local diretamente e pode manter a prévia.
      // Já o streamer nativo só recebe/decode sua própria tela após o clique.
      const isWatching = p.isLocal ? !!screenTrack || watchingStreams.has(p.identity) : watchingStreams.has(p.identity);

      let activeTrack: any = null;

      if (p.isLocal) {
        if (screenTrack) {
          activeTrack = screenTrack;
        // A track da transmissão nativa pode continuar existindo depois do
        // unsubscribe, mas já não entrega frames. Só a renderize enquanto a
        // prévia estiver explicitamente ativa; caso contrário o card volta
        // imediatamente ao botão "Assistir transmissão".
        } else if (remoteScreenVideo && isWatching) {
          activeTrack = remoteScreenVideo;
        }
      } else if (remoteScreenVideo && isWatching) {
        activeTrack = remoteScreenVideo;
      }

      let avatarUrl: string | null = null;
      let displayName: string | null = null;
      try {
        if (p.metadata) {
          const meta = JSON.parse(p.metadata);
          avatarUrl = meta.avatarUrl || null;
          displayName = meta.displayName || null;
        }
      } catch (_) {}
      if (!avatarUrl && p.identity && !p.identity.endsWith('#screen')) {
        avatarUrl = `/storage/avatar/${p.identity}`;
      }

      let is18PlusStream = false;
      try {
        const metaStr = screenPart?.metadata || p.metadata;
        if (metaStr) {
          const parsed = JSON.parse(metaStr);
          is18PlusStream = parsed.is18Plus === true;
        }
      } catch (_) {}

      return {
        id: p.identity,
        username: p.isLocal ? t('chat.you') : p.name || p.identity,
        displayName: displayName || (p.isLocal ? t('chat.you') : p.name || p.identity),
        avatarUrl,
        isLocal: p.isLocal,
        track: activeTrack,
        isStreaming,
        isWatching,
        is18Plus: is18PlusStream,
        // A prévia do fallback WebRTC é uma track local direta e só para ao
        // encerrar o compartilhamento. A assinatura que pode ser ligada e
        // desligada é a transmissão nativa que volta da SFU.
        canToggleWatch: !p.isLocal || isNativeStreaming,
        streamPreviewThumbnail: p.isLocal
          ? streamPreviewThumbnail
          : getStreamPreviewThumbnail(screenPart?.metadata || p.metadata),
        hasVideo: !!activeTrack,
        isMuted: p.isLocal ? isMuted : !p.isMicrophoneEnabled,
        lkParticipant: p,
        nativeTelemetry: p.isLocal ? nativeTelemetry : null,
      };
    });

  // Se o participante maximizado fechar a câmera e a transmissão, volta para o grid automaticamente
  useEffect(() => {
    if (!maximizedId) return;
    const target = allParticipants.find((p) => p.id === maximizedId);
    if (!target || (!target.hasVideo && !target.isStreaming)) {
      setMaximizedId(null);
    }
  }, [maximizedId, allParticipants]);

  const activeMaximizedId = maximizedId;
  const maximizedParticipant = allParticipants.find(
    (p) => p.id === activeMaximizedId && (p.hasVideo || p.isStreaming)
  );

  return (
    <div className={styles.container}>
      <SelectiveAudioRenderer
        watchingStreams={watchingStreams}
        streamVolumes={streamVolumes}
        userVolumes={userVolumes}
      />

      {maximizedParticipant ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <MaximizedStreamView
            participant={maximizedParticipant}
            isWatching={maximizedParticipant.isWatching}
            streamVolume={streamVolumes[maximizedParticipant.id] ?? 100}
            onStreamVolumeChange={(val) =>
              setStreamVolumes((prev) => ({ ...prev, [maximizedParticipant.id]: val }))
            }
            onToggleWatchStream={() => toggleWatchStream(maximizedParticipant.id)}
            onRestoreGrid={() => setMaximizedId(null)}
          />

          <div className={styles.minimizedStrip}>
            {allParticipants
              .filter((p) => p.id !== activeMaximizedId)
              .map((p) => (
                <ParticipantCard
                  key={p.id}
                  participant={p}
                  isMaximized={false}
                  isHorizontal={true}
                  streamVolume={streamVolumes[p.id] ?? 100}
                  isWatching={p.isWatching}
                  canAccess18Plus={userAgeClassification === 'ADULT'}
                  onToggleMaximize={() => setMaximizedId(p.id)}
                  onToggleWatchStream={() => toggleWatchStream(p.id)}
                  onStreamVolumeChange={(val) =>
                    setStreamVolumes((prev) => ({ ...prev, [p.id]: val }))
                  }
                  onViewUserProfile={onViewUserProfile}
                />
              ))}
          </div>
        </div>
      ) : (
        <div className={styles.gridContainer}>
          <div className={styles.gridInner}>
            {allParticipants.map((p) => (
              <ParticipantCard
                key={p.id}
                participant={p}
                isMaximized={false}
                streamVolume={streamVolumes[p.id] ?? 100}
                isWatching={p.isWatching}
                canAccess18Plus={userAgeClassification === 'ADULT'}
                onToggleMaximize={() => setMaximizedId(p.id)}
                onToggleWatchStream={() => toggleWatchStream(p.id)}
                onStreamVolumeChange={(val) =>
                  setStreamVolumes((prev) => ({ ...prev, [p.id]: val }))
                }
                onViewUserProfile={onViewUserProfile}
              />
            ))}
          </div>
        </div>
      )}

      {/* Floating HUD for Native Streamer */}
      {import.meta.env.DEV && showDevDiagnostics && isNativeStreaming && (
        <div style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'rgba(15, 23, 42, 0.88)',
          border: '1px solid rgba(34, 197, 94, 0.45)',
          borderRadius: 8,
          padding: '6px 14px',
          color: '#22c55e',
          fontSize: 12,
          fontWeight: 600,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }} />
          <span>GPU NVENC Nativo (Zero-Copy)</span>
          {nativeTelemetry && (
            <span style={{ color: '#94a3b8', fontWeight: 400, borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: 8 }}>
              {nativeTelemetry.fps} FPS • {nativeTelemetry.mbps?.toFixed(1)} Mbps • {nativeTelemetry.encodeMs?.toFixed(1)}ms
            </span>
          )}
        </div>
      )}

      {/* Control Bar */}
      <VoiceControlBar
        isMuted={isMuted}
        isSharingScreen={!!screenTrack || isNativeStreaming}
        onToggleMute={toggleMute}
        onToggleScreenShare={toggleScreenShare}
        onDisconnect={onDisconnect}
      />

      {/* Modal de Compartilhamento de Tela */}
      <ShareScreenModal
        isOpen={showSources}
        categorizedSources={categorizedSources}
        streamRes={streamRes}
        streamFps={streamFps}
        shareAudio={shareGameAudio}
        userAgeClassification={userAgeClassification}
        onStreamResChange={setStreamRes}
        onStreamFpsChange={setStreamFps}
        onShareAudioChange={setShareGameAudio}
        onSelectSource={selectSource}
        onClose={() => setShowSources(false)}
      />
    </div>
  );
};

export default VoiceRoom;
