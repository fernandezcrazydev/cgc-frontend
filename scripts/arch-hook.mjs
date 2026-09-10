#!/usr/bin/env node
/**
 * Hook PostToolUse: ejecuta el trinquete de arquitectura tras cada edición de código.
 *
 * Por qué existe: `npm run arch` verifica quince reglas de `cgc-frontend/CLAUDE.md` en menos de
 * un segundo. Ejecutarlo aquí, en el momento de editar, hace que un incumplimiento vuelva al
 * agente en el acto y se arregle en la misma vuelta. La alternativa —descubrirlo al revisar el
 * diff más tarde— cuesta una sesión entera y es justo lo que esta configuración viene a evitar.
 *
 * Sale con código 2 cuando el trinquete falla: es el código que devuelve el mensaje al agente.
 * Ante cualquier otro problema (fichero que no es código, JSON raro, repo ausente) sale con 0 y
 * calla, porque un hook que bloquea por su cuenta es peor que no tener hook.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const CODIGO = /\.(ts|scss|css|html)$/i;

const leerEntrada = () =>
  new Promise((listo) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => (buf += d));
    process.stdin.on('end', () => listo(buf));
    // Si nadie escribe en stdin, no nos quedamos colgados.
    setTimeout(() => listo(buf), 2000).unref?.();
  });

const entrada = await leerEntrada();

let fichero = '';
try {
  const json = JSON.parse(entrada);
  fichero = json?.tool_response?.filePath || json?.tool_input?.file_path || '';
} catch {
  process.exit(0);
}

if (!CODIGO.test(fichero)) process.exit(0);

/**
 * Localiza `cgc-frontend` subiendo desde el fichero editado. Es la única forma que funciona con
 * los dos CLIs: Claude se lanza desde `main/` y Gemini desde `cgc-frontend/`, así que resolver
 * contra el directorio de trabajo acierta con uno y falla en silencio con el otro.
 */
const buscarFront = (desde) => {
  let dir = dirname(resolve(desde));
  for (let i = 0; i < 12 && dir !== dirname(dir); i++) {
    if (existsSync(join(dir, 'scripts', 'arch-check.mjs'))) return dir;
    dir = dirname(dir);
  }
  // Reserva: desde la raíz del proyecto, si el CLI la exporta.
  const raiz = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  for (const c of [join(raiz, 'cgc-frontend'), raiz]) {
    if (existsSync(join(c, 'scripts', 'arch-check.mjs'))) return c;
  }
  return null;
};

const front = buscarFront(fichero);
if (!front) process.exit(0);
const check = join(front, 'scripts', 'arch-check.mjs');

// Se llama al script directamente en vez de a `npm run arch`: hace lo mismo y se ahorra el
// arranque de npm, que es más lento que el propio check.
const r = spawnSync(process.execPath, [check], { cwd: front, encoding: 'utf8' });

if (r.status === 0) process.exit(0);

// Se quitan las reglas que van bien: el agente solo necesita ver lo que ha roto.
const salida = `${r.stdout || ''}${r.stderr || ''}`
  .replace(/\x1b\[[0-9;]*m/g, '')
  .split('\n')
  .filter((l) => !/^v /.test(l))
  .join('\n')
  .trim();
// El check lista hasta doce incumplimientos por regla, y la mayoría son deuda vieja ya anotada en
// el presupuesto: el fichero recién editado puede no aparecer en la lista aunque sea la causa.
// Por eso se nombra explícitamente, y si alguna línea sí lo señala, se pone delante.
const relativo = relative(front, resolve(fichero)).replace(/\\/g, '/');
const propias = relativo ? salida.split('\n').filter((l) => l.includes(relativo)) : [];

console.error(
  `El trinquete de arquitectura falla tras editar ${relativo || fichero}. Lo que ha empeorado lo ` +
    'has metido tú: arregla el código, y no subas ningún presupuesto de ' +
    'scripts/arch-budgets.json.\n\n' +
    (propias.length ? `Señalando tu fichero:\n${propias.join('\n')}\n\n` : '') +
    'Detalle (la lista de cada regla se recorta a doce y arrastra deuda anterior; lo que cuenta ' +
    'es la línea «has empeorado esta regla en N»):\n\n' +
    salida,
);
process.exit(2);
