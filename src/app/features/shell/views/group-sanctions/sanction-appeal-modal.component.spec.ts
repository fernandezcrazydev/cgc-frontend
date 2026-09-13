import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SanctionAppealModalComponent } from './sanction-appeal-modal.component';
import { GroupSanctionsStore, GroupSanction } from '../../../../core/group-sanctions';
import { ToastService } from '../../../../core/toast';

describe('SanctionAppealModalComponent', () => {
  let fixture: ComponentFixture<SanctionAppealModalComponent>;
  let component: SanctionAppealModalComponent;
  let sanctionsStore: GroupSanctionsStore;
  let toasts: ToastService;

  const mockSanctionWithAppeal: GroupSanction = {
    id: 'snc-app-1',
    kind: 'BAN',
    targetUserId: 'u-1',
    targetName: 'Dani',
    targetAvatar: null,
    targetHue: 120,
    lpDelta: null,
    days: 7,
    scope: 'ALL_LEAGUES',
    modality: 'Competitivo',
    seasonId: null,
    seasonName: null,
    reason: 'Tercer abandono esta semana',
    roomId: null,
    byUserId: 'u-ref',
    byName: 'Victor',
    byRole: 'árbitro',
    createdAt: Date.now() - 3600_000,
    endsAt: Date.now() + 6 * 86_400_000,
    status: 'ACTIVE',
    liftedByName: null,
    liftedAt: null,
    appeal: {
      text: 'Se me cayó el internet a mitad de la partida, no fue a posta. Llevo dos meses sin fallar a nada.',
      at: Date.now() - 7200_000,
      byUserId: 'u-1',
      byName: 'Dani',
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SanctionAppealModalComponent],
      providers: [GroupSanctionsStore, ToastService],
    }).compileComponents();

    sanctionsStore = TestBed.inject(GroupSanctionsStore);
    toasts = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(SanctionAppealModalComponent);
    component = fixture.componentInstance;
  });

  it('en modo read muestra el texto de la apelación y permite levantar al árbitro', () => {
    fixture.componentRef.setInput('mode', 'read');
    fixture.componentRef.setInput('sanction', mockSanctionWithAppeal);
    fixture.componentRef.setInput('groupId', 'g-1');
    fixture.componentRef.setInput('isReferee', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Solicitud de revisión');
    expect(compiled.textContent).toContain('Dani pidió revisión');
    expect(compiled.textContent).toContain('Se me cayó el internet');
    expect(compiled.textContent).toContain('Levantar sanción');
  });

  it('en modo write permite escribir y enviar apelación', () => {
    fixture.componentRef.setInput('mode', 'write');
    fixture.componentRef.setInput('sanction', mockSanctionWithAppeal);
    fixture.componentRef.setInput('groupId', 'g-1');
    fixture.componentRef.setInput('refereeName', 'Victor');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Pedir revisión');
    expect(compiled.textContent).toContain('Se lo mandas a Victor, el árbitro del grupo');

    component.appealText.set('Explicación de prueba');
    fixture.detectChanges();

    const sendBtn = compiled.querySelectorAll('button')[1];
    expect(sendBtn.textContent).toContain('Enviar');
  });
});
