import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api';
import {
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Loader2,
  Mail,
  ShieldAlert,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  FileText,
  Lock,
  HeartHandshake,
  Sparkles,
  Users,
  X,
  BookOpen,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApiRoutes, AppRoutes, StorageKeys, IpcChannels } from '../core/enums';
import { getApiErrorMessage, getApiCodeMessage } from '../core/utils/error.util';
import heroLogo from '../assets/logo.png';
import styles from './Register.module.css';
import { LegalDocumentContent } from '../components/LegalDocuments/LegalDocumentContent';

declare const window: any;
const ipcRenderer = typeof window !== 'undefined' && window.require ? window.require('electron').ipcRenderer : null;

interface BetaStatus {
  isOpen: boolean;
  currentUsers: number;
  maxUsers: number;
  remainingSlots: number;
}

export default function Register() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Wizard Step: 1 = Identidade, 2 = Segurança & Idade, 3 = Termos & Privacidade, 4 = Token OTP, 'child_blocked' | 'beta_full'
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 'child_blocked' | 'beta_full'>(1);

  // Status da capacidade Beta (50 pessoas)
  const [betaStatus, setBetaStatus] = useState<BetaStatus | null>(null);

  // Passo 1: Identidade
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameMsg, setUsernameMsg] = useState('');

  // Passo 2: Segurança & Idade
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Passo 3: Termos, Privacidade & ANPD / ECA Digital
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptSafety, setAcceptSafety] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<'terms' | 'privacy' | 'safety' | null>(null);
  const [docViewMode, setDocViewMode] = useState<'full' | 'summary'>('summary');

  // Passo 4: Token OTP de 6 dígitos
  const [targetEmail, setTargetEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationMsg, setVerificationMsg] = useState('');

  // Estados gerais
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isFromLogin = searchParams.get('from') === 'login';

  // Carregar status do beta
  useEffect(() => {
    const fetchBetaStatus = async () => {
      try {
        const res = await api.get<any>(ApiRoutes.CONFIG_APP_STATUS);
        const data: BetaStatus = {
          isOpen: res.data.isBetaOpen ?? res.data.isOpen ?? true,
          currentUsers: res.data.currentUsers ?? 0,
          maxUsers: res.data.maxBetaUsers ?? res.data.maxUsers ?? 50,
          remainingSlots: res.data.remainingSlots ?? 0,
        };
        setBetaStatus(data);
        if (!data.isOpen && !searchParams.get('verify')) {
          setStep('beta_full');
        }
      } catch (err) {
        // Se a API não responder, permite continuar
      }
    };
    fetchBetaStatus();
  }, [searchParams]);

  // Redirecionamento vindo do login com ?verify=email
  useEffect(() => {
    const verifyEmailParam = searchParams.get('verify');
    if (verifyEmailParam) {
      setTargetEmail(verifyEmailParam);
      setEmail(verifyEmailParam);
      setStep(4);
      if (searchParams.get('from') === 'login') {
        setVerificationMsg(t('auth.register.otpSentMessage'));
      }
    }
  }, [searchParams]);

  // Timer de cooldown para reenvio de e-mail
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Foco automático no primeiro quadradinho do OTP ao entrar no passo 4
  useEffect(() => {
    if (step === 4) {
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Verificação de disponibilidade de nome de usuário em tempo real
  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed) {
      setUsernameStatus('idle');
      setUsernameMsg('');
      return;
    }

    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (trimmed.length < 3 || trimmed.length > 32 || !usernameRegex.test(trimmed)) {
      setUsernameStatus('invalid');
      setUsernameMsg(t('auth.register.usernameInvalid'));
      return;
    }

    setUsernameStatus('checking');
    setUsernameMsg(t('auth.register.usernameChecking'));

    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ available: boolean; code?: string; message: string }>(
          `${ApiRoutes.AUTH_CHECK_USERNAME}?username=${encodeURIComponent(trimmed)}`
        );
        if (res.data.available) {
          setUsernameStatus('available');
          setUsernameMsg(getApiCodeMessage(res.data.code, t('auth.register.usernameAvailable')));
        } else {
          setUsernameStatus('taken');
          setUsernameMsg(getApiCodeMessage(res.data.code, res.data.message || t('auth.register.usernameTaken')));
        }
      } catch (err: any) {
        setUsernameStatus('taken');
        setUsernameMsg(getApiErrorMessage(err, t('auth.register.usernameTaken')));
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, t]);

  // Requisitos e cálculo de força de senha
  const reqMinChars = password.length >= 8;
  const reqUpper = /[A-Z]/.test(password);
  const reqLower = /[a-z]/.test(password);
  const reqNumber = /[0-9]/.test(password);
  const reqSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=~[\]\\/]/.test(password);

  const isPasswordValid = reqMinChars && reqUpper && reqLower && reqNumber && reqSpecial;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  // Cálculo da idade declarada
  const calculateAge = (dateString: string): number => {
    if (!dateString) return 0;
    const today = new Date();
    const birth = new Date(dateString);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const declaredAge = birthDate ? calculateAge(birthDate) : null;
  const isChild = declaredAge !== null && declaredAge < 13;
  const isTeen = declaredAge !== null && declaredAge >= 13 && declaredAge < 18;
  const isAdult = declaredAge !== null && declaredAge >= 18;

  // Validação para avançar do Passo 1 -> Passo 2
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canGoToStep2 = isEmailValid && usernameStatus === 'available';

  const handleNextToStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid) {
      setError(t('errors.AUTH_INVALID_EMAIL'));
      return;
    }
    if (usernameStatus !== 'available') {
      setError(usernameMsg || t('errors.AUTH_INVALID_USERNAME'));
      return;
    }
    setError('');
    setStep(2);
  };

  // Validação para avançar do Passo 2 -> Passo 3 (Termos)
  const canGoToStep3 = birthDate && !isChild && isPasswordValid && passwordsMatch;

  const handleNextToStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!birthDate) {
      setError(t('auth.register.errorBirthDateRequired'));
      return;
    }
    if (isChild) {
      setStep('child_blocked');
      return;
    }
    if (!isPasswordValid) {
      setError(t('errors.AUTH_WEAK_PASSWORD'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.register.errorPasswordMismatch'));
      return;
    }
    setError('');
    setStep(3);
  };

  // Submissão do Passo 3 -> Criação da Conta e envio de código OTP
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms || !acceptPrivacy || !acceptSafety) {
      setError(t('auth.register.errorTermsRequired'));
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await api.post(ApiRoutes.AUTH_REGISTER, {
        email: email.trim(),
        username: username.trim(),
        password,
        birthDate,
        acceptTerms: true,
      });

      setTargetEmail(email.trim());
      setResendCooldown(60);

      if (res.data?.requireEmailVerification !== false) {
        setVerificationMsg(t('auth.register.otpSentMessage'));
        setStep(4);
      } else {
        const loginRes = await api.post(ApiRoutes.AUTH_LOGIN, { email: email.trim(), password });
        localStorage.setItem(StorageKeys.AUTH_TOKEN, loginRes.data.access_token);
        navigate(AppRoutes.APP);
      }
    } catch (err: any) {
      const code = err.response?.data?.code;
      if (code === 'AUTH_BETA_LIMIT_REACHED') {
        setStep('beta_full');
      } else {
        setError(getApiErrorMessage(err, t('auth.register.failed')));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Manipuladores dos inputs quadradinhos de dígitos (OTP)
  const handleOtpChange = (index: number, val: string) => {
    const cleanDigit = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleanDigit;
    setOtpDigits(newDigits);
    setError('');

    if (cleanDigit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    const fullCode = newDigits.join('');
    if (fullCode.length === 6) {
      triggerVerifyCode(fullCode);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pastedData) return;

    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < pastedData.length; i++) {
      newDigits[i] = pastedData[i];
    }
    setOtpDigits(newDigits);

    const nextFocusIndex = Math.min(pastedData.length, 5);
    otpRefs.current[nextFocusIndex]?.focus();

    if (pastedData.length === 6) {
      triggerVerifyCode(pastedData);
    }
  };

  // Verificação do Código de 6 Dígitos com o backend
  const triggerVerifyCode = async (codeToVerify: string) => {
    if (codeToVerify.length !== 6 || isVerifying) return;

    setIsVerifying(true);
    setError('');

    try {
      const res = await api.post(ApiRoutes.AUTH_VERIFY_EMAIL, {
        email: targetEmail,
        code: codeToVerify,
      });

      if (res.data?.access_token) {
        localStorage.setItem(StorageKeys.AUTH_TOKEN, res.data.access_token);

        if (ipcRenderer) {
          try {
            const ageSignal = await ipcRenderer.invoke(IpcChannels.GET_OS_AGE_SIGNAL);
            const syncRes = await api.post(ApiRoutes.AUTH_SYNC_AGE_SIGNAL, ageSignal, {
              headers: { Authorization: `Bearer ${res.data.access_token}` },
            });

            if (syncRes.data?.user?.ageClassification === 'CHILD') {
              localStorage.removeItem(StorageKeys.AUTH_TOKEN);
              setStep('child_blocked');
              return;
            }
          } catch (syncErr) {
            console.warn('[AgeSignal] Sincronização do sinal nativo falhou:', syncErr);
          }
        }

        navigate(AppRoutes.APP);
      }
    } catch (err: any) {
      setError(getApiErrorMessage(err, t('errors.AUTH_INVALID_VERIFICATION_CODE')));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    setError('');
    try {
      await api.post(ApiRoutes.AUTH_RESEND_CODE, { email: targetEmail });
      setResendCooldown(60);
      setVerificationMsg(t('auth.register.otpResentSuccess'));
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch (err: any) {
      setError(getApiErrorMessage(err, t('auth.register.otpResendFailed')));
    }
  };

  const handleSelectAllTerms = () => {
    const nextVal = !(acceptTerms && acceptPrivacy && acceptSafety);
    setAcceptTerms(nextVal);
    setAcceptPrivacy(nextVal);
    setAcceptSafety(nextVal);
  };

  // =========================================================================
  // TELA: Limite Beta de 50 Pessoas Atingido (beta_full)
  // =========================================================================
  if (step === 'beta_full') {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.warningIcon}>
              <Users size={36} />
            </div>

            <div className={styles.capacityBadge}>
              <span>{t('auth.register.betaFullBadge', { current: betaStatus?.currentUsers ?? 50, max: betaStatus?.maxUsers ?? 50 })}</span>
            </div>

            <div>
              <h1 className={`${styles.title} ${styles.warningTitle}`}>
                {t('auth.register.betaFullTitle')}
              </h1>
              <p className={styles.subtitle}>
                {t('auth.register.betaFullDesc1', { max: betaStatus?.maxUsers ?? 50 })}
              </p>
              <p className={`${styles.subtitle} ${styles.mutedSubtitle}`}>
                {t('auth.register.betaFullDesc2')}
              </p>
            </div>

            <div className={`${styles.actionsRow} ${styles.fullWidthRow}`}>
              <Link to={AppRoutes.LOGIN} className={`btn-primary ${styles.fullWidthLink}`}>
                {t('auth.register.betaFullLoginLink')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TELA: Bloqueio Legal para Menores de 13 Anos (CHILD)
  // =========================================================================
  if (step === 'child_blocked') {
    return (
      <div className={styles.container}>
        <div className={`${styles.card} ${styles.cardCentered}`}>
          <div className={styles.centerRow}>
            <div className={styles.blockedIcon}>
              <ShieldAlert size={36} />
            </div>
          </div>
          <h1 className={styles.blockedTitle}>{t('auth.restrictedAccess')}</h1>
          <p className={styles.subtitle}>
            {t('auth.restrictedAccessDesc')}
          </p>
          <div className={styles.mt6}>
            <Link to={AppRoutes.LOGIN} className={`btn-primary ${styles.centerLink}`}>
              {t('common.backToHome')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TELA: Passo 4 - Verificação de E-mail (Token OTP de 6 dígitos)
  // =========================================================================
  if (step === 4) {
    const fullOtp = otpDigits.join('');
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          {/* Cabeçalho de Confirmação */}
          <div className={styles.header}>
            <div className={styles.mailIconWrapper}>
              <Mail size={26} />
            </div>
            <h1 className={styles.title}>
              {isFromLogin ? t('auth.verifyEmailTitleLogin') : t('auth.verifyEmailTitle')}
            </h1>
            <p className={styles.subtitle}>
              {isFromLogin
                ? t('auth.accountNotConfirmedDesc')
                : t('auth.enterVerificationCodeDesc')} <br />
              <strong>{targetEmail}</strong>
            </p>
          </div>

          {/* Stepper dos Passos */}
          {!isFromLogin && (
            <div className="wizard-stepper-bar">
              <div className="wizard-step-node completed">
                <div className="wizard-step-bullet completed">✓</div>
                <span className="wizard-step-label">{t('auth.stepIdentity')}</span>
              </div>
              <div className="wizard-step-connector active" />

              <div className="wizard-step-node completed">
                <div className="wizard-step-bullet completed">✓</div>
                <span className="wizard-step-label">{t('auth.stepSecurity')}</span>
              </div>
              <div className="wizard-step-connector active" />

              <div className="wizard-step-node completed">
                <div className="wizard-step-bullet completed">✓</div>
                <span className="wizard-step-label">{t('auth.stepTerms')}</span>
              </div>
              <div className="wizard-step-connector active" />

              <div className="wizard-step-node active">
                <div className="wizard-step-bullet active">4</div>
                <span className="wizard-step-label">{t('auth.stepCode')}</span>
              </div>
            </div>
          )}

          {verificationMsg && (
            <div className={`${styles.alertBox} ${styles.alertSuccess}`}>
              {verificationMsg}
            </div>
          )}

          {error && (
            <div className={`${styles.alertBox} ${styles.alertError}`}>
              {error}
            </div>
          )}

          <div className="otp-grid" onPaste={handleOtpPaste}>
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { otpRefs.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                className={`otp-digit-input ${digit ? 'filled' : ''}`}
                autoComplete="one-time-code"
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => triggerVerifyCode(fullOtp)}
            className={`btn-primary ${styles.fullWidthSubmitBtn}`}
            disabled={isVerifying || fullOtp.length !== 6}
          >
            {isVerifying ? <span className="btn-spinner" /> : t('auth.register.otpConfirmAndAccess')}
          </button>

          <div className={styles.header}>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resendCooldown > 0}
              className={styles.resendBtn}
            >
              <RefreshCw size={13} />
              <span>
                {resendCooldown > 0
                  ? t('auth.register.resendInSeconds', { seconds: resendCooldown })
                  : t('auth.register.resendPrompt')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setError('');
                if (isFromLogin) {
                  navigate(AppRoutes.LOGIN);
                } else {
                  setStep(1);
                }
              }}
              className={`${styles.link} ${styles.linkBtn}`}
            >
              {isFromLogin ? t('auth.register.backToLogin') : t('auth.register.backToEdit')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // WIZARD: Passos 1, 2 e 3
  // =========================================================================
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        {/* 1. Cabeçalho com Logo e Título com Largura Total */}
        <div className="wizard-title-row">
          <img
            src={heroLogo}
            alt="Voxy Logo"
            className={styles.cardHeaderLogo}
          />
          <div className={styles.headerContent}>
            <h1 className={styles.titleLeft}>
              {step === 1 && t('auth.register.step1Title')}
              {step === 2 && t('auth.register.step2Title')}
              {step === 3 && t('auth.register.step3Title')}
            </h1>
            <p className={styles.subtitleLeft}>
              {step === 1 && t('auth.register.step1Subtitle')}
              {step === 2 && t('auth.register.step2Subtitle')}
              {step === 3 && t('auth.register.step3Subtitle')}
            </p>
          </div>
        </div>

        {/* 2. Barra dos 4 Passos (EM BAIXO) */}
        <div className="wizard-stepper-bar">
          <div className={`wizard-step-node ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
            <div className={`wizard-step-bullet ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
              {step > 1 ? '✓' : '1'}
            </div>
            <span className="wizard-step-label">{t('auth.stepIdentity')}</span>
          </div>
          <div className={`wizard-step-connector ${step > 1 ? 'active' : ''}`} />

          <div className={`wizard-step-node ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
            <div className={`wizard-step-bullet ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
              {step > 2 ? '✓' : '2'}
            </div>
            <span className="wizard-step-label">{t('auth.stepSecurity')}</span>
          </div>
          <div className={`wizard-step-connector ${step > 2 ? 'active' : ''}`} />

          <div className={`wizard-step-node ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}>
            <div className={`wizard-step-bullet ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}>
              {step > 3 ? '✓' : '3'}
            </div>
            <span className="wizard-step-label">{t('auth.stepTerms')}</span>
          </div>
          <div className={`wizard-step-connector ${step > 3 ? 'active' : ''}`} />

          <div className="wizard-step-node">
            <div className="wizard-step-bullet">
              4
            </div>
            <span className="wizard-step-label">{t('auth.stepCode')}</span>
          </div>
        </div>

        {/* Badge Informativo de Vagas Beta */}
        {betaStatus && betaStatus.maxUsers > 0 && (
          <div className={styles.centerRow}>
            <div className={styles.capacityBadge}>
              <Sparkles size={12} />
              <span>
                {t('auth.register.betaSlotsFilled', {
                  current: betaStatus.currentUsers,
                  max: betaStatus.maxUsers,
                  remaining: betaStatus.remainingSlots,
                })}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className={`${styles.alertBox} ${styles.alertError}`}>
            {error}
          </div>
        )}

        {/* ----------------- PASSO 1: IDENTIDADE ----------------- */}
        {step === 1 && (
          <form onSubmit={handleNextToStep2} className={styles.formColumn}>
            <div className="input-group">
              <label className="input-label">{t('auth.register.email')}</label>
              <input
                type="email"
                className="text-input"
                placeholder={t('auth.register.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">{t('auth.register.username')}</label>
              <input
                type="text"
                className="text-input"
                placeholder={t('auth.register.usernamePlaceholder')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
              />
              {usernameStatus !== 'idle' && (
                <div
                  className={`input-feedback ${
                    usernameStatus === 'available'
                      ? 'success'
                      : usernameStatus === 'checking'
                      ? 'loading'
                      : 'error'
                  }`}
                >
                  {usernameStatus === 'checking' && <Loader2 size={12} className="btn-spinner" />}
                  {usernameStatus === 'available' && <Check size={13} />}
                  {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <AlertCircle size={13} />}
                  <span>{usernameMsg}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className={`btn-primary ${styles.step1SubmitBtn}`}
              disabled={!canGoToStep2}
            >
              <span>{t('auth.continueToPassword')}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* ----------------- PASSO 2: SEGURANÇA E NASCIMENTO ----------------- */}
        {step === 2 && (
          <form onSubmit={handleNextToStep3} className={styles.stepForm}>
            <div className="input-group">
              <div className={styles.birthDateHeader}>
                <label className={`input-label ${styles.birthDateLabel}`}>{t('auth.birthDate')}</label>
                {declaredAge !== null && (
                  <span className={`${styles.ageClassificationBadge} ${
                    isChild ? styles.badgeChild : isTeen ? styles.badgeTeen : styles.badgeAdult
                  }`}>
                    {isChild && <AlertCircle size={11} />}
                    {isTeen && <ShieldCheck size={11} />}
                    {isAdult && <UserCheck size={11} />}
                    {isChild ? t('auth.under13Badge') : isTeen ? t('auth.yearsTeen', { age: declaredAge }) : t('auth.yearsAdult', { age: declaredAge })}
                  </span>
                )}
              </div>

              <input
                type="date"
                className={`text-input ${styles.dateInputCustom}`}
                value={birthDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">{t('auth.register.password')}</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`text-input ${styles.textInputPadding}`}
                  placeholder={t('auth.register.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="pwd-badges-row">
                <span className={`pwd-badge ${reqMinChars ? 'active' : ''}`}>
                  {reqMinChars && <Check size={10} />} {t('auth.register.badgeMinChars')}
                </span>
                <span className={`pwd-badge ${reqUpper ? 'active' : ''}`}>
                  {reqUpper && <Check size={10} />} {t('auth.register.badgeUppercase')}
                </span>
                <span className={`pwd-badge ${reqLower ? 'active' : ''}`}>
                  {reqLower && <Check size={10} />} {t('auth.register.badgeLowercase')}
                </span>
                <span className={`pwd-badge ${reqNumber ? 'active' : ''}`}>
                  {reqNumber && <Check size={10} />} {t('auth.register.badgeNumber')}
                </span>
                <span className={`pwd-badge ${reqSpecial ? 'active' : ''}`}>
                  {reqSpecial && <Check size={10} />} {t('auth.register.badgeSpecial')}
                </span>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">{t('auth.register.confirmPassword')}</label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder={t('auth.register.passwordPlaceholder')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className={`text-input ${styles.textInputPadding}`}
              />
              {passwordsMatch && (
                <div className={`input-feedback success ${styles.feedbackMargin}`}>
                  <Check size={12} />
                  <span className={styles.feedbackText}>{t('auth.register.passwordsMatch')}</span>
                </div>
              )}
              {passwordsMismatch && (
                <div className={`input-feedback error ${styles.feedbackMargin}`}>
                  <AlertCircle size={12} />
                  <span className={styles.feedbackText}>{t('auth.register.errorPasswordMismatch')}</span>
                </div>
              )}
            </div>

            <div className={styles.stepActionsRow}>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStep(1);
                }}
                className={`btn-secondary ${styles.stepBackBtn}`}
              >
                <ArrowLeft size={15} />
                <span>{t('auth.back')}</span>
              </button>

              <button
                type="submit"
                className={`btn-primary ${styles.stepForwardBtn}`}
                disabled={!canGoToStep3}
              >
                <span>{t('auth.continueToTerms')}</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* ----------------- PASSO 3: TERMOS DE USO & PRIVACIDADE (ANPD / LGPD) ----------------- */}
        {step === 3 && (
          <form onSubmit={handleRegister} className={styles.stepForm}>
            <div className={styles.step3Header}>
              <span className={styles.step3Subtitle}>
                {t('auth.selectTermsSubtitle')}
              </span>
              <button
                type="button"
                onClick={handleSelectAllTerms}
                className={styles.selectAllBtn}
              >
                {acceptTerms && acceptPrivacy && acceptSafety ? t('auth.uncheckAll') : t('auth.acceptAll')}
              </button>
            </div>

            <div className="terms-step-list">
              {/* Item 1: Termos de Uso */}
              <div
                className={`terms-card-item ${acceptTerms ? 'checked' : ''}`}
                onClick={() => setAcceptTerms(!acceptTerms)}
              >
                <input
                  type="checkbox"
                  className="terms-card-checkbox"
                  checked={acceptTerms}
                  onChange={(e) => {
                    e.stopPropagation();
                    setAcceptTerms(e.target.checked);
                  }}
                />
                <div className="terms-card-body">
                  <div className="terms-card-title-row">
                    <span className="terms-card-title">
                      <FileText size={14} color="#34d399" />
                      {t('auth.termsOfServiceTitle')}
                    </span>
                    <button
                      type="button"
                      className="terms-card-read-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingDoc('terms');
                        setDocViewMode('summary');
                      }}
                      title={t('auth.readSummary')}
                    >
                      <BookOpen size={11} />
                      <span>{t('auth.readSummary')}</span>
                    </button>
                  </div>
                  <p className="terms-card-desc">
                    {t('auth.termsOfServiceDesc')}
                  </p>
                </div>
              </div>

              {/* Item 2: Privacidade, LGPD & ANPD */}
              <div
                className={`terms-card-item ${acceptPrivacy ? 'checked' : ''}`}
                onClick={() => setAcceptPrivacy(!acceptPrivacy)}
              >
                <input
                  type="checkbox"
                  className="terms-card-checkbox"
                  checked={acceptPrivacy}
                  onChange={(e) => {
                    e.stopPropagation();
                    setAcceptPrivacy(e.target.checked);
                  }}
                />
                <div className="terms-card-body">
                  <div className="terms-card-title-row">
                    <span className="terms-card-title">
                      <Lock size={14} color="#60a5fa" />
                      {t('auth.privacyGuidelinesTitle')}
                    </span>
                    <button
                      type="button"
                      className="terms-card-read-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingDoc('privacy');
                        setDocViewMode('summary');
                      }}
                      title={t('auth.readSummary')}
                    >
                      <BookOpen size={11} />
                      <span>{t('auth.readSummary')}</span>
                    </button>
                  </div>
                  <p className="terms-card-desc">
                    {t('auth.privacyGuidelinesDesc')}
                  </p>
                </div>
              </div>

              {/* Item 3: Proteção ao Menor (ECA Digital) */}
              <div
                className={`terms-card-item ${acceptSafety ? 'checked' : ''}`}
                onClick={() => setAcceptSafety(!acceptSafety)}
              >
                <input
                  type="checkbox"
                  className="terms-card-checkbox"
                  checked={acceptSafety}
                  onChange={(e) => {
                    e.stopPropagation();
                    setAcceptSafety(e.target.checked);
                  }}
                />
                <div className="terms-card-body">
                  <div className="terms-card-title-row">
                    <span className="terms-card-title">
                      <HeartHandshake size={14} color="#c084fc" />
                      {t('auth.childProtectionTitle')}
                    </span>
                    <button
                      type="button"
                      className="terms-card-read-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingDoc('safety');
                        setDocViewMode('summary');
                      }}
                      title={t('auth.readSummary')}
                    >
                      <BookOpen size={11} />
                      <span>{t('auth.readSummary')}</span>
                    </button>
                  </div>
                  <p className="terms-card-desc">
                    {t('auth.childProtectionDesc')}
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.stepActionsRow}>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStep(2);
                }}
                className={`btn-secondary ${styles.stepBackBtn}`}
              >
                <ArrowLeft size={15} />
                <span>{t('auth.back')}</span>
              </button>

              <button
                type="submit"
                className={`btn-primary ${styles.stepForwardBtn}`}
                disabled={isLoading || !acceptTerms || !acceptPrivacy || !acceptSafety}
              >
                {isLoading ? <span className="btn-spinner" /> : t('auth.createAccountConfirm')}
              </button>
            </div>
          </form>
        )}

        {/* Rodapé / Link para Login */}
        <div className={`auth-footer ${styles.authFooterBox}`}>
          {t('auth.register.hasAccount')}{' '}
          <Link
            to={AppRoutes.LOGIN}
            className={styles.loginInlineLink}
          >
            {t('auth.login.button')}
          </Link>
        </div>
      </div>

      {/* =========================================================================
          MODAL DE TERMOS & DIRETRIZES (PRIMEIRA VERSÃO LIMPA)
          ========================================================================= */}
      {viewingDoc && (
        <div className="legal-document-modal" onClick={() => { setViewingDoc(null); setDocViewMode('summary'); }}>
          <div className="legal-document-card" onClick={(e) => e.stopPropagation()}>
            <div className="legal-document-header">
              <h2 className={styles.modalHeaderTitle}>
                {viewingDoc === 'terms' && <FileText size={18} color="#34d399" />}
                {viewingDoc === 'privacy' && <Lock size={18} color="#60a5fa" />}
                {viewingDoc === 'safety' && <HeartHandshake size={18} color="#c084fc" />}
                {viewingDoc === 'terms' && t('auth.terms.modalTitleTerms')}
                {viewingDoc === 'privacy' && t('auth.terms.modalTitlePrivacy')}
                {viewingDoc === 'safety' && t('auth.terms.modalTitleSafety')}
              </h2>
              <button
                onClick={() => { setViewingDoc(null); setDocViewMode('summary'); }}
                className={styles.modalCloseBtn}
                aria-label={t('common.close')}
              >
                <X size={20} />
              </button>
            </div>

            <div className="legal-document-body">
              <LegalDocumentContent
                doc={viewingDoc}
                mode={docViewMode}
                onSwitchMode={setDocViewMode}
              />
            </div>

            <div className="legal-document-footer">
              <button
                type="button"
                className={`btn-primary ${styles.modalAgreeBtn}`}
                onClick={() => {
                  if (viewingDoc === 'terms') setAcceptTerms(true);
                  if (viewingDoc === 'privacy') setAcceptPrivacy(true);
                  if (viewingDoc === 'safety') setAcceptSafety(true);
                  setViewingDoc(null);
                  setDocViewMode('summary');
                }}
              >
                {t('auth.terms.agreeAndClose')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
