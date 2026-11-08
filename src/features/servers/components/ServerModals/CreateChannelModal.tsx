import React, { useState, useEffect } from 'react';
import styles from './Modals.module.css';
import { useTranslation } from 'react-i18next';
import {
  Hash,
  Volume2,
  X,
  Plus,
  Globe,
  Lock,
  Check,
  Crown,
  Shield,
  ShieldAlert,
  User,
  Users,
} from 'lucide-react';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { ApiRoutes, ChannelTypeEnum, ServerRoleEnum } from '../../../../core/enums';
import { CHANNEL_ICON_OPTIONS, ChannelTextIcon } from '../../utils/channelIcons';

interface CreateChannelModalProps {
  isOpen: boolean;
  serverId: string;
  onClose: () => void;
  onChannelCreated: () => void;
  onChannelSocketEmit?: () => void;
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

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  serverId,
  onClose,
  onChannelCreated,
  onChannelSocketEmit,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [channelName, setChannelName] = useState('');
  const [channelType, setChannelType] = useState<ChannelTypeEnum>(ChannelTypeEnum.TEXT);
  const [icon, setIcon] = useState<string>('hash');
  const [isRestricted, setIsRestricted] = useState<boolean>(false);
  const [allowedRoles, setAllowedRoles] = useState<string[]>([
    ServerRoleEnum.ADMIN,
    ServerRoleEnum.MODERATOR,
  ]);
  const [userLimit, setUserLimit] = useState<number>(0);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setChannelName('');
      setChannelType(ChannelTypeEnum.TEXT);
      setIcon('hash');
      setIsRestricted(false);
      setAllowedRoles([ServerRoleEnum.ADMIN, ServerRoleEnum.MODERATOR]);
      setUserLimit(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isTextChannel = channelType === ChannelTypeEnum.TEXT;

  const handleToggleRole = (role: string) => {
    setAllowedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = channelName.trim();
    if (!trimmed) {
      toast.warning(t('channel.channelNamePlaceholder'), t('channel.channelName'));
      return;
    }

    setIsCreating(true);
    try {
      await httpClient.post(
        `${ApiRoutes.CHANNELS}/${serverId}`,
        isTextChannel
          ? {
              name: trimmed,
              type: channelType,
              icon,
              isRestricted,
              allowedRoles: isRestricted ? allowedRoles : [],
            }
          : {
              name: trimmed,
              type: channelType,
              userLimit,
            },
      );
      toast.success(t('channel.createdSuccess', { name: trimmed }));
      setChannelName('');
      onClose();
      onChannelCreated();
      if (onChannelSocketEmit) onChannelSocketEmit();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('channel.createFailed', 'Não foi possível criar o canal.'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={() => !isCreating && onClose()}>
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
              <h2 className={styles.title}>{t('channel.createChannel')}</h2>
              <p className={styles.channelModalSubtitle}>
                {t(
                  'channel.createChannelSubtitle',
                  'Escolha o tipo e personalize o novo canal do servidor',
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            disabled={isCreating}
            aria-label={t('common.close', 'Fechar')}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.inputGroup} style={{ gap: '1.1rem' }}>
          {/* Tipo de Canal (Cards Interativos) */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('channel.channelType')}</label>
            <div className={styles.typeSelectorGrid}>
              <button
                type="button"
                className={`${styles.typeCard} ${
                  isTextChannel ? styles.typeCardActive : ''
                }`}
                onClick={() => setChannelType(ChannelTypeEnum.TEXT)}
                disabled={isCreating}
              >
                <div className={styles.typeCardIconBox}>
                  <Hash size={18} />
                </div>
                <div className={styles.typeCardBody}>
                  <span className={styles.typeCardTitle}>
                    {t('channel.typeTextCardTitle', 'Canal de Texto')}
                  </span>
                  <span className={styles.typeCardDesc}>
                    {t(
                      'channel.typeTextCardDesc',
                      'Envie mensagens, imagens, áudios e reações em tempo real.',
                    )}
                  </span>
                </div>
              </button>

              <button
                type="button"
                className={`${styles.typeCard} ${
                  !isTextChannel ? styles.typeCardActive : ''
                }`}
                onClick={() => setChannelType(ChannelTypeEnum.VOICE)}
                disabled={isCreating}
              >
                <div className={styles.typeCardIconBox}>
                  <Volume2 size={18} />
                </div>
                <div className={styles.typeCardBody}>
                  <span className={styles.typeCardTitle}>
                    {t('channel.typeVoiceCardTitle', 'Canal de Voz')}
                  </span>
                  <span className={styles.typeCardDesc}>
                    {t(
                      'channel.typeVoiceCardDesc',
                      'Converse por voz com baixa latência e compartilhe a tela.',
                    )}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Nome do Canal com Prefixo Dinâmico */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>{t('channel.channelName')}</label>
            <div className={styles.channelNameInputWrapper}>
              <span className={styles.channelNamePrefix}>
                {isTextChannel ? (
                  <ChannelTextIcon icon={icon} size={16} />
                ) : (
                  <Volume2 size={16} />
                )}
              </span>
              <input
                type="text"
                className={styles.channelNameField}
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder={
                  isTextChannel
                    ? t('channel.channelNamePlaceholder', 'ex: bate-papo')
                    : t('channel.voiceNamePlaceholder', 'ex: Sala de Jogos')
                }
                maxLength={50}
                autoFocus
                disabled={isCreating}
              />
              <span className={styles.channelNameCounter}>
                {channelName.length}/50
              </span>
            </div>
          </div>

          {isTextChannel ? (
            <>
              {/* Seletor de Ícone (Canais de Texto) */}
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
                        disabled={isCreating}
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

              {/* Permissões de Escrita (Canais de Texto) */}
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
                    disabled={isCreating}
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
                    disabled={isCreating}
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

                    {SELECTABLE_ROLES.map((item) => {
                      const isChecked = allowedRoles.includes(item.role);
                      const RoleIcon = item.Icon;
                      return (
                        <div
                          key={item.role}
                          className={`${styles.allowedRoleRow} ${
                            isChecked ? styles.allowedRoleRowActive : ''
                          }`}
                          onClick={() => !isCreating && handleToggleRole(item.role)}
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
            /* Limite de Usuários (Canais de Voz) */
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
                  disabled={isCreating}
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
                      disabled={isCreating}
                    >
                      {preset === 0 ? `∞ ${t('channel.settings.noLimit', 'Sem limite')}` : preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className={styles.actions} style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onClose}
              disabled={isCreating}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isCreating}
            >
              {isCreating ? (
                <span className={styles.spinner} />
              ) : (
                <Plus size={16} />
              )}
              <span>{t('channel.createChannel')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
