import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { convertToParamMap, ParamMap } from '@angular/router';
import { Ajustes, SETTINGS_SECTIONS } from './ajustes';
import { RiotAccountStore } from '../../../../core/riot';
import { SessionsStore } from '../../../../core/sessions';
import { PreferencesStore } from '../../../../core/preferences';
import { SettingsStore } from '../../../../core/settings';
import { ThemeService } from '../../../../core/theme';
import { ToastService } from '../../../../core/toast';
import { NotificationsStore } from '../../../../core/notifications';
import { Auth } from '../../../../core/auth';
import { signal } from '@angular/core';

describe('Ajustes (Página principal de ajustes)', () => {
  let component: Ajustes;
  let fixture: ComponentFixture<Ajustes>;
  let queryParamsSubject: BehaviorSubject<ParamMap>;
  let router: Router;

  beforeEach(async () => {
    queryParamsSubject = new BehaviorSubject<ParamMap>(convertToParamMap({}));

    const mockRiot = {
      account: signal(null),
      status: signal('ready'),
      saving: signal(false),
      generatingCode: signal(false),
      relinkAvailableAt: signal(null),
      ensureLoaded: vi.fn(),
      reload: vi.fn(),
    };

    const mockSessions = {
      sessions: signal([]),
      status: signal('ready'),
      isLoading: signal(false),
      isClosing: vi.fn().mockReturnValue(false),
      ensureLoaded: vi.fn(),
      reload: vi.fn(),
    };

    const mockPrefs = {
      prefs: signal({ roles: ['MID', 'TOP'], primary: 'MID' }),
      status: signal('ready'),
      saving: signal(false),
      ensureLoaded: vi.fn(),
      reload: vi.fn(),
    };

    const mockSettings = {
      settings: signal({ allowGroupInvites: true, discordNotifications: true }),
      status: signal('ready'),
      isLoading: signal(false),
      saving: signal(false),
      ensureLoaded: vi.fn(),
      reload: vi.fn(),
    };

    const mockTheme = {
      theme: signal('nocturne'),
      set: vi.fn(),
    };

    const mockToasts = {
      success: vi.fn(),
      error: vi.fn(),
    };

    const mockNotifs = {
      lastArrived: signal(null),
      clear: vi.fn(),
    };

    const mockAuth = {
      logout: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [Ajustes],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParamsSubject.asObservable() },
        },
        { provide: RiotAccountStore, useValue: mockRiot },
        { provide: SessionsStore, useValue: mockSessions },
        { provide: PreferencesStore, useValue: mockPrefs },
        { provide: SettingsStore, useValue: mockSettings },
        { provide: ThemeService, useValue: mockTheme },
        { provide: ToastService, useValue: mockToasts },
        { provide: NotificationsStore, useValue: mockNotifs },
        { provide: Auth, useValue: mockAuth },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture = TestBed.createComponent(Ajustes);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('abre en la sección "cuenta" por defecto cuando no hay query param', () => {
    expect(component.activeSection()).toBe('cuenta');
    expect(component.activeSectionConfig().label).toBe('Cuenta');
    expect(component.activeSectionConfig().description).toBe('Tu identidad y tus dispositivos');
  });

  it('abre la sección especificada en el query param ?s=', () => {
    for (const sec of SETTINGS_SECTIONS) {
      queryParamsSubject.next(convertToParamMap({ s: sec }));
      fixture.detectChanges();
      expect(component.activeSection()).toBe(sec);
    }
  });

  it('cae en "cuenta" si el query param es desconocido', () => {
    queryParamsSubject.next(convertToParamMap({ s: 'desconocido_123' }));
    fixture.detectChanges();
    expect(component.activeSection()).toBe('cuenta');
  });

  it('cambiar de sección navega con replaceUrl: true y queryParams: { s }', () => {
    component.setSection('posiciones');
    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: expect.anything(),
      queryParams: { s: 'posiciones' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('enseña los 5 botones en el índice de escritorio', () => {
    const buttons = fixture.nativeElement.querySelectorAll('.settings-nav-desktop .settings-nav-btn');
    expect(buttons.length).toBe(5);
    expect(buttons[0].textContent.trim()).toBe('Cuenta');
    expect(buttons[1].textContent.trim()).toBe('Posiciones');
    expect(buttons[2].textContent.trim()).toBe('Notificaciones');
    expect(buttons[3].textContent.trim()).toBe('Privacidad');
    expect(buttons[4].textContent.trim()).toBe('Apariencia');
  });
});
