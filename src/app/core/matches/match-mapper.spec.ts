import { describe, expect, it } from 'vitest';
import type { components } from '../http/api-types';
import { toMatch, toMatchDetail, toGroupSummary, toPersonalSummary } from './match-mapper';

type GroupMatchResponse = components['schemas']['GroupMatchResponse'];

const ME = '11111111-1111-1111-1111-111111111111';
const RIVAL = '22222222-2222-2222-2222-222222222222';

/** Una fila subida y con lados decididos: el caso normal. */
function row(over: Partial<GroupMatchResponse> = {}): GroupMatchResponse {
  return {
    id: 'm1',
    playedAt: '2026-09-14T22:10:00Z',
    durationSeconds: 1834,
    preset: 'BALANCED',
    hasStats: true,
    voided: false,
    winnerSlot: 'A',
    winnerSide: 'BLUE',
    mvpUserId: ME,
    teams: [
      {
        slot: 'A',
        side: 'BLUE',
        won: true,
        kills: 31,
        goldEarned: 48210,
        participants: [
          {
            userId: ME,
            teamSlot: 'A',
            lane: 'MID',
            wasAutofill: false,
            riotId: 'Yo#EUW',
            championId: 103,
            kills: 8,
            deaths: 2,
            assists: 11,
            goldEarned: 12400,
            lpDelta: 22,
            rankBefore: 3,
            rankAfter: 2,
          },
        ],
      },
      {
        slot: 'B',
        side: 'RED',
        won: false,
        kills: 18,
        goldEarned: 44010,
        participants: [
          {
            userId: RIVAL,
            teamSlot: 'B',
            lane: 'MID',
            wasAutofill: true,
            riotId: 'Rival#EUW',
            championId: 64,
            kills: 4,
            deaths: 7,
            assists: 3,
            goldEarned: 10100,
            lpDelta: -15,
          },
        ],
      },
    ],
    ...over,
  };
}

