import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfAvatar, NfBadge, NfSkeleton } from '../../../ui';
import { MatchHistoryStore } from '../../../core/matches/match-history-store';
import { Match, MatchParticipant, TeamSide, TeamSummary } from '../../../core/matches/models';
import {
  ParticipantContribution,
  contributionOf,
  matchOutcomeLabel,
  teamSideLabel,
} from '../../../core/matches/match-view';
import { GameDataStore } from '../../../core/game-data';
import {
  formatCompact,
  formatDuration,
  formatMatchDate,
  formatOrdinal,
} from '../../../shared/date-format';
import { Viewport } from '../../../shared/viewport';
import { MatchScoreboardComponent } from './match-history/match-scoreboard.component';

/** Una barra del bloque de reparto de recursos. */
interface ContributionBar {
  label: string;
  value: number;
}

/** Una tarjeta de rivalidad contra un oponente concreto. */
interface RivalryCard {
  riotId: string;
  championName: string;
  championId: number;
  record: string;
  laneRecord: string | null;
  blurb: string;
}

@Component({
  selector: 'app-partida-detalle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfBadge, NfAvatar, NfSkeleton, MatchScoreboardComponent],
  styleUrl: './partida-detalle.scss',
  template: `
    <div class="view">
      @if (match(); as m) {
        <a class="view-back nf-mono" [routerLink]="backLink()">
          <span class="view-back__arrow" aria-hidden="true">←</span> {{ backLabel() }}
        </a>

        <!-- ======================= CABECERA ======================= -->
        <div class="md-hero" [class]="'md-hero--' + heroTone()">
          <!-- Marcador: lo primero que se quiere saber al abrir una partida -->
          <div class="md-score">
            <div class="md-score__side md-score__side--blue" [class.is-winner]="m.winningTeam === 'blue'">
              <span class="md-score__kills">{{ m.blueTeam.totalKills }}</span>
            </div>
            <span class="md-score__vs nf-mono">VS</span>
            <div class="md-score__side md-score__side--red" [class.is-winner]="m.winningTeam === 'red'">
              <span class="md-score__kills">{{ m.redTeam.totalKills }}</span>
            </div>
          </div>

          <div class="md-hero__meta">
            <div class="md-hero__top nf-mono">
              <span>{{ duration() }}</span>
              <span class="md-hero__dot" aria-hidden="true">·</span>
              <span>{{ goldDiff() }} de ventaja</span>
            </div>

            @if (me(); as u) {
              <div class="md-hero__champ-row">
                <nf-avatar
                  class="md-hero__champ-icon"
                  [loading]="champsLoading()"
                  [src]="championIcon(u.championId)"
                  [fallback]="u.championName"
                  [tint]="u.championId"
                  [size]="38"
                  shape="square"
                  [title]="championName(u.championId)"
                />
                @if (champsLoading()) {
                  <nf-skeleton width="180px" height="clamp(22px, 5vw, 30px)" />
                } @else {
                  <h1 class="md-hero__champ">{{ championName(u.championId) }}</h1>
                }
              </div>
            } @else {
              <h1 class="md-hero__champ">{{ m.group.name }}</h1>
            }

            <div class="md-hero__sub nf-mono">
              <a class="md-hero__group" [routerLink]="['/app', 'grupos', m.groupId, 'historial']">
                {{ m.group.name }}
              </a>
              <span class="md-hero__dot" aria-hidden="true">·</span>
              <span>{{ date() }}</span>
            </div>

            <!--
              Objetivos, sin emoji: la palabra dice qué es sin depender de la fuente.

              Dos formas del mismo dato. En escritorio caben las dos frases enteras y se
              leen de corrido. En móvil esas frases envuelven en cuatro líneas de texto
              denso y obligan a comparar leyendo, así que ahí van enfrentadas en tres
              filas: mismo contenido, un tercio del alto, y la comparación se hace mirando.
            -->
            @if (isMobile()) {
              <div class="md-obj-grid nf-mono">
                <span class="md-obj-grid__head md-obj-grid__head--blue">Azul</span>
                <span aria-hidden="true"></span>
                <span class="md-obj-grid__head md-obj-grid__head--red">Rojo</span>
                @for (row of objectiveRows(); track row.label) {
                  <span class="md-obj-grid__val">{{ row.blue }}</span>
                  <span class="md-obj-grid__label">{{ row.label }}</span>
                  <span class="md-obj-grid__val md-obj-grid__val--red">{{ row.red }}</span>
                }
              </div>
            } @else {
              <div class="md-objectives nf-mono">
                <span class="md-objectives__side md-objectives__side--blue">{{ objectivesOf(m.blueTeam) }}</span>
                <span class="md-objectives__side md-objectives__side--red">{{ objectivesOf(m.redTeam) }}</span>
              </div>
            }
          </div>

          <div class="md-hero__badges">
            <nf-badge [color]="badgeColor()" [dot]="true">{{ outcomeLabel() }}</nf-badge>
            @if (rankMove(); as move) {
              <span class="md-rank nf-mono" [class.is-up]="move.up" [class.is-down]="!move.up">
                {{ move.text }}
              </span>
            }
          </div>
        </div>

        <!-- ======================= HITOS ======================= -->
        @if (milestones().length > 0) {
          <div class="md-milestones">
            @for (ms of milestones(); track ms.label) {
              <div class="md-milestone" [class]="'md-milestone--' + ms.side">
                <span class="md-milestone__label nf-mono">{{ ms.label }}</span>
                <span class="md-milestone__who">{{ ms.who }}</span>
              </div>
            }
          </div>
        }

        <!-- ============ TU PARTIDA CONTRA TU MEDIA ============ -->
        @if (me(); as u) {
          <div class="md-panels">
            <section class="md-panel">
              <h2 class="md-panel__title nf-mono">Cómo te fue</h2>

              <div class="md-compare">
                <div class="md-compare__now">
                  <span class="md-compare__kda">
                    {{ u.stats.kills }}<span class="md-compare__sep">/</span
                    ><span class="m-deaths">{{ u.stats.deaths }}</span
                    ><span class="md-compare__sep">/</span>{{ u.stats.assists }}
                  </span>
                  <span class="md-compare__caption nf-mono">esta partida</span>
                </div>

                @if (averages(); as avg) {
                  <div class="md-compare__avg">
                    <span class="md-compare__kda md-compare__kda--muted">
                      {{ avg.avgKills }}<span class="md-compare__sep">/</span>{{ avg.avgDeaths
                      }}<span class="md-compare__sep">/</span>{{ avg.avgAssists }}
                    </span>
                    <span class="md-compare__caption nf-mono">
                      tu media con {{ championName(u.championId) }} en {{ avg.games }}
                      {{ avg.games === 1 ? 'partida' : 'partidas' }} · {{ avg.winrate }}% de victorias
                    </span>
                  </div>
                }
              </div>

              <div class="md-compare__extra nf-mono">
                {{ u.stats.cs }} CS ({{ u.stats.csPerMin }}/min)
                @if (averages(); as avg) {
                  <span class="md-compare__delta">· tu media es {{ avg.avgCsPerMin }}/min</span>
                }
              </div>

              <!-- Hechizos: ids reales de Data Dragon resueltos por el catálogo -->
              <div class="md-spells">
                @for (spellId of u.stats.spells; track spellId) {
                  <nf-avatar
                    class="md-spell"
                    [loading]="champsLoading()"
                    [src]="spellIcon(spellId)"
                    [fallback]="spellName(spellId)"
                    [tint]="spellId * 40"
                    [size]="28"
                    shape="square"
                    [title]="spellName(spellId)"
                  />
                }
                <span class="md-spells__caption nf-mono">Hechizos de invocador</span>
              </div>
            </section>

            <!-- ============ REPARTO DE RECURSOS ============ -->
            <section class="md-panel">
              <h2 class="md-panel__title nf-mono">Tu peso en el equipo</h2>
              <p class="md-panel__lead">
                Porcentaje sobre tu propio equipo. Comparado con el rival no significaría nada;
                comparado con tus cuatro compañeros dice quién llevaba la partida.
              </p>
              <div class="md-bars">
                @for (bar of contributionBars(); track bar.label) {
                  <div class="md-bar">
                    <span class="md-bar__label nf-mono">{{ bar.label }}</span>
                    <div class="md-bar__track">
                      <div class="md-bar__fill" [style.width.%]="bar.value"></div>
                    </div>
                    <span class="md-bar__value nf-mono">{{ bar.value }}%</span>
                  </div>
                }
              </div>
            </section>
          </div>

          <!-- ============ RIVALIDADES ============ -->
          @if (rivalries().length > 0) {
            <section class="md-section">
              <h2 class="md-panel__title nf-mono">Contra quién jugabas</h2>
              <div class="hl-grid">
                @for (r of rivalries(); track r.riotId) {
                  <div class="hl">
                    <div class="hl__eyebrow nf-mono">{{ r.blurb }}</div>
                    <div class="hl__hero">
                      <nf-avatar
                        class="hl__avatar"
                        [loading]="champsLoading()"
                        [src]="championIcon(r.championId)"
                        [fallback]="r.championName"
                        [tint]="r.championId"
                        [size]="44"
                        shape="square"
                      />
                      <div class="hl__who">
                        <div class="hl__name">{{ r.riotId }}</div>
                        <div class="hl__blurb">{{ r.championName }}</div>
                      </div>
                    </div>
                    <div class="hl__score nf-mono">
                      {{ r.record }}
                      @if (r.laneRecord) {
                        <span class="hl__lane">· {{ r.laneRecord }}</span>
                      }
                    </div>
                  </div>
                }
              </div>
            </section>
          }
        }

        <!-- ============ MARCADOR COMPLETO ============ -->
        <div class="md-scoreboard-wrap">
          <app-match-scoreboard [match]="m" />
        </div>

        <!-- ============ NAVEGACIÓN ENTRE PARTIDAS ============ -->
        <nav class="md-nav" aria-label="Otras partidas">
          @if (neighbours().prev; as prev) {
            <a class="md-nav__link nf-mono" [routerLink]="linkTo(prev)" [queryParams]="queryParams()">
              <span class="md-nav__arrow" aria-hidden="true">←</span>
              <span class="md-nav__text">Partida más reciente</span>
            </a>
          } @else {
            <span class="md-nav__link is-disabled nf-mono">
              <span class="md-nav__text">Es la más reciente</span>
            </span>
          }

          <a class="md-nav__link md-nav__link--center nf-mono" [routerLink]="backLink()">
            {{ backLabel() }}
          </a>

          @if (neighbours().next; as next) {
            <a class="md-nav__link nf-mono" [routerLink]="linkTo(next)" [queryParams]="queryParams()">
              <span class="md-nav__text">Partida anterior</span>
              <span class="md-nav__arrow" aria-hidden="true">→</span>
            </a>
          } @else {
            <span class="md-nav__link is-disabled nf-mono">
              <span class="md-nav__text">Es la más antigua</span>
            </span>
          }
        </nav>
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Error 404</div>
          <h1 class="view__title">Partida no encontrada</h1>
          <p class="view__lead">Esta partida no existe o ya no está disponible.</p>
        </div>
        <a class="view-back nf-mono" [routerLink]="['/app', 'historial']">
          <span class="view-back__arrow" aria-hidden="true">←</span> Volver al historial
        </a>
      }
    </div>
  `,
})
export class PartidaDetalle {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(MatchHistoryStore);
  private readonly gameData = inject(GameDataStore);
  private readonly viewport = inject(Viewport);

