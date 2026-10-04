import React, { useState, useMemo, useEffect } from 'react';
import styles from './MessageReactionsModal.module.css';
import { X, Smile } from 'lucide-react';
import { getMediaUrl } from '../../../../core/utils/media.util';

export interface ReactionItem {
  id: string;
  emoji: string;
  userId: string;
  user?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}

interface MessageReactionsModalProps {
  reactions: ReactionItem[];
  myId: string;
  onClose: () => void;
  onRemoveReaction: (emoji: string) => void;
}

export const MessageReactionsModal: React.FC<MessageReactionsModalProps> = ({
  reactions,
  myId,
  onClose,
  onRemoveReaction,
}) => {
  const [selectedTab, setSelectedTab] = useState<string>('ALL');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Agrupa reações por emoji com contagem e ordena por maior quantidade
  const emojiTabs = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reactions) {
      map.set(r.emoji, (map.get(r.emoji) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count);
  }, [reactions]);

  // Lista de reações filtrada pela aba selecionada
  const filteredReactions = useMemo(() => {
    if (selectedTab === 'ALL') return reactions;
    return reactions.filter((r) => r.emoji === selectedTab);
  }, [reactions, selectedTab]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h3>
            {reactions.length} {reactions.length === 1 ? 'reação' : 'reações'}
          </h3>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabsContainer}>
          <button
            type="button"
            className={`${styles.tabBtn} ${selectedTab === 'ALL' ? styles.activeTab : ''}`}
            onClick={() => setSelectedTab('ALL')}
            title="Todas as reações"
          >
            <Smile size={16} />
            <span className={styles.tabCount}>{reactions.length}</span>
          </button>
          {emojiTabs.map(({ emoji, count }) => (
            <button
              key={emoji}
              type="button"
              className={`${styles.tabBtn} ${selectedTab === emoji ? styles.activeTab : ''}`}
              onClick={() => setSelectedTab(emoji)}
            >
              <span>{emoji}</span>
              <span className={styles.tabCount}>{count}</span>
            </button>
          ))}
        </div>

        {/* User list */}
        <div className={styles.userList}>
          {filteredReactions.map((r) => {
            const isMe = r.userId === myId;
            const name = isMe
              ? 'Você'
              : (r.user?.displayName || r.user?.username || 'Usuário');
            const subtitle = isMe ? 'Clique para remover' : `@${r.user?.username || ''}`;
            const avatarUrl = getMediaUrl(r.user?.avatarUrl);

            return (
              <div
                key={r.id || `${r.userId}-${r.emoji}`}
                className={`${styles.userRow} ${isMe ? styles.clickableRow : ''}`}
                onClick={() => {
                  if (isMe) {
                    onRemoveReaction(r.emoji);
                    onClose();
                  }
                }}
                title={isMe ? 'Clique para remover sua reação' : undefined}
              >
                <div className={styles.userInfo}>
                  <div className={styles.avatar}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={name} className={styles.avatarImg} />
                    ) : (
                      name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className={styles.userNames}>
                    <span className={styles.name}>{name}</span>
                    <span className={`${styles.subtitle} ${isMe ? styles.removeHint : ''}`}>
                      {subtitle}
                    </span>
                  </div>
                </div>
                <div className={styles.emojiBadge}>{r.emoji}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
