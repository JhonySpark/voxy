import React from 'react';
import styles from './StreamQualityBadge.module.css';
import { useStreamQuality, type StreamQualityOptions } from '../../hooks/useStreamQuality';

export interface StreamQualityBadgeProps extends StreamQualityOptions {
  className?: string;
  style?: React.CSSProperties;
}

export const StreamQualityBadge: React.FC<StreamQualityBadgeProps> = ({
  track,
  nativeTelemetry,
  className,
  style,
}) => {
  const { label } = useStreamQuality({ track, nativeTelemetry });

  if (!label) {
    return null;
  }

  return (
    <div
      className={`${styles.badge} ${className || ''}`}
      style={style}
      title={`Transmissão: ${label}`}
    >
      <span className={styles.liveDot} />
      <span>{label}</span>
    </div>
  );
};
