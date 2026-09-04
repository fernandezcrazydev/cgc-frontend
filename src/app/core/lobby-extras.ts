/**
 * Lo que el panel de convocatorias (`Roadmap.md` §5.5.6) enseña de cada jugador y el
 * DTO de convocatoria todavía no trae: su puesto en el ranking del grupo, su elo de
 * LoL y los últimos campeones que ha jugado.
 *
 * `LobbyParticipantResponse` solo manda identidad —`userId`, nombre de Discord,
 * avatar y hora de llegada—, porque el backend de convocatorias no sabe de ligas ni
 * de partidas. Mientras esos dos dominios no se crucen, esto se siembra a partir del
 * `userId`, que es estable: la misma persona enseña siempre el mismo escudo y el
 * mismo puesto, en esta pantalla y entre recargas.
 *
 * BACKEND NOTE: fichero PLACEHOLDER. Cuando el endpoint de convocatorias devuelva el
 * puesto y el elo de cada participante —o exista un endpoint de perfil por lote— se
 * borra entero y la vista lee esos campos del DTO. La forma de `LobbyPlayerExtras`
 * es la que se espera de ese contrato.
 */
import { LOL_TIERS, LolRankInfo, hash, lolRankInfo, seeded } from './group-ranking';
import { REAL_CHAMPION_IDS } from './lobby';

/** Los datos de adorno de una tarjeta de jugador en la sala. */
export interface LobbyPlayerExtras {
  /** Elo de LoL, con su escudo y su etiqueta accesible. */
  lolRank: LolRankInfo;
  /** Ids reales de ddragon de los últimos campeones jugados. */
  recentChampionIds: number[];
}

/** Cuántos campeones recientes caben en una tarjeta antes de robarle sitio al nombre. */
const RECENT_CHAMPIONS = 3;

/** Las cuatro divisiones dentro de un tier. */
const DIVISIONS = ['I', 'II', 'III', 'IV'];

/**
 * Un elo verosímil: la mayoría de la gente está por el medio de la escala, no en
 * Challenger. Se sortea sobre los siete tiers de abajo por eso mismo.
 */
const SEEDED_TIERS = LOL_TIERS.slice(3);

/** Los adornos de un participante: su elo y los campeones que más juega. */
export function lobbyExtrasFor(userId: string): LobbyPlayerExtras {
  const rnd = seeded(hash(userId + ':lobby-extras'));

  const pool = [...REAL_CHAMPION_IDS];
  const recentChampionIds: number[] = [];
  for (let i = 0; i < RECENT_CHAMPIONS && pool.length; i++) {
    recentChampionIds.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  }

  const tier = SEEDED_TIERS[Math.floor(rnd() * SEEDED_TIERS.length)];
  const division = DIVISIONS[Math.floor(rnd() * DIVISIONS.length)];

  return { lolRank: lolRankInfo(tier, division), recentChampionIds };
}

/**
 * Puestos en la clasificación del grupo para TODOS los de una sala, de golpe.
 *
 * Se resuelve en bloque y no jugador a jugador a propósito: sorteando el puesto de
 * cada uno por su cuenta salían dos «12.º» en la misma parrilla, que es una
 * clasificación que no puede existir. Ordenando a los participantes por una
 * puntuación estable y repartiendo 1, 2, 3… los puestos salen distintos por
 * construcción, y además el mismo grupo enseña siempre el mismo orden.
 */
export function lobbyRanksFor(userIds: readonly string[]): Map<string, number> {
  const ordered = [...new Set(userIds)].sort(
    (a, b) => seeded(hash(a + ':rank'))() - seeded(hash(b + ':rank'))(),
  );
  return new Map(ordered.map((id, i) => [id, i + 1]));
}
