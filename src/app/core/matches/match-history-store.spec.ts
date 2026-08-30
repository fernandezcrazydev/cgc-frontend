import { describe, expect, it, beforeEach } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatchHistoryStore } from './match-history-store';
import { Match, MatchParticipant } from './models';

/**
 * Los tests afirman sobre INVARIANTES, no sobre la semilla.
 *
 * La versión anterior comprobaba que el campeón 103 era Ahri y que existía la partida
 * `lan-2895`: datos de categoría desechable, que se borran el día que haya endpoint y que
 * habrían dejado el spec en rojo sin que nada estuviese roto. Lo que sí sobrevive —y por
 * tanto lo que merece test— son las derivaciones del store.
 */
describe('MatchHistoryStore', () => {
  let store: MatchHistoryStore;

  /**
   * Por TestBed y no con `new`: el store lee las ligas del usuario, su identidad y el roster de
   * cada grupo de otros cuatro stores. Ninguno pide nada aqui —todos cargan bajo demanda— asi
   * que basta con que `HttpClient` exista para que se puedan construir.
   */
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    store = TestBed.inject(MatchHistoryStore);
  });

  const participants = (m: Match): MatchParticipant[] => [
    ...m.blueTeam.participants,
    ...m.redTeam.participants,
  ];

  it('el historial personal solo trae partidas con participante resuelto y su desenlace', () => {
    const personal = store.allPersonalMatches();
    expect(personal.length).toBeGreaterThan(0);

    for (const m of personal) {
      expect(m.userParticipant).toBeDefined();
      // El desenlace tiene que concordar con el bando: es lo único que la vista pinta.
      const expected = m.userParticipant!.team === m.winningTeam ? 'win' : 'loss';
      expect(m.userOutcome).toBe(expected);
    }
  });

  it('el resumen personal cuadra con las partidas de las que sale', () => {
    const personal = store.allPersonalMatches();
    const summary = store.personalSummary();

    expect(summary.totalMatches).toBe(personal.length);
    expect(summary.wins + summary.losses).toBe(summary.totalMatches);
    expect(summary.winrate).toBeGreaterThanOrEqual(0);
    expect(summary.winrate).toBeLessThanOrEqual(100);
    expect(summary.wins).toBe(personal.filter((m) => m.userOutcome === 'win').length);
  });

  it('matchesByGroup devuelve exclusivamente partidas de ese grupo', () => {
    const groupId = store.allMatches()[0].groupId;
    const matches = store.matchesByGroup(groupId);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.groupId === groupId)).toBe(true);
  });

  it('el resumen de grupo reparte todas las partidas entre los dos bandos', () => {
    const groupId = store.allMatches()[0].groupId;
    const stats = store.groupSummary(groupId);

    expect(stats.totalMatches).toBe(store.matchesByGroup(groupId).length);
    expect(stats.blueSideWins + stats.redSideWins).toBe(stats.totalMatches);
  });

  it('un grupo sin partidas da un resumen vacío, no un NaN', () => {
    const stats = store.groupSummary('grupo-que-no-existe');

    expect(stats.totalMatches).toBe(0);
    expect(stats.blueWinrate).toBe(0);
    expect(stats.avgDurationMinutes).toBe(0);
    expect(stats.topMvpName).toBeNull();
  });

  it('los campeones ofrecidos al filtro son los que de verdad se han jugado', () => {
    const personalIds = store.playedChampionIdsInPersonal();
    const played = new Set(store.allPersonalMatches().map((m) => m.userParticipant!.championId));

    expect(new Set(personalIds)).toEqual(played);

    const groupId = store.allMatches()[0].groupId;
    const groupIds = store.playedChampionIdsInGroup(groupId);
    const inGroup = new Set(store.matchesByGroup(groupId).flatMap((m) => participants(m).map((p) => p.championId)));

    expect(new Set(groupIds)).toEqual(inGroup);
  });

  it('las medias por campeón salen solo de las partidas con ese campeón', () => {
    const championId = store.allPersonalMatches()[0].userParticipant!.championId;
    const averages = store.championAverages(championId);

    const expectedGames = store
      .allPersonalMatches()
      .filter((m) => m.userParticipant!.championId === championId).length;

    expect(averages).not.toBeNull();
    expect(averages!.games).toBe(expectedGames);
    expect(averages!.wins).toBeLessThanOrEqual(averages!.games);
  });

  it('un campeón que el usuario nunca ha jugado no tiene medias', () => {
    expect(store.championAverages(-1)).toBeNull();
  });

  it('el head to head solo cuenta enfrentamientos, no partidas como compañeros', () => {
    const match = store.allPersonalMatches()[0];
    const me = match.userParticipant!;
    const rival = participants(match).find((p) => p.team !== me.team)!;
    const ally = participants(match).find((p) => p.team === me.team && p.id !== me.id)!;

    // Cuántas partidas del historial personal enfrentan de verdad al usuario con alguien. Se
    // re-deriva aquí en vez de fijar un número: con las mismas personas repartidas por varias
    // ligas, un compañero de una partida puede ser rival en otra, y eso es correcto.
    const duels = (who: MatchParticipant): number =>
      store.allPersonalMatches().filter((m) => {
        const mine = m.userParticipant!;
        const them = participants(m).find(
          (p) => (p.userId ?? p.riotId.toLowerCase()) === (who.userId ?? who.riotId.toLowerCase()),
        );
        return !!them && them.team !== mine.team;
      }).length;

    const versus = store.headToHead(rival);
    expect(versus.games).toBe(duels(rival));
    expect(versus.games).toBeGreaterThan(0);
    expect(versus.wins + versus.losses).toBe(versus.games);
    expect(versus.laneGames).toBeLessThanOrEqual(versus.games);

    // Compartir equipo no es una rivalidad: esa partida en concreto no puede sumar.
    expect(store.headToHead(ally).games).toBe(duels(ally));
  });

  it('las partidas vecinas van en orden cronológico y los extremos no tienen una de las dos', () => {
    const ordered = [...store.allPersonalMatches()].sort(
      (a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime(),
    );

    expect(store.neighboursOf(ordered[0].id).prev).toBeNull();
    expect(store.neighboursOf(ordered[ordered.length - 1].id).next).toBeNull();

    if (ordered.length > 1) {
      expect(store.neighboursOf(ordered[0].id).next?.id).toBe(ordered[1].id);
      expect(store.neighboursOf(ordered[1].id).prev?.id).toBe(ordered[0].id);
    }
  });

  it('una partida que no existe no rompe la navegación', () => {
    expect(store.matchById('no-existe')).toBeUndefined();
    expect(store.neighboursOf('no-existe')).toEqual({ prev: null, next: null });
  });

  /*
   * Las copias de la semilla se repartían el resultado invirtiendo el ganador, y eso dejaba los
   * totales de equipo, el MVP y los LP describiendo al ganador original: cuatro de cada diez
   * partidas se pintaban con el bando perdedor por delante en oro, en bajas y en objetivos.
   * Ahora la copia solo decide en qué ranura entra quien mira, así que la partida tiene que
   * seguir siendo coherente consigo misma pase lo que pase. Estos cuatro tests son la red.
   */
  describe('cada copia de la semilla es coherente consigo misma', () => {
    it('el equipo que gana no va por detrás en bajas, oro ni objetivos', () => {
      for (const m of store.allMatches()) {
        const winner = m.winningTeam === 'blue' ? m.blueTeam : m.redTeam;
        const loser = m.winningTeam === 'blue' ? m.redTeam : m.blueTeam;

        expect(winner.totalKills).toBeGreaterThanOrEqual(loser.totalKills);
        expect(winner.totalGold).toBeGreaterThanOrEqual(loser.totalGold);
        expect(winner.towers).toBeGreaterThanOrEqual(loser.towers);
      }
    });

    it('el MVP está en el equipo que ganó', () => {
      for (const m of store.allMatches()) {
        if (!m.mvpParticipantId) continue;
        const mvp = participants(m).find((p) => p.id === m.mvpParticipantId);
        expect(mvp, `${m.id} declara un MVP que no está en la partida`).toBeDefined();
        expect(mvp!.team, `el MVP de ${m.id} está en el equipo perdedor`).toBe(m.winningTeam);
      }
    });

    it('los LP de cada participante van en el sentido del resultado de su equipo', () => {
      for (const m of store.allMatches()) {
        for (const p of participants(m)) {
          if (p.lpDelta === 0) continue;
          const won = p.team === m.winningTeam;
          expect(
            won ? p.lpDelta > 0 : p.lpDelta < 0,
            `${m.id}: ${p.riotId} ${won ? 'gana' : 'pierde'} con lpDelta ${p.lpDelta}`,
          ).toBe(true);
        }
      }
    });

    it('el Riot ID de la ranura ancla nunca se cuela como si fuera otro jugador', () => {
      // `N1ghtfang#LAN` es la ranura que la semilla reserva a quien mira. Si el usuario no la
      // ocupa —porque no juega esa partida, o porque la copia le sienta enfrente— tiene que
      // haberla sustituido alguien, nunca quedarse a la vista con el nombre de la semilla.
      for (const m of store.allMatches()) {
        for (const p of participants(m)) {
          expect(p.riotId, `${m.id} enseña el Riot ID de la semilla`).not.toBe('N1ghtfang#LAN');
        }
      }
    });
  });

  it('el usuario ni gana ni pierde siempre: el registro está repartido', () => {
    // La ranura ancla de la semilla cae del lado ganador en seis de las siete partidas. Sin el
    // cambio de bando, el usuario ganaba el 85% en TODAS las ligas y ni la racha, ni el filtro
    // de resultado, ni el concepto de «némesis» tenían nada que enseñar.
    const summary = store.personalSummary();

    expect(summary.wins).toBeGreaterThan(0);
    expect(summary.losses).toBeGreaterThan(0);
    expect(summary.winrate).toBeGreaterThan(25);
    expect(summary.winrate).toBeLessThan(75);
  });
});
