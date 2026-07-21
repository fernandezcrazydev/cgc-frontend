import '@angular/compiler';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { of, throwError } from 'rxjs';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { Session } from '../auth/session';
import { sessionRecoveryInterceptor } from './session-recovery';

const API = environment.apiUrl;

/** Deja correr la cola de microtareas: el reintento sale tras resolverse la promesa de refresh. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Doble mínimo de la librería: solo se usa `forceRefreshSession()`. */
function oidcMock(result: unknown, fail = false) {
  return {
    forceRefreshSession: vi.fn(() => (fail ? throwError(() => new Error('no refresh')) : of(result))),
  };
}

describe('sessionRecoveryInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let oidc: ReturnType<typeof oidcMock>;
  let session: { clear: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  function setup(refresh: { ok: boolean; fail?: boolean }) {
    oidc = oidcMock({ isAuthenticated: refresh.ok }, refresh.fail);
    session = { clear: vi.fn() };
    router = { navigateByUrl: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sessionRecoveryInterceptor])),
        provideHttpClientTesting(),
        { provide: OidcSecurityService, useValue: oidc },
        { provide: Session, useValue: session },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  }

  it('ante un 401 renueva el token y reintenta la petición original', async () => {
    setup({ ok: true });
    const done = new Promise((resolve) => http.get(`${API}/me/groups`).subscribe(resolve));

    backend.expectOne(`${API}/me/groups`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await tick();
    backend.expectOne(`${API}/me/groups`).flush([{ groupId: 'g1' }]);

    expect(await done).toEqual([{ groupId: 'g1' }]);
    expect(oidc.forceRefreshSession).toHaveBeenCalledTimes(1);
    expect(session.clear).not.toHaveBeenCalled();
  });

  it('si el refresh falla, cierra la sesión y vuelve al login', async () => {
    setup({ ok: false, fail: true });
    const failed = new Promise((resolve) =>
      http.get(`${API}/me/groups`).subscribe({ error: resolve }),
    );

    backend.expectOne(`${API}/me/groups`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await failed;

    expect(session.clear).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
    backend.verify();
  });

  it('un 401 tras haber refrescado no reintenta otra vez (sin bucle)', async () => {
    setup({ ok: true });
    const failed = new Promise((resolve) =>
      http.get(`${API}/me/groups`).subscribe({ error: resolve }),
    );

    backend.expectOne(`${API}/me/groups`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await tick();
    backend.expectOne(`${API}/me/groups`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await failed;

    expect(oidc.forceRefreshSession).toHaveBeenCalledTimes(1);
    backend.verify();
  });

  it('varias peticiones que caen a la vez comparten UNA sola renovación', async () => {
    setup({ ok: true });
    http.get(`${API}/me/groups`).subscribe({ error: () => {} });
    http.get(`${API}/me`).subscribe({ error: () => {} });

    backend.expectOne(`${API}/me/groups`).flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne(`${API}/me`).flush(null, { status: 401, statusText: 'Unauthorized' });
    await tick();

    expect(oidc.forceRefreshSession).toHaveBeenCalledTimes(1);
    backend.match(() => true).forEach((r) => r.flush({}));
  });

  it('no toca las peticiones que no van a nuestra API', async () => {
    setup({ ok: true });
    const failed = new Promise((resolve) =>
      http.get('https://otro.host/cosa').subscribe({ error: resolve }),
    );
    backend.expectOne('https://otro.host/cosa').flush(null, { status: 401, statusText: 'Unauthorized' });
    await failed;
    expect(oidc.forceRefreshSession).not.toHaveBeenCalled();
  });
});
