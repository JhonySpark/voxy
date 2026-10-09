import { StorageKeys } from '../enums';

export interface NotificationSettings {
  desktopNotifications: boolean;
  soundEnabled: boolean;
  directMessages: boolean;
  dmSound: boolean;
  friendRequests: boolean;
  friendSound: boolean;
  mentions: boolean;
  mentionSound: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  desktopNotifications: true,
  soundEnabled: true,
  directMessages: true,
  dmSound: true,
  friendRequests: true,
  friendSound: true,
  mentions: true,
  mentionSound: true,
};

type Listener = (settings: NotificationSettings) => void;

class NotificationSettingsService {
  private settings: NotificationSettings;
  private listeners = new Set<Listener>();

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): NotificationSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };

    try {
      const stored = localStorage.getItem(StorageKeys.NOTIFICATION_SETTINGS);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
        };
      }

      // Migração de preferências legadas caso já existissem
      const legacyMessages = localStorage.getItem(StorageKeys.NOTIFY_MESSAGES);
      const legacySounds = localStorage.getItem(StorageKeys.NOTIFY_SOUNDS);

      return {
        ...DEFAULT_SETTINGS,
        desktopNotifications: legacyMessages !== 'false',
        soundEnabled: legacySounds !== 'false',
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  public getSettings(): NotificationSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<NotificationSettings>): NotificationSettings {
    this.settings = {
      ...this.settings,
      ...partial,
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(StorageKeys.NOTIFICATION_SETTINGS, JSON.stringify(this.settings));
        // Sincroniza chaves legadas para compatibilidade
        localStorage.setItem(StorageKeys.NOTIFY_MESSAGES, this.settings.desktopNotifications.toString());
        localStorage.setItem(StorageKeys.NOTIFY_SOUNDS, this.settings.soundEnabled.toString());
      } catch (err) {
        console.error('[NotificationSettings] Erro ao salvar preferências:', err);
      }
    }

    this.notifyListeners();
    return { ...this.settings };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const copy = { ...this.settings };
    this.listeners.forEach((fn) => {
      try {
        fn(copy);
      } catch (e) {
        console.error(e);
      }
    });
  }
}

export const notificationSettingsService = new NotificationSettingsService();
