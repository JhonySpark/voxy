import { BrowserWindow, app, desktopCapturer, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
//#region electron/main.ts
var __dirname = dirname(fileURLToPath(import.meta.url));
if (process.release.name === "win32") app.disableHardwareAcceleration();
var win = null;
async function createWindow() {
	win = new BrowserWindow({
		title: "Voxy",
		width: 1024,
		height: 768,
		autoHideMenuBar: true,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false
		}
	});
	win.removeMenu();
	if (process.env.VITE_DEV_SERVER_URL) {
		win.loadURL(process.env.VITE_DEV_SERVER_URL);
		win.webContents.openDevTools();
	} else win.loadFile(join(__dirname, "../dist/index.html"));
}
app.whenReady().then(() => {
	ipcMain.handle("DESKTOP_CAPTURER_GET_SOURCES", async (event, opts) => {
		return (await desktopCapturer.getSources(opts)).map((source) => ({
			id: source.id,
			name: source.name,
			thumbnail: source.thumbnail.toDataURL()
		}));
	});
	createWindow();
});
app.on("window-all-closed", () => {
	win = null;
	if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
	const allWindows = BrowserWindow.getAllWindows();
	if (allWindows.length) allWindows[0].focus();
	else createWindow();
});
//#endregion
export {};
