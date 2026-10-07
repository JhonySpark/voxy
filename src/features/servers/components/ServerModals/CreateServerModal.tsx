import React, { useState, useRef, useEffect } from 'react';
import styles from './CreateServerModal.module.css';
import {
  Camera,
  Compass,
  Plus,
  Sparkles,
  Link2,
  X,
  Clipboard,
  ArrowRight,
  CheckCircle2,
  Volume2,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { ApiRoutes } from '../../../../core/enums';
import type { ServerItem } from '../ServerSidebar/ServerSidebar';

type ModalTab = 'CREATE' | 'JOIN';

interface CreateServerModalProps {
  isOpen: boolean;
  serverId?: string;
  initialTab?: ModalTab;
  onClose: () => void;
  onServerCreated: () => void;
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  initialTab = 'CREATE',
  onClose,
  onServerCreated,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);
  const [serverName, setServerName] = useState('');
  const [is18Plus, setIs18Plus] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Reseta o estado quando o modal abre
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    } else {
      setServerName('');
      setInviteCode('');
      setIs18Plus(false);
      setIconFile(null);
      if (iconPreview) {
        URL.revokeObjectURL(iconPreview);
      }
      setIconPreview(null);
    }
  }, [isOpen, initialTab]);

  // Tecla Escape para fechar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isCreating && !isJoining) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isCreating, isJoining, onClose]);

  if (!isOpen) return null;

  const handleProcessFile = (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('user.invalidImageType', 'Por favor, selecione uma imagem válida (PNG, JPG, WebP).'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('O ícone não pode exceder 5MB.');
      return;
    }

    if (iconPreview) {
      URL.revokeObjectURL(iconPreview);
    }

    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleProcessFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleProcessFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemoveIcon = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (iconPreview) {
      URL.revokeObjectURL(iconPreview);
    }
    setIconFile(null);
    setIconPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePasteInviteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const cleaned = extractInviteCode(text);
        setInviteCode(cleaned);
        toast.info('Código colado com sucesso!');
      }
    } catch {
      // Ignora erro de permissão do navegador
    }
  };

  const extractInviteCode = (raw: string): string => {
    const trimmed = raw.trim();
    // Se for URL completa, extrai a última parte
    const match = trimmed.match(/(?:invite\/|servers\/)?([a-zA-Z0-9_-]{5,50})$/);
    if (match && match[1]) {
      return match[1];
    }
    return trimmed;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = serverName.trim();
    if (!trimmed) {
      toast.warning(t('server.serverNamePlaceholder', 'Dê um nome ao seu servidor'));
      return;
    }

    setIsCreating(true);
    try {
      const newServer = await httpClient.post<ServerItem>(ApiRoutes.SERVERS, {
        name: trimmed,
        is18Plus,
      });

      if (iconFile && newServer?.id) {
        const formData = new FormData();
        formData.append('file', iconFile);
        await httpClient.post(`/storage/server/${newServer.id}/icon`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast.success(t('server.createdSuccess', { name: trimmed }));
      onClose();
      onServerCreated();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('server.invalidInvite', 'Erro ao criar servidor.'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = extractInviteCode(inviteCode);
    if (!cleaned) {
      toast.warning(t('server.joinServerPlaceholder', 'Insira um código de convite válido'));
      return;
    }

    setIsJoining(true);
    try {
      await httpClient.post(ApiRoutes.SERVERS_JOIN, { inviteCode: cleaned });
      toast.success(t('server.joinedSuccess', 'Você entrou no servidor com sucesso!'));
      onClose();
      onServerCreated();
    } catch (err: any) {
      toast.error(err.response?.data?.message || t('server.invalidInvite', 'Código de convite inválido ou expirado.'));
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.glowEffect} />

        {/* Botão de Fechar */}
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          disabled={isCreating || isJoining}
          title={t('common.close', 'Fechar')}
        >
          <X size={18} />
        </button>

        {/* Barra de Abas (Criar vs Entrar) */}
        <div className={styles.tabBar}>
          <button
            type="button"
            className={`${styles.tabItem} ${activeTab === 'CREATE' ? styles.tabItemActive : ''}`}
            onClick={() => setActiveTab('CREATE')}
            disabled={isCreating || isJoining}
          >
            <Plus size={16} />
            <span>{t('server.createServer', 'Criar Servidor')}</span>
          </button>
          <button
            type="button"
            className={`${styles.tabItem} ${activeTab === 'JOIN' ? styles.tabItemActive : ''}`}
            onClick={() => setActiveTab('JOIN')}
            disabled={isCreating || isJoining}
          >
            <Compass size={16} />
            <span>{t('server.joinServer', 'Entrar em um')}</span>
          </button>
        </div>

        {/* Conteúdo: CRIAR SERVIDOR */}
        {activeTab === 'CREATE' && (
          <form onSubmit={handleCreate} className={styles.contentArea}>
            <div className={styles.headerSection}>
              <h2 className={styles.title}>{t('server.createServerTitle', 'Crie o seu espaço')}</h2>
              <p className={styles.subtitle}>
                {t(
                  'server.createServerSubtitle',
                  'Seu servidor é onde você e seus amigos se reúnem em chamadas de voz e texto de alta fidelidade.'
                )}
              </p>
            </div>

            {/* Seletor de Ícone com Drag & Drop */}
            <div className={styles.uploadSection}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleIconChange}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <div
                className={styles.avatarWrapper}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                title={t('server.uploadIcon', 'Escolher ícone do servidor')}
                style={{ transform: isDragging ? 'scale(1.06)' : undefined }}
              >
                <div className={styles.avatarRing}>
                  {iconPreview ? (
                    <>
                      <img src={iconPreview} alt="Ícone preview" className={styles.avatarImage} />
                      <div className={styles.avatarHoverOverlay}>
                        <Camera size={20} />
                        <span>Trocar</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Camera size={26} />
                    </>
                  )}
                </div>
                <div className={styles.avatarBadge}>
                  <Plus size={16} strokeWidth={2.5} />
                </div>
              </div>

              {iconPreview ? (
                <button
                  type="button"
                  className={styles.removeIconBtn}
                  onClick={handleRemoveIcon}
                >
                  Remover foto
                </button>
              ) : (
                <span className={styles.uploadHint}>
                  {t('server.iconHint', 'Ícone opcional (PNG, JPG até 5MB)')}
                </span>
              )}
            </div>

            {/* Nome do Servidor */}
            <div className={styles.formGroup}>
              <div className={styles.labelWrapper}>
                <label className={styles.label}>{t('server.serverName', 'NOME DO SERVIDOR')}</label>
                <span className={styles.charCount}>{serverName.length}/50</span>
              </div>
              <div className={styles.inputContainer}>
                <input
                  type="text"
                  className={styles.textInput}
                  value={serverName}
                  maxLength={50}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder={t('server.serverNamePlaceholder', 'ex: Servidor dos Amigos, Clube Gamer...')}
                  autoFocus
                  disabled={isCreating}
                />
              </div>
            </div>

            {/* Switch de Conteúdo +18 */}
            <div
              className={`${styles.safetyCard} ${is18Plus ? styles.safetyCardActive : ''}`}
              onClick={() => !isCreating && setIs18Plus(!is18Plus)}
            >
              <div className={styles.safetyCardLeft}>
                <span className={`${styles.ageBadge} ${is18Plus ? styles.ageBadgeActive : ''}`}>
                  18+
                </span>
                <div>
                  <div className={styles.safetyTitle}>Restrito para maiores (+18)</div>
                  <div className={styles.safetySubtitle}>
                    Exige confirmação de maioridade e segue as diretrizes da ANPD/ECA.
                  </div>
                </div>
              </div>
              <div className={`${styles.switchTrack} ${is18Plus ? styles.switchTrackActive : ''}`}>
                <div className={styles.switchThumb} />
              </div>
            </div>

            {/* Botões de Ação */}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={isCreating}
              >
                {t('common.cancel', 'Cancelar')}
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={isCreating || !serverName.trim()}
              >
                {isCreating ? (
                  <span className={styles.spinner} />
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>{t('server.createServerButton', 'Criar Servidor')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Conteúdo: ENTRAR EM SERVIDOR */}
        {activeTab === 'JOIN' && (
          <form onSubmit={handleJoin} className={styles.contentArea}>
            <div className={styles.headerSection}>
              <div className={styles.heroIconBadge}>
                <Compass size={24} />
              </div>
              <h2 className={styles.title}>{t('server.joinServerTitle', 'Junte-se a uma comunidade')}</h2>
              <p className={styles.subtitle}>
                {t(
                  'server.joinServerSubtitle',
                  'Informe o código de convite ou link compartilhado por um amigo para entrar no servidor.'
                )}
              </p>
            </div>

            {/* Input do Código de Convite */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                {t('server.inviteCodeLabel', 'CÓDIGO DE CONVITE OU LINK')}
              </label>
              <div className={styles.inputContainer}>
                <Link2 size={16} className={styles.inputIcon} />
                <input
                  type="text"
                  className={`${styles.textInput} ${styles.inputWithIcon}`}
                  placeholder={t('server.joinServerPlaceholder', 'ex: 7X8K2M ou voxy.gg/7X8K2M')}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  autoFocus
                  disabled={isJoining}
                />
                <button
                  type="button"
                  className={styles.pasteButton}
                  onClick={handlePasteInviteCode}
                  title="Colar da área de transferência"
                >
                  <Clipboard size={13} />
                  <span>Colar</span>
                </button>
              </div>
            </div>

            {/* Card com Dicas e Benefícios */}
            <div className={styles.infoCard}>
              <div className={styles.infoItem}>
                <CheckCircle2 size={15} />
                <span>Entrada instantânea sem aprovação pendente</span>
              </div>
              <div className={styles.infoItem}>
                <Volume2 size={15} />
                <span>Salas de voz ilimitadas com baixa latência</span>
              </div>
              <div className={styles.infoItem}>
                <Users size={15} />
                <span>Canais de texto e compartilhamento integrados</span>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={isJoining}
              >
                {t('common.cancel', 'Cancelar')}
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={isJoining || !inviteCode.trim()}
              >
                {isJoining ? (
                  <span className={styles.spinner} />
                ) : (
                  <>
                    <span>{t('server.joinServerButton', 'Entrar no Servidor')}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
