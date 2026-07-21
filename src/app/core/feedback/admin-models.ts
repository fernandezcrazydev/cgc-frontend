/**
 * Contrato de los endpoints de administración de feedback (`/api/v1/admin/feedback`).
 *
 * Espejo EXACTO de los DTOs de respuesta del backend. OJO al vocabulario: el cuerpo que
 * MANDA el usuario (`models.ts`) va en minúscula (`bug`, `always`), pero lo que el backend
 * DEVUELVE al panel de admin va en MAYÚSCULA (el `.name()` del enum). Son dos contratos
 * distintos a propósito: este panel es front nuevo escrito contra el back, no arrastra el
 * vocabulario del diálogo de usuario. Si el backend cambia, cambia esto.
 */

/** Tipo de reporte, tal como lo devuelve el backend (MAYÚSCULA). */
export type FeedbackKindTag = 'BUG' | 'PROPOSAL' | 'INCIDENT';

/** Estado de triaje. Flujo: NEW → IN_REVIEW → RESOLVED | REJECTED (los dos últimos terminales). */
export type FeedbackStatusTag = 'NEW' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';

/** Frecuencia de un bug (MAYÚSCULA). */
export type BugFrequencyTag = 'ALWAYS' | 'SOMETIMES' | 'ONCE';

/** Autor del reporte, proyección segura: nunca email, discordId ni globalRole. */
export interface FeedbackAuthor {
  userId: string;
  discordUsername: string;
  avatarUrl: string | null;
}

/** Una porción paginada, espejo de `PageResponse<T>` del backend (paginación por offset). */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Fila de la tabla de triaje: lo justo para escanear y priorizar, sin el cuerpo completo. */
export interface FeedbackSummary {
  id: string;
  kind: FeedbackKindTag;
  area: string;
  title: string;
  status: FeedbackStatusTag;
  author: FeedbackAuthor;
  /** ISO-8601 UTC (`Instant` de Java); se formatea en presentación. */
  createdAt: string;
  updatedAt: string;
}

/** Contexto de diagnóstico que el front adjuntó automáticamente al reportar. */
export interface FeedbackContextView {
  route: string;
  userAgent: string;
  viewport: string;
}

export interface BugBody {
  whatHappened: string;
  steps: string;
  expected: string;
  frequency: BugFrequencyTag;
}

export interface ProposalBody {
  problem: string;
  solution: string;
  alternatives: string;
}

export interface IncidentBody {
  observed: string;
  expected: string;
  whenHappened: string;
}

/**
 * Reporte completo para la vista de detalle. Exactamente uno de `bug`/`proposal`/`incident`
 * viene relleno (el backend omite los otros dos): `kind` dice cuál mirar. `adminNote` es
 * interno y solo llega por este endpoint de admin.
 */
export interface FeedbackDetail {
  id: string;
  kind: FeedbackKindTag;
  area: string;
  title: string;
  status: FeedbackStatusTag;
  adminNote: string | null;
  author: FeedbackAuthor;
  context: FeedbackContextView;
  bug?: BugBody;
  proposal?: ProposalBody;
  incident?: IncidentBody;
  createdAt: string;
  updatedAt: string;
}

/** Cuerpo del PATCH: mueve estado y/o nota interna en una sola petición. */
export interface UpdateFeedbackRequest {
  status: FeedbackStatusTag;
  adminNote?: string | null;
}

/** Filtros de la lista (todos opcionales: ausente = no filtrar por ese campo). */
export interface FeedbackListFilters {
  status?: FeedbackStatusTag;
  kind?: FeedbackKindTag;
  area?: string;
}
