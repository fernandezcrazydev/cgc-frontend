import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SanctionRowComponent } from './sanction-row.component';
import { GroupSanction } from '../../../../core/group-sanctions';

describe('SanctionRowComponent', () => {
  let fixture: ComponentFixture<SanctionRowComponent>;
  let component: SanctionRowComponent;

  const mockBanSanction: GroupSanction = {
    id: 'snc-1',
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
    appeal: null,
  };

  const mockAutoSanction: GroupSanction = {
    id: 'snc-2',
    kind: 'AUTO_LP',
    targetUserId: 'u-2',
    targetName: 'Manolito',
    targetAvatar: null,
    targetHue: 200,
    lpDelta: -10,
    days: null,
    scope: 'LEAGUE',
    modality: 'Caos',
    seasonId: null,
    seasonName: null,
    reason: 'Abandonó la partida en curso',
    roomId: '4092',
    byUserId: null,
    byName: null,
    byRole: null,
    createdAt: Date.now() - 12 * 60_000,
    endsAt: null,
    status: 'ACTIVE',
    liftedByName: null,
    liftedAt: null,
    appeal: null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SanctionRowComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SanctionRowComponent);
    component = fixture.componentInstance;
  });

  it('renderiza la fila de ban correctamente', () => {
    fixture.componentRef.setInput('sanction', mockBanSanction);
    fixture.componentRef.setInput('groupId', 'g-1');
    fixture.componentRef.setInput('currentUserId', 'u-other');
    fixture.componentRef.setInput('isReferee', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Dani');
    expect(compiled.textContent).toContain('Victor');
    expect(compiled.textContent).toContain('árbitro');
    expect(compiled.textContent).toContain('Sin jugar');
    expect(compiled.textContent).toContain('las 3 ligas');
    expect(compiled.textContent).toContain('7 días');
    expect(compiled.textContent).toContain('«Tercer abandono esta semana»');
    expect(compiled.textContent).toContain('Levantar');
  });

  it('renderiza la fila automática y el botón de pedir revisión para el usuario afectado', () => {
    fixture.componentRef.setInput('sanction', mockAutoSanction);
    fixture.componentRef.setInput('groupId', 'g-1');
    fixture.componentRef.setInput('currentUserId', 'u-2');
    fixture.componentRef.setInput('isReferee', false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Manolito');
    expect(compiled.textContent).toContain('Automática');
    expect(compiled.textContent).toContain('del sistema');
    expect(compiled.textContent).toContain('−10 LP');
    expect(compiled.textContent).toContain('Caos');
    expect(compiled.textContent).toContain('Sala #4092');
    expect(compiled.textContent).toContain('Pedir revisión');
  });

  it('deshabilita Pedir revisión si el grupo no tiene árbitro', () => {
    fixture.componentRef.setInput('sanction', mockAutoSanction);
    fixture.componentRef.setInput('groupId', 'g-1');
    fixture.componentRef.setInput('currentUserId', 'u-2');
    fixture.componentRef.setInput('hasReferee', false);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toContain('El grupo no tiene árbitro');
  });
});
