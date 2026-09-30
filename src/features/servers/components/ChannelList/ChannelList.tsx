import React, { useState, useEffect } from 'react';
import styles from './ChannelList.module.css';
import { Hash, Volume2, Plus, UserPlus, Search, ChevronDown, Mic, MicOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as Slider from '@radix-ui/react-slider';
import * as Switch from '@radix-ui/react-switch';
import type { ChannelItem, ServerItem } from '../ServerSidebar/ServerSidebar';
import { ChannelTypeEnum } from '../../../../core/enums';

interface ChannelListProps {
  server: ServerItem;
  myId: string;
  activeChannel: ChannelItem | null;
  serverVoiceStates: Record<string, { userId: string; username: string; isMuted?: boolean }[]>;
  channelStartTimes?: Record<string, number>;
  userVolumes?: Record<string, number>;
  onVolumeChange?: (userId: string, volume: number) => void;
  unreadChannels: Record<string, number>;
  activeSpeakers: Set<string>;
  onSelectChannel: (channel: ChannelItem) => void;
  onConnectVoice: (channel: ChannelItem) => void;
  onOpenCreateChannelModal: () => void;
  onOpenInviteModal: () => void;
}

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
  onSelectChannel,
  onConnectVoice,
  onOpenCreateChannelModal,
  onOpenInviteModal,
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  const isOwner = server.ownerId === myId;

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
        <div className={styles.serverNameWrapper}>
          <span className={styles.serverTitle}>{server.name}</span>
          <ChevronDown size={14} color="#64748b" />
        </div>
        <div className={styles.headerActions}>
          {isOwner && <span className={styles.ownerBadge}>{t('common.owner')}</span>}
          <button
            className={styles.iconBtn}
            title={t('channel.createChannel')}
            onClick={onOpenCreateChannelModal}
            disabled={!isOwner}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <button className={styles.inviteBtn} onClick={onOpenInviteModal}>
        <UserPlus size={16} /> {t('server.inviteUsers')}
      </button>

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
                <div
                  key={channel.id}
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

                    <div className={styles.voiceUsersList}>
                      {usersInChannel.map((p) => {
                        const vol = userVolumes[p.userId] ?? 100;
                        const isMe = p.userId === myId;
                        const isSpeaking = activeSpeakers.has(p.userId);

                        const content = (
                          <div className={styles.voiceUserRow}>
                            <div
                              className={`${styles.userAvatar} ${
                                isSpeaking ? styles.avatarSpeaking : ''
                              }`}
                            >
                              {p.username.charAt(0).toUpperCase()}
                              <div className={styles.avatarOnlineDot} />
                            </div>
                            <span className={styles.voiceUserName}>
                              {p.username}
                            </span>
                            {p.isMuted ? (
                              <MicOff size={14} color="var(--text-muted)" />
                            ) : isSpeaking ? (
                              <Volume2 size={14} color="var(--brand-primary)" />
                            ) : (
                              <Mic size={14} color="var(--text-muted)" style={{ opacity: 0.3 }} />
                            )}
                          </div>
                        );

                        return isMe ? (
                          <div key={p.userId}>{content}</div>
                        ) : (
                          <ContextMenu.Root key={p.userId}>
                            <ContextMenu.Trigger asChild>
                              <div style={{ cursor: 'pointer' }}>{content}</div>
                            </ContextMenu.Trigger>
                            <ContextMenu.Portal>
                              <ContextMenu.Content className="context-menu-content" style={{ zIndex: 9999 }}>
                                <ContextMenu.Item className="context-menu-item">
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
                                  {t('voice.mute', 'Silenciar')}{' '}
                                  <Switch.Root className="switch-root">
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
                <div
                  key={channel.id}
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
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
