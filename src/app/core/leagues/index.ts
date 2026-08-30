/* Superficie pública del dominio de ligas. `LeaguesApi` es interno: las vistas hablan con el
 * store, nunca con el cliente HTTP. */
export * from './models';
export { LeaguesStore, type LeaguesStatus } from './leagues-store';
