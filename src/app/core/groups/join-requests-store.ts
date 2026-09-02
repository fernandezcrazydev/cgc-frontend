import { Injectable, computed, inject, signal } from '@angular/core';
import { Session } from '../auth';
import { ToastService } from '../toast';
import { GroupSearchResult, JoinRequestResponse, JoinRequestStatus, Region } from './models';

/**
 * Semilla determinista de solicitudes de ingreso para desarrollo.
 * BACKEND NOTE: Se sustituye por llamadas reales a `GET /api/v1/join-requests` y
 * `GET /api/v1/groups/{groupId}/join-requests` al implementar la Fase 6 (§5.2.4).
 */
const SEED_MY_REQUESTS: JoinRequestResponse[] = [
  {
    id: 'req-seed-01',
    groupId: 'grp-search-01',
    groupName: 'SoloQ Warriors',
    groupTag: 'EUW',
    groupRegion: 'EUW',
    groupAvatarUrl: null,
    userId: 'me-user-id',
    username: 'N1ghtfang',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'req-seed-02',
    groupId: 'grp-search-04',
    groupName: 'Dragon Slayers',
    groupTag: 'LAN',
    groupRegion: 'LAN',
    groupAvatarUrl: null,
    userId: 'me-user-id',
    username: 'N1ghtfang',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'req-seed-03',
    groupId: 'grp-search-03',
    groupName: 'Nocturne Kings',
    groupTag: 'LAS',
    groupRegion: 'LAS',
    groupAvatarUrl: null,
    userId: 'me-user-id',
    username: 'N1ghtfang',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
];

const SEED_GROUP_REQUESTS: Record<string, JoinRequestResponse[]> = {
  'lan-challenger': [
    {
      id: 'req-group-01',
      groupId: 'lan-challenger',
      groupName: 'LAN Challenger S14',
      groupTag: 'LAN',
      groupRegion: 'LAN',
      userId: 'usr-seed-01',
      username: 'ShadowStrike#LAN',
      userAvatarUrl: null,
      status: 'PENDING',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'req-group-02',
      groupId: 'lan-challenger',
      groupName: 'LAN Challenger S14',
      groupTag: 'LAN',
      groupRegion: 'LAN',
      userId: 'usr-seed-02',
      username: 'ValkyrieSupport#LAN',
      userAvatarUrl: null,
      status: 'PENDING',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ],
};

@Injectable({ providedIn: 'root' })
export class JoinRequestsStore {
  private readonly session = inject(Session);
  private readonly toasts = inject(ToastService);

  private readonly _myRequests = signal<JoinRequestResponse[]>(SEED_MY_REQUESTS);
  private readonly _groupRequests = signal<JoinRequestResponse[]>([]);
  private readonly _pending = signal(false);

  readonly myRequests = this._myRequests.asReadonly();
  readonly groupRequests = this._groupRequests.asReadonly();
  readonly pending = this._pending.asReadonly();

  readonly pendingMyRequestsCount = computed(
    () => this._myRequests().filter((r) => r.status === 'PENDING').length,
  );

  readonly pendingGroupRequestsCount = computed(
    () => this._groupRequests().filter((r) => r.status === 'PENDING').length,
  );

  /** Carga las solicitudes de ingreso enviadas por el usuario logueado. */
  async loadMyRequests(): Promise<JoinRequestResponse[]> {
    // BACKEND NOTE: Al migrar a Fase 6, llamar a GET /api/v1/join-requests
    return this._myRequests();
  }

  /** Carga las solicitudes recibidas para un grupo administrado. */
  async loadGroupRequests(groupId: string): Promise<JoinRequestResponse[]> {
    // BACKEND NOTE: Al migrar a Fase 6, llamar a GET /api/v1/groups/{groupId}/join-requests
    const list = SEED_GROUP_REQUESTS[groupId] || [];
    this._groupRequests.set([...list]);
    return this._groupRequests();
  }

  /** Envía una solicitud de ingreso a un grupo. */
  async sendJoinRequest(group: {
    id: string;
    name: string;
    tag?: string | null;
    region?: Region | null;
    avatarUrl?: string | null;
  }): Promise<void> {
    if (this._pending()) return;
    this._pending.set(true);

    try {
      // Simular latencia de red
      await new Promise((resolve) => setTimeout(resolve, 200));

      const existing = this._myRequests().find(
        (r) => r.groupId === group.id && r.status === 'PENDING',
      );
      if (existing) {
        this.toasts.info(`Ya tienes una solicitud pendiente para "${group.name}"`);
        return;
      }

      const user = this.session.user();
      const newReq: JoinRequestResponse = {
        id: `req-${Date.now()}`,
        groupId: group.id,
        groupName: group.name,
        groupTag: group.tag ?? 'TAG',
        groupRegion: group.region ?? 'EUW',
        groupAvatarUrl: group.avatarUrl ?? null,
        userId: user?.userId ?? 'current-user',
        username: user?.discordUsername ?? 'Invocador',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };

      this._myRequests.update((list) => [newReq, ...list]);
      this.toasts.success(`Solicitud enviada a "${group.name}"`);
    } finally {
      this._pending.set(false);
    }
  }

  /** Cancela una solicitud de ingreso enviada. */
  async cancelJoinRequest(requestId: string): Promise<void> {
    if (this._pending()) return;
    this._pending.set(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const target = this._myRequests().find((r) => r.id === requestId);
      this._myRequests.update((list) => list.filter((r) => r.id !== requestId));
      if (target) {
        this.toasts.info(`Solicitud para "${target.groupName}" cancelada`);
      }
    } finally {
      this._pending.set(false);
    }
  }

  /** Acepta una solicitud de ingreso recibida (Solo Capitán/Admin). */
  async acceptJoinRequest(groupId: string, requestId: string): Promise<void> {
    if (this._pending()) return;
    this._pending.set(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 180));
      const target = this._groupRequests().find((r) => r.id === requestId);
      this._groupRequests.update((list) => list.filter((r) => r.id !== requestId));
      if (SEED_GROUP_REQUESTS[groupId]) {
        SEED_GROUP_REQUESTS[groupId] = SEED_GROUP_REQUESTS[groupId].filter((r) => r.id !== requestId);
      }
      this.toasts.success(`Solicitud de ${target?.username ?? 'jugador'} aceptada. ¡Nuevo miembro añadido!`);
    } finally {
      this._pending.set(false);
    }
  }

  /** Rechaza una solicitud de ingreso recibida (Solo Capitán/Admin). */
  async declineJoinRequest(groupId: string, requestId: string): Promise<void> {
    if (this._pending()) return;
    this._pending.set(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const target = this._groupRequests().find((r) => r.id === requestId);
      this._groupRequests.update((list) => list.filter((r) => r.id !== requestId));
      if (SEED_GROUP_REQUESTS[groupId]) {
        SEED_GROUP_REQUESTS[groupId] = SEED_GROUP_REQUESTS[groupId].filter((r) => r.id !== requestId);
      }
      this.toasts.info(`Solicitud de ${target?.username ?? 'jugador'} rechazada`);
    } finally {
      this._pending.set(false);
    }
  }
}
