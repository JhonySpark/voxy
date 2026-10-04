import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ChatArea.module.css';
import { 
  Hash, Send, Mic, Paperclip, Smile, Trash2, Loader2, Users, User, UserMinus, 
  Ban, MoreVertical, Reply, X, FileText, Pencil 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FriendUser } from '../../../friends/components/FriendsSidebar/FriendsSidebar';
import type { ChannelItem } from '../../../servers/components/ServerSidebar/ServerSidebar';
import { AttachmentRenderer } from '../AttachmentRenderer/AttachmentRenderer';
import { EmojiPicker } from '../EmojiPicker/EmojiPicker';
import { QuickReactionPicker } from '../QuickReactionPicker/QuickReactionPicker';
import { MessageReactionsModal } from '../MessageReactionsModal/MessageReactionsModal';
import { StorageUploadService } from '../../services/storageUpload.service';
import { AudioRecorderService } from '../../services/audioRecorder.service';
import { UserStatusEnum } from '../../../../core/enums';
import { StatusDot } from '../../../../components/common/StatusDot/StatusDot';
import { getMediaUrl } from '../../../../core/utils/media.util';
import { useToast } from '../../../../components/common/Toast/ToastContext';
import { useDialog } from '../../../../components/common/Dialog/DialogContext';

export interface ChatAttachment {
  id: string;
  fileName: string;
  fileKey: string;
  thumbnailKey?: string;
  fileType: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT';
  mimeType: string;
  fileSize: number;
  url?: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
}

export interface ChatReaction {
  id: string;
  emoji: string;
  userId: string;
  createdAt?: string;
  user?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  receiverId?: string;
  channelId?: string;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    content: string;
    senderId: string;
    sender?: {
      id: string;
      username: string;
      email?: string;
      avatarUrl?: string | null;
      displayName?: string | null;
    } | null;
    attachments?: ChatAttachment[];
  } | null;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  sender?: {
    id: string;
    username: string;
    email: string;
    avatarUrl?: string | null;
    displayName?: string | null;
  };
  attachments?: ChatAttachment[];
  reactions?: ChatReaction[];
}

