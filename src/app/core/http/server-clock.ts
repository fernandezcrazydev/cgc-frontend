import { HttpEvent, HttpHandlerFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * El reloj del servidor, para no fiarse del de la máquina del usuario.
 *
 * Las cuentas atrás comparan una fecha que manda el servidor (`endsAt`) con la hora local. Si el
 * reloj del equipo va adelantado media hora, la temporada se da por terminada media hora antes
 * **solo para esa persona**: ve "Finalizada" mientras sus compañeros siguen jugando. No es una
 * hipótesis remota — un portátil que ha estado suspendido, una máquina virtual o un teléfono con
 * la zona horaria mal puestas bastan.
 *
 * El desfase se calcula con la cabecera `Date` de cualquier respuesta de la API, que ya viene en
 * todas y es de lectura permitida entre orígenes sin configurar nada. No hace falta un endpoint.
 */
@Injectable({ providedIn: 'root' })
export class ServerClock {
  /**
   * Milisegundos que hay que sumar a `Date.now()` para obtener la hora del servidor.
   *
   * Arranca en 0, que es "supongo que el reloj local es bueno": es la mejor suposición posible
   * antes de haber hablado con el servidor, y deja de serlo en cuanto llega la primera respuesta.
   */
  private readonly _offsetMs = signal(0);

  readonly offsetMs = this._offsetMs.asReadonly();

  /** Si ya se ha medido contra el servidor al menos una vez. */
  private readonly _synced = signal(false);
  readonly synced = this._synced.asReadonly();

  /**
   * Un desfase por debajo de este umbral se ignora.
   *
   * La cabecera `Date` tiene precisión de segundo y la latencia de red mete su propio ruido, así
   * que perseguir diferencias pequeñas sería corregir el error de medida y no el del reloj. Solo
   * interesa el desajuste que cambia lo que el usuario ve.
   */
  private static readonly MIN_MEANINGFUL_SKEW_MS = 5_000;

  /**
   * Registra la hora del servidor de una respuesta.
   *
   * @param serverTimeMs la de la cabecera `Date`
   * @param sentAtMs cuándo salió la petición, en hora local
   * @param receivedAtMs cuándo llegó la respuesta, en hora local
   */
  record(serverTimeMs: number, sentAtMs: number, receivedAtMs: number): void {
    // Se compara contra el PUNTO MEDIO del viaje, no contra la llegada: la respuesta se generó en
    // algún momento entre la ida y la vuelta, así que atribuirle el instante de llegada contaría la
    // latencia entera como desfase de reloj.
    const localMidpoint = sentAtMs + (receivedAtMs - sentAtMs) / 2;
    const skew = serverTimeMs - localMidpoint;

    this._synced.set(true);
    this._offsetMs.set(Math.abs(skew) < ServerClock.MIN_MEANINGFUL_SKEW_MS ? 0 : skew);
  }

  /** La hora actual según el servidor. Es lo que deben usar las cuentas atrás. */
  now(): number {
    return Date.now() + this._offsetMs();
  }

  /** Para las vistas: una señal que se recalcula cuando cambia el desfase. */
  readonly hasMeaningfulSkew = computed(() => this._offsetMs() !== 0);
}

/**
 * Lee la cabecera `Date` de las respuestas de nuestra API y con ella ajusta {@link ServerClock}.
 *
 * Solo mira las peticiones a `environment.apiUrl`: la hora de un CDN o de Discord no dice nada
 * sobre la del servidor que emite los `endsAt`.
 */
export function serverClockInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const clock = inject(ServerClock);
  const sentAt = Date.now();

  return next(req).pipe(
    tap((event) => {
      if (!(event instanceof HttpResponse)) return;
      const header = event.headers.get('Date');
      if (!header) return;

      const serverTime = Date.parse(header);
      if (Number.isNaN(serverTime)) return;

      clock.record(serverTime, sentAt, Date.now());
    }),
  );
}
