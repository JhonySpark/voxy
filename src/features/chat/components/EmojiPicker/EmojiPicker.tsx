import React, { useState, useRef, useEffect, useMemo } from 'react';
import styles from './EmojiPicker.module.css';
import { Search } from 'lucide-react';

export interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Rostos & Expressões',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥹', '😊',
      '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😜',
      '🤪', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕',
      '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
      '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '🤔',
      '🤫', '🤐', '😴', '🤤', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
      '😵', '🤠', '💀', '💩', '🤡', '👻', '👽', '🤖',
    ],
  },
  {
    id: 'gestures',
    name: 'Mãos & Gestos',
    icon: '👍',
    emojis: [
      '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘',
      '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚',
      '🖐️', '🖖', '👋', '🤙', '💪', '🦾', '🖕', '✍️', '🙏', '🤝',
      '👏', '🙌', '👐', '🤲', '🫡',
    ],
  },
  {
    id: 'hearts',
    name: 'Corações & Reações',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
      '💟', '✨', '⭐', '🌟', '💥', '🔥', '💯', '💢', '💨', '💫',
      '👀', '👁️',
    ],
  },
  {
    id: 'objects',
    name: 'Atividades & Itens',
    icon: '🎉',
    emojis: [
      '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀',
      '🎮', '🕹️', '🎲', '🎯', '🚀', '💡', '🔔', '📣', '📢', '☕',
      '🍺', '🍻', '🍕', '🍔', '🍟', '🍿', '🍩', '🍪', '🍫', '🍬',
    ],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelectEmoji, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<string>('smileys');
  const [search, setSearch] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    // Auto-focus no campo de busca
    inputRef.current?.focus();

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const displayedEmojis = useMemo(() => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      // Pesquisa por nome da categoria ou retorna todos os emojis
      return EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((emoji) => emoji.includes(q));
    }
    const cat = EMOJI_CATEGORIES.find((c) => c.id === activeCategory);
    return cat ? cat.emojis : EMOJI_CATEGORIES[0].emojis;
  }, [search, activeCategory]);

  return (
    <div className={styles.pickerContainer} ref={containerRef}>
      <div className={styles.searchHeader}>
        <div className={styles.searchInputWrapper}>
          <Search size={14} />
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Pesquisar emoji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {!search.trim() && (
        <div className={styles.categoryNav}>
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`${styles.catButton} ${
                activeCategory === cat.id ? styles.catButtonActive : ''
              }`}
              onClick={() => setActiveCategory(cat.id)}
              title={cat.name}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      <div className={styles.emojiList}>
        {displayedEmojis.length > 0 ? (
          displayedEmojis.map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              type="button"
              className={styles.emojiItem}
              onClick={() => {
                onSelectEmoji(emoji);
              }}
            >
              {emoji}
            </button>
          ))
        ) : (
          <div className={styles.emptyState}>Nenhum emoji encontrado</div>
        )}
      </div>
    </div>
  );
};
