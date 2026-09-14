import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  SecurityAuditClient,
  SecurityAuditFilters,
  SecurityAuditKindTag,
  SecurityAuditStore,
} from '../../../../core/admin';
import { errorMessage } from '../../../../core/http';
import { ToastService } from '../../../../core/toast';
import { NfBadge, NfBadgeColor, NfButton, NfPagination, NfSelect, NfSkeleton } from '../../../../ui';

/** Etiquetas legibles de cada tipo de evento. Los enums del backend no se pintan crudos. */
const KIND_LABEL: Record<SecurityAuditKindTag, string> = {
  LOGIN_START: 'Inicio de login',
  LOGIN_SUCCESS: 'Login correcto',
  LOGIN_FAILURE: 'Login fallido',
  LOGOUT: 'Cierre de sesión',
  ACCESS_DENIED: 'Acceso denegado',
};

/**
 * Color de cada tipo. `LOGIN_START` va en aviso y no en neutro a propósito: por sí solo no es
 * malo, pero es el que se dispara cuando alguien abusa, y es el que hay que mirar primero.
 */
const KIND_COLOR: Record<SecurityAuditKindTag, NfBadgeColor> = {
  LOGIN_START: 'warning',
  LOGIN_SUCCESS: 'success',
  LOGIN_FAILURE: 'danger',
  LOGOUT: 'secondary',
  ACCESS_DENIED: 'danger',
};

interface FilterOption<T> {
  tag: T | undefined;
  label: string;
}

const KIND_FILTERS: FilterOption<SecurityAuditKindTag>[] = [
  { tag: undefined, label: 'Todos los tipos' },
  { tag: 'LOGIN_START', label: 'Inicio de login' },
  { tag: 'LOGIN_SUCCESS', label: 'Login correcto' },
  { tag: 'LOGIN_FAILURE', label: 'Login fallido' },
  { tag: 'LOGOUT', label: 'Cierre de sesión' },
  { tag: 'ACCESS_DENIED', label: 'Acceso denegado' },
];

/** Ventanas de tiempo del selector, en horas. `undefined` = todo lo que se guarda. */
const WINDOWS: { hours: number | undefined; label: string }[] = [
  { hours: 24, label: 'Últimas 24 horas' },
  { hours: 24 * 7, label: 'Últimos 7 días' },
  { hours: 24 * 30, label: 'Últimos 30 días' },
  { hours: undefined, label: 'Todo (90 días)' },
];

/**
 * Registro de seguridad (solo ADMIN, protegido por `adminGuard`): quién intenta entrar, desde
 * qué IP y con qué cliente.
 *
 * Se lee de arriba abajo y el orden es deliberado. Primero el **resumen**, que es una forma:
 * miles de inicios de login contra un puñado de logins correctos es la firma de que algo no
 * humano te está machacando la puerta. Luego el **ranking de clientes**, que es la parte
 * accionable — trae la dirección, el país y el User-Agent, que es justo lo que pide una regla de
 * bloqueo. El **listado** al final, para el detalle evento a evento.
 *
 * Nace de un caso real: `spring_session` crecía sin parar y resultaron ser ~4.950 inicios de
 * login abandonados, uno cada 305 segundos, 24 h al día durante semanas, frente a 37 sesiones
 * autenticadas de verdad. Se sabía qué pasaba pero no quién lo hacía.
 */
