import React, { useState } from 'react';
import styles from './FriendsSidebar.module.css';
import {
  Plus,
  UserPlus,
  Search,
  Check,
  X,
  ChevronDown,
  UserMinus,
  Ban,
  ShieldCheck,
  MoreVertical,
  User,
  MessageSquare,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getMediaUrl } from '../../../../core/utils/media.util';
import { UserStatusEnum } from '../../../../core/enums';
import { StatusDot } from '../../../../components/common/StatusDot/StatusDot';
import { useDialog } from '../../../../components/common/Dialog/DialogContext';

export interface FriendUser {
  id: string;
  username: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bannerColor?: string | null;
  bio?: string | null;
  status?: UserStatusEnum | string | null;
  customStatus?: string | null;
}

interface FriendsSidebarProps {
  friends: FriendUser[];
  pendingRequests: FriendUser[];
  blockedUsers?: FriendUser[];
  activeFriend: FriendUser | null;
  unreadDMs: Record<string, number>;
  userStatuses?: Record<string, { status: UserStatusEnum | string; customStatus?: string }>;
  onSelectFriend: (friend: FriendUser) => void;
  onOpenAddFriendModal: () => void;
  onAcceptRequest: (e: React.MouseEvent, friendId: string) => void;
  onRejectRequest: (e: React.MouseEvent, friendId: string) => void;
  onRemoveFriend?: (friendId: string) => void;
  onBlockUser?: (userId: string) => void;
  onUnblockUser?: (userId: string) => void;
  onViewUserProfile?: (userId: string) => void;
}

