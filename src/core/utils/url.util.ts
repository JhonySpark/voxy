import { IpcChannels } from '../enums';

/**
 * Abre uma URL externa no navegador padrão do Sistema Operacional.
 *
 * Funciona de forma transparente em:
 * 1. Electron Desktop: aciona IPC ou shell.openExternal (evita navegação interna).
 * 2. Navegador Web comum: utiliza window.open com rel="noopener,noreferrer".
 */
export function openExternalUrl(url: string): void {
  if (!url) return;

  let targetUrl = url.trim();

  // Garante esquema http:// ou https:// caso a URL comece com www. ou sem protocolo
  if (!/^https?:\/\//i.test(targetUrl) && !/^mailto:/i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  // 1. Tenta acionar via Electron IPC no processo principal
  try {
    if (typeof window !== 'undefined') {
      const electron = (window as any).require ? (window as any).require('electron') : null;

      if (electron?.ipcRenderer) {
        void electron.ipcRenderer.invoke(IpcChannels.OPEN_EXTERNAL_URL, targetUrl).catch(() => {
          // Fallback se o canal falhar
          if (electron?.shell?.openExternal) {
            void electron.shell.openExternal(targetUrl);
          }
        });
        return;
      }

      if (electron?.shell?.openExternal) {
        void electron.shell.openExternal(targetUrl);
        return;
      }
    }
  } catch (err) {
    console.warn('[UrlUtil] Falha ao acionar Electron IPC/shell:', err);
  }

  // 2. Fallback padrão para ambiente de navegador Web
  window.open(targetUrl, '_blank', 'noopener,noreferrer');
}
