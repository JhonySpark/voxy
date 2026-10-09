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
        const res = await api.get<BetaStatus>(ApiRoutes.AUTH_BETA_STATUS);
        setBetaStatus(res.data);
        if (res.data && !res.data.isOpen && !searchParams.get('verify')) {
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
        setVerificationMsg('Código de confirmação enviado para seu e-mail!');
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
      setError('Por favor, informe um endereço de e-mail válido.');
      return;
    }
    if (usernameStatus !== 'available') {
      setError(usernameMsg || 'Escolha um nome de usuário disponível.');
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
      setError('Por favor, informe sua data de nascimento.');
      return;
    }
    if (isChild) {
      setStep('child_blocked');
      return;
    }
    if (!isPasswordValid) {
      setError('A senha deve atender a todos os requisitos de segurança.');
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
      setError('É necessário aceitar todos os termos, política de privacidade e diretrizes legais para continuar.');
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
        setVerificationMsg('Código de confirmação enviado para seu e-mail!');
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
      setError(getApiErrorMessage(err, 'Código inválido ou expirado. Tente novamente.'));
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
      setVerificationMsg('Um novo código de 6 dígitos foi enviado para o seu e-mail.');
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Não foi possível reenviar o código.'));
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
      <div className="auth-container">
        <div className="auth-card-wizard">
          <div className="beta-full-card">
            <div style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b',
              boxShadow: '0 0 25px rgba(245, 158, 11, 0.25)',
            }}>
              <Users size={36} />
            </div>

            <div className="beta-capacity-badge" style={{ background: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' }}>
              <span>Vagas Esgotadas ({betaStatus?.currentUsers ?? 50}/{betaStatus?.maxUsers ?? 50})</span>
            </div>

            <div>
              <h1 className="auth-title" style={{ fontSize: '1.4rem', color: '#fbbf24', margin: 0 }}>
                Beta Fechado Lotado
              </h1>
              <p className="auth-subtitle" style={{ marginTop: '0.6rem', fontSize: '0.85rem', lineHeight: '1.5' }}>
                Para garantir a melhor latência de áudio e máxima estabilidade de conexão durante os primeiros testes, limitamos o acesso inicial a <strong>{betaStatus?.maxUsers ?? 50} usuários</strong>.
              </p>
              <p className="auth-subtitle" style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Todas as vagas foram preenchidas no momento. Fique atento às nossas atualizações para a próxima abertura de vagas!
              </p>
            </div>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
              <Link to={AppRoutes.LOGIN} className="btn-primary" style={{ textDecoration: 'none', padding: '0.75rem' }}>
                Já possui conta? Fazer Login
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
      <div className="auth-container">
        <div className="auth-card-wizard" style={{ textAlign: 'center', padding: '2.5rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
            }}>
              <ShieldAlert size={36} />
            </div>
          </div>
          <h1 className="auth-title" style={{ color: '#ef4444' }}>Acesso Restrito</h1>
          <p className="auth-subtitle" style={{ marginTop: '0.75rem', lineHeight: '1.6' }}>
            De acordo com o Estatuto da Criança e do Adolescente (ECA Digital) e leis de proteção de dados (LGPD Art. 14), o cadastro é restrito para usuários a partir de 13 anos.
          </p>
          <div style={{ marginTop: '2rem' }}>
            <Link to={AppRoutes.LOGIN} className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none', padding: '0.75rem 1.5rem' }}>
              Voltar ao Início
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
      <div className="auth-container">
        <div className="auth-card-wizard">
          {/* Cabeçalho de Confirmação (EM CIMA) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: '0.25rem' }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: 'rgba(52, 211, 153, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-primary)',
              marginBottom: '0.6rem',
              boxShadow: '0 0 20px rgba(52, 211, 153, 0.2)'
            }}>
              <Mail size={26} />
            </div>
            <h1 className="auth-title" style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>
              {isFromLogin ? 'Verifique seu e-mail para acessar' : 'Confirme seu e-mail'}
            </h1>
            <p className="auth-subtitle" style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
              {isFromLogin
                ? 'Sua conta ainda não foi confirmada. Insira o código de 6 dígitos que enviamos para:'
                : 'Insira o código de 6 dígitos que enviamos para:'} <br />
              <strong style={{ color: 'var(--text-primary)' }}>{targetEmail}</strong>
            </p>
          </div>

          {/* Stepper dos Passos (EM BAIXO DO TÍTULO) */}
          {!isFromLogin && (
            <div className="wizard-stepper-bar" style={{ marginTop: '0.25rem' }}>
              <div className="wizard-step-node completed">
                <div className="wizard-step-bullet completed">✓</div>
                <span className="wizard-step-label">Identidade</span>
              </div>
              <div className="wizard-step-connector active" />

              <div className="wizard-step-node completed">
                <div className="wizard-step-bullet completed">✓</div>
                <span className="wizard-step-label">Segurança</span>
              </div>
              <div className="wizard-step-connector active" />

              <div className="wizard-step-node completed">
                <div className="wizard-step-bullet completed">✓</div>
                <span className="wizard-step-label">Termos</span>
              </div>
              <div className="wizard-step-connector active" />

              <div className="wizard-step-node active">
                <div className="wizard-step-bullet active">4</div>
                <span className="wizard-step-label">Código</span>
              </div>
            </div>
          )}

          {verificationMsg && (
            <div style={{ color: 'var(--brand-primary)', fontSize: '0.82rem', textAlign: 'center', background: 'rgba(52, 211, 153, 0.08)', padding: '0.45rem', borderRadius: '0.5rem', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
              {verificationMsg}
            </div>
          )}

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: '0.82rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.08)', padding: '0.45rem', borderRadius: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
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
            className="btn-primary"
            disabled={isVerifying || fullOtp.length !== 6}
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.25rem' }}
          >
            {isVerifying ? <span className="btn-spinner" /> : 'Confirmar e Acessar'}
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={handleResendCode}
              disabled={resendCooldown > 0}
              style={{
                background: 'none',
                border: 'none',
                color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--brand-primary)',
                cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <RefreshCw size={13} />
              <span>
                {resendCooldown > 0
                  ? `Reenviar código em ${resendCooldown}s`
                  : 'Não recebeu o código? Clique para reenviar'}
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
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                textDecoration: 'underline'
              }}
            >
              {isFromLogin ? '← Voltar para o Login' : '← Corrigir e-mail ou dados'}
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
    <div className="auth-container">
      <div className="auth-card-wizard">
        {/* 1. Cabeçalho com Logo e Título com Largura Total (EM CIMA) */}
        <div className="wizard-title-row">
          <img
            src={heroLogo}
            alt="Voxy Logo"
            style={{
              width: '40px',
              height: '40px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 10px rgba(52, 211, 153, 0.35))',
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="auth-title" style={{ fontSize: '1.25rem', textAlign: 'left', margin: 0, lineHeight: 1.2 }}>
              {step === 1 && 'Criar sua conta'}
              {step === 2 && 'Segurança & Idade'}
              {step === 3 && 'Termos & Privacidade'}
            </h1>
            <p className="auth-subtitle" style={{ fontSize: '0.8rem', textAlign: 'left', margin: '0.2rem 0 0', color: 'var(--text-secondary)' }}>
              {step === 1 && 'Informe seu e-mail e escolha seu nome de usuário'}
              {step === 2 && 'Defina sua data de nascimento e senha de acesso'}
              {step === 3 && 'Consentimento legal e salvaguardas (ANPD/LGPD)'}
            </p>
          </div>
        </div>

        {/* 2. Barra dos 4 Passos (EM BAIXO) */}
        <div className="wizard-stepper-bar">
          <div className={`wizard-step-node ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
            <div className={`wizard-step-bullet ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
              {step > 1 ? '✓' : '1'}
            </div>
            <span className="wizard-step-label">Identidade</span>
          </div>
          <div className={`wizard-step-connector ${step > 1 ? 'active' : ''}`} />

          <div className={`wizard-step-node ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
            <div className={`wizard-step-bullet ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
              {step > 2 ? '✓' : '2'}
            </div>
            <span className="wizard-step-label">Segurança</span>
          </div>
          <div className={`wizard-step-connector ${step > 2 ? 'active' : ''}`} />

          <div className={`wizard-step-node ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}>
            <div className={`wizard-step-bullet ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}>
              {step > 3 ? '✓' : '3'}
            </div>
            <span className="wizard-step-label">Termos</span>
          </div>
          <div className={`wizard-step-connector ${step > 3 ? 'active' : ''}`} />

          <div className="wizard-step-node">
            <div className="wizard-step-bullet">
              4
            </div>
            <span className="wizard-step-label">Código</span>
          </div>
        </div>

        {/* Badge Informativo de Vagas Beta */}
        {betaStatus && betaStatus.maxUsers > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="beta-capacity-badge">
              <Sparkles size={12} />
              <span>
                Beta Fechado: {betaStatus.currentUsers}/{betaStatus.maxUsers} vagas preenchidas ({betaStatus.remainingSlots} restantes)
              </span>
            </div>
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: '0.82rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.08)', padding: '0.45rem', borderRadius: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {error}
          </div>
        )}

        {/* ----------------- PASSO 1: IDENTIDADE ----------------- */}
        {step === 1 && (
          <form onSubmit={handleNextToStep2} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
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
                  style={{ marginTop: '0.15rem' }}
                >
                  {usernameStatus === 'checking' && <Loader2 size={12} className="btn-spinner" />}
                  {usernameStatus === 'available' && <Check size={13} />}
                  {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <AlertCircle size={13} />}
                  <span style={{ fontSize: '0.78rem' }}>{usernameMsg}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={!canGoToStep2}
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <span>Continuar para Senha</span>
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* ----------------- PASSO 2: SEGURANÇA E NASCIMENTO ----------------- */}
        {step === 2 && (
          <form onSubmit={handleNextToStep3} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div className="input-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="input-label" style={{ margin: 0 }}>Data de Nascimento</label>
                {declaredAge !== null && (
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: isChild
                      ? 'rgba(239, 68, 68, 0.15)'
                      : isTeen
                      ? 'rgba(59, 130, 246, 0.15)'
                      : 'rgba(52, 211, 153, 0.15)',
                    color: isChild ? '#ef4444' : isTeen ? '#60a5fa' : 'var(--brand-primary)',
                  }}>
                    {isChild && <AlertCircle size={11} />}
                    {isTeen && <ShieldCheck size={11} />}
                    {isAdult && <UserCheck size={11} />}
                    {isChild ? 'Menor de 13 anos' : isTeen ? `${declaredAge} anos (Conta Jovem)` : `${declaredAge} anos (Adulto)`}
                  </span>
                )}
              </div>

              <input
                type="date"
                className="text-input"
                value={birthDate}
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setBirthDate(e.target.value)}
                required
                style={{ colorScheme: 'dark', padding: '0.65rem 0.85rem' }}
              />
            </div>

            <div className="input-group">
              <label className="input-label">{t('auth.register.password')}</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="text-input"
                  placeholder={t('auth.register.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ padding: '0.65rem 0.85rem' }}
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
                  {reqMinChars && <Check size={10} />} 8+ chars
                </span>
                <span className={`pwd-badge ${reqUpper ? 'active' : ''}`}>
                  {reqUpper && <Check size={10} />} Maiúscula
                </span>
                <span className={`pwd-badge ${reqLower ? 'active' : ''}`}>
                  {reqLower && <Check size={10} />} Minúscula
                </span>
                <span className={`pwd-badge ${reqNumber ? 'active' : ''}`}>
                  {reqNumber && <Check size={10} />} Número
                </span>
                <span className={`pwd-badge ${reqSpecial ? 'active' : ''}`}>
                  {reqSpecial && <Check size={10} />} Símbolo
                </span>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">{t('auth.register.confirmPassword')}</label>
              <input
                type={showPassword ? 'text' : 'password'}
                className="text-input"
                placeholder={t('auth.register.passwordPlaceholder')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{ padding: '0.65rem 0.85rem' }}
              />
              {passwordsMatch && (
                <div className="input-feedback success" style={{ marginTop: '0.1rem' }}>
                  <Check size={12} />
                  <span style={{ fontSize: '0.78rem' }}>{t('auth.register.passwordsMatch')}</span>
                </div>
              )}
              {passwordsMismatch && (
                <div className="input-feedback error" style={{ marginTop: '0.1rem' }}>
                  <AlertCircle size={12} />
                  <span style={{ fontSize: '0.78rem' }}>{t('auth.register.errorPasswordMismatch')}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.4rem' }}>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStep(1);
                }}
                className="btn-secondary"
                style={{
                  flex: '0 0 auto',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '0.5rem',
                  color: 'var(--text-secondary)'
                }}
              >
                <ArrowLeft size={15} />
                <span>Voltar</span>
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={!canGoToStep3}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>Continuar para Termos</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}

        {/* ----------------- PASSO 3: TERMOS DE USO & PRIVACIDADE (ANPD / LGPD) ----------------- */}
        {step === 3 && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '-0.2rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Selecione cada item para prosseguir:
              </span>
              <button
                type="button"
                onClick={handleSelectAllTerms}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand-primary)',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textDecoration: 'underline'
                }}
              >
                {acceptTerms && acceptPrivacy && acceptSafety ? 'Desmarcar todos' : 'Aceitar todos'}
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
                      Termos de Serviço do Voxy
                    </span>
                    <button
                      type="button"
                      className="terms-card-read-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingDoc('terms');
                        setDocViewMode('summary');
                      }}
                      title="Ver resumo dos Termos de Serviço"
                    >
                      <BookOpen size={11} />
                      <span>Ler resumo</span>
                    </button>
                  </div>
                  <p className="terms-card-desc">
                    Regras de convivência, uso responsável de salas de voz e proibição de condutas abusivas ou ilícitas.
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
                      Privacidade & Diretrizes da ANPD
                    </span>
                    <button
                      type="button"
                      className="terms-card-read-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingDoc('privacy');
                        setDocViewMode('summary');
                      }}
                      title="Ver resumo da Política de Privacidade"
                    >
                      <BookOpen size={11} />
                      <span>Ler resumo</span>
                    </button>
                  </div>
                  <p className="terms-card-desc">
                    Tratamento de dados mínimos (LGPD Art. 7 e 14). Suas chamadas de voz e streams são efêmeros e <strong>nunca gravados</strong>.
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
                      Proteção a Menores (ECA Digital)
                    </span>
                    <button
                      type="button"
                      className="terms-card-read-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingDoc('safety');
                        setDocViewMode('summary');
                      }}
                      title="Ver resumo das diretrizes de Proteção a Menores"
                    >
                      <BookOpen size={11} />
                      <span>Ler resumo</span>
                    </button>
                  </div>
                  <p className="terms-card-desc">
                    Salvaguardas automáticas para adolescentes e bloqueio total de menores de 13 anos.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.35rem' }}>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStep(2);
                }}
                className="btn-secondary"
                style={{
                  flex: '0 0 auto',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '0.5rem',
                  color: 'var(--text-secondary)'
                }}
              >
                <ArrowLeft size={15} />
                <span>Voltar</span>
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={isLoading || !acceptTerms || !acceptPrivacy || !acceptSafety}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {isLoading ? <span className="btn-spinner" /> : 'Criar Conta e Confirmar'}
              </button>
            </div>
          </form>
        )}

        {/* Rodapé / Link para Login */}
        <div
          className="auth-footer"
          style={{
            textAlign: 'center',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            marginTop: '0.3rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          {t('auth.register.hasAccount')}{' '}
          <Link
            to={AppRoutes.LOGIN}
            style={{ color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none' }}
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
              <h2 style={{ fontSize: '1.05rem', margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {viewingDoc === 'terms' && <FileText size={18} color="#34d399" />}
                {viewingDoc === 'privacy' && <Lock size={18} color="#60a5fa" />}
                {viewingDoc === 'safety' && <HeartHandshake size={18} color="#c084fc" />}
                {viewingDoc === 'terms' && 'Termos de Serviço do Voxy'}
                {viewingDoc === 'privacy' && 'Política de Privacidade & ANPD / LGPD'}
                {viewingDoc === 'safety' && 'Segurança Infantil & ECA Digital'}
              </h2>
              <button
                onClick={() => { setViewingDoc(null); setDocViewMode('summary'); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4
                }}
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="legal-document-body">
              {/* TERMOS DE USO */}
              {viewingDoc === 'terms' && (
                docViewMode === 'summary' ? (
                  <>
                    <h3>1. Aceite e Elegibilidade</h3>
                    <p>
                      Ao utilizar o Voxy, você declara ter pelo menos 13 anos completos e concordar com estes Termos de Serviço. Menores de 13 anos não podem criar conta em nossa plataforma.
                    </p>
                    <h3>2. Diretrizes de Conduta da Comunidade</h3>
                    <p>
                      É estritamente vedada a prática de assédio, perseguição digital, propagação de discurso de ódio, conteúdo com exploração ou abuso de menores, doxxing ou disseminação de arquivos maliciosos.
                    </p>
                    <h3>3. Servidores e Comunidades</h3>
                    <p>
                      Os donos de servidor são os primeiros responsáveis pela moderação de suas respectivas salas e canais. O Voxy reserva-se o direito de intervir e aplicar suspensões cautelares em caso de risco iminente à integridade física ou psicológica de usuários.
                    </p>

                    <div className="legal-summary-callout">
                      <div className="legal-summary-callout-text">
                        <div className="legal-summary-callout-title">
                          <BookOpen size={15} color="#34d399" />
                          <span>Deseja consultar o termo completo na íntegra?</span>
                        </div>
                        <p>
                          Acesse o texto jurídico oficial com todos os artigos, bases legais e direitos do usuário.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="legal-summary-callout-btn"
                        onClick={() => setDocViewMode('full')}
                      >
                        Ler termo completo →
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <div>
                        <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: '0 0 0.25rem' }}>Termos de Uso da Plataforma Voxy</h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Versão 1.0 • Atualizada em Março de 2026 • Legislação Brasileira</span>
                      </div>
                      <button
                        type="button"
                        className="legal-doc-back-pill"
                        onClick={() => setDocViewMode('summary')}
                      >
                        ← Voltar ao resumo
                      </button>
                    </div>

                    <p>
                      Estes Termos de Uso ("Termos") regem o acesso e a utilização dos serviços, aplicativos para desktop e web, canais de voz de baixa latência, salas de bate-papo e streaming de jogos oferecidos pela plataforma <strong>Voxy</strong>. Ao criar uma conta ou utilizar o serviço, você declara expressamente que leu, compreendeu e concorda com as disposições abaixo.
                    </p>

                    <h3>1. Elegibilidade e Idade Mínima Obrigatória</h3>
                    <p>
                      <strong>1.1. Proibição a menores de 13 anos:</strong> O Voxy não é destinado a crianças menores de 13 (treze) anos. O cadastro é tecnologicamente restrito e bloqueado na raiz da aplicação em cumprimento à legislação brasileira de proteção de dados.
                    </p>
                    <p>
                      <strong>1.2. Contas Jovens (13 a 17 anos):</strong> Adolescentes podem utilizar os recursos sociais com salvaguardas ativas de segurança por design, incluindo restrição de captura de telas genéricas e bloqueio automático de entrada em ambientes marcados como +18.
                    </p>
                    <p>
                      <strong>1.3. Maiores de 18 Anos:</strong> A criação de servidores com conteúdo adulto e a transmissão de jogos categorizados como maduros é restrita exclusivamente a usuários com classificação etária confirmada como adultos (ADULT).
                    </p>

                    <h3>2. Cadastro, Conta e Segurança das Credenciais</h3>
                    <p>
                      <strong>2.1. Validação de E-mail Obrigatória:</strong> Todas as novas contas devem validar a posse do endereço de e-mail por meio de token transacional de 6 dígitos antes da liberação dos canais sociais.
                    </p>
                    <p>
                      <strong>2.2. Guarda de Senha:</strong> O usuário é o único responsável pela guarda e confidencialidade de suas credenciais de acesso. Atividades realizadas a partir de sua conta serão atribuídas ao respectivo titular.
                    </p>
                    <p>
                      <strong>2.3. Pessoal e Intransferível:</strong> É vedada a venda, locação ou cessão de contas a terceiros.
                    </p>

                    <h3>3. Diretrizes de Conduta e Usos Expressamente Proibidos</h3>
                    <p>Ao utilizar o Voxy, o usuário se compromete solenemente a <strong>NÃO</strong>:</p>
                    <ul>
                      <li>Praticar qualquer conduta que coloque em risco crianças ou adolescentes, incluindo aliciamento (grooming), envio de material inadequado ou compartilhamento de pornografia infantil;</li>
                      <li>Praticar assédio, perseguição digital (cyberstalking), ameaças de violência ou discurso de ódio baseado em raça, gênero, religião ou orientação sexual;</li>
                      <li>Transmitir conteúdo sexual explícito, pornografia, nudez não consentida ou violência gráfica excessiva;</li>
                      <li>Praticar doxxing, expondo dados pessoais, documentos ou endereços de terceiros sem autorização;</li>
                      <li>Disseminar vírus, malwares, keyloggers ou links fraudulentos de phishing;</li>
                      <li>Utilizar automações abusivas, sobrecarregar os servidores ou realizar ataques de negação de serviço.</li>
                    </ul>

                    <h3>4. Transmissão de Tela e Streaming de Jogos</h3>
                    <p>
                      <strong>4.1. Foco em Gameplay:</strong> A tecnologia de transmissão do Voxy é primariamente orientada à captura de janelas de processos de jogos detectados.
                    </p>
                    <p>
                      <strong>4.2. Efemeridade:</strong> O Voxy não grava nem armazena em disco fluxos de áudio de chamadas de voz ou vídeo de transmissões. Todas as mídias são efêmeras em tempo real via WebRTC.
                    </p>

                    <h3>5. Responsabilidade dos Donos e Moderadores de Servidores</h3>
                    <p>
                      Os criadores e moderadores de servidores são responsáveis pela harmonia e moderação diária de suas comunidades, devendo utilizar as ferramentas de silenciamento, expulsão e banimento contra infratores. O Voxy reserva-se o direito de intervir e aplicar suspensões preventivas a servidores que violem as leis brasileiras.
                    </p>

                    <h3>6. Foro e Resolução de Disputas</h3>
                    <p>
                      Estes Termos são regidos pelo ordenamento jurídico brasileiro (Marco Civil da Internet, LGPD e Código de Defesa do Consumidor). Fica eleito o Foro da Comarca do domicílio do Usuário para dirimir eventuais controvérsias.
                    </p>
                  </>
                )
              )}

              {/* POLÍTICA DE PRIVACIDADE & ANPD */}
              {viewingDoc === 'privacy' && (
                docViewMode === 'summary' ? (
                  <>
                    <h3>1. Compromisso com a Privacidade (LGPD & ANPD)</h3>
                    <p>
                      O Voxy opera sob princípios de <strong>minimização de dados</strong> e <strong>efemeridade</strong>. Não vendemos dados pessoais e não veiculamos publicidade rastreadora.
                    </p>
                    <h3>2. Transmissões de Áudio e Vídeo em Tempo Real</h3>
                    <p>
                      As transmissões de voz (WebRTC) e captura de tela de jogos são fluxos efêmeros em tempo real. <strong>O Voxy não grava nem armazena em disco o conteúdo de áudio ou vídeo das suas chamadas.</strong>
                    </p>
                    <h3>3. Tratamento de Dados de Menores</h3>
                    <p>
                      O tratamento de dados de adolescentes entre 13 e 17 anos é efetuado em estrita observância ao seu melhor interesse (Art. 14 da LGPD), sem criação de perfis comportamentais.
                    </p>

                    <div className="legal-summary-callout">
                      <div className="legal-summary-callout-text">
                        <div className="legal-summary-callout-title">
                          <BookOpen size={15} color="#60a5fa" />
                          <span>Deseja consultar a política completa na íntegra?</span>
                        </div>
                        <p>
                          Acesse a íntegra em conformidade com a LGPD (Lei nº 13.709/2018), bases legais da ANPD e canal do DPO.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="legal-summary-callout-btn"
                        onClick={() => setDocViewMode('full')}
                      >
                        Ler política completa →
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <div>
                        <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: '0 0 0.25rem' }}>Política de Privacidade e Proteção de Dados (LGPD)</h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Conformidade com a Lei nº 13.709/2018 (LGPD) e Orientações da ANPD • Versão 1.0</span>
                      </div>
                      <button
                        type="button"
                        className="legal-doc-back-pill"
                        onClick={() => setDocViewMode('summary')}
                      >
                        ← Voltar ao resumo
                      </button>
                    </div>

                    <p>
                      O Voxy adota o princípio da <strong>privacidade por padrão</strong> (Privacy by Design). Não vendemos seus dados para corretores de dados, não exibimos anúncios comportamentais e coletamos apenas o estritamente indispensável para conectar você aos seus amigos.
                    </p>

                    <h3>1. Categorias de Dados Pessoais Coletados</h3>
                    <table className="legal-table">
                      <thead>
                        <tr>
                          <th>Dado</th>
                          <th>Finalidade</th>
                          <th>Base Legal (LGPD)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>E-mail, Nickname e Senha</td>
                          <td>Autenticação e segurança da conta</td>
                          <td>Execução de Contrato (Art. 7º, V)</td>
                        </tr>
                        <tr>
                          <td>Data de Nascimento Declarada</td>
                          <td>Salvaguarda etária e proteção de menores</td>
                          <td>Obrigação Legal e Art. 14</td>
                        </tr>
                        <tr>
                          <td>Registros de Acesso (IP e timestamps)</td>
                          <td>Guarda obrigatória contra crimes digitais</td>
                          <td>Art. 15 do Marco Civil da Internet</td>
                        </tr>
                        <tr>
                          <td>Voz e Transmissões de Tela</td>
                          <td>Comunicação em tempo real (não é gravada)</td>
                          <td>Execução de Contrato (Art. 7º, V)</td>
                        </tr>
                      </tbody>
                    </table>

                    <h3>2. Chamadas de Voz e Vídeo são 100% Efêmeras</h3>
                    <p>
                      O tráfego de voz e vídeo trafega diretamente por protocolos criptografados (WebRTC com SRTP/DTLS) através de servidores de roteamento de mídia (SFU). <strong>Não gravamos, não transcrevemos e não guardamos conversas de áudio em nenhuma base de dados.</strong>
                    </p>

                    <h3>3. Proteção e Melhor Interesse de Menores (Art. 14 da LGPD)</h3>
                    <p>
                      O tratamento de dados de adolescentes entre 13 e 17 anos é orientado exclusivamente ao seu melhor interesse. Não é realizado rastreamento para anúncios e contas jovens possuem restrições ativas contra exposições indevidas.
                    </p>

                    <h3>4. Compartilhamento Estritamente Operacional</h3>
                    <p>
                      Seus dados nunca são comercializados. O compartilhamento ocorre exclusivamente com parceiros de infraestrutura necessários para a entrega técnica do app (Neon Inc. para banco de dados transacional, Cloudflare para armazenamento criptografado de anexos e Resend para e-mails de validação).
                    </p>

                    <h3>5. Seus Direitos como Titular (Art. 18 da LGPD)</h3>
                    <p>
                      Você tem o direito de solicitar a confirmação, o acesso, a retificação de dados incorretos ou a eliminação definitiva de sua conta a qualquer momento pelo e-mail do Encarregado de Dados (DPO): <code>dpo@voxy.app</code>.
                    </p>
                  </>
                )
              )}

              {/* SEGURANÇA INFANTIL & ECA DIGITAL */}
              {viewingDoc === 'safety' && (
                docViewMode === 'summary' ? (
                  <>
                    <h3>1. Conformidade com o ECA Digital</h3>
                    <p>
                      Nossa plataforma adota mecanismos de proteção por design (safety by design) para oferecer uma experiência adequada à idade.
                    </p>
                    <h3>2. Proteção de Contas Jovens (13 a 17 anos)</h3>
                    <p>
                      Adolescentes possuem restrições ativas para transmissões genéricas de tela e impedimento de acesso a comunidades marcadas como +18.
                    </p>
                    <h3>3. Tolerância Zero a Abusos</h3>
                    <p>
                      Qualquer indício ou tentativa de exploração infantil resultará no banimento imediato da conta, registro de logs de auditoria técnica e cooperação irrestrita com autoridades policiais competentes.
                    </p>

                    <div className="legal-summary-callout">
                      <div className="legal-summary-callout-text">
                        <div className="legal-summary-callout-title">
                          <BookOpen size={15} color="#c084fc" />
                          <span>Deseja consultar as diretrizes completas na íntegra?</span>
                        </div>
                        <p>
                          Acesse o detalhamento completo dos mecanismos de proteção a jovens e adolescentes (ECA Digital).
                        </p>
                      </div>
                      <button
                        type="button"
                        className="legal-summary-callout-btn"
                        onClick={() => setDocViewMode('full')}
                      >
                        Ler diretrizes completas →
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <div>
                        <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: '0 0 0.25rem' }}>Proteção à Criança e ao Adolescente (ECA Digital)</h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Em conformidade com a Lei nº 8.069/1990 (ECA) e Diretrizes Preliminares da ANPD</span>
                      </div>
                      <button
                        type="button"
                        className="legal-doc-back-pill"
                        onClick={() => setDocViewMode('summary')}
                      >
                        ← Voltar ao resumo
                      </button>
                    </div>

                    <p>
                      O Voxy adota uma postura de salvaguardas ativas para garantir ambientes digitais seguros, respeitosos e livres de abusos para adolescentes e jovens.
                    </p>

                    <h3>1. Modelo em Camadas de Proteção Etária</h3>
                    <p>
                      • <strong>Crianças (menores de 13 anos):</strong> Cadastro tecnologicamente proibido e bloqueado.
                    </p>
                    <p>
                      • <strong>Adolescentes (13 a 17 anos):</strong> Podem se comunicar em voz e texto e transmitir gameplay de jogos reconhecidos. Não podem compartilhar telas inteiras ou janelas genéricas do sistema operacional, e são impedidos de visualizar ou ingressar em comunidades +18.
                    </p>
                    <p>
                      • <strong>Adultos (18+ anos):</strong> Possuem permissão para criar ambientes adultos e transmitir qualquer janela.
                    </p>

                    <h3>2. Tolerância Zero com Abuso e Exploração Sexual Infantil</h3>
                    <p>
                      A plataforma mantém política de tolerância zero com material de exploração sexual infantil (CSAM/CSAE) e aliciamento (grooming). Qualquer incidente resulta no encerramento imediato da conta, registro de logs de auditoria e envio das informações às autoridades policiais competentes.
                    </p>

                    <h3>3. Ferramentas Nativas de Defesa do Usuário</h3>
                    <p>
                      Todos os usuários possuem acesso fácil a botões de denúncia (Report), bloqueio de contato (Block), mutação e expulsão em servidores, além de canais de auditoria contra abusos.
                    </p>
                  </>
                )
              )}
            </div>

            <div className="legal-document-footer">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (viewingDoc === 'terms') setAcceptTerms(true);
                  if (viewingDoc === 'privacy') setAcceptPrivacy(true);
                  if (viewingDoc === 'safety') setAcceptSafety(true);
                  setViewingDoc(null);
                  setDocViewMode('summary');
                }}
                style={{ padding: '0.6rem 1.4rem', fontSize: '0.85rem' }}
              >
                Concordar e Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
