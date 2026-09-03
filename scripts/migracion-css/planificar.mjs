/**
 * Calcula, para cada prefijo dado, que sub-bloques tienen UN SOLO componente consumidor
 * y a que hoja deberian ir. Imprime un plan de extracciones listo para ejecutar.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';

const BASE = 'src/app/features/shell/views';
const comps = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.ts') && !f.endsWith('.spec.ts')) comps.push(p);
  }
};
walk(BASE);
const src = readFileSync(join(BASE, 'views.scss'), 'utf8');
const bodies = comps.map((p) => ({ path: p, name: basename(p, '.ts'), body: readFileSync(p, 'utf8') }));

const byTarget = new Map();
const shared = [];

for (const pre of process.argv.slice(2)) {
  const re = new RegExp('^\\s*\\.(' + pre + '-[A-Za-z0-9_-]*)', 'gm');
  const blocks = {};
  for (const m of src.matchAll(re)) {
    const k = m[1].split('__')[0].split('--')[0];
    blocks[k] = (blocks[k] || 0) + 1;
  }
  for (const [b, n] of Object.entries(blocks)) {
    const owners = bodies.filter((c) => new RegExp('[\\s"\'`]' + b + '[\\s"\'`_-]').test(c.body));
    if (owners.length === 1) {
      const t = owners[0].path.replace(/\.ts$/, '.scss');
      if (!byTarget.has(t)) byTarget.set(t, { blocks: [], n: 0 });
      byTarget.get(t).blocks.push(b);
      byTarget.get(t).n += n;
    } else shared.push([b, n, owners.length]);
  }
}

console.log('--- EXTRAER (dueno unico) ---');
for (const [t, v] of [...byTarget].sort((a, b) => b[1].n - a[1].n))
  console.log(`${String(v.n).padStart(4)}  ${t.replace('src/app/features/shell/views/', '')}\n      ${v.blocks.join(',')}`);

const sharedN = shared.reduce((s, x) => s + x[1], 0);
console.log(`\n--- SE QUEDAN GLOBALES: ${shared.length} bloques, ${sharedN} reglas ---`);
console.log(shared.sort((a, b) => b[1] - a[1]).slice(0, 20).map((x) => `${String(x[1]).padStart(4)}  ${x[0]} (${x[2]} consumidores)`).join('\n'));
