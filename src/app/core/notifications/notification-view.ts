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
  /**
   * A dónde lleva pulsar la notificación, en comandos de router (`['/app', 'admin', …]`), o
   * `null` si no lleva a ninguna parte. Comandos y no una URL en texto a propósito: el router
   * codifica cada segmento, así que un id con `/` o `..` no puede reescribir la ruta.
   */
  link: readonly string[] | null;
}

export interface InviteView {
  invitationId: string;
  groupId: string;
  groupName: string;
  /** Nombre de quien invita, cuando el backend lo manda; null si no. */
  invitedByName: string | null;
}

/**
 * Antetítulo por clase de reporte (`kind` de `FEEDBACK_SUBMITTED`). El género cambia con la
 * palabra ("nuevo bug" pero "nueva sugerencia"), así que se escribe entero en vez de componerlo.
 * Un `kind` que el backend añada y este mapa no tenga cae al genérico, no rompe la campana.
 *
 * En frase normal, como todo el copy de la app (CLAUDE.md § UI kit): ningún componente
 * transforma el texto que recibe, así que lo que se escribe aquí es lo que se pinta.
 */
const FEEDBACK_EYEBROW: Record<string, string> = {
  BUG: 'Nuevo bug',
  PROPOSAL: 'Nueva sugerencia',
  INCIDENT: 'Nueva incidencia',
};

/**
 * A dónde lleva una notificación de convocatoria: a su sala dentro del grupo. Sin los dos ids no
 * hay destino, y entonces la fila informa pero no navega — mejor eso que un clic que aterriza en
 * un 404 (mismo criterio que `FEEDBACK_SUBMITTED`).
 */
function lobbyLink(n: NotificationResponse): readonly string[] | null {
  const groupId = n.data['groupId'];
  const lobbyId = n.data['lobbyId'];
  return groupId && lobbyId ? ['/app', 'grupos', groupId, 'partidas', lobbyId] : null;
}

/**
 * Instante ISO-8601 → "jue 7, 22:00" en la zona del que lee. Formatear aquí y no en la plantilla
 * porque el texto de la notificación se compone entero en este fichero; el backend siempre manda
 * UTC y quién lo lee decide en qué hora lo ve.
 */
