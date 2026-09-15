/* Superficie pública del dominio de partidas. El resto de la app importa de aquí
 * (`core/matches`) y nunca de los ficheros sueltos: así `MatchesApi` queda privado y puede
 * cambiar sin arrastrar a nadie. */
export * from './models';
export * from './match-view';
export * from './match-filtering';
export * from './cross-history';
export { MatchHistoryStore, type MatchHistoryStatus } from './match-history-store';
export { MatchCommentsStore, type MatchCommentsStatus } from './match-comments-store';
export { MatchTimelineStore, type MatchTimelineStatus } from './match-timeline-store';
export { type MatchMappingContext } from './match-mapper';
