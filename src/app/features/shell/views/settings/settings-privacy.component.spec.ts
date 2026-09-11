import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { SettingsPrivacyComponent } from './settings-privacy.component';
import { SettingsStore, UserSettings } from '../../../../core/settings';
import { ToastService } from '../../../../core/toast';

describe('SettingsPrivacyComponent', () => {
  let component: SettingsPrivacyComponent;
  let fixture: ComponentFixture<SettingsPrivacyComponent>;
  let settingsSignal: WritableSignal<UserSettings | null>;
  let updateSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    settingsSignal = signal<UserSettings | null>({
      allowGroupInvites: true,
      discordNotifications: true,
    });
    updateSpy = vi.fn().mockResolvedValue({
      allowGroupInvites: false,
      discordNotifications: true,
    });

    const mockSettings = {
      settings: settingsSignal,
      status: signal('ready'),
      isLoading: signal(false),
      saving: signal(false),
      ensureLoaded: vi.fn(),
      reload: vi.fn(),
      update: updateSpy,
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

  it('se crea y enseña el toggle de invitaciones a grupos', () => {
    expect(component).toBeTruthy();
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Aceptar invitaciones a grupos');
  });

  it('cambiar invitaciones guarda y muestra toast', async () => {
    await component.setAllowInvites(false);
    expect(updateSpy).toHaveBeenCalledWith({
      allowGroupInvites: false,
      discordNotifications: true,
    });
    const toasts = TestBed.inject(ToastService);
    expect(toasts.success).toHaveBeenCalledWith('No recibirás más invitaciones a grupos');
  });
});
