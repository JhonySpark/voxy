import { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, MonitorUp, MonitorOff, PhoneOff, Maximize, Minimize, Fullscreen, Settings, VolumeX, Volume2, Gamepad2, AppWindow, Monitor } from 'lucide-react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import { ipcRenderer } from 'electron';
import { useTranslation } from 'react-i18next';
import { LiveKitRoom, useParticipants, useLocalParticipant, RoomAudioRenderer, useRoomContext, useIsSpeaking } from '@livekit/components-react';
import { Track, TrackEvent, LocalVideoTrack, LocalAudioTrack, RoomEvent, VideoQuality } from 'livekit-client';
import api from '../api';
import chatConnectedSound from '../assets/sounds/chat_connected.wav';
import chatDisconnectedSound from '../assets/sounds/chat_disconected.wav';
import { DevStreamDiagnostics } from './DevStreamDiagnostics';

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
// Isso destrava o Google Congestion Control (GCC) para nunca derrubar a taxa abaixo de 4.5 Mbps mesmo com RTT alto
if (typeof window !== 'undefined' && window.RTCPeerConnection && !(window as any).__voxy_sdp_hooked) {
  (window as any).__voxy_sdp_hooked = true;
  const origSetLocalDescription = window.RTCPeerConnection.prototype.setLocalDescription;
  window.RTCPeerConnection.prototype.setLocalDescription = function(desc?: RTCLocalSessionDescriptionInit) {
    if (desc && desc.sdp && (desc.type === 'offer' || desc.type === 'answer')) {
      try {
        let sdp = desc.sdp;
        // Injeta b=AS (12 Mbps) e b=TIAS nas seções de vídeo
        sdp = sdp.replace(/(m=video\s+\d+\s+[^\r\n]*)/gi, `$1\r\nb=AS:12000\r\nb=TIAS:12000000`);

        // Injeta parâmetros de bitrate dedicados para o codec VP8
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
    }, 100);

    // Fetch token from backend
    const fetchToken = async () => {
      try {
        const res = await api.post(`/channels/${props.channelId}/voice-token`);
        const data = res.data;
        if (data.token) {
          setToken(data.token);
        } else {
          setError(data.message || data.error || 'Unknown error fetching token');
        }
      } catch (e: any) {
        console.error('Failed to get token', e);
        setError(e.message);
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

  if (error) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>Error: {error}</div>;
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
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function VoiceRoomInner({ onDisconnect, onParticipantsChange, onMuteChange, audioOutput, userVolumes, onVolumeChange, onSpeakersChange }: VoiceRoomProps) {
  const { t } = useTranslation();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const prevParticipantsCount = useRef(0);
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

  // Estados do Game Detector estilo Discord
  const [categorizedSources, setCategorizedSources] = useState<{
    games: any[];
    windows: any[];
    screens: any[];
  }>({ games: [], windows: [], screens: [] });
  const [activeSourceTab, setActiveSourceTab] = useState<'games' | 'windows' | 'screens'>('games');

  useEffect(() => {
    if (audioOutput && (navigator as any).setSinkId) {
      // Future logic to sync sinkId with RoomAudioRenderer if needed.
    }
  }, [audioOutput]);

  useEffect(() => {
    if (audioOutput && (navigator as any).setSinkId) {
       // LiveKit RoomAudioRenderer handles sinkId
    }
  }, [audioOutput]);

  // Microphone volume effect
  useEffect(() => {
    participants.forEach(p => {
      if (!p.isLocal) {
        const pub = p.getTrackPublication(Track.Source.Microphone);
        const track = pub?.audioTrack as any;
        if (track && typeof track.setVolume === 'function') {
          const vol = userVolumes[p.identity] ?? 100;
          track.setVolume(Math.min(vol / 100, 1.0));
        }
      }
    });
  }, [userVolumes, participants]);

  // Screen share audio volume effect
  useEffect(() => {
    participants.forEach(p => {
      if (!p.isLocal) {
        const screenAudioPub = p.getTrackPublication(Track.Source.ScreenShareAudio);
        const screenAudioTrack = screenAudioPub?.audioTrack as any;
        if (screenAudioTrack) {
          const streamVol = streamVolumes[p.identity] ?? 100;
          const shouldBeMuted = !watchingStreams.has(p.identity) || streamVol === 0;
          
          if (screenAudioTrack.mediaStreamTrack) {
             screenAudioTrack.mediaStreamTrack.enabled = !shouldBeMuted;
          }

          if (!shouldBeMuted && typeof screenAudioTrack.setVolume === 'function') {
             screenAudioTrack.setVolume(Math.min(streamVol / 100, 1.0));
          }
        }
      }
    });
  }, [streamVolumes, participants, watchingStreams]);

  // Efeito de subscrição de qualidade máxima para o espectador
  useEffect(() => {
    participants.forEach(p => {
      if (!p.isLocal) {
        const screenPub = p.getTrackPublication(Track.Source.ScreenShare) as any;
        if (screenPub) {
          const isWatching = watchingStreams.has(p.identity);
          if (isWatching) {
            if (typeof screenPub.setEnabled === 'function') {
              screenPub.setEnabled(true);
            }
            if (typeof screenPub.setVideoQuality === 'function') {
              screenPub.setVideoQuality(VideoQuality.HIGH);
            }
            if (typeof screenPub.setVideoFPS === 'function') {
              screenPub.setVideoFPS(60);
            }
          } else {
            if (typeof screenPub.setEnabled === 'function') {
              screenPub.setEnabled(false);
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
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isInitialLoad = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialLoad.current = false;
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    onParticipantsChange(participants.map(p => ({ id: p.identity, username: p.name || p.identity })));
    
    if (!isInitialLoad.current && prevParticipantsCount.current > 0) {
      if (participants.length > prevParticipantsCount.current) {
        const audio = new Audio(chatConnectedSound);
        audio.volume = 0.3;
        audio.play().catch(console.error);
      } else if (participants.length < prevParticipantsCount.current) {
        const audio = new Audio(chatDisconnectedSound);
        audio.volume = 0.3;
        audio.play().catch(console.error);
      }
    }
    
    prevParticipantsCount.current = participants.length;
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
        catSources = await ipcRenderer.invoke('DESKTOP_CAPTURER_GET_CATEGORIZED_SOURCES');
      } catch (e) {
        const raw = await ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', { types: ['window', 'screen'] });
        catSources = {
          games: [],
          windows: raw.filter((s: any) => !s.id.startsWith('screen:')),
          screens: raw.filter((s: any) => s.id.startsWith('screen:'))
        };
      }
      setCategorizedSources(catSources);
      if (catSources.games && catSources.games.length > 0) {
        setActiveSourceTab('games');
      } else if (catSources.windows && catSources.windows.length > 0) {
        setActiveSourceTab('windows');
      } else {
        setActiveSourceTab('screens');
      }
      setShowSources(true);
    } catch (e) {
      console.error('Failed to fetch sources:', e);
    }
  };

  const [screenAudioTrack, setScreenAudioTrack] = useState<any | null>(null);

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
      fetchDesktopSources();
    }
  };

  const selectSource = async (sourceId: string) => {
    setShowSources(false);
    try {
      const is1080 = streamRes === '1080';
      const fps = parseInt(streamFps, 10);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId
          }
        } as any,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            maxWidth: is1080 ? 1920 : 1280,
            maxHeight: is1080 ? 1080 : 720,
            minFrameRate: fps,
            maxFrameRate: fps
          }
        } as any
      });
      
      const videoTrack = stream.getVideoTracks()[0];
      
      // Preserva nitidez e detalhes finos (texturas, miras e elementos gráficos) em jogos 3D
      if ('contentHint' in videoTrack) {
        (videoTrack as any).contentHint = 'detail';
      }

      const track = new LocalVideoTrack(videoTrack);
      // Bitrates dedicados para jogos em movimento (evita pixelização e borrões em cenas rápidas)
      const targetBitrate = is1080 ? (fps === 60 ? 9000000 : 7000000) : (fps === 60 ? 6000000 : 4800000);
      const minBitrate = is1080 ? (fps === 60 ? 5500000 : 4000000) : (fps === 60 ? 3500000 : 3000000);

      await localParticipant.publishTrack(track, { 
        source: Track.Source.ScreenShare,
        videoCodec: 'vp8',
        videoEncoding: { 
          maxBitrate: targetBitrate, 
          maxFramerate: fps,
          priority: 'high'
        },
        simulcast: false,
        // @ts-ignore
        degradationPreference: 'maintain-resolution'
      });
      setScreenTrack(track);

      // Trava taxa de quadros e garante piso de bitrate para acelerador de hardware H264 (NVENC)
      if (track.sender) {
        try {
          const params = track.sender.getParameters();
          if (params.encodings && params.encodings.length > 0) {
            params.encodings[0].maxBitrate = targetBitrate;
            (params.encodings[0] as any).minBitrate = minBitrate;
            params.encodings[0].maxFramerate = fps;
            params.encodings[0].scaleResolutionDownBy = 1.0;
            if ('networkPriority' in params.encodings[0]) {
              (params.encodings[0] as any).networkPriority = 'high';
            }
            // @ts-ignore
            params.degradationPreference = 'maintain-framerate';
            await track.sender.setParameters(params);
          }
        } catch (err) {
          console.warn('Could not set custom sender parameters', err);
        }
      }

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

  let activeMaximizedId = maximizedId;
  const maximizedParticipant = allParticipants.find(p => p.id === activeMaximizedId);
  if (!maximizedParticipant) {
    activeMaximizedId = null;
  }

  const renderParticipantBox = (p: any, isHorizontal: boolean = false) => {
    return (
      <ParticipantBox 
        key={p.id}
        p={p} 
        isHorizontal={isHorizontal} 
        userVolumes={userVolumes} 
        onVolumeChange={onVolumeChange} 
        activeMaximizedId={activeMaximizedId} 
        setMaximizedId={setMaximizedId} 
        toggleWatchStream={toggleWatchStream} 
        t={t}
        pCount={allParticipants.length}
      />
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', minHeight: 0, height: '100%' }}>
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
               <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', margin: 'auto', position: 'absolute', inset: 0 }}>
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
                   style={{ backgroundColor: 'rgba(15, 19, 28, 0.95)', color: 'white', borderRadius: '8px' }} 
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
               }} className="icon-btn" style={{ backgroundColor: 'rgba(15, 19, 28, 0.95)', color: 'white', borderRadius: '8px' }} title="Tela Cheia">
                 {isFullscreen ? <Minimize size={20} /> : <Fullscreen size={20} />}
               </button>
               <button onClick={() => setMaximizedId(null)} className="icon-btn" style={{ backgroundColor: 'rgba(15, 19, 28, 0.95)', color: 'white', borderRadius: '8px' }} title="Desfocar">
                 <Minimize size={20} />
               </button>
             </div>

             {showStreamSettingsId === maximizedParticipant.id && (
               <div style={{ position: 'absolute', top: '3.5rem', right: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '1rem', width: '250px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100 }}>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                   <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Configurações da Transmissão</div>
                   
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                     <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Volume da Transmissão</label>
                     <Slider.Root className="slider-root" value={[streamVolumes[maximizedParticipant.id] ?? 100]} max={200} step={1} onValueChange={(vals) => setStreamVolumes(prev => ({ ...prev, [maximizedParticipant.id]: vals[0] }))}>
                       <Slider.Track className="slider-track"><Slider.Range className="slider-range" /></Slider.Track>
                       <Slider.Thumb className="slider-thumb" />
                     </Slider.Root>
                   </div>
                   
                   <button 
                     onClick={() => {
                        const current = streamVolumes[maximizedParticipant.id] ?? 100;
                        setStreamVolumes(prev => ({ ...prev, [maximizedParticipant.id]: current === 0 ? 100 : 0 }));
                     }} 
                     className="btn btn-secondary" 
                     style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.5rem' }}
                   >
                     { (streamVolumes[maximizedParticipant.id] === 0) ? <Volume2 size={16} /> : <VolumeX size={16} /> }
                     { (streamVolumes[maximizedParticipant.id] === 0) ? 'Desmutar Transmissão' : 'Mutar Transmissão' }
                   </button>

                   <button 
                     onClick={() => {
                        toggleWatchStream(maximizedParticipant.id);
                        setShowStreamSettingsId(null);
                     }} 
                     className="btn btn-danger" 
                     style={{ padding: '0.5rem' }}
                   >
                     Parar de Assistir
                   </button>
                 </div>
               </div>
             )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem', paddingBottom: '7rem', overflowY: 'auto', maxHeight: '30vh' }}>
            {allParticipants.filter(p => p.id !== activeMaximizedId).map(p => renderParticipantBox(p, true))}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
          <div style={{ flex: '1 1 auto', minHeight: '1rem' }} />
          <div style={{ width: '100%', padding: '0 1.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
            {allParticipants.map(p => renderParticipantBox(p, false))}
          </div>
          <div style={{ flex: '1 1 auto', minHeight: '2rem' }} />
        </div>
      )}

      <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'center', gap: '1rem', flexShrink: 0, position: 'relative', zIndex: 40 }}>
        <button onClick={toggleMute} className="icon-btn" style={{ backgroundColor: 'var(--bg-secondary)', width: '48px', height: '48px', borderRadius: '50%', color: isMuted ? 'var(--danger)' : 'var(--brand-primary)', border: isMuted ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(52,211,153,0.2)', transition: 'all 0.2s' }}>
          {isMuted ? <MicOff /> : <Mic />}
        </button>
        <button onClick={toggleScreenShare} className="icon-btn" style={{ backgroundColor: screenTrack ? 'var(--bg-secondary)' : 'var(--brand-primary)', width: '48px', height: '48px', borderRadius: '50%', color: screenTrack ? 'var(--brand-primary)' : '#000', border: screenTrack ? '1px solid rgba(52,211,153,0.2)' : 'none', transition: 'all 0.2s' }}>
          {screenTrack ? <MonitorOff /> : <MonitorUp />}
        </button>
        <button onClick={onDisconnect} className="icon-btn" style={{ backgroundColor: '#ef4444', width: '48px', height: '48px', borderRadius: '50%', color: 'white', border: 'none', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}>
          <PhoneOff />
        </button>
      </div>

      {showSources && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.8rem', width: '100%', maxWidth: '850px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: '1.2rem', backgroundColor: '#0f131c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.2rem', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ backgroundColor: 'rgba(52, 211, 153, 0.1)', padding: '0.5rem', borderRadius: '10px', color: 'var(--brand-primary)', display: 'flex' }}>
                  <Gamepad2 size={24} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>Compartilhar Tela & Jogos</h2>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Transmissão com aceleração por hardware nativa</span>
                </div>
              </div>

              {/* Qualidade e FPS Selector */}
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Resolução:</label>
                  <select value={streamRes} onChange={e => setStreamRes(e.target.value as '720' | '1080')} style={{ backgroundColor: 'transparent', color: 'white', border: 'none', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    <option value="720" style={{ backgroundColor: '#131824' }}>720p</option>
                    <option value="1080" style={{ backgroundColor: '#131824' }}>1080p (Pro)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Taxa:</label>
                  <select value={streamFps} onChange={e => setStreamFps(e.target.value as '30' | '60')} style={{ backgroundColor: 'transparent', color: streamFps === '60' ? 'var(--brand-primary)' : 'white', border: 'none', fontSize: '0.85rem', outline: 'none', cursor: 'pointer', fontWeight: 700 }}>
                    <option value="30" style={{ backgroundColor: '#131824', color: 'white' }}>30 FPS</option>
                    <option value="60" style={{ backgroundColor: '#131824', color: '#34d399' }}>60 FPS (Ultra)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Navigation Tabs estilo Discord */}
            <div style={{ display: 'flex', gap: '0.6rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.6rem' }}>
              <button 
                onClick={() => setActiveSourceTab('games')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: activeSourceTab === 'games' ? 'var(--brand-primary)' : 'rgba(255,255,255,0.05)',
                  color: activeSourceTab === 'games' ? '#0b0f17' : 'var(--text-secondary)',
                  transition: 'all 0.2s'
                }}
              >
                <Gamepad2 size={16} />
                Jogos
                {categorizedSources.games.length > 0 && (
                  <span style={{ backgroundColor: activeSourceTab === 'games' ? '#0b0f17' : 'rgba(52,211,153,0.2)', color: activeSourceTab === 'games' ? '#34d399' : 'var(--brand-primary)', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>
                    {categorizedSources.games.length}
                  </span>
                )}
              </button>

              <button 
                onClick={() => setActiveSourceTab('windows')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: activeSourceTab === 'windows' ? 'var(--brand-primary)' : 'rgba(255,255,255,0.05)',
                  color: activeSourceTab === 'windows' ? '#0b0f17' : 'var(--text-secondary)',
                  transition: 'all 0.2s'
                }}
              >
                <AppWindow size={16} />
                Aplicativos ({categorizedSources.windows.length})
              </button>

              <button 
                onClick={() => setActiveSourceTab('screens')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: activeSourceTab === 'screens' ? 'var(--brand-primary)' : 'rgba(255,255,255,0.05)',
                  color: activeSourceTab === 'screens' ? '#0b0f17' : 'var(--text-secondary)',
                  transition: 'all 0.2s'
                }}
              >
                <Monitor size={16} />
                Telas Inteiras ({categorizedSources.screens.length})
              </button>
            </div>

            {/* Grid de Fontes */}
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '48vh', paddingRight: '0.3rem' }}>
              {(() => {
                const currentList = activeSourceTab === 'games' ? categorizedSources.games : activeSourceTab === 'windows' ? categorizedSources.windows : categorizedSources.screens;

                if (currentList.length === 0) {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', gap: '0.8rem', textAlign: 'center' }}>
                      <Gamepad2 size={42} style={{ opacity: 0.3 }} />
                      <p style={{ margin: 0, fontSize: '0.95rem' }}>
                        {activeSourceTab === 'games' 
                          ? 'Nenhum jogo 3D em execução detectado no momento.' 
                          : 'Nenhuma janela detectada nesta categoria.'}
                      </p>
                      {activeSourceTab === 'games' && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Abra o seu jogo ou escolha na aba <strong>Aplicativos</strong> ou <strong>Telas Inteiras</strong>.
                        </span>
                      )}
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                    {currentList.map(s => (
                      <div 
                        key={s.id} 
                        onClick={() => selectSource(s.id)} 
                        style={{ 
                          cursor: 'pointer', 
                          backgroundColor: 'rgba(255,255,255,0.03)', 
                          border: s.isGame ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(255, 255, 255, 0.06)', 
                          borderRadius: '10px', 
                          overflow: 'hidden', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          transition: 'all 0.2s ease',
                          position: 'relative'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'var(--brand-primary)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = s.isGame ? 'rgba(52,211,153,0.3)' : 'rgba(255, 255, 255, 0.06)';
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        {/* Thumbnail Preview */}
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: '#000', overflow: 'hidden' }}>
                          <img src={s.thumbnail} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          {s.isGame && (
                            <div style={{ position: 'absolute', top: '0.4rem', right: '0.4rem', backgroundColor: 'rgba(16, 185, 129, 0.9)', color: '#000', fontSize: '0.65rem', fontWeight: 800, padding: '0.2rem 0.4rem', borderRadius: '4px', letterSpacing: '0.5px' }}>
                              60 FPS PRO
                            </div>
                          )}
                        </div>

                        {/* Title and App Icon */}
                        <div style={{ padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(0,0,0,0.3)' }}>
                          {s.appIcon ? (
                            <img src={s.appIcon} alt="" style={{ width: '18px', height: '18px', borderRadius: '3px', flexShrink: 0 }} />
                          ) : s.isGame ? (
                            <Gamepad2 size={16} color="var(--brand-primary)" style={{ flexShrink: 0 }} />
                          ) : (
                            <AppWindow size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                          )}
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.name}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => setShowSources(false)} className="btn-secondary" style={{ padding: '0.5rem 1.2rem', borderRadius: '8px' }}>
                {t('voice.cancel')}
              </button>
            </div>

          </div>
        </div>
      )}
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

function ParticipantBox({ p, isHorizontal, userVolumes, onVolumeChange, activeMaximizedId, setMaximizedId, toggleWatchStream, t, pCount }: any) {
  const isSpeaking = useIsSpeaking(p.lkParticipant);
  const vol = userVolumes[p.id] ?? 100;
  
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div 
           onClick={() => setMaximizedId(p.id === activeMaximizedId ? null : p.id)}
           style={{ 
             backgroundColor: 'var(--bg-secondary)', 
             border: isSpeaking ? '2px solid var(--brand-primary)' : '1px solid rgba(255, 255, 255, 0.05)',
             boxShadow: isSpeaking ? '0 0 15px rgba(52, 211, 153, 0.2)' : '0 4px 12px rgba(0,0,0,0.2)',
             transition: 'all 0.2s ease',
             borderRadius: '1rem', 
             overflow: 'hidden', 
             position: 'relative', 
             cursor: 'pointer',
             display: 'flex', 
             alignItems: 'center', 
             justifyContent: 'center',
             aspectRatio: '4/3',
             ...(isHorizontal ? { 
               minWidth: '280px', 
               maxWidth: '280px', 
             } : { 
               width: pCount === 1 ? '100%' : pCount === 2 ? 'calc(50% - 1rem)' : 'calc(33.333% - 1rem)',
               minWidth: '140px',
               maxWidth: pCount === 1 ? '800px' : '450px',
             }),
           }}
        >
          {/* Background Video or Avatar */}
          {p.hasVideo ? (
            <VideoRenderer track={p.track} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000', zIndex: 0 }} />
          ) : p.isStreaming && !p.isLocal ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', height: '100%', backgroundColor: '#000', zIndex: 0 }}>
               <MonitorUp size={32} color="var(--brand-primary)" />
               <button onClick={(e) => { e.stopPropagation(); toggleWatchStream(p.id); }} className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>Assistir Transmissão</button>
            </div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)', zIndex: 0 }}>
               <div style={{ 
                 width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', 
                 display: 'flex', alignItems: 'center', justifyContent: 'center', 
                 fontSize: '2rem', color: 'var(--text-primary)', border: isSpeaking ? '2px solid var(--brand-primary)' : '1px solid rgba(255,255,255,0.1)',
                 boxShadow: isSpeaking ? '0 0 20px rgba(52, 211, 153, 0.3)' : 'none', transition: 'all 0.2s'
               }}>
                 {p.username === t('chat.you') ? 'ME' : p.username.charAt(0).toUpperCase()}
               </div>
            </div>
          )}

          {/* Top Row: Mic & Maximize */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.75rem' }}>
            <div style={{ 
              backgroundColor: p.isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.6)', 
              padding: '0.35rem', 
              borderRadius: '50%', 
              color: p.isMuted ? '#ef4444' : (isSpeaking ? 'var(--brand-primary)' : 'var(--text-muted)'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: p.isMuted ? '0 0 10px rgba(239, 68, 68, 0.4)' : 'none'
            }}>
              {p.isMuted ? <MicOff size={14} /> : <Mic size={14} />}
            </div>
            
            <div style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: '0.3rem', borderRadius: '6px', color: 'var(--text-muted)' }}>
              {p.id === activeMaximizedId ? <Minimize size={14} /> : <Maximize size={14} />}
            </div>
          </div>

          {/* Bottom Row: Name Band */}
          <div style={{ 
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, margin: '0.5rem',
            backgroundColor: 'rgba(15, 19, 28, 0.85)', backdropFilter: 'blur(12px)', 
            padding: '0.4rem 0.75rem', borderRadius: '6px', 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            width: 'calc(100% - 1rem)'
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.username}
            </span>
            
            {isSpeaking && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '16px' }}>
                <div style={{ width: '3px', height: '60%', backgroundColor: 'var(--brand-primary)', borderRadius: '2px', animation: 'pulse 1s infinite' }} />
                <div style={{ width: '3px', height: '100%', backgroundColor: 'var(--brand-primary)', borderRadius: '2px', animation: 'pulse 0.8s infinite reverse' }} />
                <div style={{ width: '3px', height: '40%', backgroundColor: 'var(--brand-primary)', borderRadius: '2px', animation: 'pulse 1.2s infinite' }} />
              </div>
            )}
            {!isSpeaking && p.isStreaming && !p.isLocal && (
               <span style={{ fontSize: '0.7rem', color: 'var(--brand-primary)' }}>AO VIVO</span>
            )}
          </div>
        </div>
      </ContextMenu.Trigger>
      
      {!p.isLocal && (
        <ContextMenu.Portal>
          <ContextMenu.Content className="context-menu-content" style={{ zIndex: 9999 }}>
            <ContextMenu.Item className="context-menu-item">Perfil</ContextMenu.Item>
            <ContextMenu.Item className="context-menu-item" style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px', paddingBottom: '8px' }}>Mensagem</ContextMenu.Item>
            
            <div className="context-menu-label">Volume do Microfone</div>
            <div className="context-menu-slider-container">
               <Slider.Root className="slider-root" value={[vol]} max={200} step={1} onValueChange={(vals) => onVolumeChange(p.id, vals[0])}>
                 <Slider.Track className="slider-track"><Slider.Range className="slider-range" /></Slider.Track>
                 <Slider.Thumb className="slider-thumb" />
               </Slider.Root>
            </div>

            <ContextMenu.Item className="context-menu-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Silenciar <Switch.Root className="switch-root"><Switch.Thumb className="switch-thumb" /></Switch.Root>
            </ContextMenu.Item>
            <ContextMenu.Item className="context-menu-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Desativar vídeo <Switch.Root className="switch-root"><Switch.Thumb className="switch-thumb" /></Switch.Root>
            </ContextMenu.Item>
            
            <ContextMenu.Separator className="context-menu-separator" />
            
            <ContextMenu.Item className="context-menu-item context-menu-item-danger">Bloquear</ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      )}
    </ContextMenu.Root>
  );
}
