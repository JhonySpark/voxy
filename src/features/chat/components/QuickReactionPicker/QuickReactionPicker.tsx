import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './QuickReactionPicker.module.css';
import { Plus } from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface QuickReactionPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onOpenFullPicker: () => void;
  onClose: () => void;
  currentReaction?: string;
  anchorRect?: DOMRect | null;
}

export const QuickReactionPicker: React.FC<QuickReactionPickerProps> = ({
  onSelectEmoji,
  onOpenFullPicker,
  onClose,
  currentReaction,
  anchorRect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<{ top: number; left: number } | null>(() => {
    if (!anchorRect) return null;
    const estimatedWidth = 280;
    const estimatedHeight = 44;
    const PADDING = 12;

    let left = anchorRect.left + anchorRect.width / 2 - estimatedWidth / 2;
    if (left < PADDING) left = PADDING;
    if (left + estimatedWidth > window.innerWidth - PADDING) {
      left = window.innerWidth - estimatedWidth - PADDING;
    }

    let top = anchorRect.top - estimatedHeight - 8;
    if (top < PADDING) {
      top = anchorRect.bottom + 8;
    }

    return { top, left };
  });

  useLayoutEffect(() => {
    if (!anchorRect) return;

    const updatePosition = () => {
      const barEl = containerRef.current;
      const barWidth = barEl ? barEl.offsetWidth : 280;
      const barHeight = barEl ? barEl.offsetHeight : 44;
      const PADDING = 12;

      let left = anchorRect.left + anchorRect.width / 2 - barWidth / 2;
      if (left < PADDING) left = PADDING;
      if (left + barWidth > window.innerWidth - PADDING) {
        left = window.innerWidth - barWidth - PADDING;
      }

      let top = anchorRect.top - barHeight - 8;
      if (top < PADDING) {
        top = anchorRect.bottom + 8;
      }

      setCoords({ top, left });
    };

    updatePosition();
  }, [anchorRect]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleScrollOrResize = () => {
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [onClose]);

  if (!coords) return null;

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div
        ref={containerRef}
        style={{
          top: `${coords.top}px`,
          left: `${coords.left}px`,
        }}
        className={styles.quickBar}
        onClick={(e) => e.stopPropagation()}
      >
        {QUICK_EMOJIS.map((emoji) => {
          const isActive = currentReaction === emoji;
          return (
            <button
              key={emoji}
              type="button"
              className={`${styles.emojiBtn} ${isActive ? styles.activeEmoji : ''}`}
              onClick={() => {
                onSelectEmoji(emoji);
                onClose();
              }}
              title={isActive ? 'Remover reação' : `Reagir com ${emoji}`}
            >
              {emoji}
            </button>
          );
        })}
        <button
          type="button"
          className={styles.moreBtn}
          onClick={() => {
            onOpenFullPicker();
          }}
          title="Mais reações"
        >
          <Plus size={16} />
        </button>
      </div>
    </>,
    document.body
  );
};