describe('toMatch', () => {
  it('mapea la fila y resuelve el asiento del usuario de la sesión', () => {
    const m = toMatch(row(), { currentUserId: ME });

    expect(m.id).toBe('m1');
    expect(m.decidedAt).toBe('2026-09-14T22:10:00Z');
    expect(m.winningSlot).toBe('A');
    expect(m.winningSide).toBe('blue');
    expect(m.userParticipant?.userId).toBe(ME);
    expect(m.userOutcome).toBe('win');
    expect(m.teams[0].slot).toBe('A');
    expect(m.teams[1].slot).toBe('B');
  });

  /*
   * La regla que gobierna todo el dominio: lo que dependía de la subida llega nulo, y aquí se
   * queda nulo. Un `kills: 0` se pinta como una partida real en la que un equipo no mató a
   * nadie, y esa mentira no la detecta nadie mirando la pantalla.
   */
  it('sin subida no rellena con ceros: los campos ausentes siguen ausentes', () => {
    const sinSubida = row({
      hasStats: false,
      durationSeconds: undefined,
      mvpUserId: undefined,
      teams: [
        {
          slot: 'A',
          side: 'BLUE',
          won: true,
          participants: [
            { userId: ME, teamSlot: 'A', lane: 'TOP', wasAutofill: false, lpDelta: 18 },
          ],
        },
        { slot: 'B', side: 'RED', won: false, participants: [] },
      ],
    });

    const m = toMatch(sinSubida, { currentUserId: ME });
    const yo = m.userParticipant!;

    expect(m.hasStats).toBe(false);
    expect(m.durationSeconds).toBeNull();
    expect(m.mvpUserId).toBeNull();
    expect(m.teams[0].totalKills).toBeNull();
    expect(m.teams[0].totalGold).toBeNull();
    expect(yo.championId).toBeNull();
    expect(yo.riotId).toBeNull();
    expect(yo.stats.kills).toBeUndefined();
    expect(yo.stats.deaths).toBeUndefined();
    // Lo que NO depende de la subida sigue estando: la línea que repartimos y los LP.
    expect(yo.role).toBe('TOP');
    expect(yo.lpDelta).toBe(18);
  });

  /*
   * Quién vistió de azul lo decide la sala y puede no haberse decidido nunca. Rellenarlo desde
   * el orden de entrada es literalmente el bug de la app anterior, que produjo un jugador 14-0
   * «en azul» sin que nadie lo hubiera elegido.
   */
  it('un lado sin decidir se queda en null; el hueco A/B sí existe siempre', () => {
    const sinLado = row({
      winnerSide: undefined,
      teams: [
        { slot: 'A', side: undefined, won: true, kills: 10, participants: [] },
        { slot: 'B', side: undefined, won: false, kills: 4, participants: [] },
      ],
    });

    const m = toMatch(sinLado, { currentUserId: ME });

    expect(m.winningSide).toBeNull();
    expect(m.winningSlot).toBe('A');
    expect(m.teams[0].side).toBeNull();
    expect(m.teams[1].side).toBeNull();
  });

  /** `lpDelta: 0` es una partida que contó y no movió nada; ausente es que no contó. */
  it('distingue un lpDelta de cero de uno ausente', () => {
    const conCero = toMatch(
      row({
        teams: [
          {
            slot: 'A',
            side: 'BLUE',
            won: true,
            participants: [
              { userId: ME, teamSlot: 'A', lane: 'MID', wasAutofill: false, lpDelta: 0 },
            ],
          },
          {
            slot: 'B',
            side: 'RED',
            won: false,
            participants: [{ userId: RIVAL, teamSlot: 'B', lane: 'MID', wasAutofill: false }],
          },
        ],
      }),
      { currentUserId: ME },
    );

    expect(conCero.teams[0].participants[0].lpDelta).toBe(0);
    expect(conCero.teams[1].participants[0].lpDelta).toBeNull();
  });

  /** Una anulada no es una derrota, y contarla como tal descuadraría el winrate del resumen. */
  it('una partida anulada da outcome cancelled aunque tu equipo figure como ganador', () => {
    const m = toMatch(row({ voided: true }), { currentUserId: ME });
    expect(m.userOutcome).toBe('cancelled');
  });

  it('sin usuario en la partida no hay userParticipant ni outcome', () => {
    const m = toMatch(row(), { currentUserId: 'otro' });
    expect(m.userParticipant).toBeUndefined();
    expect(m.userOutcome).toBeUndefined();
  });

  /*
   * El grupo viaja en la fila, y en las DOS listas: la del grupo y la personal. Esa igualdad de
   * forma es lo que permite pintarlas con un solo componente.
   */
  it('el grupo sale de la propia fila, con sus iniciales y su color derivados', () => {
    const m = toMatch(row({ groupId: 'g1', groupName: 'Chiringuito Chatarra' }), {
      currentUserId: ME,
    });

    expect(m.groupId).toBe('g1');
    expect(m.group?.name).toBe('Chiringuito Chatarra');
    expect(m.group?.initials).toBe('CC');
    // Mismo grupo → mismo gradiente en toda la app, sin que el backend guarde un color.
    expect(m.group?.color1).toBe(toMatch(row({ groupId: 'g1' }), {}).group?.color1);
  });

  it('una fila sin grupo sale sin grupo, no con uno inventado', () => {
    const m = toMatch(row({ groupId: undefined, groupName: undefined }), { currentUserId: ME });

    expect(m.groupId).toBeNull();
    expect(m.group).toBeNull();
  });

  /*
   * El nombre de Discord llega SIEMPRE, con subida o sin ella: es lo que permite nombrar los
   * diez asientos de una partida que nadie exportó, y los de `/me/matches`, donde no hay censo
   * que consultar. El `riotId` es el del día que se jugó y por eso puede faltar.
   */
  it('el asiento trae nombre de Discord y avatar aunque no haya subida', () => {
    const m = toMatch(
      row({
        hasStats: false,
        teams: [
          {
            slot: 'A',
            side: 'BLUE',
            won: true,
            participants: [
              {
                userId: ME,
                teamSlot: 'A',
                lane: 'MID',
                wasAutofill: false,
                discordUsername: 'nightfang',
                avatarUrl: 'https://cdn/a.png',
              },
            ],
          },
          { slot: 'B', side: 'RED', won: false, participants: [] },
        ],
      }),
      { currentUserId: ME },
    );

    const yo = m.userParticipant!;
    expect(yo.riotId).toBeNull();
    expect(yo.discordUsername).toBe('nightfang');
    expect(yo.avatarUrl).toBe('https://cdn/a.png');
  });
});