export const FriendsSidebar: React.FC<FriendsSidebarProps> = ({
  friends,
  pendingRequests,
  blockedUsers = [],
  activeFriend,
  unreadDMs,
  userStatuses,
  onSelectFriend,
  onOpenAddFriendModal,
  onAcceptRequest,
  onRejectRequest,
  onRemoveFriend,
  onBlockUser,
  onUnblockUser,
  onViewUserProfile,
}) => {
  const { t } = useTranslation();
  const { confirm } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [showBlocked, setShowBlocked] = useState(false);
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
  const [activeMenuFriendId, setActiveMenuFriendId] = useState<string | null>(null);
  const [activeMenuBlockedId, setActiveMenuBlockedId] = useState<string | null>(null);

  const filteredFriends = friends.filter((f) =>
    (f.displayName || f.username).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>{t('sidebar.directMessages')}</span>
        <button
          className={styles.addBtn}
          title={t('friends.addFriend')}
          onClick={onOpenAddFriendModal}
        >
          <Plus size={18} />
        </button>
      </div>

      <button className={styles.inviteButton} onClick={onOpenAddFriendModal}>
        <UserPlus size={16} /> {t('friends.addFriend')}
      </button>

      <div className={styles.searchWrapper}>
        <Search size={14} className={styles.searchIcon} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder={t('friends.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className={styles.list}>
        {pendingRequests.length > 0 && (
          <div>
            <div className={styles.sectionTitleWrapper}>
              <span>{t('friends.pendingRequests').toUpperCase()} ({pendingRequests.length})</span>
              <ChevronDown size={14} />
            </div>
            <div>
              {pendingRequests.map((req) => (
                <div key={req.id} className={styles.friendItem}>
                  <div className={styles.userInfo}>
                    <div className={styles.avatar}>
                      {req.username.charAt(0).toUpperCase()}
                    </div>
                    <span className={styles.userName}>{req.username}</span>
                  </div>
                  <div className={styles.actionButtons}>
                    <button
                      className={`${styles.actionBtn} ${styles.rejectBtn}`}
                      onClick={(e) => onRejectRequest(e, req.id)}
                      title={t('friends.reject')}
                    >
                      <X size={15} />
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.acceptBtn}`}
                      onClick={(e) => onAcceptRequest(e, req.id)}
                      title={t('friends.accept')}
                    >
                      <Check size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className={styles.sectionTitleWrapper}>
            <span>{t('sidebar.directMessages').toUpperCase()}</span>
            <ChevronDown size={14} />
          </div>
          <div>
            {filteredFriends.map((friend) => {
              const avatarMedia = getMediaUrl(friend.avatarUrl);
              const hasFailed = failedAvatars[friend.id];
              const nameToShow = friend.displayName || friend.username;

              return (
                <div
                  key={friend.id}
                  className={`${styles.friendItem} ${
                    activeFriend?.id === friend.id ? styles.active : ''
                  }`}
                  onClick={() => onSelectFriend(friend)}
                >
                  <div className={styles.userInfo}>
                    <div 
                      className={styles.avatarWrapper}
                      onClick={(e) => {
                        if (onViewUserProfile) {
                          e.stopPropagation();
                          onViewUserProfile(friend.id);
                        }
                      }}
                      style={{ cursor: onViewUserProfile ? 'pointer' : 'default' }}
                      title={`Ver perfil de ${nameToShow}`}
                    >
                      {avatarMedia && !hasFailed ? (
                        <img
                          src={avatarMedia}
                          alt={nameToShow}
                          className={styles.avatarImg}
                          onError={() =>
                            setFailedAvatars((prev) => ({ ...prev, [friend.id]: true }))
                          }
                        />
                      ) : (
                        <div className={styles.avatar}>
                          {nameToShow.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <StatusDot
                        status={userStatuses?.[friend.id]?.status || friend.status}
                        activity={userStatuses?.[friend.id]?.customStatus || friend.customStatus}
                        size="sm"
                        className={styles.statusDot}
                      />
                    </div>
                    <div className={styles.friendDetails}>
                      <span className={styles.userName}>{nameToShow}</span>
                      {userStatuses?.[friend.id]?.status === UserStatusEnum.PLAYING && (
                        <span className={styles.activityText}>
                          {userStatuses?.[friend.id]?.customStatus
                            ? `Jogando ${userStatuses[friend.id].customStatus}`
                            : 'Jogando'}
                        </span>
                      )}
                    </div>
                  </div>

                  {unreadDMs[friend.id] > 0 && activeFriend?.id !== friend.id && (
                    <div className={styles.badge}>{unreadDMs[friend.id]}</div>
                  )}

                  {/* Ações Rápidas via Menu de 3 Pontinhos */}
                  <div className={styles.friendHoverActions} style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={`${styles.moreBtn} ${activeMenuFriendId === friend.id ? styles.moreBtnActive : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuFriendId((curr) => (curr === friend.id ? null : friend.id));
                      }}
                      title={t('friends.moreOptions', 'Mais opções')}
                    >
                      <MoreVertical size={14} />
                    </button>

                    {activeMenuFriendId === friend.id && (
                      <>
                        <div
                          style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuFriendId(null);
                          }}
                        />
                        <div
                          className="context-menu-content"
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            marginTop: '4px',
                            zIndex: 9999,
                            minWidth: 190,
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {onViewUserProfile && (
                            <div
                              className="context-menu-item"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                              onClick={() => {
                                setActiveMenuFriendId(null);
                                onViewUserProfile(friend.id);
                              }}
                            >
                              <User size={14} />
                              <span>{t('user.viewProfile', 'Ver Perfil')}</span>
                            </div>
                          )}

                          <div
                            className="context-menu-item"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                            onClick={() => {
                              setActiveMenuFriendId(null);
                              onSelectFriend(friend);
                            }}
                          >
                            <MessageSquare size={14} />
                            <span>{t('friends.openDm', 'Mensagem Direta')}</span>
                          </div>

                          {(onRemoveFriend || onBlockUser) && (
                            <div className="context-menu-separator" />
                          )}

                          {onRemoveFriend && (
                            <div
                              className="context-menu-item"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                              onClick={async () => {
                                setActiveMenuFriendId(null);
                                const ok = await confirm({
                                  title: t('friends.removeFriend', 'Desfazer Amizade'),
                                  message: t('friends.removeFriendConfirm', { name: nameToShow }),
                                  confirmText: t('friends.removeFriend', 'Desfazer Amizade'),
                                  variant: 'danger',
                                });
                                if (ok) {
                                  onRemoveFriend(friend.id);
                                }
                              }}
                            >
                              <UserMinus size={14} />
                              <span>{t('friends.removeFriend', 'Desfazer Amizade')}</span>
                            </div>
                          )}

                          {onBlockUser && (
                            <div
                              className="context-menu-item context-menu-item-danger"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                              onClick={async () => {
                                setActiveMenuFriendId(null);
                                const ok = await confirm({
                                  title: t('friends.blockUser', 'Bloquear Usuário'),
                                  message: t('friends.blockUserConfirm', { name: nameToShow }),
                                  confirmText: t('friends.blockUser', 'Bloquear Usuário'),
                                  variant: 'danger',
                                });
                                if (ok) {
                                  onBlockUser(friend.id);
                                }
                              }}
                            >
                              <Ban size={14} />
                              <span>{t('friends.blockUser', 'Bloquear Usuário')}</span>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Seção de Usuários Bloqueados */}
        {blockedUsers && blockedUsers.length > 0 && (
          <div>
            <div
              className={styles.sectionTitleWrapper}
              onClick={() => setShowBlocked((prev) => !prev)}
              style={{ cursor: 'pointer' }}
            >
              <span>{t('friends.blockedUsers', 'BLOQUEADOS').toUpperCase()} ({blockedUsers.length})</span>
              <ChevronDown
                size={14}
                style={{
                  transform: showBlocked ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 0.2s ease',
                }}
              />
            </div>
            {showBlocked && (
              <div>
                {blockedUsers.map((b) => (
                  <div key={b.id} className={styles.friendItem}>
                    <div className={styles.userInfo}>
                      <div className={styles.avatar}>
                        {b.username.charAt(0).toUpperCase()}
                      </div>
                      <div className={styles.friendDetails}>
                        <span className={styles.userName}>{b.displayName || b.username}</span>
                        <span className={styles.activityText} style={{ color: '#ef4444' }}>
                          {t('friends.tabBlocked', 'Bloqueado')}
                        </span>
                      </div>
                    </div>
                    {/* Ações de Usuário Bloqueado */}
                    <div className={styles.friendHoverActions} style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className={`${styles.moreBtn} ${activeMenuBlockedId === b.id ? styles.moreBtnActive : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuBlockedId((curr) => (curr === b.id ? null : b.id));
                        }}
                        title={t('friends.moreOptions', 'Mais opções')}
                      >
                        <MoreVertical size={14} />
                      </button>

                      {activeMenuBlockedId === b.id && (
                        <>
                          <div
                            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuBlockedId(null);
                            }}
                          />
                          <div
                            className="context-menu-content"
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: '4px',
                              zIndex: 9999,
                              minWidth: 180,
                              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {onViewUserProfile && (
                              <div
                                className="context-menu-item"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                                onClick={() => {
                                  setActiveMenuBlockedId(null);
                                  onViewUserProfile(b.id);
                                }}
                              >
                                <User size={14} />
                                <span>{t('user.viewProfile', 'Ver Perfil')}</span>
                              </div>
                            )}

                            {onUnblockUser && (
                              <div
                                className="context-menu-item"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#10b981' }}
                                onClick={() => {
                                  setActiveMenuBlockedId(null);
                                  onUnblockUser(b.id);
                                }}
                              >
                                <ShieldCheck size={14} />
                                <span>{t('friends.unblockUser', 'Desbloquear')}</span>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
