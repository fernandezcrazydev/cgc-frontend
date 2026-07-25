import { Signal, effect } from '@angular/core';
import { NotificationsStore } from '../../../core/notifications';

/**
 * Cablea el cierre de "conectar_app.exe" cuando, mientras el usuario lo tiene abierto esperando
 * con el código pegado en la app de escritorio, llega por SSE la confirmación del backend
 * (`RIOT_ACCOUNT_PAIRED` al emparejar, `RIOT_ACCOUNT_VERIFIED` al verificar). Es el pago real de
 * todo el flujo de vinculación: el usuario no tiene que recargar para verlo.
 *
 * `RIOT_ACCOUNT_TAKEN_OVER` no entra aquí a propósito: ese evento nunca puede llegar con este
 * modal abierto (le está pasando a quien PIERDE la cuenta, no a quien la está emparejando), así
 * que no hay nada que cerrar. El refetch de `RiotAccountStore` para los tres tipos ya lo hace el
 * `effect` global de `shell.ts` (`wireRiotAccountRefresh`); esto solo reacciona a la UI local del
 * modal.
 *
 * Extraído a una función en vez de un `effect` inline en el constructor de `Perfil` para poder
 * testearlo sin montar el componente entero: la plantilla de `Perfil` es enorme (roles, cuenta de
 * Riot, sesión, avatar...) y `effect()` en este runtime de Angular flushea junto con la
 * sincronización de vista del componente, así que un test que dispare el efecto real acabaría
 * renderizando toda la plantilla y exigiendo un doble fiel de cada store que toca — mucho más de
 * lo que hay que proteger aquí. Debe llamarse dentro de un contexto de inyección.
 */
export function wireConnectModalOnRiotEvent(
  notifs: NotificationsStore,
  connecting: Signal<boolean>,
  onConfirmed: (riotId: string, type: 'RIOT_ACCOUNT_PAIRED' | 'RIOT_ACCOUNT_VERIFIED') => void,
): void {
  effect(() => {
    const latest = notifs.lastArrived();
    if (latest?.type !== 'RIOT_ACCOUNT_PAIRED' && latest?.type !== 'RIOT_ACCOUNT_VERIFIED') return;
    if (!connecting()) return;
    onConfirmed(latest.data['riotId'] ?? 'tu cuenta de Riot', latest.type);
  });
}
