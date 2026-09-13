import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { LeagueEditDialogComponent } from './league-edit-dialog.component';
import { GroupLeague } from '../../../../core/group-leagues';
import { GroupVotesStore } from '../../../../core/group-votes';
import { GroupDetailStore } from '../../../../core/groups';
import { Session } from '../../../../core/auth';
import { ToastService } from '../../../../core/toast';

const MOCK_LEAGUE_NOT_STARTED: GroupLeague = {
  modality: 'BALANCED',
  label: 'Equilibrado',
  state: 'NOT_STARTED',
  ordinal: null,
  seasonName: null,
  named: false,
  durationMonths: 3,
  endsAtLabel: null,
  progress: null,
  skinId: 'clasica',
};

const MOCK_LEAGUE_IN_PROGRESS_NAMED: GroupLeague = {
  modality: 'COMPETITIVE',
  label: 'Competitivo',
  state: 'IN_PROGRESS',
  ordinal: 'Temp. 3',
  seasonName: 'Copa del Nexo',
  named: true,
  durationMonths: 6,
  endsAtLabel: '4 dic 2026',
  progress: 62,
  skinId: 'clasica',
};

const MOCK_LEAGUE_IN_PROGRESS_UNNAMED: GroupLeague = {
  modality: 'CHAOS',
  label: 'Caos',
  state: 'IN_PROGRESS',
  ordinal: 'Temp. 6',
  seasonName: 'Liga Caos · Temp. 6',
  named: false,
  durationMonths: 2,
  endsAtLabel: '2 nov 2026',
  progress: 18,
  skinId: 'clasica',
};

describe('LeagueEditDialogComponent', () => {
  let fixture: ComponentFixture<LeagueEditDialogComponent>;
  let component: LeagueEditDialogComponent;
  let votesStore: { open: any };
  let detailStore: { group: any; roster: any };
  let session: { user: any };
  let toasts: { success: any; error: any };

  beforeEach(async () => {
    votesStore = {
      open: vi.fn(),
    };

    detailStore = {
      group: signal({ id: 'g-test-1', name: 'Customs Tryhard', role: 'OWNER' }),
      roster: signal([
        { userId: 'u1', name: 'Adri', tag: '0001', discordUsername: 'Adri' },
        { userId: 'u2', name: 'Beto', tag: '0002', discordUsername: 'Beto' },
      ]),
    };

    session = {
      user: signal({ id: 'u1', discordUsername: 'Adri' }),
    };

    toasts = {
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LeagueEditDialogComponent],
      providers: [
        { provide: GroupVotesStore, useValue: votesStore },
        { provide: GroupDetailStore, useValue: detailStore },
        { provide: Session, useValue: session },
        { provide: ToastService, useValue: toasts },
      ],
    }).compileComponents();
  });

  function createWith(league: GroupLeague): void {
    fixture = TestBed.createComponent(LeagueEditDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('league', league);
    fixture.componentRef.setInput('groupId', 'g-test-1');
    fixture.detectChanges();
  }

  it('renderiza la vista para liga sin empezar', () => {
    createWith(MOCK_LEAGUE_NOT_STARTED);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('SKIN DEL TROFEO');
    expect(text).toContain('Clásica');
    expect(text).toContain('Próximamente');
    expect(text).toContain('Empieza con la primera partida');
    expect(text).toContain('Esta temporada todavía no ha empezado');
  });

  it('renderiza aviso y botón de proponer para liga en marcha y bautizada', () => {
    createWith(MOCK_LEAGUE_IN_PROGRESS_NAMED);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Nombre de la próxima temporada');
    expect(text).toContain('Para cambiar los de esta hace falta votación unánime');
    expect(text).toContain('Proponer al grupo cerrarla o renombrarla');
  });

  it('permite cambiar a paso de proponer y registrar votación', () => {
    createWith(MOCK_LEAGUE_IN_PROGRESS_NAMED);
    component.openProposeStep();
    fixture.detectChanges();

    expect(component.step()).toBe('propose');
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Qué se propone');
    expect(text).toContain('Motivo (lo verá todo el grupo)');

    component.reason.set('Error en la configuración');
    component.proposedName.set('Liga de Otoño 2026');
    fixture.detectChanges();

    component.submitProposal();
    expect(votesStore.open).toHaveBeenCalled();
    expect(toasts.success).toHaveBeenCalledWith('Votación abierta. El grupo tiene 24 h para responder.');
  });

  it('bautiza la temporada al guardar liga en marcha sin bautizar', () => {
    createWith(MOCK_LEAGUE_IN_PROGRESS_UNNAMED);
    component.seasonNameInput.set('Torneo Relámpago');
    fixture.detectChanges();

    expect(component.hasChanges()).toBe(true);
    component.save();

    expect(toasts.success).toHaveBeenCalledWith('Temporada bautizada como «Torneo Relámpago».');
  });
});
