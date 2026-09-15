import { describe, expect, it } from 'vitest';
import { GroupStats, StatsPlayer } from './models';
import {
  duosOf,
  laneImpactOf,
  mapTelemetryOf,
  metagameOf,
  playerTiles,
  playersOf,
  recordsOf,
  visionOf,
} from './stats-view';

function player(userId: string, over: Partial<StatsPlayer> = {}): StatsPlayer {
  return {
    userId,
    riotId: `${userId}#EUW`,
    discordUsername: userId,
    avatarUrl: null,
    games: 10,
    wins: 6,
    losses: 4,
    gamesWithStats: 10,
    seconds: 18000,
    kills: 70,
    deaths: 40,
    assists: 90,
    cs: 2000,
    gold: 120000,
    damageToChampions: 200000,
    damageTaken: 180000,
    damageMitigated: 90000,
    healed: 30000,
    visionScore: 400,
    wardsPlaced: 120,
    wardsKilled: 40,
    timeCcingOthers: 300,
    doubles: 6,
    triples: 2,
    quadras: 1,
    pentas: 0,
    towers: 8,
    dragons: 14,
    barons: 5,
    firstBloods: 2,
    deathlessGames: 1,
    mvps: 2,
    currentStreak: 2,
    bestStreak: 4,
    worstStreak: -3,
    mainChampionId: 64,
    mainChampionGames: 6,
    mainChampionWins: 4,
    rating: 1500,
    ratingRank: 3,
    ...over,
  };
}

function stats(over: Partial<GroupStats> = {}): GroupStats {
  return {
    matches: 10,
    matchesWithStats: 10,
    totalSeconds: 18000,
    totalKills: 350,
    side: { games: 10, blueWins: 6, redWins: 4 },
    objectives: [],
    champions: [],
    duos: [],
    lanes: [],
    records: [],
    players: [player('u-1')],
    ...over,
  };
}

describe('playersOf', () => {
  /**
   * <strong>El borde que produce una mentira invisible.</strong> Un KDA se divide entre las
   * partidas que alguien EXPORTÓ, no entre todas. Con el denominador equivocado, un jugador sale
   * peor cuanto más de su historial se haya quedado sin subir — y las dos cifras son plausibles,
   * así que no lo detecta nadie mirando la pantalla.
   */
  it('divide las medias entre las partidas subidas, no entre todas', () => {
    const [view] = playersOf(
      stats({ players: [player('u-1', { games: 20, gamesWithStats: 10, kills: 70 })] }),
    );

    expect(view.games).toBe(20);
    expect(view.kills).toBe(7);
  });

  /** Sin una sola muerte el KDA es «perfecto» y no infinito: es la convención de todo cliente. */
  it('un jugador sin muertes no produce un KDA infinito', () => {
    const [view] = playersOf(
      stats({ players: [player('u-1', { deaths: 0, kills: 10, assists: 5 })] }),
    );

    expect(view.kda).toBe(15);
    expect(Number.isFinite(view.kda)).toBe(true);
  });

  /** Y sin ninguna partida subida no hay medias que dar: cero, y no una división por cero. */
  it('sin partidas subidas las medias son cero y no NaN', () => {
    const [view] = playersOf(
      stats({ players: [player('u-1', { gamesWithStats: 0, seconds: 0, kills: 0, cs: 0 })] }),
    );

    expect(view.csPerMin).toBe(0);
    expect(Number.isNaN(view.csPerMin)).toBe(false);
    expect(view.mainChampWr).not.toBeUndefined();
  });

  it('sin campeón principal no se inventa uno ni un winrate', () => {
    const [view] = playersOf(
      stats({ players: [player('u-1', { mainChampionId: null, mainChampionGames: 0 })] }),
    );

    expect(view.mainChampionId).toBeNull();
    expect(view.mainChampWr).toBeNull();
  });

  /** El mejor dúo es con quien más gana; la némesis, contra quien más pierde. */
  it('resuelve el mejor dúo y la némesis desde las filas de cada dirección', () => {
    const result = playersOf(
      stats({
        players: [player('u-1'), player('u-2'), player('u-3')],
        duos: [
          { a: 'u-1', b: 'u-2', allies: true, games: 5, wins: 5 },
          { a: 'u-1', b: 'u-3', allies: true, games: 5, wins: 1 },
          { a: 'u-1', b: 'u-2', allies: false, games: 4, wins: 3 },
          { a: 'u-1', b: 'u-3', allies: false, games: 4, wins: 0 },
        ],
      }),
    );

    const uno = result[0];
    expect(uno.bestDuo?.userId).toBe('u-2');
    expect(uno.bestDuo?.winrate).toBe(100);
    expect(uno.nemesis?.userId).toBe('u-3');
    expect(uno.nemesis?.winrate).toBe(0);
  });

  it('quien no ha coincidido con nadie no tiene dúo ni némesis inventados', () => {
    const [view] = playersOf(stats({ duos: [] }));

    expect(view.bestDuo).toBeNull();
    expect(view.nemesis).toBeNull();
  });
});

