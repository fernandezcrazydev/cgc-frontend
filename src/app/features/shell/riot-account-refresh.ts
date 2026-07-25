import { effect } from '@angular/core';
import { NotificationsStore } from '../../core/notifications';
import { RiotAccountStore } from '../../core/riot';

/** Tipos que, al llegar por la campana, dicen que el estado de la cuenta de Riot cambió. */
const RIOT_ACCOUNT_NOTIFICATION_TYPES: ReadonlySet<string> = new Set([
  'RIOT_ACCOUNT_PAIRED',
  'RIOT_ACCOUNT_VERIFIED',
  'RIOT_ACCOUNT_TAKEN_OVER',
]);

/**
 * Cablea el refetch silencioso de `RiotAccountStore` cuando llega por SSE una notificación de
 * vinculación/verificación/desvinculación de Riot (`RIOT_ACCOUNT_*`). Lo usa `Shell` en su
 * constructor, junto al resto de `effect`s globales que reaccionan a `notifs.lastArrived()`.
 *
 * Extraído a una función en vez de dejarlo inline en el constructor de `Shell` únicamente para
 * poder testearlo aislado: `Shell` arrastra Router, media docena de stores más y una plantilla
 * grande, así que montarlo entero en un test unitario solo para proteger un `effect` de una
 * línea sería una carga desproporcionada para lo que hay que probar. Vive en `features/shell/`
 * y no en `core/riot/` porque cablear dos dominios de `core/` entre sí rompería la dirección de
 * dependencias del proyecto (`core` no importa de otro `core`); esa orquestación cross-dominio
 * es cosa de `features`.
 *
 * Debe llamarse dentro de un contexto de inyección (el constructor de un componente, o
 * `TestBed.runInInjectionContext` en un test).
 */
export function wireRiotAccountRefresh(notifs: NotificationsStore, riot: RiotAccountStore): void {
  effect(() => {
    const latest = notifs.lastArrived();
    if (latest && RIOT_ACCOUNT_NOTIFICATION_TYPES.has(latest.type)) void riot.refresh();
  });
}
