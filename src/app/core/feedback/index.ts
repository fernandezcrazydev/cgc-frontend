/** Reportes de usuario (bug / propuesta / incidencia). `FeedbackApi` es interno al dominio. */
export * from './models';
export { FeedbackStore } from './feedback-store';

/** Administración y triaje (solo ADMIN). Contrato en `admin-models`, estado en el store. */
export * from './admin-models';
export { FeedbackAdminStore, allowedNextStatuses } from './feedback-admin-store';
