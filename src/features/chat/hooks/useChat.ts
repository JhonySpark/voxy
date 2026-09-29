import { useState, useCallback, useEffect, useRef } from 'react';
import { httpClient } from '../../../infrastructure/adapters/http/http-client.adapter';
import { realtimeClient } from '../../../infrastructure/adapters/realtime/socket-realtime.adapter';
import { ApiRoutes, RealtimeEvents, DashboardView } from '../../../core/enums';
import type { ChatMessage } from '../components/ChatArea/ChatArea';

interface UseChatProps {
  myId: string;
  myUsername: string;
  activeView: DashboardView;
  activeFriendId: string | null;
  activeChannelId: string | null;
}

export function useChat({
  myId,
  myUsername,
  activeView,
  activeFriendId,
  activeChannelId,
}: UseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadDMs, setUnreadDMs] = useState<Record<string, number>>({});
  const [unreadChannels, setUnreadChannels] = useState<Record<string, number>>({});

  const activeViewRef = useRef(activeView);
  const activeFriendIdRef = useRef(activeFriendId);
  const activeChannelIdRef = useRef(activeChannelId);
  const myIdRef = useRef(myId);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  useEffect(() => {
    activeFriendIdRef.current = activeFriendId;
    if (activeFriendId) {
      setUnreadDMs((prev) => ({ ...prev, [activeFriendId]: 0 }));
    }
  }, [activeFriendId]);

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
    if (activeChannelId) {
      setUnreadChannels((prev) => ({ ...prev, [activeChannelId]: 0 }));
    }
  }, [activeChannelId]);

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

  const sendMessage = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const content = newMessage.trim();
      if (!content) return;

      const tempMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        content,
        senderId: myId,
        createdAt: new Date().toISOString(),
        sender: { id: myId, username: myUsername, email: '' },
      };

      if (activeViewRef.current === DashboardView.DM && activeFriendIdRef.current) {
        tempMsg.receiverId = activeFriendIdRef.current;
        setMessages((prev) => [...prev, tempMsg]);
        realtimeClient.emit(RealtimeEvents.SEND_MESSAGE, {
          receiverId: activeFriendIdRef.current,
          content,
        });
      } else if (activeViewRef.current === DashboardView.SERVER && activeChannelIdRef.current) {
        tempMsg.channelId = activeChannelIdRef.current;
        setMessages((prev) => [...prev, tempMsg]);
        realtimeClient.emit(RealtimeEvents.SEND_CHANNEL_MESSAGE, {
          channelId: activeChannelIdRef.current,
          content,
        });
      }

      setNewMessage('');
    },
    [newMessage, myId, myUsername]
  );

  // Eventos de Chat em Tempo Real
  useEffect(() => {
    const onNewMessage = (msg: ChatMessage) => {
      if (
        activeViewRef.current === DashboardView.DM &&
        activeFriendIdRef.current === msg.senderId
      ) {
        setMessages((prev) => [...prev, msg]);
      } else {
        setUnreadDMs((prev) => ({
          ...prev,
          [msg.senderId]: (prev[msg.senderId] || 0) + 1,
        }));
      }
    };

    const onMessageSent = (msg: ChatMessage) => {
      if (
        activeViewRef.current === DashboardView.DM &&
        activeFriendIdRef.current === msg.receiverId
      ) {
        setMessages((prev) => {
          const filtered = prev.filter(
            (m) => !(m.id.startsWith('temp-') && m.content === msg.content)
          );
          if (filtered.some((m) => m.id === msg.id)) return filtered;
          return [...filtered, msg];
        });
      }
    };

    const onNewChannelMessage = (msg: ChatMessage) => {
      // Evita duplicação da própria mensagem que já foi enviada de forma otimista
      if (msg.senderId === myIdRef.current) return;

      if (
        activeViewRef.current === DashboardView.SERVER &&
        activeChannelIdRef.current === msg.channelId
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      } else if (msg.channelId) {
        setUnreadChannels((prev) => ({
          ...prev,
          [msg.channelId!]: (prev[msg.channelId!] || 0) + 1,
        }));
      }
    };

    const onChannelMessageSent = (msg: ChatMessage) => {
      if (
        activeViewRef.current === DashboardView.SERVER &&
        activeChannelIdRef.current === msg.channelId
      ) {
        setMessages((prev) => {
          const filtered = prev.filter(
            (m) => !(m.id.startsWith('temp-') && m.content === msg.content)
          );
          if (filtered.some((m) => m.id === msg.id)) return filtered;
          return [...filtered, msg];
        });
      }
    };

    realtimeClient.on(RealtimeEvents.NEW_MESSAGE, onNewMessage);
    realtimeClient.on(RealtimeEvents.MESSAGE_SENT, onMessageSent);
    realtimeClient.on(RealtimeEvents.NEW_CHANNEL_MESSAGE, onNewChannelMessage);
    realtimeClient.on(RealtimeEvents.CHANNEL_MESSAGE_SENT, onChannelMessageSent);

    return () => {
      realtimeClient.off(RealtimeEvents.NEW_MESSAGE, onNewMessage);
      realtimeClient.off(RealtimeEvents.MESSAGE_SENT, onMessageSent);
      realtimeClient.off(RealtimeEvents.NEW_CHANNEL_MESSAGE, onNewChannelMessage);
      realtimeClient.off(RealtimeEvents.CHANNEL_MESSAGE_SENT, onChannelMessageSent);
    };
  }, []);

  return {
    messages,
    newMessage,
    setNewMessage,
    unreadDMs,
    unreadChannels,
    sendMessage,
    fetchDMMessages,
    fetchChannelMessages,
  };
}
