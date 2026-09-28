import React, { useEffect, useState, useRef } from 'react';
import { Minimize, Fullscreen, Settings } from 'lucide-react';
import { ipcRenderer } from 'electron';
import { useTranslation } from 'react-i18next';
import { LiveKitRoom, useParticipants, useLocalParticipant, useRoomContext } from '@livekit/components-react';
import { Track, TrackEvent, LocalVideoTrack, LocalAudioTrack, RoomEvent, VideoQuality } from 'livekit-client';
import api from '../api';
import chatConnectedSound from '../assets/sounds/chat_connected.wav';
import chatDisconnectedSound from '../assets/sounds/chat_disconected.wav';
import { DevStreamDiagnostics } from './DevStreamDiagnostics';
import { ParticipantCard } from '../features/voice/components/ParticipantCard/ParticipantCard';
import { VoiceControlBar } from '../features/voice/components/VoiceControlBar/VoiceControlBar';
import { ShareScreenModal } from '../features/voice/components/ShareScreenModal/ShareScreenModal';
import type { DesktopSource } from '../features/voice/components/ShareScreenModal/ShareScreenModal';
import { SelectiveAudioRenderer } from '../features/voice/components/SelectiveAudioRenderer';
import { StreamSettingsMenu } from '../features/voice/components/StreamSettingsMenu/StreamSettingsMenu';
import { ApiRoutes, IpcChannels } from '../core/enums';


