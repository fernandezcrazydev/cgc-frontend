/**
 * DTO del backend → modelo de dominio. Funciones puras, sin Angular y sin estado.
 *
 * Vive separado del `matches-api.ts` porque es lo único de esta migración que tiene reglas
 * propias que merecen test: qué se convierte en `null`, qué se deriva y qué **no** se deriva.
 *
 * Tres cosas que este fichero NO hace, y no por descuido:
 *
 * - **No inventa el lado.** `side` y `winnerSide` llegan tal cual, y `null` se queda `null`.
 * - **No rellena con ceros.** Un campo ausente del DTO es un campo ausente del modelo. Con
 *   `hasStats: false` eso es casi todo, y es la respuesta correcta.
 * - **No recalcula el ganador ni el MVP.** Los decide el servidor. Recalcularlos aquí es cómo
 *   se consigue que la tarjeta y la partida que abre digan cosas distintas.
 */
import type { components } from '../http/api-types';
import { bannerColors, initialsOf } from '../groups';
import {
  GroupContext,
  GroupHistorySummary,
  Lane,
  Match,
  MatchDetail,
  MatchParticipant,
  MatchPreset,
  PersonalHistorySummary,
  TeamObjectives,
  TeamSide,
  TeamSlot,
  TeamSummary,
} from './models';

type GroupMatchResponse = components['schemas']['GroupMatchResponse'];
type MatchTeamResponse = components['schemas']['MatchTeamResponse'];
type MatchSeatResponse = components['schemas']['MatchSeatResponse'];
type MatchDetailResponse = components['schemas']['MatchDetailResponse'];
type MatchTeamObjectivesResponse = components['schemas']['MatchTeamObjectivesResponse'];
type SeatDetailResponse = components['schemas']['SeatDetailResponse'];
type GroupHistorySummaryResponse = components['schemas']['GroupHistorySummaryResponse'];
type PersonalHistorySummaryResponse = components['schemas']['PersonalHistorySummaryResponse'];

/**
 * Lo único que el mapeo necesita de fuera: quién es el usuario de la sesión, para resolver su
 * asiento (`userParticipant`) y cómo le fue (`userOutcome`).
 *
 * Ya no hace falta pasarle el grupo: la fila lo trae (`groupId` + `groupName`) en las dos listas.
 */
export interface MatchMappingContext {
  currentUserId?: string | null;
}

export function toMatch(dto: GroupMatchResponse, ctx: MatchMappingContext = {}): Match {
  const teams = toTeams(dto.teams ?? []);
  const winningSlot = slotOf(dto.winnerSlot);
  const winningSide = sideOf(dto.winnerSide);

  const match: Match = {
    id: dto.id ?? '',
    groupId: dto.groupId ?? null,
    group: groupContext(dto.groupId, dto.groupName),
    hasStats: dto.hasStats === true,
    voided: dto.voided === true,
    preset: (dto.preset ?? 'BALANCED') as MatchPreset,
    durationSeconds: dto.durationSeconds ?? null,
    decidedAt: dto.playedAt ?? '',
    winningSlot,
    winningSide,
    teams,
    mvpUserId: dto.mvpUserId ?? null,
    aceUserId: dto.aceUserId ?? null,
    leagueId: dto.leagueId ?? null,
    leagueName: dto.leagueName ?? null,
  };

  const me = ctx.currentUserId
    ? participantsOf(match).find((p) => p.userId === ctx.currentUserId)
    : undefined;
  if (me) {
    match.userParticipant = me;
    match.userOutcome = outcomeFor(match, me);
  }
  return match;
}

/**
 * El detalle: la misma fila, con los objetivos pegados a su equipo y el detalle de cada asiento
 * dentro de su `stats`. Así todo componente que sabe pintar un `Match` sirve para las dos cosas.
 *
 * `stats` viene **indexado por `userId`** (no es una lista), y `teams` viene **vacío si la sala
 * no decidió lados**: los objetivos son del equipo 100/200, y sin saber cuál era azul, colgarlos
 * de A o de B sería inventar.
 */
