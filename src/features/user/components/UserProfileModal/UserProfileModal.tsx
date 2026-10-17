import React, { useState, useEffect } from 'react';
import styles from './UserProfileModal.module.css';
import { X, MessageSquare, UserPlus, Pencil, Calendar, Check, Ban, UserMinus, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { realtimeClient } from '../../../../infrastructure/adapters/realtime/socket-realtime.adapter';
import { RealtimeEvents, UserStatusEnum, ReportTargetTypeEnum } from '../../../../core/enums';
import { getMediaUrl } from '../../../../core/utils/media.util';
import type { UserProfileData } from '../UserPopout/UserPopout';
import { getStatusLabel } from '../../../../components/common/StatusDot/StatusDot';
import { Avatar } from '../../../../components/common/Avatar';
import { useDialog } from '../../../../components/common/Dialog/DialogContext';
import { ReportModal } from '../../../moderation/components/ReportModal/ReportModal';

interface UserProfileModalProps {
  isOpen: boolean;
  userId: string | null;
  currentUserId: string;
  isFriend?: boolean;
  initialData?: Partial<UserProfileData> | null;
  userStatus?: UserStatusEnum | string;
  userActivity?: string | null;
  onClose: () => void;
  onOpenDirectMessage?: (userId: string) => void;
  onAddFriend?: (username: string) => void;
  onRemoveFriend?: (userId: string) => Promise<boolean | void> | void;
  onBlockUser?: (userId: string) => Promise<boolean | void> | void;
  onUnblockUser?: (userId: string) => Promise<boolean | void> | void;
  onOpenEditProfile?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  userId,
  currentUserId,
  isFriend = false,
  initialData,
  userStatus,
  userActivity,
  onClose,
  onOpenDirectMessage,
  onAddFriend,
  onRemoveFriend,
  onBlockUser,
  onUnblockUser,
  onOpenEditProfile,
}) => {
  const { t } = useTranslation();
  const { confirm } = useDialog();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [relationship, setRelationship] = useState<{
    isFriend: boolean;
    isPending: boolean;
    isBlocked: boolean;
    hasBlocked: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [friendRequested, setFriendRequested] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) {
      setProfile(null);
      setFriendRequested(false);
      return;
    }

    if (initialData) {
      setProfile((prev) => ({
        ...prev,
        id: userId,
        username: initialData.username || prev?.username || '',
        displayName: initialData.displayName ?? prev?.displayName ?? null,
        avatarUrl: initialData.avatarUrl ?? prev?.avatarUrl ?? null,
        bannerUrl: initialData.bannerUrl ?? prev?.bannerUrl ?? null,
        bannerColor: initialData.bannerColor ?? prev?.bannerColor ?? null,
        equippedFrameSlug: initialData.equippedFrameSlug ?? prev?.equippedFrameSlug ?? null,
        bio: initialData.bio ?? prev?.bio ?? null,
        createdAt: (initialData as any).createdAt ?? (prev as any)?.createdAt ?? null,
      } as any));
    }

    let isMounted = true;
    const fetchUser = async () => {
      try {
        setLoading(true);
        const [userData, relData] = await Promise.all([
          httpClient.get<UserProfileData>(`/users/${userId}`),
          !isSelf ? httpClient.get<any>(`/friends/status/${userId}`).catch(() => null) : Promise.resolve(null),
        ]);
        if (isMounted) {
          setProfile((prev) => ({
            ...prev,
            ...userData,
          }));
          if (relData) {
            setRelationship(relData);
          }
        }
      } catch (err: any) {
        if (err?.response?.status === 404) {
          console.warn(`[UserProfileModal] Perfil completo ainda não disponível para ${userId}.`);
        } else {
          console.error('Erro ao carregar perfil do usuário:', err);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchUser();

    const onProfileUpdate = (data: {
      userId: string;
      displayName?: string | null;
      avatarUrl?: string | null;
      bannerUrl?: string | null;
      bannerColor?: string | null;
      bio?: string | null;
      equippedFrameSlug?: string | null;
    }) => {
      if (data.userId === userId) {
        setProfile((prev) => (prev ? { ...prev, ...data } : null));
      }
    };

    realtimeClient.on(RealtimeEvents.USER_PROFILE_UPDATED, onProfileUpdate);

    return () => {
      isMounted = false;
      realtimeClient.off(RealtimeEvents.USER_PROFILE_UPDATED, onProfileUpdate);
    };
  }, [isOpen, userId, initialData]);

  // Tecla ESC para fechar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !userId) return null;

  const isSelf = userId === currentUserId;
  const displayName = profile?.displayName || profile?.username || initialData?.displayName || initialData?.username || 'Usuário';
  const username = profile?.username || initialData?.username || 'usuario';
  const avatarMedia = getMediaUrl(profile?.avatarUrl || initialData?.avatarUrl);
  const bannerMedia = getMediaUrl(profile?.bannerUrl || initialData?.bannerUrl);
  const bannerColor = profile?.bannerColor || initialData?.bannerColor || '#182030';

  const rawCreatedAt = (profile as any)?.createdAt || (initialData as any)?.createdAt;
  const memberSince = rawCreatedAt
    ? new Date(rawCreatedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Banner Superior com botão fechar */}
        <div
          className={styles.banner}
          style={{
            backgroundColor: bannerColor,
          }}
        >
          {bannerMedia && (
            <img
              src={bannerMedia}
              alt="Banner"
              className={styles.bannerImg}
              loading="eager"
              decoding="async"
            />
          )}
          <div className={styles.bannerOverlay} />
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            title={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo do Perfil */}
        <div className={styles.profileBody}>
          {/* Badges de Identificação (Sempre posicionados abaixo do banner no canto direito) */}
          {(isSelf || (!isSelf && (isFriend || relationship?.isFriend))) && (
            <div className={styles.badgeRow}>
              {isSelf && <span className={`${styles.badge} ${styles.badgeSelf}`}>{t('user.badgeYou')}</span>}
              {!isSelf && (isFriend || relationship?.isFriend) && (
                <span className={`${styles.badge} ${styles.badgeFriend}`}>
                  {t('user.badgeFriend')}
                </span>
              )}
            </div>
          )}

          <div className={styles.avatarRow}>
            <div className={styles.avatarWrapper}>
              <Avatar
                src={avatarMedia}
                displayName={displayName}
                frameSlug={profile?.equippedFrameSlug || initialData?.equippedFrameSlug}
                status={userStatus || profile?.status}
                activity={userActivity || profile?.customStatus}
                showStatus
                size="xl"
                animated={true}
                circleClassName={styles.avatarCircle}
              />
            </div>
          </div>

          {/* Nome e Tag */}
          <div className={styles.namesBlock}>
            <h2 className={styles.displayName}>{displayName}</h2>
            <div className={styles.userStatusSubRow}>
              <span className={styles.username}>@{username}</span>
              <span className={styles.statusDivider}>•</span>
              <span className={styles.statusLabelText}>
                {getStatusLabel(userStatus || profile?.status, t, userActivity || profile?.customStatus)}
              </span>
            </div>
          </div>

          {/* Seção Sobre Mim / Biografia */}
          <div className={styles.cardSection}>
            <span className={styles.sectionTitle}>{t('user.aboutMe')}</span>
            {loading && !profile?.bio ? (
              <span className={styles.bioEmpty}>{t('common.loading')}</span>
            ) : profile?.bio ? (
              <p className={styles.bioText}>{profile.bio}</p>
            ) : (
              <span className={styles.bioEmpty}>{t('user.noBio')}</span>
            )}

            <div className={styles.metaRow}>
              <Calendar size={14} />
              <span>
                {memberSince
                  ? `${t('user.memberSince')} ${memberSince}`
                  : loading
                  ? `${t('user.memberSince')} ...`
                  : `${t('user.memberSince')} ${t('user.memberRecently')}`}
              </span>
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className={styles.actionsBar}>
            {isSelf ? (
              <button
                type="button"
                className={styles.selfEditBtn}
                onClick={() => {
                  onClose();
                  onOpenEditProfile?.();
                }}
              >
                <Pencil size={18} />
                <span>{t('user.editProfile')}</span>
              </button>
            ) : relationship?.hasBlocked ? (
              <div className={styles.moderationActionsRow}>
                <button
                  type="button"
                  className={styles.secondaryActionBtn}
                  onClick={async () => {
                    if (onUnblockUser && userId) {
                      await onUnblockUser(userId);
                      setRelationship((prev) => prev ? { ...prev, isBlocked: false, hasBlocked: false } : null);
                    }
                  }}
                >
                  <ShieldCheck size={18} color="#10b981" />
                  <span>{t('friends.unblockUser')}</span>
                </button>
                <button
                  type="button"
                  className={styles.reportActionBtn}
                  onClick={() => setIsReportOpen(true)}
                  title={t('moderation.reportUser')}
                >
                  <ShieldAlert size={18} />
                  <span>{t('moderation.reportUser')}</span>
                </button>
              </div>
            ) : (
              <>
                <div className={styles.socialActionsRow}>
                  {onOpenDirectMessage && !relationship?.isBlocked && (
                    <button
                      type="button"
                      className={styles.primaryActionBtn}
                      onClick={() => {
                        onClose();
                        onOpenDirectMessage(userId);
                      }}
                    >
                      <MessageSquare size={18} />
                      <span>{t('chat.sendMessage')}</span>
                    </button>
                  )}

                  {(isFriend || relationship?.isFriend) ? (
                    onRemoveFriend && (
                      <button
                        type="button"
                        className={styles.secondaryActionBtn}
                        onClick={async () => {
                          const ok = await confirm({
                            title: t('friends.removeFriend'),
                            message: t('friends.removeFriendConfirm', { name: displayName }),
                            confirmText: t('friends.removeFriend'),
                            variant: 'danger',
                          });
                          if (ok) {
                            await onRemoveFriend(userId);
                            setRelationship((prev) => prev ? { ...prev, isFriend: false } : null);
                          }
                        }}
                        title={t('friends.removeFriend')}
                      >
                        <UserMinus size={18} />
                        <span>{t('friends.removeFriend')}</span>
                      </button>
                    )
                  ) : (
                    onAddFriend && (
                      <button
                        type="button"
                        className={styles.secondaryActionBtn}
                        onClick={() => {
                          onAddFriend(username);
                          setFriendRequested(true);
                        }}
                        disabled={friendRequested || relationship?.isPending}
                      >
                        {friendRequested || relationship?.isPending ? (
                          <Check size={18} color="#10b981" />
                        ) : (
                          <UserPlus size={18} />
                        )}
                        <span>
                          {friendRequested || relationship?.isPending
                            ? t('friends.requestSentShort')
                            : t('friends.addFriend')}
                        </span>
                      </button>
                    )
                  )}
                </div>

                <div className={styles.moderationActionsRow}>
                  {onBlockUser && (
                    <button
                      type="button"
                      className={styles.blockActionBtn}
                      onClick={async () => {
                        const ok = await confirm({
                          title: t('friends.blockUser'),
                          message: t('friends.blockUserConfirm', { name: displayName }),
                          confirmText: t('friends.blockUser'),
                          variant: 'danger',
                        });
                        if (ok) {
                          await onBlockUser(userId);
                          setRelationship((prev) => prev ? { ...prev, isFriend: false, isBlocked: true, hasBlocked: true } : null);
                        }
                      }}
                      title={t('friends.blockUser')}
                    >
                      <Ban size={18} />
                      <span>{t('friends.blockUser')}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className={styles.reportActionBtn}
                    onClick={() => setIsReportOpen(true)}
                    title={t('moderation.reportUser')}
                  >
                    <ShieldAlert size={18} />
                    <span>{t('moderation.reportUser')}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetType={ReportTargetTypeEnum.USER}
        targetId={userId}
        targetName={username}
      />
    </div>
  );
};
