import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { GameDataStore } from '../../../../core/game-data';
import {
  CrossMatch,
  CrossRelation,
  MatchParticipant,
  formatKda,
  itemBg,
  laneLabel,
  matchOutcomeLabel,
} from '../../../../core/matches';
import { formatDuration, formatLongDate, formatNumber } from '../../../../shared/date-format';
import { NfAvatar, NfButton, NfSkeleton } from '../../../../ui';
import { crossMetricRows } from './cross-compare';
import { CrossViewState } from './cross-view-state';
import { nameOf } from './cross-player';

/**
 * El duelo o la cooperación de UNA partida concreta entre dos jugadores.
 *
 * Sirve a las dos rutas (`/app/versus/:playerId/:matchId` y `/app/synergy/:playerId/:matchId`)
 * porque es la misma página con dos encabezados: lo que cambia es de qué lado estabais, y eso
 * ya lo dice la partida. La ruta declara cuál espera, y si no coincide se responde 404 en vez
 * de pintar una cooperación bajo una URL que dice «versus».
 *
 * Es la versión larga del desplegable de la lista: mismas barras, más métricas, las dos builds
 * y la fase de líneas. El marcador 5v5 completo sigue siendo `/app/historial/:id`, que es donde
 * están los otros ocho jugadores.
 */
@Component({
  selector: 'app-cross-match-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfButton, NfSkeleton],
  styleUrl: './cross-match-detail.scss',
  templateUrl: './cross-match-detail.html',
})
export class CrossMatchDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly gameData = inject(GameDataStore);

  protected readonly state = inject(CrossViewState);

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  private readonly matchId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('matchId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('matchId') ?? '' },
  );

  /** La relación que declara la ruta: `versus` espera rivales y `synergy` compañeros. */
  private readonly expected = toSignal(
    this.route.data.pipe(map((d) => d['relation'] as CrossRelation)),
    { initialValue: this.route.snapshot.data['relation'] as CrossRelation },
  );

  /**
   * La partida cruzada, solo si además cuadra con lo que dice la URL. Enseñar una partida como
   * compañeros bajo `/versus/` sería pintar un dato correcto con una etiqueta falsa.
   */
  protected readonly cross = computed<CrossMatch | null>(() => {
    const found = this.state.all().find((c) => c.id === this.matchId());
    if (!found) return null;
    return found.relation === this.expected() ? found : null;
  });

  protected readonly notFoundHint = computed(() =>
    this.expected() === 'enemy'
      ? 'Esa partida no existe, o no es un enfrentamiento entre vosotros dos.'
      : 'Esa partida no existe, o no la jugasteis en el mismo equipo.',
  );

  protected readonly theirName = computed(() =>
    nameOf(this.cross()?.them.riotId ?? this.state.playerId()),
  );

  protected readonly isWin = computed(() => this.cross()?.match.userOutcome === 'win');
  protected readonly isLoss = computed(() => this.cross()?.match.userOutcome === 'loss');

  protected readonly outcomeLabel = computed(() =>
    matchOutcomeLabel(this.cross()?.match.userOutcome),
  );

  protected readonly duration = computed(() =>
    formatDuration(this.cross()?.match.durationSeconds ?? 0),
  );

  protected readonly date = computed(() => formatLongDate(this.cross()?.match.decidedAt ?? ''));

  protected readonly rows = computed(() => {
    const c = this.cross();
    return c ? crossMetricRows(c, true) : [];
  });

  protected readonly relationLabel = computed(() => {
    const c = this.cross();
    if (!c) return '';
    const mine = laneLabel(c.me.role);
    const theirs = laneLabel(c.them.role);
    if (c.relation === 'ally') return `Sinergia · ${mine} + ${theirs}`;
    return c.sameLane ? `Duelo de línea · ${mine}` : `Enfrentamiento · ${mine} contra ${theirs}`;
  });

  /** Solo si los dos traen el dato: media fase de líneas no es una fase de líneas. */
  protected readonly lanePhase = computed(() => {
    const c = this.cross();
    if (!c) return null;
    const myGold = c.me.stats.goldAt14;
    const theirGold = c.them.stats.goldAt14;
    if (myGold === undefined || theirGold === undefined) return null;

    const myCs = c.me.stats.csAt14 ?? null;
    const theirCs = c.them.stats.csAt14 ?? null;

    return {
      myGold,
      theirGold,
      goldDiff: myGold - theirGold,
      myCs,
      theirCs,
      csDiff: myCs !== null && theirCs !== null ? myCs - theirCs : 0,
    };
  });

  protected readonly laneNote = computed(() => {
    const c = this.cross();
    if (!c || !c.sameLane) return null;
    const mine = c.me.stats.wonLane;
    const theirs = c.them.stats.wonLane;
    if (mine === undefined || theirs === undefined) return null;
    if (mine === theirs) return 'La línea acabó igualada.';
    return mine
      ? `Ganaste la línea a ${this.theirName()}.`
      : `${this.theirName()} te ganó la línea.`;
  });

  /**
   * El cruce anterior y el siguiente dentro de la misma relación. Sin esto la página es una vía
   * muerta: para comparar dos duelos seguidos había que volver a la lista y buscarlos.
   */
  protected readonly neighbours = computed(() => {
    const c = this.cross();
    if (!c) return { prev: null as CrossMatch | null, next: null as CrossMatch | null };
    const scope = this.state.all().filter((x) => x.relation === c.relation);
    const i = scope.findIndex((x) => x.id === c.id);
    return { prev: scope[i - 1] ?? null, next: scope[i + 1] ?? null };
  });

  protected linkTo(c: CrossMatch): unknown[] {
    return ['/app', c.relation === 'ally' ? 'synergy' : 'versus', this.state.playerId(), c.id];
  }

  protected gold(value: number): string {
    return formatNumber(value);
  }

  protected slotBg(name: string): string {
    return itemBg(name);
  }

  protected icon(p: MatchParticipant): string | null {
    return this.gameData.championById().get(p.championId)?.iconUrl ?? null;
  }

  protected championName(p: MatchParticipant): string {
    return this.gameData.championById().get(p.championId)?.name ?? p.championName;
  }

  protected kda(p: MatchParticipant): string {
    return formatKda(p.stats);
  }
}
