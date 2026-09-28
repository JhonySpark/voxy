import React from 'react';
import styles from './StreamSettingsMenu.module.css';
import { Volume2, VolumeX, Eye, EyeOff } from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import { useClickOutside } from '../../../../hooks/useClickOutside';

interface StreamSettingsMenuProps {
  isOpen: boolean;
  participantId: string;
  isWatching: boolean;
  streamVolume: number;
  onVolumeChange: (val: number) => void;
  onToggleWatch: () => void;
  onClose: () => void;
}

export const StreamSettingsMenu: React.FC<StreamSettingsMenuProps> = ({
  isOpen,
  isWatching,
  streamVolume,
  onVolumeChange,
  onToggleWatch,
  onClose,
}) => {
  const menuRef = useClickOutside<HTMLDivElement>(onClose, isOpen);

  if (!isOpen) return null;

  const isMuted = streamVolume === 0;

  return (
    <div ref={menuRef} className={styles.menuContainer} onClick={(e) => e.stopPropagation()}>
      <div className={styles.menuHeader}>
        <span>Configurações da Transmissão</span>
      </div>

      <div className={styles.volumeSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className={styles.label}>Volume da Transmissão</label>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{streamVolume}%</span>
        </div>
        <Slider.Root
          className="slider-root"
          value={[streamVolume]}
          max={200}
          step={1}
          onValueChange={(vals) => onVolumeChange(vals[0])}
        >
          <Slider.Track className="slider-track">
            <Slider.Range className="slider-range" />
          </Slider.Track>
          <Slider.Thumb className="slider-thumb" />
        </Slider.Root>
      </div>

      <button
        type="button"
        className={styles.muteButton}
        onClick={() => onVolumeChange(isMuted ? 100 : 0)}
      >
        {isMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}
        <span>{isMuted ? 'Desmutar Transmissão' : 'Mutar Transmissão'}</span>
      </button>

      <button
        type="button"
        className={`${styles.watchButton} ${isWatching ? styles.stopWatch : styles.startWatch}`}
        onClick={() => {
          onToggleWatch();
          onClose();
        }}
      >
        {isWatching ? <EyeOff size={16} /> : <Eye size={16} />}
        <span>{isWatching ? 'Parar de Assistir' : 'Assistir Transmissão'}</span>
      </button>
    </div>
  );
};
