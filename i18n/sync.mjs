// Valida los ficheros de traducción (mismas claves y mismos {{placeholders}} que en.json)
// y los copia a la web y a la app móvil.
//   node i18n/sync.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, 'locales');
const targets = [
  path.join(root, '..', 'skatemap-web', 'src', 'i18n', 'locales'),
  path.join(root, '..', 'skatemap-mobile', 'i18n', 'locales'),
];

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? flatten(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]]
  );

const placeholders = (text) => [...String(text).matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort().join(',');

const reference = new Map(flatten(JSON.parse(fs.readFileSync(path.join(source, 'en.json'), 'utf8'))));
const files = fs.readdirSync(source).filter((f) => f.endsWith('.json')).sort();
const errors = [];

for (const file of files) {
  const entries = new Map(flatten(JSON.parse(fs.readFileSync(path.join(source, file), 'utf8'))));
  for (const [key, value] of reference) {
    if (!entries.has(key)) {
      errors.push(`${file}: falta la clave ${key}`);
    } else if (placeholders(entries.get(key)) !== placeholders(value)) {
      errors.push(`${file}: placeholders distintos en ${key}`);
    } else if (String(entries.get(key)).trim() === '') {
      errors.push(`${file}: valor vacío en ${key}`);
    }
  }
  for (const key of entries.keys()) {
    if (!reference.has(key)) errors.push(`${file}: clave sobrante ${key}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

// languages.json debe tener exactamente los idiomas de los ficheros
const languages = JSON.parse(fs.readFileSync(path.join(root, 'languages.json'), 'utf8')).map((l) => l.code).sort();
const codes = files.map((f) => f.replace('.json', '')).sort();
if (languages.join() !== codes.join()) {
  console.error(`languages.json (${languages.join(', ')}) no coincide con los ficheros (${codes.join(', ')})`);
  process.exit(1);
}

for (const target of targets) {
  fs.mkdirSync(target, { recursive: true });
  for (const file of files) fs.copyFileSync(path.join(source, file), path.join(target, file));
  fs.copyFileSync(path.join(root, 'languages.json'), path.join(target, '..', 'languages.json'));
}
console.log(`OK: ${files.length} idiomas (${files.map((f) => f.replace('.json', '')).join(', ')}) copiados a ${targets.length} proyectos.`);
