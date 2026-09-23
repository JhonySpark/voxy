import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import heroLogo from '../assets/logo.png';

export default function Register() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', { email, username, password });
      // After registration, auto-login or redirect to login
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('voxy_token', res.data.access_token);
      navigate('/app');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-panel">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img src={heroLogo} alt="Voxy Logo" style={{ width: '80px', marginBottom: '1rem' }} />
          <h1 className="auth-title">{t('auth.register.title')}</h1>
          <p className="auth-subtitle">{t('auth.register.subtitle')}</p>
        </div>
        
        {error && <div style={{ color: 'var(--danger)', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="input-group">
            <label className="input-label">{t('auth.register.email')}</label>
            <input 
              type="email" 
              className="text-input" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">{t('auth.register.username')}</label>
            <input 
              type="text" 
              className="text-input" 
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <label className="input-label">{t('auth.register.password')}</label>
            <input 
              type="password" 
              className="text-input" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary">
            <UserPlus size={18} />
            {t('auth.register.button')}
          </button>
        </form>
        
        <div className="auth-footer">
          {t('auth.register.hasAccount')} <Link to="/login">{t('auth.login.button')}</Link>
        </div>
      </div>
    </div>
  );
}
