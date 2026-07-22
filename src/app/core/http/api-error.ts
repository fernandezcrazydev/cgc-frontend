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
  DUPLICATE_PENDING_INVITATION: 'Este usuario ya tiene una invitación pendiente.',
  GROUP_QUOTA_EXCEEDED: 'Has alcanzado el número máximo de grupos que puedes tener.',
  IMAGE_TOO_LARGE: 'La imagen es demasiado grande. Usa uno más ligero.',
  INVALID_RIOT_ID: 'Ese Riot ID no es válido. Debe ser «Nombre#TAG», tal y como aparece en el cliente.',
  INVITATION_NOT_FOUND: 'Esa invitación ya no existe.',
  INVITATION_NOT_PENDING: 'Esa invitación ya no está pendiente: se aceptó, se rechazó o se canceló.',
  INVITEE_NOT_FOUND: 'No se ha encontrado ese usuario.',
  INVITEE_REFUSES_INVITATIONS: 'Este usuario no acepta invitaciones a grupos nuevos.',
  RIOT_ACCOUNT_ALREADY_LINKED:
    'Esa cuenta de Riot ya está vinculada por otro usuario. Si es tuya, pídele que la desvincule.',
  RIOT_ACCOUNT_NOT_LINKED: 'No tienes ninguna cuenta de Riot vinculada.',
  RIOT_RELINK_ON_COOLDOWN:
    'Has desvinculado tu cuenta hace poco. Puedes volver a poner la misma, pero para vincular otra distinta tendrás que esperar.',
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
