import { useState, useEffect, useCallback } from 'react';
import {
  notificationSettingsService,
  type NotificationSettings,
} from '../../../core/services/notification-settings.service';

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(() =>
    notificationSettingsService.getSettings()
  );

  useEffect(() => {
    const unsubscribe = notificationSettingsService.subscribe((updated) => {
      setSettings(updated);
    });
    return unsubscribe;
  }, []);

  const updateSettings = useCallback((partial: Partial<NotificationSettings>) => {
    return notificationSettingsService.updateSettings(partial);
  }, []);

  return {
    settings,
    updateSettings,
  };
}
