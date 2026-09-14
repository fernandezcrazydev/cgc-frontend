import { TestBed } from '@angular/core/testing';
import { GroupSanctionsStore, sanctionsFor } from './group-sanctions';
import { Member } from './lobby';

describe('GroupSanctionsStore', () => {
  let store: GroupSanctionsStore;

  const mockRoster: Member[] = [
    { userId: 'u-1', name: 'Dani', tag: 'Dani#EUW', initials: 'DA', hue: 120, role: 'MEMBER', owner: false },
    { userId: 'u-2', name: 'Sara', tag: 'Sara#EUW', initials: 'SA', hue: 200, role: 'MEMBER', owner: false },
    { userId: 'u-3', name: 'Manolito', tag: 'Manolito#EUW', initials: 'MA', hue: 320, role: 'MEMBER', owner: false },
    { userId: 'u-4', name: 'Victor', tag: 'Victor#EUW', initials: 'VI', hue: 45, role: 'ADMIN', owner: false, admin: true },
    { userId: 'u-5', name: 'Adri', tag: 'Adri#EUW', initials: 'AD', hue: 280, role: 'OWNER', owner: true },
  ];

  const mockSeasons = [
    { id: 'season-active', name: 'Temporada 2', status: 'ACTIVE' },
    { id: 'season-past-1', name: 'Temporada 1', status: 'FINISHED' },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GroupSanctionsStore],
    });
    store = TestBed.inject(GroupSanctionsStore);
  });

  it('genera 3 activas y entre 6 y 10 de histórico de forma determinista', () => {
    const list = sanctionsFor('g-test-1', mockRoster, mockSeasons, 'u-1');
    const actives = list.filter((s) => s.status === 'ACTIVE');
    const history = list.filter((s) => s.status !== 'ACTIVE');

    expect(actives.length).toBe(3);
    expect(history.length).toBeGreaterThanOrEqual(6);
    expect(history.length).toBeLessThanOrEqual(10);

    // La primera activa pertenece al usuario actual si está en el roster
    expect(actives[0].targetUserId).toBe('u-1');

    // Exactamente una de las activas tiene appeal ya registrado y no es la del usuario actual
    const withAppeal = actives.filter((s) => s.appeal !== null);
    expect(withAppeal.length).toBe(1);
    expect(withAppeal[0].targetUserId).not.toBe('u-1');

    // Las del histórico con temporada cerrada tienen seasonId de una temporada FINISHED
    const withSeason = history.filter((s) => s.seasonId !== null);
    for (const h of withSeason) {
      expect(h.seasonId).toBe('season-past-1');
    }
  });

  it('permite levantar una sanción y la mueve a LIFTED', () => {
    const listSignal = store.sanctionsOf('g-test-2', mockRoster, mockSeasons, 'u-1');
    const initial = listSignal();
    const active = initial.find((s) => s.status === 'ACTIVE')!;

    store.lift('g-test-2', active.id, 'Victor', mockRoster, mockSeasons, 'u-1');
    const updated = listSignal();
    const lifted = updated.find((s) => s.id === active.id)!;

    expect(lifted.status).toBe('LIFTED');
    expect(lifted.liftedByName).toBe('Victor');
    expect(lifted.liftedAt).toBeGreaterThan(0);
  });

  it('permite pedir revisión una sola vez por sanción', () => {
    const listSignal = store.sanctionsOf('g-test-3', mockRoster, mockSeasons, 'u-1');
    const initial = listSignal();
    const withoutAppeal = initial.find((s) => s.status === 'ACTIVE' && !s.appeal)!;

    store.appeal(
      'g-test-3',
      withoutAppeal.id,
      {
        text: 'Mi apelación justificada',
        at: Date.now(),
        byUserId: 'u-1',
        byName: 'Dani',
      },
      mockRoster,
      mockSeasons,
      'u-1',
    );

    const updated = listSignal();
    const appealed = updated.find((s) => s.id === withoutAppeal.id)!;
    expect(appealed.appeal?.text).toBe('Mi apelación justificada');

    // Intentar volver a apelar no hace nada (no sobreescribe)
    store.appeal(
      'g-test-3',
      withoutAppeal.id,
      {
        text: 'Segunda apelación no permitida',
        at: Date.now(),
        byUserId: 'u-1',
        byName: 'Dani',
      },
      mockRoster,
      mockSeasons,
      'u-1',
    );

    const afterSecondAttempt = listSignal();
    const appealed2 = afterSecondAttempt.find((s) => s.id === withoutAppeal.id)!;
    expect(appealed2.appeal?.text).toBe('Mi apelación justificada');
  });

  it('permite registrar una sanción nueva', () => {
    const listSignal = store.sanctionsOf('g-test-4', mockRoster, mockSeasons, 'u-1');
    const initialCount = listSignal().length;

    store.recordSanction(
      'g-test-4',
      {
        kind: 'BAN',
        targetUserId: 'u-2',
        targetName: 'Sara',
        targetAvatar: null,
        targetHue: 200,
        lpDelta: null,
        days: 3,
        scope: 'ALL_LEAGUES',
        modality: 'Competitivo',
        seasonId: null,
        seasonName: null,
        reason: 'Sanción nueva de prueba',
        roomId: null,
        byUserId: 'u-4',
        byName: 'Victor',
        byRole: 'árbitro',
        endsAt: Date.now() + 3 * 86_400_000,
      },
      mockRoster,
      mockSeasons,
      'u-1',
    );

    const updated = listSignal();
    expect(updated.length).toBe(initialCount + 1);
    expect(updated[0].reason).toBe('Sanción nueva de prueba');
    expect(updated[0].status).toBe('ACTIVE');
  });
  it('sin roster no siembra nada, en vez de inventarse a los sancionados', () => {
    // Entrar por enlace directo al panel deja el roster mock vacío hasta que el puente responde.
    // Antes se caía a un roster de reserva y la pantalla enseñaba sanciones de cinco personas que
    // no eran del grupo. Una lista vacía mientras carga es correcta; una lista falsa, no.
    expect(sanctionsFor('g-test-1', [], mockSeasons, 'u-1')).toEqual([]);
  });
  it('una escritura sin contexto no borra la lista del grupo', () => {
    // Los tres sitios que escriben llamaban sin roster, y la primera escritura sobre un grupo
    // guardaba una lista sembrada desde cero: pedir una revisión dejaba la pantalla vacía.
    const list = store.sanctionsOf('g-test-1', mockRoster, mockSeasons, 'u-1');
    const antes = list().length;
    const objetivo = list().find((s) => s.status === 'ACTIVE' && !s.appeal)!;

    store.appeal('g-test-1', objetivo.id, {
      text: 'Se me cayó el internet.',
      at: Date.now(),
      byUserId: objetivo.targetUserId,
      byName: objetivo.targetName,
    });

    expect(list().length).toBe(antes);
    expect(list().find((s) => s.id === objetivo.id)?.appeal?.text).toBe('Se me cayó el internet.');
  });
  it('crear una sanción sin roster no borra el histórico del grupo', () => {
    // El modal de decisión arbitral del shell escribe sin roster ni temporadas: no tiene por qué
    // haber abierto el panel de ese grupo. Antes eso guardaba una lista sembrada desde cero.
    const list = store.sanctionsOf('g-test-1', mockRoster, mockSeasons, 'u-1');
    const antes = list().length;

    store.recordSanction('g-test-1', {
      kind: 'BAN',
      targetUserId: 'u-2',
      targetName: 'Sara',
      targetAvatar: null,
      targetHue: 200,
      lpDelta: null,
      days: 7,
      scope: 'ALL_LEAGUES',
      modality: 'Equilibrado',
      seasonId: null,
      seasonName: null,
      reason: 'Tercera incidencia esta temporada',
      roomId: null,
      byUserId: 'u-4',
      byName: 'Victor',
      byRole: 'árbitro',
      endsAt: Date.now() + 7 * 86_400_000,
    });

    expect(list().length).toBe(antes + 1);
    expect(list()[0].reason).toBe('Tercera incidencia esta temporada');

    // Y levantarla funciona igual que levantar una sembrada.
    store.lift('g-test-1', list()[0].id, 'Victor');
    expect(list()[0].status).toBe('LIFTED');
  });
});
