import React, { useState, useEffect, useMemo } from 'react';
import styles from './ServerMembersSidebar.module.css';
import {
  Users,
  X,
  Search,
  Crown,
  Shield,
  MoreVertical,
  UserMinus,
  Ban,
  MessageSquare,
  Loader2,
  Check,
  Award,
  ChevronRight,
  Mic,
  MicOff,
  ShieldAlert,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { realtimeClient } from '../../../../infrastructure/adapters/realtime/socket-realtime.adapter';
import { RealtimeEvents, UserStatusEnum, ReportTargetTypeEnum } from '../../../../core/enums';
import { getMediaUrl, preloadMedia } from '../../../../core/utils/media.util';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import { StatusDot } from '../../../../components/common/StatusDot/StatusDot';
import { ReportModal } from '../../../moderation/components/ReportModal/ReportModal';

export interface ServerMemberItem {
  id: string;
  serverId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
  isMuted?: boolean;
  mutedReason?: string | null;
  mutedUntil?: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    bannerColor?: string | null;
    bio?: string | null;
    createdAt?: string;
    status?: string | null;
    customStatus?: string | null;
  };
}

interface ServerMembersSidebarProps {
  serverId: string;
  serverOwnerId: string;
  myId: string;
  userStatuses?: Record<string, { status: UserStatusEnum | string; customStatus?: string }>;
  onClose: () => void;
  onOpenUserProfile?: (userId: string, initialData?: any) => void;
  onOpenDirectMessage?: (userId: string) => void;
  onMembersUpdated?: () => void;
}

