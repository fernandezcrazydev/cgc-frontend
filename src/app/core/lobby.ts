/* Shared lobby data for the Sale Custom app shell (from Login.dc.html). */
import { NfBadgeColor } from '../ui';

export interface MatchItem {
  name: string;
  mode: string;
  players: string;
  status: string;
  color: NfBadgeColor;
  c1: string;
  c2: string;
}

export interface NavItem {
  id: string;
  glyph: string;
  label: string;
  short: string;
  title: string;
  path: string;
}

export type GroupRole = 'OWNER' | 'MIEMBRO';

export interface Group {
  /** Stable slug used in the URL (`/app/grupos/:id`). */
  id: string;
  name: string;
  /** Short mono subtitle, e.g. "LAN · COMPETITIVO". */
  tag: string;
  initials: string;
  role: GroupRole;
  members: number;
  /** Banner gradient stops (avatar + header tint). */
  c1: string;
  c2: string;
  /** Optional group photo as a data URL; falls back to initials when absent. */
  avatar?: string;
}

/** A single member of a group's roster. */
export interface Member {
  name: string;
  /** Riot-style tag, e.g. "Pix3lQueen#EUW". */
  tag: string;
  initials: string;
  /** In-group role label, e.g. "CAPITÁN · OWNER" or "MID". */
  role: string;
  /** True for the group owner (always the first member). */
  owner: boolean;
  /** True when the owner has promoted this member to administrator. */
  admin?: boolean;
  /** Hue (0-360) used for the avatar gradient. */
  hue: number;
}

export const CURRENT_USER = {
  name: 'N1ghtfang',
  initials: 'N1',
  tag: 'N1ghtfang#LAN',
  /** Player region shown in the sidebar (no latency, just the server). */
  region: 'LAN',
};

export const NAV: NavItem[] = [
  { id: 'inicio',    glyph: '◈', label: 'INICIO',    short: 'INICIO',    title: 'Inicio',    path: 'inicio'    },
  { id: 'historial', glyph: '▣', label: 'HISTORIAL', short: 'HISTORIAL', title: 'Historial', path: 'historial' },
  { id: 'grupos',    glyph: '◆', label: 'GRUPOS',    short: 'GRUPOS',    title: 'Grupos',    path: 'grupos'    },
  { id: 'ajustes',   glyph: '▦', label: 'AJUSTES',   short: 'AJUSTES',   title: 'Ajustes',   path: 'ajustes'   },
];

export const GROUPS: Group[] = [
  { id: 'lan-challenger', name: 'LAN Challenger S14', tag: 'LAN', initials: 'LC', role: 'OWNER',   members: 8,  c1: 'hsl(320,90%,64%)', c2: 'hsl(280,78%,34%)' },
  { id: 'scrim-squad',    name: 'Scrim Squad',        tag: 'EUW', initials: 'SS', role: 'MIEMBRO', members: 12, c1: 'hsl(190,90%,62%)', c2: 'hsl(205,78%,32%)' },
  { id: 'night-owls',     name: 'Night Owls',         tag: 'NA',  initials: 'NO', role: 'OWNER',   members: 5,  c1: 'hsl(150,90%,60%)', c2: 'hsl(160,78%,30%)' },
  { id: 'arcane-five',    name: 'Arcane Five',         tag: 'KR',  initials: 'A5', role: 'MIEMBRO', members: 9,  c1: 'hsl(48,95%,62%)',  c2: 'hsl(38,80%,32%)'  },
];

export const MATCHES: MatchItem[] = [
  { name: 'match_lobby.exe', mode: '5v5 · LAN', players: '8/10 JUGADORES', status: 'EN CURSO', color: 'green', c1: 'hsl(150,90%,60%)', c2: 'hsl(150,78%,28%)' },
  { name: 'draft_final.exe', mode: '5v5 · BR', players: '10/10 JUGADORES', status: 'ESPERANDO', color: 'yellow', c1: 'hsl(48,95%,62%)', c2: 'hsl(38,80%,32%)' },
  { name: 'scrim_07.exe', mode: '5v5 · LAN', players: '10/10 JUGADORES', status: 'FINALIZADA', color: 'cyan', c1: 'hsl(190,90%,62%)', c2: 'hsl(205,78%,32%)' },
];

export const REGION_OPTIONS = ['LAN', 'BR', 'NA', 'EUW', 'KR'];

/**
 * BACKEND NOTE: lista corta (~15) de ids REALES de ddragon usada por los
 * generadores deterministas de stats/historial (`player-profile.ts`,
 * `group-stats.ts`, `member-detail.ts`, `match-history.ts`) mientras no
 * exista el endpoint de partidas/estadísticas. Es exactamente la forma que
 * tendrá el DTO real (el backend mandará un `championId`), así que el día
 * del endpoint solo hay que borrar este array y los generadores que lo
 * consumen — la vista ya resuelve `id → ChampionSummary` con
 * `GameDataStore.championById()`. Nunca renderizar nombre/gradiente aquí:
 * eso lo decide el catálogo real, no este mock.
 */
export const REAL_CHAMPION_IDS = [
  103, // Ahri
  64, // Lee Sin
  157, // Yasuo
  222, // Jinx
  412, // Thresh
  86, // Garen
  238, // Zed
  99, // Lux
  22, // Ashe
  11, // Master Yi
  89, // Leona
  245, // Ekko
  55, // Katarina
  30, // Karthus
  33, // Rammus
];
