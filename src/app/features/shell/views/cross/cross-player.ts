import { hash } from '../../../../core/group-ranking';
import { CrossMatch } from '../../../../core/matches';
import { Member } from '../../../../core/lobby';

/**
 * A quién estás mirando en las vistas del cruce, resuelto para poder pintarlo.
 *
 * `null` significa «no existe», y es distinto de «existe pero no habéis coincidido»: lo primero
 * es un 404 y lo segundo un estado vacío con su explicación. La versión anterior no distinguía
 * los dos casos y ambos acababan enseñando una lista.
 */
export interface CrossPlayer {
  /** El identificador de la URL, tal cual viaja hoy (`Nombre#REGION`). */
  tag: string;
  name: string;
  hue: number;
  avatarUrl: string | null;
}

/**
 * Resuelve al jugador por dos caminos, en este orden:
 *
 * 1. El roster de tus grupos, que es donde vive su nombre e identidad visual.
 * 2. Las propias partidas cruzadas: si habéis jugado juntos, su participante ya trae el Riot ID
 *    y la foto, y eso basta para pintar la cabecera aunque ya no comparta grupo contigo.
 *
 * Si ninguno lo encuentra devuelve `null` y la vista pinta su 404.
 *
 * BACKEND NOTE: cuando exista `GET /players/{id}` esto se sustituye por esa lectura, con su
 * propio estado de carga; hoy ambas fuentes ya están en memoria y la resolución es síncrona.
 */
export function resolveCrossPlayer(
  tag: string,
  roster: readonly Member[],
  cross: readonly CrossMatch[],
): CrossPlayer | null {
  const raw = (tag ?? '').trim();
  if (!raw) return null;

  // El tag se compara en minúsculas porque el mock lo escribe con mayúsculas inconsistentes; el
  // id estable NO, porque es un identificador opaco. Compararlo también en minúsculas era un
  // bug silencioso: la rama del `userId` no podía acertar nunca con un id que llevase mayúsculas.
  const key = raw.toLowerCase();
  const member = roster.find((m) => m.tag.toLowerCase() === key || m.userId === raw);
  if (member) {
    return {
      tag: member.tag,
      name: member.name,
      hue: member.hue,
      avatarUrl: member.avatar ?? null,
    };
  }

  const them = cross[0]?.them;
  if (them) {
    return {
      tag: them.riotId,
      name: nameOf(them.riotId),
      hue: hash(them.riotId) % 360,
      avatarUrl: them.avatarUrl ?? null,
    };
  }

  return null;
}

/** `Pix3lQueen#LAN` → `Pix3lQueen`. La región se pinta aparte; en un título sobra. */
export function nameOf(tag: string): string {
  return (tag ?? '').split('#')[0] || tag;
}

/** El mismo degradado radial que usan el ranking, el roster y el perfil. */
export function avatarGradient(hue: number): string {
  return `radial-gradient(circle at 32% 26%, hsl(${hue},90%,64%), hsl(${hue},78%,30%))`;
}
