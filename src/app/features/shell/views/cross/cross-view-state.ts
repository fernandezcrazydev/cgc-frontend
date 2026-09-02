import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { GameDataStore } from '../../../../core/game-data';
import { GroupStore } from '../../../../core/group-store';
import { GroupsStore } from '../../../../core/groups';
import { Member } from '../../../../core/lobby';
import { CrossAggregate, MatchHistoryStore, aggregateCross } from '../../../../core/matches';
import { CrossPlayer, resolveCrossPlayer } from './cross-player';

/**
 * El contexto común de las cuatro vistas del cruce (historial cruzado, medias en contra,
 * medias juntos y el detalle de una partida): quién es el otro jugador, qué partidas habéis
 * compartido y las medias de cada subconjunto.
 *
 * **No lleva `providedIn`**, igual que `MatchHistoryUiState`: se declara en los `providers` de
 * cada vista, así que depende del `:playerId` de su propia ruta y Angular lo destruye al salir.
 * Vive aquí y no repetido en cada componente porque el proyecto ya arrastra la misma resolución
 * copiada en ocho vistas (`:id` → grupo) y esa deuda está anotada para no propagarla.
 */
@Injectable()
export class CrossViewState {
  private readonly route = inject(ActivatedRoute);
  private readonly groupStore = inject(GroupStore);
  private readonly groupsStore = inject(GroupsStore);
  private readonly gameData = inject(GameDataStore);
  private readonly matchHistory = inject(MatchHistoryStore);

  constructor() {
    // El cruce se calcula sobre el historial, que a su vez se reparte sobre las ligas del
    // usuario: entrar por URL directa tiene que pedir ambas cosas. Las dos son idempotentes.
    this.gameData.ensureLoaded();
    this.groupsStore.ensureLoaded();
  }

  /** El identificador del otro jugador, tal y como viaja hoy en la URL (`Nombre#REGION`). */
  readonly playerId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('playerId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('playerId') ?? '' },
  );

  /**
   * Los cuatro estados que `CLAUDE.md` exige distinguir, en una sola señal.
   *
   * Antes esto era solo `gameData.status() === 'loading'`, y de ahí salía un bug feo: con el
   * catálogo de campeones en `'error'` o en `'idle'`, `loading()` valía `false` y la cascada de
   * las vistas caía en su última rama, que es el 404. Un fallo de red se pintaba como «jugador
   * no encontrado», sin botón de reintentar y sin forma de distinguirlo de un enlace roto.
   *
   * También mira al historial: el cruce se calcula sobre él, y el historial se reproyecta
   * cuando llegan las ligas y la identidad del usuario. Sin esperarlo, la lista de partidas
   * compartidas se pintaba y cambiaba sola un instante después.
   */
  readonly status = computed<'loading' | 'error' | 'ready'>(() => {
    if (this.gameData.status() === 'error') return 'error';
    if (this.gameData.status() === 'idle' || this.gameData.status() === 'loading') return 'loading';
    return this.matchHistory.status() === 'loading' ? 'loading' : 'ready';
  });

  /** Azúcar para las plantillas: no hay nada firme que pintar todavía. */
  readonly loading = computed(() => this.status() === 'loading');

  /** Reintenta lo único que puede fallar aquí: el catálogo de campeones. */
  reload(): void {
    this.gameData.reload();
  }

  private readonly cross = computed(() => this.matchHistory.crossWith(this.playerId()));

  /** Todas las partidas compartidas, de más reciente a más antigua. */
  readonly all = computed(() => this.cross().all);
  /** Las que jugasteis en el mismo equipo. */
  readonly allies = computed(() => this.cross().allies);
  /** Las que jugasteis en bandos opuestos. */
  readonly enemies = computed(() => this.cross().enemies);

  readonly aggregateAll = computed<CrossAggregate>(() => aggregateCross(this.all()));
  readonly aggregateAllies = computed<CrossAggregate>(() => aggregateCross(this.allies()));
  readonly aggregateEnemies = computed<CrossAggregate>(() => aggregateCross(this.enemies()));

  /** `null` = ese jugador no existe (404). Distinto de existir sin partidas en común. */
  readonly player = computed<CrossPlayer | null>(() =>
    resolveCrossPlayer(this.playerId(), this.roster(), this.all()),
  );

  /** El roster de todos tus grupos, sin repetidos: es donde vive la identidad del jugador. */
  private readonly roster = computed<Member[]>(() => {
    const seen = new Set<string>();
    const out: Member[] = [];
    for (const g of this.groupStore.groups()) {
      for (const m of this.groupStore.rosterOf(g.id)) {
        const key = m.tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(m);
      }
    }
    return out;
  });
}