export const ServerMembersSidebar: React.FC<ServerMembersSidebarProps> = ({
  serverId,
  serverOwnerId,
  myId,
  userStatuses,
  onClose,
  onOpenUserProfile,
  onOpenDirectMessage,
  onMembersUpdated,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [members, setMembers] = useState<ServerMemberItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [myPermissions, setMyPermissions] = useState<any>(null);
  const [activeMenuMemberId, setActiveMenuMemberId] = useState<string | null>(null);
  const [showRoleSelectorForId, setShowRoleSelectorForId] = useState<string | null>(null);

  // Modal para confirmar ban com motivo
  const [banTargetMember, setBanTargetMember] = useState<ServerMemberItem | null>(null);
  const [banReason, setBanReason] = useState('');
  const [isBanning, setIsBanning] = useState(false);

  // Modal para confirmar expulsão
  const [kickTargetMember, setKickTargetMember] = useState<ServerMemberItem | null>(null);
  const [isKicking, setIsKicking] = useState(false);

  // Modal para confirmar silenciamento (Server Mute)
  const [muteTargetMember, setMuteTargetMember] = useState<ServerMemberItem | null>(null);
  const [muteDurationMinutes, setMuteDurationMinutes] = useState(15);
  const [muteReason, setMuteReason] = useState('');
  const [isMuting, setIsMuting] = useState(false);

  // Modal de denúncia (Report Modal)
  const [reportTargetMember, setReportTargetMember] = useState<ServerMemberItem | null>(null);

  const fetchMembers = async () => {
    try {
      const [membersRes, permsRes] = await Promise.allSettled([
        httpClient.get<ServerMemberItem[]>(`/servers/${serverId}/members`),
        httpClient.get<any>(`/servers/${serverId}/my-permissions`),
      ]);

      if (membersRes.status === 'fulfilled' && Array.isArray(membersRes.value)) {
        setMembers(membersRes.value);
        membersRes.value.forEach((m) => {
          if (m.user?.avatarUrl) preloadMedia(m.user.avatarUrl);
          if (m.user?.bannerUrl) preloadMedia(m.user.bannerUrl);
        });
      }
      if (permsRes.status === 'fulfilled' && permsRes.value) {
        setMyPermissions(permsRes.value);
      }
    } catch (err) {
      console.error('Error fetching server members', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setMembers([]);
    fetchMembers();

    const onMembersRefresh = (data?: { serverId: string }) => {
      if (!data || data.serverId === serverId) {
        fetchMembers();
      }
    };

    const onMemberMutedEvent = (data?: { serverId: string; targetUserId: string; isMuted: boolean }) => {
      if (data && data.serverId === serverId) {
        setMembers((prev) =>
          prev.map((m) =>
            m.userId === data.targetUserId ? { ...m, isMuted: data.isMuted } : m,
          ),
        );
      }
    };

    realtimeClient.on(RealtimeEvents.SERVER_MEMBERS_UPDATED, onMembersRefresh);
    realtimeClient.on(RealtimeEvents.SERVER_UPDATED, onMembersRefresh);
    realtimeClient.on(RealtimeEvents.USER_PROFILE_UPDATED, onMembersRefresh);
    realtimeClient.on(RealtimeEvents.MEMBER_MUTED, onMemberMutedEvent);

    return () => {
      realtimeClient.off(RealtimeEvents.SERVER_MEMBERS_UPDATED, onMembersRefresh);
      realtimeClient.off(RealtimeEvents.SERVER_UPDATED, onMembersRefresh);
      realtimeClient.off(RealtimeEvents.USER_PROFILE_UPDATED, onMembersRefresh);
      realtimeClient.off(RealtimeEvents.MEMBER_MUTED, onMemberMutedEvent);
    };
  }, [serverId]);

  const isOwner = serverOwnerId === myId;
  const canManageServer = isOwner || myPermissions?.canManageServer;
  const canKick = isOwner || myPermissions?.canKickMembers;
  const canBan = isOwner || myPermissions?.canBanMembers;
  const canMute = isOwner || myPermissions?.canMuteMembers || myPermissions?.canManageServer;

  const handleChangeRole = async (targetUserId: string, newRole: string) => {
    try {
      await httpClient.patch(`/servers/${serverId}/members/${targetUserId}/role`, { role: newRole });
      toast.success(t('server.roleUpdated', 'Cargo do membro atualizado com sucesso!'));
      setMembers((prev) =>
        prev.map((m) => (m.userId === targetUserId ? { ...m, role: newRole as any } : m))
      );
      realtimeClient.emit(RealtimeEvents.SERVER_MEMBERS_UPDATED, { serverId });
      onMembersUpdated?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao alterar cargo do membro.');
    }
  };

  const handleConfirmKick = async () => {
    if (!kickTargetMember) return;
    setIsKicking(true);
    try {
      await httpClient.delete(`/servers/${serverId}/members/${kickTargetMember.userId}`);
      toast.success(t('server.memberKicked', 'Membro expulso do servidor!'));
      setMembers((prev) => prev.filter((m) => m.userId !== kickTargetMember.userId));
      realtimeClient.emit(RealtimeEvents.SERVER_MEMBERS_UPDATED, { serverId });
      onMembersUpdated?.();
      setKickTargetMember(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao expulsar membro.');
    } finally {
      setIsKicking(false);
    }
  };

  const handleConfirmBan = async () => {
    if (!banTargetMember) return;
    setIsBanning(true);
    try {
      await httpClient.post(`/servers/${serverId}/bans`, {
        userId: banTargetMember.userId,
        reason: banReason.trim() || undefined,
      });
      toast.success(t('server.memberBanned', 'Membro banido do servidor!'));
      setMembers((prev) => prev.filter((m) => m.userId !== banTargetMember.userId));
      realtimeClient.emit(RealtimeEvents.SERVER_MEMBERS_UPDATED, { serverId });
      realtimeClient.emit(RealtimeEvents.MEMBER_BANNED, {
        serverId,
        targetUserId: banTargetMember.userId,
        reason: banReason.trim() || undefined,
      });
      onMembersUpdated?.();
      setBanTargetMember(null);
      setBanReason('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao banir membro.');
    } finally {
      setIsBanning(false);
    }
  };

  const handleConfirmMute = async () => {
    if (!muteTargetMember) return;
    setIsMuting(true);
    try {
      await httpClient.post(`/servers/${serverId}/members/${muteTargetMember.userId}/mute`, {
        reason: muteReason.trim() || undefined,
        durationMinutes: muteDurationMinutes > 0 ? muteDurationMinutes : undefined,
      });
      toast.success(t('server.memberMuted', 'Membro silenciado com sucesso!'));
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === muteTargetMember.userId
            ? { ...m, isMuted: true, mutedReason: muteReason.trim() || null }
            : m,
        ),
      );
      realtimeClient.emit(RealtimeEvents.MEMBER_MUTED, {
        serverId,
        targetUserId: muteTargetMember.userId,
        isMuted: true,
      });
      setMuteTargetMember(null);
      setMuteReason('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao silenciar membro.');
    } finally {
      setIsMuting(false);
    }
  };

  const handleUnmute = async (member: ServerMemberItem) => {
    try {
      await httpClient.post(`/servers/${serverId}/members/${member.userId}/unmute`);
      toast.success(t('server.memberUnmuted', 'Silenciamento do membro removido!'));
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === member.userId
            ? { ...m, isMuted: false, mutedReason: null, mutedUntil: null }
            : m,
        ),
      );
      realtimeClient.emit(RealtimeEvents.MEMBER_MUTED, {
        serverId,
        targetUserId: member.userId,
        isMuted: false,
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao desmutar membro.');
    }
  };

  const handleBlockMember = async (member: ServerMemberItem) => {
    try {
      await httpClient.post(`/friends/block/${member.userId}`);
      toast.success(`Usuário @${member.user?.username} bloqueado.`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao bloquear usuário.');
    }
  };

  const filteredMembers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return members.filter((m) => {
      const name = m.user?.displayName?.toLowerCase() || '';
      const username = m.user?.username?.toLowerCase() || '';
      return name.includes(term) || username.includes(term);
    });
  }, [members, searchTerm]);

  // Agrupamento por cargos
  const ownerAndAdmins = useMemo(
    () => filteredMembers.filter((m) => m.role === 'OWNER' || m.role === 'ADMIN'),
    [filteredMembers]
  );
  const moderators = useMemo(
    () => filteredMembers.filter((m) => m.role === 'MODERATOR'),
    [filteredMembers]
  );
  const standardMembers = useMemo(
    () => filteredMembers.filter((m) => m.role === 'MEMBER'),
    [filteredMembers]
  );

  const renderMemberRow = (member: ServerMemberItem) => {
    const isTargetOwner = member.role === 'OWNER' || member.userId === serverOwnerId;
    const isSelf = member.userId === myId;
    const canModerateThisMember =
      !isSelf &&
      !isTargetOwner &&
      (isOwner || (member.role !== 'ADMIN' && (canKick || canBan || canManageServer)));

    return (
      <div
        key={member.id}
        className={styles.memberItem}
        onClick={() =>
          onOpenUserProfile?.(member.userId, {
            id: member.userId,
            username: member.user.username,
            displayName: member.user.displayName,
            avatarUrl: member.user.avatarUrl,
            bannerUrl: member.user.bannerUrl,
            bannerColor: member.user.bannerColor,
            bio: member.user.bio,
            createdAt: member.user.createdAt,
          })
        }
        title={t('user.clickToViewProfile', 'Clique para ver o perfil')}
      >
        <div className={styles.memberLeft}>
          <div className={styles.avatarWrapper}>
            <div className={styles.avatar}>
              {getMediaUrl(member.user?.avatarUrl) ? (
                <img
                  src={getMediaUrl(member.user?.avatarUrl)}
                  alt={member.user.displayName || member.user.username}
                  className={styles.avatarImg}
                />
              ) : (
                <span>{(member.user?.displayName || member.user?.username || 'U').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <StatusDot
              status={userStatuses?.[member.userId]?.status || member.user?.status}
              activity={userStatuses?.[member.userId]?.customStatus || member.user?.customStatus}
              size="sm"
              className={styles.onlineBadge}
            />
          </div>

          <div className={styles.memberNames}>
            <span className={styles.displayName}>
              {member.user?.displayName || member.user?.username}
              {member.role === 'OWNER' && (
                <span className={styles.badgeOwner} title="Proprietário do Servidor">
                  <Crown size={10} /> Dono
                </span>
              )}
              {member.role === 'ADMIN' && (
                <span className={styles.badgeAdmin} title="Administrador">
                  <Shield size={10} /> Admin
                </span>
              )}
              {member.role === 'MODERATOR' && (
                <span className={styles.badgeMod} title="Moderador">
                  <Award size={10} /> Mod
                </span>
              )}
              {member.isMuted && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    color: '#f87171',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '1px 6px',
                    borderRadius: 4,
                    marginLeft: 4,
                  }}
                  title="Membro silenciado no servidor"
                >
                  <MicOff size={10} /> Mudo
                </span>
              )}
            </span>
            <span className={styles.username}>@{member.user?.username}</span>
          </div>
        </div>

        {/* Dropdown de Ações */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={styles.moreBtn}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              setShowRoleSelectorForId(null);
              setActiveMenuMemberId((curr) => (curr === member.userId ? null : member.userId));
            }}
            title="Ações do membro"
          >
            <MoreVertical size={14} />
          </button>

          {activeMenuMemberId === member.userId && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  setActiveMenuMemberId(null);
                  setShowRoleSelectorForId(null);
                }}
              />
              <div
                className="context-menu-content"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  zIndex: 9999,
                  minWidth: 200,
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                }}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <div
                  className="context-menu-item"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  onClick={() => {
                    setActiveMenuMemberId(null);
                    onOpenUserProfile?.(member.userId);
                  }}
                >
                  <Users size={14} />
                  <span>Ver Perfil</span>
                </div>

                {onOpenDirectMessage && !isSelf && (
                  <div
                    className="context-menu-item"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    onClick={() => {
                      setActiveMenuMemberId(null);
                      onOpenDirectMessage(member.userId);
                    }}
                  >
                    <MessageSquare size={14} />
                    <span>Mensagem Direta</span>
                  </div>
                )}

                {canModerateThisMember && (
                  <>
                    <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

                    {/* Alterar Cargo */}
                    {canManageServer && (
                      <div>
                        <div
                          className="context-menu-item"
                          onClick={() =>
                            setShowRoleSelectorForId((curr) => (curr === member.userId ? null : member.userId))
                          }
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            boxSizing: 'border-box',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Shield size={14} />
                            <span>Alterar Cargo</span>
                          </div>
                          <ChevronRight
                            size={14}
                            style={{
                              transform: showRoleSelectorForId === member.userId ? 'rotate(90deg)' : 'none',
                              transition: 'transform 0.15s ease',
                              flexShrink: 0,
                            }}
                          />
                        </div>

                        {showRoleSelectorForId === member.userId && (
                          <div style={{ paddingLeft: '0.5rem', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 6, margin: '3px 0' }}>
                            {isOwner && (
                              <div
                                className="context-menu-item"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                onClick={() => {
                                  setActiveMenuMemberId(null);
                                  setShowRoleSelectorForId(null);
                                  handleChangeRole(member.userId, 'ADMIN');
                                }}
                              >
                                {member.role === 'ADMIN' ? <Check size={14} /> : <div style={{ width: 14 }} />}
                                <span>Administrador</span>
                              </div>
                            )}
                            <div
                              className="context-menu-item"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                              onClick={() => {
                                setActiveMenuMemberId(null);
                                setShowRoleSelectorForId(null);
                                handleChangeRole(member.userId, 'MODERATOR');
                              }}
                            >
                              {member.role === 'MODERATOR' ? <Check size={14} /> : <div style={{ width: 14 }} />}
                              <span>Moderador</span>
                            </div>
                            <div
                              className="context-menu-item"
                              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                              onClick={() => {
                                setActiveMenuMemberId(null);
                                setShowRoleSelectorForId(null);
                                handleChangeRole(member.userId, 'MEMBER');
                              }}
                            >
                              {member.role === 'MEMBER' ? <Check size={14} /> : <div style={{ width: 14 }} />}
                              <span>Membro Padrão</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expulsar */}
                    {canKick && (
                      <div
                        className="context-menu-item context-menu-item-warning"
                        onClick={() => {
                          setActiveMenuMemberId(null);
                          setKickTargetMember(member);
                        }}
                      >
                        <UserMinus size={14} />
                        <span>Expulsar do Servidor</span>
                      </div>
                    )}

                    {/* Banir */}
                    {canBan && (
                      <div
                        className="context-menu-item context-menu-item-danger"
                        onClick={() => {
                          setActiveMenuMemberId(null);
                          setBanTargetMember(member);
                        }}
                      >
                        <Ban size={14} />
                        <span>Banir do Servidor</span>
                      </div>
                    )}

                    {/* Silenciar / Desmutar */}
                    {canMute && (
                      member.isMuted ? (
                        <div
                          className="context-menu-item context-menu-item-success"
                          onClick={() => {
                            setActiveMenuMemberId(null);
                            handleUnmute(member);
                          }}
                        >
                          <Mic size={14} />
                          <span>Desmutar no Servidor</span>
                        </div>
                      ) : (
                        <div
                          className="context-menu-item context-menu-item-amber"
                          onClick={() => {
                            setActiveMenuMemberId(null);
                            setMuteTargetMember(member);
                            setMuteDurationMinutes(15);
                            setMuteReason('');
                          }}
                        >
                          <MicOff size={14} />
                          <span>Silenciar no Servidor</span>
                        </div>
                      )
                    )}
                  </>
                )}

                {/* Ações Universais de Proteção & Segurança */}
                {!isSelf && (
                  <>
                    <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
                    <div
                      className="context-menu-item"
                      onClick={() => {
                        setActiveMenuMemberId(null);
                        handleBlockMember(member);
                      }}
                    >
                      <Ban size={14} />
                      <span>Bloquear Usuário</span>
                    </div>
                    <div
                      className="context-menu-item context-menu-item-danger"
                      onClick={() => {
                        setActiveMenuMemberId(null);
                        setReportTargetMember(member);
                      }}
                    >
                      <ShieldAlert size={14} />
                      <span>Denunciar Usuário</span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Users size={16} color="var(--brand-primary, #34d399)" />
          <span>
            {t('server.members', 'Membros')}
            {!isLoading && ` — ${members.length}`}
          </span>
        </div>
        <button type="button" className={styles.closeBtn} onClick={onClose} title={t('common.close', 'Fechar')}>
          <X size={16} />
        </button>
      </div>

      {/* Search Input */}
      <div className={styles.searchBox}>
        <Search size={14} className={styles.searchIcon} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder={t('server.searchMembers', 'Buscar membros...')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Members list */}
      <div className={styles.membersList}>
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <Loader2 size={24} className={styles.spinner} />
            <span>{t('server.loadingMembers', 'Carregando membros...')}</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className={styles.emptyMembers}>
            <span>{t('server.noMembersFound', 'Nenhum membro encontrado.')}</span>
          </div>
        ) : (
          <>
            {ownerAndAdmins.length > 0 && (
              <div className={styles.group}>
                <span className={styles.groupTitle}>
                  Administração — {ownerAndAdmins.length}
                </span>
                {ownerAndAdmins.map(renderMemberRow)}
              </div>
            )}

            {moderators.length > 0 && (
              <div className={styles.group}>
                <span className={styles.groupTitle}>
                  Moderadores — {moderators.length}
                </span>
                {moderators.map(renderMemberRow)}
              </div>
            )}

            {standardMembers.length > 0 && (
              <div className={styles.group}>
                <span className={styles.groupTitle}>
                  Membros — {standardMembers.length}
                </span>
                {standardMembers.map(renderMemberRow)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Confirm Kick */}
      {kickTargetMember && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setKickTargetMember(null)}
        >
          <div
            style={{
              backgroundColor: '#111520',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 12,
              padding: '1.5rem',
              maxWidth: 400,
              width: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700 }}>
              Expulsar {kickTargetMember.user?.displayName || kickTargetMember.user?.username}?
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>
              Tem certeza que deseja expulsar @{kickTargetMember.user?.username} deste servidor? O usuário poderá retornar caso receba outro convite.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="cancel-button"
                style={{ padding: '0.5rem 1rem', borderRadius: 6, background: '#1e2433', color: '#e2e8f0', border: 'none', cursor: 'pointer' }}
                onClick={() => setKickTargetMember(null)}
                disabled={isKicking}
              >
                Cancelar
              </button>
              <button
                type="button"
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 6,
                  background: '#f97316',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={handleConfirmKick}
                disabled={isKicking}
              >
                {isKicking ? 'Expulsando...' : 'Expulsar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Ban */}
      {banTargetMember && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setBanTargetMember(null)}
        >
          <div
            style={{
              backgroundColor: '#111520',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 12,
              padding: '1.5rem',
              maxWidth: 420,
              width: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#ef4444', fontWeight: 700 }}>
              Banir {banTargetMember.user?.displayName || banTargetMember.user?.username}?
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>
              Tem certeza que deseja banir @{banTargetMember.user?.username}? O usuário será removido imediatamente e não poderá reentrar no servidor.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Motivo do Banimento (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Quebra de regras de conduta"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: 6,
                  background: '#0b0e17',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                style={{ padding: '0.5rem 1rem', borderRadius: 6, background: '#1e2433', color: '#e2e8f0', border: 'none', cursor: 'pointer' }}
                onClick={() => setBanTargetMember(null)}
                disabled={isBanning}
              >
                Cancelar
              </button>
              <button
                type="button"
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 6,
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onClick={handleConfirmBan}
                disabled={isBanning}
              >
                {isBanning ? 'Banindo...' : 'Confirmar Banimento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Mute */}
      {muteTargetMember && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
          }}
          onClick={() => setMuteTargetMember(null)}
        >
          <div
            style={{
              backgroundColor: '#111520',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 12,
              padding: '1.5rem',
              maxWidth: 420,
              width: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(251, 191, 36, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
                <MicOff size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#f8fafc', fontWeight: 700 }}>
                Silenciar {muteTargetMember.user?.displayName || muteTargetMember.user?.username}?
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>
              O membro não poderá enviar mensagens de texto nem falar nos canais de voz deste servidor durante o período selecionado.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Duração do Silenciamento
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                {[
                  { label: '5 min', val: 5 },
                  { label: '15 min', val: 15 },
                  { label: '1 hora', val: 60 },
                  { label: '24 horas', val: 1440 },
                  { label: '7 dias', val: 10080 },
                  { label: 'Permanente', val: 0 },
                ].map((d) => (
                  <button
                    key={d.val}
                    type="button"
                    style={{
                      padding: '0.45rem',
                      borderRadius: 6,
                      background: muteDurationMinutes === d.val ? 'rgba(251, 191, 36, 0.25)' : '#1e2433',
                      border: muteDurationMinutes === d.val ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.06)',
                      color: muteDurationMinutes === d.val ? '#fbbf24' : '#e2e8f0',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                    onClick={() => setMuteDurationMinutes(d.val)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                Motivo (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: Spam ou comportamento desrespeitoso"
                value={muteReason}
                onChange={(e) => setMuteReason(e.target.value)}
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: 6,
                  background: '#0b0e17',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                style={{ padding: '0.5rem 1rem', borderRadius: 6, background: '#1e2433', color: '#e2e8f0', border: 'none', cursor: 'pointer' }}
                onClick={() => setMuteTargetMember(null)}
                disabled={isMuting}
              >
                Cancelar
              </button>
              <button
                type="button"
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 6,
                  background: '#fbbf24',
                  color: '#000000',
                  border: 'none',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                onClick={handleConfirmMute}
                disabled={isMuting}
              >
                {isMuting ? 'Silenciando...' : 'Confirmar Silenciamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportTargetMember && (
        <ReportModal
          isOpen={!!reportTargetMember}
          onClose={() => setReportTargetMember(null)}
          targetType={ReportTargetTypeEnum.USER}
          targetId={reportTargetMember.userId}
          targetName={reportTargetMember.user?.username}
        />
      )}
    </aside>
  );
};
