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
  RefreshCw,
  User,
  KeyRound,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { ipcRenderer } from 'electron';
import { useTranslation } from 'react-i18next';
import packageJson from '../../package.json';
import { SettingsTabEnum, StorageKeys, IpcChannels, LanguageEnum, ApiRoutes } from '../core/enums';
import { httpClient } from '../infrastructure/adapters/http/http-client.adapter';
import type { UserProfileData } from '../features/user/components/UserPopout/UserPopout';
import { getMediaUrl } from '../core/utils/media.util';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceChange?: (inputDevice: string, outputDevice: string) => void;
  initialTab?: SettingsTabEnum;
  currentUser?: UserProfileData | null;
  onOpenEditProfile?: () => void;
  onProfileUpdated?: (updated: Partial<UserProfileData>) => void;
  onLogout?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onDeviceChange,
  initialTab,
  currentUser,
  onOpenEditProfile,
  onProfileUpdated,
  onLogout,
}) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTabEnum>(initialTab || SettingsTabEnum.VOICE);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Alteração de Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  // Revalidação de Idade (Age Signals)
  const [isRevalidatingAge, setIsRevalidatingAge] = useState(false);
  const [ageFeedback, setAgeFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleRevalidateAge = async () => {
    setIsRevalidatingAge(true);
    setAgeFeedback(null);
    try {
      let osSignal = { available: false };
      if (ipcRenderer) {
        try {
          const raw = await ipcRenderer.invoke(IpcChannels.GET_OS_AGE_SIGNAL);
          if (raw) {
            osSignal = typeof raw === 'string' ? JSON.parse(raw) : raw;
          }
        } catch (ipcErr) {
          console.warn('[Age Signals] Falha ao coletar sinal nativo:', ipcErr);
        }
      }

      const res = await httpClient.post<{
        success: boolean;
        user: UserProfileData;
        changed: boolean;
      }>(ApiRoutes.AUTH_SYNC_AGE_SIGNAL, { signal: osSignal });

      if (res?.success && res.user) {
        const updatedUser = res.user;
        onProfileUpdated?.(updatedUser);

        if (updatedUser.ageClassification === 'CHILD') {
          setAgeFeedback({
            type: 'error',
            message: 'Classificação detectada como Menor de Idade (<13 anos). O uso da plataforma é restrito.',
          });
          setTimeout(() => {
            onClose();
            onLogout?.();
          }, 3000);
          return;
        }

        const oldClass = currentUser?.ageClassification || 'UNKNOWN';
        const newClass = updatedUser.ageClassification;

        if (oldClass !== newClass) {
          setAgeFeedback({
            type: 'success',
            message: `Faixa etária atualizada com sucesso para ${
              newClass === 'ADULT' ? 'Adulto (+18)' : newClass === 'TEEN' ? 'Jovem (13-17 anos)' : newClass
            }! Suas permissões foram atualizadas.`,
          });
        } else {
          setAgeFeedback({
            type: 'info',
            message: `Sua faixa etária já está sincronizada (${
              newClass === 'ADULT' ? 'Adulto +18' : newClass === 'TEEN' ? 'Jovem 13-17 anos' : 'Padrão'
            }). Nenhuma alteração foi necessária.`,
          });
        }
      } else {
        setAgeFeedback({
          type: 'error',
          message: 'Não foi possível revalidar a idade no momento.',
        });
      }
    } catch (err: any) {
      setAgeFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Falha ao revalidar sinal de idade.',
      });
    } finally {
      setIsRevalidatingAge(false);
    }
  };

  useEffect(() => {
    setAvatarError(false);
  }, [currentUser?.avatarUrl]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'Preencha todos os campos.' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', message: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'As senhas não coincidem.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await httpClient.patch(ApiRoutes.USERS_CHANGE_PASSWORD, {
        currentPassword,
        newPassword,
      });
      setPasswordFeedback({ type: 'success', message: 'Senha alterada com sucesso!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Erro ao alterar senha. Verifique sua senha atual.',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

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
  const [runInBackground, setRunInBackground] = useState<boolean>(
    localStorage.getItem(StorageKeys.RUN_IN_BACKGROUND) === 'true'
  );
  const [gamePresence, setGamePresence] = useState<boolean>(
    localStorage.getItem(StorageKeys.GAME_PRESENCE) !== 'false'
  );

  useEffect(() => {
    ipcRenderer?.invoke(IpcChannels.GET_BACKGROUND_MODE)
      .then((enabled: boolean) => setRunInBackground(enabled === true))
      .catch(() => undefined);
  }, []);

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
    localStorage.setItem(StorageKeys.RUN_IN_BACKGROUND, runInBackground.toString());
    localStorage.setItem(StorageKeys.GAME_PRESENCE, gamePresence.toString());
    ipcRenderer?.send(IpcChannels.SET_BACKGROUND_MODE, runInBackground);

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
              <div className="settings-sidebar-section">{t('settings.userSettings', 'Configurações de Usuário')}</div>
              <button 
                className={`settings-tab-btn ${activeTab === SettingsTabEnum.ACCOUNT ? 'active' : ''}`}
                onClick={() => setActiveTab(SettingsTabEnum.ACCOUNT)}
              >
                <User size={16} />
                <span>{t('settings.myAccount', 'Minha Conta')}</span>
              </button>

              <div className="settings-sidebar-section" style={{ marginTop: '0.75rem' }}>{t('settings.devices')}</div>
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
            {activeTab === SettingsTabEnum.ACCOUNT && (
              <div className="account-container">
                {/* Card Visual de Perfil */}
                <div className="account-profile-card">
                  <div 
                    className="account-banner"
                    style={{
                      backgroundColor: currentUser?.bannerColor || '#1e293b',
                    }}
                  >
                    {getMediaUrl(currentUser?.bannerUrl) && (
                      <img
                        src={getMediaUrl(currentUser?.bannerUrl)}
                        alt="Banner"
                        className="account-banner-img"
                        loading="eager"
                        decoding="async"
                      />
                    )}
                  </div>
                  <div className="account-profile-body">
                    <div className="account-profile-left">
                      <div className="account-avatar-wrapper">
                        {getMediaUrl(currentUser?.avatarUrl) && !avatarError ? (
                          <img 
                            src={getMediaUrl(currentUser?.avatarUrl)} 
                            alt={currentUser?.displayName || currentUser?.username} 
                            className="account-avatar-img" 
                            onError={() => setAvatarError(true)}
                          />
                        ) : (
                          <div className="account-avatar-fallback">
                            {(currentUser?.displayName || currentUser?.username || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="account-names">
                        <div className="account-display-name">
                          {currentUser?.displayName || currentUser?.username || 'Usuário'}
                        </div>
                        <div className="account-username">
                          @{currentUser?.username || 'usuario'}
                        </div>
                      </div>
                    </div>

                    {onOpenEditProfile && (
                      <button 
                        type="button" 
                        className="account-edit-profile-btn"
                        onClick={onOpenEditProfile}
                      >
                        <Sparkles size={14} />
                        <span>{t('user.editProfile', 'Editar Perfil de Usuário')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Informações da Conta */}
                <div className="account-section">
                  <span className="account-section-title">{t('user.accountDetails', 'Dados da Conta')}</span>
                  <div className="account-info-box">
                    <div className="account-info-row">
                      <span className="account-info-label">{t('user.displayName', 'Nome de exibição')}</span>
                      <span className="account-info-value">{currentUser?.displayName || 'Não definido'}</span>
                    </div>
                    <div className="account-info-row">
                      <span className="account-info-label">{t('user.username', 'Nome de usuário')}</span>
                      <span className="account-info-value">@{currentUser?.username || '-'}</span>
                    </div>
                    <div className="account-info-row">
                      <span className="account-info-label">{t('user.email', 'E-mail')}</span>
                      <span className="account-info-value">{currentUser?.email || '••••••••@••••.com'}</span>
                    </div>
                  </div>
                </div>

                {/* Faixa Etária e Proteção (Age Signals) */}
                <div className="account-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="account-section-title">
                      {t('user.ageSignalsTitle', 'Classificação Etária & Proteção Legal')}
                    </span>
                    <span className={`account-age-pill ${currentUser?.ageClassification || 'UNKNOWN'}`}>
                      {currentUser?.ageClassification === 'ADULT'
                        ? 'Adulto (+18)'
                        : currentUser?.ageClassification === 'TEEN'
                        ? 'Jovem (13-17 anos)'
                        : currentUser?.ageClassification === 'CHILD'
                        ? 'Menor (<13 anos)'
                        : 'Padrão / Desconhecido'}
                    </span>
                  </div>

                  <div className="account-info-box">
                    <div className="account-info-row">
                      <span className="account-info-label">Permissões de Transmissão</span>
                      <span className="account-info-value">
                        {currentUser?.ageClassification === 'ADULT'
                          ? 'Transmissão de Jogos e Compartilhamento de Telas Gerais'
                          : currentUser?.ageClassification === 'TEEN'
                          ? 'Apenas Transmissão de Jogos Detectados (Telas e Janelas Gerais Desativadas)'
                          : 'Acesso Restrito'}
                      </span>
                    </div>

                    <div className="account-info-row">
                      <span className="account-info-label">Servidores e Streams +18</span>
                      <span className="account-info-value" style={{ color: currentUser?.ageClassification === 'ADULT' ? '#34d399' : '#f87171' }}>
                        {currentUser?.ageClassification === 'ADULT' ? 'Permitido (+18)' : 'Bloqueado (Restrito a Maiores)'}
                      </span>
                    </div>

                    <div className="account-info-row">
                      <span className="account-info-label">Origem do Sinal</span>
                      <span className="account-info-value">
                        {currentUser?.ageSignalSource === 'WINDOWS_OS'
                          ? 'Windows 11 OS (WinRT Age Signal)'
                          : currentUser?.ageSignalSource === 'DECLARED'
                          ? 'Data de Nascimento Declarada'
                          : 'Padrão / Nenhum'}
                      </span>
                    </div>

                    {currentUser?.birthDate && (
                      <div className="account-info-row">
                        <span className="account-info-label">Data de Nascimento</span>
                        <span className="account-info-value">
                          {new Date(currentUser.birthDate).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    )}
                  </div>

                  {ageFeedback && (
                    <div className={`account-feedback ${ageFeedback.type === 'info' ? 'success' : ageFeedback.type}`}>
                      {ageFeedback.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                      <span>{ageFeedback.message}</span>
                    </div>
                  )}

                  <div className="account-password-actions" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Completou 18 anos ou atualizou sua conta Microsoft? Revalide os sinais.
                    </span>
                    <button
                      type="button"
                      className="account-revalidate-btn"
                      onClick={handleRevalidateAge}
                      disabled={isRevalidatingAge}
                    >
                      <RefreshCw size={14} className={isRevalidatingAge ? 'spin-animation' : ''} />
                      <span>{isRevalidatingAge ? 'Revalidando...' : 'Revalidar idade'}</span>
                    </button>
                  </div>
                </div>

                {/* Segurança / Alterar Senha */}
                <div className="account-section">
                  <span className="account-section-title">{t('user.securityTitle', 'Segurança e Senha')}</span>
                  <form onSubmit={handleChangePassword} className="account-password-form">
                    {passwordFeedback && (
                      <div className={`account-feedback ${passwordFeedback.type}`}>
                        {passwordFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        <span>{passwordFeedback.message}</span>
                      </div>
                    )}

                    <div className="account-input-group">
                      <label className="account-input-label">{t('user.currentPassword', 'Senha atual')}</label>
                      <input
                        type="password"
                        className="account-input"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Digite sua senha atual"
                        autoComplete="current-password"
                      />
                    </div>

                    <div className="account-input-group">
                      <label className="account-input-label">{t('user.newPassword', 'Nova senha')}</label>
                      <input
                        type="password"
                        className="account-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo de 6 caracteres"
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="account-input-group">
                      <label className="account-input-label">{t('user.confirmPassword', 'Confirmar nova senha')}</label>
                      <input
                        type="password"
                        className="account-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirme a nova senha"
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="account-password-actions">
                      <button
                        type="submit"
                        className="account-change-pwd-btn"
                        disabled={isChangingPassword}
                      >
                        <KeyRound size={14} />
                        <span>{isChangingPassword ? 'Salvando...' : t('user.updatePassword', 'Atualizar Senha')}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

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

                <div
                  className="settings-subcard"
                  onClick={() => setRunInBackground(!runInBackground)}
                >
                  <div>
                    <div className="settings-subcard-title">Executar em segundo plano</div>
                    <div className="settings-subcard-desc">Ao fechar a janela, manter o Voxy no ícone perto do relógio do Windows.</div>
                  </div>
                  <div className={`settings-checkbox ${runInBackground ? 'checked' : ''}`}>
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
