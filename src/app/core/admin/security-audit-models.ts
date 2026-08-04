/**
 * Contrato del log de eventos de seguridad, espejo de los DTOs del backend
 * (`com.cgc.cc.audit.adapters.in.controller.response`). Todo bajo `/admin/security-audit`
 * exige rol ADMIN; el backend revalida.
 *
 * Existe por un caso real: la tabla `spring_session` crecía sin parar y resultaron ser ~4.950
 * inicios de login de Discord abandonados, uno cada 305 segundos, 24 h al día durante semanas,
 * frente a 37 sesiones autenticadas de verdad. Se sabía *qué* pasaba pero no *quién* lo hacía,
 * porque nadie guardaba IP ni User-Agent.
 */

/** Espejo de `SecurityAuditKind`. Añadir uno aquí obliga a añadirlo en el backend y su migración. */
export type SecurityAuditKindTag =
  | 'LOGIN_START'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'ACCESS_DENIED';

/** Un evento del log. Todo menos `id`, `occurredAt` y `kind` puede venir null. */
export interface SecurityAuditEvent {
  id: number;
  /** ISO-8601. Lo pone el reloj de la BD, no el del servidor de aplicación. */
  occurredAt: string;
  kind: SecurityAuditKindTag;
  /**
   * La IP real del cliente, que el backend saca de `CF-Connecting-IP` y NO de `X-Forwarded-For`
   * (tras el túnel de Cloudflare esa cabecera vale la IP del contenedor, no la del usuario).
   * Null cuando el evento no nace de una petición HTTP.
   */
  clientIp: string | null;
  userAgent: string | null;
  /** Código ISO de dos letras que resuelve Cloudflare. */
  country: string | null;
  /** La ruta pedida, ya sin query string: ahí viajan el `state` y el `code` de OAuth. */
  requestPath: string | null;
  /** Identificador de petición de Cloudflare: el puente con sus propios logs. */
  cfRay: string | null;
  userId: string | null;
  detail: string | null;
}

/** Totales por tipo dentro de una ventana. Vienen SIEMPRE los cinco, ceros incluidos. */
export interface SecurityAuditSummary {
  byKind: { kind: SecurityAuditKindTag; events: number }[];
  totalEvents: number;
}

/**
 * Una dirección con todo lo que hizo, colapsado. Es la fila accionable: trae justo lo que
 * necesita una regla de bloqueo (dirección, país y el User-Agent que presenta).
 */
export interface SecurityAuditClient {
  clientIp: string;
  country: string | null;
  lastUserAgent: string | null;
  events: number;
  firstSeen: string;
  lastSeen: string;
  /**
   * Calculado en el servidor a propósito: un contador en bruto no dice nada sin el periodo que
   * abarca, y una tasa es lo que se compara contra un límite. Cuando todo cae en el mismo
   * instante no hay tasa posible y el backend devuelve el contador en bruto.
   */
  eventsPerHour: number;
}

/**
 * Filtros del listado. Los cuatro endpoints aceptan los mismos, así que una fila sospechosa se
 * arrastra tal cual del listado al resumen y al ranking.
 */
export interface SecurityAuditFilters {
  kind?: SecurityAuditKindTag;
  /**
   * Una dirección o un rango CIDR (`88.98.97.0/24`). El backend usa el operador «está contenido
   * en» de Postgres, así que el mismo campo sirve para una máquina y para su subred entera —
   * que es lo que hace falta en cuanto quien abusa empieza a rotar direcciones.
   */
  clientIp?: string;
  userId?: string;
  /** ISO-8601. Inclusivo. */
  from?: string;
  /** ISO-8601. EXCLUSIVO: paginando día a día, un evento de medianoche no sale en los dos. */
  to?: string;
}
