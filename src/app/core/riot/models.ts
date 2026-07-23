/**
 * Escalera de evidencia de una cuenta de Riot (contrato con el backend, `RiotAccount.strength`).
 * De menos a más fuerte:
 *
 * - `DECLARED`: el usuario tecleó el Riot ID en la web. No prueba nada.
 * - `PAIRED`: la app de escritorio leyó el `puuid` de un cliente de League vivo. Prueba
 *   procedencia, no titularidad — la evidencia la da nuestro propio cliente.
 * - `VERIFIED`: el usuario puso un icono que sorteó el servidor y el servidor lo comprobó contra
 *   Riot. Lo único que prueba titularidad.
 *
 * El usuario nunca ve tres pasos: hay dos acciones (teclear, o "conectar con la app", que empareja
 * y verifica de una). Estos son estados del dato.
 */
export type RiotLinkStrength = 'DECLARED' | 'PAIRED' | 'VERIFIED';

/**
 * Cuenta de League of Legends vinculada al perfil. Contrato de
 * `GET|PUT|DELETE /api/v1/me/riot-account`.
 */
export interface RiotAccount {
  /** Riot ID completo, `Nombre#TAG`. Lo que se pinta y lo que se pasa a op.gg. */
  riotId: string;
  gameName: string;
  tagLine: string;
  region: RiotRegion;
  /** Peldaño de la escalera; el chip del perfil conmuta sobre esto. */
  strength: RiotLinkStrength;
  /** Instante en que se probó la titularidad (ISO-8601), o null si aún no está verificada. */
  verifiedAt: string | null;
  /** ISO-8601 tal cual lo manda el backend: formatear es cosa de la vista. */
  linkedAt: string;
}

/**
 * Estado completo del bloque de Riot del perfil, en una sola llamada.
 *
 * No tener cuenta **no es un error**: es el estado normal de quien nunca vinculó, y por eso el
 * backend responde 200 con `account: null` en vez de un 404.
 *
 * `relinkAvailableAt` solo viene cuando el usuario desvinculó hace poco: hasta ese instante no
 * puede vincular una cuenta **distinta** (sí la misma que acaba de quitar). Existe para poder
 * pintar la cuenta atrás sin leer el `detail` del error.
 */
export interface RiotAccountStatus {
  account: RiotAccount | null;
  relinkAvailableAt: string | null;
}

/** Las regiones que acepta el backend (`RiotRegion` del dominio). El orden es el del desplegable. */
export const RIOT_REGIONS = [
  'EUW',
  'EUNE',
  'NA',
  'LAN',
  'LAS',
  'BR',
  'KR',
  'OCE',
  'TR',
  'RU',
  'JP',
  'SEA',
] as const;

export type RiotRegion = (typeof RIOT_REGIONS)[number];

/** Lo que manda el diálogo al vincular. El backend parte y valida el `riotId`. */
export interface LinkRiotAccountRequest {
  riotId: string;
  region: RiotRegion;
}
