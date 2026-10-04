import React from 'react';
import styles from './ServerSidebar.module.css';
import heroLogo from '../../../../assets/logo.png';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getMediaUrl } from '../../../../core/utils/media.util';

export interface ChannelItem {
  id: string;
  name: string;
  type: 'TEXT' | 'VOICE';
}

export interface ServerItem {
  id: string;
  name: string;
  ownerId: string;
  inviteCode?: string;
  iconUrl?: string | null;
  is18Plus?: boolean;
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
  const [failedIcons, setFailedIcons] = React.useState<Record<string, boolean>>({});

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
        const iconUrl = getMediaUrl(server.iconUrl);
        const hasFailed = failedIcons[server.id];

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
            {iconUrl && !hasFailed ? (
              <img
                src={iconUrl}
                alt={server.name}
                className={styles.serverImg}
                onError={() =>
                  setFailedIcons((prev) => ({ ...prev, [server.id]: true }))
                }
              />
            ) : (
              initials
            )}
            {unreadCount > 0 && (
              <div className={styles.badge}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
            {server.is18Plus && (
              <div
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  padding: '1px 3px',
                  borderRadius: '3px',
                  border: '2px solid #0f172a',
                  zIndex: 2,
                  lineHeight: 1,
                }}
                title="Servidor +18"
              >
                18+
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
