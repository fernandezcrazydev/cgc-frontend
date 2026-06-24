/* Shared lobby data for the NEXUS//FORGE app shell (from Login.dc.html). */
import { NfBadgeColor } from '../ui';

export interface StatCard {
  label: string;
  value: string;
  accent: string;
}

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
  /** Hue (0-360) used for the avatar gradient. */
  hue: number;
}

/**
 * Payload carried by a "group invite" notification so the bell can open a review
 * modal without hitting the backend (mock until the invite API exists).
 */
export interface GroupInvitePayload {
  /** Slug the group will get if the invite is accepted. */
  groupId: string;
  groupName: string;
  region: string;
  /** Mono subtitle, e.g. "EUW · COMPETITIVO". */
  tag: string;
  initials: string;
  c1: string;
  c2: string;
  members: number;
  /** Display name of whoever sent the invite. */
  invitedBy: string;
  /** Display name of the group owner/admin. */
  admin: string;
  /** Preview of the current roster. */
  roster: Member[];
}

/** Kinds map to a glyph (see NOTIF_GLYPH); `accent` is a palette token for tint + dot. */
export type NotificationKind = 'invite' | 'join' | 'result' | 'system';

export interface Notification {
  id: number;
  kind: NotificationKind;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  /** CSS color (palette token) used for the icon, title and unread dot. */
  accent: string;
  /** When present, clicking the notification opens the group-invite review modal. */
  groupInvite?: GroupInvitePayload;
}

export const NOTIF_GLYPH: Record<NotificationKind, string> = {
  invite: '►',
  join: '◉',
  result: '▤',
  system: '⊙',
};

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
  { id: 'lan-challenger', name: 'LAN Challenger S14', tag: 'LAN · COMPETITIVO', initials: 'LC', role: 'OWNER',   members: 8,  c1: 'hsl(320,90%,64%)', c2: 'hsl(280,78%,34%)' },
  { id: 'scrim-squad',    name: 'Scrim Squad',        tag: 'PRÁCTICA · 5v5',    initials: 'SS', role: 'MIEMBRO', members: 12, c1: 'hsl(190,90%,62%)', c2: 'hsl(205,78%,32%)' },
  { id: 'night-owls',     name: 'Night Owls',         tag: 'CASUAL · NOCTURNO', initials: 'NO', role: 'OWNER',   members: 5,  c1: 'hsl(150,90%,60%)', c2: 'hsl(160,78%,30%)' },
  { id: 'arcane-five',    name: 'Arcane Five',         tag: 'RANKED · FLEX',     initials: 'A5', role: 'MIEMBRO', members: 9,  c1: 'hsl(48,95%,62%)',  c2: 'hsl(38,80%,32%)'  },
];

export const STATS: StatCard[] = [
  { label: 'PARTIDAS', value: '47', accent: 'var(--nf-cyan)' },
  { label: 'VICTORIAS', value: '31', accent: 'var(--nf-green)' },
  { label: 'WIN RATE', value: '66%', accent: 'var(--nf-pink)' },
  { label: 'LP', value: '2480', accent: 'var(--nf-yellow)' },
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

/** Mock roster preview shown inside the example group-invite review modal. */
const VORTEX_ROSTER: Member[] = [
  { name: 'St0rmcaller', tag: 'St0rmcaller#EUW', initials: 'ST', role: 'CAPITÁN · OWNER', owner: true,  hue: 264 },
  { name: 'Pix3lQueen',  tag: 'Pix3lQueen#EUW',  initials: 'PI', role: 'MID',             owner: false, hue: 318 },
  { name: 'HexHunter',   tag: 'HexHunter#EUW',   initials: 'HE', role: 'JUNGLA',          owner: false, hue: 150 },
  { name: 'NeonRift',    tag: 'NeonRift#EUW',    initials: 'NE', role: 'ADC',             owner: false, hue: 190 },
  { name: 'AshenWolf',   tag: 'AshenWolf#EUW',   initials: 'AS', role: 'TOP',             owner: false, hue: 36  },
  { name: 'LumeCore',    tag: 'LumeCore#EUW',    initials: 'LU', role: 'SUPPORT',         owner: false, hue: 96  },
];

export const NOTIFICATIONS: Notification[] = [
  {
    id: 6, kind: 'invite', title: 'INVITACIÓN A GRUPO',
    message: 'St0rmcaller te invitó a unirte a VORTEX ESPORTS', time: 'AHORA', unread: true, accent: 'var(--nf-pink)',
    groupInvite: {
      groupId: 'vortex-esports', groupName: 'Vortex Esports', region: 'EUW', tag: 'EUW · COMPETITIVO',
      initials: 'VE', c1: 'hsl(264,90%,64%)', c2: 'hsl(280,78%,34%)', members: VORTEX_ROSTER.length,
      invitedBy: 'St0rmcaller', admin: 'St0rmcaller', roster: VORTEX_ROSTER,
    },
  },
  { id: 1, kind: 'invite', title: 'INVITACIÓN A PARTIDA', message: 'Pix3lQueen te invitó a LAN-2895',                 time: 'AHORA', unread: true,  accent: 'var(--nf-cyan)'   },
  { id: 2, kind: 'join',   title: 'SOLICITUD DE GRUPO',   message: 'Cr1msonByte quiere unirse a LAN CHALLENGER S14',   time: '5 MIN', unread: true,  accent: 'var(--nf-purple)' },
  { id: 3, kind: 'result', title: 'PARTIDA FINALIZADA',   message: 'LAN-2887 — Victoria registrada · +32 LP',          time: '1H',    unread: false, accent: 'var(--nf-green)'  },
  { id: 4, kind: 'system', title: 'SERVIDOR ACTUALIZADO', message: 'Región LAN · latencia 28ms',                       time: '3H',    unread: false, accent: 'var(--nf-yellow)' },
  { id: 5, kind: 'result', title: 'DERROTA REGISTRADA',   message: 'LAN-2884 — D4rkFl4me venció a tu equipo',          time: '5H',    unread: false, accent: 'var(--nf-red)'    },
];
