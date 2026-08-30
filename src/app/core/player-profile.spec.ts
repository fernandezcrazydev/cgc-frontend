import { describe, expect, it } from 'vitest';
import {
  ProfileGroupRecord,
  buildMemberProfile,
  buildPlayerProfile,
  globalRecord,
  streakLabel,
} from './player-profile';
import { GROUPS, CURRENT_USER, Member } from './lobby';

const dummyRoster: Member[] = [
  {
    userId: 'm1',
    name: 'Pix3lQueen',
    tag: 'Pix3lQueen#LAN',
    role: 'Miembro',
    initials: 'PQ',
    owner: false,
    hue: 200,
  },
  {
    userId: 'm2',
    name: 'Cr1msonByte',
    tag: 'Cr1msonByte#LAN',
    role: 'Miembro',
    initials: 'CB',
    owner: false,
    hue: 20,
  },
];

const rosterOf = (_groupId: string) => dummyRoster;

describe('Player Profile Domain', () => {
  it('buildPlayerProfile generates stable profile with 5v5 DNA metrics', () => {
    const profile = buildPlayerProfile(CURRENT_USER, GROUPS, rosterOf);

    expect(profile.name).toBe(CURRENT_USER.name);
    expect(profile.tag).toBe(CURRENT_USER.tag);
    expect(profile.games).toBeGreaterThan(0);
    expect(profile.wr).toBeGreaterThanOrEqual(0);
    expect(profile.wr).toBeLessThanOrEqual(100);

    // DNA checks
    expect(profile.dna).toBeDefined();
    expect(profile.dna.lane.wonLanePercentage).toBeGreaterThanOrEqual(0);
    expect(profile.dna.combat.damageSharePercentage).toBeGreaterThan(0);
    expect(profile.dna.vision.visionScoreAvg).toBeGreaterThan(0);
    expect(profile.dna.economy.csPerMinAvg).toBeGreaterThan(0);
    expect(profile.dna.clutch.mvpRate).toBeGreaterThanOrEqual(0);

    // Archetype
    expect(profile.archetype).toBeDefined();
    expect(profile.archetype.title).toBeTruthy();

    // Top champions & roles
    expect(profile.topChampions.length).toBeGreaterThan(0);
    expect(profile.topChampions[0].kda).toBeDefined();
    expect(profile.topChampions[0].coreItemIds.length).toBeGreaterThan(0);
    expect(profile.roleStats.TOP).toBeDefined();
    expect(profile.roleStats.MID).toBeDefined();

    // Recent matches & LP trend
    expect(profile.recentMatches.length).toBe(12);
    expect(profile.recentMatches[0].kda).toContain('/');
  });

  /**
   * El perfil ajeno ya no lleva el cruce entre los dos jugadores: eso lo deriva
   * `MatchHistoryStore.crossWith()` de las partidas reales, y aquí se sembraba con otra
   * fuente que no coincidía con ella. Lo que sí sigue siendo suyo es la carrera del jugador.
   */
  it('buildMemberProfile describe al jugador y no depende de quién lo mira', () => {
    const memberProfile = buildMemberProfile('Pix3lQueen#LAN', GROUPS, rosterOf);

    expect(memberProfile).not.toBeNull();
    // El identificador que sale es el id estable del backend cuando el miembro lo trae, no el
    // tag: el tag es lo que se pinta, no con lo que se referencia a nadie.
    expect(memberProfile?.targetUserId).toBe('m1');
    expect(memberProfile?.name).toBe('Pix3lQueen');
    expect(memberProfile?.topChampions.length).toBeGreaterThan(0);
    expect(memberProfile?.archetype.title).toBeTruthy();
  });

  it('resuelve al miembro también por su id estable, no solo por el tag', () => {
    expect(buildMemberProfile('m2', GROUPS, rosterOf)?.name).toBe('Cr1msonByte');
  });

  /*
   * Antes esto devolvía un perfil completo para cualquier cadena: se fabricaba un miembro con
   * `rating: 1200` y `tier: 'Gold'`, así que `/app/perfil/loquesea` pintaba a alguien que no
   * existe mientras `/app/versus/loquesea` respondía 404. Dos respuestas opuestas a la misma
   * entrada. El 404 de la vista dependía de este `null`, y el `null` no llegaba nunca.
   */
  describe('un jugador que no existe es un 404, no un perfil inventado', () => {
    it('devuelve null cuando no está en ningún roster ni hay partidas suyas', () => {
      expect(buildMemberProfile('NoExiste#EUW', GROUPS, rosterOf)).toBeNull();
      expect(buildMemberProfile('asdfasdf', GROUPS, rosterOf)).toBeNull();
      expect(buildMemberProfile('', GROUPS, rosterOf)).toBeNull();
    });

    it('pero sí resuelve a quien ya no comparte grupo y con quien sí has jugado', () => {
      const exCompanero = buildMemberProfile('Antiguo#LAN', GROUPS, rosterOf, [], true);

      expect(exCompanero).not.toBeNull();
      expect(exCompanero?.name).toBe('Antiguo');
    });
  });

  /*
   * Los grupos de comunidad existen para que «Solicitar unirme» tenga dónde pulsarse. Eran tres
   * constantes escritas a mano añadidas a TODO perfil ajeno, así que abrir dos perfiles seguidos
   * enseñaba los mismos tres grupos con las mismas cifras al LP.
   */
  it('los grupos de comunidad varían de un jugador a otro', () => {
    const uno = buildMemberProfile('Pix3lQueen#LAN', GROUPS, rosterOf)!;
    const otro = buildMemberProfile('Cr1msonByte#LAN', GROUPS, rosterOf)!;

    const ajenos = (p: { groups: readonly ProfileGroupRecord[] }) =>
      p.groups.filter((g) => !GROUPS.some((own) => own.id === g.id)).map((g) => g.id);

    expect(ajenos(uno).length).toBeGreaterThan(0);
    expect(ajenos(uno)).not.toEqual(ajenos(otro));
  });

  it('el winrate de cada grupo de comunidad es victorias entre partidas, no un número suelto', () => {
    const perfil = buildMemberProfile('Pix3lQueen#LAN', GROUPS, rosterOf)!;

    for (const g of perfil.groups) {
      expect(g.wins + g.losses).toBe(g.games);
      expect(g.wr).toBe(Math.round((g.wins / g.games) * 100));
    }
  });

  /*
   * El desglose por posición se sorteaba: se elegía un winrate entre 40 y 70 y de ahí salían las
   * victorias, al revés de como se calcula un winrate. La tabla llegaba a pintar «58 % · 0
   * partidas», un porcentaje sobre nada.
   */
  describe('el desglose por posición se cuenta, no se sortea', () => {
    it('sin partidas, ninguna posición tiene winrate ni rol principal', () => {
      const perfil = buildPlayerProfile(CURRENT_USER, GROUPS, rosterOf, []);

      for (const rol of Object.values(perfil.roleStats)) {
        expect(rol.games).toBe(0);
        expect(rol.wr).toBeNull();
        expect(rol.wonLaneRate).toBeNull();
      }
      expect(perfil.mainRole).toBeNull();
    });

    it('con partidas, el winrate es exactamente victorias entre partidas', () => {
      const perfil = buildPlayerProfile(CURRENT_USER, GROUPS, rosterOf, [
        { role: 'MID', won: true, wonLane: true },
        { role: 'MID', won: true, wonLane: false },
        { role: 'MID', won: false },
        { role: 'TOP', won: false, wonLane: false },
      ]);

      expect(perfil.roleStats.MID).toMatchObject({
        games: 3,
        wins: 2,
        losses: 1,
        wr: 67,
        // Solo dos de las tres registran quién ganó la línea: el porcentaje va sobre esas dos.
        wonLaneGames: 2,
        wonLaneRate: 50,
      });
      expect(perfil.roleStats.TOP).toMatchObject({ games: 1, wins: 0, wr: 0 });
      expect(perfil.roleStats.ADC.wr).toBeNull();
      // La principal es la más jugada, no la primera de la lista ni un MID por defecto.
      expect(perfil.mainRole).toBe('MID');
    });
  });
});

