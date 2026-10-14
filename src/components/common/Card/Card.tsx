import React from 'react';
import styles from './Card.module.css';

export type CardVariant = 'glass' | 'solid' | 'elevated' | 'interactive';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'glass',
  padding = 'md',
  children,
  className = '',
  ...props
}) => {
  const variantClass = styles[`variant-${variant}`] || styles['variant-glass'];
  const paddingClass = styles[`padding-${padding}`] || styles['padding-md'];

  return (
    <div className={`${styles.card} ${variantClass} ${paddingClass} ${className}`} {...props}>
      {children}
    </div>
  );
};
