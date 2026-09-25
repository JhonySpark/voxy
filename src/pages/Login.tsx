import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import heroLogo from '../assets/logo.png';

export default function Login() {
  const { t } = useTranslation();
  
  const isDev = import.meta.env.DEV;
  const [email, setEmail] = useState(isDev ? 'jhonyspark@gmail.com' : '');
  const [password, setPassword] = useState(isDev ? 'Jhony@123' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('voxy_token', res.data.access_token);
      navigate('/app');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.25rem' }}>
          <img src={heroLogo} alt="Voxy Logo" style={{ width: '110px', marginTop: '-1.5rem', marginBottom: '0.25rem', filter: 'drop-shadow(0 0 12px rgba(52, 211, 153, 0.2))' }} />
          <h1 className="auth-title" style={{ marginTop: '-0.25rem' }}>{t('auth.login.title')}</h1>
          <p className="auth-subtitle">{t('auth.login.subtitle')}</p>
        </div>
        
        {error && <div style={{ color: 'var(--danger)', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="input-group">
            <label className="input-label">E-mail</label>
            <input 
              type="email" 
              className="text-input" 
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <div className="input-header">
              <label className="input-label">Senha</label>
              <a href="#" className="forgot-password" onClick={(e) => e.preventDefault()}>Esqueceu a senha?</a>
            </div>
            <div className="password-input-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                className="text-input" 
                placeholder="............"
                value={password}
                onChange={e => setPassword(e.target.value)}
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
          </div>

          <label className="remember-me">
            <input 
              type="checkbox" 
              className="custom-checkbox" 
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
            />
            Lembrar-me neste dispositivo
          </label>

          <button type="submit" className="btn-primary" disabled={isLoading} style={{ marginTop: '0.5rem', padding: '0.85rem' }}>
            {isLoading ? <span className="btn-spinner" /> : 'Entrar no Voxy'}
          </button>
        </form>
        
        <div className="auth-footer" style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '1.5rem' }}>
          {t('auth.login.noAccount')} <Link to="/register" style={{ color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none' }}>{t('auth.login.register')}</Link>
        </div>
      </div>
    </div>
  );
}
