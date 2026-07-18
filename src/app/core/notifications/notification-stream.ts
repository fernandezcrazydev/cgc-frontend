import { NotificationResponse } from './models';

/** Callbacks del stream. `onError` cubre tanto el fin de conexión como un fallo de red. */
export interface NotificationStreamHandlers {
  /** Una notificación nueva (evento `notification`), ya parseada. */
  onNotification: (notification: NotificationResponse) => void;
  /** La conexión se abrió (útil para reintentos: resetear el backoff). */
  onOpen?: () => void;
  /** La conexión terminó o falló. `aborted` = la cerramos nosotros (no reconectar). */
  onClose?: (aborted: boolean) => void;
}

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
        handlers.onClose?.(false);
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
          emitFrame(frame, handlers.onNotification);
        }
      }
      handlers.onClose?.(false);
    } catch (error) {
      // AbortError = lo cerramos nosotros; cualquier otro = caída real de la conexión.
      const aborted = error instanceof DOMException && error.name === 'AbortError';
      handlers.onClose?.(aborted);
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
 * Parsea un frame SSE (`event: ...`, `data: ...`) y, si es un `notification` con JSON
 * válido, lo emite. Varias líneas `data:` se concatenan con `\n` (estándar SSE). Ignora
 * silenciosamente comentarios (`:` heartbeat) y frames de otros tipos.
 */
function emitFrame(frame: string, onNotification: (n: NotificationResponse) => void): void {
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
  if (event !== 'notification' || dataLines.length === 0) return;
  try {
    onNotification(JSON.parse(dataLines.join('\n')) as NotificationResponse);
  } catch {
    // Un frame corrupto no debe tumbar el stream: se descarta y seguimos leyendo.
  }
}
