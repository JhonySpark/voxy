import React, { useState } from 'react';
import { Rocket, AlertTriangle, ShieldCheck, MessageSquareHeart, X, Sparkles, Cpu } from 'lucide-react';
import { StorageKeys } from '../../core/enums';
import styles from './BetaWelcomeModal.module.css';

interface BetaWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BetaWelcomeModal: React.FC<BetaWelcomeModalProps> = ({ isOpen, onClose }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (dontShowAgain) {
      localStorage.setItem(StorageKeys.BETA_WELCOME_SEEN, 'true');
    }
    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={handleConfirm} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.glowTop} />

        <button
          className={styles.closeButton}
          onClick={handleConfirm}
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        <div className={styles.header}>
          <div className={styles.artBadgeContainer}>
            <div className={styles.artBadge}>
              <Rocket size={34} color="#34d399" />
            </div>
          </div>

          <div className={styles.badgePill}>
            <span className={styles.pulsingDot} />
            <span>Fase Experimental • 50 Testadores</span>
          </div>

          <h2 className={styles.title}>Bem-vindo ao Voxy Beta</h2>
          <p className={styles.subtitle}>
            Você é um dos 50 primeiros pioneiros a ter acesso antecipado à nossa plataforma.
          </p>
        </div>

        <div className={styles.content}>
          <div className={styles.cardsGrid}>
            <div className={styles.infoCard}>
              <div className={styles.cardIconWrapper} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className={styles.cardTitle}>Projeto Novo em Fase de Testes</h3>
                <p className={styles.cardDesc}>
                  O Voxy está em desenvolvimento ativo. Durante esta fase inicial, você poderá encontrar pequenos bugs, falhas momentâneas de conexão ou recursos em lapidação diária.
                </p>
              </div>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.cardIconWrapper} style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
                <Cpu size={20} />
              </div>
              <div>
                <h3 className={styles.cardTitle}>Tecnologia Construída do Zero</h3>
                <p className={styles.cardDesc}>
                  Engine de voz WebRTC com latência ultrabaixa, captura nativa de jogos no Windows e servidores privados sem algoritmos invasivos ou anúncios.
                </p>
              </div>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.cardIconWrapper} style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className={styles.cardTitle}>Privacidade & Conformidade Total</h3>
                <p className={styles.cardDesc}>
                  Suas chamadas não são gravadas nem espionadas. Seguimos estritamente a LGPD, regulamentações da ANPD e salvaguardas de proteção a menores (ECA Digital).
                </p>
              </div>
            </div>

            <div className={styles.infoCard}>
              <div className={styles.cardIconWrapper} style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                <MessageSquareHeart size={20} />
              </div>
              <div>
                <h3 className={styles.cardTitle}>Seu Feedback Molda o Voxy</h3>
                <p className={styles.cardDesc}>
                  Encontrou algum comportamento estranho ou tem sugestões de melhoria? Seu olhar crítico é a chave para construirmos uma alternativa de respeito aos gigantes.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <label className={styles.dismissCheckboxLabel}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="custom-checkbox"
            />
            <span>Não exibir este aviso automaticamente novamente</span>
          </label>

          <button className={styles.actionButton} onClick={handleConfirm}>
            <Sparkles size={18} />
            <span>Entendi, vamos explorar o Voxy!</span>
          </button>
        </div>
      </div>
    </div>
  );
};
