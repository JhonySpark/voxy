import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { Eye, EyeOff, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApiRoutes, AppRoutes, StorageKeys } from '../core/enums';
import { getApiErrorMessage, getApiCodeMessage } from '../core/utils/error.util';
import heroLogo from '../assets/logo.png';

export default function Register() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameMsg, setUsernameMsg] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Username validation & live availability check
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
    }, 450);

    return () => clearTimeout(timer);
  }, [username, t]);

  // Password criteria verification
  const reqMinChars = password.length >= 8;
  const reqUpper = /[A-Z]/.test(password);
  const reqLower = /[a-z]/.test(password);
  const reqNumber = /[0-9]/.test(password);
  const reqSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=~[\]\\/]/.test(password);

  const criteriaCount = [reqMinChars, reqUpper, reqLower, reqNumber, reqSpecial].filter(Boolean).length;
  const isPasswordValid = reqMinChars && reqUpper && reqLower && reqNumber && reqSpecial;

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms) {
      setError(t('auth.register.errorTerms'));
      return;
    }
    if (usernameStatus === 'taken' || usernameStatus === 'invalid') {
      setError(usernameMsg || t('auth.register.usernameInvalid'));
      return;
    }
    if (!isPasswordValid) {
      setError(t('auth.register.reqMinChars'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.register.errorPasswordMismatch'));
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await api.post(ApiRoutes.AUTH_REGISTER, { email: email.trim(), username: username.trim(), password });
      const res = await api.post(ApiRoutes.AUTH_LOGIN, { email: email.trim(), password });
      localStorage.setItem(StorageKeys.AUTH_TOKEN, res.data.access_token);
      navigate(AppRoutes.APP);
    } catch (err: any) {
      setError(getApiErrorMessage(err, t('auth.register.failed')));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.25rem' }}>
          <img
            src={heroLogo}
            alt="Voxy Logo"
            style={{
              width: '105px',
              marginTop: '-1.5rem',
              marginBottom: '0.25rem',
              filter: 'drop-shadow(0 0 12px rgba(52, 211, 153, 0.2))',
            }}
          />
          <h1 className="auth-title" style={{ marginTop: '-0.25rem' }}>
            {t('auth.register.title')}
          </h1>
          <p className="auth-subtitle">{t('auth.register.subtitle')}</p>
        </div>

        {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div className="input-group">
            <label className="input-label">{t('auth.register.email')}</label>
            <input
              type="email"
              className="text-input"
              placeholder={t('auth.register.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                {usernameStatus === 'checking' && <Loader2 size={13} className="btn-spinner" />}
                {usernameStatus === 'available' && <Check size={14} />}
                {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <AlertCircle size={14} />}
                <span>{usernameMsg}</span>
              </div>
            )}
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
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Password strength bar */}
            {password.length > 0 && (
              <>
                <div className="password-strength-bar">
                  <div
                    className={`password-strength-segment ${
                      criteriaCount >= 1
                        ? criteriaCount < 3
                          ? 'active-weak'
                          : criteriaCount < 5
                          ? 'active-medium'
                          : 'active-strong'
                        : ''
                    }`}
                  />
                  <div
                    className={`password-strength-segment ${
                      criteriaCount >= 3
                        ? criteriaCount < 5
                          ? 'active-medium'
                          : 'active-strong'
                        : ''
                    }`}
                  />
                  <div
                    className={`password-strength-segment ${
                      criteriaCount === 5 ? 'active-strong' : ''
                    }`}
                  />
                </div>

                {/* Criteria checklist */}
                <div className="password-criteria-list">
                  <div className={`password-criteria-item ${reqMinChars ? 'met' : 'unmet'}`}>
                    <Check size={12} strokeWidth={reqMinChars ? 3 : 1.5} />
                    <span>{t('auth.register.reqMinChars')}</span>
                  </div>
                  <div className={`password-criteria-item ${reqUpper ? 'met' : 'unmet'}`}>
                    <Check size={12} strokeWidth={reqUpper ? 3 : 1.5} />
                    <span>{t('auth.register.reqUppercase')}</span>
                  </div>
                  <div className={`password-criteria-item ${reqLower ? 'met' : 'unmet'}`}>
                    <Check size={12} strokeWidth={reqLower ? 3 : 1.5} />
                    <span>{t('auth.register.reqLowercase')}</span>
                  </div>
                  <div className={`password-criteria-item ${reqNumber ? 'met' : 'unmet'}`}>
                    <Check size={12} strokeWidth={reqNumber ? 3 : 1.5} />
                    <span>{t('auth.register.reqNumber')}</span>
                  </div>
                  <div className={`password-criteria-item ${reqSpecial ? 'met' : 'unmet'}`}>
                    <Check size={12} strokeWidth={reqSpecial ? 3 : 1.5} />
                    <span>{t('auth.register.reqSpecial')}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="input-group">
            <label className="input-label">{t('auth.register.confirmPassword')}</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                className="text-input"
                placeholder={t('auth.register.passwordPlaceholder')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {passwordsMatch && (
              <div className="input-feedback success">
                <Check size={14} />
                <span>{t('auth.register.passwordsMatch')}</span>
              </div>
            )}
            {passwordsMismatch && (
              <div className="input-feedback error">
                <AlertCircle size={14} />
                <span>{t('auth.register.errorPasswordMismatch')}</span>
              </div>
            )}
          </div>

          <label className="remember-me" style={{ marginTop: '0.1rem' }}>
            <input
              type="checkbox"
              className="custom-checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />
            {t('auth.register.acceptTerms')}
          </label>

          <button
            type="submit"
            className="btn-primary"
            disabled={
              isLoading ||
              usernameStatus === 'checking' ||
              usernameStatus === 'taken' ||
              usernameStatus === 'invalid' ||
              !isPasswordValid ||
              !passwordsMatch
            }
            style={{ marginTop: '0.4rem', padding: '0.85rem' }}
          >
            {isLoading ? <span className="btn-spinner" /> : t('auth.register.button')}
          </button>
        </form>

        <div
          className="auth-footer"
          style={{
            textAlign: 'center',
            fontSize: '0.88rem',
            color: 'var(--text-secondary)',
            marginTop: '1.25rem',
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

