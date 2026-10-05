import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ReportModal.module.css';
import { ShieldAlert, Shield, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { httpClient } from '../../../../infrastructure/adapters/http/http-client.adapter';
import { ApiRoutes, ReportTargetTypeEnum, ReportReasonEnum } from '../../../../core/enums';
import { useToast } from '../../../../components/common/Toast/ToastContext';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetTypeEnum;
  targetId?: string;
  targetName?: string;
  targetChannelId?: string;
  onSuccess?: () => void;
}

interface ReasonOption {
  key: ReportReasonEnum;
  label: string;
  icon: string;
  isChildSafety?: boolean;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetName,
  targetChannelId,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [selectedReason, setSelectedReason] = useState<ReportReasonEnum>(
    ReportReasonEnum.CHILD_SAFETY_EXPLOITATION,
  );
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const targetTitle =
    targetType === ReportTargetTypeEnum.USER
      ? `Denunciar Usuário: @${targetName || 'usuário'}`
      : targetType === ReportTargetTypeEnum.SERVER
      ? `Denunciar Servidor: ${targetName || 'servidor'}`
      : `Denunciar Transmissão ao Vivo (${targetName || 'stream'})`;

  const reasons: ReasonOption[] = [
    {
      key: ReportReasonEnum.CHILD_SAFETY_EXPLOITATION,
      label: 'Risco, Exploração ou Abuso a Criança/Adolescente',
      icon: '🛡️',
      isChildSafety: true,
    },
    {
      key: ReportReasonEnum.HARASSMENT_BULLYING,
      label: 'Assédio, Perseguição ou Bullying',
      icon: '🚫',
    },
    {
      key: ReportReasonEnum.HATE_SPEECH,
      label: 'Discurso de Ódio ou Discriminação',
      icon: '⚠️',
    },
    {
      key: ReportReasonEnum.SEXUAL_CONTENT,
      label: 'Conteúdo Sexual Impróprio ou Não Solicitado',
      icon: '🔞',
    },
    {
      key: ReportReasonEnum.VIOLENCE_THREATS,
      label: 'Violência Extrema ou Ameaças Graves',
      icon: '⚔️',
    },
    {
      key: ReportReasonEnum.SELF_HARM,
      label: 'Automutilação ou Incentivo ao Suicídio',
      icon: '💔',
    },
    {
      key: ReportReasonEnum.SPAM_SCAM,
      label: 'Spam, Golpe ou Roubo de Dados',
      icon: '📢',
    },
    {
      key: ReportReasonEnum.OTHER,
      label: 'Outra Violação das Diretrizes',
      icon: '❓',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 5) {
      toast.error('Por favor, informe uma descrição com pelo menos 5 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      await httpClient.post(ApiRoutes.MODERATION_REPORTS, {
        targetType,
        targetUserId: targetType === ReportTargetTypeEnum.USER ? targetId : undefined,
        targetServerId: targetType === ReportTargetTypeEnum.SERVER ? targetId : undefined,
        targetChannelId: targetType === ReportTargetTypeEnum.STREAM ? targetChannelId : undefined,
        reason: selectedReason,
        description: description.trim(),
      });

      toast.success(
        'Denúncia registrada com sucesso. A equipe de moderação priorizará este caso conforme as diretrizes da ANPD.',
      );
      setDescription('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao registrar denúncia. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitleGroup}>
            <div className={styles.headerIconWrapper}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 className={styles.headerTitle}>{targetTitle}</h3>
              <p className={styles.headerSubtitle}>Moderação & Segurança da Comunidade</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            title={t('common.close', 'Fechar')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className={styles.body}>
            {/* ANPD / ECA Shield Notice */}
            <div className={styles.anpdNotice}>
              <Shield size={18} className={styles.anpdNoticeIcon} />
              <div>
                <span className={styles.anpdNoticeTitle}>
                  Proteção Integral à Criança e ao Adolescente (ANPD / ECA)
                </span>
                <p className={styles.anpdNoticeText}>
                  Denúncias envolvendo menores de idade ou conteúdo ilegal recebem encaminhamento e averiguação
                  imediata com salvaguardas rigorosas de integridade.
                </p>
              </div>
            </div>

            {/* Motivo da Denúncia */}
            <div>
              <label className={styles.sectionLabel}>Selecione o Motivo da Denúncia</label>
              <div className={styles.reasonsList}>
                {reasons.map((r) => {
                  const isActive = selectedReason === r.key;
                  return (
                    <div
                      key={r.key}
                      className={`${styles.reasonItem} ${isActive ? styles.reasonItemActive : ''} ${
                        r.isChildSafety ? styles.reasonItemChildSafety : ''
                      }`}
                      onClick={() => setSelectedReason(r.key)}
                    >
                      <div className={styles.reasonContent}>
                        <span className={styles.reasonIcon}>{r.icon}</span>
                        <span className={styles.reasonTitle}>{r.label}</span>
                        {r.isChildSafety && (
                          <span className={styles.priorityBadge}>Prioridade Máxima</span>
                        )}
                      </div>
                      <div
                        className={`${styles.radioCircle} ${
                          isActive ? styles.radioCircleActive : ''
                        }`}
                      >
                        {isActive && <div className={styles.radioDot} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detalhes Adicionais */}
            <div>
              <label className={styles.sectionLabel}>Detalhes e Contexto Adicional</label>
              <textarea
                className={styles.textarea}
                placeholder="Explique o que aconteceu, canais envolvidos ou qualquer detalhe relevante para a apuração..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                required
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className={styles.footer}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting || description.trim().length < 5}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={16} />
                  <span>Enviar Denúncia</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
