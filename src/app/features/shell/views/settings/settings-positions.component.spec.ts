import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { SettingsPositionsComponent } from './settings-positions.component';
import { PreferencesStore, RolePreferences } from '../../../../core/preferences';
import { ToastService } from '../../../../core/toast';

describe('SettingsPositionsComponent', () => {
  let component: SettingsPositionsComponent;
  let fixture: ComponentFixture<SettingsPositionsComponent>;
  let prefsSignal: WritableSignal<RolePreferences>;
  let saveSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    prefsSignal = signal<RolePreferences>({
      roles: ['MID', 'TOP', 'ADC'],
      primary: 'MID',
    });
    saveSpy = vi.fn().mockResolvedValue(true);

    const mockPrefs = {
      prefs: prefsSignal,
      status: signal('ready'),
      saving: signal(false),
      ensureLoaded: vi.fn(),
      reload: vi.fn(),
      save: saveSpy,
    };

    const mockToasts = {
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsPositionsComponent],
      providers: [
        { provide: PreferencesStore, useValue: mockPrefs },
        { provide: ToastService, useValue: mockToasts },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPositionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea y reparte los 5 roles en las tres zonas', () => {
    expect(component).toBeTruthy();
    expect(component.primaryRoleDef()?.role).toBe('MID');
    expect(component.secondaryRoleDefs().map((r) => r.role)).toEqual(['TOP', 'ADC']);
    expect(component.inactiveRoleDefs().map((r) => r.role)).toEqual(['JUNGLA', 'SUPPORT']);
  });

  it('pulsar una secundaria la retira a no jugadas', () => {
    component.removeSecondaryRole('TOP');
    expect(component.secondaryRoleDefs().map((r) => r.role)).toEqual(['ADC']);
    expect(component.inactiveRoleDefs().map((r) => r.role)).toEqual(['TOP', 'JUNGLA', 'SUPPORT']);
    expect(component.dirty()).toBe(true);
  });

  it('pulsar una no jugada la añade a secundarias', () => {
    component.toggleInactiveRole('JUNGLA');
    expect(component.secondaryRoleDefs().map((r) => r.role)).toEqual(['TOP', 'JUNGLA', 'ADC']);
    expect(component.inactiveRoleDefs().map((r) => r.role)).toEqual(['SUPPORT']);
    expect(component.dirty()).toBe(true);
  });

  it('ascender una secundaria la convierte en principal y baja la anterior a secundaria', () => {
    component.promoteToPrimary('ADC');
    expect(component.primaryRoleDef()?.role).toBe('ADC');
    expect(component.secondaryRoleDefs().map((r) => r.role)).toEqual(['TOP', 'MID']);
    expect(component.dirty()).toBe(true);
  });

  it('si no hay principal (nuevo usuario), la primera píldora elegida pasa a principal', () => {
    prefsSignal.set({ roles: [], primary: null });
    fixture.detectChanges();

    expect(component.primaryRoleDef()).toBeNull();
    component.toggleInactiveRole('SUPPORT');
    expect(component.primaryRoleDef()?.role).toBe('SUPPORT');
    expect(component.secondaryRoleDefs().length).toBe(0);
  });

  it('Soy FLEX activa las 4 secundarias', () => {
    expect(component.isFlex()).toBe(false);
    component.toggleFlex(true);
    expect(component.isFlex()).toBe(true);
    expect(component.secondaryRoleDefs().length).toBe(4);
    expect(component.inactiveRoleDefs().length).toBe(0);
  });

  it('apagar Soy FLEX deja la principal y 1 secundaria', () => {
    component.toggleFlex(true);
    expect(component.secondaryRoleDefs().length).toBe(4);

    component.toggleFlex(false);
    expect(component.primaryRoleDef()?.role).toBe('MID');
    expect(component.secondaryRoleDefs().length).toBe(1);
    expect(component.secondaryRoleDefs()[0].role).toBe('TOP');
  });

  it('valida que no se pueda guardar sin secundarias', () => {
    component.removeSecondaryRole('TOP');
    component.removeSecondaryRole('ADC');
    expect(component.secondaryRoleDefs().length).toBe(0);
    expect(component.valid()).toBe(false);
    expect(component.canSave()).toBe(false);
    expect(component.validationError()).toBe('Marca al menos una posición secundaria');
  });

  it('descartar restaura el borrador a lo guardado en el store', () => {
    component.toggleInactiveRole('JUNGLA');
    expect(component.dirty()).toBe(true);

    component.discard();
    expect(component.dirty()).toBe(false);
    expect(component.secondaryRoleDefs().map((r) => r.role)).toEqual(['TOP', 'ADC']);
  });

  it('guardar llama a prefs.save() y muestra toast de éxito', async () => {
    component.toggleInactiveRole('JUNGLA');
    await component.save();
    expect(saveSpy).toHaveBeenCalledWith({
      roles: ['TOP', 'JUNGLA', 'MID', 'ADC'],
      primary: 'MID',
    });
    const toasts = TestBed.inject(ToastService);
    expect(toasts.success).toHaveBeenCalledWith('Posiciones guardadas.');
  });
});
