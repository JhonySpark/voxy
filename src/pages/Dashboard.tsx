import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import VoiceRoom from '../components/VoiceRoom';
import { SettingsModal } from '../components/SettingsModal';
import { realtimeClient } from '../infrastructure/adapters/realtime/socket-realtime.adapter';

import {
  DashboardView,
  ChannelTypeEnum,
  StorageKeys,
  RealtimeEvents,
  AppRoutes,
  SettingsTabEnum,
  ApiRoutes,
  UserStatusEnum,
} from '../core/enums';
import { httpClient } from '../infrastructure/adapters/http/http-client.adapter';
import { preloadMedia } from '../core/utils/media.util';
import { logger } from '../core/services/logger.service';

import { ServerSidebar } from '../features/servers/components/ServerSidebar/ServerSidebar';
import { ChannelList, type ServerPermissions } from '../features/servers/components/ChannelList/ChannelList';
import { CreateServerModal } from '../features/servers/components/ServerModals/CreateServerModal';
import { CreateChannelModal } from '../features/servers/components/ServerModals/CreateChannelModal';
import { InviteServerModal } from '../features/servers/components/ServerModals/InviteServerModal';
import { ServerSettingsModal } from '../features/servers/components/ServerModals/ServerSettingsModal';
import { ServerMembersSidebar } from '../features/servers/components/ServerMembersSidebar/ServerMembersSidebar';
import { FriendsSidebar } from '../features/friends/components/FriendsSidebar/FriendsSidebar';
import type { FriendUser } from '../features/friends/components/FriendsSidebar/FriendsSidebar';
import { AddFriendModal } from '../features/friends/components/AddFriendModal/AddFriendModal';
import { ChatArea } from '../features/chat/components/ChatArea/ChatArea';
import { UserProfileBar } from '../features/user/components/UserProfileBar/UserProfileBar';
import { EditProfileModal } from '../features/user/components/EditProfileModal/EditProfileModal';
import { UserProfileModal } from '../features/user/components/UserProfileModal/UserProfileModal';
import type { UserProfileData } from '../features/user/components/UserPopout/UserPopout';
import { useToast } from '../components/common/Toast/ToastContext';
import { useDialog } from '../components/common/Dialog/DialogContext';

// Custom Hooks refatorados da Fase 3
import { useFriends } from '../features/friends/hooks/useFriends';
import { useServers } from '../features/servers/hooks/useServers';
import { useChat } from '../features/chat/hooks/useChat';

