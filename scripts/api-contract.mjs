#!/usr/bin/env node
/**
 * api-contract — trae el contrato del backend y lo convierte en tipos de TypeScript.
 *
 * El backend publica dos ficheros generados, y los commitea:
 *
 *   cgc-backend/http/openapi.json           → forma de cada endpoint (springdoc)
 *   cgc-backend/http/api-error-codes.json   → los `code` estables de error, con su status
 *
 * Los dos salen de un test del backend que falla si no describen lo que sirve el código, así que
 * leerlos del disco NO necesita el backend arrancado, ni Postgres, ni `env/local.env`. Esa es
 * justo la diferencia entre regenerar los tipos y no hacerlo nunca.
 *
 * Genera:
 *   src/app/core/http/api-types.d.ts        → paths, operations y schemas
 *   src/app/core/http/api-error-codes.ts    → el catálogo de codes, como union de TS
 *
 * Los dos van commiteados: `npm run build` no puede depender de que tengas el backend clonado.
 *
 * Uso:  npm run api:types
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BACKEND = join(ROOT, '..', 'cgc-backend', 'http');
const OUT = join(ROOT, 'src', 'app', 'core', 'http');

// Fijada a propósito: el generador decide la forma exacta de los tipos, así que una versión
// distinta mueve el fichero generado sin que haya cambiado la API.
const GENERATOR = 'openapi-typescript@7.13.0';

const spec = join(BACKEND, 'openapi.json');
const codes = join(BACKEND, 'api-error-codes.json');

for (const file of [spec, codes]) {
  if (!existsSync(file)) {
    console.error(`No encuentro ${file}.`);
    console.error('Este script espera cgc-backend clonado como hermano de cgc-frontend.');
    process.exit(1);
  }
}

// Rutas RELATIVAS y cwd en la raiz del repo: el path absoluto pasa por "Custom Game Creator",
// y con shell:true (obligatorio en Windows para resolver npx.cmd) un espacio parte el argumento
// en dos y el generador se queja de un fichero "d:\Repos\Custom" que no existe.
execFileSync('npx', ['-y', GENERATOR, '../cgc-backend/http/openapi.json', '-o', 'src/app/core/http/api-types.d.ts'], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const byCode = JSON.parse(readFileSync(codes, 'utf8'));
const entries = Object.entries(byCode)
  .map(([code, status]) => `  ${code}: ${status},`)
  .join('\n');

writeFileSync(
  join(OUT, 'api-error-codes.ts'),
  `/**
 * Generado por \`npm run api:types\` desde cgc-backend/http/api-error-codes.json.
 * NO editar a mano: el backend es el dueño de estos códigos.
 *
 * El valor es el status HTTP con el que sale cada uno, útil solo para entender de qué tipo de
 * error hablamos. Lo que importa es la clave: \`ApiErrorCode\` es la lista cerrada de códigos que
 * el backend puede devolver, y tipar el catálogo de traducciones contra ella hace que un código
 * renombrado allí sea un error de compilación aquí, en vez de un mensaje genérico en producción.
 */
export const API_ERROR_CODES = {
${entries}
} as const;

export type ApiErrorCode = keyof typeof API_ERROR_CODES;
`,
  'utf8',
);

console.log(`✓ api-types.d.ts y api-error-codes.ts (${Object.keys(byCode).length} códigos)`);
