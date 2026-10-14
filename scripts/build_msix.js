import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';
import { build, Platform } from 'electron-builder';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Carregar variáveis de ambiente do .env
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

console.log('======================================================================');
console.log('  VOXY - Script de Build & Empacotamento MSIX (Windows Store)');
console.log('======================================================================');

// 2. Extrair dados do Partner Center e do package.json
const packageJsonPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const identityName = process.env.MSIX_IDENTITY_NAME || 'D4rkSideStudio.Voxy';
const publisher = process.env.MSIX_PUBLISHER || 'CN=231BC552-998F-44F4-A169-33B27F93DB71';
const publisherDisplayName = process.env.MSIX_PUBLISHER_DISPLAY_NAME || 'D4rk Side Studio';
const displayName = process.env.MSIX_PACKAGE_DISPLAY_NAME || 'Voxy';

function toQuadVersion(semver) {
  const clean = semver.split('-')[0];
  const parts = clean.split('.');
  while (parts.length < 4) {
    parts.push('0');
  }
  return parts.slice(0, 4).join('.');
}

const msixVersion = toQuadVersion(pkg.version);

console.log(`[Configuração de Identidade da Windows Store]`);
console.log(`  • App:                     ${displayName}`);
console.log(`  • Package Identity Name:   ${identityName}`);
console.log(`  • Publisher:               ${publisher}`);
console.log(`  • Publisher Display Name:  ${publisherDisplayName}`);
console.log(`  • Versão Semântica:        ${pkg.version}`);
console.log(`  • Versão Quad MSIX:        ${msixVersion}`);
console.log('----------------------------------------------------------------------');

// 3. Garantir que os assets de exibição (StoreLogo, Tiles, SplashScreen) existem
const appxAssetsDir = path.join(rootDir, 'build', 'appx');
const requiredAssets = [
  'Square44x44Logo.png',
  'Square150x150Logo.png',
  'Wide310x150Logo.png',
  'StoreLogo.png',
  'SplashScreen.png'
];

const hasAllAssets = fs.existsSync(appxAssetsDir) && requiredAssets.every(f => fs.existsSync(path.join(appxAssetsDir, f)));

if (!hasAllAssets) {
  console.log('[1/4] Gerando assets de imagem para MSIX...');
  const genScript = path.join(rootDir, 'scripts', 'generate_appx_assets.ps1');
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${genScript}"`, {
    cwd: rootDir,
    stdio: 'inherit'
  });
} else {
  console.log('[1/4] Assets de imagem MSIX verificados com sucesso.');
}

// 4. Garantir manifesto de integridade criptográfica dos binários nativos
console.log('[2/4] Verificando integridade dos binários nativos...');
const manifestGenScript = path.join(rootDir, 'scripts', 'generate_native_manifest.js');
execSync(`node "${manifestGenScript}"`, { cwd: rootDir, stdio: 'inherit' });

// 5. Build da interface e electron main
console.log('[3/4] Compilando frontend e main process (tsc + vite)...');
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });

// 6. Empacotamento MSIX via API programática do electron-builder
console.log('[4/4] Gerando pacote MSIX para Windows Store...');

try {
  const result = await build({
    targets: Platform.WINDOWS.createTarget('appx'),
    config: {
      appx: {
        identityName,
        publisher,
        publisherDisplayName,
        applicationId: identityName,
        displayName,
        backgroundColor: '#1e1e2e',
        showNameOnTiles: true,
        addAutoLaunchExtension: true,
        customManifestPath: 'build/Package.appxmanifest',
        artifactName: '${productName}_x64.msix',
        minVersion: '10.0.17763.0',
        maxVersionTested: '10.0.22621.0',
        languages: ['pt-BR', 'en-US'],
        capabilities: [
          'runFullTrust',
          'microphone',
          'internetClient',
          'internetClientServer',
          'privateNetworkClientServer',
          'graphicsCapture'
        ]
      }
    }
  });

  console.log('\n[electron-builder] Artefatos compilados:', result);
} catch (err) {
  console.error('\n[ERRO] Falha durante o empacotamento com electron-builder:', err);
  process.exit(1);
}

// 7. Pós-validação: localizar pacote gerado na pasta release
const releaseDir = path.join(rootDir, 'release');
if (fs.existsSync(releaseDir)) {
  const files = fs.readdirSync(releaseDir);
  const msixFiles = files.filter(f => f.endsWith('.msix') || f.endsWith('.appx'));

  // Se gerou com extensão .appx, criamos cópia com .msix para conveniência
  for (const f of msixFiles) {
    if (f.endsWith('.appx')) {
      const msixName = f.replace(/\.appx$/, '.msix');
      const src = path.join(releaseDir, f);
      const dest = path.join(releaseDir, msixName);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        console.log(`[Pós-Build] Pacote renomeado/copiado para formato oficial da Store: ${msixName}`);
      }
    }
  }

  console.log('\n======================================================================');
  console.log('  PACOTE MSIX GERADO COM SUCESSO!');
  console.log('======================================================================');
  const finalPackages = fs.readdirSync(releaseDir).filter(f => f.endsWith('.msix'));
  for (const pkgFile of finalPackages) {
    const fullPath = path.join(releaseDir, pkgFile);
    const sizeMb = (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2);
    console.log(`  📦 Arquivo:  ${fullPath}`);
    console.log(`  ⚖️  Tamanho:  ${sizeMb} MB`);
  }
  console.log('----------------------------------------------------------------------');
  console.log('  Pronto para upload no Microsoft Partner Center!');
  console.log('======================================================================\n');
}
