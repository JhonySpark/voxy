import { useState, useEffect, useCallback } from 'react';
import {
  voiceAudioSettingsService,
  type VoiceAudioSettings,
} from '../../../core/services/voice-audio-settings.service';

export function useVoiceAudioSettings() {
  const [settings, setSettings] = useState<VoiceAudioSettings>(() =>
    voiceAudioSettingsService.getSettings()
  );

  useEffect(() => {
    const unsubscribe = voiceAudioSettingsService.subscribe((updated) => {
      setSettings(updated);
    });
    return unsubscribe;
  }, []);

  const updateSettings = useCallback((partial: Partial<VoiceAudioSettings>) => {
    return voiceAudioSettingsService.updateSettings(partial);
  }, []);

  const restoreDefaults = useCallback(() => {
    return voiceAudioSettingsService.restoreDefaults();
  }, []);

  return {
    settings,
    updateSettings,
    restoreDefaults,
  };
}

