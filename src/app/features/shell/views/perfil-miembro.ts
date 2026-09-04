import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  NfAvatar,
  NfButton,
  NfCombobox,
  NfComboboxOption,
  NfIconButton,
  NfSegmented,
  NfSegmentOption,
  NfSelect,
  NfSkeleton,
} from '../../../ui';
import { Session } from '../../../core/auth';
import { GroupStore } from '../../../core/group-store';
import { GameDataStore } from '../../../core/game-data';
import { RoleSample, buildMemberProfile } from '../../../core/player-profile';
import { MatchHistoryStore, aggregateCross, itemBg } from '../../../core/matches';
import { aggregateMetricRows } from './cross/cross-compare';
import { ProfileGroupsCard } from './profile/profile-groups-card.component';
import { ProfileStreakCard } from './profile/profile-streak-card.component';

/** Las pestañas del perfil ajeno: la lista es a la vez el tipo y el validador del segmentado. */
const MIEMBRO_TABS = ['resumen', 'dna', 'campeones'] as const;
type MiembroTab = (typeof MIEMBRO_TABS)[number];

@Component({
  selector: 'app-perfil-miembro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NfButton,
    NfCombobox,
    NfIconButton,
    NfAvatar,
    NfSegmented,
    NfSelect,
    NfSkeleton,
    ProfileStreakCard,
    ProfileGroupsCard,
  ],
  styleUrl: './perfil-miembro.scss',
  template: `
    <div class="view pf-view">
      <a class="view-back nf-mono" [routerLink]="['/app', 'historial']">
        <span class="view-back__arrow" aria-hidden="true">←</span> Volver al historial
      </a>

      <!--
        Cargando y «no existe» son dos respuestas distintas. Mientras el historial se reproyecta
        sobre las ligas del usuario no se sabe todavía si habéis coincidido, y eso es justo lo
        que decide si este jugador se puede describir o es un 404. Afirmarlo antes de tiempo
        pintaba un 404 falso de camino.
      -->
      @if (loading()) {
        <div class="pf-boot" aria-busy="true">
          <div class="pf-boot__hero">
            <nf-skeleton width="72px" height="72px" radius="10px" />
            <div class="pf-boot__stack">
              <nf-skeleton width="180px" height="24px" />
              <nf-skeleton width="240px" height="12px" />
            </div>
            <nf-skeleton width="96px" height="96px" radius="50%" />
          </div>
          <nf-skeleton width="100%" height="72px" radius="10px" />
          <nf-skeleton width="100%" height="220px" radius="10px" />
        </div>
      } @else if (profile(); as p) {
        <!-- ════════ HERO UNIFICADO COMPACTO (~100px) ════════ -->
        <header class="pf-hero-compact">
          <div class="pf-hero-compact__left">
            <span class="pf-hero-compact__avatar" [style.background]="grad(p.hue)">
              {{ p.initials }}
            </span>

            <div class="pf-hero-compact__info">
              <div class="pf-hero-compact__name-row">
                <h1 class="pf-hero-compact__name">{{ p.name }}</h1>
                <div class="pf-badge-archetype nf-mono" [title]="p.archetype.subtitle">
                  <span class="pf-badge-archetype__title">{{ p.archetype.title }}</span>
                </div>
              </div>

              <div class="pf-hero-compact__meta-row nf-mono">
                <span class="pf-meta-chip">{{ p.tag }}</span>
                <span class="pf-meta-chip">Desde {{ p.memberSince }}</span>
                <!-- Sin partidas suyas que hayas visto no hay posición principal que declarar. -->
                @if (p.mainRole; as rol) {
                  <span class="pf-meta-chip">Rol: {{ rol }}</span>
                }
              </div>
            </div>
          </div>

          <!--
            Solo winrate global y récord. La tendencia de LP que había aquí se ha
            quitado: sin decir de qué liga habla no significa nada, y el jugador
            está en varias. El LP vive en la tarjeta de grupos, con su contexto.
          -->
          <div class="pf-hero-compact__right">
            <div class="pf-hero-compact__kpi-group">
              <div class="pf-hero-compact__ring" [style.--wr]="p.wr" [class.pf-hero-compact__ring--lo]="p.wr < 50">
                <div class="pf-hero-compact__ring-inner">
                  <span class="pf-hero-compact__ring-val nf-mono">{{ p.wr }}%</span>
                  <span class="pf-hero-compact__ring-lbl nf-mono">WR</span>
                </div>
              </div>
              <div class="pf-hero-compact__kpi-text">
                <div class="pf-hero-compact__record nf-mono">
                  <span class="pf-pos">{{ p.wins }}V</span>
                  <span class="pf-sep">-</span>
                  <span class="pf-neg">{{ p.losses }}D</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- ════════ NAVEGACIÓN MODULAR DE PESTAÑAS ════════ -->
        <nav class="pf-tabs-bar">
          <nf-segmented
            variant="tabs"
            [options]="tabOptions"
            [value]="activeTab()"
            (valueChange)="setTab($event)"
            ariaLabel="Secciones del perfil del miembro"
          />
        </nav>

        <!-- ════════ PESTAÑA 1: RESUMEN & CARA A CARA ════════ -->
        @if (activeTab() === 'resumen') {
          <div class="pf-bento">
            <!-- ── Columna Principal (60%): Módulo Tú vs Él + KPIs ── -->
            <div class="pf-bento__col pf-bento__col--main">
              <!-- Tarjeta de Enfrentamiento (VS Battle Card) -->
              @if (cross().length > 0) {
                <section class="pf-card pf-vs-card">
                  <div class="pf-card__header">
                    <span class="pf-card__title nf-mono">Cara a cara directo · tú y {{ p.name }}</span>
                    <a
                      class="pf-meta-chip pf-meta-chip--action nf-mono"
                      [routerLink]="['/app', 'historial-cruzado', p.tag]"
                      [title]="'Ver el historial cruzado completo'"
                    >
                      Historial cruzado
                    </a>
                  </div>

                  <!--
                    Cada ficha lleva a las medias acumuladas de su lado del cruce, que es la
                    pregunta que abre («¿cómo nos va juntos?»). El recorrido a las partidas una
                    a una lo abre el enlace de la cabecera.
                  -->
                  <div class="pf-vs-grid">
                    <a
                      class="pf-vs-tile pf-vs-tile--synergy pf-vs-tile--interactive"
                      [routerLink]="['/app', 'synergy', p.tag]"
                      [attr.aria-label]="'Ver las estadísticas de dúo con ' + p.name"
                      [title]="'Ver las estadísticas de dúo con ' + p.name"
                    >
                      <div class="pf-vs-tile__head nf-mono">
                        <span>Como compañeros</span>
                        <span class="pf-pos">{{ together().games }} partidas</span>
                      </div>
                      <div class="pf-vs-tile__val nf-mono" [class.pf-pos]="together().winrate >= 50">
                        {{ together().games > 0 ? together().winrate + ' % WR' : 'Ninguna aún' }}
                      </div>
                      <div class="pf-vs-tile__sub nf-mono">
                        <span>
                          {{ together().wins }}V · {{ together().losses }}D juntos en el equipo
                        </span>
                      </div>
                    </a>

                    <a
                      class="pf-vs-tile pf-vs-tile--rivalry pf-vs-tile--interactive"
                      [routerLink]="['/app', 'versus', p.tag]"
                      [attr.aria-label]="'Ver los duelos directos contra ' + p.name"
                      [title]="'Ver los duelos directos contra ' + p.name"
                    >
                      <div class="pf-vs-tile__head nf-mono">
                        <span>Duelos directos</span>
                        <span>{{ against().games }} partidas</span>
                      </div>
                      <div class="pf-vs-tile__val nf-mono">
                        {{ against().wins }} - {{ against().losses }}
                      </div>
                      <div class="pf-vs-tile__sub nf-mono">
                        @if (lead() > 0) {
                          <span class="pf-pos">Vas ganando tú (+{{ lead() }})</span>
                        } @else if (lead() < 0) {
                          <span class="pf-neg">Va ganando {{ p.name }} ({{ lead() }})</span>
                        } @else {
                          <span>Marcador empatado</span>
                        }
                      </div>
                    </a>
                  </div>

                  <!-- Medias de los dos, sobre TODAS vuestras partidas en común -->
                  <div class="pf-compare-compact">
                    <div class="pf-compare-compact__head nf-mono">
                      <span class="pf-compare-compact__col pf-compare-compact__col--me">Tú</span>
                      <span class="pf-compare-compact__col pf-compare-compact__col--metric">
                        Medias en vuestras {{ cross().length }} partidas en común
                      </span>
                      <span class="pf-compare-compact__col pf-compare-compact__col--foe">{{ p.name }}</span>
                    </div>

                    @for (r of compareRows(); track r.key) {
                      <div class="pf-compare-compact__row nf-mono">
                        <span
                          class="pf-compare-compact__val pf-compare-compact__val--me"
                          [class.pf-pos]="r.winner === 'me'"
                        >
                          {{ r.mineText }}
                        </span>
                        <span class="pf-compare-compact__label">{{ r.label }}</span>
                        <span
                          class="pf-compare-compact__val pf-compare-compact__val--foe"
                          [class.pf-pos]="r.winner === 'them'"
                        >
                          {{ r.theirsText }}
                        </span>
                      </div>
                    }
                  </div>
                </section>
              } @else {
                <section class="pf-card pf-vs-card">
                  <div class="pf-card__header">
                    <span class="pf-card__title nf-mono">Cara a cara directo · tú y {{ p.name }}</span>
                  </div>
                  <p class="pf-vs-empty">
                    Todavía no habéis coincidido en ninguna partida, ni juntos ni enfrentados.
                    En cuanto disputéis una, el cruce aparecerá aquí.
                  </p>
                </section>
              }

              <!-- Franja de KPIs clave de su carrera -->
              <section class="pf-kpi-strip">
                <div class="pf-kpi-tile">
                  <div class="pf-kpi-tile__lbl nf-mono">KDA Medio</div>
                  <div class="pf-kpi-tile__val nf-mono">{{ p.kda }}</div>
                  <div class="pf-kpi-tile__sub nf-mono">{{ p.dna.survival.avgDeaths }} d/p</div>
                </div>
                <div class="pf-kpi-tile">
                  <div class="pf-kpi-tile__lbl nf-mono">CS / min</div>
                  <div class="pf-kpi-tile__val nf-mono">{{ p.dna.economy.csPerMinAvg }}</div>
                  <div class="pf-kpi-tile__sub nf-mono">{{ p.dna.economy.goldPerMinAvg }} o/m</div>
                </div>
                <div class="pf-kpi-tile">
                  <div class="pf-kpi-tile__lbl nf-mono">% Daño Eq.</div>
                  <div class="pf-kpi-tile__val nf-mono">{{ p.dna.combat.damageSharePercentage }}%</div>
                  <div class="pf-kpi-tile__sub nf-mono">{{ p.dna.combat.killParticipation }}% KP</div>
                </div>
                <div class="pf-kpi-tile">
                  <div class="pf-kpi-tile__lbl nf-mono">% Línea @14</div>
                  <div class="pf-kpi-tile__val nf-mono" [class.pf-pos]="p.dna.lane.wonLanePercentage >= 50">
                    {{ p.dna.lane.wonLanePercentage }}%
                  </div>
                  <div class="pf-kpi-tile__sub nf-mono">
                    {{ p.dna.lane.avgGoldDiffAt14 >= 0 ? '+' : '' }}{{ p.dna.lane.avgGoldDiffAt14 }} oro
                  </div>
                </div>
                <div class="pf-kpi-tile">
                  <div class="pf-kpi-tile__lbl nf-mono">Tasa MVP</div>
                  <div class="pf-kpi-tile__val nf-mono pf-pos">{{ p.dna.clutch.mvpRate }}%</div>
                  <div class="pf-kpi-tile__sub nf-mono">{{ p.pentas }} pentas</div>
                </div>
              </section>

              <!--
                La racha se enseña igual que en el perfil propio: el dato ya venía
                en el modelo y no pintarlo aquí obligaba a abrir otra pantalla para
                saber cómo llega el jugador al que estás mirando.
              -->
              <app-profile-streak-card
                [matches]="p.recentMatches"
                [currentStreak]="p.currentStreak"
                [streakType]="p.streakType"
              />
            </div>

            <!-- ── Columna lateral (40%): campeones insignia y grupos ── -->
            <div class="pf-bento__col pf-bento__col--side">
              <!-- Top campeones -->
              <section class="pf-card">
                <div class="pf-card__header">
                  <span class="pf-card__title nf-mono">Campeones insignia</span>
                  <button
                    nfIconButton
                    size="sm"
                    label="Ver el catálogo completo de campeones"
                    (click)="activeTab.set('campeones')"
                  >
                    <!-- Grid: cuatro celdas, la forma habitual de "ver todo el catálogo". -->
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <rect x="2" y="2" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.4" />
                      <rect x="9" y="2" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.4" />
                      <rect x="2" y="9" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.4" />
                      <rect x="9" y="9" width="5" height="5" rx="1.2" stroke="currentColor" stroke-width="1.4" />
                    </svg>
                  </button>
                </div>

                <div class="pf-mini-champs" [attr.aria-busy]="champsLoading() ? 'true' : null">
                  @for (c of topSignatureChampions(); track c.championId) {
                    <!--
                      BACKEND NOTE: no hay vista de detalle por campeón (winrate, KDA, emparejamientos, runas) porque no hay endpoint que la alimente
                    -->
                    <a class="pf-mini-champ" [routerLink]="['/app', 'tierlist']">
                      <nf-avatar
                        class="pf-mini-champ__avatar"
                        [loading]="champsLoading()"
                        [src]="champion(c.championId)?.iconUrl ?? null"
                        [fallback]="championName(c.championId)"
                        [tint]="c.championId"
                        [size]="38"
                        shape="square"
                      />
                      <div class="pf-mini-champ__meta">
                        <div class="pf-mini-champ__name-row">
                          <span class="pf-mini-champ__name">{{ championName(c.championId) }}</span>
                          <span class="pf-mini-champ__role nf-mono">{{ c.role }}</span>
                        </div>
                        <div class="pf-mini-champ__bar">
                          <div
                            class="pf-mini-champ__bar-fill"
                            [class.pf-mini-champ__bar-fill--lo]="c.wr < 50"
                            [style.width.%]="c.wr"
                          ></div>
                        </div>
                      </div>
                      <div class="pf-mini-champ__stats nf-mono">
                        <span class="pf-mini-champ__wr" [class.pf-neg]="c.wr < 50">{{ c.wr }}%</span>
                        <span class="pf-mini-champ__games">{{ c.games }}p · {{ c.kda }} KDA</span>
                      </div>
                    </a>
                  }
                </div>
              </section>

              <app-profile-groups-card
                [groups]="p.groups"
                title="Grupos en los que participa"
                emptyText="Todavía no está en ningún grupo"
              />
            </div>
          </div>
        }

        <!-- ════════ PESTAÑA 2: ADN & TELEMETRÍA 5V5 ════════ -->
        @if (activeTab() === 'dna') {
          <div class="pf-tab-content">
            <div class="pf-dna-grid">
              <div class="pf-dna-card">
                <div class="pf-dna-card__head nf-mono">
                  Fase de líneas (@14)
                </div>
                <div class="pf-dna-card__big nf-mono" [class.pf-pos]="p.dna.lane.wonLanePercentage >= 50">
                  {{ p.dna.lane.wonLanePercentage }}%
                </div>
                <div class="pf-dna-card__sub nf-mono">Líneas 1v1 ganadas</div>
                <div class="pf-dna-card__metrics nf-mono">
                  <span [class.pf-pos]="p.dna.lane.avgGoldDiffAt14 >= 0" [class.pf-neg]="p.dna.lane.avgGoldDiffAt14 < 0">
                    {{ p.dna.lane.avgGoldDiffAt14 >= 0 ? '+' : '' }}{{ p.dna.lane.avgGoldDiffAt14 }} oro @14
                  </span>
                  <span [class.pf-pos]="p.dna.lane.avgCsDiffAt14 >= 0" [class.pf-neg]="p.dna.lane.avgCsDiffAt14 < 0">
                    {{ p.dna.lane.avgCsDiffAt14 >= 0 ? '+' : '' }}{{ p.dna.lane.avgCsDiffAt14 }} CS @14
                  </span>
                </div>
              </div>

              <div class="pf-dna-card">
                <div class="pf-dna-card__head nf-mono">
                  Combate & Daño
                </div>
                <div class="pf-dna-card__big nf-mono">{{ p.dna.combat.damageSharePercentage }}%</div>
                <div class="pf-dna-card__sub nf-mono">Cuota de daño del equipo</div>
                <div class="pf-dna-card__metrics nf-mono">
                  <span>{{ p.dna.combat.damagePerMin }} daño/min</span>
                  <span>{{ p.dna.combat.killParticipation }}% participación</span>
                </div>
              </div>

              <div class="pf-dna-card">
                <div class="pf-dna-card__head nf-mono">
                  Visión & Mapa
                </div>
                <div class="pf-dna-card__big nf-mono">{{ p.dna.vision.visionScoreAvg }}</div>
                <div class="pf-dna-card__sub nf-mono">Puntos de visión / partida</div>
                <div class="pf-dna-card__metrics nf-mono">
                  <span>{{ p.dna.vision.wardsPlacedAvg }} wards/min</span>
                  <span>{{ p.dna.vision.wardsKilledAvg }} destruidos</span>
                </div>
              </div>

              <div class="pf-dna-card">
                <div class="pf-dna-card__head nf-mono">
                  Economía & Farm
                </div>
                <div class="pf-dna-card__big nf-mono">{{ p.dna.economy.csPerMinAvg }}</div>
                <div class="pf-dna-card__sub nf-mono">CS por minuto medio</div>
                <div class="pf-dna-card__metrics nf-mono">
                  <span>{{ p.dna.economy.goldPerMinAvg }} oro/min</span>
                  <span>{{ p.hoursPlayed }}h jugadas</span>
                </div>
              </div>

              <div class="pf-dna-card">
                <div class="pf-dna-card__head nf-mono">
                  Factor Decisivo
                </div>
                <div class="pf-dna-card__big nf-mono pf-pos">{{ p.dna.clutch.mvpRate }}%</div>
                <div class="pf-dna-card__sub nf-mono">Tasa de MVP</div>
                <div class="pf-dna-card__metrics nf-mono">
                  <span>{{ p.dna.clutch.firstBloodRate }}% 1ª sangre</span>
                  <span>{{ p.pentas }} pentas</span>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- ════════ PESTAÑA 3: CAMPEONES ════════ -->
        @if (activeTab() === 'campeones') {
          <div class="pf-tab-content">
            <div class="pf-champ-toolbar-compact">
              <div class="pf-champ-toolbar-compact__filters">
                <nf-segmented
                  [options]="champRoleFilterOptions"
                  [value]="champRoleFilter()"
                  (valueChange)="champRoleFilter.set($event)"
                  ariaLabel="Filtrar campeones por línea"
                />
                <div class="pf-champ-search">
                  <nf-combobox
                    [options]="championOptions()"
                    [value]="champQuery()"
                    (valueChange)="champQuery.set($event)"
                    [maxVisible]="4"
                    placeholder="Buscar campeón"
                    ariaLabel="Buscar un campeón"
                    emptyText="Ningún campeón coincide"
                  />
                </div>
              </div>
              <nf-select
                [options]="champSortOptions"
                [value]="champSortBy()"
                (valueChange)="champSortBy.set($event)"
              />
            </div>

            <div class="pf-champ-grid">
              @for (c of filteredChampions(); track c.championId) {
                <!--
                  BACKEND NOTE: no hay vista de detalle por campeón (winrate, KDA, emparejamientos, runas) porque no hay endpoint que la alimente.
                  Hasta que exista, el campeón lleva a la tierlist, que es el sitio donde hoy
                  vive todo lo que sabemos de un campeón.
                -->
                <a class="pf-champ-tile" [routerLink]="['/app', 'tierlist']">
                  <div class="pf-champ-tile__head">
                    <nf-avatar
                      class="pf-champ-tile__avatar"
                      [loading]="champsLoading()"
                      [src]="champion(c.championId)?.iconUrl ?? null"
                      [fallback]="championName(c.championId)"
                      [tint]="c.championId"
                      [size]="44"
                      shape="square"
                    />
                    <div class="pf-champ-tile__info">
                      <div class="pf-champ-tile__name-row">
                        <span class="pf-champ-tile__name">{{ championName(c.championId) }}</span>
                        <span class="pf-champ-tile__role nf-mono">{{ c.role }}</span>
                      </div>
                      <div class="pf-champ-tile__kda nf-mono">
                        KDA {{ c.kda }} · {{ c.csPerMin }} CS/m
                      </div>
                    </div>
                    <div class="pf-champ-tile__wr-side nf-mono">
                      <span class="pf-champ-tile__wr" [class.pf-neg]="c.wr < 50">{{ c.wr }}%</span>
                      <span class="pf-champ-tile__games">{{ c.games }} part.</span>
                    </div>
                  </div>

                  <div class="pf-champ-tile__foot">
                    <div class="pf-champ-tile__bar">
                      <div
                        class="pf-champ-tile__bar-fill"
                        [class.pf-champ-tile__bar-fill--lo]="c.wr < 50"
                        [style.width.%]="c.wr"
                      ></div>
                    </div>
                    <div class="pf-champ-tile__items" title="Objetos más frecuentes">
                      @for (itemId of c.coreItemIds; track $index) {
                        <span
                          class="pf-champ-tile__item-slot nf-mono"
                          [style.background]="itemSlotBg(itemId)"
                          [title]="'Objeto #' + itemId"
                        >
                          ●
                        </span>
                      }
                    </div>
                  </div>
                </a>
              } @empty {
                <div class="empty-state">
                  <div class="empty-state__text nf-mono">Ningún campeón coincide con el filtro</div>
                </div>
              }
            </div>
          </div>
        }
      } @else {
        <div class="empty-state">
          <p class="empty-state__text nf-mono">No se encontró el jugador</p>
          <p class="empty-state__hint">El jugador solicitado no pertenece a ninguno de tus grupos activos.</p>
          <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'historial']">
            Volver al historial
          </button>
        </div>
      }
    </div>
  `,
})
export class PerfilMiembro {
  private readonly route = inject(ActivatedRoute);
  private readonly groups = inject(GroupStore);
  private readonly matchHistory = inject(MatchHistoryStore);
  protected readonly session = inject(Session);

