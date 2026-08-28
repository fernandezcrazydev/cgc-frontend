import { describe, expect, it, beforeEach } from 'vitest';
import { MatchHistoryStore } from './match-history-store';

describe('MatchHistoryStore', () => {
  let store: MatchHistoryStore;

  beforeEach(() => {
    store = new MatchHistoryStore();
    store.resetFilters();
  });

  it('inicializa con partidas cargadas para el usuario actual', () => {
    const personalMatches = store.allPersonalMatches();
    expect(personalMatches.length).toBeGreaterThan(0);

    const first = personalMatches[0];
    expect(first.userParticipant).toBeDefined();
    expect(first.userParticipant?.riotId.toLowerCase()).toBe('n1ghtfang#lan');
    expect(first.userParticipant?.lpDelta).toBeDefined();
  });

  it('calcula métricas agregadas personales (winrate, KDA, etc.)', () => {
    const summary = store.personalSummary();
    expect(summary.totalMatches).toBeGreaterThan(0);
    expect(summary.winrate).toBeGreaterThanOrEqual(0);
    expect(summary.winrate).toBeLessThanOrEqual(100);
    expect(summary.avgKills).toBeGreaterThan(0);
    expect(summary.avgDeaths).toBeGreaterThan(0);
    expect(summary.avgAssists).toBeGreaterThan(0);
  });

  it('filtra correctamente por grupo', () => {
    store.updateFilters({ groupId: 'lan-challenger' });
    const filtered = store.filteredPersonalMatches();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((m) => m.groupId === 'lan-challenger')).toBe(true);
  });

  it('filtra correctamente por rol/posición', () => {
    store.updateFilters({ role: 'MID' });
    const filtered = store.filteredPersonalMatches();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((m) => m.userParticipant?.role === 'MID')).toBe(true);
  });

  it('filtra correctamente por resultado (win / loss)', () => {
    store.updateFilters({ outcome: 'win' });
    const wins = store.filteredPersonalMatches();
    expect(wins.length).toBeGreaterThan(0);
    expect(wins.every((m) => m.userOutcome === 'win')).toBe(true);

    store.updateFilters({ outcome: 'loss' });
    const losses = store.filteredPersonalMatches();
    expect(losses.length).toBeGreaterThan(0);
    expect(losses.every((m) => m.userOutcome === 'loss')).toBe(true);
  });

  it('devuelve exclusivamente los campeones jugados en el historial personal y de grupo', () => {
    const personalChamps = store.playedChampionIdsInPersonal();
    expect(personalChamps.length).toBeGreaterThan(0);
    // Ahri (103), Lee Sin (64), Yasuo (157), Lux (99), Jinx (222)
    expect(personalChamps).toContain(103);
    expect(personalChamps).toContain(64);

    const groupChamps = store.playedChampionIdsInGroup('lan-challenger');
    expect(groupChamps.length).toBeGreaterThan(0);
    expect(groupChamps).toContain(103); // Ahri
    expect(groupChamps).toContain(86);  // Garen
  });

  it('permite expandir y colapsar el acordeón de una partida', () => {
    expect(store.expandedMatchId()).toBeNull();

    store.toggleExpand('lan-2895');
    expect(store.expandedMatchId()).toBe('lan-2895');

    store.toggleExpand('lan-2895');
    expect(store.expandedMatchId()).toBeNull();
  });

  it('calcula resumen de métricas para un grupo específico', () => {
    const groupStats = store.groupSummary('lan-challenger');
    expect(groupStats.totalMatches).toBeGreaterThan(0);
    expect(groupStats.blueSideWins + groupStats.redSideWins).toBe(groupStats.totalMatches);
  });

  it('restablece filtros a su valor por defecto', () => {
    store.updateFilters({ role: 'ADC', outcome: 'win', groupId: 'arcane-five' });
    expect(store.filters().role).toBe('ADC');

    store.resetFilters();
    expect(store.filters().role).toBe('all');
    expect(store.filters().outcome).toBe('all');
    expect(store.filters().groupId).toBe('all');
  });
});
