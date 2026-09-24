import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import heroLogo from '../assets/logo.png';

export default function Login() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      <div className="auth-card glass-panel">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img src={heroLogo} alt="Voxy Logo" style={{ width: '80px', marginBottom: '1rem' }} />
          <h1 className="auth-title">{t('auth.login.title')}</h1>
          <p className="auth-subtitle">{t('auth.login.subtitle')}</p>
        </div>
        
        {error && <div style={{ color: 'var(--danger)', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="input-group">
            <label className="input-label">{t('auth.login.email')}</label>
            <input 
              type="email" 
              className="text-input" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <label className="input-label">{t('auth.login.password')}</label>
            <input 
              type="password" 
              className="text-input" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? <span className="btn-spinner" /> : <LogIn size={18} />}
            {isLoading ? (i18n.language === 'pt' ? 'Entrando...' : 'Logging in...') : t('auth.login.button')}
          </button>
        </form>
        
        <div className="auth-footer">
          {t('auth.login.noAccount')} <Link to="/register">{t('auth.login.register')}</Link>
        </div>
      </div>
    </div>
  );
}
