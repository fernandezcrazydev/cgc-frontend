import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { SanctionDialogComponent } from './sanction-dialog.component';
import { LeaguesStore } from '../../../../core/leagues';
import { GroupSanctionsStore } from '../../../../core/group-sanctions';
import { ToastService } from '../../../../core/toast';

describe('SanctionDialogComponent', () => {
  let fixture: ComponentFixture<SanctionDialogComponent>;
  let component: SanctionDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SanctionDialogComponent],
      providers: [
        provideHttpClient(),
        LeaguesStore,
        GroupSanctionsStore,
        ToastService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SanctionDialogComponent);
    component = fixture.componentInstance;
  });

  it('cuando recibe jugador fijado, no pinta el selector y muestra el nombre en el lead', () => {
    fixture.componentRef.setInput('groupId', 'g-1');
    fixture.componentRef.setInput('player', { userId: 'u-1', name: 'Dani' });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Dani quedará fuera de la competición');
    expect(compiled.querySelector('nf-select')).toBeNull();
  });

  it('cuando no recibe jugador fijado, muestra el selector de jugador', () => {
    fixture.componentRef.setInput('groupId', 'g-1');
    fixture.componentRef.setInput('player', null);
    fixture.componentRef.setInput('roster', [
      { userId: 'u-1', name: 'Dani', avatar: null, hue: 10, role: 'MEMBER' },
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('nf-select')).not.toBeNull();
  });

  it('muestra la advertencia de alcance únicamente al seleccionar Las tres ligas', () => {
    fixture.componentRef.setInput('groupId', 'g-1');
    fixture.componentRef.setInput('player', { userId: 'u-1', name: 'Dani' });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Hoy el veto solo se aplica a la liga en curso');

    component.scope.set('ALL_LEAGUES');
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Hoy el veto solo se aplica a la liga en curso');
  });

  it('deshabilita el botón de sancionar hasta que hay duración y motivo', () => {
    fixture.componentRef.setInput('groupId', 'g-1');
    fixture.componentRef.setInput('player', { userId: 'u-1', name: 'Dani' });
    fixture.detectChanges();

    expect(component.isValid()).toBe(false);

    component.selectedDuration.set('7');
    expect(component.isValid()).toBe(false);

    component.reason.set('Motivo de prueba');
    expect(component.isValid()).toBe(true);
  });
});
