import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const locales = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/locales/pt.json'), 'utf8'));
const localeKeys = new Set(Object.keys(locales));

const missingKeys = new Map();

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'locales') {
        scanDir(fullPath);
      }
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const regex = /\bt\(\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = regex.exec(content)) !== null) {
        const key = m[1];
        if (!localeKeys.has(key)) {
          if (!missingKeys.has(key)) missingKeys.set(key, []);
          missingKeys.get(key).push(fullPath.replace(/\\/g, '/'));
        }
      }
    }
  }
}

scanDir(path.join(__dirname, '../src'));

console.log('Total missing keys used in t():', missingKeys.size);
for (const [key, files] of missingKeys.entries()) {
  console.log(`${key} -> ${files[0]}`);
}
