import { ActiveSession } from './models';
import { desktopAppMeta, scopeLabels, sessionLabel } from './session-label';

function session(partial: Partial<ActiveSession>): ActiveSession {
  return {
    id: 'sess-1',
    kind: 'WEB',
    browser: null,
    operatingSystem: null,
    scopes: [],
    startedAt: '2026-09-01T10:00:00Z',
    lastSeenAt: '2026-09-04T09:00:00Z',
    expiresAt: null,
    current: false,
    ...partial,
  };
}

/**
 * Lo que se protege aquí no es el copy, es la regla: **un `null` del backend nunca se rellena con
 * una suposición.** El backend manda `null` cuando el `User-Agent` no lo dice, precisamente para
 * no inventar; si esta función completara el hueco con un valor plausible, esa decisión se perdería
 * en el último metro y el usuario leería una etiqueta que no corresponde a ningún dispositivo suyo.
 */
describe('sessionLabel', () => {
  it('junta navegador y sistema cuando se saben los dos', () => {
    expect(sessionLabel(session({ browser: 'Chrome', operatingSystem: 'Windows' }))).toBe(
      'Chrome en Windows',
    );
  });

  it('con media respuesta dice la mitad que sabe, y no adivina la otra', () => {
    expect(sessionLabel(session({ browser: 'Firefox' }))).toBe('Firefox');
    expect(sessionLabel(session({ operatingSystem: 'Android' }))).toBe('Android');
  });

  it('sin nada reconocido lo dice, en vez de fingir un dispositivo', () => {
    expect(sessionLabel(session({}))).toBe('Dispositivo desconocido');
  });

  /** La app de escritorio no es un navegador: "desconocido" ahí sería confuso, no honesto. */
  it('una sesión de escritorio sin datos se llama por lo que es', () => {
    expect(sessionLabel(session({ kind: 'DESKTOP_APP' }))).toBe('App de escritorio');
  });

  it('una sesión de escritorio que sí dice su sistema lo usa', () => {
    expect(sessionLabel(session({ kind: 'DESKTOP_APP', operatingSystem: 'Windows' }))).toBe(
      'Windows',
    );
  });
});

/**
 * Las dos líneas de la fila salen del mismo dato, y por eso se pisaban: el título ya decía "App de
 * escritorio" y el subtítulo volvía a empezar por lo mismo. Lo que se protege aquí es que la
 * segunda línea sigue diciendo qué es cuando el título habla de otra cosa, y se calla cuando no
 * aporta nada.
 */
describe('desktopAppMeta', () => {
  /**
   * El caso normal, no el raro: `cgc-scraper` manda `CGC-MatchExporter/<versión>` y de ahí el
   * backend no saca ni navegador ni sistema, así que el título ya es "App de escritorio".
   */
  it('se calla cuando el título ya dice que es la app de escritorio', () => {
    expect(desktopAppMeta(session({ kind: 'DESKTOP_APP' }))).toBeNull();
  });

  /** Si el título dice el sistema, la segunda línea es la única que puede decir qué programa es. */
  it('lo dice cuando el título habla de otra cosa', () => {
    expect(desktopAppMeta(session({ kind: 'DESKTOP_APP', operatingSystem: 'Windows' }))).toBe(
      'App de escritorio',
    );
  });

  it('una sesión de navegador no lo menciona nunca', () => {
    expect(desktopAppMeta(session({ browser: 'Chrome', operatingSystem: 'Windows' }))).toBeNull();
    expect(desktopAppMeta(session({}))).toBeNull();
  });
});

describe('scopeLabels', () => {
  it('traduce los scopes conocidos', () => {
    expect(scopeLabels(['profile:read', 'matches:upload'])).toBe('Leer perfil · Subir partidas');
  });

  /** Un scope nuevo del backend sale crudo, pero sale: nunca desaparece ni rompe la fila. */
  it('un scope sin traducir se pinta tal cual', () => {
    expect(scopeLabels(['matches:delete'])).toBe('matches:delete');
  });

  it('sin scopes no pinta nada', () => {
    expect(scopeLabels([])).toBe('');
  });
});
