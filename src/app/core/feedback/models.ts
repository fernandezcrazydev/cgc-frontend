/**
 * Reportes que envían los usuarios desde la app (bugs, propuestas, incidencias).
 *
 * Contrato: estas interfaces son el espejo del DTO que aceptará el backend en
 * `POST /api/v1/feedback`. Si el backend cambia, cambia esto.
 *
 * BACKEND NOTE: el cliente NO manda ni id, ni fecha, ni autor: el servidor los
 * pone (autor = dueño del bearer token). El cliente solo describe la incidencia.
 */

/** Qué clase de reporte es. `incident` = "algo raro, no sé si es un bug". */
export type FeedbackKind = 'bug' | 'proposal' | 'incident';

/** Zona de la app afectada. Sirve para triaje: dice por dónde empezar a buscar. */
export type FeedbackArea =
  | 'inicio'
  | 'grupos'
  | 'partidas'
  | 'draft'
  | 'historial'
  | 'ajustes'
  | 'cuenta'
  | 'otra';

/** Con qué frecuencia se reproduce un bug. */
export type BugFrequency = 'always' | 'sometimes' | 'once';

/**
 * Contexto técnico que adjuntamos automáticamente. El usuario no lo escribe,
 * pero lo ve antes de enviar (bloque "se enviará también").
 */
export interface FeedbackContext {
  /** Ruta de la SPA desde la que se abrió el reporte (`Router.url`). */
  route: string;
  userAgent: string;
  /** Tamaño de la ventana, `ancho×alto` en píxeles CSS. */
  viewport: string;
}

interface FeedbackBase {
  /** Resumen en una línea. Es el asunto de la incidencia. */
  title: string;
  area: FeedbackArea;
  context: FeedbackContext;
}

/** Algo está roto y el usuario sabe qué pasó. */
export interface BugReport extends FeedbackBase {
  kind: 'bug';
  /** Comportamiento observado. */
  whatHappened: string;
  /** Pasos para reproducirlo. */
  steps: string;
  /** Comportamiento esperado. */
  expected: string;
  frequency: BugFrequency;
}

/** Nada está roto: el usuario quiere algo que no existe. */
export interface ProposalReport extends FeedbackBase {
  kind: 'proposal';
  /** Qué le falta hoy / qué problema tiene. */
  problem: string;
  /** Qué solución propone. */
  solution: string;
  /** Alternativas que ha considerado. Cadena vacía si no dice nada. */
  alternatives: string;
}

/** El usuario ha visto algo raro pero no sabe si es un fallo. */
export interface IncidentReport extends FeedbackBase {
  kind: 'incident';
  /** Qué ha visto. */
  observed: string;
  /** Qué esperaba ver. Opcional: cadena vacía si no lo dice. */
  expected: string;
  /** Cuándo o dónde le pasó. Opcional: cadena vacía si no lo dice. */
  whenHappened: string;
}

export type FeedbackReport = BugReport | ProposalReport | IncidentReport;

/** Catálogo del selector de tipo. El `value` es lo que viaja al backend. */
export const FEEDBACK_KINDS = [
  { value: 'bug', glyph: '🐛', label: 'BUG', hint: 'Algo está roto' },
  { value: 'proposal', glyph: '💡', label: 'PROPUESTA', hint: 'Una idea o mejora' },
  { value: 'incident', glyph: '❓', label: 'INCIDENCIA', hint: 'Algo raro, no sé si es un bug' },
] as const satisfies readonly { value: FeedbackKind; glyph: string; label: string; hint: string }[];

/** Catálogo de zonas. El orden es el del desplegable. */
export const FEEDBACK_AREAS = [
  { value: 'grupos', label: 'Grupos y miembros' },
  { value: 'partidas', label: 'Partidas y salas' },
  { value: 'draft', label: 'Draft y campeones' },
  { value: 'historial', label: 'Historial y estadísticas' },
  { value: 'inicio', label: 'Inicio' },
  { value: 'ajustes', label: 'Perfil y ajustes' },
  { value: 'cuenta', label: 'Cuenta e inicio de sesión' },
  { value: 'otra', label: 'Otra zona / no lo sé' },
] as const satisfies readonly { value: FeedbackArea; label: string }[];

/** Catálogo de frecuencias (solo para bugs). */
export const BUG_FREQUENCIES = [
  { value: 'always', label: 'SIEMPRE' },
  { value: 'sometimes', label: 'A VECES' },
  { value: 'once', label: 'UNA VEZ' },
] as const satisfies readonly { value: BugFrequency; label: string }[];
