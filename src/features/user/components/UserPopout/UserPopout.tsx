import React, { useRef, useEffect, useState } from 'react';
import styles from './UserPopout.module.css';
import { Pencil, ChevronRight, User, Check, Gamepad2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getMediaUrl } from '../../../../core/utils/media.util';
import { UserStatusEnum } from '../../../../core/enums';
import { StatusDot, getStatusLabel } from '../../../../components/common/StatusDot/StatusDot';

export interface UserProfileData {
  id: string;
  username: string;
  email?: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bannerColor?: string | null;
  status?: UserStatusEnum | string | null;
  customStatus?: string | null;
}

interface UserPopoutProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfileData;
  onOpenEditProfile: () => void;
  onOpenAccountSettings: () => void;
  currentStatus?: UserStatusEnum | string;
  currentActivity?: string | null;
  onUpdateStatus?: (status: UserStatusEnum, customStatus?: string) => void;
}

export const UserPopout: React.FC<UserPopoutProps> = ({
  isOpen,
  onClose,
  user,
  onOpenEditProfile,
  onOpenAccountSettings,
  currentStatus,
  currentActivity,
  onUpdateStatus,
}) => {
  const { t } = useTranslation();
  const popoutRef = useRef<HTMLDivElement>(null);
  const statusWrapperRef = useRef<HTMLDivElement>(null);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<UserStatusEnum | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null | undefined>(undefined);

  const avatarMedia = getMediaUrl(user.avatarUrl);
  const bannerMedia = getMediaUrl(user.bannerUrl);
  const [avatarError, setAvatarError] = React.useState(false);

  const activeStatus = (selectedStatus || currentStatus || user.status || UserStatusEnum.ONLINE).toUpperCase() as UserStatusEnum;
  const activeActivity = selectedActivity !== undefined ? selectedActivity : (currentActivity !== undefined ? currentActivity : user.customStatus);

  // Reseta o erro caso a URL do avatar mude
  useEffect(() => {
    setAvatarError(false);
  }, [avatarMedia]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoutRef.current && !popoutRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Fecha o submenu de status ao clicar fora dele
  useEffect(() => {
    if (!isStatusMenuOpen) return;

    const handleStatusOutside = (e: MouseEvent) => {
      if (statusWrapperRef.current && !statusWrapperRef.current.contains(e.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleStatusOutside);
    return () => {
      document.removeEventListener('mousedown', handleStatusOutside);
    };
  }, [isStatusMenuOpen]);

  if (!isOpen) return null;

  const displayName = user.displayName || user.username || 'User';
  const handle = `@${user.username || 'user'}`;

  return (
    <>
      <div className={styles.popoutOverlay} onClick={onClose} />
      <div className={styles.popout} ref={popoutRef} onClick={(e) => e.stopPropagation()}>
        {/* Banner Superior com cor sólida/gradiente sempre visível */}
        <div
          className={styles.banner}
          style={{
            backgroundColor: user.bannerColor || '#5865F2',
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
        </div>

        {/* Avatar e Pensamento / Status */}
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
              <StatusDot status={activeStatus} size="xl" activity={activeActivity} />
            </div>
          </div>

        {/* Balão de Pensamento / Bio */}
        <div className={styles.thoughtBubble} onClick={onOpenEditProfile} title="Editar pensamento">
          <span className={styles.thoughtPlus}>+</span>
          <span className={styles.thoughtText}>
            {user.bio ? user.bio : t('user.thoughtPlaceholder', 'Pensamento de chuveiro?')}
          </span>
        </div>
      </div>

      {/* Detalhes do Usuário */}
      <div className={styles.profileDetails}>
        <div className={styles.namesBlock}>
          <h2 className={styles.displayName}>{displayName}</h2>
          <span className={styles.username}>{handle}</span>
        </div>

        {/* Menu de Ações Rápidas */}
        <div className={styles.actionMenu}>
          {/* Botão Editar Perfil */}
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose();
              onOpenEditProfile();
            }}
          >
            <div className={styles.menuItemLeft}>
              <Pencil size={16} className={styles.menuIcon} />
              <span>{t('user.editProfile', 'Editar perfil')}</span>
            </div>
            <span className={styles.newBadge}>{t('common.new', 'NOVO')}</span>
          </button>

          <div className={styles.divider} />

          {/* Seletor Visual de Status com Balão Flutuante à Direita */}
          <div
            ref={statusWrapperRef}
            className={styles.statusTriggerWrapper}
          >
            <button
              type="button"
              className={`${styles.menuItem} ${isStatusMenuOpen ? styles.menuItemActive : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsStatusMenuOpen((prev) => !prev);
              }}
              title="Alterar status de presença"
            >
              <div className={styles.menuItemLeft}>
                <StatusDot status={activeStatus} size="sm" showTitle={false} />
                <span>{getStatusLabel(activeStatus, t, activeActivity)}</span>
              </div>
              <ChevronRight
                size={16}
                className={styles.menuArrow}
                style={{
                  color: isStatusMenuOpen ? '#ffffff' : '#64748b',
                  transform: isStatusMenuOpen ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.15s ease, color 0.15s ease',
                }}
              />
            </button>

            {isStatusMenuOpen && (
              <div
                className={styles.statusFlyoutBalloon}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.flyoutHeader}>{t('status.chooseStatus', 'Mudar Status')}</div>
                {[
                  { key: UserStatusEnum.ONLINE, label: t('status.online') },
                  { key: UserStatusEnum.IDLE, label: t('status.idle') },
                  { key: UserStatusEnum.DND, label: t('status.dnd') },
                  { key: UserStatusEnum.PLAYING, label: t('status.playing') },
                  { key: UserStatusEnum.OFFLINE, label: t('status.offline') },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={`${styles.statusFlyoutItem} ${
                      activeStatus === opt.key ? styles.statusFlyoutItemActive : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      let custom = activeActivity || '';
                      if (opt.key === UserStatusEnum.PLAYING) {
                        const game = window.prompt(t('status.setGamePrompt'), custom || '');
                        if (game === null) return;
                        custom = game.trim();
                      }
                      setSelectedStatus(opt.key);
                      setSelectedActivity(custom);
                      onUpdateStatus?.(opt.key, custom);
                      setIsStatusMenuOpen(false);
                    }}
                  >
                    <div className={styles.statusFlyoutLeft}>
                      <StatusDot status={opt.key} size="sm" showTitle={false} />
                      <span>{opt.label}</span>
                    </div>
                    {activeStatus === opt.key && <Check size={14} color="var(--brand-primary, #34d399)" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.divider} />

          {/* Configurações da Conta */}
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              onClose();
              onOpenAccountSettings();
            }}
          >
            <div className={styles.menuItemLeft}>
              <User size={16} className={styles.menuIcon} />
              <span>{t('user.accountSettings', 'Configurações da conta')}</span>
            </div>
            <ChevronRight size={16} className={styles.menuArrow} />
          </button>
        </div>
      </div>
      </div>
    </>
  );
};
