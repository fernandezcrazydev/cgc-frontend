import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfButton, NfCombobox, NfModal, NfSegmented, NfSkeleton } from '../../../../ui';
import { Session } from '../../../../core/auth';
import { GroupStore } from '../../../../core/group-store';
import { GroupBridge, GroupsStore } from '../../../../core/groups';
import { GameDataStore } from '../../../../core/game-data';
import { hubSeasonsFor } from '../../../../core/group-hub';
import { medalBoardsFor, medalById } from '../../../../core/group-medals';
import {
  SCOPE_OPTIONS,
  StatScope,
  epicRecordsFor,
  mapTelemetryFor,
  metagameFor,
  statsFor,
} from '../../../../core/group-stats';
import { HallOfFameComponent } from './hall-of-fame.component';
import { MedalDetailComponent } from './medal-detail.component';
import { StatsLeadersComponent } from './stats-leaders.component';
import { StatsMapTelemetryComponent } from './stats-map-telemetry.component';
import { StatsMetagameComponent } from './stats-metagame.component';
import { StatsRecordsComponent } from './stats-records.component';

/** Las dos pestañas de §5.5.5. La lista es a la vez el tipo y el validador. */
const STAT_TABS = ['rendimiento', 'medallas'] as const;
type StatTab = (typeof STAT_TABS)[number];

/**
 * Estadísticas del grupo (`Roadmap.md` §5.5.5): panel analítico con dos pestañas,
 * rendimiento competitivo y Hall of Fame.
 *
 * La vista orquesta y navega; cada bloque de la pantalla es un componente propio de
 * esta carpeta con su hoja de estilos. Dos cosas viven en la URL a propósito, porque
 * las dos son destinos a los que se llega desde fuera:
 *   - `?medalla=<id>` abre el detalle de una medalla — es lo que usa la vitrina de
 *     trofeos del hub para aterrizar aquí con SU tarjeta ya abierta (§5.5.4).
 *   - `?jugador=<tag>` despliega la fila de alguien en la tabla de líderes.
 */
