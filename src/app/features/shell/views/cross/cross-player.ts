import { hash } from '../../../../core/group-ranking';
import { CrossMatch, participantName } from '../../../../core/matches';

/**
 * A quién estás mirando en las vistas del cruce, resuelto para poder pintarlo.
 *
 * `null` significa «no existe», y es distinto de «existe pero no habéis coincidido»: lo primero
 * es un 404 y lo segundo un estado vacío con su explicación. La versión anterior no distinguía
 * los dos casos y ambos acababan enseñando una lista.
 */
export interface CrossPlayer {
  /** Su `userId`, que es lo que viaja en la URL y lo que entiende el parámetro `with=`. */
  userId: string;
  name: string;
  hue: number;
  avatarUrl: string | null;
}

/**
 * Sale del asiento del propio cruce: desde el contrato nuevo, cada uno de los diez trae su
 * nombre de Discord y su avatar **haya subida o no**.
 *
 * Por eso ya no hace falta un censo, y por eso «no lo encuentro» significa exactamente una cosa:
 * no habéis coincidido en ninguna partida. Consultar el roster del grupo abierto no servía en
 * `/me/matches`, donde cada fila es de un grupo distinto y puede que ni sigas siendo miembro.
 */
export function resolveCrossPlayer(
  userId: string,
  cross: readonly CrossMatch[],
): CrossPlayer | null {
  const id = (userId ?? '').trim();
  if (!id) return null;

  const them = cross.find((c) => c.them.userId === id)?.them;
  if (!them) return null;

  return {
    userId: id,
    name: nameOf(participantName(them)),
    hue: hash(id) % 360,
    avatarUrl: them.avatarUrl,
  };
}

/** `Pix3lQueen#LAN` → `Pix3lQueen`. La región se pinta aparte; en un título sobra. */
export function nameOf(tag: string): string {
  return (tag ?? '').split('#')[0] || tag;
}

/** El mismo degradado radial que usan el ranking, el roster y el perfil. */
export function avatarGradient(hue: number): string {
  return `radial-gradient(circle at 32% 26%, hsl(${hue},90%,64%), hsl(${hue},78%,30%))`;
}
