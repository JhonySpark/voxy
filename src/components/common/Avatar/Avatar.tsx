import React, { useState, useEffect } from 'react';
import styles from './Avatar.module.css';
import { AvatarFrame } from './AvatarFrame';
import { StatusDot, type StatusDotSize } from '../StatusDot/StatusDot';
import { UserStatusEnum } from '../../../core/enums';
import { getMediaUrl, handleMediaError } from '../../../core/utils/media.util';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  displayName?: string | null;
  frameSlug?: string | null;
  status?: UserStatusEnum | string | null;
  activity?: string | null;
  showStatus?: boolean;
  size?: AvatarSize;
  className?: string;
  circleClassName?: string;
  onClick?: (e: React.MouseEvent) => void;
  clickable?: boolean;
  animated?: boolean;
}

// Mapeamento proporcional de tamanhos do Avatar para o StatusDot
const STATUS_DOT_SIZE_MAP: Record<AvatarSize, StatusDotSize> = {
  xs: 'sm',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
  xxl: 'xl',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  displayName,
  frameSlug,
  status,
  activity,
  showStatus = false,
  size = 'md',
  className = '',
  circleClassName = '',
  onClick,
  clickable = false,
  animated,
}) => {
  const [imageError, setImageError] = useState(false);

  // Reset do erro ao trocar de imagem
  useEffect(() => {
    setImageError(false);
  }, [src]);

  const resolvedMedia = getMediaUrl(src);
  const initials = (displayName || alt || 'U')
    .trim()
    .charAt(0)
    .toUpperCase();

  const isClickable = clickable || !!onClick;
  const sizeClass = styles[`size-${size}`] || styles['size-md'];

  return (
    <div
      className={`${styles.avatarRoot} ${sizeClass} ${isClickable ? styles.clickable : ''} ${className}`}
      onClick={onClick}
    >
      {/* Camada 1: Círculo do Avatar com Foto ou Iniciais */}
      <div className={`${styles.avatarCircle} ${circleClassName}`}>
        {resolvedMedia && !imageError ? (
          <img
            src={resolvedMedia}
            alt={alt || displayName || 'Avatar'}
            className={styles.avatarImg}
            onError={(e) => handleMediaError(e, () => setImageError(true))}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className={styles.avatarFallback}>{initials}</span>
        )}
      </div>

      {/* Camada 2: Moldura Cosmética (Sobreposta) */}
      <AvatarFrame frameSlug={frameSlug} animated={animated} />

      {/* Camada 3: Status Dot (Online, Idle, DND, etc.) */}
      {showStatus && status && (
        <div className={styles.statusBadgeWrapper}>
          <StatusDot
            status={status}
            activity={activity}
            size={STATUS_DOT_SIZE_MAP[size] || 'md'}
          />
        </div>
      )}
    </div>
  );
};
