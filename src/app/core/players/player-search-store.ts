import { Injectable, computed, inject } from '@angular/core';
import { Session } from '../auth';
import { GroupStore } from '../group-store';
import { GroupsStore } from '../groups';
import { LolTier } from '../group-ranking';
import { GlobalSearchItem, GroupSearchResultItem, PlayerSearchResult } from './models';

interface SeedGroup {
  id: string;
  name: string;
  tag: string;
  region: string;
  initials: string;
  c1: string;
  c2: string;
  avatarUrl?: string | null;
  membersCount: number;
}

const SEED_COMMUNITY_GROUPS: SeedGroup[] = [
  { id: 'lan-challenger', name: 'LAN Challenger S14', tag: 'LAN', region: 'LAN', initials: 'LC', c1: 'hsl(320,90%,64%)', c2: 'hsl(280,78%,34%)', membersCount: 28 },
  { id: 'scrim-squad', name: 'Scrim Squad', tag: 'EUW', region: 'EUW', initials: 'SS', c1: 'hsl(190,90%,62%)', c2: 'hsl(205,78%,32%)', membersCount: 12 },
  { id: 'night-owls', name: 'Night Owls', tag: 'NA', region: 'NA', initials: 'NO', c1: 'hsl(150,90%,60%)', c2: 'hsl(160,78%,30%)', membersCount: 5 },
  { id: 'arcane-five', name: 'Arcane Five', tag: 'KR', region: 'KR', initials: 'A5', c1: 'hsl(48,95%,62%)', c2: 'hsl(38,80%,32%)', membersCount: 9 },
  { id: 'valquirias-lan', name: 'Valquirias LAN', tag: 'VLAN', region: 'LAN', initials: 'VL', c1: 'hsl(340,90%,62%)', c2: 'hsl(10,75%,35%)', membersCount: 18 },
  { id: 'kr-bootcamp', name: 'KR Bootcamp Masters', tag: 'KRB', region: 'KR', initials: 'KB', c1: 'hsl(215,90%,62%)', c2: 'hsl(245,75%,35%)', membersCount: 24 },
  { id: 'esports-elite', name: 'Esports Elite Cup', tag: 'EEC', region: 'EUW', initials: 'EE', c1: 'hsl(45,90%,62%)', c2: 'hsl(75,75%,35%)', membersCount: 16 },
  { id: 'twilight-vanguard', name: 'Twilight Vanguard', tag: 'TVG', region: 'EUW', initials: 'TV', c1: 'hsl(268,90%,62%)', c2: 'hsl(298,75%,35%)', membersCount: 14 },
];

interface SeedPlayer {
  userId?: string;
  discordUsername: string;
  riotId: string;
  avatarUrl: string | null;
  initials: string;
  hue: number;
  rankTier: LolTier;
  rankDivision: string | null;
  rankBadge: string;
  rankLabel: string;
  groupSlugs: string[];
  isPrivate?: boolean;
}

/**
 * Catálogo base determinista de jugadores de la comunidad y del ecosistema.
 *
 * BACKEND NOTE: Al migrar al backend (Fase 6), este catálogo en memoria
 * y la lógica en cliente se sustituirán por una llamada HTTP a
 * `GET /api/v1/players/search?query=`.
 */
