import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import heroLogo from '../assets/logo.png';
import { io, Socket } from 'socket.io-client';
import api from '../api';
import { Users, LogOut, Send, Plus, Hash, Volume2, PhoneCall, PhoneOff, Check, X, Settings } from 'lucide-react';
import VoiceRoom from '../components/VoiceRoom';
import { useTranslation } from 'react-i18next';

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
  channels: Channel[];
}

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
  const [serverVoiceStates, setServerVoiceStates] = useState<{ [channelId: string]: { id: string; username: string }[] }>({});
  
  // Badges & Persistent Voice State
  const [unreadDMs, setUnreadDMs] = useState<{ [userId: string]: number }>({});
  const [unreadChannels, setUnreadChannels] = useState<{ [channelId: string]: number }>({});
  const [connectedVoiceChannel, setConnectedVoiceChannel] = useState<{ channelId: string; serverId: string; name: string } | null>(null);
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

    const newSocket = io('http://localhost:3000', {
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
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
      }
    });

    newSocket.on('newChannelMessage', (msg: Message) => {
      if (!msg.channelId) return;
      if (activeViewRef.current === 'SERVER' && activeChannelIdRef.current === msg.channelId) {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
      } else {
        setUnreadChannels(prev => ({ ...prev, [msg.channelId as string]: (prev[msg.channelId as string] || 0) + 1 }));
      }
    });

    newSocket.on('friendActionUpdate', () => {
      fetchFriends();
    });

    newSocket.on('serverVoiceUpdate', (data: { channelId: string, participants: { id: string; username: string }[] }) => {
      setServerVoiceStates(prev => ({
        ...prev,
        [data.channelId]: data.participants
      }));
    });

    fetchFriends();
    fetchServers();

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

    if (activeView === 'DM' && activeFriend) {
      socket.emit('sendMessage', {
        receiverId: activeFriend.id,
        content: newMessage
      });
    } else if (activeView === 'SERVER' && activeChannel) {
      socket.emit('sendChannelMessage', {
        channelId: activeChannel.id,
        content: newMessage
      });
    }
    setNewMessage('');
  };

  const handleCreateServer = async () => {
    if (!modalInput.trim()) return;
    try {
      await api.post('/servers', { name: modalInput });
      fetchServers();
      setShowServerModal(false);
      setModalInput('');
    } catch (err) {
      console.error('Error creating server', err);
    }
  };

  const handleJoinServer = async () => {
    if (!inviteInput.trim()) return;
    try {
      await api.post('/servers/join', { inviteCode: inviteInput });
      fetchServers();
      setShowServerModal(false);
      setInviteInput('');
    } catch (err) {
      console.error('Error joining server', err);
      alert('Invalid or expired invite code');
    }
  };

  const handleAddFriend = async () => {
    if (!modalInput.trim()) return;
    try {
      const res = await api.post('/friends/request', { username: modalInput });
      setShowFriendModal(false);
      setModalInput('');
      fetchFriends();
      socket?.emit('friendAction', { targetId: res.data.targetId });
    } catch (err) {
      console.error('Error adding friend', err);
      alert('Error adding friend or user not found');
    }
  };

  const handleCreateChannel = async () => {
    if (!modalInput.trim() || !activeServer) return;
    try {
      await api.post(`/channels/${activeServer.id}`, { name: modalInput, type: channelType });
      fetchServers(); 
      setShowChannelModal(false);
      setModalInput('');
    } catch (err) {
      console.error('Error creating channel', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('voxy_token');
    navigate('/login');
  };

  return (
    <div className="app-container">
      {/* Far-left Server Sidebar */}
      <div className="server-sidebar">
        <div 
          className={`server-icon ${activeView === 'DM' ? 'active' : ''}`}
          onClick={() => { setActiveView('DM'); setActiveServer(null); setActiveChannel(null); }}
          title={t('sidebar.directMessages')}
          style={{ padding: 0, backgroundColor: 'transparent' }}
        >
          <img src={heroLogo} alt="Home" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
        </div>
        
        <div style={{ width: '32px', height: '2px', backgroundColor: 'var(--border-subtle)', borderRadius: '2px' }} />

        {servers.map(server => (
          <div 
            key={server.id} 
            className={`server-icon ${activeServer?.id === server.id ? 'active' : ''}`}
            onClick={() => { setActiveView('SERVER'); setActiveServer(server); setActiveChannel(server.channels[0]); }}
            title={server.name}
          >
            {server.name.substring(0, 2).toUpperCase()}
          </div>
        ))}

        <div className="server-icon" style={{ backgroundColor: 'transparent', border: '1px dashed var(--text-muted)', color: 'var(--brand-primary)' }} onClick={() => { setModalInput(''); setShowServerModal(true); }} title={t('server.addServer')}>
          <Plus size={24} />
        </div>
      </div>

      {/* Main Sidebar */}
      <div className="sidebar">
        {activeView === 'DM' ? (
          <>
            <div className="sidebar-header">
              <span className="sidebar-title">{t('sidebar.directMessages')}</span>
              <button className="icon-btn" title={t('friends.addFriend')} onClick={() => { setModalInput(''); setShowFriendModal(true); }}>
                <Plus size={20} />
              </button>
            </div>
            <div className="friends-list">
              {pendingRequests.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.5rem' }}>{t('friends.pendingRequests')}</div>
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
              )}
              {friends.map(friend => (
                <div 
                  key={friend.id} 
                  className={`friend-item ${activeFriend?.id === friend.id ? 'active' : ''}`}
                  onClick={() => setActiveFriend(friend)}
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="avatar">
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
          </>
        ) : (
          <>
            <div className="sidebar-header" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <span className="sidebar-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeServer?.name}</span>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button className="icon-btn" title={t('server.inviteFriends')} onClick={() => setShowInviteModal(true)}>
                  <Users size={20} />
                </button>
                <button className="icon-btn" title="Create Channel" onClick={() => { setModalInput(''); setChannelType('TEXT'); setShowChannelModal(true); }}>
                  <Plus size={20} />
                </button>
              </div>
            </div>
            <div className="friends-list">
              {activeServer?.channels.map(channel => (
                <div key={channel.id}>
                  <div 
                    className={`friend-item ${activeChannel?.id === channel.id ? 'active' : ''}`}
                    onClick={() => { 
                      setActiveChannel(channel); 
                      if (channel.type === 'VOICE') {
                        setConnectedVoiceChannel({ channelId: channel.id, serverId: activeServer.id, name: channel.name });
                      }
                    }}
                    style={{ gap: '0.5rem', padding: '0.5rem 0.75rem', justifyContent: 'space-between' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {channel.type === 'TEXT' ? <Hash size={18} color="var(--brand-primary)" /> : <Volume2 size={18} color="var(--brand-primary)" />}
                      <span className="user-name" style={{ fontSize: '0.95rem' }}>{channel.name}</span>
                    </div>
                    {channel.type === 'TEXT' && unreadChannels[channel.id] > 0 && activeChannel?.id !== channel.id && (
                      <div className="badge">{unreadChannels[channel.id]}</div>
                    )}
                  </div>
                  {channel.type === 'VOICE' && serverVoiceStates[channel.id]?.length > 0 && (
                    <div style={{ paddingLeft: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                      {serverVoiceStates[channel.id].map((p: any) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.6rem', fontWeight: 'bold' }}>
                            {p.username.charAt(0).toUpperCase()}
                          </div>
                          {p.username}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
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
          <div style={{ display: activeChannel?.id === connectedVoiceChannel.channelId ? 'flex' : 'none', flex: 1, flexDirection: 'column' }}>
            <VoiceRoom 
              channelId={connectedVoiceChannel.channelId}
              serverId={connectedVoiceChannel.serverId}
              myId={myId} 
              myUsername={myUsername}
              onDisconnect={() => setConnectedVoiceChannel(null)}
              onParticipantsChange={() => {}}
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
                    {msg.senderId === myId ? t('chat.you') : activeFriend.username.charAt(0).toUpperCase()}
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
                    {msg.senderId === myId ? t('chat.you') : (msg.sender?.username?.charAt(0).toUpperCase() || 'U')}
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
              <button className="btn-primary" onClick={handleCreateServer}>{t('server.createServerButton')}</button>
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
              <button className="btn-primary" onClick={handleJoinServer}>{t('server.joinServerButton')}</button>
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
              <button className="btn-primary" onClick={handleAddFriend}>{t('friends.addFriendButton')}</button>
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
              <button className="btn-primary" onClick={handleCreateChannel}>{t('server.createServerButton')}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
