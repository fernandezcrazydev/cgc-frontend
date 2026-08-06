import { HttpErrorResponse } from '@angular/common/http';

/**
 * Manejo de errores de la API, en un único sitio. El backend devuelve RFC 7807
 * (`ProblemDetail`) extendido con un `code` estable y legible por máquina; el front NUNCA
 * pinta `detail` (viene en inglés y es técnico) — traduce `code` a un mensaje en español que
 * es dueño aquí. Ver el contrato en CLAUDE.md § "Formato de error".
 */

/** Un error de campo dentro de un 422; `field` es el nombre del campo del DTO. */
export interface ApiFieldError {
  field: string;
  code: string;
}

/**
 * ProblemDetail (RFC 7807) del backend, ya normalizado a lo que el front necesita. `status 0`
 * = no hubo respuesta (red/timeout/CORS). `code` es null cuando el backend no lo mandó (aún) o
 * el error no vino como ProblemDetail JSON.
 */
export interface ApiError {
  status: number;
  /** Código estable de dominio (`UNSUPPORTED_IMAGE`, ...). null si el backend no lo dio. */
  code: string | null;
  /** El `detail` técnico del backend. Solo para logs/telemetría; jamás para la UI. */
  detail: string | null;
  /** Errores por campo de un 422, para mapear al formulario. Vacío si no aplica. */
  errors: ApiFieldError[];
}

/**
 * Normaliza cualquier fallo de `HttpClient` a `ApiError`. Tolera lo que no es ProblemDetail:
 * error de red (`status 0`), cuerpos no-JSON, o un `error` que ni siquiera es `HttpErrorResponse`
 * (bug del front). Nunca lanza.
 */
export function parseApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: 0, code: null, detail: null, errors: [] };
  }
  const body = error.error;
  const problem = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  return {
    status: error.status,
    code: typeof problem['code'] === 'string' ? problem['code'] : null,
    detail: typeof problem['detail'] === 'string' ? problem['detail'] : null,
    errors: parseFieldErrors(problem['errors']),
  };
}

function parseFieldErrors(raw: unknown): ApiFieldError[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .filter((e) => typeof e['field'] === 'string' && typeof e['code'] === 'string')
    .map((e) => ({ field: e['field'] as string, code: e['code'] as string }));
}

/**
 * Catálogo `code → mensaje en español`. El front es dueño de estos textos; el backend solo
 * manda el `code`. Al añadir un código nuevo en el backend, se añade aquí su traducción.
 * Mantener en orden alfabético.
 */
