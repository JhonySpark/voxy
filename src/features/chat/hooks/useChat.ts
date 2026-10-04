import { useState, useCallback, useEffect, useRef } from 'react';
import { httpClient } from '../../../infrastructure/adapters/http/http-client.adapter';
import { realtimeClient } from '../../../infrastructure/adapters/realtime/socket-realtime.adapter';
import { ApiRoutes, RealtimeEvents, DashboardView } from '../../../core/enums';
import type { ChatMessage } from '../components/ChatArea/ChatArea';

interface UseChatProps {
  myId: string;
  myUsername: string;
  myDisplayName?: string | null;
  myAvatarUrl?: string | null;
  activeView: DashboardView;
  activeFriendId: string | null;
  activeChannelId: string | null;
}

export function useChat({
  myId,
  myUsername,
  myDisplayName,
  myAvatarUrl,
  activeView,
  activeFriendId,
  activeChannelId,
}: UseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadDMs, setUnreadDMs] = useState<Record<string, number>>({});
  const [unreadChannels, setUnreadChannels] = useState<Record<string, number>>({});
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);

  // Cache em memória: chave ("dm_{friendId}" ou "channel_{channelId}") -> ChatMessage[]
  const messageCacheRef = useRef<Map<string, ChatMessage[]>>(new Map());

  const activeViewRef = useRef(activeView);
  const activeFriendIdRef = useRef(activeFriendId);
  const activeChannelIdRef = useRef(activeChannelId);
  const myIdRef = useRef(myId);
  const myDisplayNameRef = useRef(myDisplayName);
  const myAvatarUrlRef = useRef(myAvatarUrl);

  useEffect(() => {
    myDisplayNameRef.current = myDisplayName;
  }, [myDisplayName]);

  useEffect(() => {
    myAvatarUrlRef.current = myAvatarUrl;
  }, [myAvatarUrl]);

  // Rascunho de texto por conversa
  const currentChatKey =
    activeView === DashboardView.DM
      ? `dm_${activeFriendId || ''}`
      : `channel_${activeChannelId || ''}`;
  const draftsRef = useRef<Map<string, string>>(new Map());
  const prevChatKeyRef = useRef<string>(currentChatKey);

  useEffect(() => {
    if (prevChatKeyRef.current !== currentChatKey) {
      draftsRef.current.set(prevChatKeyRef.current, newMessage);
      setNewMessage(draftsRef.current.get(currentChatKey) || '');
      prevChatKeyRef.current = currentChatKey;
    }
  }, [currentChatKey, newMessage]);

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

  const areMessagesEqual = (a?: ChatMessage[], b?: ChatMessage[]) => {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    if (a.length === 0) return true;
    return a[0].id === b[0].id && a[a.length - 1].id === b[b.length - 1].id;
  };

  const mergeWithPendingMessages = (serverMessages: ChatMessage[], cached?: ChatMessage[]) => {
    const pendingMessages = (cached || []).filter((message) => message.id.startsWith('temp-'));
    return [...serverMessages, ...pendingMessages.filter((pending) =>
      !serverMessages.some((message) => message.content === pending.content && message.senderId === pending.senderId)
    )];
  };

  const fetchDMMessages = useCallback(async (friendId: string) => {
    const cacheKey = `dm_${friendId}`;
    const cached = messageCacheRef.current.get(cacheKey);

    if (cached) {
      // 0ms instant switch com dados em cache
      setMessages(cached);
      setIsLoadingMessages(false);
    } else {
      // Limpa imediatamente as mensagens da conversa anterior para não ficarem congeladas na tela
      setMessages([]);
      setIsLoadingMessages(true);
    }

    try {
      const res = await httpClient.get<ChatMessage[]>(`${ApiRoutes.CHAT}/${friendId}`);
      const mergedMessages = mergeWithPendingMessages(res, cached);
      const isIdentical = areMessagesEqual(cached, mergedMessages);
      messageCacheRef.current.set(cacheKey, mergedMessages);

      // Só atualiza a tela se o usuário ainda estiver na conversa E se houver novas mensagens
      if (
        activeViewRef.current === DashboardView.DM &&
        activeFriendIdRef.current === friendId
      ) {
        if (!isIdentical) {
          setMessages(mergedMessages);
        }
        setIsLoadingMessages(false);
      }
    } catch (err) {
      console.error('Error fetching DM messages', err);
      if (
        activeViewRef.current === DashboardView.DM &&
        activeFriendIdRef.current === friendId
      ) {
        setIsLoadingMessages(false);
      }
    }
  }, []);

  const fetchChannelMessages = useCallback(async (channelId: string) => {
    const cacheKey = `channel_${channelId}`;
    const cached = messageCacheRef.current.get(cacheKey);

    if (cached) {
      // 0ms instant switch com dados em cache
      setMessages(cached);
      setIsLoadingMessages(false);
    } else {
      // Limpa imediatamente as mensagens do canal anterior para não ficarem congeladas na tela
      setMessages([]);
      setIsLoadingMessages(true);
    }

    try {
      const res = await httpClient.get<ChatMessage[]>(`${ApiRoutes.CHANNELS}/${channelId}/messages`);
      const mergedMessages = mergeWithPendingMessages(res, cached);
      const isIdentical = areMessagesEqual(cached, mergedMessages);
      messageCacheRef.current.set(cacheKey, mergedMessages);

      // Só atualiza a tela se o usuário ainda estiver neste canal E se houver novas mensagens
      if (
        activeViewRef.current === DashboardView.SERVER &&
        activeChannelIdRef.current === channelId
      ) {
        if (!isIdentical) {
          setMessages(mergedMessages);
        }
        setIsLoadingMessages(false);
      }
    } catch (err) {
      console.error('Error fetching channel messages', err);
      if (
        activeViewRef.current === DashboardView.SERVER &&
        activeChannelIdRef.current === channelId
      ) {
        setIsLoadingMessages(false);
      }
    }
  }, []);

  const sendMessage = useCallback(
    (e?: React.FormEvent, options?: { replyToId?: string; replyTo?: ChatMessage | null }) => {
      if (e) e.preventDefault();
      const content = newMessage.trim();
      if (!content) return;

      const tempMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        content,
        senderId: myId,
        replyToId: options?.replyToId || null,
        replyTo: options?.replyTo || null,
        createdAt: new Date().toISOString(),
        sender: {
          id: myId,
          username: myUsername,
          displayName: myDisplayNameRef.current || null,
          avatarUrl: myAvatarUrlRef.current || null,
          email: '',
        },
      };

      if (activeViewRef.current === DashboardView.DM && activeFriendIdRef.current) {
        tempMsg.receiverId = activeFriendIdRef.current;
        setMessages((prev) => [...prev, tempMsg]);

        // Atualiza cache local
        const cacheKey = `dm_${activeFriendIdRef.current}`;
        const currentList = messageCacheRef.current.get(cacheKey) || [];
        messageCacheRef.current.set(cacheKey, [...currentList, tempMsg]);

        realtimeClient.emit(RealtimeEvents.SEND_MESSAGE, {
          receiverId: activeFriendIdRef.current,
          content,
          replyToId: options?.replyToId,
        });
      } else if (activeViewRef.current === DashboardView.SERVER && activeChannelIdRef.current) {
        tempMsg.channelId = activeChannelIdRef.current;
        setMessages((prev) => [...prev, tempMsg]);

        // Atualiza cache local
        const cacheKey = `channel_${activeChannelIdRef.current}`;
        const currentList = messageCacheRef.current.get(cacheKey) || [];
        messageCacheRef.current.set(cacheKey, [...currentList, tempMsg]);

        realtimeClient.emit(RealtimeEvents.SEND_CHANNEL_MESSAGE, {
          channelId: activeChannelIdRef.current,
          content,
          replyToId: options?.replyToId,
        });
      }

      setNewMessage('');
    },
    [newMessage, myId, myUsername]
  );

  const sendAttachmentMessage = useCallback(
    (attachmentId: string, customContent = '', replyToId?: string) => {
      if (activeViewRef.current === DashboardView.DM && activeFriendIdRef.current) {
        realtimeClient.emit(RealtimeEvents.SEND_MESSAGE, {
          receiverId: activeFriendIdRef.current,
          content: customContent,
          attachmentId,
          replyToId,
        });
      } else if (activeViewRef.current === DashboardView.SERVER && activeChannelIdRef.current) {
        realtimeClient.emit(RealtimeEvents.SEND_CHANNEL_MESSAGE, {
          channelId: activeChannelIdRef.current,
          content: customContent,
          attachmentId,
          replyToId,
        });
      }
    },
    [],
  );

  // Eventos de Chat em Tempo Real
  useEffect(() => {
    const onNewMessage = (msg: ChatMessage) => {
      // Atualiza o cache da DM desse remetente se existir
      const cacheKey = `dm_${msg.senderId}`;
      const cached = messageCacheRef.current.get(cacheKey);
      if (cached && !cached.some((m) => m.id === msg.id)) {
        messageCacheRef.current.set(cacheKey, [...cached, msg]);
      }

      if (
        activeViewRef.current === DashboardView.DM &&
        activeFriendIdRef.current === msg.senderId
      ) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      } else {
        setUnreadDMs((prev) => ({
          ...prev,
          [msg.senderId]: (prev[msg.senderId] || 0) + 1,
        }));
      }
    };

    const onMessageSent = (msg: ChatMessage) => {
      // Atualiza o cache da DM do destinatário
      if (msg.receiverId) {
        const cacheKey = `dm_${msg.receiverId}`;
        const cached = messageCacheRef.current.get(cacheKey);
        if (cached) {
          const filtered = cached.filter(
            (m) => !(m.id.startsWith('temp-') && m.content === msg.content)
          );
          if (!filtered.some((m) => m.id === msg.id)) {
            messageCacheRef.current.set(cacheKey, [...filtered, msg]);
          }
        }
      }

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
      // Se for a própria mensagem enviada, reconcilia o tempMsg no estado e no cache
      if (msg.senderId === myIdRef.current) {
        if (msg.channelId) {
          const cacheKey = `channel_${msg.channelId}`;
          const cached = messageCacheRef.current.get(cacheKey);
          if (cached) {
            const filtered = cached.filter(
              (m) => !(m.id.startsWith('temp-') && m.content === msg.content)
            );
            if (!filtered.some((m) => m.id === msg.id)) {
              messageCacheRef.current.set(cacheKey, [...filtered, msg]);
            }
          }
        }

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
        return;
      }

      if (msg.channelId) {
        const cacheKey = `channel_${msg.channelId}`;
        const cached = messageCacheRef.current.get(cacheKey);
        if (cached && !cached.some((m) => m.id === msg.id)) {
          messageCacheRef.current.set(cacheKey, [...cached, msg]);
        }
      }

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
      if (msg.channelId) {
        const cacheKey = `channel_${msg.channelId}`;
        const cached = messageCacheRef.current.get(cacheKey);
        if (cached) {
          const filtered = cached.filter(
            (m) => !(m.id.startsWith('temp-') && m.content === msg.content)
          );
          if (!filtered.some((m) => m.id === msg.id)) {
            messageCacheRef.current.set(cacheKey, [...filtered, msg]);
          }
        }
      }

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

    const onChannelMessageDeleted = (data: { channelId: string; messageId: string }) => {
      const cacheKey = `channel_${data.channelId}`;
      const cached = messageCacheRef.current.get(cacheKey);
      if (cached) {
        messageCacheRef.current.set(
          cacheKey,
          cached.filter((m) => m.id !== data.messageId),
        );
      }
      if (
        activeViewRef.current === DashboardView.SERVER &&
        activeChannelIdRef.current === data.channelId
      ) {
        setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      }
    };

    realtimeClient.on(RealtimeEvents.NEW_MESSAGE, onNewMessage);
    realtimeClient.on(RealtimeEvents.MESSAGE_SENT, onMessageSent);
    realtimeClient.on(RealtimeEvents.NEW_CHANNEL_MESSAGE, onNewChannelMessage);
    realtimeClient.on(RealtimeEvents.CHANNEL_MESSAGE_SENT, onChannelMessageSent);
    realtimeClient.on(RealtimeEvents.CHANNEL_MESSAGE_DELETED, onChannelMessageDeleted);

    return () => {
      realtimeClient.off(RealtimeEvents.NEW_MESSAGE, onNewMessage);
      realtimeClient.off(RealtimeEvents.MESSAGE_SENT, onMessageSent);
      realtimeClient.off(RealtimeEvents.NEW_CHANNEL_MESSAGE, onNewChannelMessage);
      realtimeClient.off(RealtimeEvents.CHANNEL_MESSAGE_SENT, onChannelMessageSent);
      realtimeClient.off(RealtimeEvents.CHANNEL_MESSAGE_DELETED, onChannelMessageDeleted);
    };
  }, []);

  const deleteMessage = useCallback(
    async (channelId: string, messageId: string) => {
      await httpClient.delete(`/channels/${channelId}/messages/${messageId}`);
      realtimeClient.emit(RealtimeEvents.CHANNEL_MESSAGE_DELETED, { channelId, messageId });
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      const cacheKey = `channel_${channelId}`;
      const cached = messageCacheRef.current.get(cacheKey);
      if (cached) {
        messageCacheRef.current.set(
          cacheKey,
          cached.filter((m) => m.id !== messageId),
        );
      }
    },
    [],
  );

  return {
    messages,
    newMessage,
    setNewMessage,
    unreadDMs,
    unreadChannels,
    isLoadingMessages,
    sendMessage,
    sendAttachmentMessage,
    deleteMessage,
    fetchDMMessages,
    fetchChannelMessages,
  };
}
