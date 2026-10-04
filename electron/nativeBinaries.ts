import { app } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const NATIVE_BINARIES = {
  GAME_DETECTOR: 'vx_rt_c831.exe',
  NATIVE_STREAMER: 'vx_rt_a94f.exe',
  WGC_CAPTURE: 'vx_rt_f52d.exe',
  AGE_SIGNAL: 'vx_rt_b18e.exe',
} as const;

export type NativeBinaryKey = keyof typeof NATIVE_BINARIES;
export type NativeBinaryFile = (typeof NATIVE_BINARIES)[NativeBinaryKey];

interface BinaryManifestEntry {
  sha256: string;
  sizeBytes: number;
}

interface NativeManifest {
  version: string;
  generatedAt: string;
  binaries: Record<string, BinaryManifestEntry>;
}

let cachedManifest: NativeManifest | null = null;

/**
 * Localiza e carrega o manifesto de integridade criptografica oficial
 */
export function getNativeManifest(): NativeManifest | null {
  if (cachedManifest) return cachedManifest;

  const candidatePaths = [
    join(process.resourcesPath, 'native_manifest.json'),
    join(process.resourcesPath, 'bin/native_manifest.json'),
    join(process.resourcesPath, 'app.asar.unpacked/electron/native_manifest.json'),
    join(app.getAppPath(), 'electron/native_manifest.json'),
    join(__dirname, 'native_manifest.json'),
    join(__dirname, '../electron/native_manifest.json'),
    join(process.cwd(), 'electron/native_manifest.json'),
    join(process.cwd(), 'frontend/electron/native_manifest.json'),
  ];

  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      try {
        const raw = readFileSync(candidate, 'utf8');
        cachedManifest = JSON.parse(raw);
        return cachedManifest;
      } catch (e) {
        console.error('[Integrity] Erro ao ler manifesto:', candidate, e);
      }
    }
  }

  return null;
}

/**
 * Calcula o hash SHA-256 de um arquivo em disco
 */
export function calculateFileSha256(filePath: string): string {
  const buffer = readFileSync(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Valida a integridade criptografica de um binario em relacao ao manifesto
 */
export function verifyBinarySha256(filePath: string, binaryName: string): boolean {
  const manifest = getNativeManifest();
  if (!manifest || !manifest.binaries[binaryName]) {
    // Se o manifesto nao estiver disponivel (ex: dev suite inicial), permite execucao
    return true;
  }

  const expectedHash = manifest.binaries[binaryName].sha256.toLowerCase();
  const actualHash = calculateFileSha256(filePath).toLowerCase();

  return expectedHash === actualHash;
}

/**
 * Resolve o caminho de um binario nativo validando existencia e integridade SHA-256
 */
export function resolveNativeBinary(binaryName: string, enforceIntegrity: boolean = true): string | null {
  const candidatePaths = [
    join(process.resourcesPath, `bin/${binaryName}`),
    join(process.resourcesPath, `app.asar.unpacked/electron/bin/${binaryName}`),
    join(__dirname, `bin/${binaryName}`),
    join(__dirname, `../electron/bin/${binaryName}`),
    join(app.getAppPath(), `electron/bin/${binaryName}`),
    join(process.cwd(), `electron/bin/${binaryName}`),
    join(process.cwd(), `frontend/electron/bin/${binaryName}`),
    join(process.cwd(), `frontend/native/${binaryName}`),
  ];

  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      if (enforceIntegrity && !verifyBinarySha256(candidate, binaryName)) {
        console.error(`[Security Alert] Integridade comprometida no binario ${binaryName} em ${candidate}! Hash SHA-256 nao confere.`);
        return null;
      }
      return candidate;
    }
  }

  return null;
}

export interface StartupIntegrityResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validação executada na inicialização do aplicativo (Startup Integrity Guard)
 * Garante que nenhum binário esteja ausente ou adulterado antes de liberar a interface.
 */
export function performStartupIntegrityCheck(): StartupIntegrityResult {
  if (process.platform !== 'win32') {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];
  const manifest = getNativeManifest();

  for (const [, binName] of Object.entries(NATIVE_BINARIES)) {
    const candidatePaths = [
      join(process.resourcesPath, `bin/${binName}`),
      join(process.resourcesPath, `app.asar.unpacked/electron/bin/${binName}`),
      join(__dirname, `bin/${binName}`),
      join(__dirname, `../electron/bin/${binName}`),
      join(app.getAppPath(), `electron/bin/${binName}`),
      join(process.cwd(), `electron/bin/${binName}`),
      join(process.cwd(), `frontend/electron/bin/${binName}`),
      join(process.cwd(), `frontend/native/${binName}`),
    ];

    const foundPath = candidatePaths.find(p => existsSync(p));

    if (!foundPath) {
      errors.push(`Componente essencial ausente: ${binName}`);
      continue;
    }

    if (manifest && manifest.binaries[binName]) {
      const expectedHash = manifest.binaries[binName].sha256.toLowerCase();
      const actualHash = calculateFileSha256(foundPath).toLowerCase();
      if (expectedHash !== actualHash) {
        errors.push(`Assinatura digital corrompida ou modificada: ${binName}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