const SEED_PLAYERS: SeedPlayer[] = [
  {
    userId: '00000000-0000-4000-a000-000000000001',
    discordUsername: 'eduuc',
    riotId: 'EduUC#EUW',
    avatarUrl: null,
    initials: 'ED',
    hue: 210,
    rankTier: 'GOLD',
    rankDivision: 'II',
    rankBadge: 'G2',
    rankLabel: 'Oro II',
    groupSlugs: ['lan-challenger', 'scrim-squad'],
    isPrivate: false,
  },
  {
    userId: '00000000-0000-4000-a000-000000000002',
    discordUsername: 'edgar_p',
    riotId: 'EdgarP#LAN',
    avatarUrl: null,
    initials: 'EP',
    hue: 140,
    rankTier: 'SILVER',
    rankDivision: 'I',
    rankBadge: 'S1',
    rankLabel: 'Plata I',
    groupSlugs: ['lan-challenger'],
    isPrivate: false,
  },
  {
    userId: '00000000-0000-4000-a000-000000000003',
    discordUsername: 'edward',
    riotId: 'EddyLoL#EUW',
    avatarUrl: null,
    initials: 'EW',
    hue: 280,
    rankTier: 'PLATINUM',
    rankDivision: 'IV',
    rankBadge: 'P4',
    rankLabel: 'Platino IV',
    groupSlugs: [],
    isPrivate: false,
  },
  {
    userId: '00000000-0000-4000-a000-000000000004',
    discordUsername: 'edurne_gg',
    riotId: 'Edurne#EUW',
    avatarUrl: null,
    initials: 'ED',
    hue: 330,
    rankTier: 'EMERALD',
    rankDivision: 'II',
    rankBadge: 'E2',
    rankLabel: 'Esmeralda II',
    groupSlugs: ['lan-challenger', 'scrim-squad', 'arcane-five'],
    isPrivate: false,
  },
  {
    userId: '00000000-0000-4000-a000-000000000005',
    discordUsername: 'edwin99',
    riotId: 'EdwinKing#EUW',
    avatarUrl: null,
    initials: 'EK',
    hue: 195,
    rankTier: 'DIAMOND',
    rankDivision: 'IV',
    rankBadge: 'D4',
    rankLabel: 'Diamante IV',
    groupSlugs: [],
    isPrivate: false,
  },
  {
    userId: '00000000-0000-4000-a000-000000000006',
    discordUsername: 'adri_lol',
    riotId: 'Adri_LoL#EUW',
    avatarUrl: null,
    initials: 'AD',
    hue: 170,
    rankTier: 'PLATINUM',
    rankDivision: 'I',
    rankBadge: 'P1',
    rankLabel: 'Platino I',
    groupSlugs: ['lan-challenger', 'scrim-squad'],
    isPrivate: false,
  },
  {
    userId: '00000000-0000-4000-a000-000000000007',
    discordUsername: 'victorgod',
    riotId: 'VictorGod#EUW',
    avatarUrl: null,
    initials: 'VG',
    hue: 260,
    rankTier: 'EMERALD',
    rankDivision: 'IV',
    rankBadge: 'E4',
    rankLabel: 'Esmeralda IV',
    groupSlugs: ['lan-challenger'],
    isPrivate: false,
  },
  {
    userId: '00000000-0000-4000-a000-000000000008',
    discordUsername: 'danig',
    riotId: 'DaniG#EUW',
    avatarUrl: null,
    initials: 'DG',
    hue: 45,
    rankTier: 'GOLD',
    rankDivision: 'I',
    rankBadge: 'G1',
    rankLabel: 'Oro I',
    groupSlugs: ['lan-challenger'],
    isPrivate: false,
  },
  {
    userId: '00000000-0000-4000-a000-000000000009',
    discordUsername: 'paulol',
    riotId: 'PauLoL#EUW',
    avatarUrl: null,
    initials: 'PL',
    hue: 350,
    rankTier: 'BRONZE',
    rankDivision: 'I',
    rankBadge: 'B1',
    rankLabel: 'Bronce I',
    groupSlugs: ['lan-challenger'],
    isPrivate: false,
  },
  // Jugador privado que NO comparte grupo (no debe aparecer en búsquedas)
  {
    userId: '00000000-0000-4000-a000-000000000010',
    discordUsername: 'edward_ghost',
    riotId: 'EdGhost#NA',
    avatarUrl: null,
    initials: 'EG',
    hue: 180,
    rankTier: 'MASTER',
    rankDivision: null,
    rankBadge: 'M',
    rankLabel: 'Master',
    groupSlugs: ['grupo-desconocido'],
    isPrivate: true,
  },
  // Jugador privado que SÍ comparte grupo (debe aparecer en búsquedas)
  {
    userId: '00000000-0000-4000-a000-000000000011',
    discordUsername: 'ed_secret',
    riotId: 'EdSecret#LAN',
    avatarUrl: null,
    initials: 'ES',
    hue: 90,
    rankTier: 'CHALLENGER',
    rankDivision: null,
    rankBadge: 'CH',
    rankLabel: 'Challenger',
    groupSlugs: ['lan-challenger'],
    isPrivate: true,
  },
];

