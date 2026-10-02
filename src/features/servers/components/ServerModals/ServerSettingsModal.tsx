import React, { useState, useRef, useEffect } from 'react';
import styles from './Modals.module.css';
import {
  Camera,
  Image as ImageIcon,
  Check,
  X,
  Shield,
  UserX,
  Trash2,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { ApiRoutes, RealtimeEvents } from '../../../../core/enums';
import { realtimeClient } from '../../../../infrastructure/adapters/realtime/socket-realtime.adapter';
import type { ServerItem } from '../ServerSidebar/ServerSidebar';
import { getMediaUrl } from '../../../../core/utils/media.util';

interface ServerSettingsModalProps {
  isOpen: boolean;
  server: ServerItem;
  myId?: string;
  onClose: () => void;
  onServerUpdated: () => void;
  onServerDeleted?: () => void;
}

interface RolePermissionData {
  canInvite: boolean;
  canDeleteMessages: boolean;
  canKickMembers: boolean;
  canBanMembers: boolean;
  canManageChannels: boolean;
  canManageServer: boolean;
}

interface BannedUserData {
  id: string;
  userId: string;
  reason?: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  server,
  myId,
  onClose,
  onServerUpdated,
  onServerDeleted,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const isOwner = server.ownerId === myId;
  const [activeTab, setActiveTab] = useState<'overview' | 'roles' | 'bans' | 'danger'>('overview');

  // Overview states
  const [serverName, setServerName] = useState(server.name);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(server.iconUrl || null);
  const [iconError, setIconError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Moderation / Permissions states
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'MODERATOR' | 'MEMBER'>('ADMIN');
  const [rolePermissions, setRolePermissions] = useState<Record<string, RolePermissionData>>({
    ADMIN: {
      canInvite: true,
      canDeleteMessages: true,
      canKickMembers: true,
      canBanMembers: true,
      canManageChannels: true,
      canManageServer: false,
    },
    MODERATOR: {
      canInvite: true,
      canDeleteMessages: true,
      canKickMembers: true,
      canBanMembers: false,
      canManageChannels: false,
      canManageServer: false,
    },
    MEMBER: {
      canInvite: true,
      canDeleteMessages: false,
      canKickMembers: false,
      canBanMembers: false,
      canManageChannels: false,
      canManageServer: false,
    },
  });
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // Bans states
  const [bans, setBans] = useState<BannedUserData[]>([]);
  const [isLoadingBans, setIsLoadingBans] = useState(false);

  // Delete server confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setServerName(server.name);
      setIconPreview(server.iconUrl || null);
      setIconFile(null);
      setIconError(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmationText('');
      setActiveTab('overview');

      // Fetch server permissions and bans
      loadPermissionsAndBans();
    }
  }, [isOpen, server]);

  const loadPermissionsAndBans = async () => {
    setIsLoadingBans(true);
    try {
      const [permsRes, bansRes] = await Promise.allSettled([
        httpClient.get<any[]>(`/servers/${server.id}/permissions`),
        httpClient.get<BannedUserData[]>(`/servers/${server.id}/bans`),
      ]);

      if (permsRes.status === 'fulfilled' && Array.isArray(permsRes.value)) {
        setRolePermissions((prev) => {
          const updated = { ...prev };
          permsRes.value.forEach((p) => {
            if (p.role && updated[p.role]) {
              updated[p.role] = {
                canInvite: p.canInvite ?? updated[p.role].canInvite,
                canDeleteMessages: p.canDeleteMessages ?? updated[p.role].canDeleteMessages,
                canKickMembers: p.canKickMembers ?? updated[p.role].canKickMembers,
                canBanMembers: p.canBanMembers ?? updated[p.role].canBanMembers,
                canManageChannels: p.canManageChannels ?? updated[p.role].canManageChannels,
                canManageServer: p.canManageServer ?? updated[p.role].canManageServer,
              };
            }
          });
          return updated;
        });
      }

      if (bansRes.status === 'fulfilled' && Array.isArray(bansRes.value)) {
        setBans(bansRes.value);
      }
    } catch (e) {
      console.error('Error loading permissions/bans', e);
    } finally {
      setIsLoadingBans(false);
    }
  };

  if (!isOpen) return null;

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('user.invalidImageType', 'Por favor, selecione uma imagem válida.'));
      return;
    }

    setIconFile(file);
    const objectUrl = URL.createObjectURL(file);
    setIconPreview(objectUrl);
  };

  const handleSaveOverview = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = serverName.trim();
    if (!trimmed) {
      toast.warning(t('server.serverNamePlaceholder', 'O nome do servidor não pode ser vazio.'), t('server.serverName'));
      return;
    }

    setIsSaving(true);
    try {
      if (trimmed !== server.name) {
        await httpClient.patch(`${ApiRoutes.SERVERS}/${server.id}`, { name: trimmed });
      }

      if (iconFile) {
        const formData = new FormData();
        formData.append('file', iconFile);
        await httpClient.post(`/storage/server/${server.id}/icon`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast.success(t('server.savedSuccess', 'Servidor atualizado com sucesso!'));
      onServerUpdated();
      realtimeClient.emit(RealtimeEvents.SERVER_UPDATED, { serverId: server.id });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao atualizar configurações do servidor.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePermission = (field: keyof RolePermissionData) => {
    setRolePermissions((prev) => ({
      ...prev,
      [selectedRole]: {
        ...prev[selectedRole],
        [field]: !prev[selectedRole][field],
      },
    }));
  };

  const handleSaveRolePermissions = async () => {
    setIsSavingPermissions(true);
    try {
      await httpClient.patch(
        `/servers/${server.id}/permissions/${selectedRole}`,
        rolePermissions[selectedRole]
      );
      toast.success(t('server.permissionsSaved', `Permissões do cargo ${selectedRole} salvas com sucesso!`));
      realtimeClient.emit(RealtimeEvents.SERVER_UPDATED, { serverId: server.id });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao salvar permissões do cargo.');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      await httpClient.delete(`/servers/${server.id}/bans/${userId}`);
      toast.success(t('server.userUnbanned', 'Usuário desbanido com sucesso!'));
      setBans((prev) => prev.filter((b) => b.userId !== userId));
      realtimeClient.emit(RealtimeEvents.SERVER_UPDATED, { serverId: server.id });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao desbanir usuário.');
    }
  };

  const handleDeleteServer = async () => {
    if (deleteConfirmationText.trim().toLowerCase() !== server.name.trim().toLowerCase()) {
      toast.warning('Digite o nome exato do servidor para confirmar.');
      return;
    }

    setIsDeleting(true);
    try {
      await httpClient.delete(`${ApiRoutes.SERVERS}/${server.id}`);
      realtimeClient.emit(RealtimeEvents.SERVER_DELETED, { serverId: server.id });
      toast.success(t('server.serverDeleted', 'Servidor excluído com sucesso!'));
      onClose();
      if (onServerDeleted) {
        onServerDeleted();
      } else {
        onServerUpdated();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir servidor.');
    } finally {
      setIsDeleting(false);
    }
  };

  const currentRolePerms = rolePermissions[selectedRole];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.settingsModalContainer} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.settingsHeader}>
          <div className={styles.settingsHeaderLeft}>
            <div className={styles.settingsHeaderIcon}>
              <SettingsIcon size={20} />
            </div>
            <div>
              <h2 className={styles.settingsHeaderTitle}>
                {server.name}
              </h2>
              <div className={styles.settingsHeaderSubtitle}>
                {t('server.settingsSubtitle', 'Configurações e Moderação do Servidor')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.settingsCloseBtn}
            title={t('common.close', 'Fechar')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Layout */}
        <div className={styles.settingsBody}>
          {/* Sidebar */}
          <div className={styles.settingsSidebar}>
            <div className={styles.settingsSidebarNav}>
              <div className={styles.settingsSidebarSection}>
                {t('server.settingsSection', 'CONFIGURAÇÕES')}
              </div>

              <button
                type="button"
                className={`${styles.settingsTabBtn} ${activeTab === 'overview' ? styles.settingsTabBtnActive : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <SettingsIcon size={16} />
                <span>{t('server.tabOverview', 'Visão Geral')}</span>
              </button>

              <button
                type="button"
                className={`${styles.settingsTabBtn} ${activeTab === 'roles' ? styles.settingsTabBtnActive : ''}`}
                onClick={() => setActiveTab('roles')}
              >
                <Shield size={16} />
                <span>{t('server.tabModeration', 'Moderação & Cargos')}</span>
              </button>

              <button
                type="button"
                className={`${styles.settingsTabBtn} ${activeTab === 'bans' ? styles.settingsTabBtnActive : ''}`}
                onClick={() => setActiveTab('bans')}
              >
                <UserX size={16} />
                <span>{t('server.tabBans', 'Banimentos')}</span>
              </button>

              {isOwner && (
                <>
                  <div className={styles.settingsSidebarSection} style={{ marginTop: '0.75rem' }}>
                    {t('server.managementSection', 'GERENCIAMENTO')}
                  </div>
                  <button
                    type="button"
                    className={`${styles.settingsTabBtn} ${styles.settingsTabBtnDanger} ${activeTab === 'danger' ? styles.settingsTabBtnDangerActive : ''}`}
                    onClick={() => setActiveTab('danger')}
                  >
                    <Trash2 size={16} />
                    <span>{t('server.tabDanger', 'Excluir Servidor')}</span>
                  </button>
                </>
              )}
            </div>

            <div className={styles.settingsSidebarFooter}>
              <div className={styles.serverInfoPill}>
                <span className={styles.serverInfoLabel}>ID Servidor:</span>
                <span className={styles.serverInfoValue}>{server.id.substring(0, 8)}...</span>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className={styles.settingsContent}>
            {/* Header of Content */}
            <div className={styles.contentHeader}>
              <h3 className={styles.contentHeaderTitle}>
                {activeTab === 'overview' && t('server.overviewTitle', 'Visão Geral do Servidor')}
                {activeTab === 'roles' && t('server.rolesTitle', 'Moderação & Permissões por Cargo')}
                {activeTab === 'bans' && t('server.bansTitle', 'Usuários Banidos')}
                {activeTab === 'danger' && t('server.dangerTitle', 'Zona de Perigo')}
              </h3>
              <p className={styles.contentHeaderSubtitle}>
                {activeTab === 'overview' && t('server.overviewSubtitle', 'Atualize as informações públicas e o ícone de identificação deste servidor.')}
                {activeTab === 'roles' && t('server.rolesSubtitle', 'Configure permissões granulares para administradores, moderadores e membros padrão.')}
                {activeTab === 'bans' && t('server.bansSubtitle', 'Gerencie usuários que foram banidos deste servidor e revogue punições.')}
                {activeTab === 'danger' && t('server.dangerSubtitle', 'Ações destrutivas com soft delete que desativam o servidor para todos os membros.')}
              </p>
            </div>

        {/* TAB 1: VISÃO GERAL */}
        {activeTab === 'overview' && (
          <form onSubmit={handleSaveOverview} className={styles.inputGroup}>
            <div className={styles.iconUploadSection}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleIconChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <div
                className={styles.iconPreviewWrapper}
                onClick={() => fileInputRef.current?.click()}
                title={t('server.changeIcon', 'Alterar ícone do servidor')}
              >
                {getMediaUrl(iconPreview) && !iconError ? (
                  <img
                    src={getMediaUrl(iconPreview)}
                    alt="Ícone preview"
                    className={styles.iconPreviewImg}
                    onError={() => setIconError(true)}
                  />
                ) : (
                  <div className={styles.iconPlaceholder}>
                    <Camera size={24} />
                  </div>
                )}
                <div className={styles.iconOverlay}>
                  <ImageIcon size={20} />
                </div>
              </div>
              <span className={styles.iconUploadHint}>
                {t('server.iconChangeHint', 'Clique para alterar o ícone')}
              </span>
            </div>

            <label className={styles.label}>{t('server.serverName', 'Nome do Servidor')}</label>
            <input
              type="text"
              className={styles.input}
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder={t('server.serverNamePlaceholder', 'Ex: Comunidade Gamer')}
              disabled={isSaving}
            />

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onClose}
                disabled={isSaving}
              >
                {t('common.cancel', 'Cancelar')}
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={isSaving}
              >
                {isSaving ? <span className={styles.spinner} /> : <Check size={16} />}
                <span>{isSaving ? t('common.saving', 'Salvando...') : t('common.save', 'Salvar Alterações')}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: MODERAÇÃO & PERMISSÕES */}
        {activeTab === 'roles' && (
          <div className={styles.inputGroup}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                {t('server.moderationSubtitle', 'Configure as permissões de moderação para cada cargo do servidor:')}
              </span>
            </div>

            {/* Role selector tabs */}
            <div className={styles.roleSelector}>
              <button
                type="button"
                className={`${styles.roleBtn} ${selectedRole === 'ADMIN' ? styles.roleBtnActive : ''}`}
                onClick={() => setSelectedRole('ADMIN')}
              >
                🛡️ Administrador
              </button>
              <button
                type="button"
                className={`${styles.roleBtn} ${selectedRole === 'MODERATOR' ? styles.roleBtnActive : ''}`}
                onClick={() => setSelectedRole('MODERATOR')}
              >
                ⚔️ Moderador
              </button>
              <button
                type="button"
                className={`${styles.roleBtn} ${selectedRole === 'MEMBER' ? styles.roleBtnActive : ''}`}
                onClick={() => setSelectedRole('MEMBER')}
              >
                👤 Membro Padrão
              </button>
            </div>

            {/* Permissions list for selected role */}
            <div className={styles.permissionsList}>
              <div className={styles.permissionItem}>
                <div className={styles.permissionInfo}>
                  <span className={styles.permissionTitle}>Convidar Amigos</span>
                  <span className={styles.permissionDesc}>Permite adicionar ou convidar amigos para o servidor</span>
                </div>
                <input
                  type="checkbox"
                  checked={currentRolePerms.canInvite}
                  onChange={() => handleTogglePermission('canInvite')}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--brand-primary, #34d399)' }}
                />
              </div>

              <div className={styles.permissionItem}>
                <div className={styles.permissionInfo}>
                  <span className={styles.permissionTitle}>Excluir Mensagens</span>
                  <span className={styles.permissionDesc}>Permite apagar mensagens de outros usuários nos chats</span>
                </div>
                <input
                  type="checkbox"
                  checked={currentRolePerms.canDeleteMessages}
                  onChange={() => handleTogglePermission('canDeleteMessages')}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--brand-primary, #34d399)' }}
                />
              </div>

              <div className={styles.permissionItem}>
                <div className={styles.permissionInfo}>
                  <span className={styles.permissionTitle}>Expulsar Membros</span>
                  <span className={styles.permissionDesc}>Permite remover usuários do servidor</span>
                </div>
                <input
                  type="checkbox"
                  checked={currentRolePerms.canKickMembers}
                  onChange={() => handleTogglePermission('canKickMembers')}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--brand-primary, #34d399)' }}
                />
              </div>

              <div className={styles.permissionItem}>
                <div className={styles.permissionInfo}>
                  <span className={styles.permissionTitle}>Banir Membros</span>
                  <span className={styles.permissionDesc}>Permite banir permanentemente usuários deste servidor</span>
                </div>
                <input
                  type="checkbox"
                  checked={currentRolePerms.canBanMembers}
                  onChange={() => handleTogglePermission('canBanMembers')}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--brand-primary, #34d399)' }}
                />
              </div>

              <div className={styles.permissionItem}>
                <div className={styles.permissionInfo}>
                  <span className={styles.permissionTitle}>Gerenciar Canais</span>
                  <span className={styles.permissionDesc}>Permite criar, renomear e excluir canais de texto e voz</span>
                </div>
                <input
                  type="checkbox"
                  checked={currentRolePerms.canManageChannels}
                  onChange={() => handleTogglePermission('canManageChannels')}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--brand-primary, #34d399)' }}
                />
              </div>

              <div className={styles.permissionItem}>
                <div className={styles.permissionInfo}>
                  <span className={styles.permissionTitle}>Gerenciar Servidor</span>
                  <span className={styles.permissionDesc}>Permite alterar configurações e editar permissões</span>
                </div>
                <input
                  type="checkbox"
                  checked={currentRolePerms.canManageServer}
                  onChange={() => handleTogglePermission('canManageServer')}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--brand-primary, #34d399)' }}
                />
              </div>
            </div>

            <div className={styles.actions} style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className={styles.submitButton}
                onClick={handleSaveRolePermissions}
                disabled={isSavingPermissions}
              >
                {isSavingPermissions ? <span className={styles.spinner} /> : <Check size={16} />}
                <span>Salvar Permissões de {selectedRole}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: BANIMENTOS */}
        {activeTab === 'bans' && (
          <div className={styles.inputGroup}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Usuários banidos não podem reentrar no servidor mesmo com link de convite.
            </span>

            {isLoadingBans ? (
              <div className={styles.emptyFriends} style={{ padding: '2.5rem 1rem' }}>
                <span>Carregando banimentos...</span>
              </div>
            ) : bans.length === 0 ? (
              <div className={styles.emptyFriends} style={{ padding: '2.5rem 1rem' }}>
                <UserX size={36} color="#64748b" style={{ margin: '0 auto 10px', opacity: 0.6 }} />
                <span>Nenhum usuário banido neste servidor.</span>
              </div>
            ) : (
              <div className={styles.friendsList} style={{ maxHeight: 'none' }}>
                {bans.map((ban) => (
                  <div key={ban.id} className={styles.banItem}>
                    <div className={styles.friendItemLeft}>
                      <div className={styles.friendAvatar}>
                        {getMediaUrl(ban.user?.avatarUrl) ? (
                          <img
                            src={getMediaUrl(ban.user?.avatarUrl)}
                            alt={ban.user?.displayName || ban.user?.username}
                            className={styles.friendAvatarImg}
                          />
                        ) : (
                          <span>{(ban.user?.displayName || ban.user?.username || 'U').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className={styles.friendNames}>
                        <span className={styles.friendDisplayName}>
                          {ban.user?.displayName || ban.user?.username}
                        </span>
                        <span className={styles.friendUsername}>
                          @{ban.user?.username} {ban.reason ? `• Motivo: ${ban.reason}` : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.unbanBtn}
                      onClick={() => handleUnbanUser(ban.userId)}
                    >
                      Desbanir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ZONA DE PERIGO (SOFT DELETE) */}
        {activeTab === 'danger' && isOwner && (
          <div className={styles.inputGroup}>
            <div className={styles.dangerCard}>
              <div className={styles.dangerTitle}>
                <Trash2 size={18} />
                <span>Excluir Servidor</span>
              </div>
              <p className={styles.dangerDesc}>
                Excluir este servidor desativará imediatamente o acesso de todos os membros e canais (soft delete).
                Essa ação é irreversível para os membros comuns.
              </p>

              {!showDeleteConfirm ? (
                <button
                  type="button"
                  className={styles.deleteServerBtn}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={16} />
                  <span>Excluir este Servidor</span>
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', color: '#fca5a5', fontWeight: 600 }}>
                    Para confirmar a exclusão, digite o nome do servidor:{' '}
                    <span style={{ color: '#ffffff', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4 }}>
                      {server.name}
                    </span>
                  </label>
                  <input
                    type="text"
                    className={styles.input}
                    value={deleteConfirmationText}
                    onChange={(e) => setDeleteConfirmationText(e.target.value)}
                    placeholder={server.name}
                    style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className={styles.cancelButton}
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmationText('');
                      }}
                      disabled={isDeleting}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className={styles.deleteServerBtn}
                      onClick={handleDeleteServer}
                      disabled={isDeleting || deleteConfirmationText.trim().toLowerCase() !== server.name.trim().toLowerCase()}
                    >
                      {isDeleting ? <span className={styles.spinner} /> : <Trash2 size={16} />}
                      <span>{isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
};
