import React, { useState, useEffect } from 'react';
import styles from './Modals.module.css';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { ApiRoutes, RealtimeEvents } from '../../../../core/enums';
import { realtimeClient } from '../../../../infrastructure/adapters/realtime/socket-realtime.adapter';
import { getMediaUrl } from '../../../../core/utils/media.util';
import { Users, Link2, Search, Check, UserPlus, X, Loader2 } from 'lucide-react';
import type { ServerItem } from '../ServerSidebar/ServerSidebar';
import type { FriendUser } from '../../../friends/components/FriendsSidebar/FriendsSidebar';

interface InviteServerModalProps {
  isOpen: boolean;
  server: ServerItem | null;
  onClose: () => void;
  onMembersUpdated?: () => void;
}

export const InviteServerModal: React.FC<InviteServerModalProps> = ({
  isOpen,
  server,
  onClose,
  onMembersUpdated,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'friends' | 'link'>('friends');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [serverMemberIds, setServerMemberIds] = useState<Set<string>>(new Set());
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !server) return;

    let isMounted = true;
    setIsLoading(true);
    setSelectedFriendIds(new Set());
    setSearchTerm('');

    const loadData = async () => {
      try {
        const [friendsRes, membersRes] = await Promise.all([
          httpClient.get<FriendUser[]>(ApiRoutes.FRIENDS),
          httpClient.get<any[]>(`/servers/${server.id}/members`),
        ]);

        if (!isMounted) return;
        setFriends(friendsRes || []);
        const memberIds = new Set<string>((membersRes || []).map((m: any) => m.userId || m.id));
        setServerMemberIds(memberIds);
      } catch (err) {
        console.error('Error loading invite data', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, server]);

  if (!isOpen || !server) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(server.inviteCode || server.id);
    toast.success(t('server.inviteCopied', 'Código de convite copiado para a área de transferência!'));
  };

  const toggleSelectFriend = (friendId: string) => {
    setSelectedFriendIds((prev) => {
      const next = new Set(prev);
      if (next.has(friendId)) {
        next.delete(friendId);
      } else {
        next.add(friendId);
      }
      return next;
    });
  };

  const handleAddFriends = async (userIdsToAdd: string[]) => {
    if (userIdsToAdd.length === 0) return;

    setIsSubmitting(true);
    try {
      await httpClient.post(`/servers/${server.id}/members`, { userIds: userIdsToAdd });
      toast.success(
        userIdsToAdd.length === 1
          ? t('server.friendAddedSuccess', 'Amigo adicionado ao servidor com sucesso!')
          : t('server.friendsAddedSuccess', `${userIdsToAdd.length} amigos adicionados ao servidor!`)
      );

      // Atualiza os membros locais
      setServerMemberIds((prev) => {
        const next = new Set(prev);
        userIdsToAdd.forEach((id) => next.add(id));
        return next;
      });

      // Limpa os selecionados que foram adicionados
      setSelectedFriendIds((prev) => {
        const next = new Set(prev);
        userIdsToAdd.forEach((id) => next.delete(id));
        return next;
      });

      realtimeClient.emit(RealtimeEvents.SERVER_UPDATED, { serverId: server.id });
      realtimeClient.emit(RealtimeEvents.SERVER_MEMBERS_UPDATED, { serverId: server.id });
      onMembersUpdated?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('server.addFriendError', 'Erro ao adicionar amigo ao servidor.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredFriends = friends.filter((f) => {
    const term = searchTerm.toLowerCase();
    const nameMatch = f.displayName?.toLowerCase().includes(term);
    const userMatch = f.username.toLowerCase().includes(term);
    return nameMatch || userMatch;
  });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalContentWide} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className={styles.title}>
            {t('server.inviteTitle', 'Convidar para')} {server.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.cancelButton}
            style={{ padding: '4px 8px', minWidth: 'auto', border: 'none', background: 'transparent' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabsContainer}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'friends' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('friends')}
          >
            <Users size={16} />
            <span>{t('server.tabAddFriends', 'Amigos')}</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'link' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('link')}
          >
            <Link2 size={16} />
            <span>{t('server.tabInviteLink', 'Link de Convite')}</span>
          </button>
        </div>

        {activeTab === 'friends' ? (
          <div className={styles.inputGroup}>
            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className={styles.input}
                placeholder={t('server.searchFriendsPlaceholder', 'Buscar amigos por nome ou @usuário...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '2.4rem' }}
              />
              <Search
                size={16}
                color="#64748b"
                style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>

            {/* Friends list */}
            {isLoading ? (
              <div className={styles.emptyFriends}>
                <Loader2 size={24} className={styles.spinner} style={{ margin: '0 auto 8px' }} />
                <span>{t('common.loading', 'Carregando amigos...')}</span>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className={styles.emptyFriends}>
                {friends.length === 0
                  ? t('server.noFriendsFound', 'Você ainda não possui amigos adicionados.')
                  : t('server.noFriendsMatch', 'Nenhum amigo encontrado com essa busca.')}
              </div>
            ) : (
              <div className={styles.friendsList}>
                {filteredFriends.map((friend) => {
                  const isMember = serverMemberIds.has(friend.id);
                  const isSelected = selectedFriendIds.has(friend.id);

                  return (
                    <div
                      key={friend.id}
                      className={styles.friendItem}
                      onClick={() => !isMember && toggleSelectFriend(friend.id)}
                      style={{ cursor: isMember ? 'default' : 'pointer' }}
                    >
                      <div className={styles.friendItemLeft}>
                        {!isMember && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectFriend(friend.id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ cursor: 'pointer', accentColor: 'var(--brand-primary, #34d399)' }}
                          />
                        )}
                        <div className={styles.friendAvatar}>
                          {getMediaUrl(friend.avatarUrl) ? (
                            <img
                              src={getMediaUrl(friend.avatarUrl)}
                              alt={friend.displayName || friend.username}
                              className={styles.friendAvatarImg}
                            />
                          ) : (
                            <span>{(friend.displayName || friend.username).charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className={styles.friendNames}>
                          <span className={styles.friendDisplayName}>
                            {friend.displayName || friend.username}
                          </span>
                          <span className={styles.friendUsername}>@{friend.username}</span>
                        </div>
                      </div>

                      {isMember ? (
                        <span className={styles.alreadyMemberBadge}>
                          {t('server.alreadyMember', 'No servidor')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={styles.addFriendBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddFriends([friend.id]);
                          }}
                          disabled={isSubmitting}
                        >
                          <UserPlus size={14} />
                          <span>{t('server.addFriend', 'Adicionar')}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Actions for Multi-selection */}
            {selectedFriendIds.size > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(52, 211, 153, 0.08)',
                  border: '1px solid rgba(52, 211, 153, 0.2)',
                  borderRadius: 8,
                  padding: '0.65rem 1rem',
                  marginTop: '0.5rem',
                }}
              >
                <span style={{ fontSize: '0.85rem', color: '#f1f5f9', fontWeight: 600 }}>
                  {selectedFriendIds.size} {selectedFriendIds.size === 1 ? 'amigo selecionado' : 'amigos selecionados'}
                </span>
                <button
                  type="button"
                  className={styles.submitButton}
                  style={{ minWidth: 'auto', height: 34, padding: '0 1rem' }}
                  onClick={() => handleAddFriends(Array.from(selectedFriendIds))}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <span className={styles.spinner} /> : <Check size={16} />}
                  <span>{t('server.addSelectedFriends', 'Adicionar Selecionados')}</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('server.inviteSubtitle', 'Compartilhe este código ou link com quem você deseja convidar')}</label>
            <input
              type="text"
              className={`${styles.input} ${styles.inviteCodeBox}`}
              readOnly
              value={server.inviteCode || server.id}
              onClick={handleCopy}
              title={t('server.copyInvite', 'Copiar código')}
            />
            <div className={styles.actions} style={{ justifyContent: 'center', marginTop: '0.5rem' }}>
              <button
                type="button"
                className={styles.submitButton}
                style={{ width: '100%' }}
                onClick={handleCopy}
              >
                {t('server.copyInvite', 'Copiar Código de Convite')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
