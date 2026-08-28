import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { GroupsApi } from './groups-api';
import { GroupMemberResponse } from './models';
import { groupView } from './group-view';
import { GroupStore } from '../group-store';
import { Member } from '../lobby';

/** `not-found` = el grupo no existe o no eres miembro (403/404), igual que en `GroupDetailStore`. */
export type GroupBridgeStatus = 'idle' | 'loading' | 'ready' | 'error' | 'not-found';

/**
 * PUENTE TEMPORAL mock↔real para las vistas de matchmaking. Carga del backend la identidad
 * de un grupo y su roster **completo**, los traduce al modelo del store mock (`GroupStore`) y
 * lo siembra, para que las vistas que todavía son maqueta —crear-partida, sala, partidas,
 * ranking, estadísticas, historial— trabajen con los miembros de verdad en vez de con un
 * roster vacío.
 *
 * Por qué existe: `GroupDetailStore` sirve el roster **paginado** (10 por página), que es lo
 * correcto para la tabla del detalle pero inservible para el wizard, que necesita a los 10
 * jugadores a la vez para el gate del 5v5 y el buscador. Aquí se traen todas las páginas.
 *
 * BACKEND NOTE: esto se borra entero cuando el dominio de partidas migre al backend. En ese
 * momento las vistas leerán su propio store y la identidad del jugador será el `userId`; el
 * `tag` estilo `Nombre#EUW` que se fabrica aquí es solo la clave que el mock sabe manejar.
 */
@Injectable({ providedIn: 'root' })
export class GroupBridge {
  private readonly api = inject(GroupsApi);
  private readonly mock = inject(GroupStore);

  /** Tope por página del backend (`GroupService.MAX_MEMBER_PAGE_SIZE`); pedir más se recorta. */
  private static readonly PAGE_SIZE = 100;
  /** Cortafuegos por si el contador y el contenido no cuadran: nunca más de 10 vueltas. */
  private static readonly MAX_PAGES = 10;

  private readonly _status = signal<GroupBridgeStatus>('idle');
  readonly status = this._status.asReadonly();

  /** Grupo ya sembrado en el mock; evita repetir la carga al navegar entre sus sub-vistas. */
  private loadedId: string | null = null;
  /** Petición en vuelo: deduplica llamadas simultáneas y descarta la respuesta de otro id. */
  private inFlight: { id: string; promise: Promise<void> } | null = null;

  /**
   * Asegura que `groupId` está sembrado en el store mock. Idempotente: si ya se cargó, no
   * vuelve a pedir nada; si hay una petición en vuelo para el mismo grupo, se engancha a ella.
   */
  ensure(groupId: string): Promise<void> {
    if (!groupId) return Promise.resolve();
    if (this.loadedId === groupId && this._status() === 'ready') return Promise.resolve();
    if (this.inFlight?.id === groupId) return this.inFlight.promise;
    return this.reload(groupId);
  }

  /** Fuerza el refetch (tras invitar o expulsar, el roster del wizard se ha quedado viejo). */
  reload(groupId: string): Promise<void> {
    const promise = this.fetch(groupId);
    this.inFlight = { id: groupId, promise };
    return promise;
  }

  private async fetch(groupId: string): Promise<void> {
    this.loadedId = null;
    this._status.set('loading');
    try {
      const [membership, members] = await Promise.all([
        firstValueFrom(this.api.detail(groupId)),
        this.allMembers(groupId),
      ]);
      // Si mientras viajaba se pidió otro grupo, esta respuesta ya no interesa.
      if (this.inFlight?.id !== groupId) return;
      const view = groupView(membership);
      this.mock.syncFromBackend(
        {
          id: view.id,
          name: view.name,
          tag: view.region ?? 'LAN',
          initials: view.initials,
          role: view.role === 'OWNER' ? 'Capitán' : 'Miembro',
          members: members.length,
          c1: view.c1,
          c2: view.c2,
          avatar: view.avatarUrl ?? undefined,
        },
        members.map(toMockMember),
      );
      this.loadedId = groupId;
      this._status.set('ready');
    } catch (error) {
      if (this.inFlight?.id !== groupId) return;
      const mockG = this.mock.byId(groupId);
      if (mockG) {
        this.loadedId = groupId;
        this._status.set('ready');
        return;
      }
      this._status.set(isMissing(error) ? 'not-found' : 'error');
    } finally {
      if (this.inFlight?.id === groupId) this.inFlight = null;
    }
  }

  /**
   * Todas las páginas del roster. El wizard necesita el grupo entero (el gate de "¿hay 10?" y
   * el buscador miran a todos), así que aquí sí se pagina hasta agotar `totalElements`.
   */
  private async allMembers(groupId: string): Promise<GroupMemberResponse[]> {
    const out: GroupMemberResponse[] = [];
    for (let page = 0; page < GroupBridge.MAX_PAGES; page++) {
      const res = await firstValueFrom(this.api.members(groupId, page, GroupBridge.PAGE_SIZE));
      out.push(...res.content);
      if (res.content.length === 0 || out.length >= res.totalElements) break;
    }
    return out;
  }

  /** Al cerrar sesión no debe quedar el roster del usuario anterior sembrado en el mock. */
  clear(): void {
    this.loadedId = null;
    this.inFlight = null;
    this._status.set('idle');
  }
}

/** Etiqueta que pinta el mock en la ficha del miembro. */
const ROLE_LABEL: Record<GroupMemberResponse['role'], string> = {
  OWNER: 'Capitán',
  ADMIN: 'Administrador',
  MEMBER: 'Miembro',
};

/**
 * Un miembro real → el `Member` que entiende el mock.
 *
 * El `tag` es la CLAVE con la que el wizard identifica a un jugador (selección, líneas, reglas,
 * reservas), así que tiene que ser único y estable: se usa el Riot ID cuando lo hay y el nombre
 * de Discord cuando no (los dos son únicos). BACKEND NOTE: al migrar, la clave pasa a ser
 * `userId` y esta función desaparece.
 */
function toMockMember(m: GroupMemberResponse): Member {
  const name = m.discordUsername || m.riotId || m.userId.slice(0, 8);
  return {
    name,
    tag: m.riotId || name,
    initials: name.slice(0, 2).toUpperCase(),
    role: ROLE_LABEL[m.role],
    owner: m.role === 'OWNER',
    admin: m.role === 'ADMIN',
    // Del userId y no del índice: el color de un jugador no cambia al entrar o salir otro.
    hue: hueOf(m.userId),
    // La foto de Discord que ya sirve el roster; sin ella el avatar cae a las iniciales.
    avatar: m.avatarUrl ?? undefined,
  };
}

/** Tono estable (0-359) derivado del id, para el degradado del avatar. */
function hueOf(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

/** Un 403 (no eres miembro) o un 404 (no existe) se tratan igual: la vista muestra su 404. */
function isMissing(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);
}
