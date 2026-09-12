import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorCode } from './api-error-codes';

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
  /** Código estable de dominio (`INVALID_AVATAR`, ...). null si el backend no lo dio. */
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
 *
 * Tipado contra `ApiErrorCode`, que se genera desde el backend (`npm run api:types`), y **sin
 * `Partial` a propósito**: la tabla tiene que cubrir los 98 códigos que el backend puede devolver.
 * Eso hace que el compilador avise en los dos sentidos —una clave que el backend ya no manda es
 * una traducción muerta; un código nuevo suyo no compila hasta que alguien le escribe el texto—,
 * que es justo el aviso que antes dependía de que alguien se acordara de darlo. Comprobado que
 * puede fallar: quitando una entrada, `tsc` la señala por nombre.
 *
 * Si algún día molesta más de lo que ayuda, `Partial<Record<...>>` lo relaja y lo que falte vuelve
 * a caer al genérico por status. Pero entonces nadie se entera de que falta.
 */
const MESSAGES_BY_CODE: Record<ApiErrorCode, string> = {
  ACCESS_DENIED: 'No tienes permiso para hacer esto.',
  ALREADY_MEMBER: 'Este usuario ya es miembro del grupo.',
  // Es un 404, y el backend NO distingue "nunca se repartió" de "se repartió antes de que
  // existiera la columna": la acción del usuario es la misma —no hay nada que pintar— y
  // separarlo metería una fecha de migración dentro de la API.
  BALANCE_NOT_RECORDED:
    'Esta partida no tiene guardado el porqué del reparto. Puede que no se llegara a generar, o que se generara antes de que empezáramos a guardarlo.',
  CANNOT_ASSIGN_OWNER_ROLE:
    'Propietario no es un rol que se asigne: para que lo sea otra persona, transfiérele el grupo.',
  CANNOT_DEMOTE_OWNER:
    'Al propietario no se le cambia el rol. Si ya no quieres que lo sea, transfiérele el grupo a otra persona.',
  CANNOT_REMOVE_GROUP_MEMBER: 'Solo puedes expulsar a gente que esté por debajo de ti en el grupo.',
  CANNOT_SANCTION_PLAYER: 'Solo puedes sancionar a jugadores por debajo de ti en el grupo.',
  CANNOT_TRANSFER_OWNERSHIP_TO_SELF: 'Ya eres el propietario de este grupo.',
  CHAMPION_ALREADY_RESERVED:
    'Ese campeón ya está reservado en esta sala. Cada campeón se reserva una sola vez.',
  CHAMPION_NOT_FOUND: 'No se ha encontrado ese campeón.',
  // Lleva los ids de las reglas en conflicto, pero el advice del backend NO los saca en el
  // ProblemDetail (solo el code), asi que el mensaje no puede prometer que se marquen.
  CONTRADICTORY_LOBBY_RULES:
    'Estas reglas se contradicen entre sí: no hay ninguna forma de repartir los equipos que las cumpla todas. Quita una de las últimas que has puesto.',
  CURRENT_SESSION_NOT_REVOCABLE:
    'Esta es la sesión que estás usando ahora mismo. Para salir de este dispositivo, usa cerrar sesión.',
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
  DUPLICATE_RESOURCE: 'Eso ya existe. Recarga la página para ver cómo está ahora.',
  EMPTY_AUDIT_WINDOW:
    'Ese periodo está al revés: la fecha de fin debe ser posterior a la de inicio.',
  FEEDBACK_NOT_FOUND: 'Ese reporte ya no existe.',
  FEEDBACK_QUOTA_EXCEEDED:
    'Has enviado demasiados reportes en las últimas 24 horas. Prueba de nuevo más tarde.',
  GAME_DATA_UNAVAILABLE:
    'El catálogo de datos del juego no está disponible ahora mismo. Inténtalo más tarde.',
  GROUP_MEMBER_NOT_FOUND: 'Esa persona ya no está en el grupo.',
  GROUP_NOT_FOUND: 'Ese grupo ya no existe.',
  GROUP_QUOTA_EXCEEDED: 'Has alcanzado el número máximo de grupos que puedes tener.',
  ILLEGAL_FEEDBACK_TRANSITION:
    'Ese reporte no puede pasar a ese estado desde el que tiene ahora. Recarga para ver cómo está.',
  INTERNAL_ERROR:
    'Algo ha fallado por nuestra parte. Vuelve a intentarlo y, si sigue pasando, mándanos un reporte.',
  // Un solo code para las tres cosas que pueden fallar al subir el avatar (formato, tamano y
  // bytes que no decodifican): el backend no las distingue, asi que el mensaje las cubre todas.
  // Antes habia dos entradas, UNSUPPORTED_IMAGE e IMAGE_TOO_LARGE, que el backend nunca ha
  // mandado.
  INVALID_AVATAR: 'Esa imagen no vale. Tiene que ser un JPEG o un PNG de menos de 2 MB.',
  INVALID_CLIENT_IP_FILTER:
    'Eso no es una dirección IP. Escribe una dirección (88.98.97.149) o un rango (88.98.97.0/24).',
  INVALID_LANE_PINS:
    'Con esos carriles fijados hay alguien que no puede jugar en ninguno, o un carril que no puede cubrir nadie. Libera alguno.',
  INVALID_LEAGUE_DATES: 'Una temporada no puede acabar antes de empezar. Revisa las fechas.',
  INVALID_LOBBY_RULE:
    'Esa regla no es válida. Revisa a cuánta gente incluye y en qué lado pones a cada uno.',
  // Los pesos salen de app_config y los edita una persona: esto no lo puede arreglar el usuario.
  INVALID_MATCHMAKING_PARAMS:
    'Los pesos con los que se reparten los equipos están mal configurados, así que no se puede generar el reparto. Avisa a un administrador.',
  INVALID_MATCHMAKING_POOL:
    'Esta sala no tiene diez jugadores válidos, así que no hay nada que repartir. Revisa la lista.',
  INVALID_MATCH_UPLOAD:
    'Esa partida no se puede subir: lo que manda la aplicación no cuadra (no son diez jugadores, o no coinciden en quién ganó).',
  INVALID_METRICS_WINDOW:
    'Ese periodo no es válido. Solo guardamos las llamadas a Riot de los últimos 7 días.',
  // Sale de un dato guardado, no de lo que el usuario acaba de hacer: pararse antes que seguir
  // apuntando numeros que nadie ha elegido.
  INVALID_RATING_STATE:
    'No hemos podido actualizar el rating con esos datos. No vuelvas a intentarlo y avisa a un administrador.',
  INVALID_RESERVATION:
    'Esa reserva no encaja: o esa persona ya tiene una, o es para un carril del que la has excluido.',
  INVALID_RIOT_ID:
    'Ese Riot ID no es válido. Debe ser «Nombre#TAG», tal y como aparece en el cliente.',
  INVITATION_NOT_FOUND: 'Esa invitación ya no existe.',
  INVITATION_NOT_PENDING:
    'Esa invitación ya no está pendiente: se aceptó, se rechazó o se canceló.',
  INVITEE_NOT_FOUND: 'No se ha encontrado ese usuario.',
  INVITEE_REFUSES_INVITATIONS: 'Este usuario no acepta invitaciones a grupos nuevos.',
  LEAGUE_ALREADY_OPEN:
    'Este grupo ya tiene una temporada en marcha. Para abrir otra, espera a que termine la actual.',
  LEAGUE_CLOSED:
    'Esta temporada ya ha terminado: su clasificación es definitiva. Abre una nueva para seguir compitiendo.',
  LEAGUE_HAS_HISTORY:
    'Esta temporada ya tiene jugadores o movimientos de LP, así que no se puede borrar. Ciérrala y se conservará como histórico.',
  LEAGUE_NOT_FOUND: 'Esa temporada ya no existe.',
  LEAGUE_NOT_IN_GROUP: 'Esa temporada no es de este grupo.',
  LEAGUE_NOT_STARTED: 'Esta temporada todavía no ha empezado. Podrás hacerlo cuando arranque.',
  LOBBY_NOT_CONFIRMED:
    'Esta partida todavía no tiene hora cerrada, así que aún no se sabe quién juega.',
  LOBBY_NOT_DRAFTING: 'Esta partida no está en draft, así que no hay nada que liberar.',
  LOBBY_NOT_FOUND: 'Esa partida ya no existe.',
  LOBBY_NOT_FULL:
    'Ya no sois diez: alguien se ha bajado después de que se llenara. Que entre un sustituto antes de empezar el draft.',
  LOBBY_NOT_OPEN: 'Esta partida ya no admite gente: se canceló o ya se está jugando.',
  LOBBY_SLOT_NOT_FOUND: 'Esa hora ya no está disponible. Puede que se haya cerrado otra.',
  MATCH_ALREADY_RECORDED:
    'Esta partida ya tiene resultado guardado. Si el que hay es el equivocado, corrígelo en vez de volver a guardarlo.',
  NOTHING_TO_CORRECT:
    'Esta partida no tiene un resultado que corregir, o el que tiene ya dice justo eso.',
  NOTHING_TO_RESET: 'Esta modalidad todavía no tiene ratings, así que no hay nada que resetear.',
  NOTIFICATION_NOT_FOUND: 'Esa notificación ya no existe.',
  NOT_A_PARTICIPANT: 'No apareces en esa partida, así que no puedes subirla.',
  NO_SOFT_RESET_TO_UNDO: 'Esta modalidad no tiene ningún reseteo que deshacer.',
  OWNER_CANNOT_LEAVE:
    'Eres el propietario del grupo. Antes de salir, pásaselo a otra persona o bórralo.',
  PAIRING_CODE_ALREADY_USED: 'Ese código ya lo ha usado otra cuenta. Pide uno nuevo desde la web.',
  PAIRING_CODE_NOT_FOUND:
    'Ese código no vale: o no existe o ha caducado. Pide uno nuevo desde la web.',
  PLAYER_NOT_IN_GROUP: 'Ese jugador ya no está en el grupo.',
  PLAYER_NOT_IN_LOBBY: 'Esa regla nombra a alguien que no está en esta partida.',
  PRIMARY_LANE_NOT_CHOSEN: 'Tu rol principal tiene que ser uno de los roles que has seleccionado.',
  RATING_ALREADY_RESET:
    'El grupo ha reseteado sus ratings después de esta partida, así que ya no se puede rebobinar.',
  RESERVATIONS_NOT_ALLOWED:
    'Esta sala se abrió en modo caos, y ahí no se reservan campeones: se reparte todo al azar.',
  RESET_ALREADY_BUILT_ON:
    'Ya se han jugado partidas después de ese reseteo, así que deshacerlo dejaría esas partidas colgando.',
  RIOT_ACCOUNT_ALREADY_LINKED:
    'Esa cuenta de Riot ya está vinculada por otro usuario. Si es tuya, pídele que la desvincule.',
  RIOT_ACCOUNT_NOT_LINKED: 'No tienes ninguna cuenta de Riot vinculada.',
  RIOT_API_UNAVAILABLE:
    'No hemos podido hablar con Riot ahora mismo. No es cosa tuya: prueba en un par de minutos.',
  // Riot tarda en publicar el icono, y un icono cambiado en la cuenta equivocada se ve igual.
  // La app de escritorio reintenta sola, asi que el texto tiene que aguantar varios intentos.
  RIOT_CHALLENGE_NOT_SATISFIED:
    'Todavía no vemos ese icono en tu cuenta. Riot tarda un poco en publicarlo; si en unos minutos sigue igual, comprueba que lo has cambiado en la cuenta que estás vinculando.',
  RIOT_RELINK_ON_COOLDOWN:
    'Has desvinculado tu cuenta hace poco. Puedes volver a poner la misma, pero para vincular otra distinta tendrás que esperar.',
  SANCTION_ALREADY_EXPIRED:
    'Esa fecha de fin ya ha pasado, así que la sanción nacería caducada. Elige una futura, o déjala indefinida.',
  SEASON_ALREADY_CLOSED:
    'Esa temporada ya está cerrada, así que sus resultados no se pueden corregir.',
  SECURITY_AUDIT_EVENT_NOT_FOUND:
    'Ese evento ya no está en el registro. Puede que se haya borrado por antigüedad: solo se guardan 90 días.',
  SESSION_NOT_FOUND: 'Esa sesión ya no estaba abierta.',
  SLOT_IN_THE_PAST: 'Esa hora ya ha pasado. Elige una futura.',
  SOFT_RESET_TOO_SOON:
    'Todavía no toca resetear los ratings. Entre un reseteo y el siguiente tiene que pasar un tiempo.',
  TOO_MANY_RESERVATIONS:
    'Has puesto más reservas de campeón de las que permite una sala. Quita alguna.',
  UNKNOWN_CHAMPION: 'Ese campeón no está en el catálogo.',
  // El enum lo decide el servidor: si el front manda algo que no conoce, es que va desactualizado.
  UNKNOWN_DRAFT_RULE_VALUE:
    'Esa regla o ese carril no son de los nuestros. Recarga la página, puede que tengas una versión antigua abierta.',
  UNKNOWN_MATCH_WINNER: 'Tienes que decir qué equipo ganó.',
  UNKNOWN_PLATFORM_ID:
    'No reconocemos esa región de Riot. Es cosa nuestra: mándanos un reporte y lo arreglamos.',
  UNKNOWN_USER: 'No encontramos tu cuenta. Cierra sesión y vuelve a entrar.',
  // El caso que de verdad llega aqui: las reglas se escribieron para diez, alguien se bajo y un
  // suplente subio. Nadie ha hecho nada mal, y por eso el texto no culpa a quien lo lee.
  UNSATISFIABLE_LOBBY_RULES:
    'Con las reglas puestas no hay ningún reparto posible para esta gente. Suele pasar cuando alguien se baja después de haberlas escrito: quita una regla y vuelve a generar los equipos.',
  UNSORTABLE_AUDIT_FIELD: 'El registro de seguridad solo se puede ordenar por fecha.',
  UNSORTABLE_FEEDBACK_FIELD: 'Los reportes no se pueden ordenar por ese campo.',
  VALIDATION_FAILED: 'Hay datos que no son válidos. Revisa el formulario.',
  VERIFICATION_CHALLENGE_NOT_FOUND:
    'Esa verificación ya no vale: o no existe o ha caducado. Vuelve a empezar desde la aplicación.',
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
    const known = MESSAGES_BY_CODE[error.code as ApiErrorCode];
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
  const known = MESSAGES_BY_CODE[code as ApiErrorCode];
  if (known) return known;
  console.warn(`[api-error] código sin traducir: ${code} (sin status)`);
  return FALLBACK;
}
