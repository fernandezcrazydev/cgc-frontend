import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfButton, NfPagination, NfSkeleton } from '../../../../ui';
import { GroupStore } from '../../../../core/group-store';
import { GroupBridge, GroupDetailStore, GroupsStore } from '../../../../core/groups';
import { LeaguesStore } from '../../../../core/leagues';
import { MatchHistoryStore } from '../../../../core/matches/match-history-store';
import { MatchPreset } from '../../../../core/matches/models';
import {
  activeFilterCount,
  groupMatchQuery,
  presetFromSlug,
} from '../../../../core/matches/match-filtering';
import { GameDataStore } from '../../../../core/game-data';
import { formatDurationMinutes } from '../../../../shared/date-format';
import { Viewport } from '../../../../shared/viewport';
import { ViewMemoryService } from '../../../../shared/view-memory';
import { GroupMatchCardComponent } from '../match-history/group-match-card.component';
import { MatchFiltersComponent } from '../match-history/match-filters.component';
import { MatchHistoryUiState } from '../match-history/match-history-ui';

/**
 * El historial de un grupo: `GET /groups/{id}/matches`, más sus tres tarjetas de cabecera
 * (`/matches/summary`).
 *
 * Dos cosas del contrato mandan sobre lo que se pinta arriba, y no son estilo:
 *
 * - **Los porcentajes se calculan aquí, con el denominador correcto**, porque el servidor manda
 *   cuentas y no medias a propósito. `blueWins + redWins` NO es `totalMatches`: una sala sin
 *   lado decidido no está en ninguno de los dos, así que el winrate por bando se divide entre
 *   `matchesWithSide`. La duración media va sobre `matchesWithStats`, porque solo una partida
 *   subida tiene duración.
 * - **El resumen describe el grupo entero, no la lista filtrada.** El endpoint no acepta
 *   filtros, y la cabecera lo dice en voz alta para que nadie lea las tarjetas como si
 *   siguieran a los controles de abajo.
 */
@Component({
  selector: 'app-grupo-historial',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Instancia propia: los filtros del historial personal no deben venirse puestos aquí.
  providers: [MatchHistoryUiState],
  imports: [
    RouterLink,
    NfButton,
    NfPagination,
    NfSkeleton,
    GroupMatchCardComponent,
    MatchFiltersComponent,
  ],
  styleUrl: './grupo-historial.scss',
  templateUrl: './grupo-historial.html',
})
export class GrupoHistorial {
  private readonly route = inject(ActivatedRoute);
  private readonly groupStore = inject(GroupStore);
  private readonly groupsStore = inject(GroupsStore);
  private readonly groupDetail = inject(GroupDetailStore);
  private readonly leagues = inject(LeaguesStore);
  private readonly bridge = inject(GroupBridge);
  private readonly store = inject(MatchHistoryStore);
  protected readonly ui = inject(MatchHistoryUiState);

  /** El mismo tamaño de página que el historial personal: son la misma lista con otro filtro. */
  protected readonly pageSize = 6;
  protected readonly skeletonCards = [1, 2, 3];
  protected readonly skeletonRows = [1, 2, 3, 4];
  private readonly viewport = inject(Viewport);
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  private readonly gameData = inject(GameDataStore);
  private readonly viewMemory = inject(ViewMemoryService);

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  readonly loading = computed(() => this.bridge.status() === 'loading');

  readonly group = computed(() => {
    const id = this.id();
    if (!id) return null;
    return this.groupStore.byId(id) ?? this.groupsStore.byId(id) ?? null;
  });

  protected readonly matches = this.store.groupMatches;
  protected readonly total = this.store.groupTotal;
  protected readonly summary = this.store.groupSummary;

  protected readonly listStatus = computed(() => {
    const own = this.store.groupStatus();
    if (own === 'error') return 'error';
    const champs = this.gameData.status();
    if (own === 'idle' || own === 'loading' || champs === 'idle' || champs === 'loading') {
      return 'loading';
    }
    return 'ready';
  });

  protected readonly summaryLoading = computed(() => {
    const s = this.store.groupSummaryStatus();
    return s === 'idle' || s === 'loading';
  });

  protected readonly hasFilters = computed(() => activeFilterCount(this.ui.filters(), 'group') > 0);

  /**
   * El winrate por bando se divide entre las partidas CON BANDO, no entre todas: una sala sin
   * lado decidido no está ni en `blueWins` ni en `redWins`, y usar `totalMatches` daría dos
   * porcentajes que no suman 100 sin decir por qué.
   */
  protected readonly blueWinrate = computed(() => {
    const s = this.summary();
    return percent(s?.blueWins ?? 0, s?.matchesWithSide ?? 0);
  });

  protected readonly redWinrate = computed(() => {
    const s = this.summary();
    return percent(s?.redWins ?? 0, s?.matchesWithSide ?? 0);
  });

