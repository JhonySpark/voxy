import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, '../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const tag = `v${pkg.version}`;

console.log(`[Voxy Release] Validando tag Git: ${tag}...`);

try {
  // 1. Verifica se a tag existe localmente
  const localTags = execSync('git tag --list', { encoding: 'utf-8' })
    .split('\n')
    .map((t) => t.trim());

  if (!localTags.includes(tag)) {
    console.log(`[Voxy Release] Criando tag local ${tag}...`);
    execSync(`git tag ${tag}`, { stdio: 'inherit' });
  } else {
    console.log(`[Voxy Release] Tag local ${tag} já existe.`);
  }

  // 2. Verifica se a tag existe no repositório remoto
  const remoteTagCheck = execSync(`git ls-remote --tags origin refs/tags/${tag}`, {
    encoding: 'utf-8',
  }).trim();

  if (!remoteTagCheck) {
    console.log(`[Voxy Release] Enviando tag ${tag} para origin...`);
    execSync(`git push origin ${tag}`, { stdio: 'inherit' });
    console.log(`[Voxy Release] Tag ${tag} enviada com sucesso para o GitHub.`);
  } else {
    console.log(`[Voxy Release] Tag ${tag} já existe no repositório remoto.`);
  }
} catch (err) {
  console.error(`[Voxy Release] Erro ao preparar tag Git ${tag}:`, err.message);
  process.exit(1);
}
