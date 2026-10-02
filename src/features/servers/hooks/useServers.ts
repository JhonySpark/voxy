import { useState, useCallback, useEffect } from 'react';
import { httpClient } from '../../../infrastructure/adapters/http/http-client.adapter';
import { realtimeClient } from '../../../infrastructure/adapters/realtime/socket-realtime.adapter';
import { ApiRoutes, RealtimeEvents } from '../../../core/enums';
import type { ServerItem, ChannelItem } from '../components/ServerSidebar/ServerSidebar';

export interface VoiceParticipantState {
  userId: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  isMuted?: boolean;
}

export function useServers() {
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [activeServer, setActiveServer] = useState<ServerItem | null>(null);
  const [activeChannel, setActiveChannel] = useState<ChannelItem | null>(null);
  const [serverVoiceStates, setServerVoiceStates] = useState<
    Record<string, VoiceParticipantState[]>
  >({});
  const [channelStartTimes, setChannelStartTimes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const fetchServers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await httpClient.get<ServerItem[]>(ApiRoutes.SERVERS);
      setServers(res);
      // Atualiza o activeServer se ele já estiver selecionado para manter canais sincronizados
      setActiveServer((curr) => {
        if (!curr) return null;
        return res.find((s) => s.id === curr.id) || null;
      });
    } catch (err) {
      console.error('Error fetching servers', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Entra nas salas de realtime de todos os servidores
  useEffect(() => {
    if (servers.length > 0) {
      servers.forEach((server) => {
        realtimeClient.emit(RealtimeEvents.JOIN_SERVER, { serverId: server.id });
        // Acompanha todos os canais de texto para mostrar badges fora do canal ativo.
        server.channels
          .filter((channel) => channel.type === 'TEXT')
          .forEach((channel) => {
            realtimeClient.emit(RealtimeEvents.JOIN_CHANNEL, { channelId: channel.id });
          });
      });
    }
  }, [servers]);

  useEffect(() => {
    const onVoiceUpdate = (data: {
      channelId: string;
      participants: VoiceParticipantState[];
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
    };

    const onServerRefresh = () => {
      fetchServers();
    };

    const onUserProfileUpdated = () => {
      fetchServers();
    };

    const onServerDeleted = (data: { serverId: string }) => {
      setActiveServer((curr) => {
        if (curr && curr.id === data.serverId) {
          setActiveChannel(null);
          return null;
        }
        return curr;
      });
      fetchServers();
    };

    realtimeClient.on(RealtimeEvents.VOICE_STATE_UPDATE, onVoiceUpdate);
    realtimeClient.on(RealtimeEvents.CHANNEL_CREATED, onServerRefresh);
    realtimeClient.on(RealtimeEvents.SERVER_UPDATED, onServerRefresh);
    realtimeClient.on(RealtimeEvents.SERVER_DELETED, onServerDeleted);
    realtimeClient.on(RealtimeEvents.SERVER_MEMBERSHIP_CHANGED, onServerRefresh);
    realtimeClient.on(RealtimeEvents.USER_PROFILE_UPDATED, onUserProfileUpdated);

    return () => {
      realtimeClient.off(RealtimeEvents.VOICE_STATE_UPDATE, onVoiceUpdate);
      realtimeClient.off(RealtimeEvents.CHANNEL_CREATED, onServerRefresh);
      realtimeClient.off(RealtimeEvents.SERVER_UPDATED, onServerRefresh);
      realtimeClient.off(RealtimeEvents.SERVER_DELETED, onServerDeleted);
      realtimeClient.off(RealtimeEvents.SERVER_MEMBERSHIP_CHANGED, onServerRefresh);
      realtimeClient.off(RealtimeEvents.USER_PROFILE_UPDATED, onUserProfileUpdated);
    };
  }, [fetchServers]);

  return {
    servers,
    activeServer,
    setActiveServer,
    activeChannel,
    setActiveChannel,
    serverVoiceStates,
    channelStartTimes,
    loading,
    fetchServers,
  };
}
