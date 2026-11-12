import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  Palette,
  Bell,
  Shield,
  Keyboard,
  X,
  User,
  RefreshCw,
} from "lucide-react";
import { ipcRenderer } from "electron";
import { useTranslation } from "react-i18next";
import packageJson from "../../../package.json";
import { Button } from "../common/Button";
import { SettingsTabEnum, StorageKeys, IpcChannels } from "../../core/enums";
import type { UserProfileData } from "../../features/user/components/UserPopout/UserPopout";
import { useNotificationSettings } from "../../features/user/hooks/useNotificationSettings";
import { useVoiceAudioSettings } from "../../features/voice/hooks/useVoiceAudioSettings";
import { VoxyNeuralAudioProcessor } from "../../features/voice/services/voxy-neural-audio-processor";
import { soundService } from "../../core/services/sound.service";
import { VoiceTab } from "./tabs/VoiceTab";
import { AccountTab } from "./tabs/AccountTab";
import { AppearanceTab } from "./tabs/AppearanceTab";
import { NotificationsTab } from "./tabs/NotificationsTab";
import { PrivacyTab } from "./tabs/PrivacyTab";
import { KeybindsTab } from "./tabs/KeybindsTab";
import styles from "./SettingsModal.module.css";

export interface SettingsModalProps {
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
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTabEnum>(
    initialTab || SettingsTabEnum.ACCOUNT,
  );

  useEffect(() => {
    setActiveTab(initialTab || SettingsTabEnum.ACCOUNT);
  }, [initialTab, isOpen]);

  const APP_VERSION = `v${packageJson.version}`;

  // Audio State & Settings
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const {
    settings: voiceSettings,
    updateSettings: updateVoiceSettings,
    restoreDefaults: restoreVoiceDefaults,
  } = useVoiceAudioSettings();
  const {
    selectedInput,
    selectedOutput,
    inputSensitivity,
    outputVolume,
    noiseSuppression,
    echoCancellation,
    autoGainControl,
  } = voiceSettings;

  // Notifications & Background
  const { settings: notifSettings, updateSettings: updateNotifSettings } =
    useNotificationSettings();
  const [runInBackground, setRunInBackground] = useState<boolean>(
    localStorage.getItem(StorageKeys.RUN_IN_BACKGROUND) !== "false",
  );
  const [autoLaunch, setAutoLaunch] = useState<boolean>(
    localStorage.getItem(StorageKeys.AUTO_LAUNCH) !== "false",
  );
  const [gamePresence, setGamePresence] = useState<boolean>(
    localStorage.getItem(StorageKeys.GAME_PRESENCE) !== "false",
  );

