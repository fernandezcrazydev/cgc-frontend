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

export type GroupRole = 'Capitán' | 'Miembro';

export interface Group {
  /** Stable slug used in the URL (`/app/grupos/:id`). */
  id: string;
  name: string;
  /** Nombre propio de la liga asociada al grupo, desacoplado del nombre de grupo. */
  leagueName?: string;
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
  /**
   * UUID del usuario en nuestra BD, cuando el miembro viene del backend (`GroupBridge`). Los
   * rosters puramente mock no lo traen, y quien lo consuma debe caer a `tag`, que tambien es
   * unico. BACKEND NOTE: al migrar matchmaking, esta pasa a ser LA clave del miembro y `tag`
   * se queda solo como texto a pintar.
   */
  userId?: string;
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
  /** Foto de Discord (URL absoluta del backend); ausente ⇒ iniciales sobre el degradado de `hue`. */
  avatar?: string;
}

export const CURRENT_USER = {
  name: 'N1ghtfang',
  initials: 'N1',
  tag: 'N1ghtfang#LAN',
  /** Player region shown in the sidebar (no latency, just the server). */
  region: 'LAN',
};

export const NAV: NavItem[] = [
  { id: 'inicio',    glyph: '◈', label: 'Inicio',    short: 'Inicio',    title: 'Inicio',    path: 'inicio'    },
  { id: 'historial', glyph: '▣', label: 'Historial', short: 'Historial', title: 'Historial', path: 'historial' },
  { id: 'tierlist',  glyph: '⚔', label: 'Tierlist',  short: 'Tierlist',  title: 'Tierlist',  path: 'tierlist'  },
  { id: 'grupos',    glyph: '◆', label: 'Grupos',    short: 'Grupos',    title: 'Grupos',    path: 'grupos'    },
  { id: 'ajustes',   glyph: '▦', label: 'Ajustes',   short: 'Ajustes',   title: 'Ajustes',   path: 'ajustes'   },
];

export const GROUPS: Group[] = [
  { id: 'lan-challenger', name: 'LAN Challenger S14', leagueName: 'Liga Challenger Clausura', tag: 'LAN', initials: 'LC', role: 'Capitán',   members: 28,  c1: 'hsl(320,90%,64%)', c2: 'hsl(280,78%,34%)' },
  { id: 'scrim-squad',    name: 'Scrim Squad',        leagueName: 'Liga Premier Scrims',        tag: 'EUW', initials: 'SS', role: 'Miembro', members: 12, c1: 'hsl(190,90%,62%)', c2: 'hsl(205,78%,32%)' },
  { id: 'night-owls',     name: 'Night Owls',         leagueName: 'Circuito Nocturno',         tag: 'NA',  initials: 'NO', role: 'Capitán',   members: 5,  c1: 'hsl(150,90%,60%)', c2: 'hsl(160,78%,30%)' },
  { id: 'arcane-five',    name: 'Arcane Five',        leagueName: 'Torneo Arcane Open',        tag: 'KR',  initials: 'A5', role: 'Miembro', members: 9,  c1: 'hsl(48,95%,62%)',  c2: 'hsl(38,80%,32%)'  },
];

export const MATCHES: MatchItem[] = [
  { name: 'Sala de partida', mode: '5v5 · LAN', players: '8/10 jugadores', status: 'En curso', color: 'success', c1: 'hsl(150,90%,60%)', c2: 'hsl(150,78%,28%)' },
  { name: 'Draft final', mode: '5v5 · BR', players: '10/10 jugadores', status: 'Esperando', color: 'warning', c1: 'hsl(48,95%,62%)', c2: 'hsl(38,80%,32%)' },
  { name: 'Scrim 07', mode: '5v5 · LAN', players: '10/10 jugadores', status: 'Finalizada', color: 'secondary', c1: 'hsl(190,90%,62%)', c2: 'hsl(205,78%,32%)' },
];

export const REGION_OPTIONS = ['LAN', 'BR', 'NA', 'EUW', 'KR'];

/**
 * Nombres de jugador de mentira, la ÚNICA lista. La consumen los dos
 * generadores de roster que existen: `MEMBER_POOL` de `group-store.ts` (que
 * monta `Nombre#REGION`) y `NAME_POOL` de `group-ranking.ts` (que le pega una
 * región de sabor). Antes eran dos listas de 12 "sincronizadas por convención";
 * se unificaron al subir los grupos a 28 miembros, porque con 12 nombres se
 * repetían y eso rompe de verdad: los `@for` clavean por `tag` (`grupo-sala`,
 * `grupo-crear-partida`) y `perksOf(groupId, tag)` mezclaría dos jugadores.
 *
 * BACKEND NOTE: desaparece entera con el endpoint de miembros; los nombres
 * reales vienen de Discord.
 *
 * INVARIANTE: los nombres deben ser únicos y ser al menos tantos como el grupo
 * semilla más grande (hoy `lan-challenger`, 28).
 */
export const MOCK_NAMES = [
  'Pix3lQueen', 'Cr1msonByte', 'D4rkFl4me', 'V0idWalker', 'NeonRift',
  'GlitchKid', 'St0rmcaller', 'HexHunter', 'AshenWolf', 'LumeCore',
  'Zer0Cool', 'ByteSiren', 'Nyx0verdrive', 'R1ftBreaker', 'SolarFang',
  'M4chinaDusk', 'EchoVanta', 'Gr1mHalo', 'VelvetN0va', 'KiloWraith',
  'Ob3lisk', 'SaintCircuit', 'PaleMonsoon', 'Ir0nLullaby', 'Xen0Bloom',
  'QuartzVeil', 'DriftAugur', 'N1neLives', 'CobaltPsalm', 'Vantablack',
];


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
  141, // Kayn
  875, // Sett
  246, // Qiyana
  517, // Sylas
  350, // Yuumi
  360, // Samira
  777, // Yone
  200, // Bel'Veth
  895, // Nilah
];