export function toMatchDetail(dto: MatchDetailResponse, ctx: MatchMappingContext = {}): MatchDetail {
  const base = toMatch(dto.summary ?? {}, ctx);
  const objectivesBySlot = new Map<TeamSlot, TeamObjectives>();
  for (const t of dto.teams ?? []) {
    const slot = slotOf(t.teamSlot);
    if (slot) objectivesBySlot.set(slot, toObjectives(t));
  }

  const seatStats = dto.stats ?? {};
  const teams = base.teams.map((team) => ({
    ...team,
    objectives: objectivesBySlot.get(team.slot),
    participants: team.participants.map((p) => ({
      ...p,
      stats: { ...p.stats, ...toSeatDetail(seatStats[p.userId]) },
    })),
  })) as unknown as readonly [TeamSummary, TeamSummary];

  const match: Match = { ...base, teams };
  // `userParticipant` apunta al objeto de la lista anterior: se vuelve a resolver sobre la
  // nueva, o el detalle del usuario saldría sin las estadísticas que acabamos de pegar.
  const me = ctx.currentUserId
    ? participantsOf(match).find((p) => p.userId === ctx.currentUserId)
    : undefined;
  match.userParticipant = me;
  match.userOutcome = me ? outcomeFor(match, me) : undefined;

  return { match, gameVersion: dto.gameVersion ?? null };
}

export function toGroupSummary(dto: GroupHistorySummaryResponse): GroupHistorySummary {
  return {
    totalMatches: dto.totalMatches ?? 0,
    matchesWithSide: dto.matchesWithSide ?? 0,
    blueWins: dto.blueWins ?? 0,
    redWins: dto.redWins ?? 0,
    matchesWithStats: dto.matchesWithStats ?? 0,
    averageDurationSeconds: dto.averageDurationSeconds ?? null,
    topMvpUserId: dto.topMvpUserId ?? null,
    topMvpCount: dto.topMvpCount ?? 0,
  };
}

export function toPersonalSummary(dto: PersonalHistorySummaryResponse): PersonalHistorySummary {
  return {
    totalMatches: dto.totalMatches ?? 0,
    wins: dto.wins ?? 0,
    losses: dto.losses ?? 0,
    matchesWithStats: dto.matchesWithStats ?? 0,
    kills: dto.kills ?? 0,
    deaths: dto.deaths ?? 0,
    assists: dto.assists ?? 0,
    mostPlayedLane: (dto.mostPlayedLane as Lane | undefined) ?? null,
    mostPlayedLaneCount: dto.mostPlayedLaneCount ?? 0,
    mostPlayedChampionId: dto.mostPlayedChampionId ?? null,
    mostPlayedChampionCount: dto.mostPlayedChampionCount ?? 0,
  };
}

// ── Piezas ──────────────────────────────────────────────────────────────────

/**
 * Siempre dos equipos, en orden de hueco A y luego B. El backend los manda así; si algún día
 * mandase uno solo, es preferible un hueco vacío y visible a que la vista reviente al leer
 * `teams[1]`.
 */
function toTeams(dtos: MatchTeamResponse[]): readonly [TeamSummary, TeamSummary] {
  const bySlot = new Map<TeamSlot, MatchTeamResponse>();
  for (const t of dtos) {
    const slot = slotOf(t.slot);
    if (slot) bySlot.set(slot, t);
  }
  return [toTeam('A', bySlot.get('A')), toTeam('B', bySlot.get('B'))];
}

function toTeam(slot: TeamSlot, dto: MatchTeamResponse | undefined): TeamSummary {
  return {
    slot,
    side: sideOf(dto?.side),
    won: dto?.won === true,
    totalKills: dto?.kills ?? null,
    totalGold: dto?.goldEarned ?? null,
    participants: (dto?.participants ?? []).map((seat) => toParticipant(seat, slot, sideOf(dto?.side))),
  };
}

