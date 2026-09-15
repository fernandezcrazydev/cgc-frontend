import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { GameDataStore } from '../../../../core/game-data';
import { GroupsStore } from '../../../../core/groups';
import {
  CrossMatch,
  CrossRelation,
  MatchHistoryStore,
  PersonalHistorySummary,
  personalMatchQuery,
  personalSummaryQuery,
  toCrossMatches,
} from '../../../../core/matches';
import { MatchHistoryUiState } from '../match-history/match-history-ui';
import { CrossPlayer, resolveCrossPlayer } from './cross-player';

/**
 * El contexto común de las vistas del cruce: quién es el otro jugador, qué partidas habéis
 * compartido y cuántas de cada tipo.
 *
 * ## El cruce es un filtro, no un endpoint
 *
 * `GET /me/matches?with={userId}` son las partidas en las que coincidisteis, y
 * `&relation=ALLY|ENEMY` las acota. El recuento sale de `GET /me/matches/summary`, que acepta
 * los mismos parámetros: sin relación, «cuántas veces hemos coincidido»; con ella, «juntos» o
 * «enfrentados». **La relación la decide el servidor leyendo los dos equipos**, no se adivina.
 *
 * ## Lo que ya no hay, y por qué
 *
 * Las medias comparadas —CS por minuto de cada uno, rachas vivas, emparejamientos de campeón
 * repetidos— se calculaban sobre el historial ENTERO cuando el cliente lo tenía en memoria. Con
 * la paginación en servidor solo hay una página, y promediarla y llamarlo «vuestro récord»
 * sería peor que no darlo. Es una superficie analítica propia y se sirve aparte (issue #69, §8).
 *
 * **No lleva `providedIn`**, igual que `MatchHistoryUiState`: se declara en los `providers` de
 * la vista contenedora, así que depende del `:playerId` de su propia ruta y Angular lo destruye
 * al salir.
 */
@Injectable()
export class CrossViewState {
  private readonly route = inject(ActivatedRoute);
  private readonly groupsStore = inject(GroupsStore);
  private readonly gameData = inject(GameDataStore);
  private readonly store = inject(MatchHistoryStore);
  private readonly ui = inject(MatchHistoryUiState);

  /** Cuántas partidas cruzadas caben en una página de la lista. */
  readonly pageSize = 5;

  /**
   * El identificador del otro jugador: su `userId`, que es lo que entiende `with=`.
   *
   * Antes viajaba su Riot ID (`Nombre#REGION`) porque era el único identificador compartido del
   * mock. El backend no lo acepta, y además ese tag puede ser ya de otra persona.
   */
  readonly playerId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('playerId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('playerId') ?? '' },
  );

  /** La relación que se está mirando: la fija la pestaña, no el panel de filtros. */
  private readonly _relation = signal<CrossRelation | 'all'>('all');
  readonly relation = this._relation.asReadonly();

  setRelation(relation: CrossRelation | 'all'): void {
    if (relation === this._relation()) return;
    this._relation.set(relation);
    this.ui.setPage(1);
  }

  /**
   * El cruce tal y como viaja. Cuando la pestaña no fija relación (el historial completo), manda
   * la del panel de filtros: si no, el desplegable «Relación» estaría pintado sin hacer nada.
   */
  private readonly cross = computed(() => ({
    with: this.playerId(),
    relation: this._relation() === 'all' ? this.ui.filters().relation : this._relation(),
  }));

  private readonly listQuery = computed(() =>
    personalMatchQuery(this.ui.filters(), this.ui.page() - 1, this.pageSize, this.cross()),
  );

  constructor() {
    this.gameData.ensureLoaded();
    this.groupsStore.ensureLoaded();

    effect(() => {
      if (!this.playerId()) return;
      const query = this.listQuery();
      // `untracked` no es decorativo: los métodos del store LEEN sus propias signals de
      // estado, así que llamarlos dentro del efecto lo suscribiría a lo que él mismo escribe.
      // Las únicas dependencias del efecto deben ser la consulta y el id.
      untracked(() => void this.store.ensurePersonal(query));
    });

    // Los tres recuentos de las pestañas: total, juntos y enfrentados. Son tres consultas al
    // MISMO endpoint con distinta relación, y el store las deduplica por consulta.
    effect(() => {
      const id = this.playerId();
      if (!id) return;
      const filters = this.ui.filters();
      untracked(() => {
        for (const relation of ['all', 'ally', 'enemy'] as const) {
          void this.store.ensurePersonalSummary(
            personalSummaryQuery(filters, { with: id, relation }),
          );
        }
      });
    });
  }

