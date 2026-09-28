import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { httpClient } from '../../../infrastructure/adapters/http/http-client.adapter';
import { realtimeClient } from '../../../infrastructure/adapters/realtime/socket-realtime.adapter';
import { ApiRoutes, RealtimeEvents } from '../../../core/enums';
import { useToast } from '../../../components/common/Toast/ToastContext';
import type { FriendUser } from '../components/FriendsSidebar/FriendsSidebar';

export function useFriends() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFriends = useCallback(async () => {
    try {
      setLoading(true);
      const [friendsRes, requestsRes] = await Promise.all([
        httpClient.get<FriendUser[]>(ApiRoutes.FRIENDS),
        httpClient.get<FriendUser[]>(ApiRoutes.FRIEND_REQUESTS),
      ]);
      setFriends(friendsRes);
      setPendingRequests(requestsRes);
    } catch (err) {
      console.error('Error fetching friends', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAcceptRequest = useCallback(
    async (e: React.MouseEvent, friendId: string) => {
      e.stopPropagation();
      try {
        const res = await httpClient.post<{ targetId: string }>(`${ApiRoutes.FRIEND_ACCEPT}/${friendId}`);
        toast.success(t('friends.accept'));
        await fetchFriends();
        realtimeClient.emit(RealtimeEvents.FRIEND_ACTION, { targetId: res.targetId });
      } catch (err) {
        toast.error(t('friends.userNotFound'));
      }
    },
    [fetchFriends, t, toast]
  );

  const handleRejectRequest = useCallback(
    async (e: React.MouseEvent, friendId: string) => {
      e.stopPropagation();
      try {
        const res = await httpClient.post<{ targetId: string }>(`${ApiRoutes.FRIEND_REJECT}/${friendId}`);
        toast.info(t('friends.reject'));
        await fetchFriends();
        realtimeClient.emit(RealtimeEvents.FRIEND_ACTION, { targetId: res.targetId });
      } catch (err) {
        toast.error(t('friends.userNotFound'));
      }
    },
    [fetchFriends, t, toast]
  );

  useEffect(() => {
    const onFriendAction = () => {
      fetchFriends();
    };

    realtimeClient.on(RealtimeEvents.FRIEND_ACTION, onFriendAction);
    realtimeClient.on(RealtimeEvents.FRIEND_ACTION_UPDATE, onFriendAction);

    return () => {
      realtimeClient.off(RealtimeEvents.FRIEND_ACTION, onFriendAction);
      realtimeClient.off(RealtimeEvents.FRIEND_ACTION_UPDATE, onFriendAction);
    };
  }, [fetchFriends]);

  return {
    friends,
    pendingRequests,
    loading,
    fetchFriends,
    handleAcceptRequest,
    handleRejectRequest,
  };
}
