import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { autoUpdater } from 'electron-updater'

const __dirname = dirname(fileURLToPath(import.meta.url))

app.commandLine.appendSwitch('enable-webrtc-hw-h264-encoding')
app.commandLine.appendSwitch('ignore-gpu-blocklist')

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
  ipcMain.handle('DESKTOP_CAPTURER_GET_SOURCES', async (event, opts) => {
    const sources = await desktopCapturer.getSources(opts);
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }));
  });
  createWindow();

  // Autoupdate (somente em produção)
  if (!process.env.VITE_DEV_SERVER_URL) {
    autoUpdater.checkForUpdatesAndNotify();
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