  /**
   * Los estados que `CLAUDE.md` exige distinguir, en una sola señal, más uno propio de esta
   * pantalla: `private`, que no es ni un error ni un vacío sino una puerta cerrada a propósito.
   *
   * Mira también al catálogo de campeones: la lista no está lista para enseñarse sin los
   * nombres, y pintarla y cambiarla un instante después es el salto que los esqueletos existen
   * para evitar. Un fallo de red del catálogo tiene que salir como error y no como «jugador no
   * encontrado», que es lo que pasaba cuando esta señal solo miraba a `gameData.status()`.
   */
  readonly status = computed<'loading' | 'error' | 'private' | 'ready'>(() => {
    const champs = this.gameData.status();
    // Antes que el error, porque viaja DENTRO de uno: el 403 llega por el mismo `catch` que un
    // fallo de red, y pintarlo como error ofrecería un «Reintentar» que no puede funcionar nunca.
    if (this.store.personalProfilePrivate()) return 'private';
    if (champs === 'error' || this.store.personalStatus() === 'error') return 'error';
    if (champs === 'idle' || champs === 'loading') return 'loading';
    const own = this.store.personalStatus();
    return own === 'idle' || own === 'loading' ? 'loading' : 'ready';
  });

  /**
   * Esa persona tiene el perfil privado y quien mira no puede verlo (`403 PROFILE_PRIVATE`).
   *
   * Es una respuesta correcta y no un fallo: el backend decide, y esta pantalla existía dibujada
   * desde antes de que hubiera nada que la disparara — su estado era `tag.includes('secret')`.
   * Ahora sale de una preferencia de verdad (`cgc-backend#98`).
   */
  readonly profilePrivate = computed(() => this.status() === 'private');

  /** Azúcar para las plantillas: no hay nada firme que pintar todavía. */
  readonly loading = computed(() => this.status() === 'loading');

  reload(): void {
    this.gameData.reload();
    void this.store.reloadPersonal(this.listQuery());
  }

  /** La página actual de partidas compartidas, con los dos asientos ya emparejados. */
  readonly page = computed<CrossMatch[]>(() =>
    toCrossMatches(this.store.personalMatches(), this.playerId()),
  );

  /** Cuántas hay en total según el filtro activo; lo dice el servidor, no la página. */
  readonly total = this.store.personalTotal;

  /**
   * Los tres recuentos de las pestañas. `null` mientras ese resumen viaja.
   *
   * Los tres a la vez, y no el de la pestaña activa: el número que lleva cada pestaña es lo que
   * te dice si merece la pena abrirla. Inventarlo contando la página que hay en pantalla daría
   * «5 partidas» en cualquier cruce de más de cinco.
   */
  readonly summaryAll = computed(() => this.summaryFor('all'));
  readonly summaryAllies = computed(() => this.summaryFor('ally'));
  readonly summaryEnemies = computed(() => this.summaryFor('enemy'));

  private summaryFor(relation: CrossRelation | 'all'): PersonalHistorySummary | null {
    const id = this.playerId();
    if (!id) return null;
    return this.store.personalSummaryFor(
      personalSummaryQuery(this.ui.filters(), { with: id, relation }),
    );
  }

  /**
   * `null` = ese jugador no existe (404). Distinto de existir sin partidas en común.
   *
   * Se resuelve con el asiento del propio cruce, que desde el contrato nuevo trae nombre y
   * avatar haya subida o no. Ya no hace falta el censo del grupo, que además no servía en
   * `/me/matches`: ahí las filas son de grupos distintos y puede que ni sigas siendo miembro.
   */
  readonly player = computed<CrossPlayer | null>(() =>
    resolveCrossPlayer(this.playerId(), this.page()),
  );
}