interface ChatAreaProps {
  type: 'DM' | 'CHANNEL';
  target: FriendUser | ChannelItem;
  myId: string;
  messages: ChatMessage[];
  newMessage: string;
  onNewMessageChange: (val: string) => void;
  onSendMessage: (e?: React.FormEvent, options?: { replyToId?: string; replyTo?: ChatMessage | null }) => void;
  onSendAttachment?: (attachmentId: string, customContent?: string, replyToId?: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void | Promise<void>;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  isLoading?: boolean;
  onOpenUserProfile?: (userId: string) => void;
  onToggleMembersList?: () => void;
  isMembersListOpen?: boolean;
  canDeleteAnyMessage?: boolean;
  onDeleteMessage?: (messageId: string) => void;
  targetStatus?: UserStatusEnum | string;
  onRemoveFriend?: (userId: string) => void;
  onBlockUser?: (userId: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  type,
  target,
  myId,
  messages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  onSendAttachment,
  onEditMessage,
  onToggleReaction,
  isLoading = false,
  onOpenUserProfile,
  onToggleMembersList,
  isMembersListOpen = false,
  canDeleteAnyMessage = false,
  onDeleteMessage,
  targetStatus,
  onRemoveFriend,
  onBlockUser,
}) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { confirm } = useDialog();
  const messagesListRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Estados de Upload e Gravação
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioVolume, setAudioVolume] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDmMenu, setShowDmMenu] = useState(false);
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
  const audioRecorderRef = useRef<AudioRecorderService | null>(null);
  const recordingTimerRef = useRef<any>(null);

  // Estados de Resposta e Anexo Estagiado
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [stagedAttachment, setStagedAttachment] = useState<{
    file: File;
    previewUrl: string;
    name: string;
    size: number;
    isImage: boolean;
  } | null>(null);

  // Estados de Edição de Mensagem
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');

  // Menu de Ações da Mensagem (Dropdown)
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);

  // Estados de Reações com Emoji
  const [activeQuickReactionMsgId, setActiveQuickReactionMsgId] = useState<string | null>(null);
  const [activeFullReactionMsgId, setActiveFullReactionMsgId] = useState<string | null>(null);
  const [reactionAnchorRect, setReactionAnchorRect] = useState<DOMRect | null>(null);
  const [viewingReactionsMsg, setViewingReactionsMsg] = useState<ChatMessage | null>(null);

  const getFullPickerStyle = (rect: DOMRect): React.CSSProperties => {
    const pickerWidth = 320;
    const pickerHeight = 400;
    const PADDING = 12;

    let left = rect.left + rect.width / 2 - pickerWidth / 2;
    if (left < PADDING) left = PADDING;
    if (left + pickerWidth > window.innerWidth - PADDING) {
      left = window.innerWidth - pickerWidth - PADDING;
    }

    let top = rect.top - pickerHeight - 8;
    if (top < PADDING) {
      top = rect.bottom + 8;
      if (top + pickerHeight > window.innerHeight - PADDING) {
        top = window.innerHeight - pickerHeight - PADDING;
      }
    }

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 99999,
    };
  };

  const handleStartEditing = (msg: ChatMessage) => {
    setEditingMessageId(msg.id);
    setEditingContent(msg.content);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const handleCancelEditing = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleSaveEditing = async (messageId: string) => {
    const trimmed = editingContent.trim();
    if (!trimmed || !onEditMessage) return;
    await onEditMessage(messageId, trimmed);
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleSelectEmoji = (emoji: string) => {
    onNewMessageChange(newMessage + emoji);
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Ao trocar de conversa/canal: scroll imediato e limpa estados temporários
  useEffect(() => {
    setShowEmojiPicker(false);
    if (isRecording) {
      handleCancelRecording();
    }
    if (stagedAttachment?.previewUrl) {
      URL.revokeObjectURL(stagedAttachment.previewUrl);
    }
    setStagedAttachment(null);
    setReplyingTo(null);
    handleCancelEditing();
    setActiveMenuMessageId(null);
    scrollToBottom('auto');
  }, [target.id]);

  // Scroll suave ao receber novas mensagens
  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages]);

  // Captura o momento em que imagens ou vídeos terminam de baixar
  // para reajustar o scroll e evitar que a imagem fique cortada
  useEffect(() => {
    const listEl = messagesListRef.current;
    if (!listEl) return;

    const handleMediaLoad = () => {
      scrollToBottom('auto');
    };

    listEl.addEventListener('load', handleMediaLoad, true);
    return () => {
      listEl.removeEventListener('load', handleMediaLoad, true);
    };
  }, []);

  const targetName = 'username' in target ? target.username : target.name;
  const placeholder =
    type === 'DM'
      ? t('chat.dmPlaceholder', { name: targetName })
      : t('chat.messagePlaceholder', { name: targetName });

  const isSameCalendarDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();

  const formatDateSeparator = (value: string) => {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (isSameCalendarDay(date, today)) return t('common.today');
    if (isSameCalendarDay(date, yesterday)) return t('common.yesterday');

    return new Intl.DateTimeFormat(i18n.language, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  // Upload e Seleção de Arquivos (Imagens, Vídeos, Documentos)
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação preventiva de tamanho máximo de arquivo (default: 25 MB)
    const maxFileSizeMb = Number(import.meta.env?.VITE_MAX_FILE_SIZE_MB) || 25;
    const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;
    if (file.size > maxFileSizeBytes) {
      toast.warning(
        `O arquivo "${file.name}" tem ${(file.size / (1024 * 1024)).toFixed(1)} MB e ultrapassa o limite máximo permitido de ${maxFileSizeMb} MB.`,
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (stagedAttachment?.previewUrl) {
      URL.revokeObjectURL(stagedAttachment.previewUrl);
    }

    const isImage = file.type.startsWith('image/');
    const previewUrl = isImage ? URL.createObjectURL(file) : '';

    setStagedAttachment({
      file,
      previewUrl,
      name: file.name,
      size: file.size,
      isImage,
    });

    setTimeout(() => textInputRef.current?.focus(), 50);
  };

  // Captura de Imagem da Área de Transferência (CTRL+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        if (!file) continue;

        e.preventDefault();

        const maxFileSizeMb = Number(import.meta.env?.VITE_MAX_FILE_SIZE_MB) || 25;
        const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;
        if (file.size > maxFileSizeBytes) {
          toast.warning(
            `A imagem colada tem ${(file.size / (1024 * 1024)).toFixed(1)} MB e ultrapassa o limite máximo permitido de ${maxFileSizeMb} MB.`
          );
          return;
        }

        if (stagedAttachment?.previewUrl) {
          URL.revokeObjectURL(stagedAttachment.previewUrl);
        }

        const previewUrl = URL.createObjectURL(file);
        const fileName = file.name && file.name !== 'image.png' ? file.name : `imagem-${Date.now()}.png`;

        setStagedAttachment({
          file,
          previewUrl,
          name: fileName,
          size: file.size,
          isImage: true,
        });

        setTimeout(() => textInputRef.current?.focus(), 50);
        break;
      }
    }
  };

  const handleCancelStagedAttachment = () => {
    if (stagedAttachment?.previewUrl) {
      URL.revokeObjectURL(stagedAttachment.previewUrl);
    }
    setStagedAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReplyTo = (msg: ChatMessage) => {
    setReplyingTo(msg);
    setTimeout(() => textInputRef.current?.focus(), 50);
  };

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`message-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add(styles.highlightMessage);
      setTimeout(() => {
        el.classList.remove(styles.highlightMessage);
      }, 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;

    if (stagedAttachment) {
      try {
        setIsUploading(true);
        setUploadProgress(0);
        setUploadStatusText('Enviando anexo...');

        const channelId = type === 'CHANNEL' ? target.id : undefined;
        const receiverId = type === 'DM' ? target.id : undefined;

        const result = await StorageUploadService.uploadMedia({
          file: stagedAttachment.file,
          channelId,
          receiverId,
          onCompressProgress: (progress) => {
            setUploadProgress(Math.round(progress / 2));
            setUploadStatusText(`Comprimindo (${progress}%)...`);
          },
          onUploadProgress: (progress) => {
            setUploadProgress(50 + Math.round(progress / 2));
            setUploadStatusText(`Enviando para o R2 (${progress}%)...`);
          },
        });

        if (result.attachmentId && onSendAttachment) {
          onSendAttachment(result.attachmentId, newMessage.trim(), replyingTo?.id);
        }

        if (stagedAttachment.previewUrl) {
          URL.revokeObjectURL(stagedAttachment.previewUrl);
        }
        setStagedAttachment(null);
        onNewMessageChange('');
        setReplyingTo(null);
      } catch (err: any) {
        console.error('Falha no upload do anexo:', err);
        toast.error(err.message || 'Erro ao enviar anexo.');
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadStatusText('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      return;
    }

    if (!newMessage.trim()) return;

    onSendMessage(e, { replyToId: replyingTo?.id, replyTo: replyingTo });
    setReplyingTo(null);
  };

  // Gravação de Áudio de Voz (Opus Mono 32 kbps WhatsApp style)
  const handleStartRecording = async () => {
    try {
      const recorder = new AudioRecorderService();
      audioRecorderRef.current = recorder;

      await recorder.startRecording((volume) => {
        setAudioVolume(volume);
      });

      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Erro ao acessar microfone para gravação:', err);
      toast.error('Não foi possível acessar o microfone.');
    }
  };

  const handleCancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    audioRecorderRef.current?.cancelRecording();
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const handleSendRecording = async () => {
    if (!audioRecorderRef.current) return;

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    try {
      const recorded = await audioRecorderRef.current.stopRecording();
      setIsRecording(false);
      setRecordingSeconds(0);

      setIsUploading(true);
      setUploadStatusText('Enviando mensagem de voz...');

      const channelId = type === 'CHANNEL' ? target.id : undefined;
      const receiverId = type === 'DM' ? target.id : undefined;

      const result = await StorageUploadService.uploadMedia({
        file: recorded.file,
        channelId,
        receiverId,
        onUploadProgress: (progress) => {
          setUploadProgress(progress);
        },
      });

      if (result.attachmentId && onSendAttachment) {
        onSendAttachment(result.attachmentId, '', replyingTo?.id);
      }
      setReplyingTo(null);
    } catch (err: any) {
      console.error('Falha ao enviar áudio:', err);
      toast.error(err.message || 'Erro ao enviar áudio de voz.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatusText('');
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          {type === 'DM' ? (
            <div 
              className={styles.avatarWrapper}
              onClick={() => onOpenUserProfile?.(target.id)}
              style={{ cursor: onOpenUserProfile ? 'pointer' : 'default' }}
              title={`Ver perfil de ${targetName}`}
            >
              <div className={styles.avatar}>
                {getMediaUrl((target as FriendUser).avatarUrl) ? (
                  <img
                    src={getMediaUrl((target as FriendUser).avatarUrl)}
                    alt={targetName}
                    className={styles.avatarImg}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : null}
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                  {targetName.charAt(0).toUpperCase()}
                </span>
              </div>
              <StatusDot status={targetStatus || UserStatusEnum.OFFLINE} size="sm" className={styles.onlineDot} />
            </div>
          ) : (
            <div className={styles.channelIconBox}>
              <Hash size={18} />
            </div>
          )}
          <h1 
            className={styles.title}
            onClick={type === 'DM' && onOpenUserProfile ? () => onOpenUserProfile(target.id) : undefined}
            style={{ cursor: type === 'DM' && onOpenUserProfile ? 'pointer' : 'default' }}
          >
            {targetName}
          </h1>
        </div>

        {type === 'DM' && (
          <div className={styles.dmHeaderActions} style={{ position: 'relative' }}>
            {onOpenUserProfile && (
              <button
                type="button"
                className={styles.headerActionBtn}
                onClick={() => onOpenUserProfile(target.id)}
                title={t('user.viewProfile', 'Ver Perfil')}
              >
                <User size={18} />
              </button>
            )}

            {(onRemoveFriend || onBlockUser) && (
              <>
                <button
                  type="button"
                  className={`${styles.headerActionBtn} ${showDmMenu ? styles.headerActionBtnActive : ''}`}
                  onClick={() => setShowDmMenu((prev) => !prev)}
                  title={t('friends.moreOptions', 'Mais opções')}
                >
                  <MoreVertical size={18} />
                </button>

                {showDmMenu && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                      onClick={() => setShowDmMenu(false)}
                    />
                    <div
                      className="context-menu-content"
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        marginTop: '8px',
                        zIndex: 9999,
                        minWidth: 190,
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {onOpenUserProfile && (
                        <div
                          className="context-menu-item"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                          onClick={() => {
                            setShowDmMenu(false);
                            onOpenUserProfile(target.id);
                          }}
                        >
                          <User size={14} />
                          <span>{t('user.viewProfile', 'Ver Perfil')}</span>
                        </div>
                      )}

                      {onOpenUserProfile && (onRemoveFriend || onBlockUser) && (
                        <div className="context-menu-separator" />
                      )}

                      {onRemoveFriend && (
                        <div
                          className="context-menu-item"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                          onClick={async () => {
                            setShowDmMenu(false);
                            const ok = await confirm({
                              title: t('friends.removeFriend', 'Desfazer Amizade'),
                              message: t('friends.removeFriendConfirm', { name: targetName }),
                              confirmText: t('friends.removeFriend', 'Desfazer Amizade'),
                              variant: 'danger',
                            });
                            if (ok) {
                              onRemoveFriend(target.id);
                            }
                          }}
                        >
                          <UserMinus size={14} />
                          <span>{t('friends.removeFriend', 'Desfazer Amizade')}</span>
                        </div>
                      )}

                      {onBlockUser && (
                        <div
                          className="context-menu-item context-menu-item-danger"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                          onClick={async () => {
                            setShowDmMenu(false);
                            const ok = await confirm({
                              title: t('friends.blockUser', 'Bloquear Usuário'),
                              message: t('friends.blockUserConfirm', { name: targetName }),
                              confirmText: t('friends.blockUser', 'Bloquear Usuário'),
                              variant: 'danger',
                            });
                            if (ok) {
                              onBlockUser(target.id);
                            }
                          }}
                        >
                          <Ban size={14} />
                          <span>{t('friends.blockUser', 'Bloquear Usuário')}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {type === 'CHANNEL' && onToggleMembersList && (
          <button
            type="button"
            onClick={onToggleMembersList}
            style={{
              marginLeft: 'auto',
              background: isMembersListOpen ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              color: isMembersListOpen ? 'var(--brand-primary, #34d399)' : '#94a3b8',
              border: isMembersListOpen ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
              cursor: 'pointer',
              padding: '0.4rem 0.75rem',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
            title={isMembersListOpen ? 'Ocultar Membros' : 'Exibir Membros do Servidor'}
          >
            <Users size={16} />
            <span>Membros</span>
          </button>
        )}
      </header>

      {/* Messages */}
      <div className={styles.messagesList} ref={messagesListRef}>
        {isLoading && messages.length === 0 ? (
          <div className={styles.loadingMessagesContainer}>
            <Loader2 size={32} className={styles.loadingSpinner} />
            <span>{t('chat.loadingMessages', 'Carregando mensagens...')}</span>
          </div>
        ) : messages.length === 0 ? (
          <div className={styles.emptyMessagesContainer}>
            <div className={styles.emptyIconBox}>
              {type === 'DM' ? targetName.charAt(0).toUpperCase() : <Hash size={30} />}
            </div>
            <h2>{type === 'DM' ? targetName : `#${targetName}`}</h2>
            <p>
              {type === 'DM'
                ? t('chat.startDmConversation', `Este é o início da sua conversa com ${targetName}.`)
                : t('chat.startChannelConversation', `Este é o início do canal #${targetName}.`)}
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const previousMessage = messages[index - 1];
            const messageDate = new Date(msg.createdAt);
            const showDateSeparator = !previousMessage || !isSameCalendarDay(
              messageDate,
              new Date(previousMessage.createdAt)
            );
            const isMe = msg.senderId === myId;
            const author = isMe ? t('chat.you') : (msg.sender?.displayName || msg.sender?.username || t('voice.remoteUser'));
            const avatarMedia = getMediaUrl(msg.sender?.avatarUrl);
            const time = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <React.Fragment key={msg.id}>
                {showDateSeparator && (
                  <div className={styles.dateSeparator}>
                    <span>{formatDateSeparator(msg.createdAt)}</span>
                  </div>
                )}
                <div
                  id={`message-${msg.id}`}
                  className={`${styles.messageRow} ${
                    isMe ? styles.myMessage : styles.otherMessage
                  } ${
                    activeMenuMessageId === msg.id || activeQuickReactionMsgId === msg.id || activeFullReactionMsgId === msg.id
                      ? styles.activeMenuRow
                      : ''
                  } ${msg.reactions && msg.reactions.length > 0 ? styles.hasReactions : ''}`}
                >
                  {!isMe && (
                    <div 
                      className={styles.avatar} 
                      style={{ 
                        width: 28, 
                        height: 28, 
                        fontSize: '0.75rem', 
                        cursor: onOpenUserProfile ? 'pointer' : 'default' 
                      }}
                      onClick={() => onOpenUserProfile?.(msg.senderId)}
                      title={`Ver perfil de ${author}`}
                    >
                      {avatarMedia && !failedAvatars[msg.id] ? (
                        <img 
                          src={avatarMedia} 
                          alt={author} 
                          className={styles.avatarImg}
                          onError={() => {
                            setFailedAvatars((prev) => ({ ...prev, [msg.id]: true }));
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>
                          {author.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  )}
                  <div className={styles.messageBubbleWrapper}>
                    <div className={styles.messageMeta}>
                      <span 
                        className={styles.authorName}
                        onClick={() => onOpenUserProfile?.(msg.senderId)}
                        style={{ cursor: onOpenUserProfile ? 'pointer' : 'default' }}
                        title={`Ver perfil de ${author}`}
                      >
                        {author}
                      </span>
                      <span className={styles.time}>{time}</span>
                    </div>
                    {(() => {
                      const isOnlyAudio =
                        !msg.content &&
                        msg.attachments?.length === 1 &&
                        msg.attachments[0].fileType === 'AUDIO';

                      const isReactionActive = activeQuickReactionMsgId === msg.id || activeFullReactionMsgId === msg.id;
                      const isMenuActive = activeMenuMessageId === msg.id;

                      const emojiTriggerButton = onToggleReaction && (
                        <div className={styles.reactionTriggerContainer}>
                          <button
                            type="button"
                            className={`${styles.reactionTriggerBtn} ${isReactionActive ? styles.reactionTriggerBtnActive : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setReactionAnchorRect(rect);
                              setActiveMenuMessageId(null);
                              setActiveFullReactionMsgId(null);
                              setActiveQuickReactionMsgId((prev) => (prev === msg.id ? null : msg.id));
                            }}
                            title="Adicionar reação"
                          >
                            <Smile size={15} />
                          </button>

                          {activeQuickReactionMsgId === msg.id && (
                            <QuickReactionPicker
                              anchorRect={reactionAnchorRect}
                              currentReaction={msg.reactions?.find((r) => r.userId === myId)?.emoji}
                              onSelectEmoji={(emoji) => {
                                onToggleReaction(msg.id, emoji);
                                setActiveQuickReactionMsgId(null);
                              }}
                              onOpenFullPicker={() => {
                                setActiveQuickReactionMsgId(null);
                                setActiveFullReactionMsgId(msg.id);
                              }}
                              onClose={() => setActiveQuickReactionMsgId(null)}
                            />
                          )}

                          {activeFullReactionMsgId === msg.id && reactionAnchorRect && (
                            createPortal(
                              <>
                                <div
                                  className={styles.menuBackdrop}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveFullReactionMsgId(null);
                                  }}
                                />
                                <div
                                  style={getFullPickerStyle(reactionAnchorRect)}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <EmojiPicker
                                    onSelectEmoji={(emoji) => {
                                      onToggleReaction(msg.id, emoji);
                                      setActiveFullReactionMsgId(null);
                                    }}
                                    onClose={() => setActiveFullReactionMsgId(null)}
                                  />
                                </div>
                              </>,
                              document.body
                            )
                          )}
                        </div>
                      );

                      const menuTriggerButton = (
                        <div className={styles.menuTriggerContainer}>
                          <button
                            type="button"
                            className={`${styles.messageTriggerBtn} ${isMenuActive ? styles.messageTriggerBtnActive : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveQuickReactionMsgId(null);
                              setActiveFullReactionMsgId(null);
                              setActiveMenuMessageId((prev) => (prev === msg.id ? null : msg.id));
                            }}
                            title="Opções da mensagem"
                          >
                            <MoreVertical size={15} />
                          </button>

                          {isMenuActive && (
                            <>
                              <div
                                className={styles.menuBackdrop}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuMessageId(null);
                                }}
                              />
                              <div
                                className={`${styles.messageDropdown} ${
                                  isMe ? styles.messageDropdownMe : styles.messageDropdownOther
                                }`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className={styles.messageDropdownItem}
                                  onClick={() => {
                                    setActiveMenuMessageId(null);
                                    handleReplyTo(msg);
                                  }}
                                >
                                  <Reply size={13} />
                                  <span>Responder</span>
                                </button>

                                {isMe && onEditMessage && (
                                  <button
                                    type="button"
                                    className={styles.messageDropdownItem}
                                    onClick={() => {
                                      setActiveMenuMessageId(null);
                                      handleStartEditing(msg);
                                    }}
                                  >
                                    <Pencil size={13} />
                                    <span>Editar</span>
                                  </button>
                                )}

                                {onDeleteMessage && type === 'CHANNEL' && (isMe || canDeleteAnyMessage) && (
                                  <>
                                    <div className={styles.dropdownSeparator} />
                                    <button
                                      type="button"
                                      className={`${styles.messageDropdownItem} ${styles.dangerDropdownItem}`}
                                      onClick={() => {
                                        setActiveMenuMessageId(null);
                                        onDeleteMessage(msg.id);
                                      }}
                                    >
                                      <Trash2 size={13} />
                                      <span>Excluir</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );

                      return (
                        <div className={styles.bubbleContainer}>
                          {/* Botões de Ações Externos (Lado Esquerdo para Enviadas, Lado Direito para Recebidas) */}
                          {editingMessageId !== msg.id && (
                            <div
                              className={`${styles.bubbleActions} ${
                                isMe ? styles.bubbleActionsMe : styles.bubbleActionsOther
                              } ${isReactionActive || isMenuActive ? styles.bubbleActionsActive : ''}`}
                            >
                              {isMe ? (
                                <>
                                  {emojiTriggerButton}
                                  {menuTriggerButton}
                                </>
                              ) : (
                                <>
                                  {menuTriggerButton}
                                  {emojiTriggerButton}
                                </>
                              )}
                            </div>
                          )}

                          <div
                            className={`${styles.bubble} ${
                              isMe ? styles.myBubble : styles.otherBubble
                            } ${isOnlyAudio ? styles.audioBubble : ''}`}
                          >
                            {/* Bloco de Mensagem Respondida (WhatsApp style) */}
                            {msg.replyTo && (
                              <div
                                className={styles.quotedMessage}
                                onClick={() => scrollToMessage(msg.replyTo!.id)}
                                title="Clique para ir até a mensagem original"
                              >
                                <div className={styles.quotedContent}>
                                  <span className={styles.quotedAuthor}>
                                    {msg.replyTo.senderId === myId
                                      ? t('chat.you', 'Você')
                                      : (msg.replyTo.sender?.displayName || msg.replyTo.sender?.username || t('voice.remoteUser', 'Usuário'))}
                                  </span>
                                  <p className={styles.quotedSnippet}>
                                    {msg.replyTo.content || (msg.replyTo.attachments && msg.replyTo.attachments.length > 0 ? '📷 Anexo' : 'Mensagem')}
                                  </p>
                                </div>
                              </div>
                            )}

                            {editingMessageId === msg.id ? (
                              <div className={styles.editContainer}>
                                <input
                                  ref={editInputRef}
                                  type="text"
                                  className={styles.editInput}
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleSaveEditing(msg.id);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      handleCancelEditing();
                                    }
                                  }}
                                />
                                <div className={styles.editActions}>
                                  <span className={styles.editHint}>
                                    escape para <button type="button" onClick={handleCancelEditing} className={styles.editHintLink}>cancelar</button> • enter para <button type="button" onClick={() => handleSaveEditing(msg.id)} className={styles.editHintLink}>salvar</button>
                                  </span>
                                  <div className={styles.editButtons}>
                                    <button
                                      type="button"
                                      className={styles.cancelEditBtn}
                                      onClick={handleCancelEditing}
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.saveEditBtn}
                                      onClick={() => handleSaveEditing(msg.id)}
                                      disabled={!editingContent.trim()}
                                    >
                                      Salvar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              msg.content && (
                                <div>
                                  <span>{msg.content}</span>
                                  {msg.isEdited && <span className={styles.editedTag}>(editada)</span>}
                                </div>
                              )
                            )}

                            {/* Renderização de Anexos com Thumbnails Leves */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className={isOnlyAudio ? styles.attachmentOnly : ''}>
                                {msg.attachments.map((att) => (
                                  <AttachmentRenderer key={att.id} attachment={att} />
                                ))}
                              </div>
                            )}

                            {/* Balão de Reações Sobreposto na Base da Mensagem */}
                            {msg.reactions && msg.reactions.length > 0 && (() => {
                              const map = new Map<string, number>();
                              for (const r of msg.reactions) {
                                map.set(r.emoji, (map.get(r.emoji) || 0) + 1);
                              }
                              const sorted = Array.from(map.entries())
                                .map(([emoji, count]) => ({ emoji, count }))
                                .sort((a, b) => b.count - a.count);

                              const top3 = sorted.slice(0, 3);
                              const totalCount = msg.reactions.length;
                              const myReaction = msg.reactions.find((r) => r.userId === myId);

                              return (
                                <div
                                  className={`${styles.reactionsBadge} ${
                                    isMe ? styles.reactionsBadgeMe : styles.reactionsBadgeOther
                                  } ${myReaction ? styles.reactionsBadgeActive : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setViewingReactionsMsg(msg);
                                  }}
                                  title="Ver quem reagiu"
                                >
                                  <div className={styles.reactionsBadgeEmojis}>
                                    {top3.map(({ emoji }) => (
                                      <span key={emoji} className={styles.badgeEmoji}>
                                        {emoji}
                                      </span>
                                    ))}
                                  </div>
                                  {totalCount > 1 && (
                                    <span className={styles.badgeCount}>{totalCount}</span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} className={styles.scrollAnchor} />
      </div>

      {/* Input Form & Action Bar */}
      <div className={styles.inputArea} onPaste={handlePaste}>
        {/* Emoji Picker Popover */}
        {showEmojiPicker && (
          <EmojiPicker
            onSelectEmoji={handleSelectEmoji}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}

        {/* Banner de Progresso de Upload / Compressão */}
        {isUploading && (
          <div className={styles.uploadProgressBanner}>
            <Loader2 size={16} className="animate-spin" />
            <span>{uploadStatusText}</span>
            <div className={styles.uploadTrack}>
              <div
                className={styles.uploadFill}
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span>{uploadProgress}%</span>
          </div>
        )}

        {/* Docked Reply Banner (WhatsApp Style) */}
        {replyingTo && (
          <div className={styles.replyBanner}>
            <div className={styles.replyBannerBar} />
            <div className={styles.replyBannerContent}>
              <div className={styles.replyBannerHeader}>
                <Reply size={13} className={styles.replyBannerIcon} />
                <span>
                  Respondendo a{' '}
                  <strong>
                    {replyingTo.senderId === myId
                      ? t('chat.you', 'Você')
                      : (replyingTo.sender?.displayName || replyingTo.sender?.username || t('voice.remoteUser', 'Usuário'))}
                  </strong>
                </span>
              </div>
              <p className={styles.replyBannerSnippet}>
                {replyingTo.content || (replyingTo.attachments && replyingTo.attachments.length > 0 ? '📷 Anexo' : 'Mensagem')}
              </p>
            </div>
            <button
              type="button"
              className={styles.replyBannerCloseBtn}
              onClick={() => setReplyingTo(null)}
              title="Cancelar resposta"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Staged Attachment Banner (Image / File staged with optional caption) */}
        {stagedAttachment && (
          <div className={styles.stagedAttachmentBanner}>
            {stagedAttachment.isImage ? (
              <img
                src={stagedAttachment.previewUrl}
                alt={stagedAttachment.name}
                className={styles.stagedImagePreview}
              />
            ) : (
              <div className={styles.stagedFileIcon}>
                <FileText size={22} />
              </div>
            )}
            <div className={styles.stagedFileInfo}>
              <span className={styles.stagedFileName}>{stagedAttachment.name}</span>
              <span className={styles.stagedFileSize}>
                {(stagedAttachment.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
            <button
              type="button"
              className={styles.cancelStagedBtn}
              onClick={handleCancelStagedAttachment}
              title="Remover anexo"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Input de Arquivo Oculto */}
        <input
          type="file"
          ref={fileInputRef}
          hidden
          onChange={handleFileSelected}
        />

        {/* Barra de Gravação de Voz (Estilo WhatsApp) */}
        {isRecording ? (
          <div className={styles.recordingBar}>
            <div className={styles.recordingIndicator}>
              <div className={styles.recordingDot} />
              <span className={styles.recordingTimer}>{formatTimer(recordingSeconds)}</span>
            </div>

            <div className={styles.recordingWaveform}>
              {[...Array(24)].map((_, i) => (
                <div
                  key={i}
                  className={styles.waveformBar}
                  style={{
                    height: `${Math.max(4, Math.min(20, (audioVolume / 100) * 20 * (0.4 + (i % 5) * 0.15)))}px`,
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              className={styles.cancelRecButton}
              onClick={handleCancelRecording}
              title="Cancelar gravação"
            >
              <Trash2 size={16} />
              <span>Cancelar</span>
            </button>

            <button
              type="button"
              className={styles.sendRecButton}
              onClick={handleSendRecording}
              title="Enviar áudio"
            >
              <Send size={16} style={{ marginLeft: 2 }} />
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className={`${styles.inputForm} ${
              replyingTo || stagedAttachment ? styles.inputFormWithBanner : ''
            }`}
          >
            <button
              type="button"
              className={styles.actionButton}
              title="Gravar áudio de voz"
              onClick={handleStartRecording}
            >
              <Mic size={18} />
            </button>

            <div className={styles.textInputWrapper}>
              <input
                ref={textInputRef}
                type="text"
                className={styles.textInputField}
                placeholder={
                  stagedAttachment
                    ? 'Adicionar legenda ao anexo (opcional)...'
                    : placeholder
                }
                value={newMessage}
                onChange={(e) => onNewMessageChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    if (replyingTo) {
                      setReplyingTo(null);
                    } else if (stagedAttachment) {
                      handleCancelStagedAttachment();
                    }
                  }
                }}
              />
            </div>

            <button
              type="button"
              className={`${styles.actionButton} ${stagedAttachment ? styles.activeActionButton : ''}`}
              title="Anexar arquivo"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={18} />
            </button>

            <button
              type="button"
              className={`${styles.actionButton} ${showEmojiPicker ? styles.activeActionButton : ''}`}
              title="Inserir emoji"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
            >
              <Smile size={18} />
            </button>

            <button
              type="submit"
              className={styles.sendButton}
              disabled={(!newMessage.trim() && !stagedAttachment) || isUploading}
              title="Enviar"
            >
              <Send size={16} />
            </button>
          </form>
        )}
      </div>

      {/* Modal de Detalhes das Reações (WhatsApp style) */}
      {viewingReactionsMsg && viewingReactionsMsg.reactions && (
        <MessageReactionsModal
          reactions={viewingReactionsMsg.reactions}
          myId={myId}
          onClose={() => setViewingReactionsMsg(null)}
          onRemoveReaction={(emoji) => {
            onToggleReaction?.(viewingReactionsMsg.id, emoji);
          }}
        />
      )}
    </div>
  );
};
