import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import heroLogo from '../assets/logo.png';
import { io, Socket } from 'socket.io-client';
import api from '../api';
import { Users, LogOut, Send, Plus, Hash, Volume2, PhoneCall, PhoneOff, Check, X, Settings, MicOff, Search, UserPlus, ChevronDown, ChevronUp, MoreVertical, Mic } from 'lucide-react';
import VoiceRoom from '../components/VoiceRoom';
import { useTranslation } from 'react-i18next';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';

interface User {
  id: string;
  username: string;
  email: string;
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  receiverId?: string;
  channelId?: string;
  createdAt: string;
  sender?: User;
}

interface Channel {
  id: string;
  name: string;
  type: 'TEXT' | 'VOICE';
}

interface Server {
  id: string;
  name: string;
  ownerId: string;
  channels: Channel[];
}

const LiveTimer = ({ startedAt }: { startedAt: number }) => {
  const calculateSeconds = () => startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  const [seconds, setSeconds] = useState(calculateSeconds());
  
  useEffect(() => {
    setSeconds(calculateSeconds());
    const i = setInterval(() => setSeconds(calculateSeconds()), 1000);
    return () => clearInterval(i);
  }, [startedAt]);
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return (
    <div style={{ background: 'rgba(52, 211, 153, 0.15)', color: 'var(--brand-primary)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, border: '1px solid rgba(52, 211, 153, 0.3)', fontFamily: 'monospace' }}>
      {hrs > 0 ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`}
    </div>
  );
};

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<User[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  
  const [activeView, setActiveView] = useState<'DM' | 'SERVER'>('DM');
  
  // DM State
  const [activeFriend, setActiveFriend] = useState<User | null>(null);
  
  // Server State
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [serverVoiceStates, setServerVoiceStates] = useState<{ [channelId: string]: { userId: string; username: string; isMuted?: boolean }[] }>({});
  const [channelStartTimes, setChannelStartTimes] = useState<{ [channelId: string]: number }>({});
  
  // Badges & Persistent Voice State
  const [unreadDMs, setUnreadDMs] = useState<{ [userId: string]: number }>({});
  const [unreadChannels, setUnreadChannels] = useState<{ [channelId: string]: number }>({});
  const [connectedVoiceChannel, setConnectedVoiceChannel] = useState<{ channelId: string; serverId: string; name: string } | null>(null);
  const [activeSpeakers, setActiveSpeakers] = useState<Set<string>>(new Set());
  const activeViewRef = useRef<'DM' | 'SERVER'>('DM');
  const activeFriendIdRef = useRef<string | null>(null);
  const activeChannelIdRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [myId, setMyId] = useState('');
  const [myUsername, setMyUsername] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [showServerModal, setShowServerModal] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Audio Settings State
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>(localStorage.getItem('voxy-audio-input') || '');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>(localStorage.getItem('voxy-audio-output') || '');
  const [userVolumes, setUserVolumes] = useState<Record<string, number>>({});

  const handleVolumeChange = (id: string, value: number) => {
    setUserVolumes(prev => ({ ...prev, [id]: value }));
  };

  useEffect(() => {
    if (showSettingsModal) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        setAudioInputs(devices.filter(d => d.kind === 'audioinput'));
        setAudioOutputs(devices.filter(d => d.kind === 'audiooutput'));
      });
    }
  }, [showSettingsModal]);

  // Loading States
  const [initialLoading, setInitialLoading] = useState(true);
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const [isJoiningServer, setIsJoiningServer] = useState(false);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  
  const [modalInput, setModalInput] = useState('');
  const [inviteInput, setInviteInput] = useState('');
  const [channelType, setChannelType] = useState<'TEXT' | 'VOICE'>('TEXT');

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('voxy_token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setMyId(payload.sub);
      setMyUsername(payload.username);
    } catch (e) {
      console.error(e);
    }

    const newSocket = io(import.meta.env.VITE_API_URL, {
      auth: { token }
    });

    setSocket(newSocket);

    newSocket.on('newMessage', (msg: Message) => {
      // Receiver side of a DM
      if (activeViewRef.current === 'DM' && activeFriendIdRef.current === msg.senderId) {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
      } else {
        setUnreadDMs(prev => ({ ...prev, [msg.senderId]: (prev[msg.senderId] || 0) + 1 }));
      }
    });

    newSocket.on('messageSent', (msg: Message) => {
      // Sender side of a DM
      if (activeViewRef.current === 'DM' && activeFriendIdRef.current === msg.receiverId) {
        setMessages(prev => {
          const filtered = prev.filter(m => !(m.id.startsWith('temp-') && m.content === msg.content));
          if (filtered.some(m => m.id === msg.id)) return filtered;
          return [...filtered, msg];
        });
        scrollToBottom();
      }
    });

    newSocket.on('newChannelMessage', (msg: Message) => {
      if (!msg.channelId) return;
      if (activeViewRef.current === 'SERVER' && activeChannelIdRef.current === msg.channelId) {
        setMessages(prev => {
          const filtered = prev.filter(m => !(m.id.startsWith('temp-') && m.content === msg.content && m.senderId === msg.senderId));
          if (filtered.some(m => m.id === msg.id)) return filtered;
          return [...filtered, msg];
        });
        scrollToBottom();
      } else {
        setUnreadChannels(prev => ({ ...prev, [msg.channelId as string]: (prev[msg.channelId as string] || 0) + 1 }));
      }
    });

    newSocket.on('friendActionUpdate', () => {
      fetchFriends();
    });

    newSocket.on('serverUpdated', () => {
      fetchServers();
    });

    newSocket.on('serverVoiceUpdate', (data: { channelId: string, participants: { userId: string; username: string; isMuted?: boolean }[], startedAt?: number }) => {
      setServerVoiceStates(prev => ({
        ...prev,
        [data.channelId]: data.participants
      }));

      setChannelStartTimes(prev => {
        if (!data.startedAt) {
          const newTimes = { ...prev };
          delete newTimes[data.channelId];
          return newTimes;
        }
        return {
          ...prev,
          [data.channelId]: data.startedAt
        };
      });
    });

    // Initial load
    const initData = async () => {
      try {
        await Promise.allSettled([fetchFriends(), fetchServers()]);
      } catch (err) {
        console.error('Error in initial load', err);
      } finally {
        setTimeout(() => {
          setInitialLoading(false);
        }, 500);
      }
    };

    initData();

    return () => {
      newSocket.close();
    };
  }, [navigate]);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    activeFriendIdRef.current = activeFriend?.id || null;
    if (activeFriend) {
      setUnreadDMs(prev => ({ ...prev, [activeFriend.id]: 0 }));
    }
  }, [activeFriend]);

  useEffect(() => {
    activeChannelIdRef.current = activeChannel?.id || null;
    if (activeChannel) {
      setUnreadChannels(prev => ({ ...prev, [activeChannel.id]: 0 }));
    }
  }, [activeChannel]);

  useEffect(() => {
    if (activeView === 'DM' && activeFriend) {
      fetchDMMessages(activeFriend.id);
    } else if (activeView === 'SERVER' && activeChannel) {
      if (activeChannel.type === 'TEXT') {
        fetchChannelMessages(activeChannel.id);
      }
      socket?.emit('joinChannel', { channelId: activeChannel.id });
      return () => {
        socket?.emit('leaveChannel', { channelId: activeChannel.id });
      }
    }
  }, [activeFriend, activeChannel, activeView]);

  useEffect(() => {
    if (socket && servers.length > 0) {
      servers.forEach(server => {
        socket.emit('joinServer', { serverId: server.id });
      });
    }
  }, [socket, servers]);

  useEffect(() => {
    if (socket && connectedVoiceChannel) {
      socket.emit('joinVoice', { 
        serverId: connectedVoiceChannel.serverId, 
        channelId: connectedVoiceChannel.channelId 
      });
      return () => {
        socket.emit('leaveVoice', { 
          serverId: connectedVoiceChannel.serverId, 
          channelId: connectedVoiceChannel.channelId 
        });
      };
    }
  }, [socket, connectedVoiceChannel]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const fetchFriends = async () => {
    try {
      const res = await api.get('/friends');
      setFriends(res.data);
      const reqRes = await api.get('/friends/requests');
      setPendingRequests(reqRes.data);
    } catch (err) {
      console.error('Error fetching friends', err);
    }
  };

  const handleAcceptRequest = async (e: React.MouseEvent, friendId: string) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/friends/accept/${friendId}`);
      fetchFriends();
      socket?.emit('friendAction', { targetId: res.data.targetId });
    } catch (err) {
      console.error('Error accepting friend', err);
    }
  };

  const handleRejectRequest = async (e: React.MouseEvent, friendId: string) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/friends/reject/${friendId}`);
      fetchFriends();
      socket?.emit('friendAction', { targetId: res.data.targetId });
    } catch (err) {
      console.error('Error rejecting friend', err);
    }
  };

  const fetchServers = async () => {
    try {
      const res = await api.get('/servers');
      setServers(res.data);
    } catch (err) {
      console.error('Error fetching servers', err);
    }
  };

  const fetchDMMessages = async (friendId: string) => {
    try {
      const res = await api.get(`/chat/${friendId}`);
      setMessages(res.data);
      scrollToBottom();
    } catch (err) {
      console.error('Error fetching messages', err);
    }
  };

  const fetchChannelMessages = async (channelId: string) => {
    try {
      const res = await api.get(`/channels/${channelId}/messages`);
      setMessages(res.data);
      scrollToBottom();
    } catch (err) {
      console.error('Error fetching channel messages', err);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      content: newMessage,
      senderId: myId,
      createdAt: new Date().toISOString(),
      sender: { id: myId, username: myUsername, email: '' }
    };

    if (activeView === 'DM' && activeFriend) {
      tempMsg.receiverId = activeFriend.id;
      setMessages(prev => [...prev, tempMsg]);
      scrollToBottom();
      socket.emit('sendMessage', {
        receiverId: activeFriend.id,
        content: newMessage
      });
    } else if (activeView === 'SERVER' && activeChannel) {
      tempMsg.channelId = activeChannel.id;
      setMessages(prev => [...prev, tempMsg]);
      scrollToBottom();
      socket.emit('sendChannelMessage', {
        channelId: activeChannel.id,
        content: newMessage
      });
    }
    setNewMessage('');
  };

  const handleCreateServer = async () => {
    if (!modalInput.trim()) return;
    setIsCreatingServer(true);
    try {
      await api.post('/servers', { name: modalInput });
      await fetchServers();
      setShowServerModal(false);
      setModalInput('');
    } catch (err) {
      console.error('Error creating server', err);
    } finally {
      setIsCreatingServer(false);
    }
  };

  const handleJoinServer = async () => {
    if (!inviteInput.trim()) return;
    setIsJoiningServer(true);
    try {
      await api.post('/servers/join', { inviteCode: inviteInput });
      await fetchServers();
      setShowServerModal(false);
      setInviteInput('');
    } catch (err) {
      console.error('Error joining server', err);
      alert('Invalid or expired invite code');
    } finally {
      setIsJoiningServer(false);
    }
  };

  const handleAddFriend = async () => {
    if (!modalInput.trim()) return;
    setIsAddingFriend(true);
    try {
      const res = await api.post('/friends/request', { username: modalInput });
      setShowFriendModal(false);
      setModalInput('');
      await fetchFriends();
      socket?.emit('friendAction', { targetId: res.data.targetId });
    } catch (err) {
      console.error('Error adding friend', err);
      alert('Error adding friend or user not found');
    } finally {
      setIsAddingFriend(false);
    }
  };

  const handleCreateChannel = async () => {
    if (!modalInput.trim() || !activeServer) return;
    setIsCreatingChannel(true);
    try {
      await api.post(`/channels/${activeServer.id}`, { name: modalInput, type: channelType });
      await fetchServers(); 
      socket?.emit('channelCreated', { serverId: activeServer.id });
      setShowChannelModal(false);
      setModalInput('');
    } catch (err) {
      console.error('Error creating channel', err);
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('voxy_token');
    navigate('/login');
  };

  const totalUnreadDMs = Object.entries(unreadDMs).reduce((sum, [friendId, count]) => {
    if (activeView === 'DM' && activeFriend?.id === friendId) return sum;
    return sum + count;
  }, 0);

  if (initialLoading) {
    return (
      <div className="app-initial-loader">
        <img src={heroLogo} alt="Voxy Logo" className="pulsing-logo" />
        <div className="loader-spinner-subtle" />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Far-left Server Sidebar */}
      <div className="server-sidebar">
        <div 
          className={`server-icon ${activeView === 'DM' ? 'active' : ''}`}
          onClick={() => { setActiveView('DM'); setActiveServer(null); setActiveChannel(null); }}
          title={t('sidebar.directMessages')}
          style={{ padding: 0, backgroundColor: 'transparent', position: 'relative' }}
        >
          <img src={heroLogo} alt="Home" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
          {totalUnreadDMs > 0 && (
            <div className="server-badge">{totalUnreadDMs > 99 ? '99+' : totalUnreadDMs}</div>
          )}
        </div>
        
        <div style={{ width: '32px', height: '2px', backgroundColor: 'var(--border-subtle)', borderRadius: '2px' }} />

        {servers.map(server => {
          const unreadCount = server.channels?.reduce((sum, ch) => {
            if (activeView === 'SERVER' && activeChannel?.id === ch.id) return sum;
            return sum + (unreadChannels[ch.id] || 0);
          }, 0) || 0;

          return (
            <div 
              key={server.id} 
              className={`server-icon ${activeServer?.id === server.id ? 'active' : ''}`}
              onClick={() => { setActiveView('SERVER'); setActiveServer(server); setActiveChannel(server.channels[0]); }}
              title={server.name}
              style={{ position: 'relative' }}
            >
              {server.name.substring(0, 2).toUpperCase()}
              {unreadCount > 0 && (
                <div className="server-badge">{unreadCount > 99 ? '99+' : unreadCount}</div>
              )}
            </div>
          );
        })}

        <div className="server-icon" style={{ backgroundColor: 'transparent', border: '1px dashed var(--text-muted)', color: 'var(--brand-primary)' }} onClick={() => { setModalInput(''); setShowServerModal(true); }} title={t('server.addServer')}>
          <Plus size={24} />
        </div>
      </div>

      {/* Main Sidebar */}
      <div className="sidebar">
        {activeView === 'DM' ? (
          <>
            <div className="sidebar-header" style={{ borderBottom: 'none', paddingBottom: '0.5rem' }}>
              <span className="sidebar-title">{t('sidebar.directMessages')}</span>
              <button className="icon-btn" title={t('friends.addFriend')} onClick={() => { setModalInput(''); setShowFriendModal(true); }}>
                <Plus size={20} />
              </button>
            </div>
            
            <button className="invite-btn" onClick={() => { setModalInput(''); setShowFriendModal(true); }}>
              <UserPlus size={18} /> Adicionar Amigo
            </button>
            
            <div className="sidebar-search-wrapper">
              <Search size={14} className="sidebar-search-icon" />
              <input type="text" className="sidebar-search-input" placeholder="Encontrar conversas..." />
            </div>

            <div className="friends-list" style={{ padding: '0', paddingTop: '0.5rem' }}>
              {pendingRequests.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div className="section-title-wrapper">
                    <span className="section-title">CONVITES PENDENTES</span>
                    <ChevronDown size={14} color="var(--text-muted)" />
                  </div>
                  <div style={{ padding: '0 1rem' }}>
                    {pendingRequests.map(req => (
                      <div key={req.id} className="friend-item" style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div className="avatar" style={{ backgroundColor: 'var(--bg-tertiary)' }}>{req.username.charAt(0).toUpperCase()}</div>
                          <span className="user-name">{req.username}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="icon-btn" style={{ color: 'var(--danger)', padding: '0.25rem', backgroundColor: 'var(--bg-tertiary)' }} onClick={(e) => handleRejectRequest(e, req.id)} title="Reject">
                            <X size={18} />
                          </button>
                          <button className="icon-btn" style={{ color: 'var(--success)', padding: '0.25rem', backgroundColor: 'var(--bg-tertiary)' }} onClick={(e) => handleAcceptRequest(e, req.id)} title="Accept">
                            <Check size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="section-title-wrapper">
                <span className="section-title">MENSAGENS PRIVADAS</span>
                <ChevronDown size={14} color="var(--text-muted)" />
              </div>
              <div style={{ padding: '0 1rem' }}>
                {friends.map(friend => (
                  <div 
                    key={friend.id} 
                    className={`friend-item ${activeFriend?.id === friend.id ? 'active' : ''}`}
                    onClick={() => setActiveFriend(friend)}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="avatar" style={{ width: '32px', height: '32px', minWidth: '32px', minHeight: '32px' }}>
                        {friend.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="user-info">
                        <span className="user-name">{friend.username}</span>
                      </div>
                    </div>
                    {unreadDMs[friend.id] > 0 && activeFriend?.id !== friend.id && (
                      <div className="badge">{unreadDMs[friend.id]}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="sidebar-header" style={{ borderBottom: 'none', paddingBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1, minWidth: 0 }}>
                <span className="sidebar-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeServer?.name}</span>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>🌱</span>
                <ChevronDown size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                {activeServer?.ownerId === myId && <span className="owner-badge" style={{ margin: 0 }}>OWNER</span>}
                <button 
                  className="icon-btn" 
                  title="Create Channel" 
                  onClick={() => { setModalInput(''); setChannelType('TEXT'); setShowChannelModal(true); }}
                  disabled={activeServer?.ownerId !== myId}
                  style={{ opacity: activeServer?.ownerId !== myId ? 0.3 : 1, cursor: activeServer?.ownerId !== myId ? 'not-allowed' : 'pointer', padding: 0 }}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
            
            <button className="invite-btn" onClick={() => setShowInviteModal(true)}>
              <UserPlus size={18} /> Invite Users
            </button>
            
            <div className="sidebar-search-wrapper">
              <Search size={14} className="sidebar-search-icon" />
              <input type="text" className="sidebar-search-input" placeholder="Search channels..." />
            </div>

            <div className="friends-list" style={{ padding: '0', paddingTop: '0.5rem' }}>
              <div className="section-title-wrapper">
                <span className="section-title">TEXT CHANNELS</span>
                <ChevronDown size={14} color="var(--text-muted)" />
              </div>
              <div style={{ padding: '0 1rem', marginBottom: '0.5rem' }}>
                {activeServer?.channels.filter(ch => ch.type === 'TEXT').map(channel => (
                  <div 
                    key={channel.id}
                    className={`friend-item ${activeChannel?.id === channel.id ? 'active' : ''}`}
                    onClick={() => setActiveChannel(channel)}
                    style={{ gap: '0.5rem', padding: '0.4rem 0.75rem', justifyContent: 'space-between', borderRadius: '8px' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Hash size={16} color={activeChannel?.id === channel.id ? "var(--text-primary)" : "var(--text-muted)"} />
                      <span className="user-name" style={{ fontSize: '0.9rem', color: activeChannel?.id === channel.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{channel.name}</span>
                    </div>
                    {activeChannel?.id === channel.id ? (
                      <div className="active-indicator" />
                    ) : unreadChannels[channel.id] > 0 ? (
                      <div className="badge">{unreadChannels[channel.id]}</div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="section-title-wrapper">
                <span className="section-title">VOICE CHANNELS</span>
                <span className="live-badge">{activeServer?.channels.filter(ch => ch.type === 'VOICE' && serverVoiceStates[ch.id]?.length > 0).length} LIVE</span>
              </div>
              <div style={{ paddingBottom: '1rem' }}>
                {activeServer?.channels.filter(ch => ch.type === 'VOICE').map(channel => (
                  <div key={channel.id} className={serverVoiceStates[channel.id]?.length > 0 ? 'voice-channel-card' : ''}>
                    <div 
                      className={`friend-item`}
                      onClick={() => { 
                        setActiveChannel(channel); 
                        setConnectedVoiceChannel({ channelId: channel.id, serverId: activeServer.id, name: channel.name });
                      }}
                      style={{ 
                        gap: '0.5rem', 
                        padding: serverVoiceStates[channel.id]?.length > 0 ? '0 0 0.5rem 0' : '0.4rem 1rem', 
                        justifyContent: 'space-between', 
                        background: 'transparent',
                        border: 'none',
                        borderLeft: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Volume2 size={16} color={serverVoiceStates[channel.id]?.length > 0 ? "var(--text-primary)" : "var(--text-muted)"} />
                        <span className="user-name" style={{ fontSize: '0.9rem', fontWeight: serverVoiceStates[channel.id]?.length > 0 ? 700 : 500 }}>{channel.name}</span>
                      </div>
                      {serverVoiceStates[channel.id]?.length > 0 ? (
                        <LiveTimer startedAt={channelStartTimes[channel.id]} />
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Empty</span>
                      )}
                    </div>
                    
                    {serverVoiceStates[channel.id]?.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                        {serverVoiceStates[channel.id].map((p: any) => {
                          const vol = userVolumes[p.userId] ?? 100;
                          const isMe = p.userId === myId;
                          const isSpeaking = activeSpeakers.has(p.userId);
                          const content = (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              <div style={{ 
                                width: '28px', height: '28px', minWidth: '28px', borderRadius: '50%', 
                                backgroundColor: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                color: 'white', fontSize: '0.7rem', fontWeight: 'bold',
                                border: isSpeaking ? '2px solid var(--brand-primary)' : '2px solid transparent',
                                boxShadow: isSpeaking ? '0 0 10px rgba(52, 211, 153, 0.4)' : 'none',
                                transition: 'all 0.2s',
                                position: 'relative'
                              }}>
                                {p.username.charAt(0).toUpperCase()}
                                <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '8px', height: '8px', backgroundColor: 'var(--brand-primary)', borderRadius: '50%', border: '2px solid var(--bg-tertiary)' }} />
                              </div>
                              <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: isMe ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isMe ? 600 : 500 }}>{p.username}</span>
                              {p.isMuted ? <MicOff size={14} color="var(--text-muted)" /> : isSpeaking ? <Volume2 size={14} color="var(--brand-primary)" /> : <Mic size={14} color="var(--text-muted)" style={{ opacity: 0.3 }} />}
                            </div>
                          );

                          return isMe ? (
                            <div key={p.userId}>{content}</div>
                          ) : (
                            <ContextMenu.Root key={p.userId}>
                              <ContextMenu.Trigger asChild>
                                <div style={{ cursor: 'pointer' }}>{content}</div>
                              </ContextMenu.Trigger>
                              <ContextMenu.Portal>
                                <ContextMenu.Content className="context-menu-content" style={{ zIndex: 9999 }}>
                                  <ContextMenu.Item className="context-menu-item">Perfil</ContextMenu.Item>
                                  <ContextMenu.Item className="context-menu-item" style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px', paddingBottom: '8px' }}>Mensagem</ContextMenu.Item>
                                  
                                  <div className="context-menu-label">Volume do usuário</div>
                                  <div className="context-menu-slider-container">
                                     <Slider.Root className="slider-root" value={[vol]} max={200} step={1} onValueChange={(vals) => handleVolumeChange(p.userId, vals[0])}>
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
                            </ContextMenu.Root>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* User Profile Bar */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {connectedVoiceChannel && (
            <div className="active-call-bar">
              <div className="active-call-info">
                <span className="active-call-title"><PhoneCall size={14} /> {t('voice.connected')}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{connectedVoiceChannel.name}</span>
              </div>
              <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => setConnectedVoiceChannel(null)} title={t('voice.cancel')}>
                <PhoneOff size={18} />
              </button>
            </div>
          )}
          <div className="user-profile-bar glass-panel" style={{ border: 'none', borderRadius: 0 }}>
            <div className="avatar" style={{ backgroundColor: 'var(--brand-primary)' }}>
              {myUsername ? myUsername.charAt(0).toUpperCase() : 'ME'}
            </div>
            <div className="user-info">
              <span className="user-name">{myUsername || 'User'}</span>
            </div>
            <button className="icon-btn" onClick={() => setShowSettingsModal(true)} title={t('settings.title')}>
              <Settings size={18} />
            </button>
            <button className="icon-btn" onClick={handleLogout} title={t('settings.logout')}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        {connectedVoiceChannel && (
          <div style={{ display: activeChannel?.id === connectedVoiceChannel.channelId ? 'flex' : 'none', flex: 1, flexDirection: 'column', minHeight: 0 }}>
            <VoiceRoom 
              key={connectedVoiceChannel.channelId}
              channelId={connectedVoiceChannel.channelId}
              serverId={connectedVoiceChannel.serverId}
              myId={myId} 
              myUsername={myUsername}
              audioInput={selectedAudioInput}
              audioOutput={selectedAudioOutput}
              userVolumes={userVolumes}
              onVolumeChange={handleVolumeChange}
              onDisconnect={() => setConnectedVoiceChannel(null)}
              onParticipantsChange={() => {}}
              onMuteChange={(isMuted) => {
                socket?.emit('updateVoiceMute', {
                  serverId: connectedVoiceChannel.serverId,
                  channelId: connectedVoiceChannel.channelId,
                  isMuted
                });
              }}
              onSpeakersChange={(speakers) => setActiveSpeakers(new Set(speakers))}
            />
          </div>
        )}

        {(activeView === 'DM' && activeFriend) ? (
          <>
            <div className="chat-header glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}>
              <div className="avatar" style={{ backgroundColor: 'var(--brand-primary)' }}>{activeFriend.username.charAt(0).toUpperCase()}</div>
              <span style={{ fontWeight: 600 }}>{activeFriend.username}</span>
            </div>
            
            <div className="chat-messages">
              {messages.map(msg => (
                <div key={msg.id} className={`message-group ${msg.senderId === myId ? 'me' : 'other'}`}>
                  <div className="avatar" style={{ backgroundColor: msg.senderId === myId ? 'var(--brand-primary)' : 'var(--bg-tertiary)' }}>
                    {msg.senderId === myId ? (myUsername ? myUsername.charAt(0).toUpperCase() : 'V') : activeFriend.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="message-content">
                    <div className="message-header">
                      <span className="message-author">{msg.senderId === myId ? t('chat.you') : activeFriend.username}</span>
                      <span className="message-time">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="message-text">
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              <form onSubmit={handleSendMessage} className="chat-input-wrapper glass-panel">
                <input
                  type="text"
                  className="chat-input"
                  placeholder={`${t('chat.messagePlaceholder')} @${activeFriend.username}`}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                />
                <button type="submit" className="icon-btn" style={{ color: newMessage.trim() ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
                  <Send size={20} />
                </button>
              </form>
            </div>
          </>
        ) : activeView === 'SERVER' && activeChannel ? (
          activeChannel.type === 'VOICE' ? (
            activeChannel.id !== connectedVoiceChannel?.channelId && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: '1rem' }}>
                <Volume2 size={48} opacity={0.5} />
                <p>{t('voice.clickToJoin')}</p>
              </div>
            )
          ) : (
          <>
             <div className="chat-header glass-panel" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}>
              <Hash size={24} color="var(--brand-primary)" />
              <span style={{ fontWeight: 600 }}>{activeChannel.name}</span>
            </div>
            
            <div className="chat-messages">
              {messages.map(msg => (
                <div key={msg.id} className={`message-group ${msg.senderId === myId ? 'me' : 'other'}`}>
                  <div className="avatar" style={{ backgroundColor: msg.senderId === myId ? 'var(--brand-primary)' : 'var(--bg-tertiary)' }}>
                    {msg.senderId === myId ? (myUsername ? myUsername.charAt(0).toUpperCase() : 'V') : (msg.sender?.username?.charAt(0).toUpperCase() || 'U')}
                  </div>
                  <div className="message-content">
                    <div className="message-header">
                      <span className="message-author">{msg.senderId === myId ? t('chat.you') : (msg.sender?.username || 'User')}</span>
                      <span className="message-time">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="message-text">
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              <form onSubmit={handleSendMessage} className="chat-input-wrapper glass-panel">
                <input
                  type="text"
                  className="chat-input"
                  placeholder={`${t('chat.messagePlaceholder')} #${activeChannel.name}`}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                />
                <button type="submit" className="icon-btn" style={{ color: newMessage.trim() ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
                  <Send size={20} />
                </button>
              </form>
            </div>
          </>
          )
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: '1rem' }}>
            <Users size={48} opacity={0.5} />
            <p>{t('sidebar.search')}</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{t('settings.title')}</h2>
            <div className="input-group">
              <label className="input-label">{t('settings.language')}</label>
              <select 
                className="text-input" 
                value={i18n.language} 
                onChange={(e) => {
                  i18n.changeLanguage(e.target.value);
                  localStorage.setItem('voxy-language', e.target.value);
                }}
              >
                <option value="en">English</option>
                <option value="pt">Português</option>
              </select>
            </div>
            
            <div style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
              <span style={{ padding: '0 1rem', fontSize: '0.85rem' }}>Áudio e Vídeo</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
            </div>

            <div className="input-group">
              <label className="input-label">Dispositivo de Entrada (Microfone)</label>
              <select 
                className="text-input" 
                value={selectedAudioInput} 
                onChange={(e) => {
                  setSelectedAudioInput(e.target.value);
                  localStorage.setItem('voxy-audio-input', e.target.value);
                }}
              >
                <option value="">Padrão do Sistema</option>
                {audioInputs.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label || `Microfone (${device.deviceId.slice(0,5)}...)`}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Dispositivo de Saída (Alto-falante)</label>
              <select 
                className="text-input" 
                value={selectedAudioOutput} 
                onChange={(e) => {
                  setSelectedAudioOutput(e.target.value);
                  localStorage.setItem('voxy-audio-output', e.target.value);
                }}
              >
                <option value="">Padrão do Sistema</option>
                {audioOutputs.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label || `Alto-falante (${device.deviceId.slice(0,5)}...)`}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn-primary" onClick={() => setShowSettingsModal(false)}>{t('voice.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {showServerModal && (
        <div className="modal-overlay" onClick={() => setShowServerModal(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{t('server.createServer')}</h2>
            <div className="input-group">
              <label className="input-label">Server Name</label>
              <input type="text" className="text-input" value={modalInput} onChange={e => setModalInput(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn-primary" onClick={handleCreateServer} disabled={isCreatingServer}>
                {isCreatingServer && <span className="btn-spinner" />}
                {t('server.createServerButton')}
              </button>
            </div>

            <div style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
              <span style={{ padding: '0 1rem', fontSize: '0.85rem' }}>OR</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
            </div>

            <div className="input-group">
              <label className="input-label">{t('server.joinServerPlaceholder')}</label>
              <input type="text" className="text-input" placeholder={t('server.joinServerPlaceholder')} value={inviteInput} onChange={e => setInviteInput(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn-primary" style={{ backgroundColor: 'var(--bg-tertiary)' }} onClick={() => setShowServerModal(false)}>{t('voice.cancel')}</button>
              <button className="btn-primary" onClick={handleJoinServer} disabled={isJoiningServer}>
                {isJoiningServer && <span className="btn-spinner" />}
                {t('server.joinServerButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && activeServer && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{t('server.inviteFriends')} - {activeServer.name}</h2>
            <div className="input-group">
              <input type="text" className="text-input" readOnly value={activeServer.id} style={{ color: 'var(--brand-primary)', fontWeight: 'bold', textAlign: 'center', letterSpacing: '1px' }} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn-primary" style={{ width: '100%' }} onClick={() => { navigator.clipboard.writeText(activeServer.id); alert('Copied!'); setShowInviteModal(false); }}>Copy Invite Code</button>
            </div>
          </div>
        </div>
      )}

      {showFriendModal && (
        <div className="modal-overlay" onClick={() => setShowFriendModal(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{t('friends.addFriend')}</h2>
            <div className="input-group">
              <label className="input-label">Username</label>
              <input type="text" className="text-input" value={modalInput} onChange={e => setModalInput(e.target.value)} placeholder={t('friends.addFriendPlaceholder')} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn-primary" style={{ backgroundColor: 'var(--bg-tertiary)' }} onClick={() => setShowFriendModal(false)}>{t('voice.cancel')}</button>
              <button className="btn-primary" onClick={handleAddFriend} disabled={isAddingFriend}>
                {isAddingFriend && <span className="btn-spinner" />}
                {t('friends.addFriendButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showChannelModal && (
        <div className="modal-overlay" onClick={() => setShowChannelModal(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Create Channel</h2>
            <div className="input-group">
              <label className="input-label">Channel Type</label>
              <select className="text-input" value={channelType} onChange={e => setChannelType(e.target.value as any)}>
                <option value="TEXT">Text</option>
                <option value="VOICE">Voice</option>
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Channel Name</label>
              <input type="text" className="text-input" value={modalInput} onChange={e => setModalInput(e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn-primary" style={{ backgroundColor: 'var(--bg-tertiary)' }} onClick={() => setShowChannelModal(false)}>{t('voice.cancel')}</button>
              <button className="btn-primary" onClick={handleCreateChannel} disabled={isCreatingChannel}>
                {isCreatingChannel && <span className="btn-spinner" />}
                {t('server.createServerButton')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