function formatKickoff(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Mapea un DTO de notificación a su modelo de presentación. `now` inyectable para tests. */
export function notificationView(n: NotificationResponse, now = Date.now()): NotificationView {
  const base = {
    id: n.id,
    read: n.read,
    time: timeAgo(n.createdAt, now),
    // Por defecto una notificación no navega: informa. Cada `case` que sí lleve a algún
    // sitio lo sobrescribe.
    link: null,
  };
  switch (n.type) {
    case 'INVITED_TO_GROUP': {
      const groupName = n.data['groupName'] ?? 'un grupo';
      const invitedByName = n.data['invitedByName'] ?? null;
      return {
        ...base,
        title: 'Invitación a grupo',
        message: invitedByName
          ? `${invitedByName} te invitó a unirte a ${groupName}`
          : `Te invitaron a unirte a ${groupName}`,
        accent: 'var(--nf-primary)',
        glyph: '►',
        invite: {
          invitationId: n.data['invitationId'] ?? '',
          groupId: n.data['groupId'] ?? '',
          groupName,
          invitedByName,
        },
      };
    }
    case 'RIOT_ACCOUNT_PAIRED': {
      const riotId = n.data['riotId'] ?? 'tu cuenta de Riot';
      return {
        ...base,
        title: 'Cuenta vinculada',
        message: `Vinculamos ${riotId} desde la app de escritorio`,
        accent: 'var(--nf-secondary)',
        glyph: '↔',
        invite: null,
      };
    }
    case 'RIOT_ACCOUNT_VERIFIED': {
      const riotId = n.data['riotId'] ?? 'tu cuenta de Riot';
      return {
        ...base,
        title: 'Cuenta verificada',
        message: `Comprobamos con Riot que ${riotId} es tuya`,
        accent: 'var(--nf-success)',
        glyph: '✓',
        invite: null,
      };
    }
    case 'RIOT_ACCOUNT_TAKEN_OVER': {
      const riotId = n.data['riotId'] ?? 'tu cuenta de Riot';
      return {
        ...base,
        title: 'Cuenta desvinculada',
        message: `Alguien demostró ser el dueño de ${riotId} y se ha desvinculado de tu perfil`,
        accent: 'var(--nf-danger)',
        glyph: '⊘',
        invite: null,
      };
    }
    case 'FEEDBACK_SUBMITTED': {
      // Solo la reciben los ADMIN, así que el destino existe para quien la ve. `title` ya
      // viene recortado del backend (se copia una fila por admin), no se recorta otra vez.
      const feedbackId = n.data['feedbackId'] ?? '';
      return {
        ...base,
        title: FEEDBACK_EYEBROW[n.data['kind'] ?? ''] ?? 'Nuevo reporte',
        message: n.data['title'] ?? 'Alguien ha enviado un reporte',
        accent: 'var(--nf-tertiary)',
        glyph: '⚑',
        invite: null,
        // Sin id no hay detalle al que ir: mejor una fila que informa y no navega que un
        // clic que aterriza en un 404.
        link: feedbackId ? ['/app', 'admin', 'feedback', feedbackId] : null,
      };
    }
    case 'LOBBY_OPENED': {
      const who = n.data['openedByName'] ?? 'Alguien';
      const groupName = n.data['groupName'] ?? 'tu grupo';
      return {
        ...base,
        title: 'Partida convocada',
        message: `${who} ha convocado una partida en ${groupName}. Di a qué horas puedes`,
        accent: 'var(--nf-secondary)',
        glyph: '📣',
        invite: null,
        link: lobbyLink(n),
      };
    }
    case 'LOBBY_CONFIRMED': {
      const startsAt = n.data['startsAt'];
      return {
        ...base,
        title: 'Partida confirmada',
        // La hora es EL dato de esta notificación, así que va en el texto y no solo en el detalle.
        message: startsAt
          ? `Ya hay hora: ${formatKickoff(startsAt)}`
          : 'La partida ya tiene hora',
        accent: 'var(--nf-success)',
        glyph: '✓',
        invite: null,
        link: lobbyLink(n),
      };
    }
    case 'LOBBY_PROMOTED': {
      const startsAt = n.data['startsAt'];
      return {
        ...base,
        title: 'Entras a jugar',
        // La única de la familia que es urgente de verdad: cambia lo que tienes que hacer esta
        // noche sin que tú hayas hecho nada.
        message: startsAt
          ? `Se ha caído alguien y entras tú: ${formatKickoff(startsAt)}`
          : 'Se ha caído alguien y entras tú',
        accent: 'var(--nf-primary)',
        glyph: '▲',
        invite: null,
        link: lobbyLink(n),
      };
    }
    case 'LOBBY_CANCELLED': {
      const groupName = n.data['groupName'] ?? 'tu grupo';
      return {
        ...base,
        title: 'Partida cancelada',
        message: `Se ha cancelado la partida de ${groupName}`,
        accent: 'var(--nf-danger)',
        glyph: '⊘',
        invite: null,
        // Sin enlace: la sala sigue existiendo pero no hay nada que hacer en ella.
      };
    }
    default:
      // Un tipo que el backend añada y el front aún no conozca: se muestra, no se rompe.
      return {
        ...base,
        title: 'Notificación',
        message: '',
        accent: 'var(--nf-warning)',
        glyph: '⊙',
        invite: null,
      };
  }
}

/**
 * Fecha ISO-8601 → antigüedad compacta ("Ahora" / "5 min" / "3 h" / "2 d"), al
 * estilo de la campana. Presentación pura; el backend manda siempre UTC ISO-8601.
 */
export function timeAgo(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return 'Ahora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
}
