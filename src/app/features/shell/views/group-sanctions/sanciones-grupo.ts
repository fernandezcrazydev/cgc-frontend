import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { Session } from '../../../../core/auth';
import { GroupBridge, GroupDetailStore, GroupsStore } from '../../../../core/groups';
import { GroupStore } from '../../../../core/group-store';
import { Member } from '../../../../core/lobby';
import { groupRefereeFor } from '../../../../core/group-hub';
import {
  GroupSanction,
  GroupSanctionsStore,
} from '../../../../core/group-sanctions';
import { LeaguesStore } from '../../../../core/leagues';
import { ToastService } from '../../../../core/toast';
import { NfButton, NfSkeleton } from '../../../../ui';
import { SanctionAppealModalComponent } from './sanction-appeal-modal.component';
import { SanctionDialogComponent } from './sanction-dialog.component';
import { SanctionHistoryTableComponent } from './sanction-history-table.component';
import { SanctionRowComponent } from './sanction-row.component';

@Component({
  selector: 'app-sanciones-grupo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NfButton,
    NfSkeleton,
    SanctionRowComponent,
    SanctionHistoryTableComponent,
    SanctionAppealModalComponent,
    SanctionDialogComponent,
  ],
  templateUrl: './sanciones-grupo.html',
  styleUrl: './sanciones-grupo.scss',
})
export class SancionesGrupo {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly toasts = inject(ToastService);
  private readonly sanctionsStore = inject(GroupSanctionsStore);
  private readonly groupStore = inject(GroupStore);
  private readonly bridge = inject(GroupBridge);

  readonly groupDetail = inject(GroupDetailStore);
  readonly groupsStore = inject(GroupsStore);
  readonly leagues = inject(LeaguesStore);

  readonly routeId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );

  readonly currentUserId = computed(() => this.session.user()?.userId ?? null);
  readonly currentUserName = computed(() => this.session.user()?.discordUsername ?? null);

  readonly group = computed(() => {
    const id = this.routeId();
    if (!id) return null;
    return this.groupsStore.byId(id) ?? this.groupDetail.group();
  });

  readonly roster = computed<Member[]>(() => {
    const id = this.routeId();
    if (!id) return [];
    return this.groupStore.rosterOf(id);
  });

  readonly refereeUserId = computed(() => {
    const id = this.routeId();
    if (!id) return null;
    return groupRefereeFor(id, this.roster());
  });

  readonly referee = computed(() => {
    const rId = this.refereeUserId();
    if (!rId) return null;
    return this.roster().find((m: Member) => m.userId === rId) ?? null;
  });

  readonly myRole = computed(() => {
    const id = this.routeId();
    if (!id) return null;
    return this.groupsStore.byId(id)?.role ?? null;
  });

  readonly isOwnerOrAdmin = computed(() => {
    const role = this.myRole();
    return role === 'OWNER' || role === 'ADMIN';
  });

  readonly isReferee = computed(() => {
    const me = this.currentUserId();
    const refId = this.refereeUserId();
    return Boolean(me && refId && me === refId);
  });

  readonly canSanction = computed(() => {
    return this.myRole() === 'OWNER' || this.isReferee();
  });

  readonly sanctionsList = computed(() => {
    const id = this.routeId();
    if (!id) return [];
    return this.sanctionsStore.sanctionsOf(
      id,
      this.roster(),
      this.leagues.seasons(),
      this.currentUserId(),
    )();
  });

  readonly activeSanctions = computed(() => {
    return this.sanctionsList().filter((s) => s.status === 'ACTIVE');
  });

  readonly historySanctions = computed(() => {
    return this.sanctionsList().filter((s) => s.status !== 'ACTIVE');
  });

  // Modales
  readonly appealModalData = signal<{ sanction: GroupSanction; mode: 'read' | 'write' } | null>(null);
  readonly showSanctionDialog = signal<boolean>(false);

  constructor() {
    effect(() => {
      const id = this.routeId();
      if (id) {
        // El roster mock lo llena el puente, y sin esta llamada la pantalla se abría con el roster
        // vacío al entrar por enlace directo o al recargar: la lista de sanciones salía vacía —o,
        // antes de quitar el roster de reserva, con gente que no era del grupo—.
        void this.bridge.reload(id);
        void this.groupDetail.load(id);
        this.groupsStore.ensureLoaded();
        void this.leagues.ensureLoaded(id);
        void this.leagues.loadSeasons(id);
      }
    });
  }

  openVote(): void {
    const id = this.routeId();
    this.toasts.success('Votación de árbitro abierta. Está en el hub del grupo.');
    void this.router.navigate(['/app', 'grupos', id]);
  }

  openSanctionModal(): void {
    this.showSanctionDialog.set(true);
  }

  closeSanctionModal(): void {
    this.showSanctionDialog.set(false);
  }

  openAppealRead(sanction: GroupSanction): void {
    this.appealModalData.set({ sanction, mode: 'read' });
  }

  openAppealWrite(sanction: GroupSanction): void {
    this.appealModalData.set({ sanction, mode: 'write' });
  }

  closeAppealModal(): void {
    this.appealModalData.set(null);
  }

  liftSanction(sanction: GroupSanction): void {
    const id = this.routeId();
    const byName = this.currentUserName() ?? this.referee()?.name ?? 'el árbitro';
    this.sanctionsStore.lift(id, sanction.id, byName, this.roster(), this.leagues.seasons(), this.currentUserId());
    this.toasts.success('Sanción levantada.');
  }

  retry(): void {
    const id = this.routeId();
    if (id) {
      void this.groupDetail.load(id);
      void this.leagues.ensureLoaded(id);
    }
  }
}
