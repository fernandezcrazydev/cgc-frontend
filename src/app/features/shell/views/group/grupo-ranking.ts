import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs';
import {
  NfAvatar,
  NfButton,
  NfLaneIcon,
  NfModal,
  NfPagination,
  NfRankEmblem,
  NfCombobox,
  NfComboboxOption,
  NfSkeleton,
  NfTypeahead,
} from '../../../../ui';
import { GroupBridge, GroupDetailStore, GroupsStore } from '../../../../core/groups';
import { GroupStore } from '../../../../core/group-store';
import { hash, mapLeaderboardEntries, RankEntry } from '../../../../core/group-ranking';
import { LeaderboardSearchSuggestion, LeaguesStore } from '../../../../core/leagues';
import { ServerClock, errorMessage } from '../../../../core/http';
import { ToastService } from '../../../../core/toast';
import { MatchHistoryStore } from '../../../../core/matches/match-history-store';
import { GameDataStore } from '../../../../core/game-data';
import { Lane, Match, MatchItemSlot, MatchParticipant } from '../../../../core/matches/models';
import { formatDurationMinutes, formatMatchDate } from '../../../../shared/date-format';

/**
 * Columnas por las que se puede ordenar la clasificación.
 *
 * No hay `'lp'`: la clasificación se construye por LP descendente, así que "Pos" y "LP" ordenaban
 * exactamente igual y tener los dos controles dejaba al usuario sin saber cuál mandaba.
 *
 * Tampoco hay `'lane'`. La tenía, y era peor: el rol principal se sorteaba con un generador
 * determinista, así que ordenar por "Rol" ordenaba por ruido. La cabecera sigue ahí, deshabilitada,
 * y vuelve a activarse cuando el dato exista.
 */
type SortKey = 'rank' | 'wr';
type SortDir = 'asc' | 'desc';

export interface DrawerMatchItem {
  id: string;
  isWin: boolean;
  meta: string;
  lane: Lane;
  champId: number;
  champName: string;
  champIcon: string | null;
  spells: number[];
  smiteVariant?: 'blue' | 'red' | 'green' | 'unevolved';
  primaryRuneId?: number;
  secondaryRuneTreeId?: number;
  foeChampId: number;
  foeChampName: string;
  foeChampIcon: string | null;
  foeName: string;
  foeTag: string | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  csPerMin: number;
  items: (MatchItemSlot | null)[];
  lpDelta: number;
}

const SECOND_SPELL_FALLBACK: Record<Lane, number> = {
  TOP: 12,
  JUNGLA: 1102,
  MID: 14,
  ADC: 7,
  SUPPORT: 3,
};

const RUNES_FALLBACK: Record<Lane, { primary: number; secondary: number }> = {
  TOP: { primary: 8437, secondary: 8000 },
  JUNGLA: { primary: 8010, secondary: 8300 },
  MID: { primary: 8112, secondary: 8200 },
  ADC: { primary: 8008, secondary: 8300 },
  SUPPORT: { primary: 8465, secondary: 8400 },
};

/**
 * Duración de una temporada abierta desde aquí.
 *
 * BACKEND NOTE: es una COPIA de `DEFAULT_SEASON_DAYS`, que el backend ya usa para crear la primera
 * liga de un grupo. Dos constantes para el mismo valor por defecto, en dos repos, que nadie va a
 * acordarse de cambiar a la vez. Desaparece con `POST /groups/{groupId}/leagues/next`: la siguiente
 * temporada se pide sin cuerpo y el servidor —que ya conoce la duración y sabe qué número le
 * toca— decide fechas y nombre. Hasta entonces se queda aquí, porque el endpoint de creación
 * exige `endsAt` y alguien tiene que proponerlo.
 */
const SEASON_LENGTH_DAYS = 14;

