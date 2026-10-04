import { desktopCapturer, app } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execFileAsync = promisify(execFile);

export interface CaptureSourceItem {
  id: string;
  name: string;
  thumbnail: string;
  appIcon?: string | null;
  isGame: boolean;
  category: 'game' | 'app' | 'screen';
  graphicsInfo?: {
    d3d11: boolean;
    d3d12: boolean;
    dxgi: boolean;
    vulkan: boolean;
    opengl: boolean;
    d3d9: boolean;
  };
}

interface NativeWindowReport {
  hwnd: string;
  pid: number;
  processName: string;
  windowTitle: string;
  isGame: boolean;
  graphics: {
    d3d11: boolean;
    d3d12: boolean;
    dxgi: boolean;
    vulkan: boolean;
    opengl: boolean;
    d3d9: boolean;
  };
}

import { NATIVE_BINARIES, resolveNativeBinary } from './nativeBinaries';

/**
 * Executa o binário nativo para inspecionar
 * diretamente o espaço de memória dos processos e detectar DLLs gráficas 3D reais
 * (DirectX 11, DirectX 12, Vulkan, OpenGL, D3D9 + DXGI).
 */
async function getNativeGraphicsWindows(): Promise<NativeWindowReport[]> {
  if (process.platform !== 'win32') return [];

  const binPath = resolveNativeBinary(NATIVE_BINARIES.GAME_DETECTOR);
  if (!binPath) {
    return [];
  }

  try {
    const { stdout } = await execFileAsync(binPath, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    const reports: NativeWindowReport[] = JSON.parse(stdout);
    return reports;
  } catch (err) {
    console.error('[Voxy Detector] Erro ao executar detector nativo:', err);
    return [];
  }
}

export async function getCategorizedSources(): Promise<{
  games: CaptureSourceItem[];
  windows: CaptureSourceItem[];
  screens: CaptureSourceItem[];
}> {
  // Pega fontes do Electron incluindo ícones reais de janelas
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 480, height: 270 },
    fetchWindowIcons: true
  });

  // Executa o detector C++ nativo que faz inspeção direta de módulos DirectX/Vulkan
  const nativeReports = await getNativeGraphicsWindows();

  // Mapeia relatórios nativos por título em minúsculo e por PID
  const reportByTitle = new Map<string, NativeWindowReport>();
  for (const rep of nativeReports) {
    if (rep.windowTitle) {
      reportByTitle.set(rep.windowTitle.toLowerCase().trim(), rep);
    }
  }

  const games: CaptureSourceItem[] = [];
  const windows: CaptureSourceItem[] = [];
  const screens: CaptureSourceItem[] = [];

  for (const source of sources) {
    const isScreen = source.id.startsWith('screen:');
    const lowerName = source.name.toLowerCase().trim();

    // Filtra janelas internas ou da própria aplicação Voxy
    if (!isScreen && (!source.name || source.name === 'Desktop' || lowerName.includes('voxy'))) {
      continue;
    }

    const appIcon = source.appIcon ? source.appIcon.toDataURL() : null;
    const thumbnail = source.thumbnail.toDataURL();

    if (isScreen) {
      screens.push({
        id: source.id,
        name: source.name,
        thumbnail,
        appIcon,
        isGame: false,
        category: 'screen'
      });
      continue;
    }

    // Limpa caracteres invisíveis/zero-width que alguns jogos (como ARC Raiders) usam no título
    const cleanSourceName = source.name.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    const lowerCleanName = cleanSourceName.toLowerCase();

    // 1. Correspondência exata por HWND (Window Handle) - Mais rápida e 100% precisa
    const hwndMatch = source.id.match(/^window:(\d+)/);
    const sourceHwnd = hwndMatch ? hwndMatch[1] : null;

    let nativeReport = sourceHwnd ? nativeReports.find(r => r.hwnd === sourceHwnd) : null;

    // 2. Se não achou por HWND, busca por título limpo
    if (!nativeReport) {
      nativeReport = nativeReports.find(r => {
        const cleanRepTitle = r.windowTitle.replace(/[\u200B-\u200D\uFEFF]/g, '').toLowerCase().trim();
        return cleanRepTitle === lowerCleanName || 
               (cleanRepTitle.length > 3 && (lowerCleanName.includes(cleanRepTitle) || cleanRepTitle.includes(lowerCleanName)));
      });
    }

    // Classificação dinâmica por aceleração gráfica 3D real / Anti-cheat / Game Path
    let isGame = false;
    let graphicsInfo = undefined;

    if (nativeReport) {
      isGame = nativeReport.isGame;
      graphicsInfo = nativeReport.graphics;
    }

    // Filtro de segurança para ferramentas desktop e utilitários que usam aceleração gráfica ou rodam como Admin
    const procName = nativeReport?.processName ? nativeReport.processName.toLowerCase() : '';
    const isExcludedApp =
      procName.includes('teams') ||
      procName.includes('skype') ||
      procName.includes('zoom') ||
      procName.includes('webex') ||
      procName.includes('telegram') ||
      procName.includes('whatsapp') ||
      procName.includes('discord') ||
      procName.includes('slack') ||
      procName.includes('spotify') ||
      procName.includes('chrome') ||
      procName.includes('msedge') ||
      procName.includes('firefox') ||
      procName.includes('brave') ||
      procName.includes('opera') ||
      procName.includes('vivaldi') ||
      procName.includes('code') ||
      procName.includes('devenv') ||
      procName.includes('rider') ||
      procName.includes('idea') ||
      procName.includes('pycharm') ||
      procName.includes('antigravity') ||
      procName.includes('partition') ||
      procName.includes('minitool') ||
      procName.includes('diskgen') ||
      procName.includes('aomei') ||
      procName.includes('rufus') ||
      procName.includes('easeus') ||
      procName.includes('outlook') ||
      procName.includes('winword') ||
      procName.includes('excel') ||
      procName.includes('powerpnt') ||
      procName.includes('onenote') ||
      procName.includes('notepad') ||
      procName.includes('calculator') ||
      procName.includes('cmd') ||
      procName.includes('powershell') ||
      procName.includes('windowsterminal') ||
      procName.includes('powertoys') ||
      procName.includes('steam') ||
      procName.includes('epicgameslauncher') ||
      procName.includes('photoshop') ||
      procName.includes('illustrator') ||
      procName.includes('figma') ||
      procName.includes('canva') ||
      lowerCleanName.includes('partition wizard') ||
      lowerCleanName.includes('minitool') ||
      lowerCleanName.includes('microsoft teams');

    if (isExcludedApp) {
      isGame = false;
    }

    const item: CaptureSourceItem = {
      id: source.id,
      name: cleanSourceName || source.name,
      thumbnail,
      appIcon,
      isGame,
      category: isGame ? 'game' : 'app',
      graphicsInfo
    };

    if (isGame) {
      games.push(item);
    } else {
      windows.push(item);
    }
  }

  return { games, windows, screens };
}
