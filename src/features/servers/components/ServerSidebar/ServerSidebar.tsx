import React, { useState } from 'react';
import styles from './ServerSidebar.module.css';
import heroLogo from '../../../../assets/logo.png';
import { Plus, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { getMediaUrl, handleMediaError } from '../../../../core/utils/media.util';
import { ReportModal } from '../../../moderation/components/ReportModal/ReportModal';
import { ReportTargetTypeEnum } from '../../../../core/enums';

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
  isSuspended?: boolean;
  suspendedReason?: string | null;
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
  const [failedIcons, setFailedIcons] = useState<Record<string, boolean>>({});
  const [serverToReport, setServerToReport] = useState<ServerItem | null>(null);

  return (
    <>
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
            <ContextMenu.Root key={server.id}>
              <ContextMenu.Trigger asChild>
                <div
                  className={`${styles.serverIcon} ${
                    activeServer?.id === server.id && activeView === 'SERVER'
                      ? styles.active
                      : ''
                  } ${server.isSuspended ? styles.suspended : ''}`}
                  onClick={() => onSelectServer(server)}
                  title={
                    server.isSuspended
                      ? `[SUSPENSO] ${server.name} - Motivo: ${server.suspendedReason || 'Violação das regras'}`
                      : server.name
                  }
                  style={server.isSuspended ? { opacity: 0.6, filter: 'grayscale(60%)' } : undefined}
                >
                  {iconUrl && !hasFailed ? (
                    <img
                      src={iconUrl}
                      alt={server.name}
                      className={styles.serverImg}
                      onError={(e) =>
                        handleMediaError(e, () =>
                          setFailedIcons((prev) => ({ ...prev, [server.id]: true }))
                        )
                      }
                    />
                  ) : (
                    initials
                  )}
                  {unreadCount > 0 && !server.isSuspended && (
                    <div className={styles.badge}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                  )}
                  {server.isSuspended && (
                    <div
                      style={{
                        position: 'absolute',
                        top: -2,
                        right: -2,
                        background: '#dc2626',
                        color: '#fff',
                        fontSize: '0.55rem',
                        fontWeight: 900,
                        padding: '1px 3px',
                        borderRadius: '3px',
                        border: '1.5px solid #0f172a',
                        zIndex: 2,
                        lineHeight: 1,
                      }}
                      title="Servidor Suspenso pela Moderação"
                    >
                      SUSP
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
              </ContextMenu.Trigger>
              <ContextMenu.Portal>
                <ContextMenu.Content className="context-menu-content" style={{ zIndex: 9999 }}>
                  <div className="context-menu-label" style={{ fontWeight: 700, color: '#f8fafc' }}>
                    {server.name}
                  </div>
                  <ContextMenu.Separator className="context-menu-separator" />
                  <ContextMenu.Item
                    className="context-menu-item context-menu-item-danger"
                    onClick={() => setServerToReport(server)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <ShieldAlert size={14} color="#f87171" />
                    <span>Denunciar Servidor</span>
                  </ContextMenu.Item>
                </ContextMenu.Content>
              </ContextMenu.Portal>
            </ContextMenu.Root>
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

      {serverToReport && (
        <ReportModal
          isOpen={!!serverToReport}
          onClose={() => setServerToReport(null)}
          targetType={ReportTargetTypeEnum.SERVER}
          targetId={serverToReport.id}
          targetName={serverToReport.name}
        />
      )}
    </>
  );
};
