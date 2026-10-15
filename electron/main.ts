import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  Menu,
  Tray,
  dialog,
  nativeImage,
  Notification,
  shell,
  safeStorage,
} from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { autoUpdater } from "electron-updater";
import { getCategorizedSources } from "./gameDetector";
import os from "node:os";

import {
  NATIVE_BINARIES,
  resolveNativeBinary,
  performStartupIntegrityCheck,
} from "./nativeBinaries";
import {
  IpcChannels,
  AutoUpdaterEvents,
  AppUpdateStatus,
} from "../src/core/enums";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Define o nome da aplicação e o Application User Model ID (AUMID) no Windows.
// Deve ser exatamente idêntico ao appId configurado no electron-builder ("br.com.d4rkside.voxy")
// para que a barra de tarefas do Windows e as notificações agrupem corretamente com o atalho e ícone oficial.
app.name = "Voxy";
if (process.platform === "win32") {
  app.setAppUserModelId("br.com.d4rkside.voxy");
}

// Em desenvolvimento, permite abrir uma 2ª instância simultânea com pasta de sessão isolada.
// Isso possibilita testar troca de mensagens e notificações entre 2 usuários diferentes no mesmo PC.
const isDev = !app.isPackaged || process.env.NODE_ENV === "development";

if (isDev) {
  const hasLock = app.requestSingleInstanceLock();
  if (!hasLock) {
    const secondUserData = join(app.getPath("appData"), "voxy-dev-session-2");
    app.setPath("userData", secondUserData);
    app.requestSingleInstanceLock();
  }
} else {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on("second-instance", () => {
      showMainWindow();
    });
  }
}

let nativeStreamProcess: ChildProcess | null = null;

// Eleva a prioridade de agendamento do processo no Windows para que o jogo 3D não congele as threads de captura e WebRTC
try {
  os.setPriority(os.constants.priority.PRIORITY_ABOVE_NORMAL);
} catch (_) {}

// Aceleração por Hardware e Pipeline Nativo de Captura de Jogos (WGC & GPU Direct)
app.commandLine.appendSwitch("force_high_performance_gpu");
app.commandLine.appendSwitch("enable-webrtc-hw-h264-encoding");
app.commandLine.appendSwitch("enable-webrtc-hw-decoding");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
// O streamer nativo já faz WGC -> D3D11 -> NVENC sem cópias pela RAM. Não
// habilite os caminhos experimentais de frames GPU do Chromium: eles deixam
// superfícies de vídeo vivas no renderer e podem crescer indefinidamente em
// transmissões longas. Mantemos apenas o capturador WGC do fallback WebRTC.
app.commandLine.appendSwitch("enable-features", "WebRtcAllowWgcScreenCapturer");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-background-timer-throttling");

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

type BackgroundSettings = { keepRunningInBackground: boolean };

const backgroundSettingsPath = () =>
  join(app.getPath("userData"), "background-settings.json");

function getBackgroundSettings(): BackgroundSettings {
  try {
    const settings = JSON.parse(readFileSync(backgroundSettingsPath(), "utf8"));
    return {
      keepRunningInBackground: settings.keepRunningInBackground !== false,
    };
  } catch {
    return { keepRunningInBackground: true };
  }
}

function saveBackgroundSettings(keepRunningInBackground: boolean) {
  try {
    writeFileSync(
      backgroundSettingsPath(),
      JSON.stringify({ keepRunningInBackground }),
      "utf8",
    );
  } catch (err) {
    console.error("[Background] Falha ao salvar configurações:", err);
  }
  refreshTrayMenu();
}

type StoredCredentials = {
  email?: string;
  password?: string;
  token?: string;
  rememberMe?: boolean;
  savedAt?: string;
};

const credentialsPath = () =>
  join(app.getPath("userData"), "session_vault.enc");

