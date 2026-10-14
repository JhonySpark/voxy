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
      ? t('moderation.reportUserTarget', { name: targetName || 'usuário' })
      : targetType === ReportTargetTypeEnum.SERVER
      ? t('moderation.reportServerTarget', { name: targetName || 'servidor' })
      : t('moderation.reportStream', { name: targetName || 'stream' });

  const reasons: ReasonOption[] = [
    {
      key: ReportReasonEnum.CHILD_SAFETY_EXPLOITATION,
      label: t('moderation.reasons.childSafety'),
      icon: '🛡️',
      isChildSafety: true,
    },
    {
      key: ReportReasonEnum.HARASSMENT_BULLYING,
      label: t('moderation.reasons.harassment'),
      icon: '🚫',
    },
    {
      key: ReportReasonEnum.HATE_SPEECH,
      label: t('moderation.reasons.hateSpeech'),
      icon: '⚠️',
    },
    {
      key: ReportReasonEnum.SEXUAL_CONTENT,
      label: t('moderation.reasons.sexualContent'),
      icon: '🔞',
    },
    {
      key: ReportReasonEnum.VIOLENCE_THREATS,
      label: t('moderation.reasons.violence'),
      icon: '⚔️',
    },
    {
      key: ReportReasonEnum.SELF_HARM,
      label: t('moderation.reasons.selfHarm'),
      icon: '💔',
    },
    {
      key: ReportReasonEnum.SPAM_SCAM,
      label: t('moderation.reasons.spam'),
      icon: '📢',
    },
    {
      key: ReportReasonEnum.OTHER,
      label: t('moderation.reasons.other'),
      icon: '❓',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 5) {
      toast.error(t('moderation.minDescription'));
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

      toast.success(t('moderation.reportSuccess'));
      setDescription('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('moderation.reportError'));
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
              <p className={styles.headerSubtitle}>{t('moderation.modalSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            title={t('common.close')}
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
                  {t('moderation.anpdTitle')}
                </span>
                <p className={styles.anpdNoticeText}>
                  {t('moderation.anpdDesc')}
                </p>
              </div>
            </div>

            {/* Motivo da Denúncia */}
            <div>
              <label className={styles.sectionLabel}>{t('moderation.selectReason')}</label>
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
                        <div className={styles.reasonTextWrapper}>
                          <span className={styles.reasonTitle}>{r.label}</span>
                          {r.isChildSafety && (
                            <span className={styles.priorityBadge}>
                              <span className={styles.priorityBadgeDot} />
                              {t('moderation.maxPriority')}
                            </span>
                          )}
                        </div>
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
              <label className={styles.sectionLabel}>{t('moderation.detailsLabel')}</label>
              <textarea
                className={styles.textarea}
                placeholder={t('moderation.detailsPlaceholder')}
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
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isSubmitting || description.trim().length < 5}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{t('common.submitting')}</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={16} />
                  <span>{t('moderation.submitReport')}</span>
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