const MESSAGES_BY_CODE: Record<string, string> = {
  ALREADY_MEMBER: 'Este usuario ya es miembro del grupo.',
  CHAMPION_NOT_FOUND: 'No se ha encontrado ese campeón.',
  DEVICE_NOT_FOUND: 'Ese dispositivo ya no estaba vinculado.',
  DISCORD_API_UNAVAILABLE: 'No hemos podido hablar con Discord ahora mismo. Prueba en un minuto.',
  DISCORD_AUTH_CANCELLED: 'Has cancelado en Discord, así que no se ha conectado nada.',
  DISCORD_AUTH_FAILED: 'Discord no ha confirmado la autorización. Vuelve a intentarlo.',
  DISCORD_AUTH_FORBIDDEN: 'Ya no administras este grupo, así que no puedes cambiar su Discord.',
  DISCORD_AUTH_STATE_INVALID:
    'Ese enlace de vuelta ya no vale: se usa una sola vez y caduca a los diez minutos. Empieza otra vez.',
  DISCORD_BOT_NOT_IN_GUILD:
    'El bot ya no está en ese servidor de Discord. Vuelve a empezar por el paso 1 para meterlo otra vez.',
  DISCORD_CHANNEL_UNREACHABLE:
    'El bot ya no ve ese canal. Puede que lo hayan borrado o que le hayan quitado el permiso para verlo.',
  DISCORD_CHANNEL_WRITE_FAILED:
    'El bot ve el canal pero no puede escribir en él. Dale permiso para enviar mensajes ahí, o elige otro canal.',
  DISCORD_GUILD_MISMATCH: 'Ese canal no pertenece al servidor que has conectado.',
  DISCORD_GUILD_NOT_SELECTED:
    'Este grupo ya no tiene ningún servidor de Discord conectado. Empieza otra vez por el primer paso.',
  DUPLICATE_PENDING_INVITATION: 'Este usuario ya tiene una invitación pendiente.',
  EMPTY_AUDIT_WINDOW: 'Ese periodo está al revés: la fecha de fin debe ser posterior a la de inicio.',
  FEEDBACK_QUOTA_EXCEEDED:
    'Has enviado demasiados reportes en las últimas 24 horas. Prueba de nuevo más tarde.',
  GAME_DATA_UNAVAILABLE: 'El catálogo de datos del juego no está disponible ahora mismo. Inténtalo más tarde.',
  GROUP_QUOTA_EXCEEDED: 'Has alcanzado el número máximo de grupos que puedes tener.',
  IMAGE_TOO_LARGE: 'La imagen es demasiado grande. Usa uno más ligero.',
  INVALID_CLIENT_IP_FILTER:
    'Eso no es una dirección IP. Escribe una dirección (88.98.97.149) o un rango (88.98.97.0/24).',
  INVALID_METRICS_WINDOW:
    'Ese periodo no es válido. Solo guardamos las llamadas a Riot de los últimos 7 días.',
  INVALID_RIOT_ID: 'Ese Riot ID no es válido. Debe ser «Nombre#TAG», tal y como aparece en el cliente.',
  INVITATION_NOT_FOUND: 'Esa invitación ya no existe.',
  INVITATION_NOT_PENDING: 'Esa invitación ya no está pendiente: se aceptó, se rechazó o se canceló.',
  INVITEE_NOT_FOUND: 'No se ha encontrado ese usuario.',
  INVITEE_REFUSES_INVITATIONS: 'Este usuario no acepta invitaciones a grupos nuevos.',
  LOBBY_NOT_FOUND: 'Esa partida ya no existe.',
  LOBBY_NOT_OPEN: 'Esta partida ya no admite gente: se canceló o ya se está jugando.',
  LOBBY_SLOT_NOT_FOUND: 'Esa hora ya no está disponible. Puede que se haya cerrado otra.',
  PRIMARY_LANE_NOT_CHOSEN: 'Tu rol principal tiene que ser uno de los roles que has seleccionado.',
  RIOT_ACCOUNT_ALREADY_LINKED:
    'Esa cuenta de Riot ya está vinculada por otro usuario. Si es tuya, pídele que la desvincule.',
  RIOT_ACCOUNT_NOT_LINKED: 'No tienes ninguna cuenta de Riot vinculada.',
  RIOT_RELINK_ON_COOLDOWN:
    'Has desvinculado tu cuenta hace poco. Puedes volver a poner la misma, pero para vincular otra distinta tendrás que esperar.',
  SECURITY_AUDIT_EVENT_NOT_FOUND:
    'Ese evento ya no está en el registro. Puede que se haya borrado por antigüedad: solo se guardan 90 días.',
  SLOT_IN_THE_PAST: 'Esa hora ya ha pasado. Elige una futura.',
  UNSORTABLE_AUDIT_FIELD: 'El registro de seguridad solo se puede ordenar por fecha.',
  UNSUPPORTED_IMAGE: 'Ese formato de imagen no es válido. Usa JPEG o PNG.',
};

/**
 * Mensajes genéricos por `status` cuando no hay `code` (o es desconocido). Siempre en español,
 * nunca cuelga la vista. `0` = sin respuesta del servidor.
 */
const MESSAGES_BY_STATUS: Record<number, string> = {
  0: 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.',
  403: 'No tienes permiso para hacer esto.',
  404: 'No se ha encontrado el recurso.',
  409: 'La operación entra en conflicto con el estado actual. Recarga e inténtalo de nuevo.',
  422: 'Hay datos que no son válidos. Revisa el formulario.',
};

const FALLBACK = 'Ha ocurrido un error inesperado. Inténtalo de nuevo.';

/**
 * El mensaje en español a mostrar al usuario, con cadena de fallback:
 * 1) `code` conocido → mensaje específico;
 * 2) `code` presente pero desconocido → genérico por status + aviso en consola para catalogarlo;
 * 3) sin `code` → genérico por status;
 * 4) nada de lo anterior → mensaje inespecífico.
 */
export function messageForError(error: ApiError): string {
  if (error.code) {
    const known = MESSAGES_BY_CODE[error.code];
    if (known) return known;
    // El backend mandó un código que el front aún no traduce: catalogarlo cuanto antes.
    console.warn(`[api-error] código sin traducir: ${error.code} (status ${error.status})`);
  }
  return MESSAGES_BY_STATUS[error.status] ?? FALLBACK;
}

/** Atajo para el caso común: de un fallo de `HttpClient` directo al mensaje en español. */
export function errorMessage(error: unknown): string {
  return messageForError(parseApiError(error));
}

/**
 * El mensaje de un `code` suelto, sin respuesta HTTP alrededor.
 *
 * Existe por los errores que no llegan por `HttpClient` sino por la URL: el backend redirige al
 * navegador con `?error=CODE` cuando la ida y vuelta a Discord no sale, y ahí no hay ni `status`
 * ni cuerpo que parsear. Mismo catálogo y mismo aviso por consola para lo que no esté traducido:
 * un `code` no puede querer decir una cosa por HTTP y otra por la barra de direcciones.
 */
export function messageForCode(code: string): string {
  const known = MESSAGES_BY_CODE[code];
  if (known) return known;
  console.warn(`[api-error] código sin traducir: ${code} (sin status)`);
  return FALLBACK;
}
