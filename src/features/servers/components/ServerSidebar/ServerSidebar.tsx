import React from 'react';
import styles from './ServerSidebar.module.css';
import heroLogo from '../../../../assets/logo.png';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ChannelItem {
  id: string;
  name: string;
  type: 'TEXT' | 'VOICE';
}

export interface ServerItem {
  id: string;
  name: string;
  ownerId: string;
  channels: ChannelItem[];
}

interface ServerSidebarProps {
  servers: ServerItem[];
  activeView: 'DM' | 'SERVER';
  activeServer: ServerItem | null;
  activeChannel: ChannelItem | null;
  totalUnreadDMs: number;
  unreadChannels: Record<string, number>;
  onSelectDMView: () => void;
  onSelectServer: (server: ServerItem) => void;
  onOpenCreateServerModal: () => void;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({
  servers,
  activeView,
  activeServer,
  activeChannel,
  totalUnreadDMs,
  unreadChannels,
  onSelectDMView,
  onSelectServer,
  onOpenCreateServerModal,
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.sidebar}>
      {/* Home / DM Icon */}
      <div
        className={`${styles.serverIcon} ${styles.home} ${
          activeView === 'DM' ? styles.active : ''
        }`}
        onClick={onSelectDMView}
        title={t('sidebar.directMessages')}
      >
        <img
          src={heroLogo}
          alt="Home"
          style={{ width: '42px', height: '42px', objectFit: 'contain' }}
        />
        {totalUnreadDMs > 0 && (
          <div className={styles.badge}>
            {totalUnreadDMs > 99 ? '99+' : totalUnreadDMs}
          </div>
        )}
      </div>

      <div className={styles.divider} />

      {/* Servers list */}
      {servers.map((server) => {
        const unreadCount =
          server.channels?.reduce((sum, ch) => {
            if (activeView === 'SERVER' && activeChannel?.id === ch.id) return sum;
            return sum + (unreadChannels[ch.id] || 0);
          }, 0) || 0;

        const initials = server.name.substring(0, 2).toUpperCase();

        return (
          <div
            key={server.id}
            className={`${styles.serverIcon} ${
              activeServer?.id === server.id && activeView === 'SERVER'
                ? styles.active
                : ''
            }`}
            onClick={() => onSelectServer(server)}
            title={server.name}
          >
            {initials}
            {unreadCount > 0 && (
              <div className={styles.badge}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </div>
        );
      })}

      {/* Add Server Button */}
      <div
        className={`${styles.serverIcon} ${styles.add}`}
        onClick={onOpenCreateServerModal}
        title={t('server.addServer')}
      >
        <Plus size={22} />
      </div>
    </div>
  );
};
