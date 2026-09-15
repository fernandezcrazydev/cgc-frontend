import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { RefereeVoteModalComponent, RefereeCandidate } from './referee-vote-modal.component';
import { RefereeElection } from '../../../../core/group-votes';

describe('RefereeVoteModalComponent', () => {
  let fixture: ComponentFixture<RefereeVoteModalComponent>;
  let component: RefereeVoteModalComponent;
  let componentRef: ComponentRef<RefereeVoteModalComponent>;

  const defaultElection: RefereeElection = {
    id: 'referee-g1',
    closesAt: Date.now() + 19 * 3600_000,
    ballots: {
      u1: 'u2',
      u3: 'u2',
      u4: 'u2',
      u5: 'u1',
    },
  };

  const members: RefereeCandidate[] = [
    { userId: 'u1', name: 'Victor', hue: 120 },
    { userId: 'u2', name: 'Adri', hue: 200 },
    { userId: 'u3', name: 'Sara', hue: 300 },
    { userId: 'u4', name: 'Dani', hue: 50 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RefereeVoteModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RefereeVoteModalComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
  });

  it('se crea correctamente y ordena por votos descendente y nombre ascendente', () => {
    componentRef.setInput('election', defaultElection);
    componentRef.setInput('members', members);
    componentRef.setInput('currentUserId', 'u-test');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Han votado 4 de 4 miembros');

    const rows = compiled.querySelectorAll('.referee-vote-modal__row');
    expect(rows.length).toBe(4);
    // Adri has 3 votes, Victor has 1, Dani and Sara have 0 (Dani before Sara by localeCompare)
    expect(rows[0].textContent).toContain('Adri');
    expect(rows[0].textContent).toContain('3');
    expect(rows[1].textContent).toContain('Victor');
    expect(rows[1].textContent).toContain('1');
    expect(rows[2].textContent).toContain('Dani');
    expect(rows[2].textContent).toContain('0');
    expect(rows[3].textContent).toContain('Sara');
    expect(rows[3].textContent).toContain('0');
  });

  it('oculta el buscador si hay 12 o menos miembros y lo muestra con más de 12', () => {
    componentRef.setInput('election', defaultElection);
    componentRef.setInput('members', members);
    componentRef.setInput('currentUserId', 'u-test');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.referee-vote-modal__search-input')).toBeNull();

    const largeRoster: RefereeCandidate[] = Array.from({ length: 14 }, (_, i) => ({
      userId: `user-${i}`,
      name: `Jugador ${i}`,
      hue: i * 20,
    }));

    componentRef.setInput('members', largeRoster);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.referee-vote-modal__search-input')).not.toBeNull();
  });

  it('filtra por buscador sin distinguir mayúsculas ni acentos', () => {
    const list: RefereeCandidate[] = [
      { userId: 'u1', name: 'Álvaro', hue: 10 },
      { userId: 'u2', name: 'Victor', hue: 20 },
      ...Array.from({ length: 12 }, (_, i) => ({
        userId: `extra-${i}`,
        name: `Extra ${i}`,
        hue: i * 10,
      })),
    ];

    componentRef.setInput('election', { id: 'referee-g1', closesAt: Date.now() + 100000, ballots: {} });
    componentRef.setInput('members', list);
    componentRef.setInput('currentUserId', 'u-test');
    fixture.detectChanges();

    component.searchTerm.set('alvaro');
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.referee-vote-modal__row');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Álvaro');
  });

  it('permite seleccionar un candidato y emitir el voto', () => {
    let votedId: string | null = null;
    component.voteConfirmed.subscribe((id) => {
      votedId = id;
    });

    componentRef.setInput('election', defaultElection);
    componentRef.setInput('members', members);
    componentRef.setInput('currentUserId', 'u-test');
    fixture.detectChanges();

    component.selectCandidate('u3');
    fixture.detectChanges();

    component.confirm();
    expect(votedId).toBe('u3');
  });

  it('emite closed al pulsar Cancelar', () => {
    let closedCalled = false;
    component.closed.subscribe(() => {
      closedCalled = true;
    });

    componentRef.setInput('election', defaultElection);
    componentRef.setInput('members', members);
    componentRef.setInput('currentUserId', 'u-test');
    fixture.detectChanges();

    const cancelBtn = fixture.nativeElement.querySelector('.referee-vote-modal__foot button') as HTMLButtonElement;
    cancelBtn.click();
    expect(closedCalled).toBe(true);
  });

  it('actualiza el recuento en preview al seleccionar o cambiar de candidato antes de confirmar', () => {
    // Inicialmente: Adri (u2) = 3 votos, Victor (u1) = 1 voto, Dani (u4) = 0 votos
    componentRef.setInput('election', defaultElection);
    componentRef.setInput('members', members);
    componentRef.setInput('currentUserId', 'u-voter');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(component.votesFor('u1')).toBe(1);
    expect(component.votesFor('u4')).toBe(0);

    // El usuario selecciona a Victor (u1) -> sube a 2 en preview
    component.selectCandidate('u1');
    fixture.detectChanges();

    expect(component.votesFor('u1')).toBe(2);
    expect(component.votesFor('u4')).toBe(0);

    // El usuario cambia su selección a Dani (u4) -> Victor baja a 1 y Dani sube a 1
    component.selectCandidate('u4');
    fixture.detectChanges();

    expect(component.votesFor('u1')).toBe(1);
    expect(component.votesFor('u4')).toBe(1);

    // El orden visual de las filas no cambia durante la misma apertura del modal
    const rows = compiled.querySelectorAll('.referee-vote-modal__row');
    expect(rows[0].textContent).toContain('Adri');
    expect(rows[1].textContent).toContain('Victor');
    expect(rows[2].textContent).toContain('Dani');
    expect(rows[3].textContent).toContain('Sara');
  });

  it('seleccionar sin confirmar no mueve el recuento de participación del pie', () => {
    componentRef.setInput('election', defaultElection);
    componentRef.setInput('members', members);
    componentRef.setInput('currentUserId', 'u-voter');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Han votado 4 de 4 miembros');

    // Elegir a alguien anticipa su barra, pero todavía no se ha votado: el pie no puede decir
    // que han votado cinco, porque pulsar «Cancelar» lo dejaria desmentido.
    component.selectCandidate('u1');
    fixture.detectChanges();

    expect(component.votesFor('u1')).toBe(2);
    expect(compiled.textContent).toContain('Han votado 4 de 4 miembros');
  });
});
