import { app, BrowserWindow, ipcMain, desktopCapturer, Menu, Tray, dialog } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { autoUpdater } from 'electron-updater'
import { getCategorizedSources } from './gameDetector'
import os from 'node:os'

import { NATIVE_BINARIES, resolveNativeBinary, performStartupIntegrityCheck } from './nativeBinaries'
import { IpcChannels, AutoUpdaterEvents, AppUpdateStatus } from '../src/core/enums'

const __dirname = dirname(fileURLToPath(import.meta.url))

let nativeStreamProcess: ChildProcess | null = null

// Eleva a prioridade de agendamento do processo no Windows para que o jogo 3D não congele as threads de captura e WebRTC
try {
  os.setPriority(os.constants.priority.PRIORITY_ABOVE_NORMAL);
} catch (_) {}

// Aceleração por Hardware e Pipeline Nativo de Captura de Jogos (WGC & GPU Direct)
app.commandLine.appendSwitch('force_high_performance_gpu')
app.commandLine.appendSwitch('enable-webrtc-hw-h264-encoding')
app.commandLine.appendSwitch('enable-webrtc-hw-decoding')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
// O streamer nativo já faz WGC -> D3D11 -> NVENC sem cópias pela RAM. Não
// habilite os caminhos experimentais de frames GPU do Chromium: eles deixam
// superfícies de vídeo vivas no renderer e podem crescer indefinidamente em
// transmissões longas. Mantemos apenas o capturador WGC do fallback WebRTC.
app.commandLine.appendSwitch('enable-features', 'WebRtcAllowWgcScreenCapturer')
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-background-timer-throttling')

let win: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

type BackgroundSettings = { keepRunningInBackground: boolean }

const backgroundSettingsPath = () => join(app.getPath('userData'), 'background-settings.json')

function getBackgroundSettings(): BackgroundSettings {
  try {
    const settings = JSON.parse(readFileSync(backgroundSettingsPath(), 'utf8'))
    return { keepRunningInBackground: settings.keepRunningInBackground === true }
  } catch {
    return { keepRunningInBackground: false }
  }
}

function saveBackgroundSettings(keepRunningInBackground: boolean) {
  writeFileSync(backgroundSettingsPath(), JSON.stringify({ keepRunningInBackground }), 'utf8')
  refreshTrayMenu()
}

function showMainWindow() {
  if (!win) {
    void createWindow()
    return
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function refreshTrayMenu() {
  if (!tray) return
  const settings = getBackgroundSettings()
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Voxy', click: showMainWindow },
    {
      label: 'Manter o Voxy em segundo plano',
      type: 'checkbox',
      checked: settings.keepRunningInBackground,
      click: (item) => saveBackgroundSettings(item.checked),
    },
    { type: 'separator' },
    {
      label: 'Sair do Voxy',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ]))
}

function createTray() {
  if (tray) return
  const iconPath = process.env.VITE_DEV_SERVER_URL
    ? join(process.cwd(), 'build/icon.ico')
    : join(process.resourcesPath, 'app.asar.unpacked/build/icon.ico')
  tray = new Tray(existsSync(iconPath) ? iconPath : join(app.getAppPath(), 'build/icon.ico'))
  tray.setToolTip('Voxy')
  tray.on('click', showMainWindow)
  refreshTrayMenu()
}