interface VoiceRoomProps {
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

// Hook global no RTCPeerConnection para injetar piso e teto de bitrate alto no SDP WebRTC
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

export default function VoiceRoomWrapper(props: VoiceRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDisconnect = () => {
    props.onDisconnect();
  };

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

  if (error) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>Error: {error}</div>;
  if (!token) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Connecting to Voice...</div>;

  return (
    <LiveKitRoom
      video={false}
      audio={props.audioInput ? { deviceId: props.audioInput } : true}
      token={token}
      serverUrl={import.meta.env.VITE_LIVEKIT_URL}
      options={{
        adaptiveStream: false,
        dynacast: false,
        publishDefaults: {
          videoCodec: 'vp8',
          // @ts-ignore
          degradationPreference: 'maintain-resolution',
          simulcast: false,
        }
      }}
      onDisconnected={handleDisconnect}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <VoiceRoomInner {...props} onDisconnect={handleDisconnect} />
    </LiveKitRoom>
  );
}

function VoiceRoomInner({ onDisconnect, onParticipantsChange, onMuteChange, userVolumes, onSpeakersChange }: VoiceRoomProps) {
  const { t } = useTranslation();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const [watchingStreams, setWatchingStreams] = useState<Set<string>>(new Set());
  const [streamVolumes, setStreamVolumes] = useState<Record<string, number>>({});
  
  useEffect(() => {
    const handleSpeakersChanged = (speakers: any[]) => {
      if (onSpeakersChange) {
        onSpeakersChange(speakers.map(s => s.identity));
      }
    };
    room.on(RoomEvent.ActiveSpeakersChanged, handleSpeakersChanged);
    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, handleSpeakersChanged);
    };
  }, [room, onSpeakersChange]);
  
  const [isMuted, setIsMuted] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [maximizedId, setMaximizedId] = useState<string | null>(null);
  const [showStreamSettingsId, setShowStreamSettingsId] = useState<string | null>(null);
  const [screenTrack, setScreenTrack] = useState<LocalVideoTrack | null>(null);
  const [screenAudioTrack, setScreenAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [streamRes, setStreamRes] = useState<'720' | '1080'>('1080');
  const [streamFps, setStreamFps] = useState<'30' | '60'>('60');
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<any>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) {
        setShowControls(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleContainerMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (document.fullscreenElement) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const [categorizedSources, setCategorizedSources] = useState<{
    games: DesktopSource[];
    windows: DesktopSource[];
    screens: DesktopSource[];
  }>({ games: [], windows: [], screens: [] });

  // Controla subscrição das tracks remotas de tela e vídeo
  useEffect(() => {
    participants.forEach(p => {
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
    setWatchingStreams(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Se estava maximizado assistindo essa pessoa, desmaximiza para não ficar tela preta
        if (maximizedId === id) {
          setMaximizedId(null);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    onParticipantsChange(participants.map(p => ({ id: p.identity, username: p.name || p.identity })));
  }, [participants, onParticipantsChange]);

  const toggleMute = () => {
    if (localParticipant) {
      const audioEnabled = localParticipant.isMicrophoneEnabled;
      localParticipant.setMicrophoneEnabled(!audioEnabled);
      setIsMuted(audioEnabled);
      if (onMuteChange) onMuteChange(audioEnabled);
    }
  };

  const fetchDesktopSources = async () => {
    try {
      let catSources: any = null;
      try {
        catSources = await ipcRenderer.invoke(IpcChannels.DESKTOP_CAPTURER_GET_CATEGORIZED_SOURCES);
      } catch (e) {
        const raw = await ipcRenderer.invoke(IpcChannels.DESKTOP_CAPTURER_GET_SOURCES, { types: ['window', 'screen'] });
        catSources = {
          games: [],
          windows: raw.filter((s: any) => !s.id.startsWith('screen:')),
          screens: raw.filter((s: any) => s.id.startsWith('screen:'))
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
      await localParticipant.unpublishTrack(screenTrack);
      screenTrack.stop();
      setScreenTrack(null);
      if (screenAudioTrack) {
        await localParticipant.unpublishTrack(screenAudioTrack);
        screenAudioTrack.stop();
        setScreenAudioTrack(null);
      }
    } else {
      await fetchDesktopSources();
    }
  };

  const selectSource = async (sourceId: string) => {
    setShowSources(false);
    try {
      const is720p = streamRes === '720';
      const targetFps = streamFps === '30' ? 30 : 60;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // @ts-ignore
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId
          }
        },
        video: {
          // @ts-ignore
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: is720p ? 1280 : 1920,
            maxWidth: is720p ? 1280 : 1920,
            minHeight: is720p ? 720 : 1080,
            maxHeight: is720p ? 720 : 1080,
            minFrameRate: targetFps,
            maxFrameRate: targetFps
          }
        }
      });

      const videoTrack = stream.getVideoTracks()[0];
      const track = new LocalVideoTrack(videoTrack, undefined, false);
      const isUltra60 = targetFps === 60;
      const maxBps = isUltra60 ? 12_000_000 : 7_000_000;

      await localParticipant.publishTrack(track, {
        source: Track.Source.ScreenShare,
        videoCodec: 'vp8',
        videoEncoding: {
          maxBitrate: maxBps,
          maxFramerate: targetFps
        },
        // @ts-ignore
        degradationPreference: 'maintain-framerate',
        simulcast: false
      });
      setScreenTrack(track);

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        const audioTrack = new LocalAudioTrack(audioTracks[0]);
        await localParticipant.publishTrack(audioTrack, { source: Track.Source.ScreenShareAudio });
        setScreenAudioTrack(audioTrack);
      }
      track.on(TrackEvent.Muted, () => toggleScreenShare());
    } catch (e) {
      console.error(e);
    }
  };

  const allParticipants = participants.map(p => {
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
      username: p.isLocal ? t('chat.you') : (p.name || p.identity),
      isLocal: p.isLocal,
      track: activeTrack,
      isStreaming,
      hasVideo: !!activeTrack,
      isMuted: p.isLocal ? isMuted : !p.isMicrophoneEnabled,
      lkParticipant: p
    };
  });

  const activeMaximizedId = maximizedId;
  const maximizedParticipant = allParticipants.find(p => p.id === activeMaximizedId);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary, #0b0f17)', minHeight: 0, height: '100%' }}>
      {/* Renderizador de Áudio Seletivo para Microfone e Transmissão */}
      <SelectiveAudioRenderer
        watchingStreams={watchingStreams}
        streamVolumes={streamVolumes}
        userVolumes={userVolumes}
      />

      {maximizedParticipant ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: isFullscreen ? 0 : '1rem', gap: isFullscreen ? 0 : '1rem', overflow: 'hidden', minHeight: 0 }}>
          <div 
            ref={fullscreenContainerRef} 
            onMouseMove={handleContainerMouseMove}
            style={{ 
              flex: 1, 
              backgroundColor: '#000', 
              borderRadius: isFullscreen ? 0 : '1rem', 
              border: isFullscreen ? 'none' : '1px solid rgba(255, 255, 255, 0.08)', 
              overflow: 'hidden', 
              position: 'relative', 
              minHeight: 0,
              cursor: isFullscreen && !showControls ? 'none' : 'default'
            }}
          >
             {maximizedParticipant.hasVideo ? (
               <VideoRenderer track={maximizedParticipant.track} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
             ) : (
               <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'var(--brand-primary, #34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', margin: 'auto', position: 'absolute', inset: 0 }}>
                 {maximizedParticipant.username === t('chat.you') ? 'ME' : maximizedParticipant.username.charAt(0).toUpperCase()}
               </div>
             )}
             <div style={{ 
               position: 'absolute', 
               bottom: '1rem', 
               left: '1rem', 
               backgroundColor: 'rgba(0,0,0,0.7)', 
               padding: '0.5rem 1rem', 
               borderRadius: '6px', 
               fontSize: '0.9rem', 
               color: 'white',
               opacity: showControls ? 1 : 0,
               transition: 'opacity 0.25s ease',
               pointerEvents: 'none',
               zIndex: 20
             }}>
               {maximizedParticipant.username}
             </div>
             <div style={{ 
               position: 'absolute', 
               bottom: '1.5rem', 
               right: '1.5rem', 
               display: 'flex', 
               gap: '0.5rem',
               opacity: showControls ? 1 : 0,
               transition: 'opacity 0.25s ease',
               pointerEvents: showControls ? 'auto' : 'none',
               zIndex: 20
             }}>
               {!maximizedParticipant.isLocal && maximizedParticipant.isStreaming && (
                 <button 
                   onClick={() => setShowStreamSettingsId(showStreamSettingsId === maximizedParticipant.id ? null : maximizedParticipant.id)} 
                   className="icon-btn" 
                   style={{ backgroundColor: 'rgba(15, 19, 28, 0.95)', color: 'white', borderRadius: '8px', padding: '0.5rem' }} 
                   title="Configurações da Transmissão"
                 >
                   <Settings size={20} />
                 </button>
               )}
               <button onClick={() => {
                 if (document.fullscreenElement) {
                   document.exitFullscreen();
                 } else {
                   fullscreenContainerRef.current?.requestFullscreen();
                 }
               }} className="icon-btn" style={{ backgroundColor: 'rgba(15, 19, 28, 0.95)', color: 'white', borderRadius: '8px', padding: '0.5rem' }} title="Tela Cheia">
                 {isFullscreen ? <Minimize size={20} /> : <Fullscreen size={20} />}
               </button>
               <button onClick={() => setMaximizedId(null)} className="icon-btn" style={{ backgroundColor: 'rgba(15, 19, 28, 0.95)', color: 'white', borderRadius: '8px', padding: '0.5rem' }} title="Restaurar Grid">
                 <Minimize size={20} />
               </button>
             </div>

             <StreamSettingsMenu
               isOpen={showStreamSettingsId === maximizedParticipant.id}
               participantId={maximizedParticipant.id}
               isWatching={watchingStreams.has(maximizedParticipant.id)}
               streamVolume={streamVolumes[maximizedParticipant.id] ?? 100}
               onVolumeChange={(val) => setStreamVolumes(prev => ({ ...prev, [maximizedParticipant.id]: val }))}
               onToggleWatch={() => toggleWatchStream(maximizedParticipant.id)}
               onClose={() => setShowStreamSettingsId(null)}
             />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem', paddingBottom: '7rem', overflowY: 'auto', maxHeight: '30vh' }}>
            {allParticipants.filter(p => p.id !== activeMaximizedId).map(p => (
              <ParticipantCard
                key={p.id}
                participant={p}
                isMaximized={false}
                isHorizontal={true}
                streamVolume={streamVolumes[p.id] ?? 100}
                isWatching={p.isLocal || watchingStreams.has(p.id)}
                onToggleMaximize={() => setMaximizedId(p.id)}
                onToggleWatchStream={() => toggleWatchStream(p.id)}
                onStreamVolumeChange={(val) => setStreamVolumes(prev => ({ ...prev, [p.id]: val }))}
              />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0, padding: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', width: '100%', maxWidth: '1400px', margin: 'auto' }}>
            {allParticipants.map(p => (
              <ParticipantCard
                key={p.id}
                participant={p}
                isMaximized={false}
                streamVolume={streamVolumes[p.id] ?? 100}
                isWatching={p.isLocal || watchingStreams.has(p.id)}
                onToggleMaximize={() => setMaximizedId(p.id)}
                onToggleWatchStream={() => toggleWatchStream(p.id)}
                onStreamVolumeChange={(val) => setStreamVolumes(prev => ({ ...prev, [p.id]: val }))}
              />
            ))}
          </div>
        </div>
      )}

      {/* Barra de controle inferior */}
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
}

function VideoRenderer({ track, style, className }: { track: any; style?: React.CSSProperties; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !track) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  return (
    <>
      {import.meta.env.DEV && <DevStreamDiagnostics track={track} />}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={style}
        className={className}
      />
    </>
  );
}
