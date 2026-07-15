import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Auth, Session } from '../../core/auth';
import { CurrentUser } from '../../core/auth/current-user';
import { Login } from './login';

const USER: CurrentUser = {
  userId: 'u-1',
  discordUsername: 'Tester',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
};

/** Deja correr unos cuantos microtasks encadenados (isAuthenticated → ensureLoaded). */
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

class AuthStub {
  result: () => Promise<boolean> = () => Promise.resolve(false);
  isAuthenticated(): Promise<boolean> {
    return this.result();
  }
}

class SessionStub {
  user: CurrentUser | null = USER;
  ensureLoaded(): Promise<CurrentUser | null> {
    return Promise.resolve(this.user);
  }
}

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let login: Login;
  let auth: AuthStub;
  let session: SessionStub;
  let navigate: (url: string) => void;
  let navigated: string[];

  beforeEach(async () => {
    auth = new AuthStub();
    session = new SessionStub();
    navigated = [];
    navigate = (url) => void navigated.push(url);

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: Auth, useValue: auth },
        { provide: Session, useValue: session },
        { provide: Router, useValue: { navigateByUrl: navigate } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    login = fixture.componentInstance;
  });

  it('arranca en "checking" mientras comprueba la sesión', () => {
    expect(login.status()).toBe('checking');
    expect(login.isChecking()).toBe(true);
  });

  it('sin sesión, muestra el bloque de acceso', async () => {
    auth.result = () => Promise.resolve(false);
    login.ngOnInit();
    await flush();

    expect(login.status()).toBe('idle');
    expect(login.showAuth()).toBe(true);
  });

  it('con sesión y perfil, entra al lobby', async () => {
    vi.useFakeTimers();
    try {
      auth.result = () => Promise.resolve(true);
      login.ngOnInit();
      await flush();

      expect(login.status()).toBe('success');
      expect(login.userName()).toBe('Tester');

      await vi.advanceTimersByTimeAsync(1100);
      expect(navigated).toEqual(['/app']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('con token pero sin perfil en BD, vuelve al acceso en vez de entrar', async () => {
    auth.result = () => Promise.resolve(true);
    session.user = null;
    login.ngOnInit();
    await flush();

    expect(login.status()).toBe('idle');
  });

  /**
   * El fallo que dejó la pantalla clavada: si la comprobación revienta, el login
   * JAMÁS puede quedarse en 'checking' ("COMPROBANDO SESIÓN…"), que deja al usuario
   * sin salida. Debe caer a 'idle' y ofrecer el botón de Discord.
   */
  it('si la comprobación de sesión lanza, no se queda clavado en "checking"', async () => {
    auth.result = () => Promise.reject(new Error('boom'));
    login.ngOnInit();
    await flush();

    expect(login.status()).toBe('idle');
    expect(login.showAuth()).toBe(true);
  });
});
