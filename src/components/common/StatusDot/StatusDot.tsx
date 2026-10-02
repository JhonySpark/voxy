import React from 'react';
import styles from './StatusDot.module.css';
import { UserStatusEnum } from '../../../core/enums';
import { useTranslation } from 'react-i18next';
import { Gamepad2 } from 'lucide-react';

export type StatusDotSize = 'sm' | 'md' | 'lg' | 'xl';

export interface StatusDotProps {
  status?: UserStatusEnum | string | null;
  size?: StatusDotSize;
  activity?: string | null;
  className?: string;
  showTitle?: boolean;
  absolute?: boolean;
}

export const getStatusLabel = (
  status?: UserStatusEnum | string | null,
  t?: (key: string, opts?: any) => string,
  activity?: string | null,
): string => {
  const norm = (status || UserStatusEnum.OFFLINE).toUpperCase();
  if (norm === UserStatusEnum.PLAYING) {
    if (activity) {
      return t ? t('status.playingGame', { game: activity }) : `Jogando ${activity}`;
    }
    return t ? t('status.playing') : 'Jogando';
  }
  if (norm === UserStatusEnum.ONLINE) return t ? t('status.online') : 'Disponível';
  if (norm === UserStatusEnum.IDLE) return t ? t('status.idle') : 'Ausente';
  if (norm === UserStatusEnum.DND) return t ? t('status.dnd') : 'Não perturbe';
  return t ? t('status.offlineTitle') : 'Offline';
};

export const StatusDot: React.FC<StatusDotProps> = ({
  status = UserStatusEnum.OFFLINE,
  size = 'sm',
  activity,
  className = '',
  showTitle = true,
  absolute = false,
}) => {
  const { t } = useTranslation();
  const normalizedStatus = (status || UserStatusEnum.OFFLINE).toUpperCase() as UserStatusEnum;

  let statusClass = styles.offline;
  if (normalizedStatus === UserStatusEnum.ONLINE) statusClass = styles.online;
  else if (normalizedStatus === UserStatusEnum.IDLE) statusClass = styles.idle;
  else if (normalizedStatus === UserStatusEnum.DND) statusClass = styles.dnd;
  else if (normalizedStatus === UserStatusEnum.PLAYING) statusClass = styles.playing;

  const sizeClass = styles[`size-${size}`] || styles['size-sm'];
  const title = showTitle ? getStatusLabel(normalizedStatus, t, activity) : undefined;

  return (
    <div
      className={`${styles.statusDot} ${sizeClass} ${statusClass} ${absolute ? styles.absolute : ''} ${className}`}
      title={title}
      aria-label={title}
    >
      {normalizedStatus === UserStatusEnum.DND && <div className={styles.dndBar} />}
      {normalizedStatus === UserStatusEnum.OFFLINE && <div className={styles.offlineInner} />}
      {normalizedStatus === UserStatusEnum.PLAYING && (size === 'lg' || size === 'xl') && (
        <Gamepad2 size={size === 'xl' ? 12 : 9} className={styles.playingIcon} />
      )}
    </div>
  );
};
