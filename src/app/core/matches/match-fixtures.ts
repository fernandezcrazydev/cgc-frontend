/**
 * Constructores de partidas para las pruebas.
 *
 * Solo lo usan los `*.spec.ts`: ningún código de producción lo importa, así que no entra en el
 * bundle. Vive aquí y no dentro de un spec porque varias pruebas —el mapeo, el cruce y las
 * vistas del historial— necesitan exactamente las mismas partidas mínimas, y tener el mismo
 * constructor copiado tres veces garantiza que dos de las copias se queden atrás en cuanto el
 * modelo cambie.
 *
 * Los valores por defecto describen una partida **subida y con lados decididos**, que es el
 * caso normal. Los dos casos que el contrato obliga a tratar aparte se piden explícitamente:
 * `hasStats: false` (sin subida) y `sided: false` (la sala nunca eligió color).
 */
import {
  GroupHistorySummary,
  Match,
  MatchParticipant,
  ParticipantStats,
  PersonalHistorySummary,
  TeamSide,
  TeamSlot,
  TeamSummary,
} from './models';

export function participantFixture(
  over: Partial<MatchParticipant> & { userId: string; slot: TeamSlot },
): MatchParticipant {
  return {
    riotId: 'Jugador#LAN',
    discordUsername: 'Jugador',
    avatarUrl: null,
    side: over.slot === 'A' ? 'blue' : 'red',
    role: 'MID',
    championId: 1,
    wasAutofill: false,
    lpDelta: 0,
    stats: statsFixture(),
    ...over,
  };
}

export function statsFixture(over: Partial<ParticipantStats> = {}): ParticipantStats {
  return {
    kills: 2,
    deaths: 2,
    assists: 2,
    gold: 10000,
    cs: 100,
    damageToChampions: 10000,
    damageTaken: 10000,
    visionScore: 10,
    ...over,
  };
}

/** Un asiento sin subida: solo lo que la app repartió y lo que movió en la clasificación. */
export function bareParticipantFixture(
  over: Partial<MatchParticipant> & { userId: string; slot: TeamSlot },
): MatchParticipant {
  return {
    riotId: null,
    // Sin subida no hay Riot ID, pero el nombre de Discord llega siempre: es lo que permite
    // nombrar los diez asientos de una partida que nadie exportó.
    discordUsername: 'Jugador',
    avatarUrl: null,
    side: null,
    role: 'MID',
    championId: null,
    wasAutofill: false,
    lpDelta: 12,
    stats: {},
    ...over,
  };
}

function teamFixture(
  slot: TeamSlot,
  side: TeamSide | null,
  won: boolean,
  participants: MatchParticipant[],
  hasStats: boolean,
): TeamSummary {
  return {
    slot,
    side,
    won,
    totalKills: hasStats ? 20 : null,
    totalGold: hasStats ? 50000 : null,
    participants: participants.map((p) => ({ ...p, slot, side })),
  };
}

export function matchFixture(over: {
  id: string;
  groupId?: string;
  groupName?: string;
  decidedAt?: string;
  durationSeconds?: number | null;
  /** El hueco ganador. Siempre existe si la partida terminó. */
  winningSlot?: TeamSlot | null;
  /** `false` = la sala nunca decidió lados, así que no hay azul ni rojo. */
  sided?: boolean;
  hasStats?: boolean;
  voided?: boolean;
  a: MatchParticipant[];
  b: MatchParticipant[];
  userParticipant?: MatchParticipant;
  mvpUserId?: string | null;
}): Match {
  const winningSlot = over.winningSlot === undefined ? 'A' : over.winningSlot;
  const sided = over.sided !== false;
  const hasStats = over.hasStats !== false;
  const groupId = over.groupId ?? 'g1';
  const user = over.userParticipant;

  const teams = [
    teamFixture('A', sided ? 'blue' : null, winningSlot === 'A', over.a, hasStats),
    teamFixture('B', sided ? 'red' : null, winningSlot === 'B', over.b, hasStats),
  ] as const;

  const match: Match = {
    id: over.id,
    groupId,
    group: {
      id: groupId,
      name: over.groupName ?? 'LAN Challenger',
      initials: 'LC',
      color1: '#000',
      color2: '#111',
    },
    hasStats,
    voided: over.voided === true,
    preset: 'BALANCED',
    durationSeconds: over.durationSeconds === undefined ? 1800 : over.durationSeconds,
    decidedAt: over.decidedAt ?? '2026-06-23T21:00:00Z',
    winningSlot,
    winningSide: !sided || !winningSlot ? null : winningSlot === 'A' ? 'blue' : 'red',
    teams,
    mvpUserId: over.mvpUserId ?? null,
    aceUserId: null,
    leagueId: null,
    leagueName: null,
  };

  if (user) {
    const seat = [...teams[0].participants, ...teams[1].participants].find(
      (p) => p.userId === user.userId,
    );
    match.userParticipant = seat ?? user;
    match.userOutcome = match.voided
      ? 'cancelled'
      : (seat ?? user).slot === winningSlot
        ? 'win'
        : 'loss';
  }

  return match;
}

