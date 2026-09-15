import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { HubVoteCardComponent } from './hub-vote-card.component';
import { GroupMemberLite, GroupVote } from '../../../../core/group-votes';

@Component({
  standalone: true,
  imports: [HubVoteCardComponent],
  template: `
    <app-hub-vote-card
      [vote]="vote()"
      [groupId]="groupId()"
      [currentUserId]="currentUserId()"
      [members]="members()"
      [membersLoading]="membersLoading()"
      (voteCast)="onVoteCast($event)"
    />
  `,
})
class TestHostComponent {
  readonly vote = signal<GroupVote>({
    id: 'vote-1',
    kind: 'SEASON_CLOSE',
    proposedBy: 'Adri',
    proposedByRole: 'admin',
    leagueLabel: 'Caos',
    seasonName: 'Copa del Nexo',
    proposedName: null,
    reason: 'se configuró a 6 meses por error, queríamos 2',
    closesAt: Date.now() + 21 * 3600 * 1000 + 8 * 60 * 1000 + 30000,
    inFavor: ['u-1', 'u-2'],
    against: [],
  });
  readonly groupId = signal('lan-challenger');
  readonly currentUserId = signal<string | null>('u-3');
  readonly members = signal<GroupMemberLite[]>([
    { userId: 'u-1', name: 'Adri' },
    { userId: 'u-2', name: 'Sara' },
    { userId: 'u-3', name: 'Dani' },
    { userId: 'u-4', name: 'Manolito' },
  ]);
  readonly membersLoading = signal(false);

  lastVoteEvent: { voteId: string; inFavor: boolean } | null = null;

  onVoteCast(event: { voteId: string; inFavor: boolean }): void {
    this.lastVoteEvent = event;
  }
}

describe('HubVoteCardComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('se crea y muestra la información de la propuesta', () => {
    expect(element.textContent).toContain('Propuesta del grupo');
    expect(element.textContent).toContain('Adri (admin) propone:');
    expect(element.textContent).toContain('Cerrar la temporada «Copa del Nexo» (Caos)');
    expect(element.textContent).toContain('Motivo: «se configuró a 6 meses por error, queríamos 2»');
    expect(element.textContent).toContain(
      'Hace falta que estéis TODOS de acuerdo. Quien no vote, cuenta como un no.',
    );
  });

  it('formatea correctamente el contador de tiempo restante', () => {
    expect(element.textContent).toContain('quedan 21 h 08 min');
  });

  it('calcula el marcador y la lista de miembros pendientes de votar', () => {
    const tallyLabel = element.querySelector('.hub-vote__tally-label');
    expect(tallyLabel?.textContent?.replace(/\s+/g, ' ').trim()).toBe('A favor 2 / 4');
    expect(element.textContent).toContain('Faltan por votar: Dani, Manolito');

    const progressbar = element.querySelector('.hub-vote__progressbar');
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('2');
    expect(progressbar?.getAttribute('aria-valuemax')).toBe('4');
  });

  it('recorta la lista de pendientes con "y X más" si hay más de 4 pendientes', () => {
    host.members.set([
      { userId: 'u-1', name: 'Adri' },
      { userId: 'u-2', name: 'Sara' },
      { userId: 'u-3', name: 'Dani' },
      { userId: 'u-4', name: 'Manolito' },
      { userId: 'u-5', name: 'Pepe' },
      { userId: 'u-6', name: 'Lucía' },
      { userId: 'u-7', name: 'Carlos' },
    ]);
    fixture.detectChanges();

    expect(element.textContent).toContain('Faltan por votar: Dani, Manolito, Pepe, Lucía, y 1 más');
  });

  it('emite el evento voteCast al pulsar A favor o En contra', () => {
    const buttons = element.querySelectorAll<HTMLButtonElement>('.hub-vote__buttons-row button');
    expect(buttons.length).toBe(2);

    const enContraBtn = buttons[0];
    const aFavorBtn = buttons[1];

    expect(enContraBtn.textContent?.trim()).toBe('En contra');
    expect(aFavorBtn.textContent?.trim()).toBe('A favor');

    aFavorBtn.click();
    expect(host.lastVoteEvent).toEqual({ voteId: 'vote-1', inFavor: true });

    enContraBtn.click();
    expect(host.lastVoteEvent).toEqual({ voteId: 'vote-1', inFavor: false });
  });

  it('muestra el estado después de votar con botón Cambiar', () => {
    host.vote.set({
      ...host.vote(),
      inFavor: ['u-1', 'u-2', 'u-3'],
    });
    fixture.detectChanges();

    expect(element.textContent).toContain('Has votado a favor.');
    const cambiarBtn = element.querySelector<HTMLButtonElement>('.hub-vote__status-row button');
    expect(cambiarBtn?.textContent?.trim()).toBe('Cambiar');

    cambiarBtn?.click();
    fixture.detectChanges();

    // Vuelve a mostrar los botones
    const buttons = element.querySelectorAll<HTMLButtonElement>('.hub-vote__buttons-row button');
    expect(buttons.length).toBe(2);
  });

  it('deshabilita los botones cuando la votación ha terminado', () => {
    host.vote.set({
      ...host.vote(),
      closesAt: Date.now() - 1000,
    });
    fixture.detectChanges();

    expect(element.textContent).toContain('la votación ha terminado');
    const buttons = element.querySelectorAll<HTMLButtonElement>('.hub-vote__buttons-row button');
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
  });

  it('muestra skeleton mientras carga el roster', () => {
    host.membersLoading.set(true);
    fixture.detectChanges();

    const skeleton = element.querySelector('nf-skeleton');
    expect(skeleton).toBeTruthy();
  });
});
