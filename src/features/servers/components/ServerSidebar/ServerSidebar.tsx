import React, { useState } from 'react';
import styles from './ServerSidebar.module.css';
import heroLogo from '../../../../assets/logo.png';
import { Plus, ShieldAlert, LogOut } from 'lucide-react';
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
  myId?: string;
  onSelectDMView: () => void;
  onSelectServer: (server: ServerItem) => void;
  onOpenCreateServerModal: () => void;
  onLeaveServer?: (server: ServerItem) => void;
  onOpenBetaModal?: () => void;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({
  servers,
  activeView,
  activeServer,
  activeChannel,
  totalUnreadDMs,
  unreadChannels,
  myId,
  onSelectDMView,
  onSelectServer,
  onOpenCreateServerModal,
  onLeaveServer,
  onOpenBetaModal,
}) => {
  const { t } = useTranslation();
  const [failedIcons, setFailedIcons] = useState<Record<string, boolean>>({});
  const [serverToReport, setServerToReport] = useState<ServerItem | null>(null);

  return (
    <>
      <div className={styles.sidebar}>
        {/* Home / DM Icon */}
        <div className={styles.serverItemWrapper}>
          {activeView === 'DM' && <div className={styles.activeNeonBar} />}
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
              className={styles.heroLogoImg}
            />
            {onOpenBetaModal && (
              <span
                className={styles.betaTagBadge}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenBetaModal();
                }}
                title={t('server.betaBadgeTitle')}
              >
                BETA
              </span>
            )}
            {totalUnreadDMs > 0 && (
              <div className={styles.badge}>
                {totalUnreadDMs > 99 ? '99+' : totalUnreadDMs}
              </div>
            )}
          </div>
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

          const isActive = activeServer?.id === server.id && activeView === 'SERVER';

          return (
            <div key={server.id} className={styles.serverItemWrapper}>
              {isActive && <div className={styles.activeNeonBar} />}
              <ContextMenu.Root>
                <ContextMenu.Trigger asChild>
                  <div
                    className={`${styles.serverIcon} ${
                      isActive ? styles.active : ''
                    } ${server.isSuspended ? styles.suspended : ''}`}
                    onClick={() => onSelectServer(server)}
                    title={
                      server.isSuspended
                        ? `[SUSPENSO] ${server.name} - Motivo: ${server.suspendedReason || t('server.suspendedReasonDefault')}`
                        : server.name
                    }
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
                        className={styles.badgeSuspended}
                        title={t('server.suspendedBadge')}
                      >
                        !
                      </div>
                    )}
                    {server.is18Plus && (
                      <div
                        className={styles.badge18Plus}
                        title={t('server.badge18Plus')}
                      >
                        18+
                      </div>
                    )}
                  </div>
                </ContextMenu.Trigger>
                <ContextMenu.Portal>
                  <ContextMenu.Content className={`context-menu-content ${styles.contextMenuContent}`}>
                    <div className={`context-menu-label ${styles.contextMenuLabel}`}>
                      {server.name}
                    </div>
                    <ContextMenu.Separator className="context-menu-separator" />
                    <ContextMenu.Item
                      className={`context-menu-item context-menu-item-danger ${styles.contextMenuItem}`}
                      onClick={() => setServerToReport(server)}
                    >
                      <ShieldAlert size={14} color="#f87171" />
                      <span>{t('server.reportServer')}</span>
                    </ContextMenu.Item>
                    {server.ownerId !== myId && onLeaveServer && (
                      <ContextMenu.Item
                        className={`context-menu-item context-menu-item-danger ${styles.contextMenuItem}`}
                        onClick={() => onLeaveServer(server)}
                      >
                        <LogOut size={14} color="#f87171" />
                        <span>{t('server.leaveServer')}</span>
                      </ContextMenu.Item>
                    )}
                  </ContextMenu.Content>
                </ContextMenu.Portal>
              </ContextMenu.Root>
            </div>
          );
        })}

        {/* Add Server Button */}
        <div className={styles.serverItemWrapper}>
          <div
            className={`${styles.serverIcon} ${styles.add}`}
            onClick={onOpenCreateServerModal}
            title={t('server.addServer')}
          >
            <Plus size={22} />
          </div>
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
