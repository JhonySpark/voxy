import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import heroLogo from '../assets/logo.png';

export default function Register() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms) {
      setError('Você deve aceitar os termos de uso.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await api.post('/auth/register', { email, username, password });
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('voxy_token', res.data.access_token);
      navigate('/app');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.25rem' }}>
          <img src={heroLogo} alt="Voxy Logo" style={{ width: '110px', marginTop: '-1.5rem', marginBottom: '0.25rem', filter: 'drop-shadow(0 0 12px rgba(52, 211, 153, 0.2))' }} />
          <h1 className="auth-title" style={{ marginTop: '-0.25rem' }}>{t('auth.register.title')}</h1>
          <p className="auth-subtitle">{t('auth.register.subtitle')}</p>
        </div>
        
        {error && <div style={{ color: 'var(--danger)', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            <label className="input-label">Nome de Usuário</label>
            <input 
              type="text" 
              className="text-input" 
              placeholder="seu_usuario"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <label className="input-label">Senha</label>
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
          
          <div className="input-group">
            <label className="input-label">Confirmar Senha</label>
            <div className="password-input-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                className="text-input" 
                placeholder="............"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <label className="remember-me">
            <input 
              type="checkbox" 
              className="custom-checkbox" 
              checked={acceptTerms}
              onChange={e => setAcceptTerms(e.target.checked)}
            />
            Li e concordo com os termos de uso
          </label>

          <button type="submit" className="btn-primary" disabled={isLoading} style={{ marginTop: '0.5rem', padding: '0.85rem' }}>
            {isLoading ? <span className="btn-spinner" /> : 'Criar Conta no Voxy'}
          </button>
        </form>
        
        <div className="auth-footer" style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '1.5rem' }}>
          {t('auth.register.hasAccount')} <Link to="/login" style={{ color: 'var(--brand-primary)', fontWeight: 600, textDecoration: 'none' }}>{t('auth.login.button')}</Link>
        </div>
      </div>
    </div>
  );
}