async function createWindow() {
  win = new BrowserWindow({
    title: 'Voxy',
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
  })
  win.removeMenu()

  win.on('close', (event) => {
    if (!isQuitting && getBackgroundSettings().keepRunningInBackground) {
      event.preventDefault()
      win?.hide()
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  // 1. Startup Integrity Guard: Verifica presenca e SHA-256 dos binarios essenciais no Windows
  if (process.platform === 'win32') {
    const integrity = performStartupIntegrityCheck();
    if (!integrity.valid) {
      console.error('[Startup Guard] Integridade do sistema violada:', integrity.errors);
      dialog.showErrorBox(
        'Falha de Integridade do Sistema - Voxy',
        `Arquivos essenciais do aplicativo foram alterados ou estao ausentes:\n\n` +
        integrity.errors.map(e => `• ${e}`).join('\n') +
        `\n\nPor questoes de seguranca, reinstale o aplicativo para continuar.`
      );
      app.quit();
      return;
    }
  }

  createTray()

  ipcMain.handle(IpcChannels.GET_BACKGROUND_MODE, () => getBackgroundSettings().keepRunningInBackground)
  ipcMain.on(IpcChannels.SET_BACKGROUND_MODE, (_event, enabled: boolean) => {
    saveBackgroundSettings(enabled === true)
  })

  // Retorna fontes categorizadas (Jogos detectados, Janelas/Apps e Telas com ícones)
  ipcMain.handle(IpcChannels.DESKTOP_CAPTURER_GET_CATEGORIZED_SOURCES, async () => {
    return await getCategorizedSources();
  });

  ipcMain.handle(IpcChannels.DESKTOP_CAPTURER_GET_SOURCES, async (event, opts) => {
    const sources = await desktopCapturer.getSources(opts);
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }));
  });

  createWindow();

  // IPC para o Pipeline Nativo C++
  ipcMain.handle(IpcChannels.IS_NATIVE_STREAM_SUPPORTED, () => {
    return process.platform === 'win32' && !!resolveNativeBinary(NATIVE_BINARIES.NATIVE_STREAMER);
  });

  // IPC para verificação de Faixa Etária Nativa (Windows 11 Age Signals / WinRT com Assinatura Criptográfica HMAC)
  ipcMain.handle(IpcChannels.GET_OS_AGE_SIGNAL, async () => {
    if (process.platform !== 'win32') {
      return { available: false, reason: 'Unsupported_Platform' };
    }
    const binPath = resolveNativeBinary(NATIVE_BINARIES.AGE_SIGNAL);
    if (!binPath) {
      return { available: false, reason: 'Probe_Not_Found' };
    }

    const nonce = randomBytes(16).toString('hex');
    const timestamp = Date.now();

    return new Promise((resolve) => {
      const child = spawn(binPath, [nonce, String(timestamp)], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
      });

      let stdout = '';
      child.stdout?.on('data', (d) => { stdout += d.toString(); });
      child.on('close', (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            const data = JSON.parse(stdout.trim());
            return resolve(data);
          } catch (_) {}
        }
        resolve({ available: false, reason: 'Execution_Failed' });
      });
      child.on('error', () => {
        resolve({ available: false, reason: 'Process_Error' });
      });

      setTimeout(() => {
        try { child.kill(); } catch (_) {}
        resolve({ available: false, reason: 'Timeout' });
      }, 4000);
    });
  });

  ipcMain.handle(IpcChannels.START_NATIVE_STREAM, async (_event, opts: {
    url: string;
    token: string;
    hwnd: string | number;
    width?: number;
    height?: number;
    fps?: number;
    bitrate?: number;
    captureProcessAudio?: boolean;
    thumbnail?: string;
  }) => {
    const binPath = resolveNativeBinary(NATIVE_BINARIES.NATIVE_STREAMER);
    if (!binPath) {
      throw new Error('Streaming component not found');
    }

    if (nativeStreamProcess) {
      try {
        nativeStreamProcess.stdin?.write('stop\n');
        nativeStreamProcess.kill();
      } catch (_) {}
      nativeStreamProcess = null;
    }

    const args = [
      '--url', opts.url,
      '--token', opts.token,
      '--hwnd', String(opts.hwnd),
      '--width', String(opts.width || 1920),
      '--height', String(opts.height || 1080),
      '--fps', String(opts.fps || 60),
      '--bitrate', String(opts.bitrate || 8000000),
    ];
    if (opts.thumbnail) args.push('--thumbnail', opts.thumbnail);
    if (opts.captureProcessAudio) args.push('--capture-process-audio');

    console.log('[NativeStream] Disparando streamer nativo C++:', binPath, args.join(' '));

    const child = spawn(binPath, args, {
      cwd: dirname(binPath),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    nativeStreamProcess = child;

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      console.log('[NativeStream STDOUT]', text.trim());
      win?.webContents.send(IpcChannels.NATIVE_STREAM_LOG, { type: 'stdout', text: text.trim() });
      const match = text.match(/\[VOXY_TELEMETRY\]\s*(\{.*\})/);
      if (match) {
        try {
          const telemetry = JSON.parse(match[1]);
          win?.webContents.send(IpcChannels.NATIVE_STREAM_TELEMETRY, telemetry);
        } catch (_) {}
      }
    });

    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString().trim();
      console.error('[NativeStream STDERR]', text);
      win?.webContents.send(IpcChannels.NATIVE_STREAM_LOG, { type: 'stderr', text });
    });

    child.on('exit', (code, signal) => {
      console.log(`[NativeStream] Processo encerrou (code: ${code}, signal: ${signal})`);
      win?.webContents.send(IpcChannels.NATIVE_STREAM_LOG, { type: 'exit', text: `Processo encerrou (code: ${code}, signal: ${signal})` });
      if (nativeStreamProcess === child) {
        nativeStreamProcess = null;
        win?.webContents.send(IpcChannels.NATIVE_STREAM_STOPPED, { code, signal });
      }
    });

    return { success: true };
  });

  ipcMain.handle(IpcChannels.STOP_NATIVE_STREAM, async () => {
    if (!nativeStreamProcess) return { success: true };
    try {
      nativeStreamProcess.stdin?.write('stop\n');
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

  ipcMain.handle(IpcChannels.CHECK_FOR_UPDATES, async () => {
    if (process.env.VITE_DEV_SERVER_URL) {
      return { status: 'dev', message: 'Auto-update desativado em modo de desenvolvimento' }
    }
    try {
      const res = await autoUpdater.checkForUpdates()
      return { status: 'ok', updateInfo: res?.updateInfo }
    } catch (err: any) {
      return { status: 'error', message: err?.message || 'Erro ao verificar atualizações' }
    }
  })

  ipcMain.handle(IpcChannels.RESTART_AND_INSTALL, () => {
    autoUpdater.quitAndInstall()
  })

  // Autoupdate (somente em produção)
  if (!process.env.VITE_DEV_SERVER_URL) {
    autoUpdater.logger = console
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on(AutoUpdaterEvents.CHECKING_FOR_UPDATE, () => {
      console.log('[AutoUpdater] Verificando atualizações...')
      currentUpdateState = { status: AppUpdateStatus.CHECKING }
      win?.webContents.send(IpcChannels.APP_UPDATE_CHECKING)
    })

    autoUpdater.on(AutoUpdaterEvents.UPDATE_AVAILABLE, (info) => {
      console.log(`[AutoUpdater] Nova versão encontrada: ${info.version}`)
      currentUpdateState = {
        status: AppUpdateStatus.AVAILABLE,
        version: info.version,
        releaseDate: info.releaseDate
      }
      win?.webContents.send(IpcChannels.APP_UPDATE_AVAILABLE, {
        version: info.version,
        releaseDate: info.releaseDate
      })
    })

    autoUpdater.on(AutoUpdaterEvents.UPDATE_NOT_AVAILABLE, (info) => {
      console.log(`[AutoUpdater] Nenhuma atualização disponível. Versão atual: ${info.version}`)
      currentUpdateState = {
        status: AppUpdateStatus.IDLE,
        version: info.version
      }
      win?.webContents.send(IpcChannels.APP_UPDATE_NOT_AVAILABLE, {
        version: info.version
      })
    })

    autoUpdater.on(AutoUpdaterEvents.DOWNLOAD_PROGRESS, (progressObj) => {
      const progress = {
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond
      }
      currentUpdateState = {
        status: AppUpdateStatus.DOWNLOADING,
        version: currentUpdateState.version,
        progress
      }
      win?.webContents.send(IpcChannels.APP_UPDATE_PROGRESS, progress)
    })

    autoUpdater.on(AutoUpdaterEvents.UPDATE_DOWNLOADED, (info) => {
      console.log(`[AutoUpdater] Versão ${info.version} baixada e pronta para instalação.`)
      currentUpdateState = {
        status: AppUpdateStatus.DOWNLOADED,
        version: info.version
      }
      win?.webContents.send(IpcChannels.APP_UPDATE_DOWNLOADED, {
        version: info.version
      })
    })

    autoUpdater.on(AutoUpdaterEvents.ERROR, (err) => {
      console.error('[AutoUpdater] Erro ao verificar ou baixar atualização:', err)
      currentUpdateState = {
        status: AppUpdateStatus.ERROR,
        error: err.message
      }
      win?.webContents.send(IpcChannels.APP_UPDATE_ERROR, {
        message: err.message
      })
    })

    const triggerUpdateCheck = () => {
      console.log('[AutoUpdater] Disparando verificação de atualizações...')
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('[AutoUpdater] Erro no checkForUpdates:', err)
      })
    }

    const runStartupUpdateCheck = () => {
      // Delay de 3s para garantir que o renderer carregou o React e montou os listeners
      setTimeout(() => {
        triggerUpdateCheck()
      }, 3000)
    }

    if (win) {
      if (win.webContents.isLoading()) {
        win.webContents.once('did-finish-load', runStartupUpdateCheck)
      } else {
        runStartupUpdateCheck()
      }
    }

    // Checagem periódica a cada 2 horas em segundo plano
    setInterval(() => {
      triggerUpdateCheck()
    }, 2 * 60 * 60 * 1000)
  }
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin' && !getBackgroundSettings().keepRunningInBackground) app.quit()
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})
