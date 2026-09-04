/** Sesiones activas de la cuenta (navegadores y app de escritorio). `SessionsApi` es interno al dominio. */
export * from './models';
export { sessionLabel, scopeLabels } from './session-label';
export { SessionsStore, type SessionsStatus } from './sessions-store';
