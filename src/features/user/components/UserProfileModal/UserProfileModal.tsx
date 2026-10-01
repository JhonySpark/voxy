import React, { useState, useEffect } from 'react';
import styles from './UserProfileModal.module.css';
import { X, MessageSquare, UserPlus, Pencil, Calendar, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { realtimeClient } from '../../../../infrastructure/adapters/realtime/socket-realtime.adapter';
import { RealtimeEvents } from '../../../../core/enums';
import { getMediaUrl } from '../../../../core/utils/media.util';
import type { UserProfileData } from '../UserPopout/UserPopout';

interface UserProfileModalProps {
  isOpen: boolean;
  userId: string | null;
  currentUserId: string;
  isFriend?: boolean;
  initialData?: Partial<UserProfileData> | null;
  onClose: () => void;
  onOpenDirectMessage?: (userId: string) => void;
  onAddFriend?: (username: string) => void;
  onOpenEditProfile?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  userId,
  currentUserId,
  isFriend = false,
  initialData,
  onClose,
  onOpenDirectMessage,
  onAddFriend,
  onOpenEditProfile,
}) => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [friendRequested, setFriendRequested] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) {
      setProfile(null);
      setAvatarError(false);
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
        bio: initialData.bio ?? prev?.bio ?? null,
      }));
    }

    let isMounted = true;
    const fetchUser = async () => {
      try {
        setLoading(true);
        const data = await httpClient.get<UserProfileData>(`/users/${userId}`);
        if (isMounted) {
          setProfile((prev) => ({
            ...prev,
            ...data,
          }));
          setAvatarError(false);
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
    }) => {
      if (data.userId === userId) {
        setProfile((prev) => (prev ? { ...prev, ...data } : null));
        setAvatarError(false);
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
  const bannerColor = profile?.bannerColor || initialData?.bannerColor || '#3b82f6';

  const memberSince = (profile as any)?.createdAt
    ? new Date((profile as any).createdAt).toLocaleDateString(undefined, {
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
            backgroundImage: bannerMedia ? `url(${bannerMedia})` : undefined,
          }}
        >
          <div className={styles.bannerOverlay} />
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            title={t('common.close', 'Fechar')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo do Perfil */}
        <div className={styles.profileBody}>
          <div className={styles.avatarRow}>
            <div className={styles.avatarWrapper}>
              <div className={styles.avatarCircle}>
                {avatarMedia && !avatarError ? (
                  <img
                    src={avatarMedia}
                    alt={displayName}
                    className={styles.avatarImg}
                    onError={() => setAvatarError(true)}
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className={styles.statusBadge}>
                <div className={styles.statusDot} />
              </div>
            </div>

            {/* Badges de Identificação */}
            <div className={styles.badgeRow}>
              {isSelf && <span className={`${styles.badge} ${styles.badgeSelf}`}>Você</span>}
              {!isSelf && isFriend && <span className={`${styles.badge} ${styles.badgeFriend}`}>Amigo</span>}
            </div>
          </div>

          {/* Nome e Tag */}
          <div className={styles.namesBlock}>
            <h2 className={styles.displayName}>{displayName}</h2>
            <span className={styles.username}>@{username}</span>
          </div>

          {/* Seção Sobre Mim / Biografia */}
          <div className={styles.cardSection}>
            <span className={styles.sectionTitle}>{t('user.aboutMe', 'Sobre Mim')}</span>
            {loading && !profile?.bio ? (
              <span className={styles.bioEmpty}>{t('common.loading', 'Carregando...')}</span>
            ) : profile?.bio ? (
              <p className={styles.bioText}>{profile.bio}</p>
            ) : (
              <span className={styles.bioEmpty}>{t('user.noBio', 'Nenhuma biografia informada.')}</span>
            )}

            {memberSince && (
              <div className={styles.metaRow}>
                <Calendar size={14} />
                <span>{t('user.memberSince', 'Membro desde')} {memberSince}</span>
              </div>
            )}
          </div>

          {/* Ações Rápidas */}
          <div className={styles.actionsBar}>
            {isSelf ? (
              <button
                type="button"
                className={styles.primaryActionBtn}
                onClick={() => {
                  onClose();
                  onOpenEditProfile?.();
                }}
              >
                <Pencil size={16} />
                <span>{t('user.editProfile', 'Editar Perfil')}</span>
              </button>
            ) : (
              <>
                {onOpenDirectMessage && (
                  <button
                    type="button"
                    className={styles.primaryActionBtn}
                    onClick={() => {
                      onClose();
                      onOpenDirectMessage(userId);
                    }}
                  >
                    <MessageSquare size={16} />
                    <span>{t('chat.sendMessage', 'Enviar Mensagem')}</span>
                  </button>
                )}

                {!isFriend && onAddFriend && (
                  <button
                    type="button"
                    className={styles.secondaryActionBtn}
                    onClick={() => {
                      onAddFriend(username);
                      setFriendRequested(true);
                    }}
                    disabled={friendRequested}
                  >
                    {friendRequested ? <Check size={16} color="#10b981" /> : <UserPlus size={16} />}
                    <span>{friendRequested ? t('friends.requestSent', 'Solicitado') : t('friends.addFriend', 'Adicionar Amigo')}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
