import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api';
import { Eye, EyeOff, Check, AlertCircle, Loader2, Mail, ShieldAlert, RefreshCw, ArrowLeft, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApiRoutes, AppRoutes, StorageKeys, IpcChannels } from '../core/enums';
import { getApiErrorMessage, getApiCodeMessage } from '../core/utils/error.util';
import heroLogo from '../assets/logo.png';

declare const window: any;
const ipcRenderer = typeof window !== 'undefined' && window.require ? window.require('electron').ipcRenderer : null;

export default function Register() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Wizard Step: 1 = Identidade, 2 = Segurança & Idade, 3 = Verificação Token OTP, 'child_blocked' = Bloqueio Legal
  const [step, setStep] = useState<1 | 2 | 3 | 'child_blocked'>(1);

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
  const [acceptTerms, setAcceptTerms] = useState(true);

  // Passo 3: Token OTP de 6 dígitos
  const [targetEmail, setTargetEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationMsg, setVerificationMsg] = useState('');

  // Estados gerais
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Redirecionamento vindo do login com ?verify=email
  useEffect(() => {
    const verifyEmailParam = searchParams.get('verify');
    if (verifyEmailParam) {
      setTargetEmail(verifyEmailParam);
      setEmail(verifyEmailParam);
      setStep(3);
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

  // Foco automático no primeiro quadradinho do OTP ao entrar no passo 3
  useEffect(() => {
    if (step === 3) {
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

  // Submissão do Passo 2 -> Criação da Conta e envio de código
  const handleRegister = async (e: React.FormEvent) => {
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
    if (!acceptTerms) {
      setError(t('auth.register.errorTerms'));
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
      });

      setTargetEmail(email.trim());
      setResendCooldown(60);

      if (res.data?.requireEmailVerification !== false) {
        setVerificationMsg('Código de confirmação enviado para seu e-mail!');
        setStep(3);
      } else {
        // Fallback se verificação de e-mail estiver desabilitada
        const loginRes = await api.post(ApiRoutes.AUTH_LOGIN, { email: email.trim(), password });
        localStorage.setItem(StorageKeys.AUTH_TOKEN, loginRes.data.access_token);
        navigate(AppRoutes.APP);
      }
    } catch (err: any) {
      setError(getApiErrorMessage(err, t('auth.register.failed')));
    } finally {
      setIsLoading(false);
    }
  };

  // Manipuladores dos inputs quadradinhos de dígitos (OTP)
  const handleOtpChange = (index: number, val: string) => {
    // Permite apenas dígitos
    const cleanDigit = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleanDigit;
    setOtpDigits(newDigits);
    setError('');

    if (cleanDigit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Se preencheu todos os 6 dígitos, dispara validação automaticamente
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

    // Foca na última caixa preenchida ou na subsequente
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

        // Se estiver no Electron, coleta sinal de idade do SO assinado criptograficamente
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

  // =========================================================================
  // TELA 1: Bloqueio Legal para Menores de 13 Anos (CHILD)
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
  // TELA 2: Passo 3 - Verificação de E-mail (Token com 6 inputs quadradinhos)
  // =========================================================================
  if (step === 3) {
    const fullOtp = otpDigits.join('');
    return (
      <div className="auth-container">
        <div className="auth-card-wizard">
          {/* Header do Wizard */}
          <div className="wizard-steps-header">
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Passo 3 de 3 • Verificação
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="wizard-step-bullet completed">✓</div>
              <div className="wizard-step-line active" style={{ width: 16 }} />
              <div className="wizard-step-bullet completed">✓</div>
              <div className="wizard-step-line active" style={{ width: 16 }} />
              <div className="wizard-step-bullet active">3</div>
            </div>
          </div>

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
              marginBottom: '0.75rem',
              boxShadow: '0 0 20px rgba(52, 211, 153, 0.2)'
            }}>
              <Mail size={26} />
            </div>
            <h1 className="auth-title" style={{ fontSize: '1.35rem', marginBottom: '0.25rem' }}>
              Confirme seu e-mail
            </h1>
            <p className="auth-subtitle" style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
              Insira o código de 6 dígitos que enviamos para <br />
              <strong style={{ color: 'var(--text-primary)' }}>{targetEmail}</strong>
            </p>
          </div>

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

          {/* Grid com 6 caixinhas individuais quadradinhas para o código */}
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
                setStep(1);
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
              ← Corrigir e-mail ou dados
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // TELA 3: Wizard - Passos 1 e 2 (Compactos, sem altura excessiva)
  // =========================================================================
  return (
    <div className="auth-container">
      <div className="auth-card-wizard">
        {/* Header compacto com Logo e Indicador de Passos */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <img
              src={heroLogo}
              alt="Voxy Logo"
              style={{
                width: '36px',
                height: '36px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 8px rgba(52, 211, 153, 0.3))',
              }}
            />
            <div>
              <h1 className="auth-title" style={{ fontSize: '1.15rem', textAlign: 'left', margin: 0 }}>
                {step === 1 ? 'Criar sua conta' : 'Segurança & Idade'}
              </h1>
              <p className="auth-subtitle" style={{ fontSize: '0.75rem', textAlign: 'left', margin: 0 }}>
                {step === 1 ? 'Passo 1 de 3: Identidade' : 'Passo 2 de 3: Senha e nascimento'}
              </p>
            </div>
          </div>

          {/* Stepper Visual (3 Passos) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div className={`wizard-step-bullet ${step === 1 ? 'active' : 'completed'}`}>
              {step > 1 ? '✓' : '1'}
            </div>
            <div className={`wizard-step-line ${step > 1 ? 'active' : ''}`} style={{ width: 14 }} />
            <div className={`wizard-step-bullet ${step === 2 ? 'active' : ''}`}>
              2
            </div>
            <div className="wizard-step-line" style={{ width: 14 }} />
            <div className="wizard-step-bullet">
              3
            </div>
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: '0.82rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.08)', padding: '0.45rem', borderRadius: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {error}
          </div>
        )}

        {/* ----------------- PASSO 1: IDENTIDADE (E-mail & Usuário) ----------------- */}
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
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {/* Data de Nascimento com tag dinâmica compacta */}
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

            {/* Senha com indicador compacto */}
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

              {/* Badges horizontais compactas de requisitos */}
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

            {/* Confirmar Senha */}
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

            {/* Termos de Uso */}
            <label className="remember-me" style={{ marginTop: '0.1rem', fontSize: '0.8rem' }}>
              <input
                type="checkbox"
                className="custom-checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
              />
              {t('auth.register.acceptTerms')}
            </label>

            {/* Botões Voltar e Finalizar Cadastro */}
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.35rem' }}>
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
                disabled={
                  isLoading ||
                  !birthDate ||
                  isChild ||
                  !isPasswordValid ||
                  !passwordsMatch ||
                  !acceptTerms
                }
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
            marginTop: '0.5rem',
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
    </div>
  );
}
