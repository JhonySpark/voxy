import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Volume2, PlayCircle, Sparkles, Check, RotateCcw } from 'lucide-react';
import { Button } from '../../common/Button';
import styles from './VoiceTab.module.css';

export interface VoiceTabProps {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  selectedInput: string;
  selectedOutput: string;
  onInputDeviceChange: (deviceId: string) => void;
  onOutputDeviceChange: (deviceId: string) => void;
  inputSensitivity: number;
  onInputSensitivityChange: (val: number) => void;
  outputVolume: number;
  onOutputVolumeChange: (val: number) => void;
  dbLevel: string;
  activeSegments: number;
  totalSegments?: number;
  isTestingAudio: boolean;
  onPlayTestSound: () => void;
  noiseSuppression: boolean;
  onToggleNoiseSuppression: () => void;
  echoCancellation: boolean;
  onToggleEchoCancellation: () => void;
  autoGainControl: boolean;
  onToggleAutoGainControl: () => void;
  onRestoreDefaults?: () => void;
}

export const VoiceTab: React.FC<VoiceTabProps> = ({
  audioInputs,
  audioOutputs,
  selectedInput,
  selectedOutput,
  onInputDeviceChange,
  onOutputDeviceChange,
  inputSensitivity,
  onInputSensitivityChange,
  outputVolume,
  onOutputVolumeChange,
  dbLevel,
  activeSegments,
  totalSegments = 28,
  isTestingAudio,
  onPlayTestSound,
  noiseSuppression,
  onToggleNoiseSuppression,
  echoCancellation,
  onToggleEchoCancellation,
  autoGainControl,
  onToggleAutoGainControl,
  onRestoreDefaults,
}) => {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <div className={styles.grid2}>
        {/* Entrada */}
        <div className={styles.column}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>{t('settings.inputDevice')}</label>
            <div className={styles.selectWrapper}>
              <select
                className={styles.select}
                value={selectedInput}
                onChange={(e) => onInputDeviceChange(e.target.value)}
              >
                <option value="">{t('settings.defaultDevice')}</option>
                {audioInputs.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || t('settings.defaultMicLabel', { id: device.deviceId.slice(0, 5) })}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className={styles.selectChevron} />
            </div>
          </div>

          {/* Teste do Microfone */}
          <div className={styles.meterBox}>
            <div className={styles.meterHeader}>
              <span className={styles.meterTitle}>{t('settings.micTest')}</span>
              <span className={styles.meterDb}>{dbLevel}</span>
            </div>
            <div className={styles.meterTrack}>
              {Array.from({ length: totalSegments }).map((_, idx) => (
                <div
                  key={idx}
                  className={`${styles.meterSegment} ${
                    idx < activeSegments ? styles.meterSegmentActive : ''
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Sensibilidade de Entrada */}
          <div className={styles.fieldGroup}>
            <div className={styles.sliderHeader}>
              <span>{t('settings.micSensitivity')}</span>
              <span className={styles.sliderValue}>{inputSensitivity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={inputSensitivity}
              onChange={(e) => onInputSensitivityChange(Number(e.target.value))}
              className={styles.rangeInput}
            />
          </div>
        </div>

        {/* Saída */}
        <div className={styles.column}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>{t('settings.outputDevice')}</label>
            <div className={styles.selectWrapper}>
              <select
                className={styles.select}
                value={selectedOutput}
                onChange={(e) => onOutputDeviceChange(e.target.value)}
              >
                <option value="">{t('settings.defaultDevice')}</option>
                {audioOutputs.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || t('settings.defaultSpeakerLabel', { id: device.deviceId.slice(0, 5) })}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className={styles.selectChevron} />
            </div>
          </div>

          {/* Volume Principal */}
          <div className={styles.fieldGroup}>
            <div className={styles.sliderHeader}>
              <span className={styles.sliderLabelWithIcon}>
                <Volume2 size={15} />
                {t('settings.outputVolume')}
              </span>
              <span className={styles.sliderValue}>{outputVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={outputVolume}
              onChange={(e) => onOutputVolumeChange(Number(e.target.value))}
              className={styles.rangeInput}
            />
          </div>

          {/* Botão de Som de Teste */}
          <Button
            type="button"
            variant="secondary"
            size="md"
            fullWidth
            onClick={onPlayTestSound}
            disabled={isTestingAudio}
            leftIcon={<PlayCircle size={16} color="var(--brand-primary)" />}
          >
            {isTestingAudio ? t('settings.testingSound') : t('settings.testHeadphones')}
          </Button>
        </div>
      </div>

      {/* DSP & Neural Card */}
      <div className={styles.dspSection}>
        <div className={styles.sectionHeader}>{t('settings.dspTitle')}</div>

        <div className={styles.neuralCard}>
          <div className={styles.neuralIcon}>
            <Sparkles size={22} />
          </div>
          <div className={styles.neuralInfo}>
            <div className={styles.neuralTitleRow}>
              <span className={styles.neuralTitle}>{t('settings.noiseSuppression')}</span>
              <span className={styles.neuralBadge}>{t('common.recommended')}</span>
            </div>
            <div className={styles.neuralDesc}>{t('settings.noiseSuppressionDesc')}</div>
          </div>
          <button
            type="button"
            className={`${styles.switch} ${noiseSuppression ? styles.switchActive : ''}`}
            onClick={onToggleNoiseSuppression}
            aria-label={t('settings.noiseSuppressionAria')}
          >
            <span className={styles.switchThumb} />
          </button>
        </div>

        {/* Subcards de Cancelamento de Eco e Ganho */}
        <div className={styles.subcardsGrid}>
          <div className={styles.subcard} onClick={onToggleEchoCancellation}>
            <div>
              <div className={styles.subcardTitle}>{t('settings.echoCancellation')}</div>
              <div className={styles.subcardDesc}>{t('settings.echoCancellationDesc')}</div>
            </div>
            <div
              className={`${styles.checkbox} ${echoCancellation ? styles.checkboxChecked : ''}`}
            >
              <Check size={14} strokeWidth={3} />
            </div>
          </div>

          <div className={styles.subcard} onClick={onToggleAutoGainControl}>
            <div>
              <div className={styles.subcardTitle}>{t('settings.autoGain')}</div>
              <div className={styles.subcardDesc}>{t('settings.autoGainDesc')}</div>
            </div>
            <div className={`${styles.checkbox} ${autoGainControl ? styles.checkboxChecked : ''}`}>
              <Check size={14} strokeWidth={3} />
            </div>
          </div>
        </div>
      </div>

      {onRestoreDefaults && (
        <div className={styles.tabActions}>
          <button
            type="button"
            className={styles.resetBtn}
            onClick={onRestoreDefaults}
          >
            <RotateCcw size={14} />
            <span>{t('settings.resetFilters')}</span>
          </button>
        </div>
      )}
    </div>
  );
};