describe('toMatchDetail', () => {
  it('pega los objetivos a su equipo y el detalle de cada asiento a su stats', () => {
    const detail = toMatchDetail(
      {
        gameVersion: '14.24.1',
        summary: row(),
        teams: [
          {
            teamSlot: 'A',
            bans: [1, 2],
            baronKills: 1,
            dragonKills: 3,
            towerKills: 8,
            firstBlood: true,
          },
          { teamSlot: 'B', bans: [], dragonKills: 1 },
        ],
        stats: {
          [ME]: { cs: 213, damageToChampions: 24500, visionScore: 31, goldAt14: 5200, csAt14: 118 },
        },
      },
      { currentUserId: ME },
    );

    const a = detail.match.teams[0];
    expect(detail.gameVersion).toBe('14.24.1');
    expect(a.objectives?.barons).toBe(1);
    expect(a.objectives?.bans).toEqual([1, 2]);
    expect(a.participants[0].stats.cs).toBe(213);
    expect(a.participants[0].stats.goldAt14).toBe(5200);
    // Y el asiento del usuario apunta al objeto NUEVO, con las estadísticas ya pegadas.
    expect(detail.match.userParticipant?.stats.cs).toBe(213);
  });

  /*
   * Los objetivos son del equipo 100/200: sin saber cuál era azul, colgarlos de A o de B sería
   * inventar. El backend manda `teams` vacío y aquí no aparece ninguno.
   */
  it('sin lados decididos no hay objetivos que colgar', () => {
    const detail = toMatchDetail(
      { summary: row({ winnerSide: undefined }), teams: [], stats: {} },
      { currentUserId: ME },
    );

    expect(detail.match.teams[0].objectives).toBeUndefined();
    expect(detail.match.teams[1].objectives).toBeUndefined();
  });

  /** Un campo que el cliente escribe distinto llega vacío, y `null` no es `false` ni `0`. */
  it('un objetivo que nadie apuntó llega null, no cero', () => {
    const detail = toMatchDetail(
      { summary: row(), teams: [{ teamSlot: 'A', bans: [] }, { teamSlot: 'B', bans: [] }], stats: {} },
      { currentUserId: ME },
    );

    const obj = detail.match.teams[0].objectives!;
    expect(obj.barons).toBeNull();
    expect(obj.firstBaron).toBeNull();
    expect(obj.bans).toEqual([]);
  });
});

describe('los resúmenes', () => {
  it('conservan los denominadores en vez de servir porcentajes', () => {
    const s = toGroupSummary({
      totalMatches: 42,
      matchesWithSide: 40,
      blueWins: 23,
      redWins: 17,
      matchesWithStats: 31,
      averageDurationSeconds: 1834,
      topMvpUserId: ME,
      topMvpCount: 7,
    });

    // `blueWins + redWins` NO es `totalMatches`: dos salas no decidieron lado.
    expect(s.blueWins + s.redWins).toBe(s.matchesWithSide);
    expect(s.matchesWithSide).not.toBe(s.totalMatches);
  });

  /** `null` es «no hay ningún MVP todavía», no un empate a cero. */
  it('un grupo sin subidas no tiene MVP ni duración media', () => {
    const s = toGroupSummary({ totalMatches: 5, matchesWithSide: 5, matchesWithStats: 0 });
    expect(s.topMvpUserId).toBeNull();
    expect(s.averageDurationSeconds).toBeNull();
  });

  it('el resumen personal separa el total del denominador del KDA', () => {
    const s = toPersonalSummary({
      totalMatches: 20,
      wins: 12,
      losses: 8,
      matchesWithStats: 14,
      kills: 100,
      deaths: 50,
      assists: 150,
      mostPlayedLane: 'MID',
      mostPlayedLaneCount: 9,
    });

    expect(s.totalMatches).toBe(20);
    expect(s.matchesWithStats).toBe(14);
    // La línea existe sin subidas —la repartimos nosotros—; el campeón no.
    expect(s.mostPlayedLane).toBe('MID');
    expect(s.mostPlayedChampionId).toBeNull();
  });
});
