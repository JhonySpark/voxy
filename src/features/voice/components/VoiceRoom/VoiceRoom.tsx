import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  LiveKitRoom,
  useParticipants,
  useLocalParticipant,
  useRoomContext,
  RoomAudioRenderer,
} from '@livekit/components-react';
import {
  Track,
  TrackEvent,
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

export interface VoiceRoomProps {
  channelId: string;
  serverId: string;
  myId: string;
  myUsername: string;
  onDisconnect: () => void;
  onParticipantsChange: (participants: { id: string; username: string; isMuted?: boolean }[]) => void;
  onMuteChange?: (isMuted: boolean) => void;
  audioInput?: string;
  audioOutput?: string;
  userVolumes: Record<string, number>;
  onVolumeChange: (id: string, volume: number) => void;
  onSpeakersChange?: (speakers: string[]) => void;
}

// Global hook in RTCPeerConnection to inject high bitrate floor and ceiling in SDP WebRTC
if (typeof window !== 'undefined' && window.RTCPeerConnection && !(window as any).__voxy_sdp_hooked) {
  (window as any).__voxy_sdp_hooked = true;
  const origSetLocalDescription = window.RTCPeerConnection.prototype.setLocalDescription;
  window.RTCPeerConnection.prototype.setLocalDescription = function (desc?: RTCLocalSessionDescriptionInit) {
    if (desc && desc.sdp && (desc.type === 'offer' || desc.type === 'answer')) {
      try {
        let sdp = desc.sdp;
        sdp = sdp.replace(/(m=video\s+\d+\s+[^\r\n]*)/gi, `$1\r\nb=AS:12000\r\nb=TIAS:12000000`);

        const vp8Match = sdp.match(/a=rtpmap:(\d+)\s+VP8\/90000/i);
        if (vp8Match) {
          const pt = vp8Match[1];
          const fmtpRegex = new RegExp(`(a=fmtp:${pt}\\s+[^\\r\\n]*)`, 'i');
          if (fmtpRegex.test(sdp)) {
            sdp = sdp.replace(fmtpRegex, `$1;x-google-min-bitrate=4500;x-google-max-bitrate=14000;x-google-start-bitrate=7000`);
          } else {
            sdp = sdp.replace(vp8Match[0], `${vp8Match[0]}\r\na=fmtp:${pt} x-google-min-bitrate=4500;x-google-max-bitrate=14000;x-google-start-bitrate=7000`);
          }
        }
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
        degradationPreference: 'maintain-resolution' as RTCDegradationPreference,
        simulcast: false,
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

  return (
    <LiveKitRoom
      token={token}
      serverUrl={livekitUrl}
      connect={true}
      audio={props.audioInput ? { deviceId: props.audioInput } : true}
      video={false}
      options={roomOptions}
      onDisconnected={props.onDisconnect}
      data-lk-theme="default"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <VoiceRoomInner {...props} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
};

const VoiceRoomInner: React.FC<VoiceRoomProps> = ({
  onDisconnect,
  onParticipantsChange,
  onMuteChange,
  userVolumes,
  onSpeakersChange,
}) => {
  const { t } = useTranslation();
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [screenTrack, setScreenTrack] = useState<LocalVideoTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [categorizedSources, setCategorizedSources] = useState<{ games: any[]; windows: any[]; screens: any[] }>({
    games: [],
    windows: [],
    screens: [],
  });

  const [streamRes, setStreamRes] = useState<StreamResolution>(StreamResolution.HD_720);
  const [streamFps, setStreamFps] = useState<StreamFramerate>(StreamFramerate.FPS_30);
  const [streamVolumes, setStreamVolumes] = useState<Record<string, number>>({});
  const [watchingStreams, setWatchingStreams] = useState<Set<string>>(new Set());
  const [maximizedId, setMaximizedId] = useState<string | null>(null);

  const prevParticipantsCount = useRef(0);
  const isInitialLoad = useRef(true);

  // Notifica participantes para a barra/sidebar e toca som ao conectar novo participante
  useEffect(() => {
    onParticipantsChange(
      participants.map((p) => ({
        id: p.identity,
        username: p.name || p.identity,
        isMuted: !p.isMicrophoneEnabled,
      }))
    );

    if (!isInitialLoad.current && prevParticipantsCount.current > 0) {
      if (participants.length > prevParticipantsCount.current) {
        const audio = new Audio(chatConnectedSound);
        audio.volume = 0.3;
        audio.play().catch(console.error);
      }
    }

    prevParticipantsCount.current = participants.length;
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

  // Gerenciamento de subscrição seletiva para economizar banda
  useEffect(() => {
    participants.forEach((p) => {
      if (!p.isLocal) {
        const screenPub = p.getTrackPublication(Track.Source.ScreenShare) as any;
        const isWatching = watchingStreams.has(p.identity);
        if (screenPub) {
          if (typeof screenPub.setSubscribed === 'function' && screenPub.isSubscribed !== isWatching) {
            screenPub.setSubscribed(isWatching);
          }
          if (isWatching) {
            if (typeof screenPub.setVideoQuality === 'function') {
              screenPub.setVideoQuality(VideoQuality.HIGH);
            }
            if (typeof screenPub.setVideoFPS === 'function') {
              screenPub.setVideoFPS(60);
            }
          }
        }
      }
    });
  }, [participants, watchingStreams]);

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
    if (localParticipant) {
      const nextMuted = !isMuted;
      localParticipant.setMicrophoneEnabled(!nextMuted);
      setIsMuted(nextMuted);
      if (onMuteChange) {
        onMuteChange(nextMuted);
      }
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
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 60, max: 60 },
          },
          audio: true,
        });
        const vTrack = stream.getVideoTracks()[0];
        const aTrack = stream.getAudioTracks()[0];

        const lkTrack = new LocalVideoTrack(vTrack);
        await localParticipant.publishTrack(lkTrack, {
          name: 'screen_share',
          source: Track.Source.ScreenShare,
          simulcast: false,
          videoCodec: 'vp8',
        });
        setScreenTrack(lkTrack);

        lkTrack.on(TrackEvent.Muted, () => toggleScreenShare());
        vTrack.onended = () => toggleScreenShare();

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

  const selectSource = async (sourceId: string, shareAudio: boolean = false) => {
    setShowSources(false);
    try {
      const is1080 = streamRes === StreamResolution.FHD_1080;
      const targetFps = streamFps === StreamFramerate.FPS_60 ? 60 : 30;

      const constraints: any = {
        audio: shareAudio
          ? {
              mandatory: {
                chromeMediaSource: 'desktop',
              },
            }
          : false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: is1080 ? 1920 : 1280,
            maxWidth: is1080 ? 1920 : 1280,
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

      const lkTrack = new LocalVideoTrack(vTrack);
      await localParticipant.publishTrack(lkTrack, {
        name: 'screen_share',
        source: Track.Source.ScreenShare,
        simulcast: false,
        videoCodec: 'vp8',
      });
      setScreenTrack(lkTrack);

      lkTrack.on(TrackEvent.Muted, () => toggleScreenShare());
      vTrack.onended = () => toggleScreenShare();

      if (aTrack && shareAudio) {
        const lkAudioTrack = new LocalAudioTrack(aTrack);
        await localParticipant.publishTrack(lkAudioTrack, {
          name: 'screen_audio',
          source: Track.Source.ScreenShareAudio,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const allParticipants = participants.map((p) => {
    const screenSharePub = p.getTrackPublication(Track.Source.ScreenShare);
    const hasScreenShare = screenSharePub?.isSubscribed && screenSharePub?.videoTrack;
    const isStreaming = p.isLocal ? !!screenTrack : !!screenSharePub;
    const isWatching = p.isLocal || watchingStreams.has(p.identity);

    let activeTrack: any = null;

    if (p.isLocal && screenTrack) {
      activeTrack = screenTrack;
    } else if (hasScreenShare && isWatching) {
      activeTrack = screenSharePub.videoTrack;
    }

    return {
      id: p.identity,
      username: p.isLocal ? t('chat.you') : p.name || p.identity,
      isLocal: p.isLocal,
      track: activeTrack,
      isStreaming,
      hasVideo: !!activeTrack,
      isMuted: p.isLocal ? isMuted : !p.isMicrophoneEnabled,
      lkParticipant: p,
    };
  });

  const activeMaximizedId = maximizedId;
  const maximizedParticipant = allParticipants.find((p) => p.id === activeMaximizedId);

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
            isWatching={maximizedParticipant.isLocal || watchingStreams.has(maximizedParticipant.id)}
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
                  isWatching={p.isLocal || watchingStreams.has(p.id)}
                  onToggleMaximize={() => setMaximizedId(p.id)}
                  onToggleWatchStream={() => toggleWatchStream(p.id)}
                  onStreamVolumeChange={(val) =>
                    setStreamVolumes((prev) => ({ ...prev, [p.id]: val }))
                  }
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
                isWatching={p.isLocal || watchingStreams.has(p.id)}
                onToggleMaximize={() => setMaximizedId(p.id)}
                onToggleWatchStream={() => toggleWatchStream(p.id)}
                onStreamVolumeChange={(val) =>
                  setStreamVolumes((prev) => ({ ...prev, [p.id]: val }))
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Control Bar */}
      <VoiceControlBar
        isMuted={isMuted}
        isSharingScreen={!!screenTrack}
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
        onStreamResChange={setStreamRes}
        onStreamFpsChange={setStreamFps}
        onSelectSource={selectSource}
        onClose={() => setShowSources(false)}
      />
    </div>
  );
};

export default VoiceRoom;
