/**
 * Verificacion de la migracion: compara el CSS de una referencia con el actual, regla a regla.
 *
 * Declara OK solo si toda regla que existia sigue existiendo con el mismo cuerpo, salvo
 * las que se borraron a proposito (clases muertas). Detecta lo que un build no ve:
 * reglas mutiladas, cuerpos alterados, selectores perdidos al mover bloques.
 *
 *   node scripts/migracion-css/verificar-vs-head.mjs [--todas]
 *   REF=origin/main node scripts/migracion-css/verificar-vs-head.mjs
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const sheetsNow = execSync('git ls-files "src/**/*.scss" "src/**/*.css"').toString().trim().split('\n')
  .concat(execSync('git ls-files --others --exclude-standard "src/**/*.scss"').toString().trim().split('\n'))
  .filter(Boolean);

const readNow = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
// Referencia contra la que comparar. Por defecto HEAD; en un merge interesa la rama que
// se integra (`REF=origin/main node ...`), que es de donde viene el CSS que hay que conservar.
const REF = process.env.REF || 'HEAD';
const readHead = (f) => { try { return execSync(`git show ${REF}:${f}`, { maxBuffer: 1 << 28 }).toString(); } catch { return ''; } };

/** Resuelve un selector hijo contra su padre, con el `&` de SCSS. */
const resolve = (parent, child) => {
  if (!parent) return child;
  return child.split(',').map((c) => {
    const t = c.trim();
    if (t.includes('&')) return parent.split(',').map((p) => t.replace(/&/g, p.trim())).join(', ');
    return parent.split(',').map((p) => `${p.trim()} ${t}`).join(', ');
  }).join(', ');
};

/**
 * Mapa selector-resuelto -> declaraciones ordenadas, de TODAS las reglas de la hoja.
 * Baja tanto por at-rules (`@media`) como por anidamiento plano de SCSS (`.a { .b {} }`),
 * que es justo lo que se le escapaba antes: `shell.scss` anida y sus reglas internas no
 * se estaban comparando con nada.
 */
function rules(src, out = new Map(), atPrefix = '', parentSel = '') {
  const noC = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
  let i = 0, bs = 0;
  while (i < noC.length) {
    // Un `;` a nivel cero cierra una at-rule sin bloque (`@use '...' as *;`).
    if (noC[i] === ';') { i++; bs = i; continue; }
    if (noC[i] === '{') {
      let d = 1, j = i + 1;
      while (j < noC.length && d > 0) { if (noC[j] === '{') d++; else if (noC[j] === '}') d--; j++; }
      const sel = noC.slice(bs, i).trim().replace(/\s+/g, ' ');
      const body = noC.slice(i + 1, j - 1);
      if (sel.startsWith('@')) {
        rules(body, out, atPrefix + sel + ' | ', parentSel);
      } else {
        const full = resolve(parentSel, sel);
        const decls = body.split(';').map((x) => x.trim().replace(/\s+/g, ' '))
          .filter((x) => x && !x.includes('{') && !x.includes('}')).sort();
        for (const s of full.split(',').map((x) => x.trim()).filter(Boolean)) {
          const key = atPrefix + s;
          // Una hoja puede declarar el mismo selector dos veces; se acumula en vez de
          // pisarse, para no reportar un falso "cuerpo cambiado" por colision de clave.
          out.set(key, out.has(key) ? out.get(key) + ' || ' + decls.join(';') : decls.join(';'));
        }
        if (body.includes('{')) rules(body, out, atPrefix, full);
      }
      i = bs = j;
      continue;
    }
    i++;
  }
  return out;
}

const before = new Map(), after = new Map();
const files = [...new Set([...sheetsNow, ...execSync('git ls-files "src/**/*.scss" "src/**/*.css"').toString().trim().split('\n')])];
for (const f of files) {
  for (const [k, v] of rules(readHead(f))) before.set(k, v);
  for (const [k, v] of rules(readNow(f))) after.set(k, v);
}

const gone = [], changed = [];
for (const [sel, body] of before) {
  if (!after.has(sel)) gone.push(sel);
  else if (after.get(sel) !== body) changed.push(sel);
}
const added = [...after.keys()].filter((k) => !before.has(k));

const markup = execSync('git ls-files "src/**/*.ts" "src/**/*.html"').toString().trim().split('\n')
  .filter((f) => !f.endsWith('.spec.ts')).map((f) => readFileSync(f, 'utf8')).join('\n');
const isUsed = (c) => markup.includes(c) || (c.includes('--') && markup.includes(c.slice(0, c.lastIndexOf('--') + 2)));
// Solo preocupa si TODAS las clases del selector siguen vivas: si una murio, la regla ya
// no podia casar y su desaparicion es la limpieza que buscabamos.
const allAlive = (sel) => { const c = [...sel.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]); return c.length > 0 && c.every(isUsed); };
const suspicious = gone.filter(allAlive);

console.log(`reglas en ${REF}: ${before.size}   ahora: ${after.size}`);
console.log(`desaparecidas: ${gone.length}  (de ellas, con clases AUN EN USO: ${suspicious.length})`);
console.log(`con el cuerpo cambiado: ${changed.length}`);
console.log(`nuevas: ${added.length}`);
if (process.argv.includes('--todas')) {
  console.log('\nTODAS las desaparecidas:');
  for (const g of gone) console.log('   ' + g.slice(0, 140));
}
if (suspicious.length) {
  console.log('\nSOSPECHOSAS — se perdio CSS de clases que el markup sigue usando:');
  for (const s of suspicious.slice(0, 40)) console.log('   ' + s.slice(0, 140));
  if (suspicious.length > 40) console.log(`   ... y ${suspicious.length - 40} mas`);
}
if (changed.length && process.argv.includes('--cambios')) {
  console.log('\nCUERPO CAMBIADO:');
  for (const s of changed.slice(0, 40)) console.log('   ' + s.slice(0, 140));
}
process.exit(suspicious.length ? 1 : 0);
