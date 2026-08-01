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
 * En frase normal a propósito: las MAYÚSCULAS del antetítulo son decoración de la skin y las
 * pone `nf-caps` en la plantilla, no el copy (CLAUDE.md § UI kit). Los otros títulos de este
 * fichero siguen gritando en el literal; es deuda anterior, no el patrón a copiar.
 */
const FEEDBACK_EYEBROW: Record<string, string> = {
  BUG: 'Nuevo bug',
  PROPOSAL: 'Nueva sugerencia',
  INCIDENT: 'Nueva incidencia',
};

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
        title: 'INVITACIÓN A GRUPO',
        message: invitedByName
          ? `${invitedByName} te invitó a unirte a ${groupName}`
          : `Te invitaron a unirte a ${groupName}`,
        accent: 'var(--nf-pink)',
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
        title: 'CUENTA VINCULADA',
        message: `Vinculamos ${riotId} desde la app de escritorio`,
        accent: 'var(--nf-cyan)',
        glyph: '↔',
        invite: null,
      };
    }
    case 'RIOT_ACCOUNT_VERIFIED': {
      const riotId = n.data['riotId'] ?? 'tu cuenta de Riot';
      return {
        ...base,
        title: 'CUENTA VERIFICADA',
        message: `Comprobamos con Riot que ${riotId} es tuya`,
        accent: 'var(--nf-green)',
        glyph: '✓',
        invite: null,
      };
    }
    case 'RIOT_ACCOUNT_TAKEN_OVER': {
      const riotId = n.data['riotId'] ?? 'tu cuenta de Riot';
      return {
        ...base,
        title: 'CUENTA DESVINCULADA',
        message: `Alguien demostró ser el dueño de ${riotId} y se ha desvinculado de tu perfil`,
        accent: 'var(--nf-red)',
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
        accent: 'var(--nf-purple)',
        glyph: '⚑',
        invite: null,
        // Sin id no hay detalle al que ir: mejor una fila que informa y no navega que un
        // clic que aterriza en un 404.
        link: feedbackId ? ['/app', 'admin', 'feedback', feedbackId] : null,
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
