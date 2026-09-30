import React, { useRef, useEffect } from 'react';
import styles from './UserPopout.module.css';
import { Pencil, ChevronRight, User, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getMediaUrl } from '../../../../core/utils/media.util';

export interface UserProfileData {
  id: string;
  username: string;
  email?: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bannerColor?: string | null;
}

interface UserPopoutProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfileData;
  onOpenEditProfile: () => void;
  onOpenAccountSettings: () => void;
}

export const UserPopout: React.FC<UserPopoutProps> = ({
  isOpen,
  onClose,
  user,
  onOpenEditProfile,
  onOpenAccountSettings,
}) => {
  const { t } = useTranslation();
  const popoutRef = useRef<HTMLDivElement>(null);

  const avatarMedia = getMediaUrl(user.avatarUrl);
  const bannerMedia = getMediaUrl(user.bannerUrl);
  const [avatarError, setAvatarError] = React.useState(false);

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
            backgroundImage: bannerMedia ? `url(${bannerMedia})` : undefined,
          }}
        />

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
            <div className={styles.statusBadge} title="Online">
              <div className={styles.statusDot} />
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

          {/* Seletor Visual de Status */}
          <div className={styles.menuItemStatic}>
            <div className={styles.menuItemLeft}>
              <Circle size={14} className={styles.onlineStatusIcon} />
              <span>{t('user.statusOnline', 'Online')}</span>
            </div>
            <ChevronRight size={16} className={styles.menuArrow} />
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
