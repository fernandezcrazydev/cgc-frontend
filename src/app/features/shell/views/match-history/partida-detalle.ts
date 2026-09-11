import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfAvatar, NfBadge, NfSkeleton } from '../../../../ui';
import { MatchHistoryStore } from '../../../../core/matches/match-history-store';
import { Match, MatchParticipant, TeamSide, TeamSummary } from '../../../../core/matches/models';
import {
  ParticipantContribution,
  contributionOf,
  matchOutcomeLabel,
  teamSideLabel,
} from '../../../../core/matches/match-view';
import { GameDataStore } from '../../../../core/game-data';
import {
  formatCompact,
  formatDuration,
  formatMatchDate,
  formatOrdinal,
} from '../../../../shared/date-format';
import { Viewport } from '../../../../shared/viewport';
import { MatchScoreboardComponent } from './match-scoreboard.component';

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
  templateUrl: './partida-detalle.html',
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
