/**
 * Presentación de la clasificación de un grupo: traduce las filas que sirve el backend
 * (`LeaderboardEntryResponse`) a lo que pinta la vista.
 *
 * Aquí ya no se inventa nada. Este fichero contenía `rankingFor()`, un generador determinista que
 * fabricaba 24 jugadores con LP, winrate, rachas, sanciones e historial completo, y la vista caía a
 * él en cuanto la liga venía vacía o la petición fallaba. Es decir: tres estados distintos
 * —cargando, error y liga sin partidas— acababan pintados como "aquí hay una competición en
 * marcha", con nombres de compañeros que no existen en el grupo. Se borró entero, junto con
 * `ranking-matches.ts`, que hacía lo mismo con el historial de cada jugador.
 *
 * Lo que el backend todavía no sirve se marca como **ausente** (`null`), nunca se rellena con un
 * valor plausible: la vista tiene que poder decir "aún no" en vez de enseñar un dato falso.
 */
import { NfLane } from '../ui/lane-icon/nf-lane-icon';
import { LeaderboardEntryResponse } from './leagues';
import { opggUrl } from './member-detail';

export type LolTier =
  | 'CHALLENGER' | 'GRANDMASTER' | 'MASTER' | 'DIAMOND' | 'EMERALD'
  | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'IRON';

export interface LolRankInfo {
  tier: LolTier;
  /**
   * Etiqueta legible ("SoloQ: Diamante II"). No se pinta como texto suelto: es el nombre
   * accesible del escudo (`title`/`alt` de `nf-rank-emblem`).
   */
  label: string;
  color: string;
}

/**
 * Nombre visible y color de CADA tier, los diez.
 *
 * Un `Record` completo y no una lista suelta porque faltar aquí no degradaba, mentía: la versión
 * anterior validaba `riotTier` contra una lista de siete y todo lo que no encajaba caía al `GOLD`
 * por defecto, así que un jugador de Hierro lucía escudo de Oro. `NfRankEmblem` ya soportaba los
 * diez y los SVG ya estaban en `public/assets/ranks/`; el que los recortaba era este lado. Con un
 * `Record` el compilador avisa si algún día se añade un tier.
 */
const TIER_META: Record<LolTier, { label: string; color: string }> = {
  CHALLENGER:  { label: 'Challenger',  color: '#3fbfdd' },
  GRANDMASTER: { label: 'Grandmaster', color: '#e43e3e' },
  MASTER:      { label: 'Master',      color: '#9d48e0' },
  DIAMOND:     { label: 'Diamante',    color: '#5aa9e6' },
  EMERALD:     { label: 'Esmeralda',   color: '#00b894' },
  PLATINUM:    { label: 'Platino',     color: '#00cec9' },
  GOLD:        { label: 'Oro',         color: '#cd8837' },
  SILVER:      { label: 'Plata',       color: '#95a5a6' },
  BRONZE:      { label: 'Bronce',      color: '#a1683a' },
  IRON:        { label: 'Hierro',      color: '#6b5f5a' },
};

/** Los diez tiers, del más alto al más bajo. */
export const LOL_TIERS = Object.keys(TIER_META) as LolTier[];

/**
 * Construye la ficha de elo de un tier. Existe para que nadie tenga que repetir los
 * nombres en español ni los colores de los diez tiers: `TIER_META` es la única
 * lista, y quien la necesite pasa por aquí.
 */
export function lolRankInfo(tier: LolTier, division?: string | null): LolRankInfo {
  const meta = TIER_META[tier];
  // La división es un numeral romano y va tal cual; el tier se pinta con su nombre
  // en español, no con el enum del backend, que llegaría como "BRONZE".
  const label = division ? `SoloQ: ${meta.label} ${division}` : `SoloQ: ${meta.label}`;
  return { tier, label, color: meta.color };
}

/**
 * Una fila de la clasificación, ya lista para pintar.
 *
 * Los campos que pueden ser `null` no son opcionales por comodidad: significan **"el servidor
 * todavía no tiene este dato"**, y la vista los pinta con su estado "sin datos". No se rellenan
 * con ceros ni con valores intermedios, porque el usuario lee eso como un dato real.
 */
export interface RankEntry {
  /** Id estable del backend (`userId`). Clave de `@for ... track` y del acordeón. */
  playerId: string;
  /** Puesto oficial en la liga. No se recalcula al reordenar la tabla. */
  rank: number;
  /** Nombre de juego del Riot ID si la cuenta está vinculada; si no, el de Discord. */
  name: string;
  /**
   * Tagline del Riot ID (`EUW`, `KR1`), o `null` sin cuenta vinculada.
   *
   * Antes esto era la REGIÓN inventada en la rama mock y el tagline real en la del servidor: la
   * misma etiqueta significando dos cosas distintas en la misma tabla.
   */
  tag: string | null;
  initials: string;
  /** Tinte del avatar de reserva. Es presentación derivada del id, no un dato de dominio. */
  hue: number;
  avatar: string | null;
  lpValue: number;
  formattedLp: string;
  wins: number;
  losses: number;
  totalGames: number;
  /** Winrate en porcentaje, redondeado. */
  wr: number;
  /** Rango real de Riot, o `null` si la cuenta no está vinculada o no tiene ranked. */
  lolRank: LolRankInfo | null;
  streakCount: number;
  streakType: 'WIN' | 'LOSS';
  /**
   * Rango del jugador EN EL GRUPO, tal cual lo manda el servidor (`OWNER` / `ADMIN` / `MEMBER`).
   * Es lo que permite decidir a quién puede expulsar quien mira, sin cruzar con otra fuente.
   */
  groupRole: string | null;
  banned: boolean;
  /**
   * Motivo real de la sanción, del servidor. `null` si el jugador no está sancionado.
   *
   * Antes era una constante del cliente igual para todo el mundo, porque no había ningún motivo
   * guardado: la etiqueta «Baneado» se pintaba sin nada detrás.
   */
  banReason: string | null;
  /** Cuándo termina la sanción. `null` = indefinida, hay que levantarla a mano. */
  bannedUntil: string | null;
  /** Enlace a OP.GG, o `null` sin Riot ID: sin él no hay perfil al que enlazar. */
  opggUrl: string | null;
  /** Trofeo del podio activo. Un sancionado nunca lo luce. */
  trophyImg: string | null;

