import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef } from '@angular/core';
import { HubRefereeVoteCardComponent } from './hub-referee-vote-card.component';
import { RefereeElection } from '../../../../core/group-votes';

describe('HubRefereeVoteCardComponent', () => {
  let fixture: ComponentFixture<HubRefereeVoteCardComponent>;
  let component: HubRefereeVoteCardComponent;
  let componentRef: ComponentRef<HubRefereeVoteCardComponent>;

  const defaultElection: RefereeElection = {
    id: 'referee-g1',
    closesAt: Date.now() + 19 * 3600_000 + 42 * 60_000,
    ballots: {
      u1: 'u2',
      u3: 'u2',
      u4: 'u2',
      u5: 'u6',
    },
  };

  const members = [
    { userId: 'u1', name: 'Victor' },
    { userId: 'u2', name: 'Adri' },
    { userId: 'u3', name: 'Sara' },
    { userId: 'u4', name: 'Dani' },
    { userId: 'u5', name: 'Elena' },
    { userId: 'u6', name: 'Marcos' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HubRefereeVoteCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HubRefereeVoteCardComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
  });

  it('se crea correctamente y pinta el recuento y líder', () => {
    componentRef.setInput('election', defaultElection);
    componentRef.setInput('groupId', 'g1');
    componentRef.setInput('currentUserId', 'u-other');
    componentRef.setInput('members', members);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Votación de árbitro');
    expect(compiled.textContent).toContain('Han votado');
    expect(compiled.textContent).toContain('4 / 6');
    expect(compiled.textContent).toContain('Ahora mismo lidera Adri con 3 votos');
    expect(compiled.textContent).toContain('Votar');
  });

  it('muestra el estado de voto emitido cuando el usuario actual ya votó', () => {
    componentRef.setInput('election', {
      ...defaultElection,
      ballots: { ...defaultElection.ballots, 'u-current': 'u1' },
    });
    componentRef.setInput('groupId', 'g1');
    componentRef.setInput('currentUserId', 'u-current');
    componentRef.setInput('members', members);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Has votado a Victor');
    expect(compiled.textContent).toContain('Cambiar mi voto');
  });

  it('emite openVoteModal al pulsar en Votar', () => {
    let opened = false;
    component.openVoteModal.subscribe(() => {
      opened = true;
    });

    componentRef.setInput('election', defaultElection);
    componentRef.setInput('groupId', 'g1');
    componentRef.setInput('currentUserId', 'u-other');
    componentRef.setInput('members', members);
    fixture.detectChanges();

    component.onVoteClick();
    expect(opened).toBe(true);
  });

  it('deshabilita el botón si la votación ha caducado', () => {
    componentRef.setInput('election', {
      ...defaultElection,
      closesAt: Date.now() - 1000,
    });
    componentRef.setInput('groupId', 'g1');
    componentRef.setInput('currentUserId', 'u-other');
    componentRef.setInput('members', members);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('la votación ha terminado');
  });
});
