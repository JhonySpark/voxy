import { useState, useCallback, useEffect } from 'react';
import { httpClient } from '../../../infrastructure/adapters/http/http-client.adapter';
import { realtimeClient } from '../../../infrastructure/adapters/realtime/socket-realtime.adapter';
import { ApiRoutes, RealtimeEvents } from '../../../core/enums';
import type { ServerItem, ChannelItem } from '../components/ServerSidebar/ServerSidebar';

export function useServers() {
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [activeServer, setActiveServer] = useState<ServerItem | null>(null);
  const [activeChannel, setActiveChannel] = useState<ChannelItem | null>(null);
  const [serverVoiceStates, setServerVoiceStates] = useState<
    Record<string, { userId: string; username: string; isMuted?: boolean }[]>
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
      });
    }
  }, [servers]);

  useEffect(() => {
    const onVoiceUpdate = (data: {
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
    };

    const onServerRefresh = () => {
      fetchServers();
    };

    realtimeClient.on(RealtimeEvents.VOICE_STATE_UPDATE, onVoiceUpdate);
    realtimeClient.on(RealtimeEvents.CHANNEL_CREATED, onServerRefresh);
    realtimeClient.on(RealtimeEvents.SERVER_UPDATED, onServerRefresh);

    return () => {
      realtimeClient.off(RealtimeEvents.VOICE_STATE_UPDATE, onVoiceUpdate);
      realtimeClient.off(RealtimeEvents.CHANNEL_CREATED, onServerRefresh);
      realtimeClient.off(RealtimeEvents.SERVER_UPDATED, onServerRefresh);
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
