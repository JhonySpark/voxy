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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { realtimeClient } from '../../../../infrastructure/adapters/realtime/socket-realtime.adapter';
import { RealtimeEvents, UserStatusEnum } from '../../../../core/enums';
import { getMediaUrl } from '../../../../core/utils/media.util';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import { StatusDot } from '../../../../components/common/StatusDot/StatusDot';

export interface ServerMemberItem {
  id: string;
  serverId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
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
  onOpenUserProfile?: (userId: string) => void;
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

  const fetchMembers = async () => {
    try {
      const [membersRes, permsRes] = await Promise.allSettled([
        httpClient.get<ServerMemberItem[]>(`/servers/${serverId}/members`),
        httpClient.get<any>(`/servers/${serverId}/my-permissions`),
      ]);

      if (membersRes.status === 'fulfilled' && Array.isArray(membersRes.value)) {
        setMembers(membersRes.value);
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
    fetchMembers();

    const onMembersRefresh = (data?: { serverId: string }) => {
      if (!data || data.serverId === serverId) {
        fetchMembers();
      }
    };

    realtimeClient.on(RealtimeEvents.SERVER_MEMBERS_UPDATED, onMembersRefresh);
    realtimeClient.on(RealtimeEvents.SERVER_UPDATED, onMembersRefresh);
    realtimeClient.on(RealtimeEvents.USER_PROFILE_UPDATED, onMembersRefresh);

    return () => {
      realtimeClient.off(RealtimeEvents.SERVER_MEMBERS_UPDATED, onMembersRefresh);
      realtimeClient.off(RealtimeEvents.SERVER_UPDATED, onMembersRefresh);
      realtimeClient.off(RealtimeEvents.USER_PROFILE_UPDATED, onMembersRefresh);
    };
  }, [serverId]);

  const isOwner = serverOwnerId === myId;
  const canManageServer = isOwner || myPermissions?.canManageServer;
  const canKick = isOwner || myPermissions?.canKickMembers;
  const canBan = isOwner || myPermissions?.canBanMembers;

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
      onMembersUpdated?.();
      setBanTargetMember(null);
      setBanReason('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao banir membro.');
    } finally {
      setIsBanning(false);
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
        onClick={() => onOpenUserProfile?.(member.userId)}
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
                        className="context-menu-item"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fb923c' }}
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
                        className="context-menu-item"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171' }}
                        onClick={() => {
                          setActiveMenuMemberId(null);
                          setBanTargetMember(member);
                        }}
                      >
                        <Ban size={14} />
                        <span>Banir do Servidor</span>
                      </div>
                    )}
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
            {t('server.members', 'Membros')} — {members.length}
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
          <div className={styles.emptyMembers}>
            <Loader2 size={24} className="spinner" style={{ margin: '0 auto 8px' }} />
            <span>Carregando membros...</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className={styles.emptyMembers}>
            <span>Nenhum membro encontrado.</span>
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
                {isBanning ? 'Banindo...' : 'Banir do Servidor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
