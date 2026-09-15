import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfAvatar, NfBadge, NfButton, NfRankEmblem, NfSegmented, NfSkeleton } from '../../../../ui';
import { GroupMemberResponse } from '../../../../core/groups';
import { RankEntry } from '../../../../core/group-ranking';

export type RosterTab = 'members' | 'ranking';

/** Acción de gestión sobre un miembro, disparada desde su menú de tres puntos. */
export interface RosterAction {
  kind: 'promote' | 'demote' | 'transfer' | 'kick';
  member: GroupMemberResponse;
}

/**
 * Columna lateral del hub (§5.5.4, el 30%): roster del grupo y clasificación rápida en dos
 * pestañas de **altura fija**, para que cambiar de pestaña no mueva ni un pixel del resto.
 *
 * Las acciones de gestión de cada miembro van en su menú de tres puntos, no como botones
 * sueltos en la fila: en una columna estrecha no caben y, sobre todo, expulsar no debe
 * compartir aspecto con nada que se pulse a diario.
 */
@Component({
  selector: 'app-hub-roster-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfBadge, NfButton, NfRankEmblem, NfSegmented, NfSkeleton],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'openMenu.set(null)',
  },
  templateUrl: './hub-roster-panel.component.html',
  styleUrls: ['./hub-card.scss', './hub-roster-panel.component.scss'],
})
export class HubRosterPanelComponent {
  readonly members = input<readonly GroupMemberResponse[]>([]);
  readonly memberCount = input(0);
  readonly pageSize = input(100);
  readonly page = input(0);
  readonly membersLoading = input(false);
  readonly currentUserId = input<string | null>(null);
  readonly canManage = input(false);
  readonly isOwner = input(false);
  readonly myRole = input<string | null>(null);
  readonly acting = input<ReadonlySet<string>>(new Set<string>());
  readonly pendingRequests = input(0);
  readonly pendingInvites = input(0);

  readonly ranking = input<readonly RankEntry[]>([]);
  readonly rankingLoading = input(false);
  readonly rankingError = input(false);
  readonly myStanding = input<RankEntry | null>(null);
  readonly groupId = input.required<string>();

  readonly action = output<RosterAction>();
  readonly pageChange = output<number>();
  readonly requestsOpen = output<void>();
  readonly invitesOpen = output<void>();

  private readonly _tab = signal<RosterTab>('members');
  readonly tab = this._tab.asReadonly();
  readonly query = signal('');
  /** Menú de tres puntos abierto, por `userId`. Estado de interfaz, no de dominio. */
  readonly openMenu = signal<string | null>(null);

  protected readonly tabOptions = computed(() => [
    { value: 'members', label: 'Miembros · ' + this.memberCount() },
    { value: 'ranking', label: 'Ranking top 10' },
  ]);

  /** Tantos esqueletos como filas muestra la vista (10 filas): la columna no cambia de alto al cargar. */
  protected readonly skeletons = computed(() =>
    Array.from({ length: 10 }, (_, i) => i),
  );

  /**
   * Filtro sobre la página cargada. La paginación es del servidor, así que esto acota lo que ya
   * está en pantalla; el vacío lo dice con esas palabras en vez de fingir que no existe nadie.
   * BACKEND NOTE: con `GET /groups/{id}/members?q=` la búsqueda pasa a ser del servidor.
   */
  readonly visibleMembers = computed(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) return this.members();
    return this.members().filter(
      (m) =>
        m.discordUsername.toLowerCase().includes(term) || (m.riotId ?? '').toLowerCase().includes(term),
    );
  });

  protected readonly gapToFirst = computed(() => {
    const me = this.myStanding();
    const first = this.ranking()[0];
    if (!me || !first) return 0;
    return Math.max(0, first.lpValue - me.lpValue);
  });

  setTab(value: string): void {
    this._tab.set(value as RosterTab);
    this.openMenu.set(null);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected isMe(m: GroupMemberResponse): boolean {
    return m.userId === this.currentUserId();
  }

  protected isNearBottom(index: number): boolean {
    const total = this.visibleMembers().length;
    return total > 1 && index >= total - 2;
  }

  /** Tinte del avatar de reserva, derivado del id: presentación, no dato de dominio. */
  protected tintOf(userId: string): number {
    let h = 0;
    for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) % 360;
    return h;
  }

  /**
   * Qué puede hacer quien mira sobre esa fila. Es solo interfaz: el backend revalida cada
   * permiso, igual que hacía la fila de botones que esto sustituye.
   */
  menuFor(m: GroupMemberResponse): Array<{ kind: RosterAction['kind']; label: string }> {
    const items: Array<{ kind: RosterAction['kind']; label: string }> = [];
    if (this.isMe(m) || !this.canManage()) return items;
    if (this.isOwner() && m.role === 'MEMBER') items.push({ kind: 'promote', label: 'Hacer admin' });
    if (this.isOwner() && m.role === 'ADMIN') items.push({ kind: 'demote', label: 'Quitar admin' });
    if (this.isOwner() && m.role !== 'OWNER') items.push({ kind: 'transfer', label: 'Transferir propiedad' });
    const canKick = m.role !== 'OWNER' && (this.isOwner() || (this.myRole() === 'ADMIN' && m.role === 'MEMBER'));
    if (canKick) items.push({ kind: 'kick', label: 'Expulsar del grupo' });
    return items;
  }

  protected toggleMenu(userId: string, event: Event): void {
    event.stopPropagation();
    this.openMenu.update((open) => (open === userId ? null : userId));
  }

  run(kind: RosterAction['kind'], member: GroupMemberResponse): void {
    this.openMenu.set(null);
    this.action.emit({ kind, member });
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.openMenu()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.hub-roster__more')) return;
    this.openMenu.set(null);
  }
}