@Injectable({ providedIn: 'root' })
export class PlayerSearchStore {
  private readonly session = inject(Session);
  private readonly groupStore = inject(GroupStore);
  private readonly groupsStore = inject(GroupsStore);

  /** Slugs e IDs de los grupos a los que pertenece el usuario autenticado */
  readonly currentUserGroupSlugs = computed<Set<string>>(() => {
    const slugs = new Set<string>();

    // Grupos mock (slugs como 'lan-challenger')
    for (const g of this.groupStore.groups()) {
      slugs.add(g.id.toLowerCase());
    }

    // Grupos reales del backend
    for (const g of this.groupsStore.groups()) {
      slugs.add(g.id.toLowerCase());
      if (g.name) {
        slugs.add(g.name.toLowerCase());
      }
    }

    return slugs;
  });

  /**
   * Ejecuta la búsqueda predictiva de jugadores.
   *
   * Reglas:
   * 1. Despliegue con longitud mínima de 2 caracteres.
   * 2. Máximo 5 sugerencias.
   * 3. Privacidad: Perfiles con `isPrivate: true` se descartan a menos que
   *    compartan al menos 1 grupo con el usuario actual (`commonGroupsCount > 0`).
   * 4. Ordenación inteligente: Coincidencias con grupos en común y prefijo tienen mayor peso.
   */
  /**
   * Ejecuta la búsqueda predictiva de jugadores y grupos.
   *
   * Reglas:
   * 1. Despliegue con longitud mínima de 2 caracteres.
   * 2. Máximo 5 sugerencias combinadas.
   * 3. Privacidad: Perfiles con `isPrivate: true` se descartan a menos que
   *    compartan al menos 1 grupo con el usuario actual (`commonGroupsCount > 0`).
   * 4. Búsqueda de grupos: Coincidencia por nombre, #TAG o slug.
   * 5. Ordenación inteligente: Coincidencias exactas de prefijo y entidades vinculadas al usuario van primero.
   */
  search(query: string): GlobalSearchItem[] {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const myGroups = this.currentUserGroupSlugs();
    const playerResults: PlayerSearchResult[] = [];
    const groupResults: GroupSearchResultItem[] = [];

    // 1. Incluir al propio usuario si coincide con la búsqueda
    const me = this.session.user();
    if (me) {
      const matchDiscord = me.discordUsername.toLowerCase().includes(q);
      if (matchDiscord) {
        playerResults.push({
          type: 'player',
          userId: me.userId,
          discordUsername: me.discordUsername,
          riotId: `${me.discordUsername}#EUW`,
          avatarUrl: this.session.avatarUrl(),
          initials: this.session.initials(),
          hue: 320,
          rankTier: 'GOLD',
          rankDivision: 'II',
          rankBadge: 'G2',
          rankLabel: 'Oro II',
          commonGroupsCount: myGroups.size,
          isPrivate: false,
        });
      }
    }

    // 2. Filtrar catálogo de jugadores
    for (const p of SEED_PLAYERS) {
      if (me && p.userId === me.userId) continue;

      const matchDiscord = p.discordUsername.toLowerCase().includes(q);
      const matchRiot = p.riotId.toLowerCase().includes(q);

      if (!matchDiscord && !matchRiot) continue;

      let commonCount = 0;
      for (const slug of p.groupSlugs) {
        if (myGroups.has(slug.toLowerCase())) {
          commonCount++;
        }
      }

      if (p.isPrivate && commonCount === 0) {
        continue;
      }

      playerResults.push({
        type: 'player',
        userId: p.userId,
        discordUsername: p.discordUsername,
        riotId: p.riotId,
        avatarUrl: p.avatarUrl,
        initials: p.initials,
        hue: p.hue,
        rankTier: p.rankTier,
        rankDivision: p.rankDivision,
        rankBadge: p.rankBadge,
        rankLabel: p.rankLabel,
        commonGroupsCount: commonCount,
        isPrivate: p.isPrivate,
      });
    }

    // 3. Filtrar catálogo de grupos (reales + mock + comunidad)
    const seenGroupIds = new Set<string>();
    const allGroupsPool: SeedGroup[] = [];

    // Grupos reales
    for (const g of this.groupsStore.groups()) {
      if (!seenGroupIds.has(g.id)) {
        seenGroupIds.add(g.id);
        allGroupsPool.push({
          id: g.id,
          name: g.name,
          tag: g.tag || g.region || 'TAG',
          region: g.region || 'EUW',
          initials: g.initials,
          c1: g.c1,
          c2: g.c2,
          avatarUrl: g.avatarUrl,
          membersCount: 1,
        });
      }
    }

    // Grupos del mock store
    for (const g of this.groupStore.groups()) {
      if (!seenGroupIds.has(g.id)) {
        seenGroupIds.add(g.id);
        allGroupsPool.push({
          id: g.id,
          name: g.name,
          tag: g.tag,
          region: g.tag.split('·')[0].trim() || 'EUW',
          initials: g.initials,
          c1: g.c1,
          c2: g.c2,
          avatarUrl: g.avatar,
          membersCount: g.members,
        });
      }
    }

    // Grupos semilla de comunidad
    for (const g of SEED_COMMUNITY_GROUPS) {
      if (!seenGroupIds.has(g.id)) {
        seenGroupIds.add(g.id);
        allGroupsPool.push(g);
      }
    }

    for (const g of allGroupsPool) {
      const matchName = g.name.toLowerCase().includes(q);
      const matchTag = g.tag.toLowerCase().includes(q) || `#${g.tag}`.toLowerCase().includes(q);
      const matchId = g.id.toLowerCase().includes(q);

      if (matchName || matchTag || matchId) {
        const isMember = myGroups.has(g.id.toLowerCase()) || myGroups.has(g.name.toLowerCase());
        groupResults.push({
          type: 'group',
          id: g.id,
          name: g.name,
          tag: g.tag,
          region: g.region,
          initials: g.initials,
          c1: g.c1,
          c2: g.c2,
          avatarUrl: g.avatarUrl ?? null,
          membersCount: g.membersCount,
          isMember,
        });
      }
    }

    // 4. Combinar y ordenar
    const combined: GlobalSearchItem[] = [...groupResults, ...playerResults];

    combined.sort((a, b) => {
      const aName = a.type === 'group' ? a.name : a.discordUsername;
      const bName = b.type === 'group' ? b.name : b.discordUsername;
      const aStarts = aName.toLowerCase().startsWith(q);
      const bStarts = bName.toLowerCase().startsWith(q);

      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Priorizar grupos de los que eres miembro o jugadores con grupos en común
      const aAffinity = a.type === 'group' ? (a.isMember ? 10 : 1) : (a.commonGroupsCount * 2);
      const bAffinity = b.type === 'group' ? (b.isMember ? 10 : 1) : (b.commonGroupsCount * 2);
      if (bAffinity !== aAffinity) return bAffinity - aAffinity;

      return aName.localeCompare(bName);
    });

    return combined.slice(0, 5);
  }
}
