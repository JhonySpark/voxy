import React, { useState, useEffect } from 'react';
import styles from './Modals.module.css';
import { useTranslation } from 'react-i18next';
import { Globe, Lock, Check, Crown, Shield, ShieldAlert, User, Users, Volume2, X, Trash2 } from 'lucide-react';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { ApiRoutes, ChannelTypeEnum, ServerRoleEnum } from '../../../../core/enums';
import type { ChannelItem } from '../ServerSidebar/ServerSidebar';
import { CHANNEL_ICON_OPTIONS, ChannelTextIcon } from '../../utils/channelIcons';

interface ChannelSettingsModalProps {
  isOpen: boolean;
  channel: ChannelItem | null;
  onClose: () => void;
  onChannelUpdated: () => void;
  onChannelSocketEmit?: () => void;
  onDeleteChannel?: (channel: ChannelItem) => void;
}

const SELECTABLE_ROLES = [
  {
    role: ServerRoleEnum.ADMIN,
    labelKey: 'server.roles.admin',
    defaultLabel: 'Administrador',
    descKey: 'channel.settings.roleAdminDesc',
    defaultDesc: 'Gestores e administradores do servidor',
    Icon: ShieldAlert,
    color: '#f59e0b',
  },
  {
    role: ServerRoleEnum.MODERATOR,
    labelKey: 'server.roles.moderator',
    defaultLabel: 'Moderador',
    descKey: 'channel.settings.roleModeratorDesc',
    defaultDesc: 'Equipe de moderação do servidor',
    Icon: Shield,
    color: '#3b82f6',
  },
  {
    role: ServerRoleEnum.MEMBER,
    labelKey: 'server.roles.member',
    defaultLabel: 'Membro',
    descKey: 'channel.settings.roleMemberDesc',
    defaultDesc: 'Todos os membros comuns do servidor',
    Icon: User,
    color: '#94a3b8',
  },
];

const USER_LIMIT_PRESETS = [0, 2, 4, 5, 10, 25, 50, 99];

