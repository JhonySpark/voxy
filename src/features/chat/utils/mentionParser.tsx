import React from 'react';
import styles from '../components/ChatArea/ChatArea.module.css';

/**
 * Verifica se um texto contém menção explícita ao usuário ou @everyone / @here.
 */
export function isUserMentioned(content: string, myUsername?: string | null): boolean {
  if (!content) return false;

  const lower = content.toLowerCase();

  // Menção broadcast
  if (lower.includes('@everyone') || lower.includes('@here')) {
    return true;
  }

  if (!myUsername) return false;

  const userRegex = new RegExp(`@${escapeRegex(myUsername)}(\\b|$)`, 'i');
  return userRegex.test(content);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Renderiza o texto intercalando partes normais com pills de menção estilizadas.
 */
export function formatMessageWithMentions(
  content: string,
  myUsername?: string | null,
  onMentionClick?: (username: string) => void,
): React.ReactNode {
  if (!content) return null;

  // Regex para capturar @username ou @everyone ou @here
  const mentionRegex = /(@[a-zA-Z0-9_\-.]+)/g;
  const parts = content.split(mentionRegex);

  return parts.map((part, index) => {
    if (part.startsWith('@')) {
      const cleanUsername = part.substring(1);
      const isBroadcast = cleanUsername.toLowerCase() === 'everyone' || cleanUsername.toLowerCase() === 'here';
      const isMe = myUsername && cleanUsername.toLowerCase() === myUsername.toLowerCase();

      return (
        <span
          key={index}
          className={`${styles.mentionBadge} ${isMe ? styles.mentionMeBadge : ''} ${
            isBroadcast ? styles.mentionBroadcastBadge : ''
          }`}
          onClick={onMentionClick ? (e) => {
            e.stopPropagation();
            onMentionClick(cleanUsername);
          } : undefined}
          title={isMe ? 'Mencionou você' : `@${cleanUsername}`}
        >
          {part}
        </span>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
