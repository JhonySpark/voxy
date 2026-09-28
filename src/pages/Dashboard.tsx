import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Volume2, PhoneCall, PhoneOff, Settings, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import VoiceRoom from '../components/VoiceRoom';
import { SettingsModal } from '../components/SettingsModal';
import UpdateNotification from '../components/UpdateNotification';
import { useToast } from '../components/common/Toast/ToastContext';
import { httpClient } from '../infrastructure/adapters/http/http-client.adapter';
import { realtimeClient } from '../infrastructure/adapters/realtime/socket-realtime.adapter';

import {
  DashboardView,
  ChannelTypeEnum,
  StorageKeys,
  RealtimeEvents,
  ApiRoutes,
  AppRoutes,
} from '../core/enums';

// Subcomponentes refatorados da Fase 2
import { ServerSidebar } from '../features/servers/components/ServerSidebar/ServerSidebar';
import type { ServerItem, ChannelItem } from '../features/servers/components/ServerSidebar/ServerSidebar';
import { ChannelList } from '../features/servers/components/ChannelList/ChannelList';
import { CreateServerModal } from '../features/servers/components/ServerModals/CreateServerModal';
import { CreateChannelModal } from '../features/servers/components/ServerModals/CreateChannelModal';
import { InviteServerModal } from '../features/servers/components/ServerModals/InviteServerModal';
import { FriendsSidebar } from '../features/friends/components/FriendsSidebar/FriendsSidebar';
import type { FriendUser } from '../features/friends/components/FriendsSidebar/FriendsSidebar';
import { AddFriendModal } from '../features/friends/components/AddFriendModal/AddFriendModal';
import { ChatArea } from '../features/chat/components/ChatArea/ChatArea';
import type { ChatMessage } from '../features/chat/components/ChatArea/ChatArea';

