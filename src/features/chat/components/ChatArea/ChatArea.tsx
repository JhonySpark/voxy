import React, { useRef, useEffect } from 'react';
import styles from './ChatArea.module.css';
import { Hash, Send, Plus, Mic, Smile, Paperclip } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FriendUser } from '../../../friends/components/FriendsSidebar/FriendsSidebar';
import type { ChannelItem } from '../../../servers/components/ServerSidebar/ServerSidebar';



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
  };
}

interface ChatAreaProps {
  type: 'DM' | 'CHANNEL';
  target: FriendUser | ChannelItem;
  myId: string;
  messages: ChatMessage[];
  newMessage: string;
  onNewMessageChange: (val: string) => void;
  onSendMessage: (e: React.FormEvent) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  type,
  target,
  myId,
  messages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
}) => {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const targetName = 'username' in target ? target.username : target.name;
  const placeholder =
    type === 'DM'
      ? t('chat.dmPlaceholder', { name: targetName })
      : t('chat.messagePlaceholder', { name: targetName });

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          {type === 'DM' ? (
            <div className={styles.avatarWrapper}>
              <div className={styles.avatar}>
                {targetName.charAt(0).toUpperCase()}
              </div>
              <div className={styles.onlineDot} />
            </div>
          ) : (
            <div className={styles.channelIconBox}>
              <Hash size={18} />
            </div>
          )}
          <h1 className={styles.title}>{targetName}</h1>
        </div>
      </header>

      {/* Messages */}
      <div className={styles.messagesList}>
        {messages.map((msg) => {
          const isMe = msg.senderId === myId;
          const author = isMe ? t('chat.you') : (msg.sender?.username || t('voice.remoteUser'));
          const time = new Date(msg.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div
              key={msg.id}
              className={`${styles.messageRow} ${
                isMe ? styles.myMessage : styles.otherMessage
              }`}
            >
              {!isMe && (
                <div className={styles.avatar} style={{ width: 28, height: 28, fontSize: '0.75rem' }}>
                  {author.charAt(0).toUpperCase()}
                </div>
              )}
              <div className={styles.messageBubbleWrapper}>
                <div className={styles.messageMeta}>
                  <span className={styles.authorName}>{author}</span>
                  <span className={styles.time}>{time}</span>
                </div>
                <div
                  className={`${styles.bubble} ${
                    isMe ? styles.myBubble : styles.otherBubble
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className={styles.inputArea}>
        <form onSubmit={onSendMessage} className={styles.inputForm}>
          <button
            type="button"
            className={styles.actionButton}
            title="Anexar arquivo"
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            className={styles.actionButton}
            title="Mensagem de áudio"
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

          <button type="button" className={styles.actionButton}>
            <Smile size={18} />
          </button>
          <button type="button" className={styles.actionButton}>
            <Paperclip size={18} />
          </button>

          <button
            type="submit"
            className={styles.sendButton}
            disabled={!newMessage.trim()}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
