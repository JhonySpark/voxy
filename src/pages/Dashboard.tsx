import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import VoiceRoom from '../components/VoiceRoom';
import { SettingsModal } from '../components/SettingsModal';
import UpdateNotification from '../components/UpdateNotification';
import { realtimeClient } from '../infrastructure/adapters/realtime/socket-realtime.adapter';

import {
  DashboardView,
  ChannelTypeEnum,
  StorageKeys,
  RealtimeEvents,
  AppRoutes,
} from '../core/enums';

// Subcomponentes refatorados
import { ServerSidebar } from '../features/servers/components/ServerSidebar/ServerSidebar';
import { ChannelList } from '../features/servers/components/ChannelList/ChannelList';
import { CreateServerModal } from '../features/servers/components/ServerModals/CreateServerModal';
import { CreateChannelModal } from '../features/servers/components/ServerModals/CreateChannelModal';
import { InviteServerModal } from '../features/servers/components/ServerModals/InviteServerModal';
import { FriendsSidebar } from '../features/friends/components/FriendsSidebar/FriendsSidebar';
import type { FriendUser } from '../features/friends/components/FriendsSidebar/FriendsSidebar';
import { AddFriendModal } from '../features/friends/components/AddFriendModal/AddFriendModal';
import { ChatArea } from '../features/chat/components/ChatArea/ChatArea';
import { UserProfileBar } from '../features/user/components/UserProfileBar/UserProfileBar';

// Custom Hooks refatorados da Fase 3
import { useFriends } from '../features/friends/hooks/useFriends';
import { useServers } from '../features/servers/hooks/useServers';
import { useChat } from '../features/chat/hooks/useChat';

import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Autenticação e Usuário
  const [myId, setMyId] = useState('');
  const [myUsername, setMyUsername] = useState('');

  // Navegação e Seleção de Visualização
  const [activeView, setActiveView] = useState<DashboardView>(DashboardView.DM);
  const [activeFriend, setActiveFriend] = useState<FriendUser | null>(null);

  // Hooks de Domínio
  const {
    friends,
    pendingRequests,
    fetchFriends,
    handleAcceptRequest,
    handleRejectRequest,
  } = useFriends();

  const {
    servers,
    activeServer,
    setActiveServer,
    activeChannel,
    setActiveChannel,
    serverVoiceStates,
    channelStartTimes,
    fetchServers,
  } = useServers();

  const {
    messages,
    newMessage,
    setNewMessage,
    unreadDMs,
    unreadChannels,
    sendMessage,
    fetchDMMessages,
    fetchChannelMessages,
  } = useChat({
    myId,
    myUsername,
    activeView,
    activeFriendId: activeFriend?.id || null,
    activeChannelId: activeChannel?.id || null,
  });

  // Estados de Voz
  const [connectedVoiceChannel, setConnectedVoiceChannel] = useState<{
    channelId: string;
    serverId: string;
    name: string;
  } | null>(null);
  const [activeSpeakers, setActiveSpeakers] = useState<Set<string>>(new Set());

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

  // Inicialização e Conexão Realtime
  useEffect(() => {
    const token = localStorage.getItem(StorageKeys.AUTH_TOKEN);
    if (!token) {
      navigate(AppRoutes.LOGIN);
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
  }, [navigate, fetchFriends, fetchServers]);

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

  const handleLogout = () => {
    localStorage.removeItem(StorageKeys.AUTH_TOKEN);
    navigate(AppRoutes.LOGIN);
  };

  const totalUnreadDMs = Object.entries(unreadDMs).reduce((sum, [friendId, count]) => {
    if (activeView === DashboardView.DM && activeFriend?.id === friendId) return sum;
    return sum + count;
  }, 0);

  const isViewingConnectedVoice = Boolean(
    connectedVoiceChannel && activeChannel?.id === connectedVoiceChannel.channelId,
  );

  if (initialLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={`btn-spinner ${styles.loadingSpinner}`} />
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
        <UserProfileBar
          username={myUsername}
          connectedVoiceChannel={connectedVoiceChannel}
          onDisconnectVoice={() => setConnectedVoiceChannel(null)}
          onOpenSettings={() => setShowSettingsModal(true)}
          onLogout={handleLogout}
        />
      </div>

      {/* 3. Área Principal */}
      <div className="main-content chat-area">
        {connectedVoiceChannel && (
          <div style={{ display: isViewingConnectedVoice ? 'contents' : 'none' }}>
          <VoiceRoom
            key={connectedVoiceChannel.channelId}
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
          </div>
        )}

        {!isViewingConnectedVoice && (activeView === DashboardView.DM && activeFriend ? (
          <ChatArea
            type="DM"
            target={activeFriend}
            myId={myId}
            messages={messages}
            newMessage={newMessage}
            onNewMessageChange={setNewMessage}
            onSendMessage={sendMessage}
          />
        ) : activeView === DashboardView.SERVER && activeChannel ? (
          activeChannel.type === ChannelTypeEnum.VOICE ? (
            activeChannel.id !== connectedVoiceChannel?.channelId && (
              <div className={styles.emptyStateContainer}>
                <Volume2 size={48} className={styles.emptyIcon} />
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
              onSendMessage={sendMessage}
            />
          )
        ) : (
          <div className={styles.emptyStateContainer}>
            <Users size={48} className={styles.emptyIcon} />
            <p>{t('sidebar.search')}</p>
          </div>
        ))}
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
