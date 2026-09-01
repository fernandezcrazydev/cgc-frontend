import { Injectable, computed, inject, signal } from '@angular/core';
import { GroupSearchResult, Region } from './models';
import { GroupsStore } from './groups-store';
import { JoinRequestsStore } from './join-requests-store';

/**
 * Catálogo determinista de grupos públicos recomendados / para búsqueda.
 * BACKEND NOTE: Al migrar a Fase 6 (§5.2.2), se reemplaza por llamadas a
 * `GET /api/v1/groups/search?q=&page=&size=`.
 */
const PUBLIC_GROUPS_CATALOG: GroupSearchResult[] = [
  {
    id: 'grp-search-01',
    name: 'SoloQ Warriors',
    tag: 'EUW',
    region: 'EUW',
    avatarUrl: null,
    memberCount: 28,
    isMember: false,
    joinRequestStatus: 'PENDING',
  },
  {
    id: 'grp-search-02',
    name: 'ARAM Tryhards',
    tag: 'EUW',
    region: 'EUW',
    avatarUrl: null,
    memberCount: 19,
    isMember: false,
    joinRequestStatus: 'NONE',
  },
  {
    id: 'grp-search-03',
    name: 'Nocturne Kings',
    tag: 'LAS',
    region: 'LAS',
    avatarUrl: null,
    memberCount: 12,
    isMember: false,
    joinRequestStatus: 'NONE',
  },
  {
    id: 'grp-search-04',
    name: 'Dragon Slayers',
    tag: 'LAN',
    region: 'LAN',
    avatarUrl: null,
    memberCount: 31,
    isMember: false,
    joinRequestStatus: 'NONE',
  },
  {
    id: 'grp-search-05',
    name: 'Nexus Invaders',
    tag: 'NA',
    region: 'NA',
    avatarUrl: null,
    memberCount: 15,
    isMember: false,
    joinRequestStatus: 'NONE',
  },
  {
    id: 'grp-search-06',
    name: 'Baron Stealers',
    tag: 'EUW',
    region: 'EUW',
    avatarUrl: null,
    memberCount: 24,
    isMember: false,
    joinRequestStatus: 'NONE',
  },
  {
    id: 'grp-search-07',
    name: 'Ionia Spirits',
    tag: 'KR',
    region: 'KR',
    avatarUrl: null,
    memberCount: 35,
    isMember: false,
    joinRequestStatus: 'NONE',
  },
  {
    id: 'grp-search-08',
    name: 'Demacia Elite',
    tag: 'EUW',
    region: 'EUW',
    avatarUrl: null,
    memberCount: 22,
    isMember: false,
    joinRequestStatus: 'NONE',
  },
  {
    id: 'grp-search-09',
    name: 'Noxus Vanguard',
    tag: 'LAN',
    region: 'LAN',
    avatarUrl: null,
    memberCount: 18,
    isMember: false,
    joinRequestStatus: 'NONE',
  },
  {
    id: 'grp-search-10',
    name: 'Freljord Frost',
    tag: 'EUNE',
    region: 'EUNE',
    avatarUrl: null,
    memberCount: 29,
    isMember: false,
    joinRequestStatus: 'NONE',
  },
  {
    id: 'grp-search-11',
    name: 'Piltover Enforcers',
    tag: 'NA',
    region: 'NA',
    avatarUrl: null,
    memberCount: 17,
    isMember: false,
    joinRequestStatus: 'NONE',
  },
  {
    id: 'grp-search-12',
    name: 'Zaun Chemtech',
    tag: 'BR',
    region: 'BR',
    avatarUrl: null,
    memberCount: 14,
    isMember: false,
    joinRequestStatus: 'NONE',
  },
  {
    id: 'grp-search-13',
    name: 'Shurima Ascended',
    tag: 'LAS',
    region: 'LAS',
    avatarUrl: null,
    memberCount: 26,
    isMember: false,
    joinRequestStatus: 'NONE',
  },
  {
    id: 'grp-search-14',
    name: 'Bilgewater Corsairs',
    tag: 'OCE',
    region: 'OCE',
    avatarUrl: null,
    memberCount: 21,
    isMember: false,
    joinRequestStatus: 'NONE',
  },
  {
    id: 'grp-search-15',
    name: 'Shadow Isles Wraiths',
    tag: 'EUW',
    region: 'EUW',
    avatarUrl: null,
    memberCount: 33,
    isMember: false,
    joinRequestStatus: 'NONE',
  },
];