  protected readonly isMobile = this.viewport.isMobile;

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  /** Los mismos tres objetivos que `objectivesOf()` pinta en una frase, ya enfrentados. */
  protected readonly objectiveRows = computed(() => {
    const m = this.match();
    if (!m) return [];
    return [
      { label: 'Dragones', blue: m.blueTeam.dragons, red: m.redTeam.dragons },
      { label: 'Barones', blue: m.blueTeam.barons, red: m.redTeam.barons },
      { label: 'Torres', blue: m.blueTeam.towers, red: m.redTeam.towers },
    ];
  });

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  /**
   * De dónde vino el usuario. Lo pone quien enlaza aquí (`?volver=grupo:<id>`), porque desde
   * la propia partida es imposible adivinarlo: una partida pertenece a un grupo Y aparece en
   * tu historial personal. Antes «volver» iba siempre al historial personal, así que llegar
   * desde un grupo era un billete de ida.
   */
  private readonly returnTo = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('volver'))),
    { initialValue: this.route.snapshot.queryParamMap.get('volver') },
  );

  private readonly returnGroupId = computed(() => {
    const raw = this.returnTo();
    return raw?.startsWith('grupo:') ? raw.slice('grupo:'.length) : null;
  });

  readonly match = computed(() => {
    const id = this.id();
    return id ? this.store.matchById(id) ?? null : null;
  });

  protected readonly me = computed(() => this.match()?.userParticipant ?? null);

  protected readonly backLink = computed(() => {
    const groupId = this.returnGroupId();
    return groupId ? ['/app', 'grupos', groupId, 'historial'] : ['/app', 'historial'];
  });

  protected readonly backLabel = computed(() =>
    this.returnGroupId() ? 'Volver al historial del grupo' : 'Volver al historial',
  );

  protected readonly queryParams = computed(() => {
    const raw = this.returnTo();
    return raw ? { volver: raw } : {};
  });

  protected readonly neighbours = computed(() => {
    const m = this.match();
    if (!m) return { prev: null, next: null };
    return this.store.neighboursOf(m.id, this.returnGroupId() ?? undefined);
  });

  protected readonly outcomeLabel = computed(() => matchOutcomeLabel(this.match()?.userOutcome));

  /**
   * Un único tono para la cabecera. La versión anterior calculaba `is-win` y `is-loss` por
   * separado con condiciones que se solapaban (`userOutcome === 'win' || winningTeam === 'blue'`),
   * así que una derrota con victoria azul se pintaba a la vez como victoria y como derrota.
   */
  protected readonly heroTone = computed<'win' | 'loss' | 'neutral'>(() => {
    switch (this.match()?.userOutcome) {
      case 'win':
        return 'win';
      case 'loss':
        return 'loss';
      default:
        return 'neutral';
    }
  });

  protected readonly badgeColor = computed(() => {
    switch (this.heroTone()) {
      case 'win':
        return 'success' as const;
      case 'loss':
        return 'primary' as const;
      default:
        return 'secondary' as const;
    }
  });

  protected readonly duration = computed(() => formatDuration(this.match()?.durationSeconds ?? 0));
  protected readonly date = computed(() => formatMatchDate(this.match()?.decidedAt ?? ''));

  protected readonly goldDiff = computed(() => {
    const m = this.match();
    if (!m) return '';
    const diff = Math.abs(m.blueTeam.totalGold - m.redTeam.totalGold);
    const leader = m.blueTeam.totalGold >= m.redTeam.totalGold ? 'azul' : 'rojo';
    return `${formatCompact(diff)} de oro para el ${leader}`;
  });

  /** «3.º → 2.º en la liga»: es lo que convierte un `+22 LP` en algo que importa. */
  protected readonly rankMove = computed<{ text: string; up: boolean } | null>(() => {
    const u = this.me();
    if (!u || u.rankBefore === undefined || u.rankAfter === undefined) return null;
    const lp = u.lpDelta > 0 ? `+${u.lpDelta}` : `${u.lpDelta}`;
    return {
      text: `${formatOrdinal(u.rankBefore)} → ${formatOrdinal(u.rankAfter)} en la liga (${lp} LP)`,
      // Menor número es mejor posición, así que "subir" es que el número baje.
      up: u.rankAfter < u.rankBefore,
    };
  });

  protected readonly milestones = computed(() => {
    const m = this.match();
    const ms = m?.milestones;
    if (!m || !ms) return [];

    const out: { label: string; who: string; side: TeamSide | 'none' }[] = [];
    if (ms.firstBloodParticipantId) {
      const p = allParticipants(m).find((x) => x.id === ms.firstBloodParticipantId);
      if (p) out.push({ label: 'Primera sangre', who: p.riotId, side: p.team });
    }
    if (ms.firstTowerTeam) {
      out.push({ label: 'Primera torre', who: teamSideLabel(ms.firstTowerTeam), side: ms.firstTowerTeam });
    }
    if (ms.firstDragonTeam) {
      out.push({ label: 'Primer dragón', who: teamSideLabel(ms.firstDragonTeam), side: ms.firstDragonTeam });
    }
    if (ms.firstBaronTeam) {
      out.push({ label: 'Primer barón', who: teamSideLabel(ms.firstBaronTeam), side: ms.firstBaronTeam });
    }
    return out;
  });

  protected readonly averages = computed(() => {
    const u = this.me();
    return u ? this.store.championAverages(u.championId) : null;
  });

  protected readonly contributionBars = computed<ContributionBar[]>(() => {
    const m = this.match();
    const u = this.me();
    if (!m || !u) return [];

    const team = u.team === 'blue' ? m.blueTeam : m.redTeam;
    const c: ParticipantContribution = contributionOf(u, team);
    return [
      { label: 'Daño', value: c.damage },
      { label: 'Oro', value: c.gold },
      { label: 'KP', value: c.killParticipation },
      { label: 'Visión', value: c.vision },
    ];
  });

  /**
   * Los cinco rivales, con el récord acumulado contra cada uno. Se calcula sobre las partidas
   * reales del historial: si la lista enseña que perdiste esas dos, la tarjeta no puede decir
   * otra cosa. Se ordena por número de enfrentamientos, que es donde hay historia que contar.
   */
  protected readonly rivalries = computed<RivalryCard[]>(() => {
    const m = this.match();
    const u = this.me();
    if (!m || !u) return [];

    const rivals = (u.team === 'blue' ? m.redTeam : m.blueTeam).participants;
    return rivals
      .map((rival) => {
        const h2h = this.store.headToHead(rival);
        return {
          riotId: rival.riotId,
          championId: rival.championId,
          championName: this.championName(rival.championId),
          record: `${h2h.wins}V - ${h2h.losses}D`,
          laneRecord:
            h2h.laneGames > 0
              ? `${h2h.laneWins}-${h2h.laneGames - h2h.laneWins} en la línea`
              : null,
          blurb: blurbFor(h2h.wins, h2h.losses),
          games: h2h.games,
        };
      })
      .sort((a, b) => b.games - a.games)
      .slice(0, 3);
  });

  constructor() {
    this.gameData.ensureLoaded();
  }

  protected championIcon(id: number): string | null {
    return this.gameData.championById().get(id)?.iconUrl ?? null;
  }

  protected championName(id: number): string {
    return this.gameData.championById().get(id)?.name ?? 'Campeón';
  }

  protected spellIcon(id: number): string | null {
    return this.gameData.summonerSpellById().get(id)?.iconUrl ?? null;
  }

  protected spellName(id: number): string {
    return this.gameData.summonerSpellById().get(id)?.name ?? `Hechizo ${id}`;
  }

  protected objectivesOf(team: TeamSummary): string {
    const parts = [
      plural(team.dragons, 'dragón', 'dragones'),
      plural(team.barons, 'barón', 'barones'),
      plural(team.towers, 'torre', 'torres'),
    ];
    return `${teamSideLabel(team.side)}: ${parts.join(' · ')}`;
  }

  protected linkTo(m: Match): unknown[] {
    return ['/app', 'historial', m.id];
  }
}

function allParticipants(m: Match): MatchParticipant[] {
  return [...m.blueTeam.participants, ...m.redTeam.participants];
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** El titular de la tarjeta sale del propio récord, no de una etiqueta fija. */
function blurbFor(wins: number, losses: number): string {
  if (wins + losses <= 1) return 'Primer enfrentamiento';
  if (wins > losses) return 'Le tienes la medida';
  if (losses > wins) return 'Se te atraganta';
  return 'Rivalidad igualada';
}
