import { StorageKeys } from '../enums';

export interface VoiceAudioSettings {
  selectedInput: string;
  selectedOutput: string;
  inputSensitivity: number;
  outputVolume: number;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
}

export const DEFAULT_VOICE_AUDIO_SETTINGS: VoiceAudioSettings = {
  selectedInput: '',
  selectedOutput: '',
  inputSensitivity: 72,
  outputVolume: 85,
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
};

type Listener = (settings: VoiceAudioSettings) => void;

class VoiceAudioSettingsService {
  private settings: VoiceAudioSettings;
  private listeners = new Set<Listener>();

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): VoiceAudioSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_VOICE_AUDIO_SETTINGS };

    try {
      const selectedInput = localStorage.getItem(StorageKeys.AUDIO_INPUT) || '';
      const selectedOutput = localStorage.getItem(StorageKeys.AUDIO_OUTPUT) || '';
      const rawSensitivity = parseInt(
        localStorage.getItem(StorageKeys.INPUT_SENSITIVITY) || '72',
        10
      );
      const rawOutputVol = parseInt(
        localStorage.getItem(StorageKeys.OUTPUT_VOLUME) || '85',
        10
      );

      const inputSensitivity = Number.isFinite(rawSensitivity)
        ? Math.max(0, Math.min(100, rawSensitivity))
        : DEFAULT_VOICE_AUDIO_SETTINGS.inputSensitivity;
      const outputVolume = Number.isFinite(rawOutputVol)
        ? Math.max(0, Math.min(100, rawOutputVol))
        : DEFAULT_VOICE_AUDIO_SETTINGS.outputVolume;

      const noiseSuppression =
        localStorage.getItem(StorageKeys.NOISE_SUPPRESSION) !== 'false';
      const echoCancellation =
        localStorage.getItem(StorageKeys.ECHO_CANCELLATION) !== 'false';
      const autoGainControl =
        localStorage.getItem(StorageKeys.AUTO_GAIN) !== 'false';

      return {
        selectedInput,
        selectedOutput,
        inputSensitivity,
        outputVolume,
        noiseSuppression,
        echoCancellation,
        autoGainControl,
      };
    } catch {
      return { ...DEFAULT_VOICE_AUDIO_SETTINGS };
    }
  }

  public getSettings(): VoiceAudioSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<VoiceAudioSettings>): VoiceAudioSettings {
    this.settings = {
      ...this.settings,
      ...partial,
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(StorageKeys.AUDIO_INPUT, this.settings.selectedInput);
        localStorage.setItem(StorageKeys.AUDIO_OUTPUT, this.settings.selectedOutput);
        localStorage.setItem(
          StorageKeys.INPUT_SENSITIVITY,
          this.settings.inputSensitivity.toString()
        );
        localStorage.setItem(
          StorageKeys.OUTPUT_VOLUME,
          this.settings.outputVolume.toString()
        );
        localStorage.setItem(
          StorageKeys.NOISE_SUPPRESSION,
          this.settings.noiseSuppression.toString()
        );
        localStorage.setItem(
          StorageKeys.ECHO_CANCELLATION,
          this.settings.echoCancellation.toString()
        );
        localStorage.setItem(
          StorageKeys.AUTO_GAIN,
          this.settings.autoGainControl.toString()
        );
      } catch (err) {
        console.error('[VoiceAudioSettings] Erro ao salvar preferências:', err);
      }
    }

    this.notifyListeners();
    return { ...this.settings };
  }

  public restoreDefaults(): VoiceAudioSettings {
    return this.updateSettings({
      inputSensitivity: DEFAULT_VOICE_AUDIO_SETTINGS.inputSensitivity,
      outputVolume: DEFAULT_VOICE_AUDIO_SETTINGS.outputVolume,
      noiseSuppression: DEFAULT_VOICE_AUDIO_SETTINGS.noiseSuppression,
      echoCancellation: DEFAULT_VOICE_AUDIO_SETTINGS.echoCancellation,
      autoGainControl: DEFAULT_VOICE_AUDIO_SETTINGS.autoGainControl,
    });
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
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

export const voiceAudioSettingsService = new VoiceAudioSettingsService();