export const ChannelSettingsModal: React.FC<ChannelSettingsModalProps> = ({
  isOpen,
  channel,
  onClose,
  onChannelUpdated,
  onChannelSocketEmit,
  onDeleteChannel,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('hash');
  const [isRestricted, setIsRestricted] = useState(false);
  const [allowedRoles, setAllowedRoles] = useState<string[]>([
    ServerRoleEnum.ADMIN,
    ServerRoleEnum.MODERATOR,
  ]);
  const [userLimit, setUserLimit] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (channel && isOpen) {
      setName(channel.name || '');
      setIcon(channel.icon || 'hash');
      setIsRestricted(Boolean(channel.isRestricted));
      setAllowedRoles(
        Array.isArray(channel.allowedRoles) && channel.allowedRoles.length > 0
          ? channel.allowedRoles
          : [ServerRoleEnum.ADMIN, ServerRoleEnum.MODERATOR],
      );
      setUserLimit(typeof channel.userLimit === 'number' ? channel.userLimit : 0);
    }
  }, [channel, isOpen]);

  if (!isOpen || !channel) return null;

  const isTextChannel = channel.type === ChannelTypeEnum.TEXT;

  const handleToggleRole = (role: string) => {
    setAllowedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.warning(t('channel.channelNamePlaceholder'), t('channel.channelName'));
      return;
    }

    setIsSaving(true);
    try {
      await httpClient.patch(
        `${ApiRoutes.CHANNELS}/${channel.id}`,
        isTextChannel
          ? {
              name: trimmed,
              icon,
              isRestricted,
              allowedRoles: isRestricted ? allowedRoles : [],
            }
          : {
              name: trimmed,
              userLimit,
            },
      );
      toast.success(t('channel.settings.savedSuccess', 'Configurações do canal atualizadas!'));
      onChannelUpdated();
      if (onChannelSocketEmit) onChannelSocketEmit();
      onClose();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          t('channel.settings.saveFailed', 'Não foi possível salvar as configurações do canal.'),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.channelSettingsModal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.channelModalHeader}>
          <div className={styles.channelModalTitleGroup}>
            <div className={styles.channelModalIconPreview}>
              {isTextChannel ? (
                <ChannelTextIcon icon={icon} size={20} />
              ) : (
                <Volume2 size={20} />
              )}
            </div>
            <div>
              <h2 className={styles.title}>
                {t('channel.settings.title', 'Configurações do Canal')}
              </h2>
              <p className={styles.channelModalSubtitle}>
                {isTextChannel
                  ? t('channel.typeText', 'Canal de Texto')
                  : t('channel.typeVoice', 'Canal de Voz')}{' '}
                • {isTextChannel ? `#${channel.name}` : channel.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            disabled={isSaving}
            aria-label={t('common.close', 'Fechar')}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.inputGroup} style={{ gap: '1.1rem' }}>
          {/* Nome do Canal */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('channel.channelName', 'Nome do Canal')}</label>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('channel.channelNamePlaceholder', 'ex: chat-geral')}
              maxLength={50}
              disabled={isSaving}
              autoFocus
            />
          </div>

          {isTextChannel ? (
            <>
              {/* Seletor de Ícone (Apenas para Canais de Texto) */}
              <div className={styles.inputGroup}>
                <label className={styles.label}>
                  {t('channel.settings.iconLabel', 'Ícone do Canal')}
                </label>
                <div className={styles.iconGrid}>
                  {CHANNEL_ICON_OPTIONS.map((option) => {
                    const isSelected = icon === option.id;
                    const IconComp = option.Icon;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`${styles.iconOptionBtn} ${
                          isSelected ? styles.iconOptionBtnActive : ''
                        }`}
                        onClick={() => setIcon(option.id)}
                        disabled={isSaving}
                      >
                        <IconComp size={18} />
                        <span className={styles.iconOptionLabel}>
                          {t(option.labelKey, option.defaultLabel)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Permissões de Escrita (Apenas para Canais de Texto) */}
              <div className={styles.inputGroup}>
                <label className={styles.label}>
                  {t('channel.settings.writePermissionLabel', 'Quem pode escrever neste canal')}
                </label>
                <div className={styles.permissionModeList}>
                  <button
                    type="button"
                    className={`${styles.permissionModeCard} ${
                      !isRestricted ? styles.permissionModeCardActive : ''
                    }`}
                    onClick={() => setIsRestricted(false)}
                    disabled={isSaving}
                  >
                    <div className={styles.permissionModeHeader}>
                      <Globe size={16} />
                      <span>{t('channel.settings.publicMode', 'Público')}</span>
                    </div>
                    <span className={styles.permissionModeDesc}>
                      {t(
                        'channel.settings.publicModeDesc',
                        'Todos os membros do servidor podem enviar mensagens.',
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.permissionModeCard} ${
                      isRestricted ? styles.permissionModeCardActive : ''
                    }`}
                    onClick={() => setIsRestricted(true)}
                    disabled={isSaving}
                  >
                    <div className={styles.permissionModeHeader}>
                      <Lock size={16} />
                      <span>{t('channel.settings.restrictedMode', 'Cargos selecionados')}</span>
                    </div>
                    <span className={styles.permissionModeDesc}>
                      {t(
                        'channel.settings.restrictedModeDesc',
                        'Apenas os cargos marcados abaixo podem escrever.',
                      )}
                    </span>
                  </button>
                </div>

                {isRestricted && (
                  <div className={styles.allowedRolesBox}>
                    {/* Proprietário sempre permitido */}
                    <div className={`${styles.allowedRoleRow} ${styles.allowedRoleRowDisabled}`}>
                      <div className={styles.allowedRoleInfo}>
                        <Crown size={16} color="#fbbf24" />
                        <div>
                          <div className={styles.allowedRoleTitle}>
                            {t('server.roles.owner', 'Proprietário / Líder')}
                          </div>
                          <div className={styles.allowedRoleSubtitle}>
                            {t(
                              'channel.settings.roleOwnerAlwaysAllowed',
                              'Sempre possui permissão total no servidor',
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={`${styles.roleCheckbox} ${styles.roleCheckboxChecked}`}>
                        <Check size={13} strokeWidth={3} />
                      </div>
                    </div>

                    {/* Cargos selecionáveis */}
                    {SELECTABLE_ROLES.map((item) => {
                      const isChecked = allowedRoles.includes(item.role);
                      const RoleIcon = item.Icon;
                      return (
                        <div
                          key={item.role}
                          className={`${styles.allowedRoleRow} ${
                            isChecked ? styles.allowedRoleRowActive : ''
                          }`}
                          onClick={() => !isSaving && handleToggleRole(item.role)}
                        >
                          <div className={styles.allowedRoleInfo}>
                            <RoleIcon size={16} color={item.color} />
                            <div>
                              <div className={styles.allowedRoleTitle}>
                                {t(item.labelKey, item.defaultLabel)}
                              </div>
                              <div className={styles.allowedRoleSubtitle}>
                                {t(item.descKey, item.defaultDesc)}
                              </div>
                            </div>
                          </div>
                          <div
                            className={`${styles.roleCheckbox} ${
                              isChecked ? styles.roleCheckboxChecked : ''
                            }`}
                          >
                            {isChecked && <Check size={13} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Limite de Usuários (Apenas para Canais de Voz) */
            <div className={styles.inputGroup}>
              <div className={styles.userLimitHeader}>
                <label className={styles.label}>
                  {t('channel.settings.userLimitLabel', 'Limite de Usuários na Call')}
                </label>
                <span className={styles.userLimitValueBadge}>
                  <Users size={13} />
                  {userLimit === 0
                    ? `∞ ${t('channel.settings.noLimit', 'Sem limite')}`
                    : `${userLimit} ${
                        userLimit === 1
                          ? t('channel.settings.userSingular', 'usuário')
                          : t('channel.settings.userPlural', 'usuários')
                      }`}
                </span>
              </div>

              <div className={styles.userLimitBox}>
                <span className={styles.userLimitDesc}>
                  {t(
                    'channel.settings.userLimitDesc',
                    'Define o número máximo de participantes que podem entrar simultaneamente neste canal de voz.',
                  )}
                </span>

                <input
                  type="range"
                  min={0}
                  max={99}
                  step={1}
                  value={userLimit}
                  onChange={(e) => setUserLimit(parseInt(e.target.value, 10))}
                  className={styles.userLimitSlider}
                  disabled={isSaving}
                />

                <div className={styles.userLimitPresets}>
                  {USER_LIMIT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`${styles.userLimitPresetBtn} ${
                        userLimit === preset ? styles.userLimitPresetBtnActive : ''
                      }`}
                      onClick={() => setUserLimit(preset)}
                      disabled={isSaving}
                    >
                      {preset === 0 ? `∞ ${t('channel.settings.noLimit', 'Sem limite')}` : preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className={styles.actions} style={{ justifyContent: 'space-between', marginTop: '0.5rem' }}>
            {onDeleteChannel ? (
              <button
                type="button"
                className={styles.cancelButton}
                style={{
                  color: '#f87171',
                  borderColor: 'rgba(239, 68, 68, 0.25)',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
                onClick={() => {
                  onClose();
                  onDeleteChannel(channel);
                }}
                disabled={isSaving}
              >
                <Trash2 size={15} />
                <span>{t('channel.deleteChannel', 'Excluir canal')}</span>
              </button>
            ) : (
              <div />
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={onClose}
                disabled={isSaving}
              >
                {t('common.cancel', 'Cancelar')}
              </button>
              <button type="submit" className={styles.submitButton} disabled={isSaving}>
                {isSaving && <span className={styles.spinner} />}
                <span>{t('common.saveChanges', 'Salvar Alterações')}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