export default function Dashboard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Dados e Estado
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendUser[]>([]);
  const [servers, setServers] = useState<ServerItem[]>([]);

  const [activeView, setActiveView] = useState<DashboardView>(DashboardView.DM);
  const [activeFriend, setActiveFriend] = useState<FriendUser | null>(null);
  const [activeServer, setActiveServer] = useState<ServerItem | null>(null);
  const [activeChannel, setActiveChannel] = useState<ChannelItem | null>(null);

  // Estados de Voz e Canais
  const [serverVoiceStates, setServerVoiceStates] = useState<
    Record<string, { userId: string; username: string; isMuted?: boolean }[]>
  >({});
  const [channelStartTimes, setChannelStartTimes] = useState<Record<string, number>>({});
  const [connectedVoiceChannel, setConnectedVoiceChannel] = useState<{
    channelId: string;
    serverId: string;
    name: string;
  } | null>(null);
  const [activeSpeakers, setActiveSpeakers] = useState<Set<string>>(new Set());

  // Badges
  const [unreadDMs, setUnreadDMs] = useState<Record<string, number>>({});
  const [unreadChannels, setUnreadChannels] = useState<Record<string, number>>({});

  // Mensagens
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [myId, setMyId] = useState('');
  const [myUsername, setMyUsername] = useState('');

  // Modais
  const [showServerModal, setShowServerModal] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Dispositivos de Áudio
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>(
    localStorage.getItem(StorageKeys.AUDIO_INPUT) || ''
  );
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>(
    localStorage.getItem(StorageKeys.AUDIO_OUTPUT) || ''
  );
  const [userVolumes, setUserVolumes] = useState<Record<string, number>>({});

  const [initialLoading, setInitialLoading] = useState(true);

  // Refs de estado para callbacks de sockets
  const activeViewRef = useRef<DashboardView>(DashboardView.DM);
  const activeFriendIdRef = useRef<string | null>(null);
  const activeChannelIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    activeFriendIdRef.current = activeFriend?.id || null;
    if (activeFriend) {
      setUnreadDMs((prev) => ({ ...prev, [activeFriend.id]: 0 }));
    }
  }, [activeFriend]);

  useEffect(() => {
    activeChannelIdRef.current = activeChannel?.id || null;
    if (activeChannel) {
      setUnreadChannels((prev) => ({ ...prev, [activeChannel.id]: 0 }));
    }
  }, [activeChannel]);

  // Inicialização e Conexão Realtime
  useEffect(() => {
    const token = localStorage.getItem(StorageKeys.AUTH_TOKEN);
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

    realtimeClient.connect(token);

    // Eventos do Realtime
    realtimeClient.on(RealtimeEvents.NEW_MESSAGE, (msg: ChatMessage) => {
      if (activeViewRef.current === DashboardView.DM && activeFriendIdRef.current === msg.senderId) {
        setMessages((prev) => [...prev, msg]);
      } else {
        setUnreadDMs((prev) => ({
          ...prev,
          [msg.senderId]: (prev[msg.senderId] || 0) + 1,
        }));
      }
    });

    realtimeClient.on(RealtimeEvents.MESSAGE_SENT, (msg: ChatMessage) => {
      if (activeViewRef.current === DashboardView.DM && activeFriendIdRef.current === msg.receiverId) {
        setMessages((prev) => {
          const filtered = prev.filter((m) => !(m.id.startsWith('temp-') && m.content === msg.content));
          if (filtered.some((m) => m.id === msg.id)) return filtered;
          return [...filtered, msg];
        });
      }
    });

    realtimeClient.on(RealtimeEvents.NEW_CHANNEL_MESSAGE, (msg: ChatMessage) => {
      if (activeViewRef.current === DashboardView.SERVER && activeChannelIdRef.current === msg.channelId) {
        setMessages((prev) => [...prev, msg]);
      } else if (msg.channelId) {
        setUnreadChannels((prev) => ({
          ...prev,
          [msg.channelId!]: (prev[msg.channelId!] || 0) + 1,
        }));
      }
    });

    realtimeClient.on(RealtimeEvents.CHANNEL_MESSAGE_SENT, (msg: ChatMessage) => {
      if (activeViewRef.current === DashboardView.SERVER && activeChannelIdRef.current === msg.channelId) {
        setMessages((prev) => {
          const filtered = prev.filter((m) => !(m.id.startsWith('temp-') && m.content === msg.content));
          if (filtered.some((m) => m.id === msg.id)) return filtered;
          return [...filtered, msg];
        });
      }
    });

    realtimeClient.on(RealtimeEvents.FRIEND_ACTION, () => {
      fetchFriends();
    });

    realtimeClient.on(RealtimeEvents.FRIEND_ACTION_UPDATE, () => {
      fetchFriends();
    });

    realtimeClient.on(
      RealtimeEvents.VOICE_STATE_UPDATE,
      (data: {
        channelId: string;
        participants: { userId: string; username: string; isMuted?: boolean }[];
        startedAt?: number;
      }) => {
        setServerVoiceStates((prev) => ({
          ...prev,
          [data.channelId]: data.participants,
        }));

        setChannelStartTimes((prev) => {
          if (!data.startedAt) {
            const newTimes = { ...prev };
            delete newTimes[data.channelId];
            return newTimes;
          }
          return {
            ...prev,
            [data.channelId]: data.startedAt,
          };
        });
      }
    );

    realtimeClient.on(RealtimeEvents.CHANNEL_CREATED, () => {
      fetchServers();
    });

    realtimeClient.on(RealtimeEvents.SERVER_UPDATED, () => {
      fetchServers();
    });

    // Carga inicial
    const initData = async () => {
      try {
        await Promise.allSettled([fetchFriends(), fetchServers()]);
      } catch (err) {
        console.error('Error in initial load', err);
      } finally {
        setTimeout(() => setInitialLoading(false), 400);
      }
    };

    initData();

    return () => {
      realtimeClient.disconnect();
    };
  }, [navigate]);

  // Sincronizar presença em servidores
  useEffect(() => {
    if (servers.length > 0) {
      servers.forEach((server) => {
        realtimeClient.emit(RealtimeEvents.JOIN_SERVER, { serverId: server.id });
      });
    }
  }, [servers]);

  // Sincronizar presença no canal de voz ativo
  useEffect(() => {
    if (connectedVoiceChannel) {
      realtimeClient.emit(RealtimeEvents.JOIN_VOICE, {
        serverId: connectedVoiceChannel.serverId,
        channelId: connectedVoiceChannel.channelId,
      });
      return () => {
        realtimeClient.emit(RealtimeEvents.LEAVE_VOICE, {
          serverId: connectedVoiceChannel.serverId,
          channelId: connectedVoiceChannel.channelId,
        });
      };
    }
  }, [connectedVoiceChannel]);

  const fetchFriends = useCallback(async () => {
    try {
      const res = await httpClient.get<FriendUser[]>(ApiRoutes.FRIENDS);
      setFriends(res);
      const reqRes = await httpClient.get<FriendUser[]>(ApiRoutes.FRIEND_REQUESTS);
      setPendingRequests(reqRes);
    } catch (err) {
      console.error('Error fetching friends', err);
    }
  }, []);

  const fetchServers = useCallback(async () => {
    try {
      const res = await httpClient.get<ServerItem[]>(ApiRoutes.SERVERS);
      setServers(res);
    } catch (err) {
      console.error('Error fetching servers', err);
    }
  }, []);

  const fetchDMMessages = useCallback(async (friendId: string) => {
    try {
      const res = await httpClient.get<ChatMessage[]>(`${ApiRoutes.CHAT}/${friendId}`);
      setMessages(res);
    } catch (err) {
      console.error('Error fetching DM messages', err);
    }
  }, []);

  const fetchChannelMessages = useCallback(async (channelId: string) => {
    try {
      const res = await httpClient.get<ChatMessage[]>(`${ApiRoutes.CHANNELS}/${channelId}/messages`);
      setMessages(res);
    } catch (err) {
      console.error('Error fetching channel messages', err);
    }
  }, []);

  // Mudança de Conversa Ativa
  useEffect(() => {
    if (activeView === DashboardView.DM && activeFriend) {
      fetchDMMessages(activeFriend.id);
    } else if (activeView === DashboardView.SERVER && activeChannel) {
      if (activeChannel.type === ChannelTypeEnum.TEXT) {
        fetchChannelMessages(activeChannel.id);
      }
      realtimeClient.emit(RealtimeEvents.JOIN_CHANNEL, { channelId: activeChannel.id });
      return () => {
        realtimeClient.emit(RealtimeEvents.LEAVE_CHANNEL, { channelId: activeChannel.id });
      };
    }
  }, [activeFriend, activeChannel, activeView, fetchDMMessages, fetchChannelMessages]);

  // Sincroniza salas de servidores
  useEffect(() => {
    if (servers.length > 0) {
      servers.forEach((server) => {
        realtimeClient.emit(RealtimeEvents.JOIN_SERVER, { serverId: server.id });
      });
    }
  }, [servers]);

  // Sincroniza canal de voz conectado
  useEffect(() => {
    if (connectedVoiceChannel) {
      realtimeClient.emit(RealtimeEvents.JOIN_VOICE, {
        serverId: connectedVoiceChannel.serverId,
        channelId: connectedVoiceChannel.channelId,
      });
      return () => {
        realtimeClient.emit(RealtimeEvents.LEAVE_VOICE, {
          serverId: connectedVoiceChannel.serverId,
          channelId: connectedVoiceChannel.channelId,
        });
      };
    }
  }, [connectedVoiceChannel]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      content: newMessage.trim(),
      senderId: myId,
      createdAt: new Date().toISOString(),
      sender: { id: myId, username: myUsername, email: '' },
    };

    if (activeView === DashboardView.DM && activeFriend) {
      tempMsg.receiverId = activeFriend.id;
      setMessages((prev) => [...prev, tempMsg]);
      realtimeClient.emit(RealtimeEvents.SEND_MESSAGE, {
        receiverId: activeFriend.id,
        content: newMessage.trim(),
      });
    } else if (activeView === DashboardView.SERVER && activeChannel) {
      tempMsg.channelId = activeChannel.id;
      setMessages((prev) => [...prev, tempMsg]);
      realtimeClient.emit(RealtimeEvents.SEND_CHANNEL_MESSAGE, {
        channelId: activeChannel.id,
        content: newMessage.trim(),
      });
    }
    setNewMessage('');
  };

  const handleAcceptRequest = async (e: React.MouseEvent, friendId: string) => {
    e.stopPropagation();
    try {
      const res = await httpClient.post<{ targetId: string }>(`${ApiRoutes.FRIEND_ACCEPT}/${friendId}`);
      toast.success(t('friends.accept'));
      await fetchFriends();
      realtimeClient.emit(RealtimeEvents.FRIEND_ACTION, { targetId: res.targetId });
    } catch (err: any) {
      toast.error(t('friends.userNotFound'));
    }
  };

  const handleRejectRequest = async (e: React.MouseEvent, friendId: string) => {
    e.stopPropagation();
    try {
      const res = await httpClient.post<{ targetId: string }>(`${ApiRoutes.FRIEND_REJECT}/${friendId}`);
      toast.info(t('friends.reject'));
      await fetchFriends();
      realtimeClient.emit(RealtimeEvents.FRIEND_ACTION, { targetId: res.targetId });
    } catch (err: any) {
      toast.error(t('friends.userNotFound'));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(StorageKeys.AUTH_TOKEN);
    navigate(AppRoutes.LOGIN);
  };

  const totalUnreadDMs = Object.entries(unreadDMs).reduce((sum, [friendId, count]) => {
    if (activeView === DashboardView.DM && activeFriend?.id === friendId) return sum;
    return sum + count;
  }, 0);

  if (initialLoading) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#090d16' }}>
        <div className="btn-spinner" style={{ width: '36px', height: '36px' }} />
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* 1. Barra de Servidores (Esquerda) */}
      <ServerSidebar
        servers={servers}
        activeView={activeView}
        activeServer={activeServer}
        activeChannel={activeChannel}
        totalUnreadDMs={totalUnreadDMs}
        unreadChannels={unreadChannels}
        onSelectDMView={() => {
          setActiveView(DashboardView.DM);
          setActiveServer(null);
          setActiveChannel(null);
        }}
        onSelectServer={(server) => {
          setActiveView(DashboardView.SERVER);
          setActiveServer(server);
          setActiveChannel(server.channels?.[0] || null);
        }}
        onOpenCreateServerModal={() => setShowServerModal(true)}
      />

      {/* 2. Barra de Navegação Interna (Amigos ou Canais do Servidor) */}
      <div className="sidebar">
        {activeView === DashboardView.DM ? (
          <FriendsSidebar
            friends={friends}
            pendingRequests={pendingRequests}
            activeFriend={activeFriend}
            unreadDMs={unreadDMs}
            onSelectFriend={(f) => setActiveFriend(f)}
            onOpenAddFriendModal={() => setShowFriendModal(true)}
            onAcceptRequest={handleAcceptRequest}
            onRejectRequest={handleRejectRequest}
          />
        ) : activeServer ? (
          <ChannelList
            server={activeServer}
            myId={myId}
            activeChannel={activeChannel}
            serverVoiceStates={serverVoiceStates}
            channelStartTimes={channelStartTimes}
            userVolumes={userVolumes}
            onVolumeChange={(id, val) => setUserVolumes((prev) => ({ ...prev, [id]: val }))}
            unreadChannels={unreadChannels}
            activeSpeakers={activeSpeakers}
            onSelectChannel={(ch) => setActiveChannel(ch)}
            onConnectVoice={(ch) => {
              setConnectedVoiceChannel({
                channelId: ch.id,
                serverId: activeServer.id,
                name: ch.name,
              });
            }}
            onOpenCreateChannelModal={() => setShowChannelModal(true)}
            onOpenInviteModal={() => setShowInviteModal(true)}
          />
        ) : null}

        {/* Rodapé do Perfil do Usuário */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {connectedVoiceChannel && (
            <div className="active-call-bar">
              <div className="active-call-info">
                <span className="active-call-title">
                  <PhoneCall size={14} /> {t('voice.connected')}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {connectedVoiceChannel.name}
                </span>
              </div>
              <button
                className="icon-btn"
                style={{ color: '#ef4444' }}
                onClick={() => setConnectedVoiceChannel(null)}
                title={t('voice.cancel')}
              >
                <PhoneOff size={18} />
              </button>
            </div>
          )}

          <div className="user-profile-bar glass-panel" style={{ border: 'none', borderRadius: 0 }}>
            <div className="avatar" style={{ backgroundColor: 'var(--brand-primary, #34d399)', color: '#05140d', fontWeight: 700 }}>
              {myUsername ? myUsername.charAt(0).toUpperCase() : 'ME'}
            </div>
            <div className="user-info">
              <span className="user-name">{myUsername || 'User'}</span>
            </div>
            <button
              className="icon-btn"
              onClick={() => setShowSettingsModal(true)}
              title={t('settings.title')}
            >
              <Settings size={18} />
            </button>
            <button
              className="icon-btn"
              onClick={handleLogout}
              title={t('settings.logout')}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Área Principal */}
      <div className="main-content chat-area">
        {connectedVoiceChannel && activeChannel?.id === connectedVoiceChannel.channelId ? (
          <VoiceRoom
            channelId={connectedVoiceChannel.channelId}
            serverId={connectedVoiceChannel.serverId}
            myId={myId}
            myUsername={myUsername}
            onDisconnect={() => setConnectedVoiceChannel(null)}
            onParticipantsChange={() => {}}
            onMuteChange={(isMuted) => {
              realtimeClient.emit(RealtimeEvents.UPDATE_VOICE_MUTE, {
                serverId: connectedVoiceChannel.serverId,
                channelId: connectedVoiceChannel.channelId,
                isMuted,
              });
            }}
            audioInput={selectedAudioInput}
            audioOutput={selectedAudioOutput}
            userVolumes={userVolumes}
            onVolumeChange={(id, val) => setUserVolumes((prev) => ({ ...prev, [id]: val }))}
            onSpeakersChange={(speakers) => setActiveSpeakers(new Set(speakers))}
          />
        ) : activeView === DashboardView.DM && activeFriend ? (
          <ChatArea
            type="DM"
            target={activeFriend}
            myId={myId}
            messages={messages}
            newMessage={newMessage}
            onNewMessageChange={setNewMessage}
            onSendMessage={handleSendMessage}
          />
        ) : activeView === DashboardView.SERVER && activeChannel ? (
          activeChannel.type === ChannelTypeEnum.VOICE ? (
            activeChannel.id !== connectedVoiceChannel?.channelId && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexDirection: 'column', gap: '1rem' }}>
                <Volume2 size={48} opacity={0.5} />
                <p>{t('voice.clickToJoin')}</p>
              </div>
            )
          ) : (
            <ChatArea
              type="CHANNEL"
              target={activeChannel}
              myId={myId}
              messages={messages}
              newMessage={newMessage}
              onNewMessageChange={setNewMessage}
              onSendMessage={handleSendMessage}
            />
          )
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexDirection: 'column', gap: '1rem' }}>
            <Users size={48} opacity={0.5} />
            <p>{t('sidebar.search')}</p>
          </div>
        )}
      </div>

      {/* 4. Modais e Notificações */}
      <UpdateNotification />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onDeviceChange={(input, output) => {
          setSelectedAudioInput(input);
          setSelectedAudioOutput(output);
        }}
      />

      <AddFriendModal
        isOpen={showFriendModal}
        onClose={() => setShowFriendModal(false)}
        onFriendAdded={fetchFriends}
        onFriendAction={(targetId) => realtimeClient.emit(RealtimeEvents.FRIEND_ACTION, { targetId })}
      />

      <CreateServerModal
        isOpen={showServerModal}
        onClose={() => setShowServerModal(false)}
        onServerCreated={fetchServers}
      />

      {activeServer && (
        <>
          <CreateChannelModal
            isOpen={showChannelModal}
            serverId={activeServer.id}
            onClose={() => setShowChannelModal(false)}
            onChannelCreated={fetchServers}
            onChannelSocketEmit={() =>
              realtimeClient.emit(RealtimeEvents.CHANNEL_CREATED, { serverId: activeServer.id })
            }
          />

          <InviteServerModal
            isOpen={showInviteModal}
            server={activeServer}
            onClose={() => setShowInviteModal(false)}
          />
        </>
      )}
    </div>
  );
}