describe('playerTiles', () => {
  /** El signo de la racha lleva el sentido: `-2` son dos derrotas, no dos victorias. */
  it('escribe la racha con victorias o derrotas según su signo', () => {
    const [ganando] = playersOf(stats({ players: [player('u-1', { currentStreak: 3 })] }));
    const [perdiendo] = playersOf(stats({ players: [player('u-1', { currentStreak: -2 })] }));
    const [recien] = playersOf(stats({ players: [player('u-1', { currentStreak: 0 })] }));

    expect(tile(ganando, 'Racha actual')).toBe('3V');
    expect(tile(perdiendo, 'Racha actual')).toBe('2D');
    expect(tile(recien, 'Racha actual')).toBe('—');
  });

  /** Sin puesto en el ladder no está el último: es que no está. «#0» diría lo contrario. */
  it('sin puesto en el ranking escribe un hueco y no un cero', () => {
    const [sinRating] = playersOf(stats({ players: [player('u-1', { ratingRank: null })] }));

    expect(tile(sinRating, 'Pos. ranking')).toBe('—');
  });

  function tile(view: ReturnType<typeof playersOf>[number], label: string): string | undefined {
    return playerTiles(view).find((t) => t.label === label)?.value;
  }
});

describe('mapTelemetryOf', () => {
  /**
   * Un objetivo que nadie se llevó nunca **no es un objetivo que no sirva**: es uno del que no se
   * sabe nada. Su tarjeta diría «0%» sobre cero partidas, que se lee como lo primero.
   */
  it('deja fuera los objetivos que nadie se llevó', () => {
    const telemetry = mapTelemetryOf(
      stats({
        objectives: [
          { objective: 'FIRST_BARON', games: 8, wins: 7 },
          { objective: 'HERALD', games: 0, wins: 0 },
        ],
      }),
    );

    expect(telemetry?.objectives.map((o) => o.id)).toEqual(['baron']);
  });

  it('el impacto se dice también en una palabra', () => {
    const telemetry = mapTelemetryOf(
      stats({
        objectives: [
          { objective: 'FIRST_BARON', games: 10, wins: 9 },
          { objective: 'FIRST_TOWER', games: 10, wins: 7 },
          { objective: 'FIRST_DRAGON', games: 10, wins: 6 },
        ],
      }),
    );

    // El orden de la rejilla es el del catálogo (dragón, larvas, heraldo, barón, torre) y no el
    // del payload: así la tarjeta de cada objetivo está siempre en el mismo sitio.
    const byId = new Map(telemetry?.objectives.map((o) => [o.id, o.impact]));
    expect(byId.get('baron')).toBe('Decisivo');
    expect(byId.get('tower')).toBe('Alto');
    expect(byId.get('dragon')).toBe('Medio');
  });

  /** Sin una sola partida subida no hay duración media. «0:00» diría que duran nada. */
  it('sin partidas subidas el ritmo es nulo, no cero', () => {
    const telemetry = mapTelemetryOf(
      stats({ matchesWithStats: 0, totalSeconds: 0, totalKills: 0 }),
    );

    expect(telemetry?.pacing.averageDuration).toBeNull();
    expect(telemetry?.pacing.killsPerMinute).toBeNull();
    expect(telemetry?.pacing.totalKillsPerGame).toBeNull();
  });

  /**
   * El balance de bandos tiene <strong>su propio denominador</strong>: una sala que nunca decidió
   * quién vestía de azul no cuenta en ninguno de los dos lados.
   */
  it('los porcentajes de bando salen sobre las partidas con lado decidido', () => {
    const telemetry = mapTelemetryOf(
      stats({ matches: 20, side: { games: 10, blueWins: 6, redWins: 4 } }),
    );

    expect(telemetry?.side.bluePct).toBe(60);
    expect(telemetry?.side.redPct).toBe(40);
  });
});