@Component({
  selector: 'app-grupo-estadisticas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    NfButton,
    NfCombobox,
    NfModal,
    NfSegmented,
    NfSkeleton,
    HallOfFameComponent,
    MedalDetailComponent,
    StatsLeadersComponent,
    StatsMapTelemetryComponent,
    StatsMetagameComponent,
    StatsRecordsComponent,
  ],
  template: `
    <div class="view gs">
      @switch (bridge.status()) {
        @case ('loading') {
          <ng-container [ngTemplateOutlet]="skeleton" />
        }
        @case ('idle') {
          <ng-container [ngTemplateOutlet]="skeleton" />
        }
        @case ('error') {
          <div class="view__head">
            <h1 class="view__title">No hemos podido cargar el grupo</h1>
            <p class="view__lead">
              La conexión ha fallado. Vuelve a intentarlo en un momento.
            </p>
          </div>
          <button nfButton variant="secondary" size="md" (click)="retry()">Reintentar</button>
        }
        @default {
          @if (group(); as g) {
            <a class="view-back" [routerLink]="['/app', 'grupos', g.id]">
              <span class="view-back__arrow" aria-hidden="true">←</span>
              {{ g.name }}
            </a>

            <header class="view__head view__head--row gs-head">
              <div>
                <div class="view__eyebrow nf-mono">Estadísticas y telemetría</div>
                <h1 class="view__title">{{ g.name }}</h1>
                <p class="view__lead">
                  Cómo juega este grupo y quién manda en cada apartado.
                </p>
              </div>

              <div class="gs-controls">
                @if (seasons().length > 1) {
                  <nf-combobox
                    class="gs-controls__season"
                    [options]="seasonOptions()"
                    [value]="seasonId()"
                    (valueChange)="setSeason($event)"
                    ariaLabel="Temporada"
                    [clearable]="false"
                  />
                }

                <nf-segmented
                  [options]="scopeOptions()"
                  [value]="scope()"
                  (valueChange)="setScope($event)"
                  ariaLabel="Alcance temporal de las estadísticas"
                />
              </div>
            </header>

            <nav class="gs-tabs">
              <nf-segmented
                variant="tabs"
                [options]="tabOptions"
                [value]="tab()"
                (valueChange)="setTab($event)"
                ariaLabel="Secciones de las estadísticas del grupo"
              />
            </nav>

            @if (tab() === 'rendimiento') {
              <div class="gs-stack">
                <app-stats-map-telemetry [telemetry]="telemetry()" [loading]="statsLoading()" />
                <app-stats-metagame [boards]="metagame()" [loading]="statsLoading()" />
                <app-stats-records [records]="records()" [loading]="statsLoading()" />
                <app-stats-leaders
                  [players]="players()"
                  [loading]="statsLoading()"
                  [expandedTag]="expandedTag()"
                  (toggle)="togglePlayer($event)"
                />
              </div>
            } @else {
              <app-hall-of-fame
                [boards]="medals()"
                [loading]="statsLoading()"
                (open)="openMedal($event)"
              />
            }

            @if (openBoard(); as board) {
              <nf-modal
                [title]="board.medal.title"
                width="520px"
                (closed)="closeMedal()"
              >
                <app-medal-detail [board]="board" />
              </nf-modal>
            }
          } @else {
            <div class="view__head">
              <div class="view__eyebrow nf-mono">Error 404</div>
              <h1 class="view__title">Grupo no encontrado</h1>
              <p class="view__lead">El grupo que buscas no existe o ya no perteneces a él.</p>
            </div>
            <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos']">
              Volver a grupos
            </button>
          }
        }
      }
    </div>

    <ng-template #skeleton>
      <nf-skeleton width="180px" height="34px" radius="6px" />
      <div class="view__head">
        <nf-skeleton width="240px" height="30px" />
      </div>
      <div class="gs-stack">
        @for (s of [0, 1, 2]; track s) {
          <nf-skeleton width="100%" height="180px" radius="12px" />
        }
      </div>
    </ng-template>
  `,
  styleUrl: './grupo-estadisticas.scss',
})
export class GrupoEstadisticas {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly groupStore = inject(GroupStore);
  private readonly groupsStore = inject(GroupsStore);
  private readonly gameData = inject(GameDataStore);
  readonly bridge = inject(GroupBridge);

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  /** Tag del jugador cuya fila está desplegada, sincronizado con `?jugador=`. */
  private readonly focusedTag = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('jugador'))),
    { initialValue: this.route.snapshot.queryParamMap.get('jugador') },
  );

  /** Medalla abierta, sincronizada con `?medalla=`. */
  private readonly focusedMedal = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('medalla'))),
    { initialValue: this.route.snapshot.queryParamMap.get('medalla') },
  );

  readonly group = computed(() => {
    const id = this.id();
    if (!id) return null;
    return this.groupStore.byId(id) ?? this.groupsStore.byId(id) ?? null;
  });

  /* ---- Control temporal ---- */

  readonly seasons = computed(() => {
    const g = this.group();
    return g ? hubSeasonsFor(g.id) : [];
  });

  readonly seasonOptions = computed(() =>
    this.seasons().map((s) => ({ value: s.id, label: s.label })),
  );

  readonly seasonId = signal('current');

  /**
   * Con una sola temporada, el histórico repetiría exactamente las cifras de la
   * temporada actual (§5.5.5): un botón que no cambia nada es ruido.
   */
  readonly scopeOptions = computed(() => {
    const multi = this.seasons().length > 1;
    return SCOPE_OPTIONS.filter((s) => multi || s.id !== 'historico').map((s) => ({
      value: s.id,
      label: s.label,
    }));
  });

  readonly scope = signal<StatScope>('temporada');

  /* ---- Pestañas ---- */

  readonly tabOptions = [
    { value: 'rendimiento', label: 'Rendimiento competitivo' },
    { value: 'medallas', label: 'Hall of Fame' },
  ];

  /** Llegar con `?medalla=` significa venir a por una medalla: se abre esa pestaña. */
  readonly tab = linkedSignal<string | null, StatTab>({
    source: this.focusedMedal,
    computation: (medal, prev) => (medal ? 'medallas' : (prev?.value ?? 'rendimiento')),
  });

  readonly expandedTag = linkedSignal<string | null, string | null>({
    source: this.focusedTag,
    computation: (tag, prev) => tag ?? prev?.value ?? null,
  });

  /* ---- Datos ---- */

  /**
   * Nada aparece antes de tiempo: mientras el roster o el catálogo de campeones
   * siguen en vuelo, cada bloque pinta su hueco en lugar de cifras a medio hacer.
   */
  readonly statsLoading = computed(
    () => this.bridge.status() !== 'ready' || this.gameData.status() === 'loading',
  );

  /**
   * Clave de siembra de las estadísticas. La temporada actual usa el id del grupo a
   * secas para que estas cifras coincidan con las del hub y las de los distintivos;
   * una temporada pasada siembra distinto, que es justo lo que se espera de ella.
   */
  private readonly statsKey = computed(() => {
    const g = this.group();
    if (!g) return '';
    const season = this.seasonId();
    return season === 'current' ? g.id : g.id + '@' + season;
  });

  private readonly roster = computed(() => {
    const g = this.group();
    return g ? this.groupStore.rosterOf(g.id) : [];
  });

  private readonly stats = computed(() => {
    const key = this.statsKey();
    return key ? statsFor(key, this.roster(), this.scope()) : [];
  });

  readonly players = computed(() => this.stats());
  readonly telemetry = computed(() => mapTelemetryFor(this.statsKey(), this.stats(), this.scope()));
  readonly metagame = computed(() => metagameFor(this.statsKey(), this.stats()));
  readonly records = computed(() => epicRecordsFor(this.statsKey(), this.stats()));

  /**
   * El tag del usuario activo DENTRO de este roster, o nulo si no pertenece al grupo.
   * Se cruza por `userId`, que es el identificador estable del backend; el tag es solo
   * lo que se pinta.
   */
  private readonly meTag = computed(() => {
    const myId = this.session.user()?.userId;
    if (!myId) return null;
    return this.roster().find((m) => m.userId === myId)?.tag ?? null;
  });

  readonly medals = computed(() => {
    const key = this.statsKey();
    return key ? medalBoardsFor(key, this.roster(), this.scope(), this.meTag()) : [];
  });

  /** La medalla que pide la URL, ya resuelta con su clasificación. */
  readonly openBoard = computed(() => {
    const medal = medalById(this.focusedMedal());
    if (!medal) return null;
    return this.medals().find((b) => b.medal.id === medal.id) ?? null;
  });

  constructor() {
    this.gameData.ensureLoaded();
    this.groupsStore.ensureLoaded();
    effect(() => {
      const id = this.id();
      if (id) void this.bridge.ensure(id);
    });
  }

  /* ---- Acciones ---- */

  retry(): void {
    const id = this.id();
    if (id) void this.bridge.ensure(id);
  }

  setScope(value: string): void {
    this.scope.set(SCOPE_OPTIONS.find((s) => s.id === value)?.id ?? 'temporada');
  }

  setSeason(value: string): void {
    this.seasonId.set(this.seasons().some((s) => s.id === value) ? value : 'current');
  }

  setTab(value: string): void {
    const tab = STAT_TABS.find((t) => t === value) ?? 'rendimiento';
    this.tab.set(tab);
    // Cambiar de pestaña a mano deja de ser "vengo a por esta medalla": si el
    // parámetro se quedara, volver a Hall of Fame reabriría el modal solo.
    if (tab !== 'medallas' && this.focusedMedal()) this.writeParams({ medalla: null });
  }

  togglePlayer(tag: string): void {
    this.writeParams({ jugador: this.expandedTag() === tag ? null : tag });
  }

  openMedal(id: string): void {
    this.writeParams({ medalla: id });
  }

  closeMedal(): void {
    this.writeParams({ medalla: null });
  }

  /**
   * Escribe los parámetros de interfaz sin apilar entradas en el historial: abrir y
   * cerrar un modal cuatro veces no debe costar cuatro pulsaciones de «atrás».
   */
  private writeParams(params: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
