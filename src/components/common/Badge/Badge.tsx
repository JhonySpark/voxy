import React from 'react';
import styles from './Badge.module.css';

export type BadgeVariant = 'brand' | 'neutral' | 'danger' | 'warning' | 'success';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'brand',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  const variantClass = styles[`variant-${variant}`] || styles['variant-brand'];
  const sizeClass = styles[`size-${size}`] || styles['size-md'];

  return (
    <span className={`${styles.badge} ${variantClass} ${sizeClass} ${className}`} {...props}>
      {children}
    </span>
  );
};
