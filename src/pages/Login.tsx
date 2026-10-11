import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiRoutes, AppRoutes, StorageKeys, IpcChannels } from "../core/enums";
import { getApiErrorMessage } from "../core/utils/error.util";
import heroLogo from "../assets/logo.png";
import { logger } from "../core/services/logger.service";

export default function Login() {
  const { t } = useTranslation();

  const isDev = import.meta.env.DEV;
  const [email, setEmail] = useState(isDev ? "jhonymanson13@hotmail.com" : "");
  const [password, setPassword] = useState(isDev ? "Jhony@123" : "");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Carrega credenciais salvas para reentrada instantânea
  useEffect(() => {
    const loadSavedCredentials = async () => {
      const ipcRenderer =
        typeof window !== "undefined" && window.require
          ? window.require("electron").ipcRenderer
          : null;

      if (ipcRenderer) {
        try {
          const creds = await ipcRenderer.invoke(IpcChannels.GET_SAVED_CREDENTIALS);
          if (creds && (creds.email || creds.password)) {
            if (creds.email) setEmail(creds.email);
            if (creds.password) setPassword(creds.password);
            setRememberMe(creds.rememberMe !== false);
            return;
          }
        } catch (_) {}
      }

      // Fallback para localStorage caso não esteja no Electron ou não haja cofre nativo
      const savedEmail = localStorage.getItem(StorageKeys.SAVED_EMAIL);
      const savedPassword = localStorage.getItem(StorageKeys.SAVED_PASSWORD);
      const savedRemember = localStorage.getItem(StorageKeys.REMEMBER_ME);

      if (savedEmail) setEmail(savedEmail);
      if (savedPassword) setPassword(savedPassword);
      if (savedRemember !== null) {
        setRememberMe(savedRemember === "true");
      }
    };

    loadSavedCredentials();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const res = await api.post(ApiRoutes.AUTH_LOGIN, { email, password });

      if (res.data?.requireEmailVerification) {
        const destEmail = res.data.email || email;
        navigate(
          `${AppRoutes.REGISTER}?verify=${encodeURIComponent(destEmail)}&from=login`,
        );
        return;
      }

      localStorage.setItem(StorageKeys.AUTH_TOKEN, res.data.access_token);

      const ipcRenderer =
        typeof window !== "undefined" && window.require
          ? window.require("electron").ipcRenderer
          : null;

      // Salva ou limpa as credenciais para reentrada com base no "Lembrar de mim"
      if (rememberMe) {
        localStorage.setItem(StorageKeys.REMEMBER_ME, "true");
        localStorage.setItem(StorageKeys.SAVED_EMAIL, email.trim());
        localStorage.setItem(StorageKeys.SAVED_PASSWORD, password);

        if (ipcRenderer) {
          try {
            await ipcRenderer.invoke(IpcChannels.SAVE_CREDENTIALS, {
              email: email.trim(),
              password,
              token: res.data.access_token,
              rememberMe: true,
            });
          } catch (_) {}
        }
      } else {
        localStorage.removeItem(StorageKeys.REMEMBER_ME);
        localStorage.removeItem(StorageKeys.SAVED_EMAIL);
        localStorage.removeItem(StorageKeys.SAVED_PASSWORD);

        if (ipcRenderer) {
          try {
            await ipcRenderer.invoke(IpcChannels.CLEAR_SAVED_CREDENTIALS);
          } catch (_) {}
        }
      }

      if (ipcRenderer) {
        try {
          const ageSignal = await ipcRenderer.invoke(IpcChannels.GET_OS_AGE_SIGNAL);
          const syncRes = await api.post(
            ApiRoutes.AUTH_SYNC_AGE_SIGNAL,
            ageSignal,
            {
              headers: { Authorization: `Bearer ${res.data.access_token}` },
            },
          );

          if (syncRes.data?.user?.ageClassification === "CHILD") {
            localStorage.removeItem(StorageKeys.AUTH_TOKEN);
            if (ipcRenderer) {
              await ipcRenderer.invoke(IpcChannels.CLEAR_SAVED_CREDENTIALS);
            }
            setError(
              "Acesso bloqueado: Esta conta foi classificada pelo sistema operacional como menor de 13 anos (CHILD).",
            );
            return;
          }
        } catch (_) {}
      }

      logger.logEvent('USER_LOGIN_SUCCESS', { email });
      navigate(AppRoutes.APP);
    } catch (err: any) {
      logger.warn('USER_LOGIN_FAILED', { email, error: err?.message });
      setError(getApiErrorMessage(err, t("auth.login.failed")));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "0.25rem",
          }}
        >
          <img
            src={heroLogo}
            alt="Voxy Logo"
            style={{
              width: "110px",
              marginTop: "-1.5rem",
              marginBottom: "0.25rem",
              filter: "drop-shadow(0 0 12px rgba(52, 211, 153, 0.2))",
            }}
          />
          <h1 className="auth-title" style={{ marginTop: "-0.25rem" }}>
            {t("auth.login.title")}
          </h1>
          <p className="auth-subtitle">{t("auth.login.subtitle")}</p>
        </div>

        {error && (
          error.toLowerCase().includes('suspens') ? (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '8px',
                padding: '0.85rem',
                textAlign: 'left',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
              }}
            >
              <ShieldAlert size={22} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#ef4444', fontSize: '0.85rem', display: 'block', marginBottom: '0.2rem' }}>
                  Conta Suspensa
                </strong>
                <p style={{ color: '#fca5a5', fontSize: '0.8rem', lineHeight: 1.4, margin: '0 0 0.35rem 0' }}>
                  {error}
                </p>
                <span style={{ color: '#94a3b8', fontSize: '0.7rem', display: 'block' }}>
                  Em conformidade com as diretrizes da ANPD e ECA. Para contestar ou solicitar revisão, contate o suporte.
                </span>
              </div>
            </div>
          ) : (
            <div
              style={{
                color: "var(--danger)",
                fontSize: "0.9rem",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )
        )}

        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div className="input-group">
            <label className="input-label">{t("auth.login.email")}</label>
            <input
              type="email"
              className="text-input"
              placeholder={t("auth.login.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <div className="input-header">
              <label className="input-label">{t("auth.login.password")}</label>
              <a
                href="#"
                className="forgot-password"
                onClick={(e) => e.preventDefault()}
              >
                {t("auth.login.forgotPassword")}
              </a>
            </div>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                className="text-input"
                placeholder="............"
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
          </div>

          <label className="remember-me">
            <input
              type="checkbox"
              className="custom-checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            {t("auth.login.rememberMe")}
          </label>

          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading}
            style={{ marginTop: "0.5rem", padding: "0.85rem" }}
          >
            {isLoading ? (
              <span className="btn-spinner" />
            ) : (
              t("auth.login.button")
            )}
          </button>
        </form>

        <div
          className="auth-footer"
          style={{
            textAlign: "center",
            fontSize: "0.9rem",
            color: "var(--text-secondary)",
            marginTop: "1.5rem",
          }}
        >
          {t("auth.login.noAccount")}{" "}
          <Link
            to={AppRoutes.REGISTER}
            style={{
              color: "var(--brand-primary)",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t("auth.login.register")}
          </Link>
        </div>
      </div>
    </div>
  );
}