  /** `null` cuando no hay ninguna partida subida: no hay duración que promediar, y no es «0 min». */
  protected readonly averageDuration = computed(() => {
    const seconds = this.summary()?.averageDurationSeconds;
    return seconds == null ? null : formatDurationMinutes(seconds);
  });

  /**
   * El nombre del líder de MVPs. El resumen manda su `userId` y nada más, así que aquí sí hace
   * falta el censo del grupo —que esta pantalla ya tiene cargado—. Las filas no lo necesitan:
   * cada asiento viene con su nombre.
   */
  protected readonly topMvpName = computed(() => {
    const id = this.summary()?.topMvpUserId;
    if (!id) return null;
    const member = this.groupDetail.roster().find((m) => m.userId === id);
    return member ? (member.riotId ?? member.discordUsername ?? null) : null;
  });

  /** El estado de los controles, traducido a lo que entiende el endpoint. */
  private readonly query = computed(() =>
    groupMatchQuery(this.ui.filters(), this.ui.page() - 1, this.pageSize),
  );

  constructor() {
    this.gameData.ensureLoaded();
    this.groupsStore.ensureLoaded();

    effect(() => {
      const id = this.id();
      if (!id) return;
      this.bridge.ensure(id);
      // Las temporadas alimentan el desplegable de liga del panel de filtros, y el censo
      // resuelve el nombre de cada asiento. Las dos son idempotentes por grupo.
      void this.leagues.loadSeasons(id);
      this.ui.setContextKey('/app/grupos/' + id + '/historial');
      untracked(() => this.applyDeepLink());
    });

    effect(() => {
      const g = this.group();
      if (!g) return;
      const query = this.query();
      // `untracked` no es decorativo: los métodos del store LEEN sus propias signals de
      // estado, así que llamarlos dentro del efecto lo suscribiría a lo que él mismo escribe.
      // Las únicas dependencias del efecto deben ser la consulta y el id.
      untracked(() => void this.store.ensureGroup({ id: g.id, name: g.name }, query));
    });

    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.store.ensureGroupSummary(id));
    });

    afterNextRender(() => {
      const id = this.id();
      if (!id) return;
      // Igual que en el historial personal: el scroll solo se restaura si esto es una vuelta.
      const key = '/app/grupos/' + id + '/historial';
      if (!this.viewMemory.consumeReturn(key)) return;
      const y = this.viewMemory.consumeScroll(key);
      if (y !== null && y > 0) {
        window.scrollTo({ top: y, behavior: 'instant' });
      }
    });
  }

  /**
   * `?liga=caos` y `?temporada=<id>` dejan los filtros puestos al entrar.
   *
   * Es lo que permite enlazar aquí desde donde se habla de una liga —el ranking, las
   * estadísticas del grupo, una sanción— en vez de dejar al usuario repitiendo a mano el filtro
   * que acaba de elegir en la pantalla anterior.
   *
   * Va DESPUÉS de `setContextKey`, y ese orden importa: la clave restaura los filtros guardados
   * de la visita anterior, y lo que pide la URL tiene que ganarle. Un parámetro que no se
   * entiende no toca nada, en vez de dejar la lista vacía por un filtro que nadie pidió.
   *
   * Se lee del `snapshot` y no de la corriente de params a propósito: es la intención con la que
   * se ENTRA. Si siguiera la corriente, el primer toque del usuario en el panel de filtros
   * volvería a imponer lo de la URL.
   */
  private applyDeepLink(): void {
    const qp = this.route.snapshot.queryParamMap;
    const preset = presetFromSlug(qp.get('liga'));
    const leagueId = qp.get('temporada') ?? qp.get('season');

    const patch: Partial<{ preset: MatchPreset; leagueId: string }> = {};
    if (preset) patch.preset = preset;
    if (leagueId) patch.leagueId = leagueId;
    if (Object.keys(patch).length > 0) this.ui.update(patch);
  }

  /**
   * Al cambiar de página, en móvil se vuelve al principio de la LISTA y no del documento:
   * por encima están el resumen y los filtros, que ahí son casi dos pantallas de scroll
   * para llegar otra vez a las partidas que se acaban de pedir. En escritorio ese trecho
   * es corto y el comportamiento no cambia.
   */
  onPageChange(page: number): void {
    this.ui.setPage(page);
    const list = this.viewport.isMobile() ? this.list()?.nativeElement : null;
    if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  retry(): void {
    const g = this.group();
    if (!g) return;
    void this.store.reloadGroup({ id: g.id, name: g.name }, this.query());
  }

  resetFilters(): void {
    this.ui.reset();
  }
}

/** Un denominador de cero da 0%, que es la lectura correcta, no `NaN`. */
function percent(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}
