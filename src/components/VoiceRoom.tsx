import { useEffect, useState, useRef } from 'react';
import { Mic, MicOff, MonitorUp, MonitorOff, PhoneOff, Maximize, Minimize } from 'lucide-react';
import { ipcRenderer } from 'electron';
import { useTranslation } from 'react-i18next';
import { LiveKitRoom, useParticipants, useLocalParticipant, RoomAudioRenderer } from '@livekit/components-react';
import { Track, TrackEvent, LocalVideoTrack } from 'livekit-client';
import api from '../api';
import chatConnectedSound from '../assets/sounds/chat_connected.wav';
import chatDisconnectedSound from '../assets/sounds/chat_disconected.wav';

interface VoiceRoomProps {
  channelId: string;
  serverId: string;
  myId: string;
  myUsername: string;
  onDisconnect: () => void;
  onParticipantsChange: (participants: { id: string; username: string }[]) => void;
}

export default function VoiceRoomWrapper(props: VoiceRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDisconnect = () => {
    const audio = new Audio(chatDisconnectedSound);
    audio.play().catch(console.error);
    props.onDisconnect();
  };

  useEffect(() => {
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
  }, [props.channelId]);

  if (error) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>Error: {error}</div>;
  if (!token) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>Connecting to Voice...</div>;

  return (
    <LiveKitRoom
      video={false}
      audio={true}
      token={token}
      serverUrl={import.meta.env.VITE_LIVEKIT_URL}
      onDisconnected={handleDisconnect}
      style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
    >
      <VoiceRoomInner {...props} onDisconnect={handleDisconnect} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function VoiceRoomInner({ onDisconnect, onParticipantsChange }: VoiceRoomProps) {
  const { t } = useTranslation();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const prevParticipantsCount = useRef(0);
  
  const [isMuted, setIsMuted] = useState(false);
  const [sources, setSources] = useState<any[]>([]);
  const [showSources, setShowSources] = useState(false);
  const [maximizedId, setMaximizedId] = useState<string | null>(null);
  const [screenTrack, setScreenTrack] = useState<LocalVideoTrack | null>(null);

  useEffect(() => {
    onParticipantsChange(participants.map(p => ({ id: p.identity, username: p.name || p.identity })));
    
    // First render edge case: if we start with participants, don't trigger connect sound immediately unless it's the local user
    if (prevParticipantsCount.current > 0) {
      if (participants.length > prevParticipantsCount.current) {
        const audio = new Audio(chatConnectedSound);
        audio.play().catch(console.error);
      } else if (participants.length < prevParticipantsCount.current) {
        const audio = new Audio(chatDisconnectedSound);
        audio.play().catch(console.error);
      }
    } else if (participants.length > 0) {
      // First time loading and we have participants (local user joined)
      const audio = new Audio(chatConnectedSound);
      audio.play().catch(console.error);
    }
    
    prevParticipantsCount.current = participants.length;
  }, [participants, onParticipantsChange]);

  const toggleMute = () => {
    if (localParticipant) {
      const audioEnabled = localParticipant.isMicrophoneEnabled;
      localParticipant.setMicrophoneEnabled(!audioEnabled);
      setIsMuted(audioEnabled);
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

  const toggleScreenShare = async () => {
    if (screenTrack) {
      await localParticipant.unpublishTrack(screenTrack);
      screenTrack.stop();
      setScreenTrack(null);
    } else {
      fetchDesktopSources();
    }
  };

  const selectSource = async (sourceId: string) => {
    setShowSources(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: 1280,
            maxWidth: 1920,
            minHeight: 720,
            maxHeight: 1080
          }
        } as any
      });
      
      const track = new LocalVideoTrack(stream.getVideoTracks()[0]);
      await localParticipant.publishTrack(track, { source: Track.Source.ScreenShare });
      setScreenTrack(track);

      track.on(TrackEvent.Muted, () => toggleScreenShare());
    } catch (e) {
      console.error(e);
    }
  };

  const allParticipants = participants.map(p => {
    const screenSharePub = p.getTrackPublication(Track.Source.ScreenShare);
    const hasScreenShare = screenSharePub?.isSubscribed && screenSharePub?.videoTrack;
    let stream: MediaStream | null = null;

    if (p.isLocal && screenTrack) {
      stream = new MediaStream([screenTrack.mediaStreamTrack]);
    } else if (hasScreenShare) {
      stream = new MediaStream([screenSharePub.videoTrack!.mediaStreamTrack]);
    }

    return {
      id: p.identity,
      username: p.isLocal ? t('chat.you') : (p.name || p.identity),
      isLocal: p.isLocal,
      stream,
      hasVideo: !!stream
    };
  });

  const videoParticipants = allParticipants.filter(p => p.hasVideo);
  let activeMaximizedId = maximizedId;

  if (!activeMaximizedId && videoParticipants.length === 1) {
    activeMaximizedId = videoParticipants[0].id;
  }

  const maximizedParticipant = allParticipants.find(p => p.id === activeMaximizedId);
  if (!maximizedParticipant) {
    activeMaximizedId = null;
  }

  const renderParticipantBox = (p: any, isHorizontal: boolean = false) => (
    <div 
       key={p.id} 
       onClick={() => setMaximizedId(p.id === activeMaximizedId ? null : p.id)}
       style={{ 
         backgroundColor: 'var(--bg-secondary)', 
         borderRadius: '12px', 
         overflow: 'hidden', 
         position: 'relative', 
         cursor: 'pointer',
         ...(isHorizontal ? { 
           minWidth: '240px', 
           maxWidth: '240px', 
           height: '100%' 
         } : { 
           flex: '1 1 320px',
           maxWidth: '800px',
           aspectRatio: '16/9',
           display: 'flex', 
           alignItems: 'center', 
           justifyContent: 'center' 
         }),
       }}
    >
      {p.hasVideo ? (
        <video autoPlay muted={p.isLocal} style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }} ref={(el) => { if (el && p.stream) el.srcObject = p.stream; }} />
      ) : (
        <div style={{ width: isHorizontal ? '60px' : '80px', height: isHorizontal ? '60px' : '80px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isHorizontal ? '1.5rem' : '2rem', margin: 'auto' }}>
          {p.username === t('chat.you') ? 'ME' : p.username.charAt(0).toUpperCase()}
        </div>
      )}
      <div style={{ position: 'absolute', bottom: '0.5rem', left: '0.5rem', backgroundColor: 'rgba(0,0,0,0.6)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
        {p.username}
      </div>
      <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', backgroundColor: 'rgba(0,0,0,0.6)', padding: '0.25rem', borderRadius: '4px', color: 'var(--text-muted)' }}>
        {p.id === activeMaximizedId ? <Minimize size={14} /> : <Maximize size={14} />}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {maximizedParticipant ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', gap: '1rem', overflow: 'hidden' }}>
          <div style={{ flex: 1, backgroundColor: 'black', borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
             {maximizedParticipant.hasVideo ? (
               <video autoPlay muted={maximizedParticipant.isLocal} style={{ width: '100%', height: '100%', objectFit: 'contain' }} ref={(el) => { if (el && maximizedParticipant.stream) el.srcObject = maximizedParticipant.stream; }} />
             ) : (
               <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', margin: 'auto', position: 'absolute', inset: 0 }}>
                 {maximizedParticipant.username === t('chat.you') ? 'ME' : maximizedParticipant.username.charAt(0).toUpperCase()}
               </div>
             )}
             <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', backgroundColor: 'rgba(0,0,0,0.6)', padding: '0.5rem 1rem', borderRadius: '6px', fontSize: '0.9rem' }}>
               {maximizedParticipant.username}
             </div>
             <button onClick={() => setMaximizedId(null)} className="icon-btn" style={{ position: 'absolute', top: '1rem', right: '1rem', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }} title="Unfocus">
               <Minimize size={20} />
             </button>
          </div>
          <div style={{ height: '140px', display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {allParticipants.filter(p => p.id !== activeMaximizedId).map(p => renderParticipantBox(p, true))}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, padding: '2rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: '1rem', overflowY: 'auto' }}>
          {allParticipants.map(p => renderParticipantBox(p, false))}
        </div>
      )}

      <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
        <button onClick={toggleMute} className="icon-btn" style={{ backgroundColor: isMuted ? 'var(--danger)' : 'var(--bg-secondary)', width: '48px', height: '48px', borderRadius: '50%', color: 'white' }}>
          {isMuted ? <MicOff /> : <Mic />}
        </button>
        <button onClick={toggleScreenShare} className="icon-btn" style={{ backgroundColor: screenTrack ? 'var(--brand-primary)' : 'var(--bg-secondary)', width: '48px', height: '48px', borderRadius: '50%', color: 'white' }}>
          {screenTrack ? <MonitorOff /> : <MonitorUp />}
        </button>
        <button onClick={onDisconnect} className="icon-btn" style={{ backgroundColor: 'var(--danger)', width: '48px', height: '48px', borderRadius: '50%', color: 'white' }}>
          <PhoneOff />
        </button>
      </div>

      {showSources && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '2rem', borderRadius: '12px', width: '100%', maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{t('voice.shareScreen')}</h2>
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
