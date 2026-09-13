import { groupLeaguesFor } from './group-leagues';

describe('groupLeaguesFor', () => {
  it('devuelve las tres ligas en el orden esperado con sus duraciones por defecto', () => {
    const leagues = groupLeaguesFor('lan-challenger');

    expect(leagues.length).toBe(3);
    expect(leagues[0].modality).toBe('COMPETITIVE');
    expect(leagues[0].label).toBe('Competitivo');
    expect(leagues[0].durationMonths).toBe(6);

    expect(leagues[1].modality).toBe('BALANCED');
    expect(leagues[1].label).toBe('Equilibrado');
    expect(leagues[1].durationMonths).toBe(3);

    expect(leagues[2].modality).toBe('CHAOS');
    expect(leagues[2].label).toBe('Caos');
    expect(leagues[2].durationMonths).toBe(2);
  });

  it('es determinista para el mismo groupId', () => {
    const l1 = groupLeaguesFor('g-test-42');
    const l2 = groupLeaguesFor('g-test-42');

    expect(l1).toEqual(l2);
  });
});