@Injectable({ providedIn: 'root' })
export class GroupsSearchStore {
  private readonly groupsStore = inject(GroupsStore);
  private readonly joinRequestsStore = inject(JoinRequestsStore);

  private readonly _suggested = signal<GroupSearchResult[]>(PUBLIC_GROUPS_CATALOG);
  private readonly _searchResults = signal<GroupSearchResult[]>([]);
  private readonly _searching = signal(false);

  readonly searching = this._searching.asReadonly();
  readonly searchResults = this._searchResults.asReadonly();

  /** Grupos sugeridos actualizados dinámicamente con el estado de pertenencia y solicitudes */
  readonly suggested = computed<GroupSearchResult[]>(() => {
    const myGroups = this.groupsStore.groups();
    const myGroupIds = new Set(myGroups.map((g) => g.id));
    const pendingReqGroupIds = new Set(
      this.joinRequestsStore.myRequests().filter((r) => r.status === 'PENDING').map((r) => r.groupId),
    );

    return this._suggested().map((g) => ({
      ...g,
      isMember: myGroupIds.has(g.id),
      joinRequestStatus: pendingReqGroupIds.has(g.id)
        ? ('PENDING' as const)
        : myGroupIds.has(g.id)
          ? ('ACCEPTED' as const)
          : ('NONE' as const),
    }));
  });

  /** Busca grupos por nombre o #TAG con autocompletado en vivo (máximo 3 sugerencias) */
  async search(query: string, regionFilter?: Region | 'ALL'): Promise<GroupSearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) {
      this._searchResults.set([]);
      return [];
    }

    this._searching.set(true);
    try {
      // Simular latencia de red de 150ms
      await new Promise((resolve) => setTimeout(resolve, 150));

      const myGroups = this.groupsStore.groups();
      const myGroupIds = new Set(myGroups.map((g) => g.id));
      const pendingReqGroupIds = new Set(
        this.joinRequestsStore.myRequests().filter((r) => r.status === 'PENDING').map((r) => r.groupId),
      );

      // Combinar grupos sugeridos y grupos del usuario con tag
      const allPool: GroupSearchResult[] = [
        ...PUBLIC_GROUPS_CATALOG,
        ...myGroups.map((g) => ({
          id: g.id,
          name: g.name,
          tag: g.tag || g.region || 'EUW',
          region: (g.region as Region) || null,
          avatarUrl: g.avatarUrl,
          memberCount: 20,
          isMember: true,
          joinRequestStatus: 'ACCEPTED' as const,
        })),
      ];

      const matches = allPool.filter((g) => {
        const fullTag = `${g.name}#${g.tag}`.toLowerCase();
        const matchesQuery =
          fullTag.includes(q) ||
          g.name.toLowerCase().includes(q) ||
          `#${g.tag.toLowerCase()}`.includes(q);

        const matchesRegion =
          !regionFilter || regionFilter === 'ALL' || g.region === regionFilter;

        return matchesQuery && matchesRegion;
      });

      // Deduplicar por id y limitar a máximo 3 sugerencias para typeahead
      const unique = Array.from(new Map(matches.map((m) => [m.id, m])).values())
        .slice(0, 3)
        .map((g) => ({
          ...g,
          isMember: myGroupIds.has(g.id),
          joinRequestStatus: pendingReqGroupIds.has(g.id)
            ? ('PENDING' as const)
            : myGroupIds.has(g.id)
              ? ('ACCEPTED' as const)
              : ('NONE' as const),
        }));

      this._searchResults.set(unique);
      return unique;
    } finally {
      this._searching.set(false);
    }
  }

  clearSearch(): void {
    this._searchResults.set([]);
  }
}
