import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { SettingsPrivacyComponent } from './settings-privacy.component';
import { SettingsStore, UserSettings } from '../../../../core/settings';
import { ToastService } from '../../../../core/toast';

const PUBLIC_SETTINGS: UserSettings = {
  allowGroupInvites: true,
  discordNotifications: true,
  profileVisibility: 'PUBLIC',
};

describe('SettingsPrivacyComponent', () => {
  let component: SettingsPrivacyComponent;
  let fixture: ComponentFixture<SettingsPrivacyComponent>;
  let settingsSignal: WritableSignal<UserSettings | null>;
  let patchSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    settingsSignal = signal<UserSettings | null>(PUBLIC_SETTINGS);
    patchSpy = vi.fn().mockImplementation(async (change: Partial<UserSettings>) => {
      const saved = { ...settingsSignal()!, ...change };
      settingsSignal.set(saved);
      return saved;
    });

    const mockSettings = {
      settings: settingsSignal,
      status: signal('ready'),
      isLoading: signal(false),
      saving: signal(false),
      ensureLoaded: vi.fn(),
      reload: vi.fn(),
      patch: patchSpy,
    };

    const mockToasts = {
      success: vi.fn(),
      error: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsPrivacyComponent],
      providers: [
        { provide: SettingsStore, useValue: mockSettings },
        { provide: ToastService, useValue: mockToasts },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPrivacyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea y enseña los dos interruptores', () => {
    expect(component).toBeTruthy();
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Aceptar invitaciones a grupos');
    expect(el.textContent).toContain('Perfil privado');
  });

  it('cambiar invitaciones guarda y muestra toast', async () => {
    await component.setAllowInvites(false);
    expect(patchSpy).toHaveBeenCalledWith({ allowGroupInvites: false });
    const toasts = TestBed.inject(ToastService);
    expect(toasts.success).toHaveBeenCalledWith('No recibirás más invitaciones a grupos');
  });

  /**
   * El interruptor es un booleano y el contrato un enum de dos: la traducción está en un solo
   * sitio, y este test es lo que impide que alguien mande `true` cuando el backend espera
   * `GROUP_ADMINS` y se coma un 422 que nadie ve hasta producción.
   */
  it('encender el perfil privado manda GROUP_ADMINS, no un booleano', async () => {
    await component.setPrivate(true);

    expect(patchSpy).toHaveBeenCalledWith({ profileVisibility: 'GROUP_ADMINS' });
  });

  it('apagarlo vuelve a PUBLIC', async () => {
    settingsSignal.set({ ...PUBLIC_SETTINGS, profileVisibility: 'GROUP_ADMINS' });
    fixture.detectChanges();

    await component.setPrivate(false);

    expect(patchSpy).toHaveBeenCalledWith({ profileVisibility: 'PUBLIC' });
  });

  /** Pulsar sobre el estado en el que ya estás no puede lanzar un PUT. */
  it('no guarda nada si el valor no cambia', async () => {
    await component.setPrivate(false);

    expect(patchSpy).not.toHaveBeenCalled();
  });

  /**
   * La mitad del mensaje que dice lo que el interruptor NO hace. Sin ella, alguien lo enciende
   * creyendo que desaparece del historial del grupo, que es entender lo contrario de lo que pasa.
   */
  it('dice en pantalla que las partidas siguen saliendo', () => {
    expect(fixture.nativeElement.textContent).toContain('Tus partidas no se esconden');
  });
});
