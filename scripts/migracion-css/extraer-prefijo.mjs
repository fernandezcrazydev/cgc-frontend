/**
 * Extractor de bloques de views.scss por prefijo de clase.
 *   node extract.mjs <prefijo[,prefijo...]> <destino.scss> [--apply]
 *
 * Corta por OFFSETS del texto original: lo que se queda en views.scss conserva sus bytes
 * exactos (indentación, saltos, comentarios), para que el diff solo muestre borrados.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = process.env.EXTRACT_SRC || 'src/app/features/shell/views/views.scss';
const [prefixArg, dest, ...rest] = process.argv.slice(2);
const APPLY = rest.includes('--apply');
const PREFIXES = prefixArg.split(',');
const src = readFileSync(SRC, 'utf8');

/** Trocea texto en chunks de primer nivel con sus offsets [start,end). */
function chunk(text, base = 0) {
  const out = [];
  let i = 0, bufStart = 0;
  const flush = (end) => { if (text.slice(bufStart, end).trim()) out.push({ kind: 'code', s: base + bufStart, e: base + end }); };
  while (i < text.length) {
    if (text.startsWith('/*', i)) {
      const end = text.indexOf('*/', i + 2) + 2;
      // Un comentario solo es frontera si vengo de espacio en blanco. Si hay texto
      // acumulado estoy a medias de un selector (una lista con una nota entre medias):
      // ahi el comentario es parte de la regla, no un chunk suelto. Partirlo dejaba
      // fragmentos de selector colgando en el fichero de origen.
      if (text.slice(bufStart, i).trim()) { i = end; continue; }
      flush(i);
      out.push({ kind: 'comment', s: base + i, e: base + end });
      i = bufStart = end;
      continue;
    }
    if (text[i] === '{') {
      let depth = 1, j = i + 1;
      while (j < text.length && depth > 0) {
        if (text.startsWith('/*', j)) { j = text.indexOf('*/', j + 2) + 2; continue; }
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      out.push({ kind: 'rule', s: base + bufStart, e: base + j });
      i = bufStart = j;
      continue;
    }
    i++;
  }
  flush(text.length);
  return out;
}

const raw = (c) => src.slice(c.s, c.e);
const selectorOf = (t) => t.slice(0, t.indexOf('{')).trim();
// `.is-*`/`.has-*` son estado, no dueños de bloque. `.nf-*` es del UI kit: neutral para
// decidir, pero se reporta porque al encapsular puede dejar de aplicar.
const NEUTRAL = /^(is|has)-/;
const classesIn = (s) => [...s.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1])
  .filter((c) => !NEUTRAL.test(c) && !c.startsWith('nf-'));
const matches = (c) => PREFIXES.some((p) => c === p || c.startsWith(p + '-') || c.startsWith(p + '_'));

function verdict(text) {
  const sel = selectorOf(text);
  if (sel.startsWith('@keyframes')) {
    const name = sel.split(/\s+/)[1] || '';
    return PREFIXES.some((p) => name.startsWith(p + '-')) ? 'all' : 'none';
  }
  if (sel.startsWith('@media') || sel.startsWith('@supports')) return 'media';
  const cls = classesIn(sel);
  if (!cls.length) return 'none';
  const n = cls.filter(matches).length;
  return n === cls.length ? 'all' : n === 0 ? 'none' : 'mixed';
}

const cut = [];   // rangos [s,e) a eliminar de views.scss
const take = [];  // texto que va al fichero nuevo
const mixed = [];
let pend = null;  // comentario a la espera de la regla que describe

for (const c of chunk(src)) {
  if (c.kind === 'comment') { pend = c; continue; }
  if (c.kind === 'code') { pend = null; continue; }

  let v = verdict(raw(c));

  if (v === 'media') {
    const t = raw(c);
    const open = c.s + t.indexOf('{') + 1;
    const close = c.s + t.lastIndexOf('}');
    const inner = chunk(src.slice(open, close), open);
    const mine = [];
    let ipend = null, others = 0;
    for (const ic of inner) {
      if (ic.kind === 'comment') { ipend = ic; continue; }
      if (ic.kind === 'code') { ipend = null; continue; }
      if (verdict(raw(ic)) === 'all') { mine.push(ipend || ic, ic); ipend = null; }
      else { others++; ipend = null; }
    }
    if (!mine.length) v = 'none';
    else if (!others) v = 'all';
    else {
      // @media partido: se llevan solo las reglas del prefijo, envueltas en la misma query
      const head = selectorOf(t);
      const uniq = [...new Set(mine)];
      take.push(`${head} {\n${uniq.map((x) => raw(x).trim()).join('\n')}\n}`);
      for (const x of uniq) cut.push([x.s, x.e]);
      pend = null;
      continue;
    }
  }

  if (v === 'all') {
    if (pend) { take.push(raw(pend)); cut.push([pend.s, pend.e]); }
    take.push(raw(c).trim());
    cut.push([c.s, c.e]);
  } else if (v === 'mixed') mixed.push(selectorOf(raw(c)));
  pend = null;
}

console.log(`prefijos: ${PREFIXES.join(', ')}`);
console.log(`  se mueven: ${take.length} bloques -> ${dest}`);
console.log(`  MIXTAS (revisar a mano): ${mixed.length}`);
for (const m of mixed) console.log(`     ${m.replace(/\s+/g, ' ').slice(0, 120)}`);

const riskySel = take.join('\n').split('\n').filter((l) => /^\s*[^@\/].*\.nf-[a-z]/.test(l) && !l.includes('var(--nf'));
if (riskySel.length) {
  console.log(`\n  RIESGO al encapsular (selectores hacia internals de nf-*): ${riskySel.length}`);
  for (const l of riskySel) console.log(`     ${l.trim().slice(0, 110)}`);
}

if (APPLY) {
  cut.sort((a, b) => b[0] - a[0]);
  let out = src;
  for (const [s, e] of cut) out = out.slice(0, s) + out.slice(e);
  // Compacta los huecos de 3+ saltos que deja el recorte, sin tocar el resto.
  writeFileSync(SRC, out.replace(/\n{3,}/g, '\n\n'));
  writeFileSync(dest, take.join('\n\n').replace(/\n{3,}/g, '\n\n') + '\n');
  console.log(`\nescrito ${dest}`);
}
