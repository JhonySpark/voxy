import React, { useState } from 'react';
import styles from './FriendsSidebar.module.css';
import { Plus, UserPlus, Search, Check, X, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getMediaUrl } from '../../../../core/utils/media.util';

export interface FriendUser {
  id: string;
  username: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bannerColor?: string | null;
  bio?: string | null;
}

interface FriendsSidebarProps {
  friends: FriendUser[];
  pendingRequests: FriendUser[];
  activeFriend: FriendUser | null;
  unreadDMs: Record<string, number>;
  onSelectFriend: (friend: FriendUser) => void;
  onOpenAddFriendModal: () => void;
  onAcceptRequest: (e: React.MouseEvent, friendId: string) => void;
  onRejectRequest: (e: React.MouseEvent, friendId: string) => void;
  onViewUserProfile?: (userId: string) => void;
}

export const FriendsSidebar: React.FC<FriendsSidebarProps> = ({
  friends,
  pendingRequests,
  activeFriend,
  unreadDMs,
  onSelectFriend,
  onOpenAddFriendModal,
  onAcceptRequest,
  onRejectRequest,
  onViewUserProfile,
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});

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
                    </div>
                    <span className={styles.userName}>{nameToShow}</span>
                  </div>
                  {unreadDMs[friend.id] > 0 && activeFriend?.id !== friend.id && (
                    <div className={styles.badge}>{unreadDMs[friend.id]}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
