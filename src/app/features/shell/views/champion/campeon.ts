import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ChampionStatsStore } from '../../../../core/champions';
import { GameDataStore } from '../../../../core/game-data';
import { GroupsStore } from '../../../../core/groups';
import { NfButton, NfSkeleton } from '../../../../ui';
import { ChampionBuildsCardComponent } from './champion-builds-card.component';
import { ChampionHeroComponent } from './champion-hero.component';
import { ChampionMacroCardComponent } from './champion-macro-card.component';
import { ChampionMatchupsCardComponent } from './champion-matchups-card.component';
import { ChampionSkillsCardComponent } from './champion-skills-card.component';
import { ChampionSpecialistsCardComponent } from './champion-specialists-card.component';

/**
 * Vista de Ficha y Detalle de Campeón (/app/grupos/:id/campeon/:championId y /app/campeon/:championId).
 */
@Component({
  selector: 'app-campeon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NfButton,
    NfSkeleton,
    ChampionHeroComponent,
    ChampionMacroCardComponent,
    ChampionSpecialistsCardComponent,
    ChampionSkillsCardComponent,
    ChampionMatchupsCardComponent,
    ChampionBuildsCardComponent,
  ],
  templateUrl: './campeon.html',
  styleUrls: ['./campeon.scss'],
})
export class Campeon {
  private readonly route = inject(ActivatedRoute);
  private readonly groups = inject(GroupsStore);
  private readonly gameData = inject(GameDataStore);
  private readonly championStatsStore = inject(ChampionStatsStore);

  readonly groupId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: null },
  );

  readonly championId = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const raw = params.get('championId');
        if (!raw) return NaN;
        const num = Number(raw);
        return Number.isFinite(num) && num > 0 ? num : NaN;
      }),
    ),
    { initialValue: NaN },
  );

  readonly group = computed(() => {
    const id = this.groupId();
    return id ? this.groups.byId(id) : null;
  });

  readonly scopeLabel = computed(() => {
    const g = this.group();
    return g ? g.name : 'Todos tus grupos';
  });

  readonly backLabel = computed(() => {
    return this.groupId() ? '‹ Tierlist del grupo' : '‹ Grupos';
  });

  readonly backRoute = computed<(string | number)[]>(() => {
    const gid = this.groupId();
    return gid ? ['/app', 'grupos', gid, 'tierlist'] : ['/app', 'grupos'];
  });

  readonly summary = computed(() => {
    const id = this.championId();
    if (!Number.isFinite(id)) return null;
    return this.gameData.championById().get(id) ?? null;
  });

  readonly detail = computed(() => {
    const id = this.championId();
    if (!Number.isFinite(id)) return null;
    return this.gameData.championDetail(id)();
  });

  readonly statsEntry = computed(() => {
    const id = this.championId();
    if (!Number.isFinite(id)) {
      return { status: 'idle' as const, error: null, data: null };
    }
    const gid = this.groupId();
    return this.championStatsStore.stats(gid, id)();
  });

  readonly stats = computed(() => this.statsEntry().data);

  readonly isLoading = computed(() => {
    if (!Number.isFinite(this.championId())) return false;
    const champLoading = this.gameData.status() === 'loading' || this.gameData.status() === 'idle';
    const statsLoading = this.statsEntry().status === 'loading' || this.statsEntry().status === 'idle';
    return champLoading || statsLoading;
  });

  readonly isNotFound = computed(() => {
    if (!Number.isFinite(this.championId())) return true;
    return !this.isLoading() && this.gameData.status() === 'ready' && !this.summary();
  });

  readonly isError = computed(() => {
    if (!Number.isFinite(this.championId())) return false;
    return this.statsEntry().status === 'error' || this.gameData.status() === 'error';
  });

  readonly errorMessage = computed(() => {
    return this.statsEntry().error ?? 'No se pudo cargar la información del campeón.';
  });

  readonly activeSearch = signal<'sinergias' | 'counters' | null>(null);

  constructor() {
    void this.groups.ensureLoaded();
    void this.gameData.ensureLoaded();
  }

  onSearchToggled(kind: 'sinergias' | 'counters', open: boolean): void {
    if (open) {
      this.activeSearch.set(kind);
    } else if (this.activeSearch() === kind) {
      this.activeSearch.set(null);
    }
  }

  retry(): void {
    void this.gameData.reload();
    this.championStatsStore.invalidate();
  }
}