/**
 * Un doble de `MatchHistoryStore` para las pruebas de las vistas.
 *
 * Existe porque el store real habla por HTTP y tiene cinco superficies; una vista que solo pinta
 * una lista no debería tener que montar `HttpTestingController` para probarse. Expone la misma
 * forma que consumen las vistas, con las páginas y los resúmenes ya puestos.
 *
 * Solo lo usan los `*.spec.ts`, como el resto de este fichero.
 */
export interface FakeMatchHistoryOptions {
  personal?: Match[];
  personalTotal?: number;
  group?: Match[];
  groupTotal?: number;
  groupSample?: Match[];
  groupSampleTotal?: number;
  detail?: Match | null;
  personalStatus?: 'idle' | 'loading' | 'ready' | 'error';
  /** El 403 `PROFILE_PRIVATE` del cruce: llega dentro de un error, y no es un error. */
  personalProfilePrivate?: boolean;
  groupStatus?: 'idle' | 'loading' | 'ready' | 'error';
  detailStatus?: 'idle' | 'loading' | 'ready' | 'error';
  detailNotFound?: boolean;
  /** Resúmenes personales por relación: los tres contadores del cruce. */
  summaries?: Partial<Record<'all' | 'ally' | 'enemy', Partial<PersonalHistorySummary>>>;
  groupSummary?: Partial<GroupHistorySummary> | null;
}

export function fakeMatchHistoryStore(options: FakeMatchHistoryOptions = {}) {
  const personal = options.personal ?? [];
  const group = options.group ?? [];
  const sample = options.groupSample ?? [];
  const noop = () => Promise.resolve();

  const summaryFor = (relation: 'all' | 'ally' | 'enemy'): PersonalHistorySummary | null => {
    const over = options.summaries?.[relation];
    if (!over) return null;
    return {
      totalMatches: 0,
      wins: 0,
      losses: 0,
      matchesWithStats: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      mostPlayedLane: null,
      mostPlayedLaneCount: 0,
      mostPlayedChampionId: null,
      mostPlayedChampionCount: 0,
      ...over,
    };
  };

  return {
    personalMatches: () => personal,
    personalTotal: () => options.personalTotal ?? personal.length,
    personalStatus: () => options.personalStatus ?? 'ready',
    personalProfilePrivate: () => options.personalProfilePrivate ?? false,
    groupMatches: () => group,
    groupTotal: () => options.groupTotal ?? group.length,
    groupStatus: () => options.groupStatus ?? 'ready',
    groupSample: () => sample,
    groupSampleTotal: () => options.groupSampleTotal ?? sample.length,
    groupSampleStatus: () => 'ready' as const,
    groupSummary: () =>
      options.groupSummary === undefined || options.groupSummary === null
        ? null
        : {
            totalMatches: 0,
            matchesWithSide: 0,
            blueWins: 0,
            redWins: 0,
            matchesWithStats: 0,
            averageDurationSeconds: null,
            topMvpUserId: null,
            topMvpCount: 0,
            ...options.groupSummary,
          },
    groupSummaryStatus: () => 'ready' as const,
    personalSummaryStatus: () => 'ready' as const,
    // La clave de la consulta lleva la relación dentro; basta con mirarla para devolver el suyo.
    personalSummaryFor: (query: { relation?: string; with?: string }) =>
      summaryFor(query.relation === 'ALLY' ? 'ally' : query.relation === 'ENEMY' ? 'enemy' : 'all'),
    detail: () => (options.detail ? { match: options.detail, gameVersion: null } : null),
    detailMatch: () => options.detail ?? null,
    detailStatus: () => options.detailStatus ?? (options.detail ? 'ready' : 'idle'),
    detailNotFound: () => options.detailNotFound ?? false,
    ensurePersonal: noop,
    reloadPersonal: noop,
    ensureGroup: noop,
    reloadGroup: noop,
    ensureGroupSample: noop,
    ensurePersonalSummary: noop,
    ensureGroupSummary: noop,
    ensureDetail: noop,
    reloadDetail: noop,
    clear: () => {},
  };
}
