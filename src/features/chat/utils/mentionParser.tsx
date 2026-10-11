import React from 'react';
import styles from '../components/ChatArea/ChatArea.module.css';
import { openExternalUrl } from '../../../core/utils/url.util';

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
 * Limpa pontuação final (como pontos, vírgulas, exclamações ou parênteses desbalanceados)
 * que o usuário tenha digitado imediatamente colados na URL.
 * Exemplo: "Veja https://google.com." -> url: "https://google.com", trailing: "."
 *          "(https://google.com)" -> url: "https://google.com", trailing: ")"
 */
function cleanUrlAndTrailingPunctuation(rawUrl: string): { url: string; trailing: string } {
  let url = rawUrl;
  let trailing = '';

  while (url.length > 0) {
    const lastChar = url[url.length - 1];
    if (['.', ',', '!', '?', ':', ';', "'", '"', '`', '<', '>'].includes(lastChar)) {
      trailing = lastChar + trailing;
      url = url.slice(0, -1);
      continue;
    }
    // Fecha parênteses ou colchetes somente se não houver um abertura correspondente dentro da própria URL
    if (lastChar === ')') {
      const openCount = (url.match(/\(/g) || []).length;
      const closeCount = (url.match(/\)/g) || []).length;
      if (closeCount > openCount) {
        trailing = lastChar + trailing;
        url = url.slice(0, -1);
        continue;
      }
    }
    if (lastChar === ']') {
      const openCount = (url.match(/\[/g) || []).length;
      const closeCount = (url.match(/\]/g) || []).length;
      if (closeCount > openCount) {
        trailing = lastChar + trailing;
        url = url.slice(0, -1);
        continue;
      }
    }
    break;
  }

  return { url, trailing };
}

/**
 * Processa trechos de texto sem URLs para intercalar texto normal com badges de menção (@user).
 */
function parseTextChunkWithMentions(
  text: string,
  keyPrefix: string,
  myUsername?: string | null,
  onMentionClick?: (username: string) => void,
): React.ReactNode[] {
  if (!text) return [];

  const mentionRegex = /(@[a-zA-Z0-9_\-.]+)/g;
  const parts = text.split(mentionRegex);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-m-${index}`;
    if (part.startsWith('@')) {
      const cleanUsername = part.substring(1);
      const isBroadcast = cleanUsername.toLowerCase() === 'everyone' || cleanUsername.toLowerCase() === 'here';
      const isMe = myUsername && cleanUsername.toLowerCase() === myUsername.toLowerCase();

      return (
        <span
          key={key}
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
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

/**
 * Renderiza o texto intercalando links clicáveis (que abrem no navegador padrão do OS)
 * e pills de menção estilizadas (@username / @everyone) com texto comum.
 */
export function formatMessageWithMentions(
  content: string,
  myUsername?: string | null,
  onMentionClick?: (username: string) => void,
): React.ReactNode {
  if (!content) return null;

  // Regex para identificar URLs com protocolo (http/https) ou iniciando por www.
  const urlRegex = /(https?:\/\/[^\s<>"'`{}|\^]+|www\.[^\s<>"'`{}|\^]+)/gi;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let chunkCounter = 0;

  while ((match = urlRegex.exec(content)) !== null) {
    const matchIndex = match.index;
    const rawMatch = match[0];

    // Texto antes da URL
    if (matchIndex > lastIndex) {
      const textBefore = content.substring(lastIndex, matchIndex);
      nodes.push(
        ...parseTextChunkWithMentions(
          textBefore,
          `chunk-${chunkCounter++}`,
          myUsername,
          onMentionClick,
        ),
      );
    }

    // Processa a URL e separa pontuações acidentais no final
    const { url, trailing } = cleanUrlAndTrailingPunctuation(rawMatch);

    if (url) {
      const href = url.startsWith('www.') ? `https://${url}` : url;
      const linkKey = `link-${chunkCounter++}`;

      nodes.push(
        <a
          key={linkKey}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.chatLink}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openExternalUrl(href);
          }}
          title={href}
        >
          {url}
        </a>,
      );
    }

    // Se sobrou pontuação (ex: '!' ou '.' ou ')')
    if (trailing) {
      nodes.push(
        ...parseTextChunkWithMentions(
          trailing,
          `trailing-${chunkCounter++}`,
          myUsername,
          onMentionClick,
        ),
      );
    }

    lastIndex = matchIndex + rawMatch.length;
  }

  // Texto restante após a última URL encontrada
  if (lastIndex < content.length) {
    const textAfter = content.substring(lastIndex);
    nodes.push(
      ...parseTextChunkWithMentions(
        textAfter,
        `chunk-${chunkCounter++}`,
        myUsername,
        onMentionClick,
      ),
    );
  }

  return nodes;
}

export const formatMessageText = formatMessageWithMentions;
