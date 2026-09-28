import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Palette, 
  Bell, 
  Shield, 
  Keyboard, 
  X, 
  ChevronDown, 
  Volume2, 
  PlayCircle, 
  Sparkles, 
  Check, 
  RotateCcw,
  RefreshCw
} from 'lucide-react';
import { ipcRenderer } from 'electron';
import { useTranslation } from 'react-i18next';
import packageJson from '../../package.json';
import { SettingsTabEnum, StorageKeys, IpcChannels, LanguageEnum } from '../core/enums';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceChange?: (inputDevice: string, outputDevice: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onDeviceChange
}) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTabEnum>(SettingsTabEnum.VOICE);

  // Versão da aplicação (sincronizada com package.json)
  const APP_VERSION = `v${packageJson.version}`;

  // Dispositivos de Áudio
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>(
    localStorage.getItem(StorageKeys.AUDIO_INPUT) || ''
  );
  const [selectedOutput, setSelectedOutput] = useState<string>(
    localStorage.getItem(StorageKeys.AUDIO_OUTPUT) || ''
  );

  // Sliders
  const [inputSensitivity, setInputSensitivity] = useState<number>(
    parseInt(localStorage.getItem(StorageKeys.INPUT_SENSITIVITY) || '72', 10)
  );
  const [outputVolume, setOutputVolume] = useState<number>(
    parseInt(localStorage.getItem(StorageKeys.OUTPUT_VOLUME) || '85', 10)
  );

  // DSP & Processamento Neural
  const [noiseSuppression, setNoiseSuppression] = useState<boolean>(
    localStorage.getItem(StorageKeys.NOISE_SUPPRESSION) !== 'false'
  );
  const [echoCancellation, setEchoCancellation] = useState<boolean>(
    localStorage.getItem(StorageKeys.ECHO_CANCELLATION) !== 'false'
  );
  const [autoGainControl, setAutoGainControl] = useState<boolean>(
    localStorage.getItem(StorageKeys.AUTO_GAIN) !== 'false'
  );

  // Notificações e Privacidade
  const [notifyMessages, setNotifyMessages] = useState<boolean>(
    localStorage.getItem(StorageKeys.NOTIFY_MESSAGES) !== 'false'
  );
  const [notifySounds, setNotifySounds] = useState<boolean>(
    localStorage.getItem(StorageKeys.NOTIFY_SOUNDS) !== 'false'
  );
  const [gamePresence, setGamePresence] = useState<boolean>(
    localStorage.getItem(StorageKeys.GAME_PRESENCE) !== 'false'
  );

  // Verificação manual de atualização
  const [checkingUpdate, setCheckingUpdate] = useState<boolean>(false);
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null);

  const handleCheckUpdate = async () => {
    if (!ipcRenderer) return;
    try {
      setCheckingUpdate(true);
      setUpdateFeedback(t('settings.checkingUpdates'));
      const res = await ipcRenderer.invoke(IpcChannels.CHECK_FOR_UPDATES);
      if (res?.status === 'ok') {
        const remoteVer = res.updateInfo?.version;
        if (remoteVer && remoteVer !== APP_VERSION.replace('v', '')) {
          setUpdateFeedback(t('settings.updateFound', { version: remoteVer }));
        } else {
          setUpdateFeedback(t('settings.latestVersion'));
        }
      } else if (res?.status === 'dev') {
        setUpdateFeedback(t('settings.devMode'));
      } else {
        setUpdateFeedback(t('settings.updateFailed'));
      }
    } catch {
      setUpdateFeedback(t('settings.updateFailed'));
    } finally {
      setCheckingUpdate(false);
      setTimeout(() => {
        setUpdateFeedback(null);
      }, 4000);
    }
  };

  // Monitoramento e Medidor de Microfone (Live Audio Meter)
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [dbLevel, setDbLevel] = useState<string>('-48.0 dB');
  const [isTestingAudio, setIsTestingAudio] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Carregar lista de dispositivos
  useEffect(() => {
    if (!isOpen) return;

    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter(d => d.kind === 'audioinput'));
        setAudioOutputs(devices.filter(d => d.kind === 'audiooutput'));
      } catch (err) {
        console.error('Erro ao listar dispositivos:', err);
      }
    };

    loadDevices();
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    };
  }, [isOpen]);

  // Monitoramento do Microfone com AnalyserNode
  useEffect(() => {
    if (!isOpen || activeTab !== 'voice') {
      stopMicMonitoring();
      return;
    }

    startMicMonitoring();

    return () => {
      stopMicMonitoring();
    };
  }, [isOpen, activeTab, selectedInput]);

  const startMicMonitoring = async () => {
    try {
      stopMicMonitoring();
      const constraints: MediaStreamConstraints = {
        audio: selectedInput ? { deviceId: { exact: selectedInput } } : true,
        video: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        if (!mediaStreamRef.current) return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setAudioLevel(normalized);

        // Cálculo de dB realista aproximado
        if (normalized <= 2) {
          setDbLevel('-52.0 dB');
        } else {
          const db = -50 + (normalized * 0.45);
          setDbLevel(`${db.toFixed(1)} dB`);
        }

        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch {
      setDbLevel('-45.0 dB');
      setAudioLevel(0);
    }
  };

  const stopMicMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioLevel(0);
  };

  // Reproduzir som de teste
  const handlePlayTestSound = () => {
    try {
      setIsTestingAudio(true);
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const volumeMultiplier = outputVolume / 100;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24); // G5

      gain.gain.setValueAtTime(0.2 * volumeMultiplier, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.55);

      setTimeout(() => {
        setIsTestingAudio(false);
      }, 600);
    } catch {
      setIsTestingAudio(false);
    }
  };

  // Restaurar padrões
  const handleRestoreDefaults = () => {
    setInputSensitivity(72);
    setOutputVolume(85);
    setNoiseSuppression(true);
    setEchoCancellation(true);
    setAutoGainControl(true);
  };

  // Salvar alterações
  const handleSave = () => {
    localStorage.setItem(StorageKeys.AUDIO_INPUT, selectedInput);
    localStorage.setItem(StorageKeys.AUDIO_OUTPUT, selectedOutput);
    localStorage.setItem(StorageKeys.INPUT_SENSITIVITY, inputSensitivity.toString());
    localStorage.setItem(StorageKeys.OUTPUT_VOLUME, outputVolume.toString());
    localStorage.setItem(StorageKeys.NOISE_SUPPRESSION, noiseSuppression.toString());
    localStorage.setItem(StorageKeys.ECHO_CANCELLATION, echoCancellation.toString());
    localStorage.setItem(StorageKeys.AUTO_GAIN, autoGainControl.toString());
    localStorage.setItem(StorageKeys.NOTIFY_MESSAGES, notifyMessages.toString());
    localStorage.setItem(StorageKeys.NOTIFY_SOUNDS, notifySounds.toString());
    localStorage.setItem(StorageKeys.GAME_PRESENCE, gamePresence.toString());

    if (onDeviceChange) {
      onDeviceChange(selectedInput, selectedOutput);
    }

    onClose();
  };

  if (!isOpen) return null;

  const TOTAL_SEGMENTS = 18;
  const activeSegments = Math.round((audioLevel / 100) * TOTAL_SEGMENTS);

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="settings-header">
          <div className="settings-header-left">
            <div className="settings-header-icon">
              <Mic size={20} />
            </div>
            <div>
              <h2 className="settings-header-title">{t('settings.title')}</h2>
              <div className="settings-header-subtitle">
                {t('settings.subtitle', { version: APP_VERSION })}
              </div>
            </div>
          </div>
          <button className="settings-close-btn" onClick={onClose} title={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        {/* Body Layout */}
        <div className="settings-body">
          {/* Sidebar */}
          <div className="settings-sidebar">
            <div className="settings-sidebar-nav">
              <div className="settings-sidebar-section">{t('settings.devices')}</div>
              <button 
                className={`settings-tab-btn ${activeTab === SettingsTabEnum.VOICE ? 'active' : ''}`}
                onClick={() => setActiveTab(SettingsTabEnum.VOICE)}
              >
                <Mic size={16} />
                <span>{t('settings.voiceAndVideo')}</span>
              </button>
              <button 
                className={`settings-tab-btn ${activeTab === SettingsTabEnum.APPEARANCE ? 'active' : ''}`}
                onClick={() => setActiveTab(SettingsTabEnum.APPEARANCE)}
              >
                <Palette size={16} />
                <span>{t('settings.appearance')}</span>
              </button>
              <button 
                className={`settings-tab-btn ${activeTab === SettingsTabEnum.NOTIFICATIONS ? 'active' : ''}`}
                onClick={() => setActiveTab(SettingsTabEnum.NOTIFICATIONS)}
              >
                <Bell size={16} />
                <span>{t('settings.notifications')}</span>
              </button>
              <button 
                className={`settings-tab-btn ${activeTab === SettingsTabEnum.PRIVACY ? 'active' : ''}`}
                onClick={() => setActiveTab(SettingsTabEnum.PRIVACY)}
              >
                <Shield size={16} />
                <span>{t('settings.privacy')}</span>
              </button>
              <button 
                className={`settings-tab-btn ${activeTab === SettingsTabEnum.KEYBINDS ? 'active' : ''}`}
                onClick={() => setActiveTab(SettingsTabEnum.KEYBINDS)}
              >
                <Keyboard size={16} />
                <span>{t('settings.keybinds')}</span>
              </button>
            </div>

            <div className="settings-sidebar-footer">
              <div className="dsp-indicator">
                <span className="dsp-dot" />
                <span>DSP: 48kHz / 24bit</span>
              </div>
              <div className="version-pill">
                <span>{t('settings.appVersion')}</span>
                <span className="version-tag">{APP_VERSION}</span>
              </div>
              <button 
                type="button" 
                className="settings-check-update-btn"
                onClick={handleCheckUpdate}
                disabled={checkingUpdate}
              >
                <RefreshCw size={12} className={checkingUpdate ? 'spin-icon' : ''} />
                <span>{updateFeedback || t('settings.checkUpdates')}</span>
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="settings-content">
            {activeTab === SettingsTabEnum.VOICE && (
              <>
                {/* 2-Columns Grid for Input and Output */}
                <div className="settings-grid-2">
                  {/* Entrada */}
                  <div className="settings-field-group">
                    <label className="settings-field-label">{t('settings.inputDevice')}</label>
                    <div className="settings-select-wrapper">
                      <select 
                        className="settings-select"
                        value={selectedInput}
                        onChange={e => setSelectedInput(e.target.value)}
                      >
                        <option value="">{t('settings.defaultDevice')}</option>
                        {audioInputs.map(device => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Microfone (${device.deviceId.slice(0, 5)}...)`}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="settings-select-chevron" />
                    </div>

                    {/* Teste do Microfone (Monitoramento) */}
                    <div className="settings-meter-box">
                      <div className="settings-meter-header">
                        <span className="settings-meter-title">{t('settings.micTest')}</span>
                        <span className="settings-meter-db">{dbLevel}</span>
                      </div>
                      <div className="settings-meter-track">
                        {Array.from({ length: TOTAL_SEGMENTS }).map((_, idx) => (
                          <div 
                            key={idx}
                            className={`meter-segment ${idx < activeSegments ? 'active' : ''}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Sensibilidade de Entrada */}
                    <div className="settings-field-group" style={{ marginTop: '0.25rem' }}>
                      <div className="settings-slider-header">
                        <span>{t('settings.micSensitivity')}</span>
                        <span className="settings-slider-value">{inputSensitivity}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={inputSensitivity}
                        onChange={e => setInputSensitivity(Number(e.target.value))}
                        className="settings-range-input"
                      />
                    </div>
                  </div>

                  {/* Saída */}
                  <div className="settings-field-group">
                    <label className="settings-field-label">{t('settings.outputDevice')}</label>
                    <div className="settings-select-wrapper">
                      <select 
                        className="settings-select"
                        value={selectedOutput}
                        onChange={e => setSelectedOutput(e.target.value)}
                      >
                        <option value="">{t('settings.defaultDevice')}</option>
                        {audioOutputs.map(device => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Alto-falante (${device.deviceId.slice(0, 5)}...)`}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="settings-select-chevron" />
                    </div>

                    {/* Volume Principal */}
                    <div className="settings-field-group" style={{ marginTop: '0.45rem' }}>
                      <div className="settings-slider-header">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Volume2 size={15} color="#94a3b8" />
                          {t('settings.outputVolume')}
                        </span>
                        <span className="settings-slider-value">{outputVolume}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={outputVolume}
                        onChange={e => setOutputVolume(Number(e.target.value))}
                        className="settings-range-input"
                      />
                    </div>

                    {/* Botão de Som de Teste */}
                    <button 
                      className="settings-test-audio-btn"
                      onClick={handlePlayTestSound}
                      disabled={isTestingAudio}
                    >
                      <PlayCircle size={16} color="#34d399" />
                      <span>{isTestingAudio ? t('settings.testingSound') : t('settings.testHeadphones')}</span>
                    </button>
                  </div>
                </div>

                {/* Seção Processamento Neural & DSP */}
                <div className="settings-field-group" style={{ marginTop: '0.5rem' }}>
                  <div className="settings-section-title">{t('settings.dspTitle')}</div>

                  {/* Crisp AI Noise Suppression */}
                  <div className="settings-neural-card">
                    <div className="settings-neural-icon">
                      <Sparkles size={22} />
                    </div>
                    <div className="settings-neural-info">
                      <div className="settings-neural-title-row">
                        <span className="settings-neural-title">{t('settings.noiseSuppression')}</span>
                        <span className="settings-neural-badge">RECOMENDADO</span>
                      </div>
                      <div className="settings-neural-desc">
                        {t('settings.noiseSuppressionDesc')}
                      </div>
                    </div>
                    <button 
                      type="button"
                      className={`settings-switch ${noiseSuppression ? 'active' : ''}`}
                      onClick={() => setNoiseSuppression(!noiseSuppression)}
                      aria-label="Alternar Crisp AI Noise Suppression"
                    >
                      <span className="settings-switch-thumb" />
                    </button>
                  </div>

                  {/* Subcards de Cancelamento de Eco e Ganho */}
                  <div className="settings-subcards-grid">
                    <div 
                      className="settings-subcard"
                      onClick={() => setEchoCancellation(!echoCancellation)}
                    >
                      <div>
                        <div className="settings-subcard-title">{t('settings.echoCancellation')}</div>
                        <div className="settings-subcard-desc">{t('settings.echoCancellationDesc')}</div>
                      </div>
                      <div className={`settings-checkbox ${echoCancellation ? 'checked' : ''}`}>
                        <Check size={14} strokeWidth={3} />
                      </div>
                    </div>

                    <div 
                      className="settings-subcard"
                      onClick={() => setAutoGainControl(!autoGainControl)}
                    >
                      <div>
                        <div className="settings-subcard-title">{t('settings.autoGain')}</div>
                        <div className="settings-subcard-desc">{t('settings.autoGainDesc')}</div>
                      </div>
                      <div className={`settings-checkbox ${autoGainControl ? 'checked' : ''}`}>
                        <Check size={14} strokeWidth={3} />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === SettingsTabEnum.APPEARANCE && (
              <div className="settings-field-group" style={{ gap: '1.25rem' }}>
                <div className="settings-field-group">
                  <label className="settings-field-label">{t('settings.language')}</label>
                  <div className="settings-select-wrapper">
                    <select 
                      className="settings-select"
                      value={i18n.language}
                      onChange={e => {
                        i18n.changeLanguage(e.target.value);
                        localStorage.setItem(StorageKeys.LANGUAGE, e.target.value);
                      }}
                    >
                      <option value={LanguageEnum.PT}>Português (Brasil)</option>
                      <option value={LanguageEnum.EN}>English (US)</option>
                    </select>
                    <ChevronDown size={16} className="settings-select-chevron" />
                  </div>
                </div>

                <div className="settings-field-group">
                  <label className="settings-field-label">{t('settings.theme')}</label>
                  <div className="settings-subcard" style={{ cursor: 'default' }}>
                    <div>
                      <div className="settings-subcard-title">Obsidian Mint</div>
                      <div className="settings-subcard-desc">Dark Glass</div>
                    </div>
                    <span className="settings-neural-badge">ATIVO</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === SettingsTabEnum.NOTIFICATIONS && (
              <div className="settings-field-group" style={{ gap: '1rem' }}>
                <div 
                  className="settings-subcard"
                  onClick={() => setNotifyMessages(!notifyMessages)}
                >
                  <div>
                    <div className="settings-subcard-title">{t('settings.desktopNotifications')}</div>
                    <div className="settings-subcard-desc">{t('settings.desktopNotificationsDesc')}</div>
                  </div>
                  <div className={`settings-checkbox ${notifyMessages ? 'checked' : ''}`}>
                    <Check size={14} strokeWidth={3} />
                  </div>
                </div>

                <div 
                  className="settings-subcard"
                  onClick={() => setNotifySounds(!notifySounds)}
                >
                  <div>
                    <div className="settings-subcard-title">{t('settings.alertSounds')}</div>
                    <div className="settings-subcard-desc">{t('settings.alertSoundsDesc')}</div>
                  </div>
                  <div className={`settings-checkbox ${notifySounds ? 'checked' : ''}`}>
                    <Check size={14} strokeWidth={3} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === SettingsTabEnum.PRIVACY && (
              <div className="settings-field-group" style={{ gap: '1rem' }}>
                <div 
                  className="settings-subcard"
                  onClick={() => setGamePresence(!gamePresence)}
                >
                  <div>
                    <div className="settings-subcard-title">{t('settings.gameDetection')}</div>
                    <div className="settings-subcard-desc">{t('settings.gameDetectionDesc')}</div>
                  </div>
                  <div className={`settings-checkbox ${gamePresence ? 'checked' : ''}`}>
                    <Check size={14} strokeWidth={3} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === SettingsTabEnum.KEYBINDS && (
              <div className="settings-field-group" style={{ gap: '0.85rem' }}>
                <div className="settings-subcard" style={{ cursor: 'default' }}>
                  <div>
                    <div className="settings-subcard-title">{t('settings.muteKeybind')}</div>
                    <div className="settings-subcard-desc">{t('settings.muteKeybindDesc')}</div>
                  </div>
                  <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    Ctrl + Shift + M
                  </kbd>
                </div>

                <div className="settings-subcard" style={{ cursor: 'default' }}>
                  <div>
                    <div className="settings-subcard-title">{t('settings.deafenKeybind')}</div>
                    <div className="settings-subcard-desc">{t('settings.deafenKeybindDesc')}</div>
                  </div>
                  <kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    Ctrl + Shift + D
                  </kbd>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="settings-footer">
          <button className="settings-restore-btn" onClick={handleRestoreDefaults}>
            <RotateCcw size={14} />
            <span>{t('settings.resetFilters')}</span>
          </button>

          <div className="settings-footer-actions">
            <button className="settings-cancel-btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button className="settings-save-btn" onClick={handleSave}>
              <Check size={16} strokeWidth={2.5} />
              <span>{t('common.save')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SettingsModal;