import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { confirm, prompt } = useDialog();
  const navigate = useNavigate();

  // Autenticação e Usuário
  const [myId, setMyId] = useState('');
  const [myUsername, setMyUsername] = useState('');
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfileData | null>(null);

  // Navegação e Seleção de Visualização
  const [activeView, setActiveView] = useState<DashboardView>(DashboardView.DM);
  const [activeFriend, setActiveFriend] = useState<FriendUser | null>(null);

  // Hooks de Domínio
  const {
    friends,
    pendingRequests,
    blockedUsers,
    fetchFriends,
    handleAcceptRequest,
    handleRejectRequest,
    handleRemoveFriend,
    handleBlockUser,
    handleUnblockUser,
  } = useFriends();

  const onRemoveFriendAction = async (friendId: string) => {
    const success = await handleRemoveFriend(friendId);
    if (success && activeFriend?.id === friendId) {
      setActiveFriend(null);
    }
  };

  const onBlockUserAction = async (targetId: string) => {
    const success = await handleBlockUser(targetId);
    if (success && activeFriend?.id === targetId) {
      setActiveFriend(null);
    }
  };

  const onUnblockUserAction = async (targetId: string) => {
    await handleUnblockUser(targetId);
  };

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
    isLoadingMessages,
    hasMoreMessages,
    isLoadingMoreMessages,
    loadMoreMessages,
    sendMessage,
    sendAttachmentMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    fetchDMMessages,
    fetchChannelMessages,
  } = useChat({
    myId,
    myUsername,
    myDisplayName: currentUserProfile?.displayName,
    myAvatarUrl: currentUserProfile?.avatarUrl,
    activeView,
    activeFriendId: activeFriend?.id || null,
    activeChannelId: activeChannel?.id || null,
  });

  // Membros do Servidor & Permissões
  const [isMembersListOpen, setIsMembersListOpen] = useState(true);
  const [activeServerPermissions, setActiveServerPermissions] = useState<ServerPermissions | null>(null);

  // Estados de Voz
  const [connectedVoiceChannel, setConnectedVoiceChannel] = useState<{
    channelId: string;
    serverId: string;
    name: string;
  } | null>(null);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState<Set<string>>(new Set());

  // Presença e Status dos Usuários
  const [userStatuses, setUserStatuses] = useState<
    Record<string, { status: UserStatusEnum | string; customStatus?: string }>
  >({});

  // Modais
  const [showServerModal, setShowServerModal] = useState(false);
  const [showServerSettingsModal, setShowServerSettingsModal] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [viewingUserOverride, setViewingUserOverride] = useState<Partial<UserProfileData> | null>(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabEnum>(SettingsTabEnum.VOICE);

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
        const [, , meRes] = await Promise.allSettled([
          fetchFriends(),
          fetchServers(),
          httpClient.get<UserProfileData>(ApiRoutes.USERS_ME),
        ]);
        if (meRes.status === 'fulfilled' && meRes.value) {
          if (meRes.value.ageClassification === 'CHILD') {
            localStorage.removeItem('token');
            navigate('/login?error=child_blocked');
            return;
          }
          setCurrentUserProfile(meRes.value);
        }
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

  // Pré-carrega mídias do usuário logado e amigos em background para exibição instantânea
  useEffect(() => {
    if (currentUserProfile?.bannerUrl) preloadMedia(currentUserProfile.bannerUrl);
    if (currentUserProfile?.avatarUrl) preloadMedia(currentUserProfile.avatarUrl);
  }, [currentUserProfile?.bannerUrl, currentUserProfile?.avatarUrl]);

  useEffect(() => {
    if (!friends || friends.length === 0) return;
    friends.forEach((f) => {
      if (f.avatarUrl) preloadMedia(f.avatarUrl);
      if (f.bannerUrl) preloadMedia(f.bannerUrl);
    });
  }, [friends]);

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

  // Sincronizar perfis atualizados em tempo real (avatar, banner, etc.)
  useEffect(() => {
    const onUserProfileUpdated = (data: { userId: string } & Partial<UserProfileData>) => {
      // Se for o próprio usuário
      setCurrentUserProfile((prev) => (prev && prev.id === data.userId ? { ...prev, ...data } : prev));

      // Se for o amigo com chat aberto no momento
      setActiveFriend((curr) => {
        if (!curr || curr.id !== data.userId) return curr;
        return {
          ...curr,
          displayName: data.displayName !== undefined ? data.displayName : curr.displayName,
          avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : curr.avatarUrl,
          bannerUrl: data.bannerUrl !== undefined ? data.bannerUrl : curr.bannerUrl,
          bannerColor: data.bannerColor !== undefined ? data.bannerColor : curr.bannerColor,
          bio: data.bio !== undefined ? data.bio : curr.bio,
        };
      });
    };

    realtimeClient.on(RealtimeEvents.USER_PROFILE_UPDATED, onUserProfileUpdated);
    return () => {
      realtimeClient.off(RealtimeEvents.USER_PROFILE_UPDATED, onUserProfileUpdated);
    };
  }, []);

  // Sincronizar status de presença em tempo real
  useEffect(() => {
    const onAllStatuses = (statuses: Record<string, { status: string; customStatus?: string }>) => {
      setUserStatuses((prev) => ({ ...prev, ...statuses }));
    };

    const onUserStatusUpdated = (data: { userId: string; status: string; customStatus?: string }) => {
      setUserStatuses((prev) => ({
        ...prev,
        [data.userId]: { status: data.status, customStatus: data.customStatus },
      }));

      // Se for o próprio usuário, atualiza estado local do perfil
      if (data.userId === myId) {
        setCurrentUserProfile((prev) =>
          prev ? { ...prev, status: data.status, customStatus: data.customStatus } : prev,
        );
      }
    };

    // Restaurar preferência de status salva localmente ao conectar
    const savedStatus = (localStorage.getItem('voxy_user_status') as UserStatusEnum) || UserStatusEnum.ONLINE;
    const savedCustomStatus = localStorage.getItem('voxy_user_custom_status') || undefined;

    if (savedStatus !== UserStatusEnum.ONLINE || savedCustomStatus) {
      realtimeClient.emit(RealtimeEvents.UPDATE_STATUS, {
        status: savedStatus,
        customStatus: savedCustomStatus,
      });
      setUserStatuses((prev) => ({
        ...prev,
        [myId]: { status: savedStatus, customStatus: savedCustomStatus },
      }));
    }

    realtimeClient.on(RealtimeEvents.ALL_USER_STATUSES, onAllStatuses);
    realtimeClient.on(RealtimeEvents.USER_STATUS_UPDATED, onUserStatusUpdated);
    realtimeClient.emit(RealtimeEvents.GET_USER_STATUSES);

    return () => {
      realtimeClient.off(RealtimeEvents.ALL_USER_STATUSES, onAllStatuses);
      realtimeClient.off(RealtimeEvents.USER_STATUS_UPDATED, onUserStatusUpdated);
    };
  }, [myId]);

  const handleUpdateMyStatus = (newStatus: UserStatusEnum, customStatus?: string) => {
    localStorage.setItem('voxy_user_status', newStatus);
    if (customStatus) {
      localStorage.setItem('voxy_user_custom_status', customStatus);
    } else {
      localStorage.removeItem('voxy_user_custom_status');
    }

    setUserStatuses((prev) => ({
      ...prev,
      [myId]: { status: newStatus, customStatus },
    }));
    setCurrentUserProfile((prev) => (prev ? { ...prev, status: newStatus, customStatus } : prev));

    realtimeClient.emit(RealtimeEvents.UPDATE_STATUS, {
      status: newStatus,
      customStatus,
    });
  };

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
  }, [activeFriend?.id, activeChannel?.id, activeChannel?.type, activeView, fetchDMMessages, fetchChannelMessages]);

  // Carregar e sincronizar permissões do usuário no servidor ativo
  useEffect(() => {
    if (!activeServer) {
      setActiveServerPermissions(null);
      return;
    }

    let isMounted = true;
    const fetchPerms = () => {
      httpClient
        .get<any>(`${ApiRoutes.SERVERS}/${activeServer.id}/my-permissions`)
        .then((perms) => {
          if (isMounted && perms) {
            const isOwner = perms.role === 'OWNER' || activeServer.ownerId === myId;
            const isAdmin = perms.role === 'ADMIN' || isOwner;
            const isModerator = perms.role === 'MODERATOR';
            setActiveServerPermissions({
              ...perms,
              isOwner,
              isAdmin,
              isModerator,
              canInvite: isOwner || isAdmin || Boolean(perms.canInvite),
              canManageChannels: isOwner || isAdmin || Boolean(perms.canManageChannels),
              canManageServer: isOwner || isAdmin || Boolean(perms.canManageServer),
            });
          }
        })
        .catch(() => {
          if (isMounted && activeServer.ownerId === myId) {
            setActiveServerPermissions({
              role: 'OWNER',
              isOwner: true,
              isAdmin: true,
              isModerator: false,
              canInvite: true,
              canDeleteMessages: true,
              canKickMembers: true,
              canBanMembers: true,
              canManageChannels: true,
              canManageServer: true,
            });
          }
        });
    };

    fetchPerms();

    const onMembershipChanged = (data: { serverId: string }) => {
      if (data.serverId === activeServer.id) {
        fetchPerms();
      }
    };

    realtimeClient.on(RealtimeEvents.SERVER_MEMBERSHIP_CHANGED, onMembershipChanged);
    realtimeClient.on(RealtimeEvents.SERVER_UPDATED, onMembershipChanged);

    return () => {
      isMounted = false;
      realtimeClient.off(RealtimeEvents.SERVER_MEMBERSHIP_CHANGED, onMembershipChanged);
      realtimeClient.off(RealtimeEvents.SERVER_UPDATED, onMembershipChanged);
    };
  }, [activeServer?.id]);

  // Eventos de Moderação em Tempo Real (ANPD / Diretrizes de Segurança)
  useEffect(() => {
    const onServerSuspended = (data: { serverId: string; reason?: string }) => {
      fetchServers();
      if (activeServer?.id === data.serverId) {
        if (connectedVoiceChannel?.serverId === data.serverId) {
          setConnectedVoiceChannel(null);
        }
        setActiveServer(null);
        setActiveChannel(null);
        setActiveView(DashboardView.DM);
        toast.error(`Servidor suspenso pela moderação: ${data.reason || 'Violação das regras'}`);
      }
    };

    const onAccountSuspended = (data: { userId: string; reason?: string }) => {
      if (data.userId === myId) {
        localStorage.removeItem(StorageKeys.AUTH_TOKEN);
        realtimeClient.disconnect();
        toast.error(`Sua conta foi suspensa: ${data.reason || 'Violação das diretrizes'}`);
        navigate(AppRoutes.LOGIN);
      }
    };

    const onMemberKicked = (data: { serverId: string; userId: string; serverName?: string }) => {
      if (data.userId === myId) {
        fetchServers();
        if (activeServer?.id === data.serverId) {
          if (connectedVoiceChannel?.serverId === data.serverId) {
            setConnectedVoiceChannel(null);
          }
          setActiveServer(null);
          setActiveChannel(null);
          setActiveView(DashboardView.DM);
        }
        toast.info(`Você foi expulso do servidor ${data.serverName || ''}`);
      }
    };

    const onMemberBanned = (data: { serverId: string; userId: string; serverName?: string }) => {
      if (data.userId === myId) {
        fetchServers();
        if (activeServer?.id === data.serverId) {
          if (connectedVoiceChannel?.serverId === data.serverId) {
            setConnectedVoiceChannel(null);
          }
          setActiveServer(null);
          setActiveChannel(null);
          setActiveView(DashboardView.DM);
        }
        toast.error(`Você foi banido do servidor ${data.serverName || ''}`);
      }
    };

    const onMemberMuted = (data: { serverId: string; userId: string; reason?: string; isMuted?: boolean }) => {
      if (data.userId === myId && activeServer?.id === data.serverId) {
        if (data.isMuted) {
          toast.warning(`Você foi silenciado neste servidor. Motivo: ${data.reason || 'Silenciado por um moderador'}`);
        } else {
          toast.info('Seu silenciamento no servidor foi removido.');
        }
      }
    };

    realtimeClient.on(RealtimeEvents.SERVER_SUSPENDED, onServerSuspended);
    realtimeClient.on(RealtimeEvents.ACCOUNT_SUSPENDED, onAccountSuspended);
    realtimeClient.on(RealtimeEvents.MEMBER_KICKED, onMemberKicked);
    realtimeClient.on(RealtimeEvents.MEMBER_BANNED, onMemberBanned);
    realtimeClient.on(RealtimeEvents.MEMBER_MUTED, onMemberMuted);

    return () => {
      realtimeClient.off(RealtimeEvents.SERVER_SUSPENDED, onServerSuspended);
      realtimeClient.off(RealtimeEvents.ACCOUNT_SUSPENDED, onAccountSuspended);
      realtimeClient.off(RealtimeEvents.MEMBER_KICKED, onMemberKicked);
      realtimeClient.off(RealtimeEvents.MEMBER_BANNED, onMemberBanned);
      realtimeClient.off(RealtimeEvents.MEMBER_MUTED, onMemberMuted);
    };
  }, [myId, activeServer?.id, connectedVoiceChannel?.serverId, fetchServers, navigate, toast, setActiveServer, setActiveChannel]);

  useEffect(() => {
    if (activeServer) {
      logger.logEvent('SERVER_OPENED', {
        serverId: activeServer.id,
        serverName: activeServer.name,
      });
    }
  }, [activeServer?.id]);

  useEffect(() => {
    if (activeChannel) {
      logger.logEvent('CHANNEL_OPENED', {
        channelId: activeChannel.id,
        channelName: activeChannel.name,
        type: activeChannel.type,
      });
    }
  }, [activeChannel?.id]);

  const handleLogout = () => {
    logger.logEvent('USER_LOGOUT', { myId, myUsername });
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

  const handleMuteChange = (muted: boolean) => {
    setIsVoiceMuted(muted);
    if (connectedVoiceChannel) {
      realtimeClient.emit(RealtimeEvents.UPDATE_VOICE_MUTE, {
        serverId: connectedVoiceChannel.serverId,
        channelId: connectedVoiceChannel.channelId,
        isMuted: muted,
      });
    }
  };

  const handleToggleVoiceMute = () => {
    handleMuteChange(!isVoiceMuted);
  };

  const viewingUserInitialData = useMemo(() => {
    if (!viewingUserId) return undefined;
    if (viewingUserOverride) {
      return viewingUserOverride;
    }
    if (viewingUserId === myId && currentUserProfile) {
      return currentUserProfile;
    }
    const friend = friends.find((f) => f.id === viewingUserId);
    if (friend) {
      return {
        username: friend.username,
        displayName: friend.displayName,
        avatarUrl: friend.avatarUrl,
        bannerUrl: friend.bannerUrl,
        bannerColor: friend.bannerColor,
        bio: friend.bio,
      };
    }
    for (const participants of Object.values(serverVoiceStates)) {
      const p = participants.find((u) => u.userId === viewingUserId);
      if (p) {
        return {
          username: p.username,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
        };
      }
    }
    const recentMsg = messages.find((m) => m.senderId === viewingUserId);
    if (recentMsg?.sender) {
      return {
        username: recentMsg.sender.username,
        displayName: recentMsg.sender.displayName,
        avatarUrl: recentMsg.sender.avatarUrl,
      };
    }
    return undefined;
  }, [viewingUserId, viewingUserOverride, friends, serverVoiceStates, messages, myId, currentUserProfile]);

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
          const defaultChannel =
            server.channels?.find((ch) => ch.type === ChannelTypeEnum.TEXT) ||
            server.channels?.[0] ||
            null;
          setActiveChannel(defaultChannel);
        }}
        onOpenCreateServerModal={() => setShowServerModal(true)}
      />

      {/* 2. Barra de Navegação Interna (Amigos ou Canais do Servidor) */}
      <div className="sidebar">
        {activeView === DashboardView.DM ? (
          <FriendsSidebar
            friends={friends}
            pendingRequests={pendingRequests}
            blockedUsers={blockedUsers}
            activeFriend={activeFriend}
            unreadDMs={unreadDMs}
            userStatuses={userStatuses}
            onSelectFriend={(f) => setActiveFriend(f)}
            onOpenAddFriendModal={() => setShowFriendModal(true)}
            onAcceptRequest={handleAcceptRequest}
            onRejectRequest={handleRejectRequest}
            onRemoveFriend={onRemoveFriendAction}
            onBlockUser={onBlockUserAction}
            onUnblockUser={onUnblockUserAction}
            onViewUserProfile={setViewingUserId}
          />
        ) : activeServer ? (
          <ChannelList
            server={activeServer}
            myId={myId}
            permissions={activeServerPermissions}
            activeChannel={activeChannel}
            serverVoiceStates={serverVoiceStates}
            channelStartTimes={channelStartTimes}
            userVolumes={userVolumes}
            onVolumeChange={(id, val) => setUserVolumes((prev) => ({ ...prev, [id]: val }))}
            unreadChannels={unreadChannels}
            activeSpeakers={activeSpeakers}
            userStatuses={userStatuses}
            onSelectChannel={(ch) => setActiveChannel(ch)}
            onConnectVoice={(ch) => {
              setConnectedVoiceChannel({
                channelId: ch.id,
                serverId: activeServer.id,
                name: ch.name,
              });
              setIsVoiceMuted(false);
            }}
            onOpenCreateChannelModal={() => setShowChannelModal(true)}
            onOpenInviteModal={() => setShowInviteModal(true)}
            onOpenServerSettings={() => setShowServerSettingsModal(true)}
            onViewUserProfile={setViewingUserId}
            onRenameChannel={async (channel) => {
              const rawName = await prompt({
                title: t('channel.renameTitle', 'Renomear Canal'),
                message: t('channel.renamePrompt', 'Digite o novo nome para o canal:'),
                defaultValue: channel.name,
                placeholder: 'ex: geral',
                confirmText: t('common.save', 'Salvar'),
              });
              const name = rawName?.trim();
              if (!name || name === channel.name) return;
              try {
                await httpClient.patch(`${ApiRoutes.CHANNELS}/${channel.id}`, { name });
                await fetchServers();
                realtimeClient.emit(RealtimeEvents.SERVER_UPDATED, { serverId: activeServer.id });
                toast.success('Nome do canal atualizado.');
              } catch (error: any) {
                toast.error(error.response?.data?.message || 'Não foi possível renomear o canal.');
              }
            }}
            onDeleteChannel={async (channel) => {
              const ok = await confirm({
                title: t('channel.deleteTitle', 'Excluir Canal'),
                message: `Excluir o canal "${channel.name}"? Esta ação também remove as mensagens dele.`,
                confirmText: t('common.delete', 'Excluir Canal'),
                variant: 'danger',
              });
              if (!ok) return;
              try {
                await httpClient.delete(`${ApiRoutes.CHANNELS}/${channel.id}`);
                if (activeChannel?.id === channel.id) {
                  const nextChannel = activeServer.channels.find((item) => item.id !== channel.id) || null;
                  setActiveChannel(nextChannel);
                }
                await fetchServers();
                realtimeClient.emit(RealtimeEvents.SERVER_UPDATED, { serverId: activeServer.id });
                toast.success('Canal excluído.');
              } catch (error: any) {
                toast.error(error.response?.data?.message || 'Não foi possível excluir o canal.');
              }
            }}
          />
        ) : null}

        {/* Rodapé do Perfil do Usuário */}
        <UserProfileBar
          user={currentUserProfile || { id: myId, username: myUsername }}
          connectedVoiceChannel={connectedVoiceChannel}
          isVoiceMuted={isVoiceMuted}
          onToggleVoiceMute={handleToggleVoiceMute}
          onDisconnectVoice={() => {
            setConnectedVoiceChannel(null);
            setIsVoiceMuted(false);
          }}
          onOpenSettings={(tab) => {
            setSettingsInitialTab(tab || SettingsTabEnum.VOICE);
            setShowSettingsModal(true);
          }}
          onOpenEditProfile={() => setShowEditProfileModal(true)}
          onLogout={handleLogout}
          currentStatus={userStatuses[myId]?.status || currentUserProfile?.status || UserStatusEnum.ONLINE}
          currentActivity={userStatuses[myId]?.customStatus || currentUserProfile?.customStatus}
          onUpdateStatus={handleUpdateMyStatus}
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
            userAgeClassification={currentUserProfile?.ageClassification}
            isMuted={isVoiceMuted}
            onDisconnect={() => {
              setConnectedVoiceChannel(null);
              setIsVoiceMuted(false);
            }}
            onParticipantsChange={() => {}}
            onMuteChange={handleMuteChange}
            audioInput={selectedAudioInput}
            audioOutput={selectedAudioOutput}
            userVolumes={userVolumes}
            onVolumeChange={(id, val) => setUserVolumes((prev) => ({ ...prev, [id]: val }))}
            onSpeakersChange={(speakers) => setActiveSpeakers(new Set(speakers))}
            onViewUserProfile={setViewingUserId}
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
            onSendAttachment={sendAttachmentMessage}
            onEditMessage={editMessage}
            onToggleReaction={toggleReaction}
            isLoading={isLoadingMessages}
            onOpenUserProfile={setViewingUserId}
            targetStatus={activeFriend ? userStatuses[activeFriend.id]?.status : undefined}
            onRemoveFriend={onRemoveFriendAction}
            onBlockUser={onBlockUserAction}
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
            <div style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, width: '100%', height: '100%' }}>
              <ChatArea
                type="CHANNEL"
                target={activeChannel}
                myId={myId}
                messages={messages}
                newMessage={newMessage}
                onNewMessageChange={setNewMessage}
                onSendMessage={sendMessage}
                onSendAttachment={sendAttachmentMessage}
                onEditMessage={editMessage}
                onToggleReaction={toggleReaction}
                isLoading={isLoadingMessages}
                isLoadingMore={isLoadingMoreMessages}
                hasMoreMessages={hasMoreMessages}
                onLoadMoreMessages={loadMoreMessages}
                onOpenUserProfile={setViewingUserId}
                isMembersListOpen={isMembersListOpen}
                onToggleMembersList={() => setIsMembersListOpen((prev) => !prev)}
                canDeleteAnyMessage={
                  Boolean(
                    (activeServer && activeServer.ownerId === myId) ||
                    activeServerPermissions?.canDeleteMessages ||
                    activeServerPermissions?.isAdmin
                  )
                }
                onDeleteMessage={(messageId) => {
                  if (activeChannel) {
                    deleteMessage(activeChannel.id, messageId);
                  }
                }}
              />
              {isMembersListOpen && activeServer && (
                <ServerMembersSidebar
                  serverId={activeServer.id}
                  serverOwnerId={activeServer.ownerId}
                  myId={myId}
                  permissions={activeServerPermissions}
                  userStatuses={userStatuses}
                  onClose={() => setIsMembersListOpen(false)}
                  onOpenUserProfile={(id, data) => {
                    setViewingUserId(id);
                    setViewingUserOverride(data || null);
                  }}
                  onMembersUpdated={fetchServers}
                />
              )}
            </div>
          )
        ) : (
          <div className={styles.emptyStateContainer}>
            <Users size={48} className={styles.emptyIcon} />
            <p>{t('sidebar.search')}</p>
          </div>
        ))}
      </div>

      {/* 4. Modais */}

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onDeviceChange={(input, output) => {
          setSelectedAudioInput(input);
          setSelectedAudioOutput(output);
        }}
        initialTab={settingsInitialTab}
        currentUser={currentUserProfile}
        onOpenEditProfile={() => {
          setShowSettingsModal(false);
          setShowEditProfileModal(true);
        }}
        onProfileUpdated={(updated) =>
          setCurrentUserProfile((prev) => (prev ? { ...prev, ...updated } : prev))
        }
        onLogout={handleLogout}
      />

      {currentUserProfile && (
        <EditProfileModal
          isOpen={showEditProfileModal}
          onClose={() => setShowEditProfileModal(false)}
          user={currentUserProfile}
          onProfileUpdated={(updated) =>
            setCurrentUserProfile((prev) => (prev ? { ...prev, ...updated } : prev))
          }
        />
      )}

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
            onMembersUpdated={fetchServers}
          />

          <ServerSettingsModal
            isOpen={showServerSettingsModal}
            server={activeServer}
            myId={myId}
            onClose={() => setShowServerSettingsModal(false)}
            onServerUpdated={fetchServers}
            onServerDeleted={() => {
              setShowServerSettingsModal(false);
              setActiveServer(null);
              setActiveChannel(null);
              setActiveView(DashboardView.DM);
              fetchServers();
            }}
          />
        </>
      )}

      {viewingUserId && (
        <UserProfileModal
          isOpen={!!viewingUserId}
          userId={viewingUserId}
          currentUserId={myId}
          userStatus={viewingUserId ? userStatuses[viewingUserId]?.status : undefined}
          userActivity={viewingUserId ? userStatuses[viewingUserId]?.customStatus : undefined}
          initialData={viewingUserInitialData}
          isFriend={friends.some((f) => f.id === viewingUserId)}
          onClose={() => {
            setViewingUserId(null);
            setViewingUserOverride(null);
          }}
          onOpenDirectMessage={async (targetUserId) => {
            const friend = friends.find((f) => f.id === targetUserId);
            if (friend) {
              setActiveView(DashboardView.DM);
              setActiveServer(null);
              setActiveChannel(null);
              setActiveFriend(friend);
            } else {
              try {
                const userData = await httpClient.get<UserProfileData>(`/users/${targetUserId}`);
                setActiveView(DashboardView.DM);
                setActiveServer(null);
                setActiveChannel(null);
                setActiveFriend({
                  id: userData.id,
                  username: userData.username,
                  displayName: userData.displayName,
                  avatarUrl: userData.avatarUrl,
                  bannerUrl: userData.bannerUrl,
                  bannerColor: userData.bannerColor,
                  bio: userData.bio,
                  email: userData.email || '',
                });
              } catch (e) {
                console.error(e);
                const fallback = viewingUserInitialData || {
                  id: targetUserId,
                  username: 'usuario',
                };
                setActiveView(DashboardView.DM);
                setActiveServer(null);
                setActiveChannel(null);
                setActiveFriend({
                  id: targetUserId,
                  username: fallback.username || 'usuario',
                  displayName: fallback.displayName,
                  avatarUrl: fallback.avatarUrl,
                  email: '',
                });
              }
            }
            setViewingUserId(null);
            setViewingUserOverride(null);
          }}
          onAddFriend={async (username) => {
            try {
              const res = await httpClient.post<{ targetId: string }>(ApiRoutes.FRIEND_REQUEST, { username });
              realtimeClient.emit(RealtimeEvents.FRIEND_ACTION, { targetId: res.targetId });
              toast.success(t('friends.requestSent', { username }));
              fetchFriends();
            } catch (err: any) {
              toast.error(err.response?.data?.message || t('friends.userNotFound'));
            }
          }}
          onRemoveFriend={onRemoveFriendAction}
          onBlockUser={onBlockUserAction}
          onUnblockUser={onUnblockUserAction}
          onOpenEditProfile={() => {
            setViewingUserId(null);
            setShowEditProfileModal(true);
          }}
        />
      )}
    </div>
  );
}
