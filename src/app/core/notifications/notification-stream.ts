import { NotificationResponse } from './models';

/**
 * Por qué terminó el stream. `aborted` = lo cerramos nosotros (no reconectar). `status` es el
 * código HTTP cuando el servidor rechazó la conexión de entrada, y null si el stream llegó a
 * abrirse y luego murió (fin de cuerpo, red caída). El 401 importa: significa token muerto, y
 * eso se arregla renovando, no reintentando con el mismo Bearer.
 */
export interface NotificationStreamClose {
  aborted: boolean;
  status: number | null;
}

/** Callbacks del stream. `onClose` cubre tanto el fin de conexión como un fallo de red. */
export interface NotificationStreamHandlers {
  /** Una notificación nueva (evento `notification`), ya parseada. */
  onNotification: (notification: NotificationResponse) => void;
  /**
   * Un aviso de "algo cambió, vuelve a leerlo" (evento `lobby`). NO trae el dato: solo los ids
   * de lo que hay que refrescar, porque la fuente de verdad es Postgres y no este mensaje. Por
   * eso perder uno solo cuesta una pantalla desactualizada hasta la siguiente acción.
   */
  onNudge?: (event: string, data: Record<string, string>) => void;
  /** La conexión se abrió (útil para reintentos: resetear el backoff). */
  onOpen?: () => void;
  /** La conexión terminó o falló. Ver `NotificationStreamClose`. */
  onClose?: (reason: NotificationStreamClose) => void;
}

/** Eventos que NO son de la campana y llegan por el mismo stream, como avisos de refetch. */
const NUDGE_EVENTS = new Set(['lobby']);

/**
 * Abre el stream SSE de notificaciones con un `fetch` que SÍ puede poner el Bearer
 * —el `EventSource` nativo del navegador no deja fijar cabeceras, y el endpoint es una
 * ruta bearer normal (backend `NotificationStreamController`)—. Lee el cuerpo como
 * texto en streaming, parte por frames SSE (línea en blanco) y emite cada evento
 * `notification`.
 *
 * Devuelve una función para cerrar el stream (aborta el `fetch`). No reintenta: la
 * política de reconexión vive en el store, que sabe cuándo pedir token nuevo y
 * resincronizar la bandeja. Transporte puro, sin Angular.
 */
export function openNotificationStream(
  url: string,
  token: string,
  handlers: NotificationStreamHandlers,
): () => void {
  const controller = new AbortController();

  void (async () => {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        // El status viaja al llamante: un 401 aquí es "renueva el token", no "reintenta igual".
        handlers.onClose?.({ aborted: false, status: response.status });
        return;
      }
      handlers.onOpen?.();

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Los frames SSE se separan por una línea en blanco (\n\n). Acumulamos hasta
      // tenerla y procesamos frame a frame; lo que sobra queda para la próxima lectura.
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = indexOfFrameEnd(buffer)) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep).replace(/^(\r?\n){1,2}/, '');
          emitFrame(frame, handlers);
        }
      }
      handlers.onClose?.({ aborted: false, status: null });
    } catch (error) {
      // AbortError = lo cerramos nosotros; cualquier otro = caída real de la conexión.
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      handlers.onClose?.({ aborted, status: null });
    }
  })();

  return () => controller.abort();
}

/** Índice del final del primer frame (primera línea en blanco), o -1 si aún no llegó. */
function indexOfFrameEnd(buffer: string): number {
  const lf = buffer.indexOf('\n\n');
  const crlf = buffer.indexOf('\r\n\r\n');
  if (lf === -1) return crlf;
  if (crlf === -1) return lf;
  return Math.min(lf, crlf);
}

/**
 * Parsea un frame SSE (`event: ...`, `data: ...`) y lo despacha por su NOMBRE de evento: la
 * campana (`notification`) y los avisos de refetch (`lobby`) comparten un único stream por
 * usuario. Varias líneas `data:` se concatenan con `\n` (estándar SSE).
 *
 * Un nombre desconocido se ignora en silencio, y eso es deliberado: el backend puede añadir un
 * tipo de evento sin romper a un cliente que todavía no sabe qué hacer con él. Los comentarios
 * (`:` del heartbeat que manda el servidor cada 15 s para que el túnel no corte) también.
 */
function emitFrame(frame: string, handlers: NotificationStreamHandlers): void {
  let event = 'message';
  const dataLines: string[] = [];
  for (const rawLine of frame.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line === '' || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    // Un único espacio tras los dos puntos es parte del formato y se descarta.
    const rawValue = colon === -1 ? '' : line.slice(colon + 1);
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
  }
  if (dataLines.length === 0) return;
  try {
    const payload = JSON.parse(dataLines.join('\n'));
    if (event === 'notification') {
      handlers.onNotification(payload as NotificationResponse);
    } else if (NUDGE_EVENTS.has(event)) {
      handlers.onNudge?.(event, payload as Record<string, string>);
    }
  } catch {
    // Un frame corrupto no debe tumbar el stream: se descarta y seguimos leyendo.
  }
}