@Component({
  selector: 'app-admin-seguridad',
  standalone: true,
  imports: [DatePipe, DecimalPipe, NfBadge, NfButton, NfPagination, NfSelect, NfSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-seguridad.html',
  styles: [
    `
      .as-filters {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 12px;
        margin-bottom: 24px;
      }
      .as-filter {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .as-filter__label {
        font-size: 11px;
        color: var(--nf-text-dim);
      }
      .as-filter--ip {
        flex: 1;
        min-width: 220px;
      }
      .as-input {
        padding: 8px 12px;
        border: 1px solid var(--nf-border);
        border-radius: var(--nf-radius);
        background: var(--nf-inset);
        color: var(--nf-text);
        font-size: 13px;
        width: 100%;
      }
      .as-input:focus-visible {
        outline: 2px solid var(--nf-primary);
        outline-offset: 1px;
      }

      .as-section {
        margin-bottom: 32px;
      }
      .as-section__title {
        margin: 0 0 4px;
        font-size: 15px;
        font-weight: 600;
      }
      .as-section__hint {
        margin: 0 0 12px;
        font-size: 12.5px;
        color: var(--nf-text-mid);
      }
      .as-note {
        margin: 12px 0 0;
        font-size: 12.5px;
        color: var(--nf-text-mid);
      }

      .as-tiles {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 10px;
        margin-top: 12px;
      }
      .as-tile {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 14px 16px;
        border: 1px solid var(--nf-border);
        border-radius: 10px;
        background: var(--nf-surface-2);
      }
      /* Un cero es información, pero no es la que se viene a leer: se atenúa sin esconderlo. */
      .as-tile.is-zero {
        opacity: 0.55;
      }
      .as-tile__value {
        font-size: 22px;
        font-weight: 700;
      }
      .as-tile__label {
        font-size: 12px;
        color: var(--nf-text-mid);
      }

      .as-clients,
      .as-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 12px;
        margin-bottom: 16px;
      }
      .as-client {
        display: grid;
        grid-template-columns: minmax(120px, auto) auto 1fr auto auto auto;
        align-items: center;
        gap: 14px;
        padding: 12px 16px;
        border: 1px solid var(--nf-border);
        border-radius: 8px;
        background: var(--nf-surface-2);
      }
      /* El que destaca de verdad. El borde es el único adorno: la cifra ya está al lado. */
      .as-client.is-hot {
        border-color: var(--nf-warning);
      }
      .as-client__ip {
        font-weight: 600;
      }
      .as-client__country,
      .as-client__rate {
        font-size: 12px;
        color: var(--nf-text-dim);
        white-space: nowrap;
      }
      .as-client__ua,
      .as-row__ua,
      .as-row__path {
        font-size: 12px;
        color: var(--nf-text-mid);
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .as-client__events {
        font-size: 15px;
        font-weight: 700;
      }
      .as-client__filter {
        padding: 4px 10px;
        border: 1px solid var(--nf-border);
        border-radius: 999px;
        background: transparent;
        color: var(--nf-text-mid);
        font: inherit;
        font-size: 11px;
        cursor: pointer;
        white-space: nowrap;
      }
      .as-client__filter:hover {
        border-color: var(--nf-primary);
        color: var(--nf-text);
      }

      .as-row {
        display: grid;
        grid-template-columns: auto minmax(110px, auto) minmax(0, 1fr) minmax(0, 1fr) auto;
        align-items: center;
        gap: 14px;
        padding: 10px 16px;
        border: 1px solid var(--nf-border);
        border-radius: 8px;
      }
      .as-row__ip {
        font-size: 12.5px;
      }
      .as-row__when {
        font-size: 12px;
        color: var(--nf-text-dim);
        white-space: nowrap;
      }

      .as-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
        padding: 48px 16px;
        text-align: center;
      }
      .as-empty__text {
        margin: 0;
        color: var(--nf-text-mid);
      }

      @media (max-width: 860px) {
        .as-client {
          grid-template-columns: 1fr auto;
          row-gap: 6px;
        }
        .as-client__ua,
        .as-client__country {
          display: none;
        }
        .as-row {
          grid-template-columns: auto 1fr;
        }
        .as-row__ua,
        .as-row__when {
          display: none;
        }
      }
    `,
  ],
})
export class AdminSeguridad {
  readonly store = inject(SecurityAuditStore);
  private readonly toasts = inject(ToastService);

  readonly kindLabels = KIND_FILTERS.map((o) => o.label);
  readonly windowLabels = WINDOWS.map((o) => o.label);

  readonly kindLabel = signal(KIND_FILTERS[0].label);
  readonly windowLabel = signal(WINDOWS[1].label);
  /** Lo que hay escrito en la caja, que no es lo mismo que el filtro aplicado. */
  readonly ipDraft = signal('');

  /** Tantos como tipos de evento, para que el esqueleto reserve el hueco exacto. */
  readonly skeletonTiles = [0, 1, 2, 3, 4];
  readonly skeletonRows = [0, 1, 2, 3, 4];

  constructor() {
    void this.reload();
  }

  label = (k: SecurityAuditKindTag) => KIND_LABEL[k];
  color = (k: SecurityAuditKindTag) => KIND_COLOR[k];

  /**
   * Si el usuario ha estrechado la búsqueda por su cuenta. Vive aquí y no en el store porque no
   * es una pregunta sobre los datos, es sobre lo que ha tocado la persona: SIEMPRE hay un
   * periodo aplicado, así que «el store tiene filtros» es cierto desde el primer render y no
   * sirve para nada. Decide el texto del estado vacío y si se ofrece «Quitar filtros».
   */
  readonly narrowed = computed(
    () =>
      this.kindLabel() !== KIND_FILTERS[0].label ||
      this.windowLabel() !== WINDOWS[1].label ||
      this.ipDraft().trim() !== '',
  );

  /**
   * La proporción que delata a una máquina: muchos inicios de login y casi ningún login
   * completado. Solo se enseña cuando el desajuste es grande de verdad (más de 20 a 1 y al
   * menos 50 intentos), para que el aviso siga significando algo cuando aparezca.
   */
  readonly abandonRatio = computed(() => {
    const summary = this.store.summary();
    if (!summary) return null;
    const starts = summary.byKind.find((e) => e.kind === 'LOGIN_START')?.events ?? 0;
    const successes = summary.byKind.find((e) => e.kind === 'LOGIN_SUCCESS')?.events ?? 0;
    if (starts < 50 || starts < (successes + 1) * 20) return null;
    return { starts, successes };
  });

  /** Marca al que se sale de la media del ranking: al menos 5 veces la actividad del segundo. */
  isNoisy(client: SecurityAuditClient): boolean {
    const clients = this.store.clients();
    if (!clients || clients.length < 2 || clients[0] !== client) return false;
    return client.events >= clients[1].events * 5;
  }

  onKind(label: string): void {
    this.kindLabel.set(label);
    void this.reload();
  }

  onWindow(label: string): void {
    this.windowLabel.set(label);
    void this.reload();
  }

  applyIp(): void {
    void this.reload();
  }

  /** Atajo desde el ranking: mete la dirección en la caja y recarga con ella. */
  filterByIp(ip: string): void {
    this.ipDraft.set(ip);
    void this.reload();
  }

  clearFilters(): void {
    this.kindLabel.set(KIND_FILTERS[0].label);
    this.windowLabel.set(WINDOWS[1].label);
    this.ipDraft.set('');
    void this.reload();
  }

  async goToPage(oneBased: number): Promise<void> {
    await this.store.load(oneBased - 1);
    this.warnIfFailed();
  }

  async retry(): Promise<void> {
    await this.store.retry();
    this.warnIfFailed();
  }

  private readonly filters = computed<SecurityAuditFilters>(() => {
    const hours = WINDOWS.find((w) => w.label === this.windowLabel())?.hours;
    const ip = this.ipDraft().trim();
    return {
      kind: KIND_FILTERS.find((o) => o.label === this.kindLabel())?.tag,
      clientIp: ip || undefined,
      // Solo `from`: dejar `to` abierto evita que un evento que llega mientras miras la pantalla
      // caiga fuera de la ventana por un segundo.
      from: hours ? new Date(Date.now() - hours * 3600_000).toISOString() : undefined,
    };
  });

  private async reload(): Promise<void> {
    await this.store.applyFilters(this.filters());
    this.warnIfFailed();
  }

  /**
   * El store no lanza (una carga parcial sigue siendo útil), así que el aviso se da aquí. El
   * caso típico es un 400 por una dirección mal escrita, y ahí el mensaje concreto importa:
   * dice exactamente qué formato se espera.
   */
  private warnIfFailed(): void {
    const error = this.store.lastError();
    if (error) this.toasts.error(errorMessage(error));
  }
}
