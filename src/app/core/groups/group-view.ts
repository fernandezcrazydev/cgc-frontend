import { GroupMembershipResponse, GroupResponse, GroupRole } from './models';

/**
 * Modelo de presentación de un grupo: lo que pintan la barra lateral, la lista y el detalle,
 * derivado del DTO real. Derivación pura (sin estado, sin Angular). El backend solo da
 * `groupId`, `name`, `region` y `avatarUrl`; las **iniciales** y los **colores del banner**
 * se derivan aquí de forma determinista (mismo grupo → mismo color siempre), y el **rol** es
 * el del llamante en ese grupo.
 */
export interface GroupView {
  id: string;
  name: string;
  /** Región de juego como subtítulo mono; null si el grupo no tiene. */
  region: string | null;
  role: GroupRole;
  /** URL absoluta del avatar (null si no hay); se pinta como `src` directamente. */
  avatarUrl: string | null;
  initials: string;
  /** Paradas del gradiente del banner (avatar + cabecera). */
  c1: string;
  c2: string;
}

/** Un elemento de `GET /me/groups` → modelo de presentación. */
export function groupView(membership: GroupMembershipResponse): GroupView {
  return groupViewFrom(membership.group, membership.role);
}

/** Un grupo + el rol del llamante → modelo de presentación (para el detalle). */
export function groupViewFrom(group: GroupResponse, role: GroupRole): GroupView {
  const { c1, c2 } = bannerColors(group.groupId);
  return {
    id: group.groupId,
    name: group.name,
    region: group.region,
    role,
    avatarUrl: group.avatarUrl,
    initials: initialsOf(group.name),
    c1,
    c2,
  };
}

/** Dos letras del nombre (iniciales de las dos primeras palabras), en mayúsculas. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length >= 2 ? words[0][0] + words[1][0] : name.trim().slice(0, 2);
  return letters.toUpperCase() || 'GR';
}

/**
 * Color del banner derivado de forma estable de un texto (el id del grupo): mismo grupo →
 * mismo gradiente en toda la app, sin necesitar que el backend guarde un color. Reemplaza al
 * `Math.random()` del mock: los colores no son dato de dominio, son presentación determinista.
 */
export function bannerColors(seed: string): { c1: string; c2: string } {
  const hue = hashHue(seed);
  return { c1: `hsl(${hue}, 90%, 62%)`, c2: `hsl(${(hue + 18) % 360}, 78%, 32%)` };
}

function hashHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
