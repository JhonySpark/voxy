import React, { useRef, useEffect, useState } from 'react';
import styles from './ChatArea.module.css';
import { Hash, Send, Mic, Paperclip, Smile, Trash2, Loader2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FriendUser } from '../../../friends/components/FriendsSidebar/FriendsSidebar';
import type { ChannelItem } from '../../../servers/components/ServerSidebar/ServerSidebar';
import { AttachmentRenderer } from '../AttachmentRenderer/AttachmentRenderer';
import { EmojiPicker } from '../EmojiPicker/EmojiPicker';
import { StorageUploadService } from '../../services/storageUpload.service';
import { AudioRecorderService } from '../../services/audioRecorder.service';

import { getMediaUrl } from '../../../../core/utils/media.util';

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

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  receiverId?: string;
  channelId?: string;
  createdAt: string;
  sender?: {
    id: string;
    username: string;
    email: string;
    avatarUrl?: string | null;
    displayName?: string | null;
  };
  attachments?: ChatAttachment[];
}

interface ChatAreaProps {
  type: 'DM' | 'CHANNEL';
  target: FriendUser | ChannelItem;
  myId: string;
  messages: ChatMessage[];
  newMessage: string;
  onNewMessageChange: (val: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
  onSendAttachment?: (attachmentId: string, customContent?: string) => void;
  isLoading?: boolean;
  onOpenUserProfile?: (userId: string) => void;
  onToggleMembersList?: () => void;
  isMembersListOpen?: boolean;
  canDeleteAnyMessage?: boolean;
  onDeleteMessage?: (messageId: string) => void;
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
  isLoading = false,
  onOpenUserProfile,
  onToggleMembersList,
  isMembersListOpen = false,
  canDeleteAnyMessage = false,
  onDeleteMessage,
}) => {
  const { t, i18n } = useTranslation();
  const messagesListRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados de Upload e Gravação
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioVolume, setAudioVolume] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({});
  const audioRecorderRef = useRef<AudioRecorderService | null>(null);
  const recordingTimerRef = useRef<any>(null);

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

  // Upload e Compressão de Arquivos (Imagens, Vídeos, Documentos)
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validação preventiva de tamanho máximo de arquivo (default: 25 MB)
    const maxFileSizeMb = Number(import.meta.env?.VITE_MAX_FILE_SIZE_MB) || 25;
    const maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;
    if (file.size > maxFileSizeBytes) {
      alert(
        `O arquivo "${file.name}" tem ${(file.size / (1024 * 1024)).toFixed(1)} MB e ultrapassa o limite máximo permitido de ${maxFileSizeMb} MB.`,
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadStatusText('Comprimindo arquivo...');

      const channelId = type === 'CHANNEL' ? target.id : undefined;
      const receiverId = type === 'DM' ? target.id : undefined;

      const result = await StorageUploadService.uploadMedia({
        file,
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
        onSendAttachment(result.attachmentId, '');
      }
    } catch (err: any) {
      console.error('Falha no upload do anexo:', err);
      alert(err.message || 'Erro ao enviar anexo.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatusText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
      alert('Não foi possível acessar o microfone.');
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
        onSendAttachment(result.attachmentId, '');
      }
    } catch (err: any) {
      console.error('Falha ao enviar áudio:', err);
      alert(err.message || 'Erro ao enviar áudio de voz.');
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
              <div className={styles.onlineDot} />
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
                  className={`${styles.messageRow} ${
                    isMe ? styles.myMessage : styles.otherMessage
                  }`}
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

                      return (
                        <div
                          className={`${styles.bubble} ${
                            isMe ? styles.myBubble : styles.otherBubble
                          } ${isOnlyAudio ? styles.audioBubble : ''}`}
                        >
                          {msg.content && <div>{msg.content}</div>}

                          {/* Renderização de Anexos com Thumbnails Leves */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className={isOnlyAudio ? styles.attachmentOnly : ''}>
                              {msg.attachments.map((att) => (
                                <AttachmentRenderer key={att.id} attachment={att} />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  {onDeleteMessage && type === 'CHANNEL' && (isMe || canDeleteAnyMessage) && (
                    <button
                      type="button"
                      className={styles.deleteMessageBtn}
                      onClick={() => onDeleteMessage(msg.id)}
                      title={t('chat.deleteMessage', 'Excluir mensagem')}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} className={styles.scrollAnchor} />
      </div>

      {/* Input Form & Action Bar */}
      <div className={styles.inputArea}>
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
          <form onSubmit={onSendMessage} className={styles.inputForm}>
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
                type="text"
                className={styles.textInputField}
                placeholder={placeholder}
                value={newMessage}
                onChange={(e) => onNewMessageChange(e.target.value)}
              />
            </div>

            <button
              type="button"
              className={styles.actionButton}
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
              disabled={!newMessage.trim() || isUploading}
            >
              <Send size={16} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
