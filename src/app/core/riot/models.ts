/**
 * Cuenta de League of Legends vinculada al perfil. Contrato de
 * `GET|PUT|DELETE /api/v1/me/riot-account`.
 *
 * La vinculación es **declarativa**: el backend no puede comprobar que la cuenta sea del
 * usuario (haría falta RSO, el OAuth de Riot). Por eso `verified` existe y hoy siempre es
 * `false` — el día que entre RSO, el flag cambia en el servidor y el aviso del diálogo se
 * puede retirar sin tocar el contrato.
 */
export interface RiotAccount {
  /** Riot ID completo, `Nombre#TAG`. Lo que se pinta y lo que se pasa a op.gg. */
  riotId: string;
  gameName: string;
  tagLine: string;
  region: RiotRegion;
  verified: boolean;
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
