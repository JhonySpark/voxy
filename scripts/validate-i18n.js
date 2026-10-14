import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localesDir = path.join(__dirname, '..', 'src', 'locales');
const ptPath = path.join(localesDir, 'pt.json');
const enPath = path.join(localesDir, 'en.json');
const esPath = path.join(localesDir, 'es.json');

if (!fs.existsSync(ptPath) || !fs.existsSync(enPath) || !fs.existsSync(esPath)) {
  console.error('❌ Erro: Arquivos de tradução (pt.json, en.json, es.json) não foram encontrados em:', localesDir);
  process.exit(1);
}

const pt = JSON.parse(fs.readFileSync(ptPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));

const ptKeys = new Set(Object.keys(pt));
const enKeys = new Set(Object.keys(en));
const esKeys = new Set(Object.keys(es));

const allKeys = new Set([...ptKeys, ...enKeys, ...esKeys]);

let hasError = false;

const missingInEn = [...allKeys].filter((k) => !enKeys.has(k));
const missingInPt = [...allKeys].filter((k) => !ptKeys.has(k));
const missingInEs = [...allKeys].filter((k) => !esKeys.has(k));

if (missingInPt.length > 0) {
  hasError = true;
  console.error(`❌ Chaves ausentes em PT (${missingInPt.length}):`, missingInPt);
}

if (missingInEn.length > 0) {
  hasError = true;
  console.error(`❌ Chaves ausentes em EN (${missingInEn.length}):`, missingInEn);
}

if (missingInEs.length > 0) {
  hasError = true;
  console.error(`❌ Chaves ausentes em ES (${missingInEs.length}):`, missingInEs);
}

if (!hasError) {
  console.log(`✅ Validação de paridade i18n com sucesso!`);
  console.log(`Total de chaves sincronizadas: ${allKeys.size} (PT: ${ptKeys.size}, EN: ${enKeys.size}, ES: ${esKeys.size})`);
  process.exit(0);
} else {
  process.exit(1);
}
