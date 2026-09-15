import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { SettingsNotificationsComponent } from './settings-notifications.component';
import { SettingsStore, UserSettings } from '../../../../core/settings';
import { ToastService } from '../../../../core/toast';

describe('SettingsNotificationsComponent', () => {
  let component: SettingsNotificationsComponent;
  let fixture: ComponentFixture<SettingsNotificationsComponent>;
  let settingsSignal: WritableSignal<UserSettings | null>;
  let updateSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    settingsSignal = signal<UserSettings | null>({
      allowGroupInvites: true,
      discordNotifications: true,
    });
    updateSpy = vi.fn().mockResolvedValue({
      allowGroupInvites: true,
      discordNotifications: false,
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
      imports: [SettingsNotificationsComponent],
      providers: [
        { provide: SettingsStore, useValue: mockSettings },
        { provide: ToastService, useValue: mockToasts },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsNotificationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea y enseña el bloque informativo de silenciar grupos', () => {
    expect(component).toBeTruthy();
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Silenciar grupos');
    expect(el.textContent).toContain('Poder silenciar los avisos de un grupo concreto todavía no está disponible.');
  });

  it('cambiar notificaciones de discord guarda y muestra toast', async () => {
    await component.setDiscordNotifs(false);
    expect(updateSpy).toHaveBeenCalledWith({
      allowGroupInvites: true,
      discordNotifications: false,
    });
    const toasts = TestBed.inject(ToastService);
    expect(toasts.success).toHaveBeenCalledWith('No te avisaremos por Discord');
  });
});
