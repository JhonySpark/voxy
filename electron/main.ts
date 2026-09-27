import { app, BrowserWindow, ipcMain, desktopCapturer, dialog } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { autoUpdater } from 'electron-updater'
import { getCategorizedSources } from './gameDetector'
import os from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
app.commandLine.appendSwitch('enable-zero-copy')
app.commandLine.appendSwitch('enable-gpu-memory-buffer-video-frames')
app.commandLine.appendSwitch('enable-features', 'WebRtcAllowWgcScreenCapturer,DXGIZeroCopyVideo,ZeroCopy')
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-background-timer-throttling')

let win: BrowserWindow | null = null

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

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  // Retorna fontes categorizadas (Jogos detectados, Janelas/Apps e Telas com ícones)
  ipcMain.handle('DESKTOP_CAPTURER_GET_CATEGORIZED_SOURCES', async () => {
    return await getCategorizedSources();
  });

  ipcMain.handle('DESKTOP_CAPTURER_GET_SOURCES', async (event, opts) => {
    const sources = await desktopCapturer.getSources(opts);
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      appIcon: source.appIcon ? source.appIcon.toDataURL() : null
    }));
  });

  createWindow();

  // IPC para checagem e instalação de atualizações
  ipcMain.handle('CHECK_FOR_UPDATES', async () => {
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

  ipcMain.handle('RESTART_AND_INSTALL', () => {
    autoUpdater.quitAndInstall()
  })

  // Autoupdate (somente em produção)
  if (!process.env.VITE_DEV_SERVER_URL) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Verificando atualizações...')
      win?.webContents.send('app-update-checking')
    })

    autoUpdater.on('update-available', (info) => {
      console.log(`[AutoUpdater] Nova versão encontrada: ${info.version}`)
      win?.webContents.send('app-update-available', {
        version: info.version,
        releaseDate: info.releaseDate
      })
    })

    autoUpdater.on('update-not-available', (info) => {
      console.log(`[AutoUpdater] Nenhuma atualização disponível. Versão atual: ${info.version}`)
      win?.webContents.send('app-update-not-available', {
        version: info.version
      })
    })

    autoUpdater.on('download-progress', (progressObj) => {
      win?.webContents.send('app-update-progress', {
        percent: Math.round(progressObj.percent),
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      console.log(`[AutoUpdater] Versão ${info.version} baixada e pronta para instalação.`)
      win?.webContents.send('app-update-downloaded', {
        version: info.version
      })

      if (win) {
        dialog.showMessageBox(win, {
          type: 'info',
          title: 'Atualização Disponível',
          message: `Uma nova versão do Voxy (${info.version}) foi baixada.`,
          detail: 'Deseja reiniciar a aplicação agora para concluir a atualização?',
          buttons: ['Reiniciar Agora', 'Depois'],
          defaultId: 0,
          cancelId: 1
        }).then((result) => {
          if (result.response === 0) {
            autoUpdater.quitAndInstall()
          }
        })
      }
    })

    autoUpdater.on('error', (err) => {
      console.error('[AutoUpdater] Erro ao verificar ou baixar atualização:', err)
      win?.webContents.send('app-update-error', {
        message: err.message
      })
    })

    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('[AutoUpdater] Erro no checkForUpdatesAndNotify:', err)
    })
  }
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})
