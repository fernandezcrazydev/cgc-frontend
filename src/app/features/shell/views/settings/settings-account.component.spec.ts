import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { SettingsAccountComponent } from './settings-account.component';
import { RiotAccount, RiotAccountStore } from '../../../../core/riot';
import { ActiveSession, SessionsStore } from '../../../../core/sessions';
import { ToastService } from '../../../../core/toast';
import { Auth } from '../../../../core/auth';
import { NotificationsStore } from '../../../../core/notifications';

describe('SettingsAccountComponent', () => {
  let component: SettingsAccountComponent;
  let fixture: ComponentFixture<SettingsAccountComponent>;
  let riotAccount: WritableSignal<RiotAccount | null>;
  let riotStatus: WritableSignal<string>;
  let sessionsList: WritableSignal<ActiveSession[]>;
  let sessionsStatus: WritableSignal<string>;
  let authLogoutSpy: ReturnType<typeof vi.fn>;
  let router: Router;

  beforeEach(async () => {
    riotAccount = signal<RiotAccount | null>(null);
    riotStatus = signal('ready');
    sessionsList = signal<ActiveSession[]>([]);
    sessionsStatus = signal('ready');
    authLogoutSpy = vi.fn().mockResolvedValue(undefined);

    const mockRiot = {
      account: riotAccount,
      status: riotStatus,
      saving: signal(false),
      generatingCode: signal(false),
      relinkAvailableAt: signal(null),
      ensureLoaded: vi.fn(),
      reload: vi.fn(),
      link: vi.fn().mockResolvedValue(true),
      unlink: vi.fn().mockResolvedValue(true),
      requestPairingCode: vi.fn().mockResolvedValue({ code: 'SALE-1234', expiresAt: new Date(Date.now() + 60000).toISOString() }),
      clear: vi.fn(),
    };

    const mockSessions = {
      sessions: sessionsList,
      status: sessionsStatus,
      isLoading: signal(false),
      isClosing: vi.fn().mockReturnValue(false),
      ensureLoaded: vi.fn(),
      reload: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn(),
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
      logout: authLogoutSpy,
    };

    await TestBed.configureTestingModule({
      imports: [SettingsAccountComponent],
      providers: [
        provideRouter([]),
        { provide: RiotAccountStore, useValue: mockRiot },
        { provide: SessionsStore, useValue: mockSessions },
        { provide: ToastService, useValue: mockToasts },
        { provide: Auth, useValue: mockAuth },
        { provide: NotificationsStore, useValue: mockNotifs },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture = TestBed.createComponent(SettingsAccountComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea y llama a ensureLoaded de Riot y Sessions', () => {
    const riot = TestBed.inject(RiotAccountStore);
    const sessions = TestBed.inject(SessionsStore);
    expect(component).toBeTruthy();
    expect(riot.ensureLoaded).toHaveBeenCalled();
    expect(sessions.ensureLoaded).toHaveBeenCalled();
  });

  it('enseña caja vacía cuando no hay cuenta de Riot vinculada', () => {
    riotAccount.set(null);
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('Sin cuenta de Riot vinculada');
    expect(el.textContent).toContain('Conectar la app');
    expect(el.textContent).toContain('Escribir mi Riot ID');
  });

  it('enseña los datos de Riot cuando está vinculada', () => {
    riotAccount.set({
      riotId: 'N1ghtfang#LAN',
      gameName: 'N1ghtfang',
      tagLine: 'LAN',
      region: 'LAN',
      profileIconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.1.1/img/profileicon/588.png',
      strength: 'VERIFIED',
      verifiedAt: '2026-09-11T00:00:00Z',
      linkedAt: '2026-09-11T00:00:00Z',
    });
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.textContent).toContain('N1ghtfang#LAN');
    expect(el.textContent).toContain('✓ Verificada');
    expect(el.textContent).toContain('Desvincular');
  });

  it('abre y confirma el modal de desvinculación', async () => {
    riotAccount.set({
      riotId: 'N1ghtfang#LAN',
      gameName: 'N1ghtfang',
      tagLine: 'LAN',
      region: 'LAN',
      profileIconUrl: null,
      strength: 'PAIRED',
      verifiedAt: null,
      linkedAt: '2026-09-11T00:00:00Z',
    });
    fixture.detectChanges();

    component.askUnlink();
    expect(component.unlinking()).toBeTruthy();

    await component.confirmUnlink();
    const riot = TestBed.inject(RiotAccountStore);
    expect(riot.unlink).toHaveBeenCalled();
    expect(component.unlinking()).toBeNull();
  });

  it('abre el modal de vincular y valida el formato del Riot ID', () => {
    component.startLinking();
    expect(component.linking()).toBe(true);
    expect(component.canLink()).toBe(false);

    component.riotIdDraft.set('InvalidoSinTag');
    expect(component.canLink()).toBe(false);

    component.riotIdDraft.set('Valido#EUW');
    expect(component.canLink()).toBe(true);
  });

  it('la sesión actual no ofrece botón de cerrar', () => {
    sessionsList.set([
      {
        id: 's1',
        current: true,
        kind: 'WEB',
        browser: 'Chrome',
        operatingSystem: 'Windows',
        lastSeenAt: '2026-09-11T10:00:00Z',
        startedAt: '2026-09-11T09:00:00Z',
        expiresAt: null,
        scopes: [],
      },
      {
        id: 's2',
        current: false,
        kind: 'DESKTOP_APP',
        browser: null,
        operatingSystem: 'Windows',
        lastSeenAt: '2026-09-10T10:00:00Z',
        startedAt: '2026-09-10T09:00:00Z',
        expiresAt: null,
        scopes: ['matches:upload'],
      },
    ]);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.settings-account button[variant="danger"]');
    // One for the non-current session + one for "Cerrar sesión" at the bottom
    expect(buttons.length).toBe(2);
  });

  it('cerrar sesión abre modal de confirmación y al confirmar ejecuta el logout', async () => {
    expect(component.confirmLogout()).toBe(false);
    component.confirmLogout.set(true);
    fixture.detectChanges();

    await component.logout();
    expect(authLogoutSpy).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });
});