describe('metagameOf', () => {
  /**
   * Un campeón jugado una sola vez es «100% de victorias» o «0%», y los dos tableros de winrate se
   * llenarían de gente que jugó una partida. Dejarlos vacíos dice la verdad.
   */
  it('los tableros de winrate exigen un mínimo de partidas', () => {
    const boards = metagameOf(
      stats({
        champions: [
          { championId: 64, picks: 1, wins: 1, bans: 0 },
          { championId: 157, picks: 4, wins: 3, bans: 0 },
        ],
      }),
    );

    const winrate = boards.find((b) => b.id === 'winrate');
    expect(winrate?.entries.map((e) => e.championId)).toEqual([157]);
  });

  /** Un campeón que nadie escoge pero que se banea todas las noches es justo lo que cuenta. */
  it('un campeón solo baneado aparece en su tablero', () => {
    const boards = metagameOf(
      stats({ champions: [{ championId: 350, picks: 0, wins: 0, bans: 9 }] }),
    );

    const bans = boards.find((b) => b.id === 'bans');
    expect(bans?.entries[0].championId).toBe(350);
    expect(bans?.entries[0].sub).toBe('nunca jugado');
  });

  /** Ningún porcentaje viaja sin su denominador: «68%» sobre tres partidas no es «68%». */
  it('cada winrate lleva al lado sobre cuántas partidas se mide', () => {
    const boards = metagameOf(
      stats({ champions: [{ championId: 64, picks: 8, wins: 6, bans: 0 }] }),
    );

    const picks = boards.find((b) => b.id === 'picks');
    expect(picks?.entries[0].value).toBe('8 partidas');
    expect(picks?.entries[0].sub).toBe('75% de victorias');
  });
});

describe('duosOf', () => {
  it('corona el mejor y el peor dúo de la misma lista', () => {
    const { golden, wooden } = duosOf(
      stats({
        players: [player('u-1'), player('u-2'), player('u-3')],
        duos: [
          { a: 'u-1', b: 'u-2', allies: true, games: 8, wins: 7 },
          { a: 'u-1', b: 'u-3', allies: true, games: 6, wins: 1 },
        ],
      }),
    );

    expect(golden?.winrate).toBe(88);
    expect(wooden?.winrate).toBe(17);
    expect(golden?.losses).toBe(1);
  });

  /** Con una sola partida juntos, el «dúo de oro» es quien coincidió una noche y ganó: ruido. */
  it('una sola partida juntos no corona a nadie', () => {
    const { golden, wooden } = duosOf(
      stats({
        players: [player('u-1'), player('u-2')],
        duos: [{ a: 'u-1', b: 'u-2', allies: true, games: 1, wins: 1 }],
      }),
    );

    expect(golden).toBeNull();
    expect(wooden).toBeNull();
  });

  /** Con una sola pareja no hay «peor»: sería la misma, y coronarla dos veces es una broma mala. */
  it('con una única pareja no se inventa un dúo de madera', () => {
    const { golden, wooden } = duosOf(
      stats({
        players: [player('u-1'), player('u-2')],
        duos: [{ a: 'u-1', b: 'u-2', allies: true, games: 4, wins: 3 }],
      }),
    );

    expect(golden).not.toBeNull();
    expect(wooden).toBeNull();
  });
});

describe('laneImpactOf', () => {
  it('ordena las líneas por cuánto pesa ganarlas y numera sin huecos', () => {
    const lanes = laneImpactOf(
      stats({
        lanes: [
          { lane: 'TOP', games: 10, decisive: 5, goldLead: 12000 },
          { lane: 'MID', games: 10, decisive: 9, goldLead: 8000 },
        ],
      }),
    );

    expect(lanes.map((l) => l.lane)).toEqual(['MID', 'TOP']);
    expect(lanes.map((l) => l.impactOrder)).toEqual([1, 2]);
    expect(lanes[0].winrate).toBe(90);
  });

  /** Una línea sin un solo duelo medido no se pinta: no es un 0%, es que no hay nada. */
  it('una línea sin duelos medidos no entra', () => {
    const lanes = laneImpactOf(
      stats({ lanes: [{ lane: 'SUPPORT', games: 0, decisive: 0, goldLead: 0 }] }),
    );

    expect(lanes).toHaveLength(0);
  });
});

describe('visionOf y recordsOf', () => {
  /**
   * Los diez juegan LA MISMA partida, así que los minutos del grupo son los de las partidas y no la
   * suma de los diez jugadores — dividir por esa suma daría un décimo de la cifra real.
   */
  it('la visión por minuto se divide por la duración de las partidas, no por la suma de los diez', () => {
    const vision = visionOf(
      stats({
        totalSeconds: 600,
        players: [player('u-1', { visionScore: 50 }), player('u-2', { visionScore: 50 })],
      }),
    );

    expect(vision?.visionPerMin).toBe(10);
  });

  it('sin partidas subidas no hay visión que contar', () => {
    expect(visionOf(stats({ matchesWithStats: 0 }))).toBeNull();
  });

  /** Los dos récords que son de la partida y no de nadie no acreditan a ningún jugador. */
  it('un récord sin dueño no le atribuye la partida a nadie', () => {
    const [record] = recordsOf(
      stats({
        records: [
          { id: 'LONGEST_GAME', matchId: 'm-1', userId: null, championId: null, value: 2400 },
        ],
      }),
    );

    expect(record.userId).toBeNull();
    expect(record.value).toBe('40:00');
    expect(record.matchId).toBe('m-1');
  });
});
