import { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, MonitorUp, MonitorOff, PhoneOff, Maximize, Minimize, Fullscreen, Settings, VolumeX, Volume2 } from 'lucide-react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import { ipcRenderer } from 'electron';
import { useTranslation } from 'react-i18next';
import { LiveKitRoom, useParticipants, useLocalParticipant, RoomAudioRenderer, useRoomContext, useIsSpeaking } from '@livekit/components-react';
import { Track, TrackEvent, LocalVideoTrack, LocalAudioTrack, RoomEvent } from 'livekit-client';
import api from '../api';
import chatConnectedSound from '../assets/sounds/chat_connected.wav';
import chatDisconnectedSound from '../assets/sounds/chat_disconected.wav';

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
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          videoCodec: 'h264',
          // @ts-ignore
          degradationPreference: 'maintain-framerate',
          screenShareEncoding: {
            maxBitrate: 8000000,
            maxFramerate: 60,
            priority: 'high',
          },
          simulcast: true,
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
  const [sources, setSources] = useState<any[]>([]);
  const [showSources, setShowSources] = useState(false);
  const [maximizedId, setMaximizedId] = useState<string | null>(null);
  const [showStreamSettingsId, setShowStreamSettingsId] = useState<string | null>(null);
  const [screenTrack, setScreenTrack] = useState<LocalVideoTrack | null>(null);
  const [streamRes, setStreamRes] = useState<'720' | '1080'>('720');
  const [streamFps, setStreamFps] = useState<'30' | '60'>('30');
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (audioOutput && (navigator as any).setSinkId) {
      // Future logic to sync sinkId with RoomAudioRenderer if needed.
    }
  }, [audioOutput]);

  useEffect(() => {
    if (audioOutput && (navigator as any).setSinkId) {
       // LiveKit RoomAudioRenderer creates audio elements automatically.
       // The best way to change output is via livekit's Room object, but since we are using components, 
       // RoomAudioRenderer handles it if the room's default output is changed, or we can just let it be 
       // since it's hard to grab the implicit Room without useRoomContext.
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
      const src = await ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', { types: ['window', 'screen'] });
      setSources(src);
      setShowSources(true);
    } catch (e) {
      console.error(e);
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
            maxFrameRate: fps
          }
        } as any
      });
      
      const videoTrack = stream.getVideoTracks()[0];
      
      // Otimização crucial para alta movimentação (evita que o WebRTC derrube o FPS para focar em nitidez)
      if ('contentHint' in videoTrack) {
        (videoTrack as any).contentHint = 'motion';
      }

      const track = new LocalVideoTrack(videoTrack);
      await localParticipant.publishTrack(track, { 
        source: Track.Source.ScreenShare,
        videoCodec: 'h264',
        videoEncoding: { 
          maxBitrate: is1080 ? (fps === 60 ? 8000000 : 5000000) : (fps === 60 ? 4000000 : 2500000), 
          maxFramerate: fps,
          priority: 'high'
        },
        simulcast: true
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
    
    let stream: MediaStream | null = null;

    if (p.isLocal && screenTrack) {
      stream = new MediaStream([screenTrack.mediaStreamTrack]);
    } else if (hasScreenShare && isWatching) {
      stream = new MediaStream([screenSharePub.videoTrack!.mediaStreamTrack]);
    }

    return {
      id: p.identity,
      username: p.isLocal ? t('chat.you') : (p.name || p.identity),
      isLocal: p.isLocal,
      stream,
      isStreaming,
      hasVideo: !!stream,
      isMuted: p.isLocal ? isMuted : !p.isMicrophoneEnabled,
      lkParticipant: p
    };
  });

  let activeMaximizedId = maximizedId;
  const maximizedParticipant = allParticipants.find(p => p.id === activeMaximizedId);
  if (!maximizedParticipant) {
    activeMaximizedId = null;
  }

  const assignStream = (el: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (!el) return;
    if (!stream) {
      if (el.srcObject) el.srcObject = null;
      return;
    }
    const currentStream = el.srcObject as MediaStream | null;
    const newTrack = stream.getVideoTracks()[0];
    const currentTrack = currentStream?.getVideoTracks()[0];
    
    if (newTrack !== currentTrack) {
      el.srcObject = stream;
    }
  };

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
        streamVolumes={streamVolumes} 
        setStreamVolumes={setStreamVolumes} 
        showStreamSettingsId={showStreamSettingsId} 
        setShowStreamSettingsId={setShowStreamSettingsId}
        t={t}
        assignStream={assignStream}
        pCount={allParticipants.length}
      />
    );
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', minHeight: 0, height: '100%' }}>
      {maximizedParticipant ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', gap: '1rem', overflow: 'hidden', minHeight: 0 }}>
          <div ref={fullscreenContainerRef} style={{ flex: 1, backgroundColor: '#0b0f17', borderRadius: '1rem', border: '1px solid rgba(255, 255, 255, 0.08)', overflow: 'hidden', position: 'relative', minHeight: 0 }}>
             {maximizedParticipant.hasVideo ? (
               <video autoPlay muted={maximizedParticipant.isLocal} style={{ width: '100%', height: '100%', objectFit: 'contain' }} ref={(el) => assignStream(el, maximizedParticipant.stream)} />
             ) : (
               <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', margin: 'auto', position: 'absolute', inset: 0 }}>
                 {maximizedParticipant.username === t('chat.you') ? 'ME' : maximizedParticipant.username.charAt(0).toUpperCase()}
               </div>
             )}
             <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', backgroundColor: 'rgba(0,0,0,0.6)', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.9rem', color: 'white' }}>
               {maximizedParticipant.username}
             </div>
             <div style={{ position: 'absolute', bottom: '1.5rem', right: '1.5rem', display: 'flex', gap: '0.5rem' }}>
               {!maximizedParticipant.isLocal && maximizedParticipant.isStreaming && (
                 <button 
                   onClick={() => setShowStreamSettingsId(showStreamSettingsId === maximizedParticipant.id ? null : maximizedParticipant.id)} 
                   className="icon-btn" 
                   style={{ backgroundColor: 'rgba(15, 19, 28, 0.85)', backdropFilter: 'blur(12px)', color: 'white', borderRadius: '8px' }} 
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
               }} className="icon-btn" style={{ backgroundColor: 'rgba(15, 19, 28, 0.85)', backdropFilter: 'blur(12px)', color: 'white', borderRadius: '8px' }} title="Tela Cheia">
                 <Fullscreen size={20} />
               </button>
               <button onClick={() => setMaximizedId(null)} className="icon-btn" style={{ backgroundColor: 'rgba(15, 19, 28, 0.85)', backdropFilter: 'blur(12px)', color: 'white', borderRadius: '8px' }} title="Desfocar">
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
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', width: '100%', maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ margin: 0 }}>{t('voice.shareScreen')}</h2>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Qualidade:</label>
                  <select value={streamRes} onChange={e => setStreamRes(e.target.value as '720' | '1080')} style={{ backgroundColor: 'var(--bg-tertiary)', color: 'white', border: '1px solid var(--border-subtle)', padding: '0.4rem', borderRadius: '6px', outline: 'none' }}>
                    <option value="720">720p (Padrão)</option>
                    <option value="1080">1080p (Premium)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>FPS:</label>
                  <select value={streamFps} onChange={e => setStreamFps(e.target.value as '30' | '60')} style={{ backgroundColor: 'var(--bg-tertiary)', color: 'white', border: '1px solid var(--border-subtle)', padding: '0.4rem', borderRadius: '6px', outline: 'none' }}>
                    <option value="30">30 FPS (Padrão)</option>
                    <option value="60">60 FPS (Premium)</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {sources.map(s => (
                <div key={s.id} onClick={() => selectSource(s.id)} style={{ cursor: 'pointer', backgroundColor: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <img src={s.thumbnail} alt={s.name} style={{ width: '100%', borderRadius: '4px' }} />
                  <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowSources(false)} className="btn-primary" style={{ marginTop: '1.5rem', width: '100%' }}>{t('voice.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ParticipantBox({ p, isHorizontal, userVolumes, onVolumeChange, activeMaximizedId, setMaximizedId, toggleWatchStream, streamVolumes, setStreamVolumes, showStreamSettingsId, setShowStreamSettingsId, t, assignStream, pCount }: any) {
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
            <video autoPlay muted={p.isLocal} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#000', zIndex: 0 }} ref={(el) => assignStream(el, p.stream)} />
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