function saveStoredCredentials(data: StoredCredentials): boolean {
  try {
    const raw = JSON.stringify({
      ...data,
      savedAt: new Date().toISOString(),
    });
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(raw);
      writeFileSync(credentialsPath(), encrypted);
    } else {
      writeFileSync(
        credentialsPath(),
        Buffer.from(raw, "utf8").toString("base64"),
        "utf8",
      );
    }
    return true;
  } catch (err) {
    console.error("[Credentials] Falha ao salvar cofre de credenciais:", err);
    return false;
  }
}

function getStoredCredentials(): StoredCredentials | null {
  try {
    const p = credentialsPath();
    if (!existsSync(p)) return null;

    if (safeStorage.isEncryptionAvailable()) {
      const buffer = readFileSync(p);
      const decrypted = safeStorage.decryptString(buffer);
      return JSON.parse(decrypted);
    } else {
      const content = readFileSync(p, "utf8");
      const decrypted = Buffer.from(content, "base64").toString("utf8");
      return JSON.parse(decrypted);
    }
  } catch (err) {
    console.warn("[Credentials] Falha ao ler cofre de credenciais:", err);
    return null;
  }
}

function clearStoredCredentials(): boolean {
  try {
    const p = credentialsPath();
    if (existsSync(p)) {
      unlinkSync(p);
    }
    return true;
  } catch (err) {
    console.error("[Credentials] Falha ao limpar cofre de credenciais:", err);
    return false;
  }
}

function showMainWindow() {
  if (!win) {
    void createWindow();
    return;
  }
  if (win.isMinimized()) win.restore();
  win.show();
  win.maximize();
  win.focus();
}

function refreshTrayMenu() {
  if (!tray) return;
  const settings = getBackgroundSettings();
  const menuItems: any[] = [{ label: "Abrir Voxy", click: showMainWindow }];

  if (isDev) {
    menuItems.push({
      label: "Abrir 2ª Instância (Dev)",
      click: () => {
        spawn(process.execPath, process.argv.slice(1), {
          detached: true,
          stdio: "ignore",
        }).unref();
      },
    });
  }

  menuItems.push(
    {
      label: "Manter o Voxy em segundo plano",
      type: "checkbox",
      checked: settings.keepRunningInBackground,
      click: (item: any) => saveBackgroundSettings(item.checked),
    },
    { type: "separator" },
    {
      label: "Sair do Voxy",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  );

  tray.setContextMenu(Menu.buildFromTemplate(menuItems));
}

function getAppIcon(): nativeImage {
  const candidates = [
    join(process.resourcesPath, "app.asar.unpacked/build/icon.ico"),
    join(app.getAppPath(), "build/icon.ico"),
    join(__dirname, "../build/icon.ico"),
    join(process.cwd(), "build/icon.ico"),
    join(process.resourcesPath, "app.asar.unpacked/build/icon_resized.png"),
    join(process.resourcesPath, "app.asar.unpacked/build/icon.png"),
    join(app.getAppPath(), "build/icon_resized.png"),
    join(app.getAppPath(), "build/icon.png"),
    join(__dirname, "../build/icon.png"),
    join(process.cwd(), "build/icon.png"),
  ];

  for (const p of candidates) {
    if (existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) return img;
    }
  }
  return nativeImage.createFromPath(join(app.getAppPath(), "build/icon.ico"));
}

function getTrayIcon(): nativeImage {
  return getAppIcon();
}

function getVoxyLogoIcon(): nativeImage {
  return getAppIcon();
}

async function resolveNotificationIcon(iconUrl?: string): Promise<nativeImage> {
  if (iconUrl) {
    try {
      if (iconUrl.startsWith("data:")) {
        const img = nativeImage.createFromDataURL(iconUrl);
        if (!img.isEmpty()) return img;
      } else if (
        iconUrl.startsWith("http://") ||
        iconUrl.startsWith("https://")
      ) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const response = await fetch(iconUrl, { signal: controller.signal });
        clearTimeout(timer);
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const img = nativeImage.createFromBuffer(buffer);
          if (!img.isEmpty()) return img;
        }
      } else if (existsSync(iconUrl)) {
        const img = nativeImage.createFromPath(iconUrl);
        if (!img.isEmpty()) return img;
      }
    } catch (err) {
      console.warn(
        "[Notification] Falha ao carregar ícone customizado da notificação:",
        err,
      );
    }
  }

  // Fallback padrão: Logo oficial do Voxy
  return getVoxyLogoIcon();
}

