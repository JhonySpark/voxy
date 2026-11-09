import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import https from 'https';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, '../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const tag = `v${pkg.version}`;
const owner = 'JhonySpark';
const repository = 'voxy';

function githubRequest(path, method, token, body) {
  return new Promise((resolveRequest, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const request = https.request(
      {
        hostname: 'api.github.com',
        path,
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'voxy-release-script',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (response) => {
        let responseBody = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { responseBody += chunk; });
        response.on('end', () => resolveRequest({ status: response.statusCode ?? 0, body: responseBody }));
      },
    );
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function ensureGitHubRelease() {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GH_TOKEN ou GITHUB_TOKEN não foi definido.');
  }

  const releasePath = `/repos/${owner}/${repository}/releases/tags/${encodeURIComponent(tag)}`;
  const existing = await githubRequest(releasePath, 'GET', token);
  if (existing.status === 200) {
    const release = JSON.parse(existing.body);
    if (release.draft) {
      console.log(`[Voxy Release] Publicando o rascunho existente ${tag}...`);
      const published = await githubRequest(`/repos/${owner}/${repository}/releases/${release.id}`, 'PATCH', token, {
        draft: false,
        prerelease: false,
      });
      if (published.status !== 200) {
        throw new Error(`Não foi possível publicar o rascunho ${tag} (HTTP ${published.status}).`);
      }
    }
    console.log(`[Voxy Release] Release ${tag} já existe; os arquivos serão anexados a ela.`);
    return;
  }
  if (existing.status !== 404) {
    throw new Error(`Não foi possível consultar a release ${tag} (HTTP ${existing.status}).`);
  }

  console.log(`[Voxy Release] Criando release ${tag} antes do upload dos artefatos...`);
  const created = await githubRequest(`/repos/${owner}/${repository}/releases`, 'POST', token, {
    tag_name: tag,
    name: tag,
    draft: false,
    prerelease: false,
    generate_release_notes: true,
  });

  if (created.status === 201) {
    console.log(`[Voxy Release] Release ${tag} criada com sucesso.`);
    return;
  }

  // Caso outro processo a tenha criado entre o GET e o POST, confirma a
  // existência e permite que o electron-builder somente faça os uploads.
  if (created.status === 422) {
    const retry = await githubRequest(releasePath, 'GET', token);
    if (retry.status === 200) {
      console.log(`[Voxy Release] Release ${tag} foi criada em paralelo; reutilizando-a.`);
      return;
    }
  }

  throw new Error(`Não foi possível criar a release ${tag} (HTTP ${created.status}): ${created.body}`);
}

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

  // 2. Tenta sincronizar a tag via Git (SSH porta 22 -> fallback SSH porta 443 -> fallback API HTTPS)
  try {
    const sshEnv22 = {
      ...process.env,
      GIT_SSH_COMMAND: 'ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new',
    };
    const remoteTagCheck = execSync(`git ls-remote --tags origin refs/tags/${tag}`, {
      encoding: 'utf-8',
      env: sshEnv22,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!remoteTagCheck) {
      console.log(`[Voxy Release] Enviando tag ${tag} para origin...`);
      execSync(`git push origin ${tag}`, { stdio: 'inherit', env: sshEnv22 });
      console.log(`[Voxy Release] Tag ${tag} enviada com sucesso para o GitHub.`);
    } else {
      console.log(`[Voxy Release] Tag ${tag} já existe no repositório remoto.`);
    }
  } catch {
    console.log(`[Voxy Release] Porta 22 indisponível. Tentando via SSH sobre HTTPS (ssh.github.com:443)...`);
    try {
      const sshEnv443 = {
        ...process.env,
        GIT_SSH_COMMAND: 'ssh -o Hostname=ssh.github.com -p 443 -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new',
      };
      const remoteTagCheck443 = execSync(`git ls-remote --tags origin refs/tags/${tag}`, {
        encoding: 'utf-8',
        env: sshEnv443,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      if (!remoteTagCheck443) {
        console.log(`[Voxy Release] Enviando tag ${tag} para origin (porta 443)...`);
        execSync(`git push origin ${tag}`, { stdio: 'inherit', env: sshEnv443 });
        console.log(`[Voxy Release] Tag ${tag} enviada com sucesso para o GitHub.`);
      } else {
        console.log(`[Voxy Release] Tag ${tag} já existe no repositório remoto.`);
      }
    } catch {
      console.log(
        `[Voxy Release] SSH indisponível na rede atual. A tag ${tag} será criada diretamente via API HTTPS do GitHub.`,
      );
    }
  }
} catch (err) {
  console.error(`[Voxy Release] Erro ao preparar tag Git local ${tag}:`, err.message);
  process.exit(1);
}

try {
  await ensureGitHubRelease();
} catch (err) {
  console.error(`[Voxy Release] Erro ao preparar a release ${tag}:`, err.message);
  process.exit(1);
}
