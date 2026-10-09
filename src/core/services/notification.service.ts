import { IpcChannels } from '../enums';
import { soundService } from './sound.service';
import { notificationSettingsService } from './notification-settings.service';
import { getMediaUrl } from '../utils/media.util';

declare global {
  interface Window {
    ipcRenderer?: {
      invoke(channel: string, ...args: any[]): Promise<any>;
      send(channel: string, ...args: any[]): void;
      on(channel: string, listener: (...args: any[]) => void): void;
      removeListener(channel: string, listener: (...args: any[]) => void): void;
    };
  }
}

export interface InAppToastTrigger {
  (options: {
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    title?: string;
    duration?: number;
    avatarUrl?: string | null;
  }): void;
}

class NotificationService {
  private inAppToastHandler: InAppToastTrigger | null = null;

  /**
   * Registra o handler para exibir Toasts internos do app.
   */
  public registerToastHandler(handler: InAppToastTrigger | null): void {
    this.inAppToastHandler = handler;
  }

  /**
   * Dispara notificação nativa do Windows através do Electron ou fallback para Web Notifications.
   */
  public async showDesktopNotification(title: string, body: string, iconUrl?: string): Promise<boolean> {
    const settings = notificationSettingsService.getSettings();
    if (!settings.desktopNotifications) {
      return false;
    }

    // 1. Electron IPC nativo
    if (typeof window !== 'undefined' && window.ipcRenderer) {
      try {
        await window.ipcRenderer.invoke(IpcChannels.SHOW_DESKTOP_NOTIFICATION, { title, body, iconUrl });
        await window.ipcRenderer.invoke(IpcChannels.FLASH_FRAME, true);
        return true;
      } catch (err) {
        console.warn('[NotificationService] Falha ao invocar notificação via IPC:', err);
      }
    }

    // 2. Fallback para Web Browser Notifications
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const fallbackIcon = iconUrl || '/favicon.svg';
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: fallbackIcon });
          return true;
        } else if (Notification.permission !== 'denied') {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            new Notification(title, { body, icon: fallbackIcon });
            return true;
          }
        }
      } catch (err) {
        console.warn('[NotificationService] Falha no fallback de notificação web:', err);
      }
    }

    return false;
  }

  /**
   * Notificação de Mensagem Direta (DM) recebida.
   */
  public notifyDirectMessage(params: {
    senderName: string;
    senderId: string;
    senderAvatarUrl?: string | null;
    content: string;
    isCurrentChatActive: boolean;
  }): void {
    const settings = notificationSettingsService.getSettings();
    if (!settings.directMessages) return;

    const isWindowFocused = typeof document !== 'undefined' && document.hasFocus();
    const shouldAlert = !params.isCurrentChatActive || !isWindowFocused;

    if (!shouldAlert) return;

    // Efeito sonoro respeitando cooldown e chamada de voz
    if (settings.soundEnabled && settings.dmSound) {
      soundService.playNotificationSound();
    }

    const title = params.senderName || 'Mensagem Direta';
    const body = params.content || 'Enviou um anexo';
    const iconUrl = getMediaUrl(params.senderAvatarUrl);

    // Notificação Desktop se a janela estiver fora de foco ou minimizada
    if (!isWindowFocused) {
      this.showDesktopNotification(title, body, iconUrl);
    } else if (!params.isCurrentChatActive && this.inAppToastHandler) {
      // Toast In-App se a janela estiver visível mas o usuário estiver em outro canal/amigo
      this.inAppToastHandler({
        type: 'info',
        title,
        message: body,
        avatarUrl: iconUrl,
        duration: 4000,
      });
    }
  }

  /**
   * Notificação de Convite de Amizade recebido.
   */
  public notifyFriendRequestReceived(params: {
    senderName: string;
    senderAvatarUrl?: string | null;
  } | string): void {
    const settings = notificationSettingsService.getSettings();
    if (!settings.friendRequests) return;

    const senderName = typeof params === 'string' ? params : params.senderName;
    const avatarUrl = typeof params === 'string' ? undefined : params.senderAvatarUrl;

    if (settings.soundEnabled && settings.friendSound) {
      soundService.playNotificationSound();
    }

    const title = 'Novo Pedido de Amizade';
    const body = `${senderName} enviou um convite de amizade para você!`;
    const iconUrl = getMediaUrl(avatarUrl);

    const isWindowFocused = typeof document !== 'undefined' && document.hasFocus();
    if (!isWindowFocused) {
      this.showDesktopNotification(title, body, iconUrl);
    }

    if (this.inAppToastHandler) {
      this.inAppToastHandler({
        type: 'info',
        title,
        message: body,
        avatarUrl: iconUrl,
        duration: 5000,
      });
    }
  }

  /**
   * Notificação de Convite de Amizade aceito.
   */
  public notifyFriendRequestAccepted(params: {
    friendName: string;
    friendAvatarUrl?: string | null;
  } | string): void {
    const settings = notificationSettingsService.getSettings();
    if (!settings.friendRequests) return;

    const friendName = typeof params === 'string' ? params : params.friendName;
    const avatarUrl = typeof params === 'string' ? undefined : params.friendAvatarUrl;

    if (settings.soundEnabled && settings.friendSound) {
      soundService.playNotificationSound();
    }

    const title = 'Pedido de Amizade Aceito';
    const body = `${friendName} aceitou seu convite de amizade!`;
    const iconUrl = getMediaUrl(avatarUrl);

    const isWindowFocused = typeof document !== 'undefined' && document.hasFocus();
    if (!isWindowFocused) {
      this.showDesktopNotification(title, body, iconUrl);
    }

    if (this.inAppToastHandler) {
      this.inAppToastHandler({
        type: 'success',
        title,
        message: body,
        avatarUrl: iconUrl,
        duration: 5000,
      });
    }
  }

  /**
   * Notificação de Menção em canal de servidor (@username ou @everyone).
   */
  public notifyMention(params: {
    senderName: string;
    channelName: string;
    serverName?: string;
    serverIconUrl?: string | null;
    senderAvatarUrl?: string | null;
    content: string;
    isCurrentChannelActive: boolean;
  }): void {
    const settings = notificationSettingsService.getSettings();
    if (!settings.mentions) return;

    const isWindowFocused = typeof document !== 'undefined' && document.hasFocus();
    const shouldAlert = !params.isCurrentChannelActive || !isWindowFocused;

    if (!shouldAlert) return;

    if (settings.soundEnabled && settings.mentionSound) {
      soundService.playNotificationSound();
    }

    const title = params.serverName
      ? `${params.serverName} (#${params.channelName})`
      : `#${params.channelName}`;
    const body = `${params.senderName} mencionou você: ${params.content || 'Mensagem'}`;
    const iconUrl = getMediaUrl(params.serverIconUrl || params.senderAvatarUrl);

    if (!isWindowFocused) {
      this.showDesktopNotification(title, body, iconUrl);
    } else if (!params.isCurrentChannelActive && this.inAppToastHandler) {
      this.inAppToastHandler({
        type: 'warning',
        title,
        message: body,
        avatarUrl: iconUrl,
        duration: 5000,
      });
    }
  }
}

export const notificationService = new NotificationService();
