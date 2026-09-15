import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { GameDataStore } from '../../../../core/game-data';
import {
  CrossMatch,
  CrossRelation,
  MatchHistoryStore,
  MatchParticipant,
  laneLabel,
  matchOutcomeLabel,
  participantName,
  toCrossMatches,
  wonLane,
} from '../../../../core/matches';
import { formatDuration, formatLongDate, formatNumber } from '../../../../shared/date-format';
import { NfButton, NfSkeleton } from '../../../../ui';
import { crossMetricRows } from './cross-compare';
import { CrossViewState } from './cross-view-state';
import { nameOf } from './cross-player';

/**
 * El duelo o la cooperación de UNA partida concreta entre dos jugadores.
 *
 * Sirve a las dos rutas (`/contra/:matchId` y `/juntos/:matchId`) porque es la misma página con
 * dos encabezados: lo que cambia es de qué lado estabais, y eso ya lo dice la partida. La ruta
 * declara cuál espera, y si no coincide se responde 404 en vez de pintar una cooperación bajo
 * una URL que dice «versus».
 *
 * ## De dónde salen los datos
 *
 * De `GET /matches/{matchId}`, no de la lista. La lista es una página y sus filas solo traen el
 * KDA; las cifras que compara esta pantalla —CS, daño, visión, oro del minuto 14— solo viajan en
 * el detalle. Antes bastaba con buscar la partida en memoria porque el cliente tenía el
 * historial entero.
 *
 * ## Lo que se retiró
 *
 * El bloque «Cómo acabasteis», que enfrentaba las dos builds. Los objetos no se sirven: están
 * guardados en el backend, pero con nombres de campo sacados de la documentación del cliente de
 * LoL que nadie ha visto en un payload medido (issue #69, §8).
 */
@Component({
  selector: 'app-cross-match-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfButton, NfSkeleton],
  styleUrl: './cross-match-detail.scss',
  templateUrl: './cross-match-detail.html',
})
export class CrossMatchDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly gameData = inject(GameDataStore);
  private readonly store = inject(MatchHistoryStore);

  protected readonly state = inject(CrossViewState);

  private readonly matchId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('matchId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('matchId') ?? '' },
  );

  /** La relación que declara la ruta: `contra` espera rivales y `juntos` compañeros. */
  private readonly expected = toSignal(
    this.route.data.pipe(map((d) => d['relation'] as CrossRelation)),
    { initialValue: this.route.snapshot.data['relation'] as CrossRelation },
  );

  constructor() {
    this.gameData.ensureLoaded();
    effect(() => {
      const id = this.matchId();
      // `untracked` no es decorativo: los métodos del store LEEN sus propias signals de
      // estado, así que llamarlos dentro del efecto lo suscribiría a lo que él mismo escribe.
      // Las únicas dependencias del efecto deben ser la consulta y el id.
      if (id) untracked(() => void this.store.ensureDetail(id));
    });
  }

  /**
   * Los cuatro estados, distinguidos. Un 404 del backend cae en `ready` con `cross()` a `null`,
   * que es la pantalla de «ese cruce no existe»; un fallo de red tiene la suya con reintento.
   */
  protected readonly status = computed<'loading' | 'error' | 'ready'>(() => {
    const own = this.store.detailStatus();
    if (own === 'error') return this.store.detailNotFound() ? 'ready' : 'error';
    const champs = this.gameData.status();
    if (own === 'idle' || own === 'loading' || champs === 'idle' || champs === 'loading') {
      return 'loading';
    }
    return 'ready';
  });

  /**
   * La partida cruzada, solo si además cuadra con lo que dice la URL. Enseñar una partida como
   * compañeros bajo `/contra/` sería pintar un dato correcto con una etiqueta falsa.
   */
  protected readonly cross = computed<CrossMatch | null>(() => {
    const match = this.store.detailMatch();
    if (!match || match.id !== this.matchId()) return null;
    const found = toCrossMatches([match], this.state.playerId())[0];
    if (!found) return null;
    return found.relation === this.expected() ? found : null;
  });

  protected readonly notFoundHint = computed(() =>
    this.expected() === 'enemy'
      ? 'Esa partida no existe, o no es un enfrentamiento entre vosotros dos.'
      : 'Esa partida no existe, o no la jugasteis en el mismo equipo.',
  );

  protected readonly theirName = computed(() => {
    const them = this.cross()?.them;
    return them ? nameOf(participantName(them)) : 'Rival';
  });

  protected readonly isWin = computed(() => this.cross()?.match.userOutcome === 'win');
  protected readonly isLoss = computed(() => this.cross()?.match.userOutcome === 'loss');

  /** Cada pieza solo si existe: sin subida no hay duración, y el grupo puede no viajar. */
  protected readonly metaLine = computed(() => {
    const c = this.cross();
    if (!c) return [];
    const parts = [matchOutcomeLabel(c.match.userOutcome)];
    if (c.match.durationSeconds != null) parts.push(formatDuration(c.match.durationSeconds));
    if (c.match.decidedAt) parts.push(formatLongDate(c.match.decidedAt));
    if (c.match.group?.name) parts.push(c.match.group.name);
    return parts;
  });

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

  /**
   * Quién ganó la línea. **Es una estimación nuestra**: sale de comparar el oro del minuto 14
   * con el del rival de la misma línea, porque el backend no sirve ese juicio. El texto lo dice
   * para que no se lea como un dato subido.
   */
  protected readonly laneNote = computed(() => {
    const c = this.cross();
    if (!c || !c.sameLane) return null;
    const mine = wonLane(c.match, c.me);
    if (mine === null) return null;
    return mine
      ? `Por oro en el minuto 14, ganaste la línea a ${this.theirName()}.`
      : `Por oro en el minuto 14, ${this.theirName()} te ganó la línea.`;
  });

  /**
   * El cruce anterior y el siguiente **dentro de la página cargada** de la lista. Con la
   * paginación en servidor, al borde de la página no hay vecino que ofrecer: el enlace
   * desaparece en vez de saltar a una partida que no es la contigua.
   */
  protected readonly neighbours = computed(() => {
    const c = this.cross();
    if (!c) return { prev: null as CrossMatch | null, next: null as CrossMatch | null };
    const scope = this.state.page().filter((x) => x.relation === c.relation);
    const i = scope.findIndex((x) => x.id === c.id);
    if (i === -1) return { prev: null, next: null };
    return { prev: scope[i - 1] ?? null, next: scope[i + 1] ?? null };
  });

  protected linkTo(c: CrossMatch): unknown[] {
    return [
      '/app',
      'jugador',
      this.state.playerId(),
      c.relation === 'ally' ? 'juntos' : 'contra',
      c.id,
    ];
  }

  protected retry(): void {
    const id = this.matchId();
    if (id) void this.store.reloadDetail(id);
  }

  protected gold(value: number): string {
    return formatNumber(value);
  }

  /** Solo el catálogo sabe el nombre: el asiento trae el id y nada más. */
  protected championName(p: MatchParticipant): string {
    if (p.championId == null) return 'Campeón sin registrar';
    return this.gameData.championById().get(p.championId)?.name ?? `Campeón ${p.championId}`;
  }
}
