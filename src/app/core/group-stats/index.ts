/* Superficie pública de las estadísticas del grupo. `GroupStatsApi` es interno: las vistas hablan
 * con el store, nunca con el cliente HTTP. */
export * from './models';
export * from './stats-view';
export * from './medals';
export { GroupStatsStore, type GroupStatsStatus } from './group-stats-store';