  // Audio Meter
  const [dbLevel, setDbLevel] = useState<string>("-48.0 dB");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isTestingAudio, setIsTestingAudio] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const micProcessorRef = useRef<VoxyNeuralAudioProcessor | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // App Update
  const [checkingUpdate, setCheckingUpdate] = useState<boolean>(false);
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null);

  useEffect(() => {
    ipcRenderer
      ?.invoke(IpcChannels.GET_BACKGROUND_MODE)
      .then((enabled: boolean) => setRunInBackground(enabled !== false))
      .catch(() => undefined);
    ipcRenderer
      ?.invoke(IpcChannels.GET_AUTO_LAUNCH)
      .then((enabled: boolean) => setAutoLaunch(enabled !== false))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter((d) => d.kind === "audioinput"));
        setAudioOutputs(devices.filter((d) => d.kind === "audiooutput"));
      } catch (err) {
        console.error("Erro ao listar dispositivos:", err);
      }
    };
    loadDevices();
    navigator.mediaDevices.addEventListener("devicechange", loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", loadDevices);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeTab !== SettingsTabEnum.VOICE) {
      stopMicMonitoring();
      return;
    }
    startMicMonitoring();
    return () => stopMicMonitoring();
  }, [isOpen, activeTab, selectedInput]);

  const stopMicMonitoring = () => {
    if (animationFrameRef.current)
      cancelAnimationFrame(animationFrameRef.current);
    if (micProcessorRef.current) {
      void micProcessorRef.current.destroy();
      micProcessorRef.current = null;
    }
    if (mediaStreamRef.current)
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => undefined);
    }
    setAudioLevel(0);
    setDbLevel("-48.0 dB");
  };

  const startMicMonitoring = async () => {
    try {
      stopMicMonitoring();
      const constraints: MediaStreamConstraints = {
        audio: {
          ...(selectedInput ? { deviceId: { exact: selectedInput } } : {}),
          echoCancellation,
          noiseSuppression,
          autoGainControl,
          sampleRate: 48000,
          channelCount: 1,
        },
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: 48000 });
      audioContextRef.current = ctx;

      const rawTrack = stream.getAudioTracks()[0];
      const processor = new VoxyNeuralAudioProcessor();
      micProcessorRef.current = processor;
      const processedNode = await processor.connectToContext(ctx, rawTrack);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      processedNode.connect(analyser);

      const timeData = new Float32Array(analyser.fftSize);

      const updateMeter = () => {
        if (!mediaStreamRef.current) return;
        analyser.getFloatTimeDomainData(timeData);
        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          sumSq += timeData[i] * timeData[i];
        }
        const rms = Math.sqrt(sumSq / timeData.length);
        const rmsDb = rms > 1e-6 ? 20 * Math.log10(rms) : -60;
        const clampedDb = Math.max(-48, Math.min(0, rmsDb));
        const normalized = Math.round(((clampedDb + 48) / 48) * 100);
        setAudioLevel(normalized);

        if (normalized <= 2) {
          setDbLevel("-48.0 dB");
        } else {
          setDbLevel(`${clampedDb.toFixed(1)} dB`);
        }
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (err) {
      console.warn("Microfone não acessível para monitoramento:", err);
    }
  };

  const handlePlayTestSound = () => {
    setIsTestingAudio(true);
    soundService.testSound();
    setTimeout(() => setIsTestingAudio(false), 800);
  };

  const handleCheckUpdate = async () => {
    if (!ipcRenderer) return;
    try {
      setCheckingUpdate(true);
      const res = await ipcRenderer.invoke(IpcChannels.CHECK_FOR_UPDATES);
      if (res?.status === "windows_store") return;
      if (res?.status === "ok") {
        const remoteVer = res.updateInfo?.version;
        setUpdateFeedback(
          remoteVer && remoteVer !== APP_VERSION.replace("v", "")
            ? t("settings.updateFound", { version: remoteVer })
            : t("settings.latestVersion"),
        );
      } else {
        setUpdateFeedback(t("settings.devMode"));
      }
    } catch {
      setUpdateFeedback(t("settings.updateFailed"));
    } finally {
      setCheckingUpdate(false);
      setTimeout(() => setUpdateFeedback(null), 4000);
    }
  };

  const handleRestoreDefaults = () => {
    restoreVoiceDefaults();
  };

  if (!isOpen) return null;

  const TOTAL_SEGMENTS = 28;
  const activeSegments = Math.round((audioLevel / 100) * TOTAL_SEGMENTS);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.container} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>
              <Mic size={20} />
            </div>
            <div>
              <div className={styles.headerTitle}>{t("settings.title")}</div>
              <div className={styles.headerSubtitle}>
                {t("settings.subtitle", { version: APP_VERSION })}
              </div>
            </div>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Sidebar */}
          <div className={styles.sidebar}>
            <div className={styles.sidebarNav}>
              <button
                className={`${styles.tabBtn} ${activeTab === SettingsTabEnum.ACCOUNT ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab(SettingsTabEnum.ACCOUNT)}
              >
                <User size={16} />
                <span>{t("settings.myAccount")}</span>
              </button>

              <button
                className={`${styles.tabBtn} ${activeTab === SettingsTabEnum.VOICE ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab(SettingsTabEnum.VOICE)}
              >
                <Mic size={16} />
                <span>{t("settings.voiceAndVideo")}</span>
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === SettingsTabEnum.APPEARANCE ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab(SettingsTabEnum.APPEARANCE)}
              >
                <Palette size={16} />
                <span>{t("settings.appearance")}</span>
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === SettingsTabEnum.NOTIFICATIONS ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab(SettingsTabEnum.NOTIFICATIONS)}
              >
                <Bell size={16} />
                <span>{t("settings.notifications")}</span>
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === SettingsTabEnum.PRIVACY ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab(SettingsTabEnum.PRIVACY)}
              >
                <Shield size={16} />
                <span>{t("settings.privacy")}</span>
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === SettingsTabEnum.KEYBINDS ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab(SettingsTabEnum.KEYBINDS)}
              >
                <Keyboard size={16} />
                <span>{t("settings.keybinds")}</span>
              </button>
            </div>

            <div className={styles.sidebarFooter}>
              <div className={styles.dspIndicator}>
                <span className={styles.dspDot} />
                <span>{t("settings.dspInfo")}</span>
              </div>
              <div className={styles.versionPill}>
                <span>{t("settings.appVersion")}</span>
                <span className={styles.versionTag}>{APP_VERSION}</span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                fullWidth
                onClick={handleCheckUpdate}
                disabled={checkingUpdate}
                leftIcon={
                  <RefreshCw
                    size={12}
                    className={checkingUpdate ? styles.spinIcon : ""}
                  />
                }
              >
                {updateFeedback || t("settings.checkUpdates")}
              </Button>
            </div>
          </div>

          {/* Content Area */}
          <div className={styles.content}>
            {activeTab === SettingsTabEnum.ACCOUNT && (
              <AccountTab
                currentUser={currentUser}
                onOpenEditProfile={onOpenEditProfile}
                onProfileUpdated={onProfileUpdated}
                onLogout={onLogout}
                onClose={onClose}
              />
            )}
            {activeTab === SettingsTabEnum.VOICE && (
              <VoiceTab
                audioInputs={audioInputs}
                audioOutputs={audioOutputs}
                selectedInput={selectedInput}
                selectedOutput={selectedOutput}
                onInputDeviceChange={(dev) => {
                  updateVoiceSettings({ selectedInput: dev });
                  onDeviceChange?.(dev, selectedOutput);
                }}
                onOutputDeviceChange={(dev) => {
                  updateVoiceSettings({ selectedOutput: dev });
                  onDeviceChange?.(selectedInput, dev);
                }}
                inputSensitivity={inputSensitivity}
                onInputSensitivityChange={(val) => {
                  updateVoiceSettings({ inputSensitivity: val });
                }}
                outputVolume={outputVolume}
                onOutputVolumeChange={(val) => {
                  updateVoiceSettings({ outputVolume: val });
                }}
                dbLevel={dbLevel}
                activeSegments={activeSegments}
                totalSegments={TOTAL_SEGMENTS}
                isTestingAudio={isTestingAudio}
                onPlayTestSound={handlePlayTestSound}
                noiseSuppression={noiseSuppression}
                onToggleNoiseSuppression={() => {
                  updateVoiceSettings({ noiseSuppression: !noiseSuppression });
                }}
                echoCancellation={echoCancellation}
                onToggleEchoCancellation={() => {
                  updateVoiceSettings({ echoCancellation: !echoCancellation });
                }}
                autoGainControl={autoGainControl}
                onToggleAutoGainControl={() => {
                  updateVoiceSettings({ autoGainControl: !autoGainControl });
                }}
                onRestoreDefaults={handleRestoreDefaults}
              />
            )}
            {activeTab === SettingsTabEnum.APPEARANCE && <AppearanceTab />}
            {activeTab === SettingsTabEnum.NOTIFICATIONS && (
              <NotificationsTab
                notifSettings={notifSettings}
                updateNotifSettings={updateNotifSettings}
                runInBackground={runInBackground}
                onToggleRunInBackground={() => {
                  const next = !runInBackground;
                  setRunInBackground(next);
                  localStorage.setItem(
                    StorageKeys.RUN_IN_BACKGROUND,
                    next.toString(),
                  );
                  ipcRenderer?.send(IpcChannels.SET_BACKGROUND_MODE, next);
                }}
                autoLaunch={autoLaunch}
                onToggleAutoLaunch={() => {
                  const next = !autoLaunch;
                  setAutoLaunch(next);
                  localStorage.setItem(
                    StorageKeys.AUTO_LAUNCH,
                    next.toString(),
                  );
                  ipcRenderer?.send(IpcChannels.SET_AUTO_LAUNCH, next);
                }}
              />
            )}
            {activeTab === SettingsTabEnum.PRIVACY && (
              <PrivacyTab
                gamePresence={gamePresence}
                onToggleGamePresence={() => {
                  const next = !gamePresence;
                  setGamePresence(next);
                  localStorage.setItem(
                    StorageKeys.GAME_PRESENCE,
                    next.toString(),
                  );
                }}
              />
            )}
            {activeTab === SettingsTabEnum.KEYBINDS && <KeybindsTab />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
