/**
 * Borra de una hoja las reglas cuyos selectores ya no pueden casar.
 *   node rmdead.mjs <hoja.scss> <clase-muerta> [clase-muerta...]
 *
 * Un selector muere si CUALQUIERA de sus clases esta muerta, sea el sujeto o un ancestro
 * (`.viva .muerta` no casa jamas). En una lista separada por comas se evalua parte por
 * parte: si solo mueren algunas, se poda la lista y la regla se queda.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [file, ...dead] = process.argv.slice(2);
const src = readFileSync(file, 'utf8');

/** Trocea en reglas de un nivel, con offsets y selector. */
function chunk(text, base = 0) {
  const out = [];
  let i = 0, bs = 0;
  while (i < text.length) {
    if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2) + 2;
      // Si lo acumulado es solo espacio, el comentario NO forma parte del selector que
      // viene: hay que saltarlo y arrancar el chunk despues. Sin esto el comentario se
      // colaba en `sel`, sus clases contaban como del selector y una coma dentro de el
      // (`/* .x (icono, 88px) */`) lo hacia pasar por lista de selectores.
      if (!text.slice(bs, i).trim()) bs = end;
      i = end;
      continue;
    }
    if (text[i] === '{') {
      let d = 1, j = i + 1;
      while (j < text.length && d > 0) {
        if (text.startsWith('/*', j)) { j = text.indexOf('*/', j + 2) + 2; continue; }
        if (text[j] === '{') d++;
        else if (text[j] === '}') d--;
        j++;
      }
      out.push({ s: base + bs, e: base + j, selEnd: base + i, sel: text.slice(bs, i).trim(), inner: [i + 1, j - 1] });
      i = bs = j;
      continue;
    }
    i++;
  }
  return out;
}

// `.is-*`/`.has-*` son estado y `.nf-*` es del UI kit: ninguno decide si un bloque muere.
const NEUTRAL = /^(is|has)-|^nf-/;
// Un comentario a media lista de selectores sigue siendo posible: se vacia antes de mirar.
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');
const clsOf = (s) => [...noComments(s).matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]).filter((c) => !NEUTRAL.test(c));
const partDead = (p) => { const c = clsOf(p); return c.length > 0 && c.some((x) => dead.includes(x)); };
const isDead = (sel) => sel.split(',').every(partDead);

const cut = [];      // [inicio, fin] de reglas a borrar enteras
const rewrite = [];  // [inicio, fin, nuevoSelector] de listas podadas

const scan = (chunks, base) => {
  for (const c of chunks) {
    if (c.sel.startsWith('@')) {
      const body = src.slice(base + c.inner[0], base + c.inner[1]);
      scan(chunk(body, base + c.inner[0]), base + c.inner[0]);
      continue;
    }
    const clean = noComments(c.sel);
    if (isDead(clean)) { cut.push([c.s, c.e]); continue; }
    // Nunca reescribir una lista que lleve un comentario entre medias: sus comas no
    // separan selectores (`/* ... (es un combobox), asi que ... */`) y al partir por
    // coma se mutila el comentario. Se deja intacta: una parte muerta de mas es inocua.
    if (c.sel.includes('/*')) continue;
    if (clean.includes(',') && clean.split(',').some(partDead)) {
      const live = clean.split(',').filter((p) => !partDead(p)).map((p) => p.trim());
      const indent = src.slice(c.s, c.selEnd).match(/^\s*/)[0];
      rewrite.push([c.s, c.selEnd, indent + live.join(',\n' + indent) + ' ']);
    }
  }
};
scan(chunk(src), 0);

const edits = [...cut.map(([s, e]) => [s, e, '']), ...rewrite].sort((a, b) => b[0] - a[0]);
let out = src;
for (const [s, e, txt] of edits) out = out.slice(0, s) + txt + out.slice(e);
writeFileSync(file, out.replace(/\n{3,}/g, '\n\n'));

console.log(`${file}: ${cut.length} reglas borradas, ${rewrite.length} listas podadas`);