  // Sin valor de relleno: un parámetro vacío es un jugador que no existe, y eso lo resuelve el
  // 404 de abajo. Caer a 'Jugador' hacía que la ruta sin id pintase el perfil de alguien.
  readonly userId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('id') ?? '' },
  );

  /**
   * El desglose por posición del jugador ajeno, contado sobre lo que de verdad le has visto
   * jugar: vuestras partidas en común. Es poca muestra a propósito —no tenemos su historial
   * entero, solo la parte que compartís— y por eso las posiciones que no aparecen se pintan
   * como «sin datos» en vez de con un porcentaje inventado.
   */
  private readonly roleSamples = computed<RoleSample[]>(() =>
    this.crossWith().all.map((c) => ({
      role: c.them.role,
      won: c.them.team === c.match.winningTeam,
      wonLane: c.them.stats.wonLane,
    })),
  );

  /** Mientras el historial se reproyecta no se puede afirmar todavía si este jugador existe. */
  readonly loading = computed(() => this.matchHistory.status() === 'loading');

  readonly profile = computed(() => {
    const targetTag = this.userId();
    if (!targetTag) return null;
    return buildMemberProfile(
      targetTag,
      this.groups.groups(),
      (id) => this.groups.rosterOf(id),
      this.roleSamples(),
      // Alguien que ya no comparte grupo contigo pero con quien sí has jugado existe: sus
      // partidas lo prueban. Solo es 404 cuando no aparece por ninguna de las dos vías.
      this.crossWith().all.length > 0,
    );
  });

  // ── Cara a cara ───────────────────────────────────────────────────
  // Sale del historial real, no de una semilla propia: es el mismo `crossWith()` que alimenta
  // el historial cruzado y las dos páginas de medias, así que las cifras de esta ficha y las
  // de la pantalla que abre no pueden discrepar.
  private readonly crossWith = computed(() => this.matchHistory.crossWith(this.userId()));

  /** Todas vuestras partidas en común; su longitud decide si la ficha tiene algo que decir. */
  readonly cross = computed(() => this.crossWith().all);

  readonly together = computed(() => aggregateCross(this.crossWith().allies));
  readonly against = computed(() => aggregateCross(this.crossWith().enemies));

  /** Positivo = vas ganando tú el marcador de los duelos directos. */
  readonly lead = computed(() => this.against().wins - this.against().losses);

  /**
   * Las medias de los dos sobre TODAS vuestras partidas en común, juntos y enfrentados. Es el
   * conjunto más grande y por tanto el más estable: partir la comparativa por relación dejaría
   * medias de dos y tres partidas, que no comparan nada.
   */
  readonly compareRows = computed(() => aggregateMetricRows(aggregateCross(this.cross())));

  // ── Pestañas de Navegación ────────────────────────────────────────
  readonly activeTab = signal<MiembroTab>('resumen');
  readonly tabOptions: readonly NfSegmentOption[] = [
    { value: 'resumen', label: 'Resumen y cara a cara' },
    { value: 'dna', label: 'ADN y stats' },
    { value: 'campeones', label: 'Campeones' },
  ];

  setTab(val: string): void {
    if (MIEMBRO_TABS.includes(val as MiembroTab)) this.activeTab.set(val as MiembroTab);
  }

  // ── Top 3 Signature Champions ─────────────────────────────────────
  readonly topSignatureChampions = computed(() => {
    const p = this.profile();
    return p ? p.topChampions.slice(0, 3) : [];
  });

  // ── Catálogo de campeones ─────────────────────────────────────────
  protected readonly gameData = inject(GameDataStore);
  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  readonly champRoleFilter = signal<string>('TODOS');
  readonly champRoleFilterOptions: readonly NfSegmentOption[] = [
    { value: 'TODOS', label: 'Todos' },
    { value: 'TOP', label: 'TOP' },
    { value: 'JUNGLA', label: 'JG' },
    { value: 'MID', label: 'MID' },
    { value: 'ADC', label: 'ADC' },
    { value: 'SUPPORT', label: 'SUP' },
  ];

  /** Campeón elegido en el buscador. Cadena vacía = sin filtrar. */
  readonly champQuery = signal<string>('');

  /**
   * Solo los campeones que este jugador ha jugado: sugerir uno que no está en la
   * rejilla sería ofrecer un filtro que la deja vacía.
   */
  readonly championOptions = computed<NfComboboxOption[]>(() => {
    const p = this.profile();
    if (!p) return [];
    const byId = this.gameData.championById();
    return p.topChampions
      .map((c) => ({
        value: String(c.championId),
        label: byId.get(c.championId)?.name ?? 'Campeón',
        iconUrl: byId.get(c.championId)?.iconUrl ?? null,
        tint: c.championId,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  });

  readonly champSortBy = signal<string>('games');
  readonly champSortOptions = [
    { value: 'games', label: 'Más jugados' },
    { value: 'wr', label: 'Mayor winrate' },
    { value: 'kda', label: 'Mejor KDA' },
  ];

  readonly filteredChampions = computed(() => {
    const p = this.profile();
    if (!p) return [];
    let list = [...p.topChampions];
    const role = this.champRoleFilter();
    if (role !== 'TODOS') {
      list = list.filter((c) => c.role === role);
    }
    const query = this.champQuery();
    if (query) {
      list = list.filter((c) => String(c.championId) === query);
    }
    const sort = this.champSortBy();
    if (sort === 'wr') {
      list.sort((a, b) => b.wr - a.wr || b.games - a.games);
    } else if (sort === 'kda') {
      list.sort((a, b) => b.kda - a.kda || b.games - a.games);
    } else {
      list.sort((a, b) => b.games - a.games);
    }
    return list;
  });

  champion(id: number) {
    return this.gameData.championById().get(id);
  }

  championName(id: number): string {
    return this.champion(id)?.name ?? 'Campeón';
  }

  itemSlotBg(id: number): string {
    return itemBg(`Item ${id}`);
  }

  grad(hue: number): string {
    return `radial-gradient(circle at 32% 26%, hsl(${hue},90%,64%), hsl(${hue},78%,30%))`;
  }
}