@Component({
  selector: 'app-grupo-ranking',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeMenu()',
  },
  imports: [
    NgTemplateOutlet,
    FormsModule,
    RouterLink,
    NfButton,
    NfAvatar,
    NfLaneIcon,
    NfRankEmblem,
    NfPagination,
    NfSkeleton,
    NfModal,
    NfCombobox,
    NfTypeahead,
  ],
  // Tres hojas y no una: el podio y el cajon de historial se separaron por el presupuesto
  // `anyComponentStyle` de Angular, y hay que declararlas TODAS o no se cargan.
  styleUrls: [
    './grupo-ranking.scss',
    './grupo-ranking-podio.scss',
    './grupo-ranking-historial.scss',
  ],
  templateUrl: './grupo-ranking.html',
})
export class GrupoRanking {
  private readonly route = inject(ActivatedRoute);
  private readonly groupStore = inject(GroupStore);
  private readonly groupsStore = inject(GroupsStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toasts = inject(ToastService);
  private readonly clock = inject(ServerClock);
  readonly bridge = inject(GroupBridge);
  readonly leagues = inject(LeaguesStore);
  /** Solo para expulsar: es quien tiene la acción y sabe si hay una escritura en vuelo. */
  private readonly groupDetail = inject(GroupDetailStore);
  private readonly matchHistory = inject(MatchHistoryStore);
  private readonly gameData = inject(GameDataStore);

  /** Devuelve las partidas del grupo en las que participó el jugador seleccionado. */
  matchesOf(playerId: string): DrawerMatchItem[] {
    const groupId = this.id();
    if (!groupId) return [];
    const groupMatches = this.matchHistory.matchesByGroup(groupId);
    const entry = this.rows().find((r) => r.playerId === playerId);
    const result: DrawerMatchItem[] = [];

    const isMatchForPlayer = (part: MatchParticipant): boolean => {
      if (part.userId === playerId || part.id === playerId) return true;
      if (!entry) return false;
      if (part.userId === entry.playerId) return true;
      const partRiot = part.riotId.toLowerCase();
      const entryName = entry.name.toLowerCase();
      if (partRiot.startsWith(entryName) || partRiot.includes(entryName)) return true;
      if (entry.tag) {
        const fullTag = `${entryName}#${entry.tag.toLowerCase()}`;
        if (partRiot === fullTag) return true;
      }
      return false;
    };

    const matchesPool = groupMatches.length > 0 ? groupMatches : this.matchHistory.allMatches();

    for (const m of matchesPool) {
      const p = [...m.blueTeam.participants, ...m.redTeam.participants].find(isMatchForPlayer);
      if (!p) continue;

      const opposingTeam = p.team === 'blue' ? m.redTeam : m.blueTeam;
      const foe =
        opposingTeam.participants.find((opp) => opp.role === p.role) ??
        opposingTeam.participants[0];
      const isWin = p.team === m.winningTeam;

      const spells = p.role === 'JUNGLA'
        ? (p.stats.smiteVariant === 'blue' ? [p.stats.spells?.[0] ?? 4, 1102]
          : p.stats.smiteVariant === 'red' ? [p.stats.spells?.[0] ?? 4, 1101]
          : p.stats.smiteVariant === 'green' ? [p.stats.spells?.[0] ?? 4, 1103]
          : p.stats.smiteVariant === 'unevolved' ? [p.stats.spells?.[0] ?? 4, 11]
          : (p.stats.spells && [11, 1101, 1102, 1103].includes(p.stats.spells[1]) ? p.stats.spells : [p.stats?.spells?.[0] ?? 4, 1102]))
        : (p.stats.spells && p.stats.spells.length >= 2 ? p.stats.spells : [4, SECOND_SPELL_FALLBACK[p.role] ?? 14]);

      result.push({
        id: m.id,
        isWin,
        meta: `${formatMatchDate(m.decidedAt)} · ${formatDurationMinutes(m.durationSeconds)}`,
        lane: p.role,
        champId: p.championId,
        champName: this.gameData.championById().get(p.championId)?.name ?? p.championName,
        champIcon: this.gameData.championById().get(p.championId)?.iconUrl ?? null,
        spells,
        smiteVariant: p.stats.smiteVariant,
        primaryRuneId: p.stats.primaryRuneId ?? RUNES_FALLBACK[p.role]?.primary ?? 8010,
        secondaryRuneTreeId: p.stats.secondaryRuneTreeId ?? RUNES_FALLBACK[p.role]?.secondary ?? 8300,
        foeChampId: foe?.championId ?? 0,
        foeChampName: foe
          ? (this.gameData.championById().get(foe.championId)?.name ?? foe.championName)
          : 'Rival',
        foeChampIcon: foe
          ? (this.gameData.championById().get(foe.championId)?.iconUrl ?? null)
          : null,
        foeName: foe ? (foe.riotId.includes('#') ? foe.riotId.split('#')[0] : foe.riotId) : 'Rival',
        foeTag: foe ? (foe.riotId.includes('#') ? foe.riotId.split('#')[1] : null) : null,
        kills: p.stats.kills,
        deaths: p.stats.deaths,
        assists: p.stats.assists,
        cs: p.stats.cs,
        csPerMin: p.stats.csPerMin,
        items: p.stats.items ?? [],
        lpDelta: p.lpDelta !== 0 ? p.lpDelta : isWin ? 26 : -20,
      });
    }

    if (result.length === 0 && entry) {
      // Respaldo determinista con objetos reales si la liga no tuviera partidas precargadas
      const lanes: Lane[] = ['MID', 'TOP', 'JUNGLA', 'ADC', 'SUPPORT'];
      const playerLane = lanes[hash(`${playerId}:lane`) % lanes.length];
      const champIds = [103, 64, 157, 222, 412, 86, 238, 99, 22, 11];
      const fallbackItems: (MatchItemSlot | null)[] = [
        { id: 3078, name: 'Fuerza de la Trinidad', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3078.png' },
        { id: 3053, name: 'Guantelete de Sterak', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3053.png' },
        { id: 3071, name: 'Cuchilla Negra', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3071.png' },
        { id: 3047, name: 'Punteras de Acero', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3047.png' },
        { id: 6333, name: 'Danza de la Muerte', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/6333.png' },
        { id: 3026, name: 'Ángel de la Guarda', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3026.png' },
        ...(playerLane === 'ADC' ? [{ id: 3031, name: 'Filo Infinito', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3031.png' }] : []),
        { id: 3340, name: 'Guardián Invisible', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3340.png' },
      ];

      for (let i = 0; i < 5; i++) {
        const isWin = (hash(`${playerId}:${i}:win`) % 100) < 55;
        const champId = champIds[(hash(`${playerId}:${i}:c`) + i) % champIds.length];
        const foeChampId = champIds[(hash(`${playerId}:${i}:fc`) + i + 3) % champIds.length];
        const k = 3 + (hash(`${playerId}:${i}:k`) % 11);
        const d = 1 + (hash(`${playerId}:${i}:d`) % 7);
        const a = 2 + (hash(`${playerId}:${i}:a`) % 14);
        const cs = 140 + (hash(`${playerId}:${i}:cs`) % 130);

        result.push({
          id: `fallback-${playerId}-${i}`,
          isWin,
          meta: `Hace ${i + 1} d · ${28 + (i * 3)} min`,
          lane: playerLane,
          champId,
          champName: this.gameData.championById().get(champId)?.name ?? `Campeón ${champId}`,
          champIcon: this.gameData.championById().get(champId)?.iconUrl ?? null,
          spells: [4, SECOND_SPELL_FALLBACK[playerLane]],
          primaryRuneId: RUNES_FALLBACK[playerLane].primary,
          secondaryRuneTreeId: RUNES_FALLBACK[playerLane].secondary,
          foeChampId,
          foeChampName: this.gameData.championById().get(foeChampId)?.name ?? `Campeón ${foeChampId}`,
          foeChampIcon: this.gameData.championById().get(foeChampId)?.iconUrl ?? null,
          foeName: 'Rival',
          foeTag: 'EUW',
          kills: k,
          deaths: d,
          assists: a,
          cs,
          csPerMin: +(cs / 32).toFixed(1),
          items: fallbackItems,
          lpDelta: isWin ? 24 : -19,
        });
      }
    }

    return result.slice(0, 5);
  }

  protected spellIcon(id: number): string | null {
    if (id === 1102) {
      return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/1102_smite.png';
    }
    if (id === 1101) {
      return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/1101_smite.png';
    }
    if (id === 1103) {
      return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/1103_smite.png';
    }
    if (id === 11) {
      return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/summoner_smite.png';
    }

    const fromStore = typeof this.gameData.summonerSpellById === 'function'
      ? this.gameData.summonerSpellById().get(id)?.iconUrl
      : null;
    if (fromStore) return fromStore;

    const names: Record<number, string> = {
      4: 'SummonerFlash',
      12: 'SummonerTeleport',
      11: 'SummonerSmite',
      14: 'SummonerDot',
      7: 'SummonerHeal',
      21: 'SummonerBarrier',
      3: 'SummonerExhaust',
      6: 'SummonerHaste',
    };
    const key = names[id] ?? 'SummonerFlash';
    return `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/spell/${key}.png`;
  }

  protected spellName(id: number): string {
    if (id === 1102) return 'Smite Desatado (Azul - Caminavientos)';
    if (id === 1101) return 'Smite de Furia (Rojo - Garramélica)';
    if (id === 1103) return 'Smite de Vitalidad (Verde - Brincamusgo)';
    if (id === 11) return 'Smite (Sin evolucionar)';

    const fromStore = typeof this.gameData.summonerSpellById === 'function'
      ? this.gameData.summonerSpellById().get(id)?.name
      : null;
    if (fromStore) return fromStore;

    const names: Record<number, string> = {
      4: 'Destello',
      12: 'Teleportar',
      11: 'Smite',
      14: 'Ignición',
      7: 'Curar',
      21: 'Barrera',
      3: 'Extenuación',
      6: 'Fantasmal',
    };
    return names[id] ?? `Hechizo ${id}`;
  }

  protected runeIcon(id: number | undefined): string | null {
    if (!id) return null;
    const fromStore = typeof this.gameData.perkById === 'function'
      ? this.gameData.perkById().get(id)?.iconUrl
      : null;
    if (fromStore) return fromStore;
    const icons: Record<number, string> = {
      8010: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Conqueror/Conqueror.png',
      8008: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png',
      8021: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png',
      8005: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png',
      8112: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/Electrocute/Electrocute.png',
      8128: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/DarkHarvest/DarkHarvest.png',
      8214: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/SummonAery/SummonAery.png',
      8229: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png',
      8437: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png',
      8465: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Guardian/Guardian.png',
      8351: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/GlacialAugment/GlacialAugment.png',
      8000: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7201_Precision.png',
      8100: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7200_Domination.png',
      8200: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7202_Sorcery.png',
      8300: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7203_Whimsy.png',
      8400: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7204_Resolve.png',
    };
    return icons[id] ?? null;
  }

  protected runeName(id: number | undefined): string {
    if (!id) return 'Runa';
    const fromStore = typeof this.gameData.perkById === 'function'
      ? this.gameData.perkById().get(id)?.name
      : null;
    if (fromStore) return fromStore;
    const names: Record<number, string> = {
      8010: 'Conquistador',
      8008: 'Compás Letal',
      8021: 'Pies Veloces',
      8005: 'Ataque Intensificado',
      8112: 'Electrocutar',
      8128: 'Cosecha Oscura',
      8214: 'Invocar a Aery',
      8229: 'Cometa Arcano',
      8437: 'Garras del Inmortal',
      8465: 'Protector',
      8351: 'Mejora Glacial',
      8000: 'Precisión',
      8100: 'Dominación',
      8200: 'Brujería',
      8300: 'Inspiración',
      8400: 'Valor',
    };
    return names[id] ?? `Runa ${id}`;
  }

  /** Texto único para todo lo que aún no tiene fuente de datos. */
  protected readonly NO_DATA_HINT = 'Aún no hay datos: aparecerá cuando se registren partidas';
  protected readonly NO_RIOT_HINT = "Este jugador no ha vinculado su cuenta de Riot";
  protected readonly NO_TREND_HINT = "Aún no ha jugado partidas de las que sacar una tendencia";
  protected readonly NO_AVG_HINT = "Aún no ha jugado partidas de las que sacar una media";

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  /**
   * Se pinta el esqueleto mientras viaja el grupo O la clasificación.
   *
   * Antes solo miraba al grupo, así que la tabla se daba por cargada mientras el leaderboard seguía
   * en vuelo — y en ese hueco la vista caía al generador y enseñaba jugadores inventados.
   */
  readonly isLoading = computed(() => {
    const groupStatus = this.bridge.status();
    if (groupStatus === 'loading' || groupStatus === 'idle') return true;
    const leagueStatus = this.leagues.status();
    return leagueStatus === 'loading' || leagueStatus === 'idle';
  });

  readonly group = computed(() => {
    const id = this.id();
    if (!id) return null;
    return this.groupStore.byId(id) ?? this.groupsStore.byId(id) ?? null;
  });

  readonly leagueName = computed(() => this.leagues.league()?.name ?? 'Liga oficial');

  readonly rows = computed<RankEntry[]>(() => {
    const list = mapLeaderboardEntries(this.leagues.rows());
    const key = this.sortKey();
    const dir = this.sortDir();
    return [...list].sort((a, b) => {
      let diff = 0;
      if (key === 'rank') {
        diff = a.rank - b.rank;
      } else if (key === 'wr') {
        diff = a.wr - b.wr;
      }
      return dir === 'desc' ? -diff : diff;
    });
  });
  readonly podium = computed<RankEntry[]>(() => mapLeaderboardEntries(this.leagues.podium()));

  // ---- Cuenta atrás ----------------------------------------------------

  readonly now = signal(Date.now());

  /**
   * La cuenta atrás solo existe si el servidor ha dicho cuándo acaba la liga.
   *
   * La versión anterior, sin respuesta, fabricaba una fecha con `Date.now() + hash(groupId)`: un
   * cronómetro corriendo hacia una fecha inexistente, además distinta en cada recarga.
   *
   * El tiempo que queda se cuenta contra el reloj del SERVIDOR (`ServerClock.offsetMs()`), no
   * contra el del equipo. Y si la temporada ha terminado ya no lo decide esta resta: lo dice el
   * `status` de la liga, que el backend deriva de su propio reloj. Con el reloj local mandando, un
   * equipo adelantado media hora veía "Finalizada" —solo él— mientras el resto seguía jugando.
   */
  readonly countdown = computed(() => {
    const league = this.leagues.league();
    if (!league?.endsAt) return null;

    const diff = Math.max(0, new Date(league.endsAt).getTime() - (this.now() + this.clock.offsetMs()));
    const days = Math.floor(diff / 86_400_000);

    // Que la temporada haya terminado lo dice el SERVIDOR: `status` ya viene derivado de su reloj,
    // así que compararlo aquí otra vez sería tener dos verdades para el mismo hecho, y la del
    // cliente pierde siempre. El umbral de "Fase final" sí sigue siendo nuestro: es una regla de
    // presentación (cuándo avisar de que queda poco), no un estado del dominio.
    const isExpired = league.status === 'FINISHED';

    let statusLabel = 'En curso';
    let statusVariant: 'success' | 'warning' | 'danger' = 'success';
    if (isExpired) {
      statusLabel = 'Finalizada';
      statusVariant = 'danger';
    } else if (days < 3) {
      statusLabel = 'Fase final';
      statusVariant = 'warning';
    }

    return {
      days,
      hours: Math.floor((diff / 3_600_000) % 24),
      minutes: Math.floor((diff / 60_000) % 60),
      seconds: Math.floor((diff / 1000) % 60),
      isExpired,
      /**
       * El reloj ha llegado a cero. NO es "la temporada ha terminado" —eso es `isExpired`, y lo
       * dice el servidor—: es solo que no queda nada que contar, y sirve para parar el cronómetro
       * en vez de tenerlo repintando ceros hasta el próximo refetch.
       */
      hasRunOut: diff === 0,
      statusLabel,
      statusVariant,
    };
  });

  pad(n: number): string {
    return n.toString().padStart(2, '0');
  }

  /**
   * Texto de la sanción: motivo y, si la tiene, hasta cuándo.
   *
   * Sin fecha se dice "indefinida" en vez de callarse: quien la lee tiene que poder distinguir
   * "termina el martes" de "hasta que alguien la levante".
   */
  banTitle(e: RankEntry): string {
    const reason = e.banReason ?? 'Fuera de competición';
    if (!e.bannedUntil) return `${reason} · sanción indefinida`;
    const until = new Date(e.bannedUntil).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${reason} · hasta el ${until}`;
  }


  // ── Selector de temporada ─────────────────────────────────────────────
  /**
   * Las temporadas del grupo, con la activa primero y sin valor para ella.
   *
   * La activa lleva `value: ''` a propósito: el contrato del backend trata `leagueId` como
   * opcional y sin él sirve la activa, así que la cadena vacía es exactamente «la de siempre» y
   * no un id que haya que mantener sincronizado.
   */
  readonly seasonOptions = computed<NfComboboxOption[]>(() =>
    // El orden lo da el SERVIDOR (`created_at DESC`: la más reciente primero) y aquí no se toca.
    // Este `computed` reordenaba a mano «la activa primero, luego las cerradas por fecha», y lo
    // hacía a partir de una premisa falsa —que el backend las servía en orden ascendente—: la
    // lista ya llegaba bien. Como solo puede haber una liga viva por grupo, la más reciente ES la
    // activa, así que la primera opción del desplegable es la que la tabla está enseñando.
    this.leagues.seasons().map((season) => ({
      value: season.status === 'FINISHED' ? season.id : '',
      label: season.status === 'FINISHED' ? `${season.name} (cerrada)` : `${season.name} (en curso)`,
    })),
  );

  onSeasonChange(value: string): void {
    void this.leagues.selectSeason(value || null);
  }

  // ── Gestión de jugadores (sanciones y expulsión) ──────────────────────
  // Todo cuelga de un menú de tres puntos por fila, visible solo para quien gestiona.

  /** Fila cuyo menú está abierto, o `null`. Estado de UI. */
  readonly menuFor = signal<string | null>(null);

  /**
   * ¿Puede este usuario gestionar jugadores EN LA TABLA QUE SE ESTÁ VIENDO?
   *
   * Dos condiciones, y la segunda es fácil de olvidar. Quién gestiona lo dice el servidor en la
   * propia clasificación (`canManageLeague`). Y la temporada tiene que estar viva: una cerrada se
   * sirve en solo lectura —es un resultado congelado— y el backend rechaza cualquier escritura
   * sobre ella con 409 `LEAGUE_CLOSED`. Peor aún al mirar una temporada pasada por el selector:
   * la sanción no viaja con `leagueId`, así que actúa sobre la liga ACTIVA, no sobre la que se
   * está mirando. Se sancionaría a alguien en otra temporada distinta de la que se tiene delante.
   *
   * BACKEND NOTE: esto deduce de `status === 'FINISHED'` lo que el contrato acabará diciendo con
   * un `readOnly` en `LeagueResponse`. Cuando llegue, se lee de ahí.
   */
  readonly canManageMembers = computed(
    () => this.leagues.canManageLeague() && !this.leagues.isSeasonClosed(),
  );

  readonly menuDropup = signal(false);

  toggleMenu(playerId: string, event: Event): void {
    event.stopPropagation();
    const btn = event.currentTarget as HTMLElement | null;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      this.menuDropup.set(spaceBelow < 160);
    }
    this.menuFor.update((open) => (open === playerId ? null : playerId));
  }

  closeMenu(): void {
    this.menuFor.set(null);
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.menuFor()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.rk-actions')) return;
    this.closeMenu();
  }

  /** Jerarquía del grupo. Solo se usa para comparar: quien tiene más número manda más. */
  private static readonly ROLE_RANK: Record<string, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };

  /**
   * ¿Puede quien mira actuar sobre esta fila? Hay que superarle ESTRICTAMENTE en rango.
   *
   * Una sola función para las tres acciones del menú —sancionar, levantar la sanción y expulsar—
   * porque el servidor aplica la misma regla a las tres: `MembershipPolicy.checkCanRemove` para la
   * expulsión y `outranks` para las sanciones son la misma comparación. Tenerlas separadas es lo
   * que dejaba «Sancionar» sin comprobar nada: se podía pulsar sobre el OWNER y comerse un 409
   * `CANNOT_SANCTION_PLAYER` que la interfaz había ofrecido ella misma.
   *
   * «Estrictamente» cubre gratis dos casos que antes iban a mano: nadie se supera a sí mismo (mismo
   * rol) y nadie supera al OWNER (no hay rango por encima).
   *
   * Es SOLO UX. El backend revalida las tres acciones y responde 409 (`CANNOT_SANCTION_PLAYER`,
   * `CANNOT_REMOVE_GROUP_MEMBER`); esto solo evita ofrecer un botón que ya se sabe que va a fallar.
   *
   * BACKEND NOTE: esto reimplementa en cliente el `outranks` del servidor, que es quien manda. Se
   * borra —junto con `groupRole` de la fila— en cuanto `LeaderboardEntryResponse` traiga
   * `canRemove` / `canSanction` ya resueltos por el backend.
   */
  canActOn(e: RankEntry): boolean {
    const groupId = this.id();
    if (!groupId) return false;

    // El rango del otro viene en su propia fila (`groupRole`); el propio, de `GroupsStore`, que es
    // la pertenencia de quien mira. Antes el del otro había que cruzarlo con el roster de
    // `GroupBridge`: dos fuentes para un dato que se sirve junto a los demás.
    const mine = GrupoRanking.ROLE_RANK[this.groupsStore.byId(groupId)?.role ?? ''] ?? 0;
    const theirs = GrupoRanking.ROLE_RANK[e.groupRole ?? ''] ?? 0;
    // Sin rango conocido del otro no se puede afirmar que se le supera, así que no se ofrece:
    // el control se esconde y, si acaso, el servidor sigue siendo quien decide.
    if (!theirs) return false;
    return mine > theirs;
  }

  // ── Sancionar ─────────────────────────────────────────────────────────
  readonly sanctionFor = signal<RankEntry | null>(null);
  readonly sanctionReason = signal('');
  /** `''` = indefinida. El backend acepta `until` nulo. */
  readonly sanctionUntil = signal('');

  openSanction(e: RankEntry): void {
    this.closeMenu();
    this.sanctionReason.set('');
    this.sanctionUntil.set('');
    this.sanctionFor.set(e);
  }

  closeSanction(): void {
    this.sanctionFor.set(null);
  }

  async confirmSanction(): Promise<void> {
    const target = this.sanctionFor();
    const groupId = this.id();
    const reason = this.sanctionReason().trim();
    if (!target || !groupId || !reason) return;
    try {
      await this.leagues.sanction(groupId, target.playerId, {
        reason,
        // `datetime-local` da hora local sin zona; se manda en ISO con la del navegador.
        until: this.sanctionUntil() ? new Date(this.sanctionUntil()).toISOString() : null,
      });
      this.closeSanction();
      this.toasts.success(`${target.name} queda fuera de la competición`);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  async liftSanction(e: RankEntry): Promise<void> {
    this.closeMenu();
    const groupId = this.id();
    if (!groupId) return;
    try {
      await this.leagues.liftSanction(groupId, e.playerId);
      this.toasts.success(`${e.name} vuelve a la competición`);
    } catch (err) {
      this.toasts.error(errorMessage(err));
    }
  }

  // ── Expulsar ──────────────────────────────────────────────────────────
  readonly kickFor = signal<RankEntry | null>(null);

  askKick(e: RankEntry): void {
    this.closeMenu();
    this.kickFor.set(e);
  }

  async confirmKick(): Promise<void> {
    const target = this.kickFor();
    const groupId = this.id();
    if (!target || !groupId) return;
    try {
      // El store de detalle es quien tiene la acción; `load` es idempotente por grupo.
      await this.groupDetail.load(groupId);
      await this.groupDetail.removeMember(target.playerId);
      this.kickFor.set(null);
      this.toasts.success(`${target.name} fue expulsado del grupo`);
      // Sale de la clasificación: el dato derivado se refetch, no se recorta en cliente.
      await this.leagues.reload();
      void this.bridge.reload(groupId);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  // ---- Buscador --------------------------------------------------------

  readonly searchQuery = signal('');
  readonly searchOpen = signal(false);
  readonly activeIndex = signal(-1);
  readonly highlightedPlayerId = signal<string | null>(null);

  private readonly typed = new Subject<string>();

  /**
   * Sugerencias del SERVIDOR, no de lo ya descargado.
   *
   * Filtrar en cliente solo encontraría a quien estuviese en la página cargada, que con la tabla
   * paginada es una de cada quince personas. El servidor además resuelve en qué página cae cada
   * jugador para el orden que se esté mostrando.
   */
  readonly suggestions = toSignal(
    this.typed.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((q) => {
        const groupId = this.id();
        if (!groupId || !q.trim()) return Promise.resolve<LeaderboardSearchSuggestion[]>([]);
        return this.leagues.search(groupId, q);
      }),
      takeUntilDestroyed(),
    ),
    { initialValue: [] as LeaderboardSearchSuggestion[] },
  );

  readonly activeSuggestionId = computed(() => {
    const i = this.activeIndex();
    const list = this.suggestions();
    return i >= 0 && i < list.length ? `rk-sugg-${list[i].userId}` : null;
  });

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.typed.next(value);
  }

  /**
   * Salta a la página donde está el jugador, lo resalta y lo trae a la vista.
   *
   * La página la da el SERVIDOR (`s.page`, 0-based) y no se recalcula aquí: con la tabla paginada,
   * el cliente no tiene la lista completa con la que hacer ese cálculo.
   */
  async selectPlayer(s: LeaderboardSearchSuggestion): Promise<void> {
    this.searchQuery.set('');
    this.typed.next('');
    this.openId.set(null);

    await this.leagues.goToPage(s.page);
    // Después de la página: el scroll lo dispara `afterRenderEffect` cuando la fila ya existe.
    this.highlightedPlayerId.set(s.userId);
  }

  /** Filas pintadas, para poder llevar el foco visual a una sin consultar el `document`. */
  private readonly rowRefs = viewChildren<ElementRef<HTMLElement>>('rowRef');

  /** Evita repetir el scroll en cada repintado mientras el resaltado siga puesto. */
  private scrolledTo: string | null = null;

  // ---- Ordenación ------------------------------------------------------

  readonly sortKey = signal<SortKey>('rank');
  readonly sortDir = signal<SortDir>('asc');

  /**
   * Ordena en memoria sin reiniciar el scroll ni enviar al usuario al inicio de la página.
   */
  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      // Pos se lee mejor ascendente; el winrate, de mayor a menor.
      this.sortDir.set(key === 'wr' ? 'desc' : 'asc');
    }
  }

  arrow(key: SortKey): string {
    if (this.sortKey() !== key) return '↕';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }

  ariaSort(key: SortKey): string {
    if (this.sortKey() !== key) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  // ---- Paginación y acordeón ------------------------------------------

  /** `<nf-pagination>` es 1-based; el contrato de la API es 0-based. */
  goToPage(oneBased: number): void {
    this.openId.set(null);
    // Paginar a mano es abandonar la búsqueda: si el resaltado siguiera puesto, volvería a
    // encenderse en cuanto el jugador reapareciese en otra página.
    this.highlightedPlayerId.set(null);
    void this.leagues.goToPage(oneBased - 1);
  }

  readonly openId = linkedSignal<string | null, string | null>({
    source: this.id,
    computation: () => null,
  });

  toggle(playerId: string): void {
    this.openId.update((v) => (v === playerId ? null : playerId));
  }

  close(summary: HTMLElement): void {
    this.openId.set(null);
    summary.focus();
  }

  retry(): void {
    void this.leagues.reload();
  }

  /**
   * Abre la siguiente temporada del grupo con la duración por defecto.
   *
   * El número sale de CUÁNTAS temporadas tiene ya el grupo, no de leer una cifra al final del
   * nombre de la anterior. Ese `name.match(/(\d+)\s*$/)` no tenía nada que leer en la primera liga
   * —se llama «<grupo> · Liga oficial», sin número—, caía al `?? '1'` y bautizaba «Temporada 2» a
   * la segunda liga de todos los grupos, con una «Temporada 1» que no existía en ninguno. Y a la
   * mínima que alguien renombrase su liga con un año o un número al final, el conteo saltaba a él.
   *
   * `Math.max(..., 1)` es la red por si la lista de temporadas no llegó: se carga aparte y falla
   * en silencio a lista vacía, pero si se está abriendo la siguiente es que hay al menos una.
   *
   * BACKEND NOTE: número, fechas y nombre son cosa del servidor. Este método entero se reduce a
   * llamar a `POST /groups/{groupId}/leagues/next` sin cuerpo en cuanto ese endpoint exista.
   */
  async startNextSeason(groupName: string): Promise<void> {
    const groupId = this.id();
    if (!groupId) return;

    const endsAt = new Date(Date.now() + SEASON_LENGTH_DAYS * 86_400_000).toISOString();
    const next = Math.max(this.leagues.seasons().length, 1) + 1;

    try {
      await this.leagues.startNextSeason(groupId, `${groupName} · Temporada ${next}`, endsAt);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  constructor() {
    this.groupsStore.ensureLoaded();

    effect(() => {
      const id = this.id();
      if (!id) return;

      // `untracked` no es decorativo. Los métodos del store LEEN sus propias signals, así que
      // llamarlos dentro del efecto lo suscribe a lo que él mismo escribe: el efecto se reejecuta
      // en bucle hasta agotar la memoria del proceso. La única dependencia aquí debe ser `id`.
      untracked(() => {
        void this.bridge.ensure(id);
        void this.leagues.loadSeasons(id);
        // Al cambiar de grupo se empieza de cero: la clasificación del anterior no vale ni como
        // estado intermedio. El store descarta además la respuesta que llegue tarde.
        this.leagues.clear();
        void this.leagues.ensureLoaded(id);
      });
    });

    // Trae a la vista la fila que se acaba de buscar. `afterRenderEffect` y no un `setTimeout`:
    // corre DESPUÉS de que Angular haya pintado, así que la fila existe seguro. La versión anterior
    // apostaba 60 ms a que el render ya habría ocurrido y buscaba el nodo con `getElementById`.
    afterRenderEffect(() => {
      const target = this.highlightedPlayerId();
      if (!target) {
        this.scrolledTo = null;
        return;
      }
      if (this.scrolledTo === target) return;

      const row = this.rowRefs().find((r) => r.nativeElement.dataset['player'] === target);
      if (!row) return;

      this.scrolledTo = target;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      row.nativeElement.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    });

    // El cronómetro solo corre cuando hay algo que contar: `now` alimenta `countdown()`, que está en
    // la plantilla, así que cada tic repinta la vista entera. Se para al expirar la liga —antes
    // seguía tictaqueando contra un texto fijo para siempre— y con la pestaña oculta, poniendo la
    // hora al día al volver para que no se vea el reloj congelado del momento en que te fuiste.
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const tick = () => {
      this.now.set(Date.now());
      // Se para cuando no queda tiempo que contar, no cuando el servidor da la liga por cerrada:
      // entre lo uno y lo otro hay el hueco de un refetch, y durante él el cronómetro estaría
      // repintando la vista entera cada segundo para enseñar los mismos ceros.
      if (this.countdown()?.hasRunOut) stop();
    };

    const start = () => {
      if (timer === null && !document.hidden) timer = setInterval(tick, 1000);
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        tick();
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);

    this.destroyRef.onDestroy(() => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      this.leagues.clear();
    });
  }
}