function createTray() {
  if (tray) return;
  try {
    const icon = getTrayIcon();
    tray = new Tray(icon);
    tray.setToolTip("Voxy");
    tray.on("click", showMainWindow);
    tray.on("double-click", showMainWindow);
    refreshTrayMenu();
  } catch (err) {
    console.error("[Tray] Falha ao criar ícone da bandeja:", err);
  }
}

async function createWindow() {
  const icon = getAppIcon();

  win = new BrowserWindow({
    title: "Voxy",
    icon: !icon.isEmpty() ? icon : undefined,
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  });
  if (!icon.isEmpty()) {
    win.setIcon(icon);
  }
  win.removeMenu();
  win.maximize();

  win.on("close", (event) => {
    if (!isQuitting && getBackgroundSettings().keepRunningInBackground) {
      event.preventDefault();
      win?.hide();
    }
  });

  // Intercepta qualquer tentativa de abrir novas janelas ou links externos
  // garantindo que abram sempre no navegador padrão do Sistema Operacional
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("mailto:")
    ) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    const isDevUrl =
      process.env.VITE_DEV_SERVER_URL &&
      url.startsWith(process.env.VITE_DEV_SERVER_URL);
    if (
      !isDevUrl &&
      (url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("mailto:"))
    ) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  // 1. Startup Integrity Guard: Verifica presenca e SHA-256 dos binarios essenciais no Windows
  if (process.platform === "win32") {
    const integrity = performStartupIntegrityCheck();
    if (!integrity.valid) {
      console.error(
        "[Startup Guard] Integridade do sistema violada:",
        integrity.errors,
      );
      dialog.showErrorBox(
        "Falha de Integridade do Sistema - Voxy",
        `Arquivos essenciais do aplicativo foram alterados ou estao ausentes:\n\n` +
          integrity.errors.map((e) => `• ${e}`).join("\n") +
          `\n\nPor questoes de seguranca, reinstale o aplicativo para continuar.`,
      );
      app.quit();
      return;
    }
  }

  createTray();

  ipcMain.handle(
    IpcChannels.GET_BACKGROUND_MODE,
    () => getBackgroundSettings().keepRunningInBackground,
  );
  ipcMain.on(IpcChannels.SET_BACKGROUND_MODE, (_event, enabled: boolean) => {
    saveBackgroundSettings(enabled === true);
  });

  // IPC para cofre seguro de credenciais e persistência de sessão nativa
  ipcMain.handle(
    IpcChannels.SAVE_CREDENTIALS,
    (_event, creds: StoredCredentials) => {
      return saveStoredCredentials(creds);
    },
  );
  ipcMain.handle(IpcChannels.GET_SAVED_CREDENTIALS, () => {
    return getStoredCredentials();
  });
  ipcMain.handle(IpcChannels.CLEAR_SAVED_CREDENTIALS, () => {
    return clearStoredCredentials();
  });

  // Retorna fontes categorizadas (Jogos detectados, Janelas/Apps e Telas com ícones)
  ipcMain.handle(
    IpcChannels.DESKTOP_CAPTURER_GET_CATEGORIZED_SOURCES,
    async () => {
      return await getCategorizedSources();
    },
  );

  ipcMain.handle(
    IpcChannels.DESKTOP_CAPTURER_GET_SOURCES,
    async (event, opts) => {
      const sources = await desktopCapturer.getSources(opts);
      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
        appIcon: source.appIcon ? source.appIcon.toDataURL() : null,
      }));
    },
  );

  createWindow();

  // IPC para Notificações Desktop Nativas do Sistema Operacional
  ipcMain.handle(
    IpcChannels.SHOW_DESKTOP_NOTIFICATION,
    async (_event, opts: { title: string; body: string; iconUrl?: string }) => {
      if (!Notification.isSupported()) return false;
      try {
        const icon = await resolveNotificationIcon(opts?.iconUrl);
        const notif = new Notification({
          title: opts?.title || "Voxy",
          body: opts?.body || "",
          icon: !icon.isEmpty() ? icon : undefined,
          silent: true, // O som é gerenciado pelo sound.service para controle de throttle e canais de voz
        });
        notif.on("click", () => {
          showMainWindow();
        });
        notif.show();
        return true;
      } catch (err) {
        console.error("[Notification] Falha ao exibir notificação:", err);
        return false;
      }
    },
  );

  ipcMain.handle(IpcChannels.FLASH_FRAME, (_event, flag: boolean) => {
    if (win && !win.isFocused()) {
      win.flashFrame(flag !== false);
    }
  });

  // IPC para abertura segura de links externos no navegador padrão do OS
  ipcMain.handle(IpcChannels.OPEN_EXTERNAL_URL, async (_event, url: string) => {
    if (
      typeof url === "string" &&
      (url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("mailto:"))
    ) {
      await shell.openExternal(url);
      return true;
    }
    return false;
  });

  // IPC para o Pipeline Nativo C++
  ipcMain.handle(IpcChannels.IS_NATIVE_STREAM_SUPPORTED, () => {
    return (
      process.platform === "win32" &&
      !!resolveNativeBinary(NATIVE_BINARIES.NATIVE_STREAMER)
    );
  });

  // IPC para verificação de Faixa Etária Nativa (Windows 11 Age Signals / WinRT com Assinatura Criptográfica HMAC)
  ipcMain.handle(IpcChannels.GET_OS_AGE_SIGNAL, async () => {
    if (process.platform !== "win32") {
      return { available: false, reason: "Unsupported_Platform" };
    }
    const binPath = resolveNativeBinary(NATIVE_BINARIES.AGE_SIGNAL);
    if (!binPath) {
      console.warn(
        "[AgeSignal] Sonda nativa (vx_rt_b18e.exe) não localizada nos caminhos padrão.",
      );
      return { available: false, reason: "Probe_Not_Found" };
    }

    const nonce = randomBytes(16).toString("hex");
    const timestamp = Date.now();

    return new Promise((resolve) => {
      let settled = false;
      const child = spawn(binPath, [nonce, String(timestamp)], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d) => {
        stdout += d.toString();
      });
      child.stderr?.on("data", (d) => {
        stderr += d.toString();
      });

      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        if (code === 0 && stdout.trim()) {
          try {
            const data = JSON.parse(stdout.trim());
            return resolve(data);
          } catch (parseErr) {
            console.error(
              "[AgeSignal] Erro ao parsear JSON de saída da sonda:",
              parseErr,
              stdout,
            );
          }
        }
        console.warn(
          `[AgeSignal] Sonda encerrou com código ${code}. stderr=${stderr.trim()}, stdout=${stdout.trim()}`,
        );

        resolve({
          available: false,
          reason: "Execution_Failed",
          code,
          stderr: stderr.trim(),
        });
      });

      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        console.error(
          "[AgeSignal] Erro ao executar processo da sonda nativa:",
          err,
        );
        resolve({
          available: false,
          reason: "Process_Error",
          error: err.message,
        });
      });

      setTimeout(() => {
        if (settled) return;
        settled = true;
        try {
          child.kill();
        } catch (_) {}
        console.warn(
          "[AgeSignal] Timeout de 8s excedido ao executar sonda nativa.",
        );
        resolve({ available: false, reason: "Timeout" });
      }, 8000);
    });
  });

  ipcMain.handle(
    IpcChannels.START_NATIVE_STREAM,
    async (
      _event,
      opts: {
        url: string;
        token: string;
        hwnd: string | number;
        width?: number;
        height?: number;
        fps?: number;
        bitrate?: number;
        captureProcessAudio?: boolean;
        thumbnail?: string;
      },
    ) => {
      const binPath = resolveNativeBinary(NATIVE_BINARIES.NATIVE_STREAMER);
      if (!binPath) {
        throw new Error("Streaming component not found");
      }

      if (nativeStreamProcess) {
        try {
          nativeStreamProcess.stdin?.write("stop\n");
          nativeStreamProcess.kill();
        } catch (_) {}
        nativeStreamProcess = null;
      }

      const args = [
        "--url",
        opts.url,
        "--token",
        opts.token,
        "--hwnd",
        String(opts.hwnd),
        "--width",
        String(opts.width || 1920),
        "--height",
        String(opts.height || 1080),
        "--fps",
        String(opts.fps || 60),
        "--bitrate",
        String(opts.bitrate || 8000000),
      ];
      if (opts.thumbnail) args.push("--thumbnail", opts.thumbnail);
      if (opts.captureProcessAudio) args.push("--capture-process-audio");

      console.log(
        "[NativeStream] Disparando streamer nativo C++:",
        binPath,
        args.join(" "),
      );

      const child = spawn(binPath, args, {
        cwd: dirname(binPath),
        stdio: ["pipe", "pipe", "pipe"],
      });

      nativeStreamProcess = child;

      child.stdout?.on("data", (chunk) => {
        const text = chunk.toString();
        console.log("[NativeStream STDOUT]", text.trim());
        win?.webContents.send(IpcChannels.NATIVE_STREAM_LOG, {
          type: "stdout",
          text: text.trim(),
        });
        const match = text.match(/\[VOXY_TELEMETRY\]\s*(\{.*\})/);
        if (match) {
          try {
            const telemetry = JSON.parse(match[1]);
            win?.webContents.send(
              IpcChannels.NATIVE_STREAM_TELEMETRY,
              telemetry,
            );
          } catch (_) {}
        }
      });

      child.stderr?.on("data", (chunk) => {
        const text = chunk.toString().trim();
        console.error("[NativeStream STDERR]", text);
        win?.webContents.send(IpcChannels.NATIVE_STREAM_LOG, {
          type: "stderr",
          text,
        });
      });

      child.on("exit", (code, signal) => {
        console.log(
          `[NativeStream] Processo encerrou (code: ${code}, signal: ${signal})`,
        );
        win?.webContents.send(IpcChannels.NATIVE_STREAM_LOG, {
          type: "exit",
          text: `Processo encerrou (code: ${code}, signal: ${signal})`,
        });
        if (nativeStreamProcess === child) {
          nativeStreamProcess = null;
          win?.webContents.send(IpcChannels.NATIVE_STREAM_STOPPED, {
            code,
            signal,
          });
        }
      });

      return { success: true };
    },
  );

  ipcMain.handle(IpcChannels.STOP_NATIVE_STREAM, async () => {
    if (!nativeStreamProcess) return { success: true };
    try {
      nativeStreamProcess.stdin?.write("stop\n");
      setTimeout(() => {
        if (nativeStreamProcess) {
          nativeStreamProcess.kill();
          nativeStreamProcess = null;
        }
      }, 1500);
    } catch (_) {}
    return { success: true };
  });

  // Estado em memória da atualização atual
  type UpdateStatePayload = {
    status: AppUpdateStatus;
    version?: string;
    releaseDate?: string;
    progress?: {
      percent: number;
      transferred: number;
      total: number;
      bytesPerSecond: number;
    };
    error?: string;
  };

  let currentUpdateState: UpdateStatePayload = { status: AppUpdateStatus.IDLE };

  // IPC para checagem e instalação de atualizações
  ipcMain.handle(IpcChannels.GET_UPDATE_STATUS, () => {
    return currentUpdateState;
  });

  const isWindowsStore = Boolean(process.windowsStore);

  ipcMain.handle(IpcChannels.CHECK_FOR_UPDATES, async () => {
    if (process.env.VITE_DEV_SERVER_URL) {
      return {
        status: "dev",
        message: "Auto-update desativado em modo de desenvolvimento",
      };
    }
    if (isWindowsStore) {
      return {
        status: "windows_store",
      };
    }
    try {
      const res = await autoUpdater.checkForUpdates();
      return { status: "ok", updateInfo: res?.updateInfo };
    } catch (err: any) {
      return {
        status: "error",
        message: err?.message || "Erro ao verificar atualizações",
      };
    }
  });

  ipcMain.handle(IpcChannels.RESTART_AND_INSTALL, () => {
    if (!isWindowsStore) {
      autoUpdater.quitAndInstall();
    }
  });

  // Autoupdate (somente em produção fora da Microsoft Store)
  if (!process.env.VITE_DEV_SERVER_URL && !isWindowsStore) {
    autoUpdater.logger = console;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on(AutoUpdaterEvents.CHECKING_FOR_UPDATE, () => {
      console.log("[AutoUpdater] Verificando atualizações...");
      currentUpdateState = { status: AppUpdateStatus.CHECKING };
      win?.webContents.send(IpcChannels.APP_UPDATE_CHECKING);
    });

    autoUpdater.on(AutoUpdaterEvents.UPDATE_AVAILABLE, (info) => {
      console.log(`[AutoUpdater] Nova versão encontrada: ${info.version}`);
      currentUpdateState = {
        status: AppUpdateStatus.AVAILABLE,
        version: info.version,
        releaseDate: info.releaseDate,
      };
      win?.webContents.send(IpcChannels.APP_UPDATE_AVAILABLE, {
        version: info.version,
        releaseDate: info.releaseDate,
      });
    });

    autoUpdater.on(AutoUpdaterEvents.UPDATE_NOT_AVAILABLE, (info) => {
      console.log(
        `[AutoUpdater] Nenhuma atualização disponível. Versão atual: ${info.version}`,
      );
      currentUpdateState = {
        status: AppUpdateStatus.IDLE,
        version: info.version,
      };
      win?.webContents.send(IpcChannels.APP_UPDATE_NOT_AVAILABLE, {
        version: info.version,
      });
    });

    autoUpdater.on(AutoUpdaterEvents.DOWNLOAD_PROGRESS, (progressObj) => {
      const progress = {
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond,
      };
      currentUpdateState = {
        status: AppUpdateStatus.DOWNLOADING,
        version: currentUpdateState.version,
        progress,
      };
      win?.webContents.send(IpcChannels.APP_UPDATE_PROGRESS, progress);
    });

    autoUpdater.on(AutoUpdaterEvents.UPDATE_DOWNLOADED, (info) => {
      console.log(
        `[AutoUpdater] Versão ${info.version} baixada e pronta para instalação.`,
      );
      currentUpdateState = {
        status: AppUpdateStatus.DOWNLOADED,
        version: info.version,
      };
      win?.webContents.send(IpcChannels.APP_UPDATE_DOWNLOADED, {
        version: info.version,
      });
    });

    autoUpdater.on(AutoUpdaterEvents.ERROR, (err) => {
      console.error(
        "[AutoUpdater] Erro ao verificar ou baixar atualização:",
        err,
      );
      currentUpdateState = {
        status: AppUpdateStatus.ERROR,
        error: err.message,
      };
      win?.webContents.send(IpcChannels.APP_UPDATE_ERROR, {
        message: err.message,
      });
    });

    const triggerUpdateCheck = () => {
      console.log("[AutoUpdater] Disparando verificação de atualizações...");
      autoUpdater.checkForUpdates().catch((err) => {
        console.error("[AutoUpdater] Erro no checkForUpdates:", err);
      });
    };

    const runStartupUpdateCheck = () => {
      // Delay de 3s para garantir que o renderer carregou o React e montou os listeners
      setTimeout(() => {
        triggerUpdateCheck();
      }, 3000);
    };

    if (win) {
      if (win.webContents.isLoading()) {
        win.webContents.once("did-finish-load", runStartupUpdateCheck);
      } else {
        runStartupUpdateCheck();
      }
    }

    // Checagem periódica a cada 2 horas em segundo plano
    setInterval(
      () => {
        triggerUpdateCheck();
      },
      2 * 60 * 60 * 1000,
    );
  }
});

app.on("window-all-closed", () => {
  win = null;
  if (
    process.platform !== "darwin" &&
    !getBackgroundSettings().keepRunningInBackground
  )
    app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});
