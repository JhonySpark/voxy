import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiRoutes, AppRoutes, StorageKeys, IpcChannels } from "../core/enums";
import { getApiErrorMessage } from "../core/utils/error.util";
import heroLogo from "../assets/logo.png";
import { logger } from "../core/services/logger.service";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import styles from "./Login.module.css";

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
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <img src={heroLogo} alt="Voxy Logo" className={styles.logo} />
          <h1 className={styles.title}>{t("auth.login.title")}</h1>
          <p className={styles.subtitle}>{t("auth.login.subtitle")}</p>
        </div>

        {error &&
          (error.toLowerCase().includes("suspens") ? (
            <div className={styles.suspendedAlert}>
              <ShieldAlert size={22} className={styles.suspendedIcon} />
              <div>
                <strong className={styles.suspendedTitle}>Conta Suspensa</strong>
                <p className={styles.suspendedDesc}>{error}</p>
                <span className={styles.suspendedFootnote}>
                  Em conformidade com as diretrizes da ANPD e ECA. Para contestar ou solicitar revisão, contate o suporte.
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.errorText}>{error}</div>
          ))}

        <form onSubmit={handleLogin} className={styles.form}>
          <Input
            type="email"
            label={t("auth.login.email")}
            placeholder={t("auth.login.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            fullWidth
          />

          <div>
            <div className={styles.passwordHeader}>
              <label className={styles.passwordLabel}>
                {t("auth.login.password")}
              </label>
              <a
                href="#"
                className={styles.forgotPassword}
                onClick={(e) => e.preventDefault()}
              >
                {t("auth.login.forgotPassword")}
              </a>
            </div>
            <div className={styles.passwordWrapper}>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="............"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                fullWidth
                rightIcon={
                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
            </div>
          </div>

          <label className={styles.rememberMe}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            {t("auth.login.rememberMe")}
          </label>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            fullWidth
            className={styles.submitBtn}
          >
            {t("auth.login.button")}
          </Button>
        </form>

        <div className={styles.footer}>
          {t("auth.login.noAccount")}{" "}
          <Link to={AppRoutes.REGISTER} className={styles.registerLink}>
            {t("auth.login.register")}
          </Link>
        </div>
      </div>
    </div>
  );
}