  /**
   * Polilínea SVG de la evolución de LP, o `null` si no hay histórico que dibujar.
   *
   * Hacen falta al menos dos puntos: con uno solo no hay línea, solo un punto, y una raya plana
   * dibujada sobre un único movimiento sugeriría una estabilidad que nadie ha medido.
   */
  sparkPath: string | null;
  /** Dirección de la serie, para el color. `null` cuando no hay serie. */
  trend: 'up' | 'down' | null;
  /** Media real de LP ganados / perdidos. `null` = todavía no hay partidas de ese signo. */
  avgLpGain: number | null;
  avgLpLoss: number | null;

  // --- Sin fuente de datos todavía: llegan con la subida de partidas ---
  /** Rol principal, deducido del historial de picks. `null` = aún no se sabe. */
  lane: NfLane | null;
  /** Campeón más jugado. `null` = aún no se sabe. */
  mainChampionId: number | null;
}

/** Tiny seeded PRNG (mulberry32), estable entre renders. */
export function seeded(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash de una cadena a una semilla estable de 32 bits. */
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Serie de puntos a una polilínea SVG dentro de `w`×`h`. */
export function sparkPoints(spark: number[], w = 120, h = 32): string {
  if (spark.length < 2) return '';
  const min = Math.min(...spark);
  const max = Math.max(...spark);
  const span = max - min || 1;
  const pad = 3;
  const stepX = (w - pad * 2) / (spark.length - 1);
  return spark
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - (v - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * Rango de Riot de una fila, o `null` si no hay ninguno que enseñar.
 *
 * Antes esto no podía devolver `null`: sin `riotTier` derivaba un tier a partir del LP de la liga
 * custom, que es otra escala y otro juego, y lo pintaba como si fuese el rango de SoloQ del
 * jugador. Alguien sin cuenta vinculada salía con escudo de Oro.
 */
function lolRankOf(entry: LeaderboardEntryResponse): LolRankInfo | null {
  if (!entry.riotTier) return null;

  const tier = entry.riotTier.toUpperCase() as LolTier;
  if (!LOL_TIERS.includes(tier)) return null;

  return lolRankInfo(tier, entry.riotRank);
}

/** Mapea las filas que sirve el backend a lo que consume la vista. */
export function mapLeaderboardEntries(entries: readonly LeaderboardEntryResponse[]): RankEntry[] {
  return entries.map((entry) => {
    const riotId = entry.riotId ?? '';
    const hasRiotId = riotId.includes('#');
    const [gameName, tagLine] = hasRiotId ? riotId.split('#') : [entry.discordUsername, null];

    return {
      playerId: entry.userId,
      rank: entry.rank,
      name: gameName,
      tag: tagLine,
      initials: entry.discordUsername.slice(0, 2).toUpperCase(),
      hue: hash(entry.userId) % 360,
      avatar: entry.avatarUrl,
      lpValue: entry.lp,
      formattedLp: `${entry.lp.toLocaleString('es-ES')} LP`,
      wins: entry.wins,
      losses: entry.losses,
      totalGames: entry.totalGames,
      wr: Math.round(entry.winrate),
      lolRank: lolRankOf(entry),
      streakCount: entry.streakCount,
      streakType: entry.streakType,
      groupRole: entry.groupRole,
      banned: entry.isBanned,
      banReason: entry.banReason,
      bannedUntil: entry.bannedUntil,
      opggUrl: hasRiotId ? opggUrl(riotId) : null,
      trophyImg: entry.rank <= 3 && !entry.isBanned ? `/assets/trofeos/Trofeo${entry.rank}.webp` : null,

      // Serie real del ledger de LP. Hacen falta dos puntos para que haya línea que dibujar.
      sparkPath: entry.lpHistory.length >= 2 ? sparkPoints(entry.lpHistory, 100, 28) : null,
      trend: trendOf(entry.lpHistory),
      avgLpGain: entry.avgLpGain,
      avgLpLoss: entry.avgLpLoss,

      // Pendientes de la subida de partidas. `null`, nunca un valor de relleno.
      lane: null,
      mainChampionId: null,
    };
  });
}

/**
 * Si la serie sube o baja, comparando el primer punto con el último.
 *
 * Se deriva de la SERIE, no de la racha actual. La versión anterior usaba `streakType`, así que
 * alguien que había subido doscientos LP en la temporada y acababa de perder una partida salía con
 * la tendencia hacia abajo: la racha describe la última partida, la tendencia describe el recorrido.
 */
function trendOf(lpHistory: readonly number[]): 'up' | 'down' | null {
  if (lpHistory.length < 2) return null;
  return lpHistory[lpHistory.length - 1] >= lpHistory[0] ? 'up' : 'down';
}
