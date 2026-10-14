import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, RefreshCw, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { ipcRenderer } from 'electron';
import { httpClient } from '../../../infrastructure/adapters/http/http-client.adapter';
import { ApiRoutes, IpcChannels } from '../../../core/enums';
import { getMediaUrl } from '../../../core/utils/media.util';
import type { UserProfileData } from '../../../features/user/components/UserPopout/UserPopout';
import { Input } from '../../common/Input';
import { Badge } from '../../common/Badge';
import styles from './AccountTab.module.css';

export interface AccountTabProps {
  currentUser?: UserProfileData | null;
  onOpenEditProfile?: () => void;
  onProfileUpdated?: (updated: Partial<UserProfileData>) => void;
  onLogout?: () => void;
  onClose: () => void;
}

export const AccountTab: React.FC<AccountTabProps> = ({
  currentUser,
  onOpenEditProfile,
  onProfileUpdated,
  onLogout,
  onClose,
}) => {
  const { t } = useTranslation();
  const [avatarError, setAvatarError] = useState(false);

  // Alteração de Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Revalidação de Idade (Age Signals)
  const [isRevalidatingAge, setIsRevalidatingAge] = useState(false);
  const [ageFeedback, setAgeFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  useEffect(() => {
    setAvatarError(false);
  }, [currentUser?.avatarUrl]);

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

  const getAgePill = () => {
    if (currentUser?.ageClassification === 'ADULT') {
      return <span className={`${styles.agePill} ${styles.agePillAdult}`}>Adulto (+18)</span>;
    }
    if (currentUser?.ageClassification === 'TEEN') {
      return <span className={`${styles.agePill} ${styles.agePillTeen}`}>Jovem (13-17 anos)</span>;
    }
    if (currentUser?.ageClassification === 'CHILD') {
      return <span className={`${styles.agePill} ${styles.agePillChild}`}>Menor (&lt;13 anos)</span>;
    }
    return <span className={`${styles.agePill} ${styles.agePillUnknown}`}>Padrão / Desconhecido</span>;
  };

  return (
    <div className={styles.container}>
      {/* Card Visual de Perfil */}
      <div className={styles.profileCard}>
        <div
          className={styles.banner}
          style={{ backgroundColor: currentUser?.bannerColor || 'var(--bg-accent)' }}
        >
          {getMediaUrl(currentUser?.bannerUrl) && (
            <img
              src={getMediaUrl(currentUser?.bannerUrl)}
              alt="Banner"
              className={styles.bannerImg}
              loading="eager"
              decoding="async"
            />
          )}
        </div>
        <div className={styles.profileBody}>
          <div className={styles.profileLeft}>
            <div className={styles.avatarWrapper}>
              {getMediaUrl(currentUser?.avatarUrl) && !avatarError ? (
                <img
                  src={getMediaUrl(currentUser?.avatarUrl)}
                  alt={currentUser?.displayName || currentUser?.username}
                  className={styles.avatarImg}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <span className={styles.avatarPlaceholder}>
                  {(currentUser?.displayName || currentUser?.username || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.usernameRow}>
                <span className={styles.username}>{currentUser?.displayName || currentUser?.username || 'Usuário'}</span>
                {currentUser?.role === 'ADMIN' && (
                  <Badge variant="brand" size="sm">
                    ADMIN
                  </Badge>
                )}
              </div>
              <span className={styles.tag}>@{currentUser?.username || 'usuario'}</span>
            </div>
          </div>
          {onOpenEditProfile && (
            <button
              type="button"
              className={`${styles.accountBtn} ${styles.editProfileBtn}`}
              onClick={onOpenEditProfile}
            >
              <Sparkles size={14} />
              <span>{t('user.editProfile', 'Editar Perfil')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. Informações da Conta */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>{t('user.accountDetails', 'Dados da Conta')}</span>
        <div className={styles.infoBox}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('user.displayName', 'Nome de exibição')}</span>
            <span className={styles.infoValue}>{currentUser?.displayName || 'Não definido'}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('user.username', 'Nome de usuário')}</span>
            <span className={styles.infoValue}>@{currentUser?.username || '-'}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('user.email', 'E-mail')}</span>
            <span className={styles.infoValue}>{currentUser?.email || '••••••••@••••.com'}</span>
          </div>
        </div>
      </div>

      {/* 2. Faixa Etária e Proteção (Age Signals) */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>
            {t('user.ageSignalsTitle', 'Classificação Etária & Proteção Legal')}
          </span>
          {getAgePill()}
        </div>

        <div className={styles.infoBox}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Permissões de Transmissão</span>
            <span className={styles.infoValue}>
              {currentUser?.ageClassification === 'ADULT'
                ? 'Transmissão de Jogos e Compartilhamento de Telas Gerais'
                : currentUser?.ageClassification === 'TEEN'
                ? 'Apenas Transmissão de Jogos Detectados (Telas e Janelas Gerais Desativadas)'
                : 'Acesso Restrito'}
            </span>
          </div>

          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Servidores e Streams +18</span>
            <span className={`${styles.infoValue} ${currentUser?.ageClassification === 'ADULT' ? styles.valueAllowed : styles.valueBlocked}`}>
              {currentUser?.ageClassification === 'ADULT' ? 'Permitido (+18)' : 'Bloqueado (Restrito a Maiores)'}
            </span>
          </div>

          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Origem do Sinal</span>
            <span className={styles.infoValue}>
              {currentUser?.ageSignalSource === 'WINDOWS_OS'
                ? 'Windows 11 OS (WinRT Age Signal)'
                : currentUser?.ageSignalSource === 'DECLARED'
                ? 'Data de Nascimento Declarada'
                : 'Padrão / Nenhum'}
            </span>
          </div>

          {currentUser?.birthDate && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Data de Nascimento</span>
              <span className={styles.infoValue}>
                {new Date(currentUser.birthDate).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
        </div>

        {ageFeedback && (
          <div
            className={`${styles.feedbackAlert} ${
              ageFeedback.type === 'success'
                ? styles.feedbackSuccess
                : ageFeedback.type === 'error'
                ? styles.feedbackError
                : styles.feedbackInfo
            }`}
          >
            {ageFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{ageFeedback.message}</span>
          </div>
        )}

        <div className={styles.revalidateRow}>
          <span className={styles.revalidateText}>
            Completou 18 anos ou atualizou sua conta Microsoft? Revalide os sinais.
          </span>
          <button
            type="button"
            className={`${styles.accountBtn} ${styles.revalidateAgeBtn}`}
            onClick={handleRevalidateAge}
            disabled={isRevalidatingAge}
          >
            <RefreshCw size={14} className={isRevalidatingAge ? styles.spinAnimation : ''} />
            <span>{isRevalidatingAge ? 'Revalidando...' : 'Revalidar idade'}</span>
          </button>
        </div>
      </div>

      {/* 3. Segurança / Alterar Senha */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>{t('user.securityTitle', 'Segurança e Senha')}</span>
          <span className={styles.passwordTip}>Mínimo de 6 caracteres</span>
        </div>

        <form onSubmit={handleChangePassword} className={styles.passwordForm}>
          <div className={styles.formGrid}>
            <Input
              type="password"
              label={t('user.currentPassword', 'Senha atual')}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              fullWidth
            />
            <Input
              type="password"
              label={t('user.newPassword', 'Nova senha')}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              fullWidth
            />
            <Input
              type="password"
              label={t('user.confirmPassword', 'Confirmar nova senha')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              fullWidth
            />
          </div>

          {passwordFeedback && (
            <div
              className={`${styles.feedbackAlert} ${
                passwordFeedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError
              }`}
            >
              {passwordFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{passwordFeedback.message}</span>
            </div>
          )}

          <div className={styles.formActions}>
            <button
              type="submit"
              className={`${styles.accountBtn} ${styles.updatePasswordBtn}`}
              disabled={isChangingPassword}
            >
              <KeyRound size={14} />
              <span>{isChangingPassword ? 'Atualizando...' : t('user.updatePassword', 'Atualizar Senha')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
