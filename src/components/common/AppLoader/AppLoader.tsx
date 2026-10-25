import React from 'react';
import loopLogo from '../../../assets/logo-voxy-animado-loop.svg';
import styles from './AppLoader.module.css';

interface AppLoaderProps {
  message?: string;
  size?: number;
}

export const AppLoader: React.FC<AppLoaderProps> = ({ message, size = 120 }) => {
  return (
    <div className={styles.container}>
      <div className={styles.logoWrapper}>
        <img
          src={loopLogo}
          alt="Carregando Voxy..."
          className={styles.animatedLogo}
          style={{ width: size, height: size }}
        />
      </div>
      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
};

export default AppLoader;
