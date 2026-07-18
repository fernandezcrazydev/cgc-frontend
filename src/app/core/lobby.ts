/* Shared lobby data for the Sale perso app shell (from Login.dc.html). */
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

export interface Champion {
  name: string;
  role: string;
  initials: string;
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

const CHAMP_DATA: Array<[string, number, string]> = [
  ['Aurelia', 330, 'MAGA'], ['Vex', 275, 'ASESINA'], ['Kael', 42, 'LUCHADOR'], ['Nyx', 195, 'SOPORTE'],
  ['Orion', 220, 'TIRADOR'], ['Sera', 300, 'MAGA'], ['Drake', 14, 'TANQUE'], ['Lumen', 160, 'SOPORTE'],
  ['Ravi', 100, 'LUCHADOR'], ['Zephyr', 250, 'ASESINA'], ['Mira', 320, 'TIRADOR'], ['Talon', 0, 'TANQUE'],
];

export const CHAMPIONS: Champion[] = CHAMP_DATA.map(([name, h, role]) => ({
  name,
  role,
  initials: name.slice(0, 2).toUpperCase(),
  c1: `hsl(${h},90%,66%)`,
  c2: `hsl(${h},78%,30%)`,
}));

export const REGION_OPTIONS = ['LAN', 'BR', 'NA', 'EUW', 'KR'];