describe('globalRecord', () => {
  const record = (games: number, wins: number): ProfileGroupRecord => ({
    id: `g-${games}-${wins}`,
    name: 'Grupo',
    initials: 'GR',
    c1: '#000',
    c2: '#111',
    role: 'Miembro',
    games,
    wins,
    losses: Math.max(0, games - wins),
    wr: games ? Math.round((wins / games) * 100) : 0,
    rankPosition: 1,
    lp: 100,
    seasonName: 'Temporada 2026-Q3',
  });

  it('suma las partidas y las victorias de todas las ligas', () => {
    const total = globalRecord([record(10, 6), record(30, 12), record(60, 33)]);

    expect(total.games).toBe(100);
    expect(total.wins).toBe(51);
    expect(total.losses).toBe(49);
    expect(total.wr).toBe(51);
  });

  it('pondera por volumen, no promedia los winrates por grupo', () => {
    // Un grupo con 1 partida ganada (100%) y otro con 99 y 33 victorias (33%).
    // La media aritmética de winrates daría 67; la real es 34.
    const total = globalRecord([record(1, 1), record(99, 33)]);

    expect(total.wr).toBe(34);
  });

  it('redondea el porcentaje en vez de truncarlo', () => {
    // 5/8 = 62.5 → 63.
    expect(globalRecord([record(8, 5)]).wr).toBe(63);
  });

  it('un perfil sin grupos da cero, nunca NaN', () => {
    const total = globalRecord([]);

    expect(total.games).toBe(0);
    expect(total.wins).toBe(0);
    expect(total.losses).toBe(0);
    expect(total.wr).toBe(0);
    expect(Number.isNaN(total.wr)).toBe(false);
  });

  it('un grupo recién creado, sin partidas, no rompe el agregado', () => {
    const total = globalRecord([record(0, 0), record(20, 10)]);

    expect(total.games).toBe(20);
    expect(total.wr).toBe(50);
  });

  it('el winrate del perfil cuadra con la suma de su propio desglose por grupo', () => {
    const profile = buildPlayerProfile(CURRENT_USER, GROUPS, rosterOf);

    expect(globalRecord(profile.groups)).toEqual({
      games: profile.games,
      wins: profile.wins,
      losses: profile.losses,
      wr: profile.wr,
    });
  });
});

describe('streakLabel', () => {
  it('traduce el enum de dominio en vez de pintarlo crudo', () => {
    // El enum viaja en inglés porque es el contrato del dato ('W' | 'L');
    // lo que ve el usuario va en español, y esa traducción es el motivo de
    // que exista esta función.
    expect(streakLabel('W')).toBe('V');
    expect(streakLabel('L')).toBe('D');
  });

  it('nunca devuelve la letra inglesa', () => {
    expect(streakLabel('L')).not.toBe('L');
  });
});
