import React from 'react';
import {
  Hash,
  Megaphone,
  Bell,
  BookOpen,
  ShieldCheck,
  Code2,
  Gamepad2,
  Sparkles,
  MessageSquare,
  Flame,
  Music,
  Image as ImageIcon,
  HelpCircle,
  Trophy,
  Terminal,
  Lock,
  type LucideProps,
} from 'lucide-react';

export interface ChannelIconOption {
  id: string;
  labelKey: string;
  defaultLabel: string;
  Icon: React.FC<LucideProps>;
}

export const CHANNEL_ICON_OPTIONS: ChannelIconOption[] = [
  { id: 'hash', labelKey: 'channel.icons.hash', defaultLabel: 'Padrão (#)', Icon: Hash },
  { id: 'megaphone', labelKey: 'channel.icons.megaphone', defaultLabel: 'Anúncios', Icon: Megaphone },
  { id: 'bell', labelKey: 'channel.icons.bell', defaultLabel: 'Avisos', Icon: Bell },
  { id: 'book', labelKey: 'channel.icons.book', defaultLabel: 'Regras / Guia', Icon: BookOpen },
  { id: 'shield', labelKey: 'channel.icons.shield', defaultLabel: 'Moderação', Icon: ShieldCheck },
  { id: 'message', labelKey: 'channel.icons.message', defaultLabel: 'Bate-papo', Icon: MessageSquare },
  { id: 'gamepad', labelKey: 'channel.icons.gamepad', defaultLabel: 'Jogos', Icon: Gamepad2 },
  { id: 'code', labelKey: 'channel.icons.code', defaultLabel: 'Código', Icon: Code2 },
  { id: 'terminal', labelKey: 'channel.icons.terminal', defaultLabel: 'Terminal', Icon: Terminal },
  { id: 'sparkles', labelKey: 'channel.icons.sparkles', defaultLabel: 'Destaques', Icon: Sparkles },
  { id: 'flame', labelKey: 'channel.icons.flame', defaultLabel: 'Em Alta', Icon: Flame },
  { id: 'trophy', labelKey: 'channel.icons.trophy', defaultLabel: 'Eventos', Icon: Trophy },
  { id: 'music', labelKey: 'channel.icons.music', defaultLabel: 'Música', Icon: Music },
  { id: 'image', labelKey: 'channel.icons.image', defaultLabel: 'Mídia', Icon: ImageIcon },
  { id: 'help', labelKey: 'channel.icons.help', defaultLabel: 'Ajuda / FAQ', Icon: HelpCircle },
  { id: 'lock', labelKey: 'channel.icons.lock', defaultLabel: 'Restrito', Icon: Lock },
];

export const ChannelTextIcon: React.FC<{ icon?: string | null } & LucideProps> = ({
  icon,
  ...props
}) => {
  const found = CHANNEL_ICON_OPTIONS.find((item) => item.id === icon);
  const IconComponent = found ? found.Icon : Hash;
  return <IconComponent {...props} />;
};

