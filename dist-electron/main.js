import { BrowserWindow as e, app as t, desktopCapturer as n, ipcMain as r } from "electron";
import { dirname as i, join as a } from "node:path";
import { fileURLToPath as o } from "node:url";
//#region electron/main.ts
var s = i(o(import.meta.url));
process.release.name === "win32" && t.disableHardwareAcceleration();
var c = null;
async function l() {
	c = new e({
		title: "Voxy",
		width: 1024,
		height: 768,
		autoHideMenuBar: !0,
		webPreferences: {
			nodeIntegration: !0,
			contextIsolation: !1
		}
	}), c.removeMenu(), process.env.VITE_DEV_SERVER_URL ? (c.loadURL(process.env.VITE_DEV_SERVER_URL), c.webContents.openDevTools()) : c.loadFile(a(s, "../dist/index.html"));
}
t.whenReady().then(() => {
	r.handle("DESKTOP_CAPTURER_GET_SOURCES", async (e, t) => (await n.getSources(t)).map((e) => ({
		id: e.id,
		name: e.name,
		thumbnail: e.thumbnail.toDataURL()
	}))), l();
}), t.on("window-all-closed", () => {
	c = null, process.platform !== "darwin" && t.quit();
}), t.on("activate", () => {
	let t = e.getAllWindows();
	t.length ? t[0].focus() : l();
});
//#endregion
export {};
