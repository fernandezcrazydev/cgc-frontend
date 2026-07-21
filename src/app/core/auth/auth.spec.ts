import { TestBed } from '@angular/core/testing';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { Observable, of, throwError } from 'rxjs';
import { Auth } from './auth';
import { Session } from './session';

/**
 * Doble del servicio de la librería OIDC con solo lo que `Auth` consume.
 *
 * `checkAuthIncludingServer` es configurable por caso porque ahí vive el matiz que
 * ya nos mordió una vez: a diferencia de `checkAuth`, ese método EMITE UN ERROR
 * cuando el refresh falla (sin refresh token, caducado o revocado) en vez de
 * devolver `isAuthenticated: false`. `Auth.isAuthenticated` tiene que absorberlo.
 */
class OidcStub {
  authorizeCalls = 0;
  logoffCalls = 0;

  checkResult: () => Observable<{ isAuthenticated: boolean }> = () => of({ isAuthenticated: false });
  payload: unknown = {};

  authorize(): void {
    this.authorizeCalls++;
  }

  logoff(): Observable<unknown> {
    this.logoffCalls++;
    return of(null);
  }

  checkAuthIncludingServer(): Observable<{ isAuthenticated: boolean }> {
    return this.checkResult();
  }

  getPayloadFromAccessToken(): Observable<unknown> {
    return of(this.payload);
  }
}

/** `Session` solo se toca en `logout()`; con registrar el `clear()` basta. */
class SessionStub {
  clearCalls = 0;
  clear(): void {
    this.clearCalls++;
  }
}

describe('Auth', () => {
  let auth: Auth;
  let oidc: OidcStub;
  let session: SessionStub;

  beforeEach(() => {
    // El candado del auto-login vive en sessionStorage; sin esto un test contamina al siguiente.
    sessionStorage.clear();
    oidc = new OidcStub();
    session = new SessionStub();
    TestBed.configureTestingModule({
      providers: [
        Auth,
        { provide: OidcSecurityService, useValue: oidc },
        { provide: Session, useValue: session },
      ],
    });
    auth = TestBed.inject(Auth);
  });

  describe('isAuthenticated', () => {
    it('es true cuando la librería confirma la sesión', async () => {
      oidc.checkResult = () => of({ isAuthenticated: true });
      expect(await auth.isAuthenticated()).toBe(true);
    });

    it('es false cuando la librería dice que no hay sesión', async () => {
      oidc.checkResult = () => of({ isAuthenticated: false });
      expect(await auth.isAuthenticated()).toBe(false);
    });

    /**
     * La regresión que provocó el "COMPROBANDO SESIÓN…" infinito: si esto vuelve a
     * dejar propagar el error en vez de devolver false, el login se queda clavado.
     */
    it('devuelve false —nunca lanza— cuando el refresh falla', async () => {
      oidc.checkResult = () => throwError(() => new Error('invalid_grant'));
      await expect(auth.isAuthenticated()).resolves.toBe(false);
    });

    /**
     * La rama de refresh-token de la librería no trae timeout propio: sin nuestra
     * red de seguridad, un /oauth2/token que no responde colgaría la comprobación
     * para siempre. Con relojes falsos comprobamos que a los 10 s se rinde en false.
     */
    it('devuelve false si la comprobación no responde (timeout)', async () => {
      vi.useFakeTimers();
      try {
        oidc.checkResult = () => new Observable<{ isAuthenticated: boolean }>(() => {});
        const pending = auth.isAuthenticated();
        await vi.advanceTimersByTimeAsync(10_000);
        await expect(pending).resolves.toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('roles', () => {
    it('lee el claim `roles` del access token', async () => {
      oidc.payload = { roles: ['ADMIN', 'USER'] };
      expect(await auth.roles()).toEqual(['ADMIN', 'USER']);
      expect(await auth.isAdmin()).toBe(true);
    });

    it('sin claim `roles` devuelve lista vacía y no es admin', async () => {
      oidc.payload = { sub: '123' };
      expect(await auth.roles()).toEqual([]);
      expect(await auth.isAdmin()).toBe(false);
    });

    it('descarta entradas que no son string en vez de fiarse del token', async () => {
      oidc.payload = { roles: ['ADMIN', 42, null, 'USER'] };
      expect(await auth.roles()).toEqual(['ADMIN', 'USER']);
    });

    it('tolera un payload nulo (token ausente o ilegible)', async () => {
      oidc.payload = null;
      expect(await auth.roles()).toEqual([]);
      expect(await auth.isAdmin()).toBe(false);
    });
  });

  it('loginWithDiscord arranca el flujo OAuth de la librería', () => {
    auth.loginWithDiscord();
    expect(oidc.authorizeCalls).toBe(1);
  });

  /**
   * El candado del auto-login protege dos cosas que se rompen en silencio: el
   * bucle infinito de redirects cuando un login automático fracasa, y el logout
   * imposible (cerrar sesión y que prompt=none te vuelva a meter al instante).
   */
  describe('auto-login', () => {
    it('una pestaña recién abierta tiene derecho a un intento automático', () => {
      expect(auth.autoLoginAvailable()).toBe(true);
    });

    it('salir hacia el Authorization Server echa el candado: un fracaso no se relanza en bucle', () => {
      auth.loginWithDiscord();
      expect(auth.autoLoginAvailable()).toBe(false);
    });

    it('un login con éxito devuelve el derecho al intento automático', () => {
      auth.loginWithDiscord();
      auth.resumeAutoLogin();
      expect(auth.autoLoginAvailable()).toBe(true);
    });

    it('el logout echa el candado: sin él, prompt=none volvería a iniciar sesión al instante', async () => {
      await auth.logout();
      expect(auth.autoLoginAvailable()).toBe(false);
    });
  });

  it('logout limpia la sesión local ANTES de cerrar en el servidor', async () => {
    // El orden importa: logoff() acaba en una redirección del navegador y nada de
    // lo que venga después se ejecuta, así que la limpieza local va primero.
    const order: string[] = [];
    session.clear = () => void order.push('clear');
    oidc.logoff = () => {
      order.push('logoff');
      return of(null);
    };

    await auth.logout();

    expect(order).toEqual(['clear', 'logoff']);
  });
});
