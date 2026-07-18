import { NotificationResponse } from './models';

/**
 * Modelo de presentación de una notificación: lo que la campana y el panel del home
 * necesitan pintar, derivado del DTO crudo. Derivación pura (sin estado, sin Angular):
 * traducir `type` + `data` a texto en español y a los tokens visuales vive aquí, no
 * repartido por las plantillas.
 */
export interface NotificationView {
  id: string;
  /** Antetítulo en mono, p. ej. "INVITACIÓN A GRUPO". */
  title: string;
  message: string;
  /** Token de color `--nf-*` para icono, título y punto de no leído. */
  accent: string;
  glyph: string;
  /** Tiempo relativo ya formateado, p. ej. "AHORA", "5 MIN", "3 H". */
  time: string;
  read: boolean;
  /** Presente en `INVITED_TO_GROUP`: habilita las acciones aceptar/rechazar. */
  invite: InviteView | null;
}

export interface InviteView {
  invitationId: string;
  groupId: string;
  groupName: string;
}

/** Mapea un DTO de notificación a su modelo de presentación. `now` inyectable para tests. */
export function notificationView(n: NotificationResponse, now = Date.now()): NotificationView {
  const base = {
    id: n.id,
    read: n.read,
    time: timeAgo(n.createdAt, now),
  };
  switch (n.type) {
    case 'INVITED_TO_GROUP': {
      const groupName = n.data['groupName'] ?? 'un grupo';
      return {
        ...base,
        title: 'INVITACIÓN A GRUPO',
        message: `Te invitaron a unirte a ${groupName}`,
        accent: 'var(--nf-pink)',
        glyph: '►',
        invite: {
          invitationId: n.data['invitationId'] ?? '',
          groupId: n.data['groupId'] ?? '',
          groupName,
        },
      };
    }
    default:
      // Un tipo que el backend añada y el front aún no conozca: se muestra, no se rompe.
      return {
        ...base,
        title: 'NOTIFICACIÓN',
        message: '',
        accent: 'var(--nf-yellow)',
        glyph: '⊙',
        invite: null,
      };
  }
}

/**
 * Fecha ISO-8601 → antigüedad compacta en mono ("AHORA" / "5 MIN" / "3 H" / "2 D"), al
 * estilo de la campana. Presentación pura; el backend manda siempre UTC ISO-8601.
 */
export function timeAgo(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return 'AHORA';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} MIN`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} H`;
  const days = Math.floor(hours / 24);
  return `${days} D`;
}
