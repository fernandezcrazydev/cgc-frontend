import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { LowerCasePipe } from '@angular/common';
import { NfAvatar, NfButton, NfRankEmblem, NfRankTier, NfSkeleton, NfWindow } from '../../../../ui';
import { GroupDetailStore, GroupMemberResponse, GroupRole } from '../../../../core/groups';
import { Member } from '../../../../core/lobby';
import { hash } from '../../../../core/group-ranking';
import { groupPalmaresFor, groupProfileFor, groupRefereeFor } from '../../../../core/group-hub';
import { lobbyExtrasFor } from '../../../../core/lobby-extras';

export interface DirectoryMemberItem {
  userId: string;
  discordUsername: string;
  avatarUrl: string | null;
  role: GroupRole;
  roleLabel: string;
  isReferee: boolean;
  riotId: string | null;
  rank: {
    tier: NfRankTier;
    label: string;
    name: string;
  } | null;
  hue: number;
}

const ROLE_ORDER: Record<GroupRole, number> = {
  OWNER: 0,
  ADMIN: 1,
  MEMBER: 2,
};

function memberRoleLabel(role: GroupRole): string {
  switch (role) {
    case 'OWNER':
      return 'Propietario';
    case 'ADMIN':
      return 'Administrador';
    case 'MEMBER':
      return 'Miembro';
    default:
      return 'Miembro';
  }
}

function sortMembers(a: GroupMemberResponse, b: GroupMemberResponse): number {
  const roleDiff = (ROLE_ORDER[a.role] ?? 2) - (ROLE_ORDER[b.role] ?? 2);
  if (roleDiff !== 0) return roleDiff;
  return a.discordUsername.localeCompare(b.discordUsername, 'es', { sensitivity: 'base' });
}

/**
 * Tono del avatar de un miembro cuando no tiene foto.
 *
 * Usa el `hash()` de `core/group-ranking` —el mismo FNV-1a con el que la clasificación tiñe a esa
 * misma persona (`mapLeaderboardEntries`)— en vez de reimplementar aquí una función propia. No es
 * solo por no duplicar: los `userId` de un grupo llegan correlativos (`…55`, `…56`, `…57`), y una
 * mezcla del tipo `h * 31 + c` los convierte en tonos consecutivos, así que el directorio entero
 * salía del mismo color ámbar.
 *
 * Queda una tercera derivación viva, el `tintOf()` privado del roster del hub
 * (`group-hub/hub-roster-panel.component.ts`), que sí es de esa familia degenerada. Unificarla es
 * la deuda que `CLAUDE.md` ya anota como «duplicados pendientes de unificar en `shared/`», y no se
 * toca desde aquí porque ese fichero es de otro ítem.
 */
function hueOf(userId: string): number {
  return hash(userId) % 360;
}

function toMockMember(m: GroupMemberResponse): Member {
  return {
    userId: m.userId,
    name: m.discordUsername,
    tag: m.riotId || m.discordUsername,
    initials: m.discordUsername.slice(0, 2).toUpperCase(),
    role: memberRoleLabel(m.role),
    owner: m.role === 'OWNER',
    admin: m.role === 'ADMIN',
    hue: hueOf(m.userId),
    avatar: m.avatarUrl ?? undefined,
  };
}

/**
 * Ficha pública del grupo (`/app/grupos/:id/perfil`), a la que lleva el botón «Perfil del grupo»
 * de la cabecera del hub (Roadmap §5.5.4, §5.5.14).
 *
 * Es la cara institucional del grupo: banner de identidad, palmarés de las tres ligas,
 * cifras clave, sobre la comunidad, reglas de la casa y directorio de miembros.
 */
@Component({
  selector: 'app-grupo-perfil',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './grupo-perfil.scss',
  templateUrl: './grupo-perfil.html',
  imports: [RouterLink, LowerCasePipe, NfAvatar, NfButton, NfRankEmblem, NfSkeleton, NfWindow],
})
export class GrupoPerfil {
  readonly store = inject(GroupDetailStore);

  private readonly routeId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );

  /**
   * Ficha del grupo. Maqueta determinista mientras el DTO real no traiga descripción, reglas ni
   * fecha de fundación (ver `core/group-hub.ts`).
   */
  readonly profile = computed(() => groupProfileFor(this.routeId(), this.store.memberCount()));

  private readonly mockMembers = computed<Member[]>(() =>
    this.store.roster().map(toMockMember),
  );

  readonly palmares = computed(() => groupPalmaresFor(this.routeId(), this.mockMembers()));

  readonly hasAnyTrophy = computed(() => this.palmares().some((t) => t.season !== null));

  readonly refereeUserId = computed(() => groupRefereeFor(this.routeId(), this.mockMembers()));

  readonly isRosterScrollable = computed(() => this.store.memberCount() > 15);

  readonly directoryMembers = computed<DirectoryMemberItem[]>(() => {
    const rawMembers = this.store.roster();
    const refereeId = this.refereeUserId();
    const sorted = [...rawMembers].sort(sortMembers);

    return sorted.map((m) => {
      // BACKEND NOTE: el elo del directorio sale de lobbyExtrasFor(m.userId) mientras
      // GroupMemberResponse no traiga riotTier y riotRank.
      let rank: DirectoryMemberItem['rank'] = null;
      if (m.riotId) {
        const extras = lobbyExtrasFor(m.userId);
        rank = {
          tier: extras.lolRank.tier,
          label: extras.lolRank.label,
          name: extras.lolRank.label.replace(/^SoloQ:\s*/, ''),
        };
      }

      return {
        userId: m.userId,
        discordUsername: m.discordUsername,
        avatarUrl: m.avatarUrl,
        role: m.role,
        roleLabel: memberRoleLabel(m.role),
        isReferee: m.userId === refereeId,
        riotId: m.riotId,
        rank,
        hue: hueOf(m.userId),
      };
    });
  });

  constructor() {
    // Idempotente: la cabecera del shell pide el mismo grupo al entrar en cualquiera de sus
    // secciones, así que aquí no se repite la petición.
    effect(() => {
      const id = this.routeId();
      if (id) void this.store.ensureLoaded(id);
    });
  }

  reload(): void {
    const id = this.routeId();
    if (id) void this.store.load(id);
  }
}
