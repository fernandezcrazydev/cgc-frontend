#!/usr/bin/env node
/**
 * arch-check — el ArchUnit de este repo.
 *
 * Comprueba las reglas de CLAUDE.md que el compilador no puede comprobar: dirección de
 * dependencias entre capas, localidad del CSS, tamaño de plantillas, suelo tipográfico.
 *
 * Filosofía: TRINQUETE (ratchet), no muro. La deuda que ya existe está anotada como
 * presupuesto en `scripts/arch-budgets.json`; el check falla si una regla EMPEORA y avisa
 * (sin fallar) cuando mejora, para que bajes el presupuesto. Así se adopta hoy, con el
 * repo como está, sin un big-bang previo.
 *
 * Uso:  npm run arch          → verifica
 *       npm run arch:fix      → reescribe los presupuestos con los valores actuales
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BUDGETS_FILE = join(ROOT, 'scripts', 'arch-budgets.json');
const VIEWS_SCSS = 'src/app/features/shell/views/views.scss';

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

const ALL = walk(join(ROOT, 'src')).map((p) => {
  let cache;
  return {
    path: relative(ROOT, p).split(sep).join('/'),
    read: () => (cache ??= readFileSync(p, 'utf8')),
  };
});

const pick = (...exts) => ALL.filter((f) => exts.some((e) => f.path.endsWith(e)));
const isSpec = (f) => f.path.endsWith('.spec.ts');
const hit = (file, line, msg) => ({ file, line, msg });

/** Resuelve un import relativo a ruta de repo, para saber a qué capa apunta. */
const resolveRelative = (fromPath, spec) => {
  const base = fromPath.split('/').slice(0, -1);
  for (const seg of spec.split('/')) {
    if (seg === '.') continue;
    else if (seg === '..') base.pop();
    else base.push(seg);
  }
  return base.join('/');
};

/**
 * Vacía el contenido de los comentarios conservando los saltos de línea, para que las
 * reglas escaneen solo código real sin perder la numeración. (`base.css` documenta la
 * regla de `100vh` en prosa: hablar de ella no es incumplirla.)
 */
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));

