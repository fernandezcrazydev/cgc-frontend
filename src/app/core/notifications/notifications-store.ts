import { Injectable, computed, inject, signal } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { firstValueFrom } from 'rxjs';
import { NotificationsApi } from './notifications-api';
import { NotificationResponse } from './models';
import { openNotificationStream } from './notification-stream';

export type NotificationsStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Tope de reintentos de reconexión del stream: 1s → 2s → … hasta 30s. */
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

/** Tamaño de página de la bandeja (debe ir alineado con el default del backend). */
const PAGE_SIZE = 30;

/**
 * Estado compartido de la campana, backed por el backend real. Clon de `Session`
 * (`ensureLoaded`/`reload`/`clear`) para la bandeja durable, MÁS una capa en vivo por
 * SSE: `connect()` abre el stream y cada notificación nueva entra en la lista sin
 * recargar. El contador de no leídas se deriva de la lista (una sola fuente de verdad),
 * así que marcar leída o recibir una nueva mueve el badge solo.
 *
 * Reconexión: el JWT se valida una vez al conectar; cuando caduca (o se cae la red) el
 * stream termina y aquí se reconecta con backoff y token nuevo, resincronizando la
 * bandeja con `reload()` — el diseño del backend cuenta con esto (nada se pierde: la
 * fila ya es durable y se relee de `GET /me/notifications`).
 */
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly api = inject(NotificationsApi);
  private readonly oidc = inject(OidcSecurityService);

  private readonly _notifications = signal<NotificationResponse[]>([]);
  private readonly _status = signal<NotificationsStatus>('idle');

  /** La carga en vuelo, para que N llamadas concurrentes compartan una petición. */
  private inFlight: Promise<NotificationResponse[]> | null = null;

  readonly notifications = this._notifications.asReadonly();
  readonly status = this._status.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');
  readonly isReady = computed(() => this._status() === 'ready');

  /** Paginación por offset: si queda otra página y si hay una carga de "más" en vuelo. */
  private readonly _hasMore = signal(false);
  private readonly _loadingMore = signal(false);
  readonly hasMore = this._hasMore.asReadonly();
  readonly loadingMore = this._loadingMore.asReadonly();
  /** Índice de la próxima página a pedir (la 0 la trae `load`). */
  private nextPage = 1;

  /** Badge de la campana: derivado, nunca un contador paralelo que se pueda desincronizar. */
  readonly unreadCount = computed(() => this._notifications().filter((n) => !n.read).length);
  readonly hasUnread = computed(() => this.unreadCount() > 0);

  /**
   * Notificaciones que piden un sí/no al usuario. Hoy solo las invitaciones a grupo; el
   * home ("Requiere tu atención") y la campana surften exactamente estas. Si el invitee
   * ya respondió en otra pestaña/dispositivo, la acción devuelve 409 y el llamante
   * recarga — no se filtra aquí por estado de invitación para no acoplar dominios.
   */
  readonly actionable = computed(() =>
    this._notifications().filter((n) => n.type === 'INVITED_TO_GROUP'),
  );

  /**
   * La última notificación llegada por SSE (no por carga inicial). Un `effect` externo la
   * observa para reaccionar a un evento en vivo (p. ej. recargar las invitaciones
   * pendientes cuando entra una `INVITED_TO_GROUP`). Null hasta el primer push.
   */
  private readonly _lastArrived = signal<NotificationResponse | null>(null);
  readonly lastArrived = this._lastArrived.asReadonly();

  /**
   * Devuelve la bandeja, cargándola si hace falta. Idempotente y deduplicada; nunca
   * lanza — un fallo se traduce en `status === 'error'` y lista vacía.
   */
  ensureLoaded(): Promise<NotificationResponse[]> {
    if (this._status() === 'ready') return Promise.resolve(this._notifications());
    return (this.inFlight ??= this.load());
  }

  /** Fuerza una recarga contra el backend (tras reconectar el stream, p. ej.). */
  reload(): Promise<NotificationResponse[]> {
    this.inFlight = null;
    return (this.inFlight ??= this.load());
  }

  private async load(): Promise<NotificationResponse[]> {
    this._status.set('loading');
    try {
      const list = await firstValueFrom(this.api.list(0, PAGE_SIZE));
      this._notifications.set(list);
      this._status.set('ready');
      this.nextPage = 1;
      this._hasMore.set(list.length === PAGE_SIZE);
      return list;
    } catch {
      this._notifications.set([]);
      this._status.set('error');
      this._hasMore.set(false);
      return [];
    } finally {
      this.inFlight = null;
    }
  }

  /**
   * Trae la siguiente página y la añade al final (dedup por id, por si el SSE ya insertó
   * alguna). No reentrante; no-op si no queda más o la bandeja no está lista. Un fallo se
   * traga: `hasMore` sigue true y el usuario puede reintentar.
   */
  async loadMore(): Promise<void> {
    if (!this._hasMore() || this._loadingMore() || this._status() !== 'ready') return;
    this._loadingMore.set(true);
    try {
      const page = await firstValueFrom(this.api.list(this.nextPage, PAGE_SIZE));
      const seen = new Set(this._notifications().map((n) => n.id));
      const fresh = page.filter((n) => !seen.has(n.id));
      this._notifications.update((list) => [...list, ...fresh]);
      this.nextPage++;
      this._hasMore.set(page.length === PAGE_SIZE);
    } catch {
      // Reintentable: no tocamos hasMore.
    } finally {
      this._loadingMore.set(false);
    }
  }

  // ── Escrituras ─────────────────────────────────────────────────────
  /** Ids con un `markRead` en vuelo: evita disparar el POST dos veces por la misma. */
  private readonly markingRead = new Set<string>();

  /**
   * Marca una notificación como leída. Optimista: pinta `read` al instante y revierte si
   * el POST falla (marcar leída no es crítico; la próxima recarga corrige). No reentrante
   * por id. No-op si ya estaba leída o no existe.
   */
  async markRead(notificationId: string): Promise<void> {
    const current = this._notifications().find((n) => n.id === notificationId);
    if (!current || current.read || this.markingRead.has(notificationId)) return;
    this.markingRead.add(notificationId);
    this.patch(notificationId, { read: true });
    try {
      await firstValueFrom(this.api.markRead(notificationId));
    } catch {
      this.patch(notificationId, { read: false });
    } finally {
      this.markingRead.delete(notificationId);
    }
  }

  /**
   * Marca todas como leídas (limpia el badge al abrir la campana) en una sola llamada.
   * Optimista: pinta todo leído y, si el POST falla, resincroniza con la verdad del backend.
   */
  async markAllRead(): Promise<void> {
    if (!this.hasUnread()) return;
    this._notifications.update((list) => list.map((n) => (n.read ? n : { ...n, read: true })));
    try {
      await firstValueFrom(this.api.markAllRead());
    } catch {
      void this.reload();
    }
  }

  /** Ids con un `delete` en vuelo: evita disparar el DELETE dos veces por la misma. */
  private readonly removing = new Set<string>();

  /**
   * Borra una notificación de la bandeja. Optimista: la quita al instante y, si el DELETE
   * falla (que no sea un 404 de "ya no está"), resincroniza. No reentrante por id.
   */
  async remove(notificationId: string): Promise<void> {
    if (this.removing.has(notificationId)) return;
    if (!this._notifications().some((n) => n.id === notificationId)) return;
    this.removing.add(notificationId);
    this._notifications.update((list) => list.filter((n) => n.id !== notificationId));
    try {
      await firstValueFrom(this.api.delete(notificationId));
    } catch {
      void this.reload();
    } finally {
      this.removing.delete(notificationId);
    }
  }

  private patch(id: string, change: Partial<NotificationResponse>): void {
    this._notifications.update((list) =>
      list.map((n) => (n.id === id ? { ...n, ...change } : n)),
    );
  }

  // ── Stream en vivo (SSE) ───────────────────────────────────────────
  private closeStream: (() => void) | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = RECONNECT_BASE_MS;
  /** Generación del intento actual: descarta callbacks de un stream ya reemplazado. */
  private streamGeneration = 0;
  private connected = false;

  /**
   * Abre el stream en vivo (idempotente). Llamar tras `ensureLoaded()`: la bandeja da el
   * estado inicial y el stream, los cambios. Sin token válido no conecta y reintenta.
   */
  connect(): void {
    if (this.connected) return;
    this.connected = true;
    void this.openStream();
  }

  /** Cierra el stream y cancela reintentos. Lo llama `clear()` en el logout. */
  disconnect(): void {
    this.connected = false;
    this.streamGeneration++;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeStream?.();
    this.closeStream = null;
  }

  private async openStream(): Promise<void> {
    if (!this.connected) return;
    const generation = ++this.streamGeneration;
    const token = await this.currentToken();
    if (!this.connected || generation !== this.streamGeneration) return;
    if (!token) {
      // Aún no hay sesión utilizable: reintenta más tarde sin gastar el backoff a tope.
      this.scheduleReconnect(generation);
      return;
    }
    this.closeStream = openNotificationStream(this.api.streamUrl, token, {
      onOpen: () => {
        if (generation !== this.streamGeneration) return;
        // Reconexión exitosa: resetear backoff y resincronizar por si perdimos algo.
        this.reconnectDelay = RECONNECT_BASE_MS;
        void this.reload();
      },
      onNotification: (notification) => {
        if (generation !== this.streamGeneration) return;
        this.ingest(notification);
      },
      onClose: (aborted) => {
        if (aborted || generation !== this.streamGeneration) return;
        this.scheduleReconnect(generation);
      },
    });
  }

  /** Inserta (o actualiza) una notificación llegada en vivo, la más reciente primero. */
  private ingest(notification: NotificationResponse): void {
    this._notifications.update((list) => {
      const rest = list.filter((n) => n.id !== notification.id);
      return [notification, ...rest];
    });
    this._lastArrived.set(notification);
  }

  private scheduleReconnect(generation: number): void {
    if (!this.connected || generation !== this.streamGeneration) return;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openStream();
    }, delay);
  }

  private async currentToken(): Promise<string> {
    try {
      return await firstValueFrom(this.oidc.getAccessToken());
    } catch {
      return '';
    }
  }

  /** Al cerrar sesión no debe quedar rastro ni conexión abierta del usuario anterior. */
  clear(): void {
    this.disconnect();
    this.inFlight = null;
    this.reconnectDelay = RECONNECT_BASE_MS;
    this.nextPage = 1;
    this._hasMore.set(false);
    this._loadingMore.set(false);
    this._notifications.set([]);
    this._status.set('idle');
    this._lastArrived.set(null);
  }
}
