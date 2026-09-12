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

/**
 * El CSS que un componente escribe en `styles: [\`…\`]` (o `styles: \`…\``) dentro de su `.ts`.
 *
 * Es CSS del proyecto igual que una hoja, pero durante un tiempo no lo vio NINGUNA regla:
 * ni `css-total-size`, ni `dead-css`, ni el presupuesto por hoja de `angular.json`. El
 * efecto perverso era que sacar CSS de un `.ts` a su `.scss` —que es justo lo que pide la
 * guía— salía en el diff como un empeoramiento de cien y pico líneas, y dejarlo escondido
 * salía gratis. Un contador que premia esconder mide lo contrario de lo que dice medir.
 *
 * Solo lo consume `css-total-size`; `dead-css` y las reglas de tipografía siguen ciegas a
 * este CSS, y esa es deuda anotada, no una decisión.
 */
const inlineCss = (src) => {
  const out = [];
  const re = /styles:\s*(\[|`)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1] === '`') {
      const open = re.lastIndex - 1;
      const end = src.indexOf('`', open + 1);
      if (end === -1) break;
      out.push(src.slice(open + 1, end));
      re.lastIndex = end + 1;
      continue;
    }
    // Forma de array: van cayendo literales hasta el `]` que lo cierra. Un `]` dentro del
    // CSS (`a[hidden]`) no confunde, porque para entonces ya se consumió con su literal.
    let i = re.lastIndex;
    for (;;) {
      const tick = src.indexOf('`', i);
      const close = src.indexOf(']', i);
      if (tick === -1 || (close !== -1 && close < tick)) break;
      const end = src.indexOf('`', tick + 1);
      if (end === -1) break;
      out.push(src.slice(tick + 1, end));
      i = end + 1;
    }
    re.lastIndex = i;
  }
  return out;
};

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
      const lines = (css) => stripComments(css).split('\n').filter((l) => l.trim()).length;

      let n = pick('.scss', '.css').reduce((s, f) => s + lines(f.read()), 0);
      // Y el CSS escondido en `styles: [...]` de los `.ts`: si no contara, sacar una hoja de
      // su componente —lo que pide la guía— saldría en el diff como un empeoramiento.
      for (const f of pick('.ts')) {
        if (isSpec(f)) continue;
        n += inlineCss(f.read()).reduce((s, css) => s + lines(css), 0);
      }
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
    id: 'adblock-bait',
    title: 'Clases con nombre que los bloqueadores de anuncios ocultan por su cuenta',
    /**
     * EasyList —la lista por defecto de uBlock Origin, AdBlock Plus y AdGuard— trae ~8.800
     * reglas cosméticas GENÉRICAS del tipo `##.clase`: sin dominio que las acote, aplican
     * `display:none !important` a ese nombre de clase en CUALQUIER página. Dos de ellas,
     * `##.ad-card` y `##.ad-grid`, eran exactamente las clases del directorio de
     * administración, y esa pantalla se veía vacía en el navegador de cualquiera que usara
     * un bloqueador. El DOM estaba, el guard pasaba, no había error en consola: nada que
     * mirar, solo un hueco. Es invisible en desarrollo y silencioso en producción, así que
     * no se descubre dos veces por casualidad.
     *
     * Se mira la CABEZA del nombre (el bloque BEM), que es donde está el riesgo real: las
     * reglas de EasyList casan el nombre EXACTO, así que `gp-banner` es seguro y `banner`
     * no lo es. Validado contra la lista real: el patrón captura 3.810 de sus 8.841 clases
     * genéricas, y de las que este repo usaba no se le escapó ninguna.
     *
     * Para reauditar contra la lista viva el día que se dude, cruza las clases del repo con:
     *   curl -s https://easylist.to/easylist/easylist.txt | grep -oE "^##[.][a-zA-Z0-9_-]+$"
     */
    run() {
      const BAIT =
        /^(ad|ads|adv|advert|adverts|advertisement|advertising|banner|banners|sponsor|sponsors|sponsored|sponsorship|promo|promotion|popunder)([-_]|$)/;
      const out = [];
      for (const f of pick('.ts', '.html', '.scss', '.css')) {
        if (isSpec(f) || !f.path.startsWith('src/')) continue;
        const isSheet = f.path.endsWith('.scss') || f.path.endsWith('.css');
        stripComments(f.read()).split('\n').forEach((line, i) => {
          const names = new Set();
          for (const m of line.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) names.add(c);
          for (const m of line.matchAll(/\[class\.([a-zA-Z][\w-]*)\]/g)) names.add(m[1]);
          if (isSheet) for (const m of line.matchAll(/\.([a-zA-Z][\w-]*)/g)) names.add(m[1]);
          for (const c of names) if (BAIT.test(c)) out.push(hit(f.path, i + 1, `.${c} la ocultan los bloqueadores`));
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
  {
    id: 'emoji-free',
    title: 'Nada de emojis en la interfaz: los iconos son SVG inline con currentColor',
    run() {
      // El criterio no es "cualquier simbolo raro": son los PICTOGRAMAS DE COLOR que pinta el
      // sistema operativo, que cambian de aspecto entre Windows/macOS/Android, no obedecen a
      // `currentColor` ni a los tokens `--nf-*`, y no pegan opticamente con el resto.
      // `Emoji_Presentation` los identifica exactamente; U+FE0F es la variante que fuerza a
      // color un glifo de texto. Por eso `v`, `*`, el caret y el separador NO caen aqui: son
      // caracteres tipograficos que la app usa a proposito, y `⚠` a secas tampoco (solo `⚠` + FE0F).
      //
      // Excepciones por diseno: donde el emoji es EL CONTENIDO que escribe el usuario, no
      // decoracion de la interfaz (el selector, las reacciones a comentarios y partidas, y el
      // catalogo de estados de animo del feedback).
      const EXEMPT = [
        'src/app/ui/emoji-picker/',
        'src/app/core/reactions/',
        'src/app/core/feedback/models.ts',
      ];
      const PICTOGRAM = /\p{Emoji_Presentation}|\uFE0F/u;
      const out = [];
      for (const f of pick('.ts', '.html')) {
        if (isSpec(f) || EXEMPT.some((e) => f.path.startsWith(e))) continue;
        f.read().split('\n').forEach((line, i) => {
          const m = line.match(PICTOGRAM);
          if (m) out.push(hit(f.path, i + 1, `emoji ${m[0]} → usa un <svg> inline con currentColor`));
        });
      }
      return out;
    },
  },
  {
    id: 'legacy-angular',
    title: 'Angular antiguo: @Input()/@Output()/EventEmitter en vez de input()/output()/model()',
    run() {
      const out = [];
      for (const f of pick('.ts')) {
        if (isSpec(f)) continue;
        stripComments(f.read()).split('\n').forEach((line, i) => {
          const m = line.match(/@Input\(|@Output\(|new EventEmitter/);
          if (m) out.push(hit(f.path, i + 1, `${m[0]}...) → input()/output()/model()`));
        });
      }
      return out;
    },
  },
  {
    id: 'onpush',
    title: 'Todo componente lleva ChangeDetectionStrategy.OnPush',
    unit: 'componentes',
    run() {
      const out = [];
      for (const f of pick('.ts')) {
        if (isSpec(f)) continue;
        const src = stripComments(f.read());
        if (!src.includes('@Component')) continue;
        if (src.includes('ChangeDetectionStrategy.OnPush')) continue;
        const line = src.split('\n').findIndex((l) => l.includes('@Component')) + 1;
        out.push(hit(f.path, line, 'sin changeDetection: ChangeDetectionStrategy.OnPush'));
      }
      return out;
    },
  },
  {
    id: 'ng-deep',
    title: '::ng-deep es API muerta: expon una custom property en la primitiva',
    run() {
      // La encapsulacion de tu hoja no alcanza a los hijos internos de un `nf-*`. La salida no es
      // perforarla: es que la primitiva declare una custom property y la vista la fije sobre el
      // host, que si heredan a traves de la frontera (ver nf-pagination.scss).
      const out = [];
      for (const f of pick('.scss', '.css', '.ts', '.html')) {
        stripComments(f.read()).split('\n').forEach((line, i) => {
          if (line.includes('::ng-deep'))
            out.push(hit(f.path, i + 1, '::ng-deep → custom property sobre el host'));
        });
      }
      return out;
    },
  },
  {
    id: 'toast-literal',
    title: 'toasts.error() con string fija en vez de errorMessage(e) de core/http',
    run() {
      // `catch { toasts.error('No se pudo...') }` se traga el error real y le dice al usuario
      // siempre lo mismo. El catalogo `code → mensaje` vive en MESSAGES_BY_CODE
      // (core/http/api-error.ts) y es el unico sitio donde se escribe ese texto.
      const out = [];
      for (const f of pick('.ts')) {
        if (isSpec(f)) continue;
        stripComments(f.read()).split('\n').forEach((line, i) => {
          if (/toasts?\.error\(\s*['"`]/.test(line))
            out.push(hit(f.path, i + 1, "toasts.error('...') → toasts.error(errorMessage(e))"));
        });
      }
      return out;
    },
  },
  {
    id: 'route-title',
    title: 'Toda ruta con vista propia declara `title`; si no, la pestaña del navegador se queda muda',
    run() {
      // Una ruta de LAYOUT no rotula: rotula el hijo, que es quien pinta. Por eso `app` y
      // `jugador/:playerId` (que envuelve el cruce y tiene un hijo `path: ''` con su titulo)
      // no cuentan aqui. Un `redirectTo` tampoco pinta nada.
      const f = pick('.ts').find((x) => x.path === 'src/app/app.routes.ts');
      if (!f) return [];
      const src = f.read();
      const out = [];
      const rutas = [];
      const re = /path:\s*'([^']*)'/g;
      let m;
      while ((m = re.exec(src))) rutas.push({ path: m[1], at: m.index });
      rutas.forEach((r, i) => {
        const trozo = src.slice(r.at, i + 1 < rutas.length ? rutas[i + 1].at : src.length);
        if (/redirectTo:/.test(trozo)) return;
        if (/children:\s*\[/.test(trozo)) return;
        if (!/loadComponent:|component:/.test(trozo)) return;
        if (/title:/.test(trozo)) return;
        out.push(hit(f.path, src.slice(0, r.at).split('\n').length, `ruta '${r.path}' sin title`));
      });
      return out;
    },
  },
  {
    id: 'nav-label',
    title: 'La barra superior sabe rotular todo segmento de ruta (ROUTE_TITLES de shell-nav.ts)',
    run() {
      // Comprobacion a nivel de SEGMENTO, no de patron completo: es mas laxa, pero no da falsos
      // positivos con las rutas anidadas y caza igual la clase de fallo que importa —una pantalla
      // nueva cuyo segmento nadie dio de alta, y que por tanto la cabecera rotula como
      // "Pagina no encontrada" aunque la ruta funcione—. Le paso `reparto` una vez.
      const rutas = pick('.ts').find((x) => x.path === 'src/app/app.routes.ts');
      const nav = pick('.ts').find((x) => x.path === 'src/app/features/shell/shell-nav.ts');
      if (!rutas || !nav) return [];
      const src = rutas.read();
      const conocidos = new Set(
        [...nav.read().matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]),
      );
      // `pageTitleFor` devuelve el titulo por defecto para todo lo que no cuelga de `/app`, asi
      // que el login y el callback de OIDC quedan fuera por definicion, no por excepcion.
      const appAt = src.indexOf("path: 'app'");
      const out = [];
      const encontradas = [];
      const re = /path:\s*'([^']*)'/g;
      let m;
      while ((m = re.exec(src))) encontradas.push({ path: m[1], at: m.index });
      encontradas.forEach((r, i) => {
        if (appAt < 0 || r.at <= appAt) return; // fuera del shell no hay barra que rotular
        const trozo = src.slice(r.at, i + 1 < encontradas.length ? encontradas[i + 1].at : src.length);
        if (/redirectTo:/.test(trozo)) return; // el destino es quien se rotula
        for (const seg of r.path.split('/')) {
          if (!seg || seg.startsWith(':') || seg === '**' || conocidos.has(seg)) continue;
          out.push(
            hit(rutas.path, src.slice(0, r.at).split('\n').length, `'${seg}' no lo rotula shell-nav.ts`),
          );
        }
      });
      return out;
    },
  },
  {
    id: 'theme-tokens',
    title: 'Un token de COLOR nuevo se decide en todas las skins, no solo en la de por defecto',
    run() {
      // Si una skin no redefine un token, hereda el de `:root` — no se rompe, pero se pinta con un
      // color afinado para otra paleta y nadie se entera hasta que abre el otro tema. Quedan fuera
      // los que NO son de paleta: la marca de Riot es roja en los dos temas, y sombras y luces
      // derivan de `--nf-shadow-color`, que si esta tematizado.
      const EXENTOS = ['--nf-brand-', '--nf-shadow-', '--nf-edge-'];
      const ES_COLOR = /^\s*(#|rgb|hsl|color-mix)/;
      const declarados = (f) =>
        new Map([...f.read().matchAll(/(--nf-[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2]]));

      const base = new Map();
      for (const f of pick('.css')) {
        if (!f.path.startsWith('src/styles/tokens/')) continue;
        for (const [k, v] of declarados(f)) base.set(k, { v, file: f });
      }
      const skins = pick('.css').filter((f) => f.path.startsWith('src/styles/themes/'));
      const out = [];
      for (const skin of skins) {
        const tiene = declarados(skin);
        for (const [token, { v, file }] of base) {
          if (!ES_COLOR.test(v)) continue;
          if (EXENTOS.some((p) => token.startsWith(p))) continue;
          if (tiene.has(token)) continue;
          const linea = file.read().split('\n').findIndex((l) => l.includes(token + ':')) + 1;
          out.push(hit(file.path, linea, `${token} no lo decide ${skin.path.split('/').pop()}`));
        }
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