const eachImport = (file, fn) => {
  file.read().split('\n').forEach((line, i) => {
    const m = line.match(/from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']/);
    const spec = m ? m[1] || m[2] : null;
    if (spec && spec.startsWith('.')) fn(resolveRelative(file.path, spec), i + 1);
  });
};

/* ────────────────────────────────────────────────────────────────────────────
   Reglas. Cada una devuelve la lista de incumplimientos encontrados.
   `budget` = cuántos se toleran hoy (deuda anotada). Bajar siempre; subir nunca.
   ──────────────────────────────────────────────────────────────────────────── */
const RULES = [
  {
    id: 'layers',
    title: 'features → core|ui|shared; core → shared; ui y shared no importan de nadie',
    run() {
      // `ui/` y `shared/` son hojas del grafo de dependencias.
      const FORBIDDEN = {
        'src/app/ui/': ['src/app/core/', 'src/app/features/'],
        'src/app/shared/': ['src/app/core/', 'src/app/features/', 'src/app/ui/'],
        'src/app/core/': ['src/app/features/', 'src/app/ui/'],
      };
      const out = [];
      for (const f of pick('.ts')) {
        if (isSpec(f)) continue;
        const layer = Object.keys(FORBIDDEN).find((l) => f.path.startsWith(l));
        if (!layer) continue;
        eachImport(f, (target, line) => {
          for (const bad of FORBIDDEN[layer])
            if (target.startsWith(bad)) out.push(hit(f.path, line, `${layer} importa de ${target}`));
        });
      }
      return out;
    },
  },
  {
    id: 'feature-internals',
    title: 'Una feature nunca importa internals de otra feature (su barrel sí)',
    run() {
      // La distincion es deliberada: `../feedback` es la superficie publica de esa feature
      // y se permite; `../feedback/feedback-dialog` es un internal y no. Por eso el patron
      // exige que haya algo DESPUES del nombre de la feature.
      const out = [];
      for (const f of pick('.ts')) {
        if (!f.path.startsWith('src/app/features/') || isSpec(f)) continue;
        const mine = f.path.split('/')[3];
        eachImport(f, (target, line) => {
          const other = target.match(/^src\/app\/features\/([^/]+)\//);
          if (other && other[1] !== mine)
            out.push(hit(f.path, line, `importa internals de features/${other[1]}`));
        });
      }
      return out;
    },
  },
  {
    id: 'api-url',
    title: 'Nadie construye URLs con environment.apiUrl fuera de un *-api.ts',
    run() {
      // Infraestructura HTTP y arranque quedan fuera por diseño: no hablan de un dominio,
      // configuran el transporte (secureRoutes, refresh de sesión, reloj del servidor).
      const INFRA = ['src/app/app.config.ts', 'src/app/core/auth/', 'src/app/core/http/'];
      const out = [];
      for (const f of pick('.ts')) {
        if (isSpec(f) || f.path.endsWith('-api.ts')) continue;
        if (INFRA.some((p) => f.path.startsWith(p))) continue;
        f.read().split('\n').forEach((line, i) => {
          if (line.includes('environment.apiUrl')) out.push(hit(f.path, i + 1, 'usa environment.apiUrl'));
        });
      }
      return out;
    },
  },
  {
    id: 'views-scss-size',
    title: `${VIEWS_SCSS} no crece nunca (monolito global en migración a hojas por componente)`,
    unit: 'líneas',
    run() {
      const f = ALL.find((x) => x.path === VIEWS_SCSS);
      if (!f) return [];
      // Incumplimientos sintéticos: el trinquete solo compara el total contra el presupuesto.
      return f.read().split('\n').map(() => hit(VIEWS_SCSS, 0, 'línea del monolito'));
    },
  },
  {
    id: 'dead-css',
    title: 'Clases declaradas en cualquier hoja de app/ que ningún .ts/.html referencia',
    run() {
      // Barre TODAS las hojas, no solo el monolito: si solo mirase views.scss, mover un
      // bloque a su componente "mejoraría" la métrica sin haber borrado nada.
      const markup = pick('.ts', '.html').filter((x) => !isSpec(x)).map((x) => x.read()).join('\n');
      // Una variante puede componerse por interpolación (`nf-btn--${variant}`), así que
      // `nf-btn--primary` no aparece nunca literal. Si el markup contiene el tronco
      // `nf-btn--`, damos por vivas sus variantes: un detector de código muerto debe
      // quedarse corto antes que borrar CSS vivo.
      const used = (c) => markup.includes(c) || (c.includes('--') && markup.includes(c.slice(0, c.lastIndexOf('--') + 2)));
      const out = [];
      for (const f of pick('.scss', '.css')) {
        if (!f.path.startsWith('src/app/')) continue; // tokens y temas declaran, no consumen
        const declared = new Set((stripComments(f.read()).match(/\.[a-zA-Z][\w-]*/g) || []).map((c) => c.slice(1)));
        for (const c of declared) if (!used(c)) out.push(hit(f.path, 0, `.${c} sin uso`));
      }
      return out;
    },
  },
  {
    id: 'css-total-size',
    title: 'CSS total del proyecto (mover del monolito al componente es neutro; borrar, no)',
    unit: 'líneas de CSS',
    run() {
      // Complementa a `views-scss-size`: aquel obliga al monolito a encoger, este impide
      // que lo que sale de él reaparezca engordado en otro sitio.
      // Cuenta CSS, no formato: sin comentarios ni líneas en blanco. Si contara líneas en
      // bruto, repartir un fichero en varios lo haría "crecer" solo por sus cabeceras.
      const n = pick('.scss', '.css').reduce(
        (s, f) => s + stripComments(f.read()).split('\n').filter((l) => l.trim()).length,
        0,
      );
      return Array.from({ length: n }, () => hit('src/**/*.{scss,css}', 0, 'línea de CSS'));
    },
  },
  {
    id: 'inline-template-size',
    title: 'Plantilla inline > 150 líneas → mover a templateUrl',
    run() {
      const LIMIT = 150;
      const out = [];
      for (const f of pick('.ts')) {
        if (isSpec(f)) continue;
        const src = f.read();
        const start = src.indexOf('template: `');
        if (start === -1) continue;
        const end = src.indexOf('`,', start + 11);
        if (end === -1) continue;
        const lines = src.slice(start, end).split('\n').length;
        if (lines > LIMIT)
          out.push(hit(f.path, src.slice(0, start).split('\n').length, `plantilla inline de ${lines} líneas`));
      }
      return out;
    },
  },
  {
    id: 'font-floor',
    title: 'Nada por debajo de 11px (suelo de legibilidad)',
    run() {
      const out = [];
      for (const f of pick('.scss', '.css')) {
        stripComments(f.read()).split('\n').forEach((line, i) => {
          const m = line.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
          if (m && parseFloat(m[1]) < 11) out.push(hit(f.path, i + 1, `font-size: ${m[1]}px`));
        });
      }
      return out;
    },
  },
  {
    id: 'font-size-raw',
    title: '`font-size` en px crudos en vez de la escala `--fs-*` de tokens/typography.css',
    run() {
      // Es la causa real de la duplicación del CSS: `color: var(--nf-text-dim); font-size: 11px`
      // aparece 44 veces porque "texto secundario pequeño" no tiene nombre. La escala existe
      // desde hace meses y estaba al 4% de adopción.
      const out = [];
      for (const f of pick('.scss', '.css')) {
        if (f.path.startsWith('src/styles/')) continue; // ahí es donde se declara la escala
        stripComments(f.read()).split('\n').forEach((line, i) => {
          const m = line.match(/font-size:\s*(\d+(?:\.\d+)?)px/);
          if (m) out.push(hit(f.path, i + 1, `font-size: ${m[1]}px → var(--fs-*)`));
        });
      }
      return out;
    },
  },
  {
    id: 'viewport-units',
    title: '100vh/100vw a pelo (el zoom de :root los desvía un 10%) → calc(var(--nf-vh) * 100)',
    run() {
      const out = [];
      for (const f of pick('.scss', '.css', '.ts', '.html')) {
        stripComments(f.read()).split('\n').forEach((line, i) => {
          if (/(^|[^-\w(])100v[hw]\b/.test(line) && !line.includes('--nf-v'))
            out.push(hit(f.path, i + 1, line.trim().slice(0, 80)));
        });
      }
      return out;
    },
  },
];

/* ──────────────────────────────────── runner ──────────────────────────────────── */
const fix = process.argv.includes('--fix');
let budgets = {};
try {
  budgets = JSON.parse(readFileSync(BUDGETS_FILE, 'utf8'));
} catch {
  /* primera ejecución: se crea con --fix */
}

const C = { green: '[32m', red: '[31m', yellow: '[33m', dim: '[2m', off: '[0m' };
let failed = false;
const next = {};

for (const rule of RULES) {
  const found = rule.run();
  const budget = budgets[rule.id] ?? 0;
  const unit = rule.unit || 'incumplimientos';
  next[rule.id] = found.length;

  if (found.length > budget) {
    failed = true;
    console.log(`${C.red}x ${rule.id}${C.off}  ${found.length} ${unit} (presupuesto: ${budget})`);
    console.log(`  ${C.dim}${rule.title}${C.off}`);
    for (const x of found.slice(0, 12)) console.log(`    ${x.file}${x.line ? ':' + x.line : ''}  ${x.msg}`);
    if (found.length > 12) console.log(`    ${C.dim}... y ${found.length - 12} mas${C.off}`);
    console.log(`  ${C.yellow}-> has empeorado esta regla en ${found.length - budget}. Arreglalo; no subas el presupuesto.${C.off}\n`);
  } else if (found.length < budget) {
    console.log(`${C.green}v ${rule.id}${C.off}  ${found.length}/${budget} ${unit} ${C.green}(mejorado en ${budget - found.length})${C.off}`);
    if (!fix) console.log(`  ${C.dim}baja el presupuesto: npm run arch:fix${C.off}`);
  } else {
    console.log(`${C.green}v ${rule.id}${C.off}  ${found.length}/${budget} ${unit}`);
  }
}

if (fix) {
  writeFileSync(BUDGETS_FILE, JSON.stringify(next, null, 2) + '\n');
  console.log(`\n${C.green}Presupuestos reescritos en scripts/arch-budgets.json${C.off}`);
  process.exit(0);
}

console.log(failed ? `\n${C.red}arch-check: FALLA${C.off}` : `\n${C.green}arch-check: OK${C.off}`);
process.exit(failed ? 1 : 0);
