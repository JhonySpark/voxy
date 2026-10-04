import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const binDir = path.resolve(__dirname, '../electron/bin');
const manifestPath = path.resolve(__dirname, '../electron/native_manifest.json');

const targetBinaries = [
  'vx_rt_b18e.exe',
  'vx_rt_c831.exe',
  'vx_rt_a94f.exe',
  'vx_rt_f52d.exe',
];

console.log('[Manifest Generator] Gerando manifesto de integridade dos binarios nativos...');

const manifest = {
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  binaries: {}
};

for (const binName of targetBinaries) {
  const filePath = path.join(binDir, binName);
  if (!fs.existsSync(filePath)) {
    console.error(`[Manifest Generator] ERRO: Binario obrigatorio nao encontrado: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const size = content.length;

  manifest.binaries[binName] = {
    sha256: hash,
    sizeBytes: size
  };

  console.log(`  ✓ ${binName}: SHA-256=${hash.substring(0, 16)}... (${size} bytes)`);
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`[Manifest Generator] Manifesto salvo com sucesso em: ${manifestPath}`);
