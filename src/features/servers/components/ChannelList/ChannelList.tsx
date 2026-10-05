import React, { useState, useEffect } from 'react';
import styles from './ChannelList.module.css';
import { Hash, Volume2, VolumeX, Plus, UserPlus, Search, ChevronDown, Mic, MicOff, Settings, Pencil, Trash2, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import type { ChannelItem, ServerItem } from '../ServerSidebar/ServerSidebar';
import { ChannelTypeEnum, UserStatusEnum, ReportTargetTypeEnum } from '../../../../core/enums';
import { getMediaUrl } from '../../../../core/utils/media.util';
import type { VoiceParticipantState } from '../../hooks/useServers';
import { StatusDot } from '../../../../components/common/StatusDot/StatusDot';
import { ReportModal } from '../../../moderation/components/ReportModal/ReportModal';
import { useClickOutside } from '../../../../hooks/useClickOutside';

export interface ServerPermissions {
  role?: string;
  isAdmin?: boolean;
  isModerator?: boolean;
  isOwner?: boolean;
  canInvite?: boolean;
  canDeleteMessages?: boolean;
  canKickMembers?: boolean;
  canBanMembers?: boolean;
  canMuteMembers?: boolean;
  canManageChannels?: boolean;
  canManageServer?: boolean;
}

interface ChannelListProps {
  server: ServerItem;
  myId: string;
  permissions?: ServerPermissions | null;
  activeChannel: ChannelItem | null;
  serverVoiceStates: Record<string, VoiceParticipantState[]>;
  channelStartTimes?: Record<string, number>;
  userVolumes?: Record<string, number>;
  onVolumeChange?: (userId: string, volume: number) => void;
  unreadChannels: Record<string, number>;
  activeSpeakers: Set<string>;
  userStatuses?: Record<string, { status: UserStatusEnum | string; customStatus?: string | null }>;
  onSelectChannel: (channel: ChannelItem) => void;
  onConnectVoice: (channel: ChannelItem) => void;
  onOpenCreateChannelModal: () => void;
  onOpenInviteModal: () => void;
  onOpenServerSettings?: () => void;
  onViewUserProfile?: (userId: string) => void;
  onDeleteChannel?: (channel: ChannelItem) => void;
  onRenameChannel?: (channel: ChannelItem) => void;
}

interface ChannelActionsProps {
  channel: ChannelItem;
  isOwner: boolean;
  onRename?: (channel: ChannelItem) => void;
  onDelete?: (channel: ChannelItem) => void;
  children: React.ReactElement;
}

const ChannelActions: React.FC<ChannelActionsProps> = ({
  channel,
  isOwner,
  onRename,
  onDelete,
  children,
}) => {
  if (!isOwner) return children;

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="context-menu-content" style={{ zIndex: 9999 }}>
          <ContextMenu.Item className="context-menu-item" onClick={() => onRename?.(channel)}>
            <Pencil size={14} /> Editar nome
          </ContextMenu.Item>
          <ContextMenu.Item
            className="context-menu-item"
            style={{ color: '#f87171' }}
            onClick={() => onDelete?.(channel)}
          >
            <Trash2 size={14} /> Excluir canal
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
};

const LiveTimer: React.FC<{ startedAt?: number }> = ({ startedAt }) => {
  const calculateSeconds = () => (startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0);
  const [seconds, setSeconds] = useState(calculateSeconds());

  useEffect(() => {
    setSeconds(calculateSeconds());
    if (!startedAt) return;
    const interval = setInterval(() => setSeconds(calculateSeconds()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return (
    <div className={styles.liveTimer}>
      {hrs > 0
        ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`}
    </div>
  );
};

export const ChannelList: React.FC<ChannelListProps> = ({
  server,
  myId,
  activeChannel,
  serverVoiceStates,
  channelStartTimes = {},
  userVolumes = {},
  onVolumeChange,
  unreadChannels,
  activeSpeakers,
  userStatuses,
  onSelectChannel,
  onConnectVoice,
  onOpenCreateChannelModal,
  onOpenInviteModal,
  onOpenServerSettings,
  onViewUserProfile,
  onDeleteChannel,
  onRenameChannel,
  permissions,
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isServerMenuOpen, setIsServerMenuOpen] = useState(false);
  const serverMenuRef = useClickOutside<HTMLDivElement>(() => setIsServerMenuOpen(false), isServerMenuOpen);

  const isOwner = server.ownerId === myId || !!permissions?.isOwner;
  const canInvite = isOwner || !!permissions?.isAdmin || !!permissions?.canInvite;
  const canManageChannels = isOwner || !!permissions?.isAdmin || !!permissions?.canManageChannels;
  const canManageServer = isOwner || !!permissions?.isAdmin || !!permissions?.canManageServer;

  const textChannels = (server.channels || []).filter(
    (ch) => ch.type === ChannelTypeEnum.TEXT && ch.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const voiceChannels = (server.channels || []).filter(
    (ch) => ch.type === ChannelTypeEnum.VOICE && ch.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const liveVoiceCount = voiceChannels.filter(
    (ch) => serverVoiceStates[ch.id]?.length > 0
  ).length;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div 
          className={styles.serverNameWrapper}
          onClick={() => setIsServerMenuOpen((prev) => !prev)}
          title="Opções do Servidor"
        >
          <span className={styles.serverTitle}>{server.name}</span>
          <ChevronDown 
            size={16} 
            className={`${styles.chevron} ${isServerMenuOpen ? styles.chevronOpen : ''}`} 
          />
        </div>

        <div className={styles.headerActions}>
          <button
            className={styles.iconBtn}
            title={canInvite ? t('server.inviteUsers', 'Convidar Pessoas') : t('server.noInvitePermission', 'Você não tem permissão para convidar')}
            onClick={onOpenInviteModal}
            disabled={!canInvite || server.isSuspended}
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Server Dropdown Menu */}
        {isServerMenuOpen && (
          <div ref={serverMenuRef} className={styles.serverDropdownMenu}>
            <div className={styles.dropdownHeader}>
              <span className={styles.dropdownServerName}>{server.name}</span>
            </div>

            <div className={styles.dropdownDivider} />

            {(isOwner || canManageServer) && onOpenServerSettings && (
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setIsServerMenuOpen(false);
                  onOpenServerSettings();
                }}
              >
                <Settings size={15} />
                <span>{t('server.settingsTitle', 'Configurações do Servidor')}</span>
              </button>
            )}

            {canInvite && !server.isSuspended && (
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setIsServerMenuOpen(false);
                  onOpenInviteModal();
                }}
              >
                <UserPlus size={15} />
                <span>{t('server.inviteUsers', 'Convidar Pessoas')}</span>
              </button>
            )}

            {canManageChannels && !server.isSuspended && (
              <button
                type="button"
                className={styles.dropdownItem}
                onClick={() => {
                  setIsServerMenuOpen(false);
                  onOpenCreateChannelModal();
                }}
              >
                <Plus size={15} />
                <span>{t('channel.createChannel', 'Criar Canal')}</span>
              </button>
            )}

            <div className={styles.dropdownDivider} />

            <button
              type="button"
              className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
              onClick={() => {
                setIsServerMenuOpen(false);
                setIsReportModalOpen(true);
              }}
            >
              <ShieldAlert size={15} />
              <span>Denunciar Servidor</span>
            </button>
          </div>
        )}
      </div>

      {server.isSuspended ? (
        <div
          style={{
            margin: '1rem',
            padding: '1.25rem 1rem',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#fca5a5',
          }}
        >
          <ShieldAlert size={28} color="#ef4444" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
          <h4 style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '0.35rem', fontWeight: 700 }}>
            Servidor Suspenso
          </h4>
          <p style={{ fontSize: '0.75rem', lineHeight: 1.4, color: '#fca5a5', margin: 0 }}>
            {server.suspendedReason || 'Este servidor foi suspenso pela moderação por violação das diretrizes de segurança ou regras da ANPD.'}
          </p>
        </div>
      ) : (
        <>
          {canInvite && (
            <button className={styles.inviteBtn} onClick={onOpenInviteModal}>
              <UserPlus size={16} /> {t('server.inviteUsers')}
            </button>
          )}

          <div className={styles.searchWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t('channel.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

      <div className={styles.channelList}>
        {/* Text Channels Section */}
        <div>
          <div className={styles.sectionTitleWrapper}>
            <span className={styles.sectionTitle}>{t('channel.textChannels')}</span>
            <ChevronDown size={14} />
          </div>
          <div>
            {textChannels.map((channel) => {
              const isActive = activeChannel?.id === channel.id;
              const unread = unreadChannels[channel.id] || 0;

              return (
                <ChannelActions
                  key={channel.id}
                  channel={channel}
                  isOwner={canManageChannels}
                  onRename={onRenameChannel}
                  onDelete={onDeleteChannel}
                >
                  <div
                    className={`${styles.channelItem} ${isActive ? styles.active : ''}`}
                    onClick={() => onSelectChannel(channel)}
                  >
                    <div className={styles.channelContent}>
                      <Hash size={16} color={isActive ? '#ffffff' : '#64748b'} />
                      <span className={styles.channelName}>{channel.name}</span>
                    </div>
                    {isActive ? (
                      <div className={styles.activeIndicator} />
                    ) : unread > 0 ? (
                      <div className={styles.badge}>{unread}</div>
                    ) : null}
                  </div>
                </ChannelActions>
              );
            })}
          </div>
        </div>

        {/* Voice Channels Section */}
        <div>
          <div className={styles.sectionTitleWrapper}>
            <span className={styles.sectionTitle}>{t('channel.voiceChannels', 'VOICE CHANNELS')}</span>
            <span className={styles.liveBadge}>{liveVoiceCount} LIVE</span>
          </div>
          <div>
            {voiceChannels.map((channel) => {
              const usersInChannel = serverVoiceStates[channel.id] || [];
              const hasUsers = usersInChannel.length > 0;

              if (hasUsers) {
                return (
                  <div key={channel.id} className={styles.voiceCard}>
                    <ChannelActions
                      channel={channel}
                      isOwner={canManageChannels}
                      onRename={onRenameChannel}
                      onDelete={onDeleteChannel}
                    >
                      <div
                        className={styles.voiceCardHeader}
                        onClick={() => {
                          onSelectChannel(channel);
                          onConnectVoice(channel);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Volume2 size={16} color="var(--text-primary)" />
                          <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {channel.name}
                          </span>
                        </div>
                        <LiveTimer startedAt={channelStartTimes[channel.id]} />
                      </div>
                    </ChannelActions>

                    <div className={styles.voiceUsersList}>
                      {usersInChannel.map((p) => {
                        const vol = userVolumes[p.userId] ?? 100;
                        const isMe = p.userId === myId;
                        const isMutedByMe = !isMe && vol <= 0;
                        const isSpeaking = activeSpeakers.has(p.userId);
                        const avatarMedia = getMediaUrl(p.avatarUrl);
                        const displayName = p.displayName || p.username;

                        const content = (
                          <div 
                            className={`${styles.voiceUserRow} ${isMutedByMe ? styles.voiceUserMutedByMe : ''}`}
                            onClick={(e) => {
                              if (onViewUserProfile) {
                                e.stopPropagation();
                                onViewUserProfile(p.userId);
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                            title={`Ver perfil de ${displayName}`}
                          >
                            <div className={styles.avatarWrapper}>
                              <div
                                className={`${styles.userAvatar} ${
                                  isSpeaking ? styles.avatarSpeaking : ''
                                }`}
                              >
                                {avatarMedia && !failedAvatars[p.userId] ? (
                                  <img
                                    src={avatarMedia}
                                    alt={displayName}
                                    className={styles.voiceUserAvatarImg}
                                    onError={() => {
                                      setFailedAvatars((prev) => ({ ...prev, [p.userId]: true }));
                                    }}
                                  />
                                ) : (
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                                    {displayName.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <StatusDot
                                status={userStatuses?.[p.userId]?.status || UserStatusEnum.ONLINE}
                                size="sm"
                                absolute
                                className={styles.avatarOnlineDot}
                              />
                            </div>
                            <span className={styles.voiceUserName}>
                              {displayName}
                            </span>
                            <div
                              className={styles.voiceStatusIcons}
                              title={isMutedByMe ? 'Silenciado por você' : p.isMuted ? 'Microfone desligado' : isSpeaking ? 'Falando' : 'Microfone ativo'}
                            >
                              {p.isMuted ? (
                                <MicOff size={14} color="var(--text-muted)" />
                              ) : isSpeaking && !isMutedByMe ? (
                                <Volume2 size={14} color="var(--brand-primary)" />
                              ) : !isMutedByMe ? (
                                <Mic size={14} color="var(--text-muted)" style={{ opacity: 0.3 }} />
                              ) : null}
                              {isMutedByMe && (
                                <VolumeX
                                  size={15}
                                  className={styles.mutedByMeIcon}
                                />
                              )}
                            </div>
                          </div>
                        );

                        return isMe ? (
                          <div key={p.userId}>{content}</div>
                        ) : (
                          <ContextMenu.Root key={p.userId}>
                            <ContextMenu.Trigger asChild>
                              <div>{content}</div>
                            </ContextMenu.Trigger>
                            <ContextMenu.Portal>
                              <ContextMenu.Content className="context-menu-content" style={{ zIndex: 9999 }}>
                                <ContextMenu.Item 
                                  className="context-menu-item"
                                  onClick={() => onViewUserProfile?.(p.userId)}
                                >
                                  {t('common.profile', 'Perfil')}
                                </ContextMenu.Item>
                                <ContextMenu.Item
                                  className="context-menu-item"
                                  style={{
                                    borderBottom: '1px solid var(--border-subtle)',
                                    marginBottom: '4px',
                                    paddingBottom: '8px',
                                  }}
                                >
                                  {t('chat.sendMessage', 'Mensagem')}
                                </ContextMenu.Item>

                                <div className="context-menu-label">
                                  {t('voice.userVolume', 'Volume do usuário')} ({vol}%)
                                </div>
                                <div className="context-menu-slider-container">
                                  <Slider.Root
                                    className="slider-root"
                                    value={[vol]}
                                    max={200}
                                    step={1}
                                    onValueChange={(vals) => onVolumeChange?.(p.userId, vals[0])}
                                  >
                                    <Slider.Track className="slider-track">
                                      <Slider.Range className="slider-range" />
                                    </Slider.Track>
                                    <Slider.Thumb className="slider-thumb" />
                                  </Slider.Root>
                                </div>

                                <ContextMenu.Item
                                  className="context-menu-item"
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}
                                >
                                  {vol <= 0 ? 'Ativar som para mim' : 'Silenciar para mim'}{' '}
                                  <Switch.Root
                                    className="switch-root"
                                    checked={vol <= 0}
                                    onCheckedChange={(muted) => onVolumeChange?.(p.userId, muted ? 0 : 100)}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <Switch.Thumb className="switch-thumb" />
                                  </Switch.Root>
                                </ContextMenu.Item>
                              </ContextMenu.Content>
                            </ContextMenu.Portal>
                          </ContextMenu.Root>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <ChannelActions
                  key={channel.id}
                  channel={channel}
                  isOwner={canManageChannels}
                  onRename={onRenameChannel}
                  onDelete={onDeleteChannel}
                >
                  <div
                    className={styles.emptyChannelRow}
                    onClick={() => {
                      onSelectChannel(channel);
                      onConnectVoice(channel);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Volume2 size={16} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                        {channel.name}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Empty</span>
                  </div>
                </ChannelActions>
              );
            })}
          </div>
        </div>
      </div>
      </>
      )}

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        targetType={ReportTargetTypeEnum.SERVER}
        targetId={server.id}
        targetName={server.name}
      />
    </div>
  );
};
