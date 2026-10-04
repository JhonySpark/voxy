import React from 'react';
import styles from './ShareScreenModal.module.css';
import { Gamepad2, AppWindow, Monitor, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon?: string;
  isGame?: boolean;
}

interface ShareScreenModalProps {
  isOpen: boolean;
  userAgeClassification?: 'UNKNOWN' | 'CHILD' | 'TEEN' | 'ADULT';
  categorizedSources: {
    games: DesktopSource[];
    windows: DesktopSource[];
    screens: DesktopSource[];
  };
  streamRes: '720' | '1080';
  streamFps: '30' | '60';
  shareAudio: boolean;
  onStreamResChange: (res: '720' | '1080') => void;
  onStreamFpsChange: (fps: '30' | '60') => void;
  onShareAudioChange: (shareAudio: boolean) => void;
  onSelectSource: (sourceId: string, shareAudio: boolean, is18Plus?: boolean) => void;
  onClose: () => void;
}

export const ShareScreenModal: React.FC<ShareScreenModalProps> = ({
  isOpen,
  userAgeClassification,
  categorizedSources,
  streamRes,
  streamFps,
  shareAudio,
  onStreamResChange,
  onStreamFpsChange,
  onShareAudioChange,
  onSelectSource,
  onClose,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<'games' | 'windows' | 'screens'>('games');
  const [is18Plus, setIs18Plus] = React.useState(false);

  const isTeenOnly = userAgeClassification === 'TEEN';

  React.useEffect(() => {
    if (isOpen) {
      if (isTeenOnly) {
        setActiveTab('games');
      } else if (categorizedSources.games.length > 0) {
        setActiveTab('games');
      } else if (categorizedSources.windows.length > 0) {
        setActiveTab('windows');
      } else {
        setActiveTab('screens');
      }
    }
  }, [isOpen, isTeenOnly]);

  if (!isOpen) return null;

  const currentList =
    activeTab === 'games'
      ? categorizedSources.games
      : activeTab === 'windows'
      ? categorizedSources.windows
      : categorizedSources.screens;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <div className={styles.iconBadge}>
              {activeTab === 'games' ? (
                <Gamepad2 size={24} />
              ) : activeTab === 'windows' ? (
                <AppWindow size={24} />
              ) : (
                <Monitor size={24} />
              )}
            </div>
            <div>
              <h2 className={styles.title}>{t('voice.shareModalTitle')}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                <label className={styles.audioToggle}>
                  <input type="checkbox" checked={shareAudio} onChange={(event) => onShareAudioChange(event.target.checked)} />
                  <span>Compartilhar áudio do jogo/aplicativo</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#94a3b8', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={is18Plus}
                    onChange={(e) => setIs18Plus(e.target.checked)}
                    style={{ accentColor: '#ef4444', width: 14, height: 14 }}
                  />
                  <span style={{
                    backgroundColor: is18Plus ? '#ef4444' : '#334155',
                    color: '#fff',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    fontSize: '0.68rem',
                    fontWeight: 700
                  }}>18+</span>
                  <span>Conteúdo +18 (Usuários menores de idade não conseguirão assistir)</span>
                </label>
              </div>
            </div>
          </div>

          <div className={styles.selectors}>
            <div className={styles.selectBox}>
              <label className={styles.selectLabel}>{t('voice.resolution')}:</label>
              <select
                className={styles.select}
                value={streamRes}
                onChange={(e) => onStreamResChange(e.target.value as any)}
              >
                <option value="720">720p</option>
                <option value="1080">1080p (Pro)</option>
              </select>
            </div>

            <div className={styles.selectBox}>
              <label className={styles.selectLabel}>{t('voice.framerate')}:</label>
              <select
                className={styles.select}
                value={streamFps}
                onChange={(e) => onStreamFpsChange(e.target.value as any)}
              >
                <option value="30">30 FPS</option>
                <option value="60">60 FPS (Ultra)</option>
              </select>
            </div>
          </div>
        </div>

        {isTeenOnly && (
          <div style={{
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            borderRadius: '8px',
            padding: '8px 12px',
            margin: '0 20px 10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.82rem',
            color: '#facc15'
          }}>
            <ShieldAlert size={16} style={{ flexShrink: 0 }} />
            <span>Perfil Jovem (TEEN): Compartilhamento restrito a jogos detectados. Telas e janelas genéricas ficam desativadas por segurança.</span>
          </div>
        )}

        {streamFps === '60' && (
          <div className={styles.experimentalNotice}>
            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
            <span>O compartilhamento em 60 FPS ainda está em fase de testes e pode apresentar instabilidade.</span>
          </div>
        )}

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'games' ? styles.active : styles.inactive}`}
            onClick={() => setActiveTab('games')}
          >
            <Gamepad2 size={16} />
            <span>{t('voice.games', 'Jogos')}</span>
            {categorizedSources.games.length > 0 && (
              <span className={styles.tabCount}>
                {categorizedSources.games.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'windows' ? styles.active : styles.inactive}`}
            onClick={() => !isTeenOnly && setActiveTab('windows')}
            disabled={isTeenOnly}
            style={isTeenOnly ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
            title={isTeenOnly ? 'Contas TEEN só podem transmitir jogos detectados' : undefined}
          >
            <AppWindow size={16} />
            <span>{t('voice.applications')}</span>
            {!isTeenOnly && categorizedSources.windows.length > 0 && (
              <span className={styles.tabCount}>
                {categorizedSources.windows.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'screens' ? styles.active : styles.inactive}`}
            onClick={() => !isTeenOnly && setActiveTab('screens')}
            disabled={isTeenOnly}
            style={isTeenOnly ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}
            title={isTeenOnly ? 'Contas TEEN só podem transmitir jogos detectados' : undefined}
          >
            <Monitor size={16} />
            <span>{t('voice.screens')}</span>
            {!isTeenOnly && categorizedSources.screens.length > 0 && (
              <span className={styles.tabCount}>
                {categorizedSources.screens.length}
              </span>
            )}
          </button>
        </div>

        {/* Sources Grid */}
        <div className={styles.sourceGrid}>
          {currentList.length === 0 ? (
            <div className={styles.emptyState}>
              {activeTab === 'games' ? (
                <Gamepad2 size={42} style={{ opacity: 0.3 }} />
              ) : activeTab === 'windows' ? (
                <AppWindow size={42} style={{ opacity: 0.3 }} />
              ) : (
                <Monitor size={42} style={{ opacity: 0.3 }} />
              )}
              <p style={{ margin: 0, fontSize: '0.95rem' }}>
                {activeTab === 'games' && isTeenOnly 
                  ? 'Nenhum jogo em execução detectado. Inicie um jogo para transmitir.' 
                  : t('voice.noSources')}
              </p>
            </div>
          ) : (
            currentList.map((s) => (
              <div
                key={s.id}
                className={`${styles.sourceCard} ${s.isGame ? styles.isGame : ''}`}
                onClick={() => onSelectSource(s.id, shareAudio, is18Plus)}
              >
                <div className={styles.thumbnailWrapper}>
                  <img src={s.thumbnail} alt={s.name} className={styles.thumbnailImg} />
                  {s.isGame && <div className={styles.gameBadge}>60 FPS PRO</div>}
                </div>
                <div className={styles.cardFooter}>
                  {s.appIcon ? (
                    <img src={s.appIcon} alt="" style={{ width: 18, height: 18, borderRadius: 3 }} />
                  ) : s.isGame ? (
                    <Gamepad2 size={16} color="var(--brand-primary, #34d399)" />
                  ) : activeTab === 'screens' ? (
                    <Monitor size={16} color="#64748b" />
                  ) : (
                    <AppWindow size={16} color="#64748b" />
                  )}
                  <span className={styles.sourceName}>{s.name}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            {t('voice.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
