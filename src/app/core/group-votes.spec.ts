import { TestBed } from '@angular/core/testing';
import { GroupVotesStore } from './group-votes';

describe('GroupVotesStore', () => {
  let store: GroupVotesStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GroupVotesStore],
    });
    store = TestBed.inject(GroupVotesStore);
  });

  it('permite abrir una votación y consultarla de forma reactiva', () => {
    const votesSignal = store.votesFor('g-1', []);
    expect(votesSignal().length).toBe(0);

    store.open('g-1', {
      kind: 'SEASON_RENAME',
      proposedBy: 'Adri',
      proposedByRole: 'admin',
      leagueLabel: 'Competitivo',
      seasonName: 'Copa del Nexo',
      proposedName: 'Liga de Invierno',
      reason: 'Queremos cambiar el nombre',
    });

    const votes = votesSignal();
    expect(votes.length).toBe(1);
    expect(votes[0].kind).toBe('SEASON_RENAME');
    expect(votes[0].proposedName).toBe('Liga de Invierno');
    expect(votes[0].proposedBy).toBe('Adri');
  });

  it('permite emitir votos y comprobar hasVoted de forma idempotente', () => {
    store.open('g-1', {
      kind: 'SEASON_CLOSE',
      proposedBy: 'Adri',
      proposedByRole: 'admin',
      leagueLabel: 'Caos',
      seasonName: 'Liga Caos · Temp. 6',
      proposedName: null,
      reason: 'Cierre acordado',
    });

    const vote = store.votesFor('g-1')()[0];
    expect(store.hasVoted('g-1', vote.id, 'u-test')).toBe(false);

    store.cast('g-1', vote.id, 'u-test', true);
    expect(store.hasVoted('g-1', vote.id, 'u-test')).toBe(true);

    const updated = store.votesFor('g-1')()[0];
    expect(updated.inFavor).toContain('u-test');
    expect(updated.against).not.toContain('u-test');

    // Cambiar voto a en contra
    store.cast('g-1', vote.id, 'u-test', false);
    const updated2 = store.votesFor('g-1')()[0];
    expect(updated2.inFavor).not.toContain('u-test');
    expect(updated2.against).toContain('u-test');
  });

  it('permite consultar la elección de árbitro sembrada y registrar/cambiar votos', () => {
    const members = [
      { userId: 'u1', name: 'Victor' },
      { userId: 'u2', name: 'Adri' },
      { userId: 'u3', name: 'Sara' },
      { userId: 'u4', name: 'Dani' },
    ];
    const electionSignal = store.refereeElectionFor('g-ref-1', members, 'u-current');
    const election = electionSignal();
    expect(election).not.toBeNull();
    expect(election?.id).toBe('referee-g-ref-1');
    expect(election?.closesAt).toBeGreaterThan(Date.now());
    // El usuario actual nunca tiene papeleta sembrada
    expect(election?.ballots['u-current']).toBeUndefined();
    expect(store.hasVoted('g-ref-1', 'referee-g-ref-1', 'u-current')).toBe(false);

    // Emitir voto
    store.castRefereeVote('g-ref-1', 'u-current', 'u1', members, 'u-current');
    const afterVote = electionSignal();
    expect(afterVote?.ballots['u-current']).toBe('u1');
    expect(store.hasVoted('g-ref-1', 'referee-g-ref-1', 'u-current')).toBe(true);

    // Cambiar voto
    store.castRefereeVote('g-ref-1', 'u-current', 'u2', members, 'u-current');
    const afterChange = electionSignal();
    expect(afterChange?.ballots['u-current']).toBe('u2');
    expect(store.hasVoted('g-ref-1', 'referee-g-ref-1', 'u-current')).toBe(true);
  });
});