function toParticipant(
  seat: MatchSeatResponse,
  slot: TeamSlot,
  side: TeamSide | null,
): MatchParticipant {
  return {
    userId: seat.userId ?? '',
    riotId: seat.riotId ?? null,
    // Llegan con subida o sin ella: es lo que permite nombrar los diez asientos de una partida
    // que nadie exportó, y también los de `/me/matches`, donde no hay censo que consultar.
    discordUsername: seat.discordUsername ?? null,
    avatarUrl: seat.avatarUrl ?? null,
    // `teamSlot` viene en el asiento, pero el equipo que lo contiene es la fuente: un asiento
    // con el hueco de otro equipo sería un dato roto, no un tercer equipo.
    slot: slotOf(seat.teamSlot) ?? slot,
    side,
    role: (seat.lane ?? 'MID') as Lane,
    championId: seat.championId ?? null,
    wasAutofill: seat.wasAutofill === true,
    lpDelta: seat.lpDelta ?? null,
    ...(seat.rankBefore != null && { rankBefore: seat.rankBefore }),
    ...(seat.rankAfter != null && { rankAfter: seat.rankAfter }),
    stats: {
      ...(seat.kills != null && { kills: seat.kills }),
      ...(seat.deaths != null && { deaths: seat.deaths }),
      ...(seat.assists != null && { assists: seat.assists }),
      ...(seat.goldEarned != null && { gold: seat.goldEarned }),
    },
  };
}

function toSeatDetail(dto: SeatDetailResponse | undefined) {
  if (!dto) return {};
  return {
    ...(dto.cs != null && { cs: dto.cs }),
    ...(dto.damageToChampions != null && { damageToChampions: dto.damageToChampions }),
    ...(dto.damageTaken != null && { damageTaken: dto.damageTaken }),
    ...(dto.visionScore != null && { visionScore: dto.visionScore }),
    ...(dto.timeCcingOthers != null && { timeCcingOthers: dto.timeCcingOthers }),
    ...(dto.goldAt14 != null && { goldAt14: dto.goldAt14 }),
    ...(dto.csAt14 != null && { csAt14: dto.csAt14 }),
    ...(dto.spell1Id != null && { spell1Id: dto.spell1Id }),
    ...(dto.spell2Id != null && { spell2Id: dto.spell2Id }),
    ...(dto.clientLane != null && { clientLane: dto.clientLane }),
    ...(dto.clientRole != null && { clientRole: dto.clientRole }),
  };
}

function toObjectives(dto: MatchTeamObjectivesResponse): TeamObjectives {
  return {
    bans: dto.bans ?? [],
    barons: dto.baronKills ?? null,
    dragons: dto.dragonKills ?? null,
    heralds: dto.heraldKills ?? null,
    voidgrubs: dto.hordeKills ?? null,
    towers: dto.towerKills ?? null,
    inhibitors: dto.inhibitorKills ?? null,
    firstBlood: dto.firstBlood ?? null,
    firstTower: dto.firstTower ?? null,
    firstBaron: dto.firstBaron ?? null,
    firstDragon: dto.firstDragon ?? null,
    firstInhibitor: dto.firstInhibitor ?? null,
  };
}

function groupContext(id: string | undefined, name: string | undefined): GroupContext | null {
  if (!id) return null;
  const { c1, c2 } = bannerColors(id);
  const label = name ?? '';
  return { id, name: label, initials: initialsOf(label), color1: c1, color2: c2 };
}

/**
 * Cómo le fue al usuario. Una partida anulada no es ni victoria ni derrota, y por eso `voided`
 * gana a `won`: contarla como derrota es lo que haría que el winrate de la pantalla no cuadrase
 * con el `wins`/`losses` que sirve el resumen.
 */
function outcomeFor(match: Match, me: MatchParticipant) {
  if (match.voided) return 'cancelled' as const;
  return me.slot === match.winningSlot ? ('win' as const) : ('loss' as const);
}

function slotOf(raw: string | undefined | null): TeamSlot | null {
  return raw === 'A' || raw === 'B' ? raw : null;
}

/** `null` se queda `null`: el lado no se adivina nunca. */
function sideOf(raw: string | undefined | null): TeamSide | null {
  if (raw === 'BLUE' || raw === 'blue') return 'blue';
  if (raw === 'RED' || raw === 'red') return 'red';
  return null;
}

function participantsOf(m: Match): MatchParticipant[] {
  return [...m.teams[0].participants, ...m.teams[1].participants];
}
