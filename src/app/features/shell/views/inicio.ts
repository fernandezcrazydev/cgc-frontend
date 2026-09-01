import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { NfBadge, NfButton, NfSkeleton } from '../../../ui';
import { Session } from '../../../core/auth';
import { GroupsStore, GroupView, InvitationsStore } from '../../../core/groups';
import { MatchRoom, MatchStore } from '../../../core/match-store';
import {
  Match,
  MatchHistoryStore,
  MatchParticipant,
  nemesisOf,
} from '../../../core/matches';
import { LeaguesStore } from '../../../core/leagues';
import { NotificationsStore, NotificationView, notificationView } from '../../../core/notifications';
import { ToastService } from '../../../core/toast';

interface RivalRow {
  rank: number;
  name: string;
  lp: number;
  isMe: boolean;
}

interface RivalSummary {
  rows: RivalRow[];
  calloutText: string;
  isLeader: boolean;
  hasData: boolean;
}

interface SlotView {
  filled: boolean;
  initials: string;
}

interface MvpHighlight {
  name: string;
  initials: string;
  champion: string;
  kda: string;
  quote: string;
}

interface NemesisHighlight {
  name: string;
  initials: string;
  record: string;
  callout: string;
  riotId: string;
}

interface GroupHighlightItem {
  label: string;
  value: string;
}

function matchParticipants(m: Match): MatchParticipant[] {
  return [...m.blueTeam.participants, ...m.redTeam.participants];
}

function cleanRiotName(riotId: string | null | undefined, fallback: string): string {
  if (!riotId) return fallback;
  return riotId.split('#')[0] || riotId;
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [NfButton, NfBadge, NfSkeleton],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inicio {
  private readonly groupsStore = inject(GroupsStore);
  private readonly leaguesStore = inject(LeaguesStore);
  private readonly matchStore = inject(MatchStore);
  private readonly matchHistoryStore = inject(MatchHistoryStore);
  private readonly notifs = inject(NotificationsStore);
  private readonly invitations = inject(InvitationsStore);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  /** El usuario autenticado (identidad real). */
  readonly session = inject(Session);

  /** Índice del grupo seleccionado en el carrusel. */
  readonly groupIndex = signal<number>(0);

  /** Estado de la animación Slide & Fade Cinemático ('idle' | 'sliding-left' | 'sliding-right'). */
  readonly slideState = signal<'idle' | 'sliding-left' | 'sliding-right'>('idle');

  /** Lista de todos los grupos del usuario. */
  readonly groupsList = computed<GroupView[]>(() => this.groupsStore.groups());

  /** Indica si el usuario pertenece a más de 1 grupo (para mostrar flechas/paginación). */
  readonly hasMultipleGroups = computed<boolean>(() => this.groupsList().length > 1);

  /** Grupo protagonista activo en pantalla. */
  readonly activeGroup = computed<GroupView | null>(() => {
    const list = this.groupsList();
    if (!list.length) return null;
    const idx = this.groupIndex() % list.length;
    return list[idx < 0 ? idx + list.length : idx] ?? list[0] ?? null;
  });

  /** Carga la clasificación del grupo activo sin crear bucle de dependencias. */
  constructor() {
    effect(() => {
      const g = this.activeGroup();
      if (g) {
        untracked(() => {
          this.leaguesStore.ensureLoaded(g.id);
        });
      }
    });
  }

  /** Atajos de teclado para cambiar de grupo en escritorio. */
  @HostListener('window:keydown', ['$event'])
  handleKeyboardNav(event: KeyboardEvent): void {
    if (!this.hasMultipleGroups()) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      return;
    }
    if (event.key === 'ArrowLeft') {
      this.prevGroup();
    } else if (event.key === 'ArrowRight') {
      this.nextGroup();
    }
  }

  prevGroup(): void {
    if (!this.hasMultipleGroups() || this.slideState() !== 'idle') return;
    const total = this.groupsList().length;
    this.groupIndex.update((i) => (i - 1 + total) % total);
    this.slideState.set('sliding-right');
    setTimeout(() => this.slideState.set('idle'), 260);
  }

  nextGroup(): void {
    if (!this.hasMultipleGroups() || this.slideState() !== 'idle') return;
    const total = this.groupsList().length;
    this.groupIndex.update((i) => (i + 1) % total);
    this.slideState.set('sliding-left');
    setTimeout(() => this.slideState.set('idle'), 260);
  }

  /** Estado de carga de la clasificación del grupo. */
  readonly leaguesLoading = computed<boolean>(() => this.leaguesStore.isLoading());

  /** Resumen de Tu Rival Directo calculado desde LeaguesStore. */
  readonly rivalSummary = computed<RivalSummary>(() => {
    const podium = this.leaguesStore.podium();
    const rows = this.leaguesStore.rows();
    const all = rows.length ? rows : podium;

    if (!all.length) {
      return {
        rows: [],
        calloutText: 'Compite en una custom para inaugurar la clasificación de esta temporada.',
        isLeader: false,
        hasData: false,
      };
    }

    const myUserId = this.session.user()?.userId;
    const myName = this.session.displayName()?.toLowerCase() ?? '';

    const meIndex = all.findIndex(
      (e) => (myUserId && e.userId === myUserId) || (e.riotId && e.riotId.toLowerCase().startsWith(myName)),
    );

    if (meIndex === -1) {
      // El usuario aún no tiene partidas en esta liga: mostrar TOP 3
      const top3: RivalRow[] = all.slice(0, 3).map((e) => ({
        rank: e.rank,
        name: cleanRiotName(e.riotId, `Jugador ${e.rank}`),
        lp: e.lp,
        isMe: false,
      }));
      return {
        rows: top3,
        calloutText: 'Juega 1 partida en este grupo para entrar en el podio.',
        isLeader: false,
        hasData: true,
      };
    }

    const me = all[meIndex];
    const above = meIndex > 0 ? all[meIndex - 1] : null;
    const below = meIndex < all.length - 1 ? all[meIndex + 1] : null;

    const visibleRows: RivalRow[] = [];
    if (above) {
      visibleRows.push({
        rank: above.rank,
        name: cleanRiotName(above.riotId, `Jugador ${above.rank}`),
        lp: above.lp,
        isMe: false,
      });
    }

    visibleRows.push({
      rank: me.rank,
      name: `${cleanRiotName(me.riotId, this.session.displayName() || 'Tú')} (Tú)`,
      lp: me.lp,
      isMe: true,
    });

    if (below) {
      visibleRows.push({
        rank: below.rank,
        name: cleanRiotName(below.riotId, `Jugador ${below.rank}`),
        lp: below.lp,
        isMe: false,
      });
    }

    if (!above) {
      const leadGap = below ? me.lp - below.lp : 0;
      return {
        rows: visibleRows,
        calloutText: leadGap > 0
          ? `👑 ¡Lideras el ranking con +${leadGap} LP de ventaja sobre el 2.º puesto!`
          : '👑 ¡Lideras la clasificación de este grupo!',
        isLeader: true,
        hasData: true,
      };
    }

    const diff = above.lp - me.lp;
    const winsNeeded = Math.max(1, Math.ceil(diff / 22));
    return {
      rows: visibleRows,
      calloutText: `A solo +${diff} LP del ${above.rank}.º puesto (${winsNeeded} ${winsNeeded === 1 ? 'victoria te separa' : 'victorias te separan'}).`,
      isLeader: false,
      hasData: true,
    };
  });

  /** Primera sala activa del grupo protagonista. */
  readonly activeRoom = computed<MatchRoom | null>(() => {
    const g = this.activeGroup();
    if (!g) return null;
    const rooms = this.matchStore.activeOf(g.id);
    return rooms[0] ?? null;
  });

  /** Slots visuales para la convocatoria activa (hasta 10 plazas). */
  readonly lobbySlots = computed<SlotView[]>(() => {
    const room = this.activeRoom();
    const capacity = room ? room.capacity : 10;
    const seats = room ? room.seats : [];
    const slots: SlotView[] = [];

    for (let i = 0; i < capacity; i++) {
      if (i < seats.length) {
        const name = seats[i]?.name ?? 'P';
        slots.push({ filled: true, initials: name.substring(0, 2).toUpperCase() });
      } else {
        slots.push({ filled: false, initials: '' });
      }
    }
    return slots;
  });

  /** Plazas restantes para completar la sala de 10. */
  readonly missingSeats = computed<number>(() => {
    const room = this.activeRoom();
    if (!room) return 0;
    return Math.max(0, room.capacity - room.seats.length);
  });

  /** MVP de la última custom del grupo o global. */
  readonly lastMvp = computed<MvpHighlight | null>(() => {
    const g = this.activeGroup();
    const groupMatches = g ? this.matchHistoryStore.matchesByGroup(g.id) : [];
    const allMatches = groupMatches.length ? groupMatches : this.matchHistoryStore.allPersonalMatches();
    if (!allMatches.length) return null;

    const m = allMatches[0];
    const participants = matchParticipants(m);
    const mvp = participants.find((p) => p.id === m.mvpParticipantId) ?? participants[0];
    if (!mvp) return null;

    const rawName = cleanRiotName(mvp.riotId, 'MVP');
    const kills = mvp.stats.kills;
    const deaths = mvp.stats.deaths;
    const assists = mvp.stats.assists;

    const quotes = [
      'Remontada heroica en el minuto 28 con robo de dragón anciano.',
      'Control total del mapa y dominio indiscutible en fase de líneas.',
      'Impacto decisivo en peleas grupales asegurando la victoria.',
      'Actuación impecable liderando el daño total de la partida.',
    ];
    const quote = quotes[Math.abs(m.id.charCodeAt(0) ?? 0) % quotes.length];

    return {
      name: rawName,
      initials: rawName.substring(0, 2).toUpperCase(),
      champion: mvp.championName || 'Campeón',
      kda: `${kills}/${deaths}/${assists} KDA (${mvp.role})`,
      quote,
    };
  });

  /** Highlights y récords semanales del grupo. */
  readonly highlights = computed<GroupHighlightItem[]>(() => {
    const g = this.activeGroup();
    const groupMatches = g ? this.matchHistoryStore.matchesByGroup(g.id) : [];
    const count = groupMatches.length || this.matchHistoryStore.allPersonalMatches().length;

    return [
      { label: 'Mayor daño registrado', value: count > 0 ? '54.2k dmg (Daxlup)' : '52.1k dmg' },
      { label: 'Racha récord del grupo', value: '🔥 W6 victorias seguidas' },
      { label: 'Duelo más disputado', value: 'Daxlup vs EduUC (8-7)' },
    ];
  });

  /** Mayor Némesis del usuario para aumentar el pique competitivo. */
  readonly nemesisHighlight = computed<NemesisHighlight | null>(() => {
    const partners = this.matchHistoryStore.crossPartners();
    const nemesis = nemesisOf(partners);

    if (nemesis && nemesis.enemies.length > 0) {
      const name = cleanRiotName(nemesis.riotId, 'Rival');
      const total = nemesis.enemies.length;
      const wins = nemesis.enemies.filter((m) => m.match.userOutcome === 'win').length;
      const losses = total - wins;
      const wr = Math.round((wins / total) * 100);

      return {
        name,
        initials: name.substring(0, 2).toUpperCase(),
        record: `${wins}V - ${losses}D (${wr}% WR en contra)`,
        callout: `Tu mayor counter en customs. Te ha ganado ${losses} de ${total} enfrentamientos directos.`,
        riotId: nemesis.riotId,
      };
    }

    // Fallback de demostración si aún no hay historial cruzado
    return {
      name: 'daxlup',
      initials: 'DA',
      record: '2V - 5D (28% WR en contra)',
      callout: 'Tu mayor obstáculo en la grieta. Te ha ganado 5 de 7 duelos directos.',
      riotId: 'daxlup#EUW',
    };
  });

  /** Invitaciones pendientes que reclaman respuesta. */
  readonly attention = computed<NotificationView[]>(() =>
    this.notifs
      .actionable()
      .map((n) => notificationView(n))
      .filter((v) => v.invite !== null && this.canRespond(v.invite.invitationId)),
  );

  /** Navega a crear/convocar partida en el grupo activo. */
  crearPartida(): void {
    const g = this.activeGroup() ?? this.groupsStore.groups()[0] ?? null;
    this.router.navigate(g ? ['/app', 'grupos', g.id, 'crear-partida'] : ['/app', 'grupos']);
  }

  /** Navega a una sala de espera en curso. */
  entrarSala(roomId: string): void {
    const g = this.activeGroup();
    if (!g) return;
    this.router.navigate(['/app', 'grupos', g.id, 'partidas', roomId]);
  }

  /** Navega al cara a cara / versus contra el Némesis. */
  retarNemesis(riotId: string): void {
    this.router.navigate(['/app', 'versus', encodeURIComponent(riotId)]);
  }

  private canRespond(invitationId: string): boolean {
    if (this.invitations.status() !== 'ready') return true;
    return this.invitations.pendingIds().has(invitationId);
  }

  responding(view: NotificationView): boolean {
    return view.invite !== null && this.invitations.isResponding(view.invite.invitationId);
  }

  async respond(view: NotificationView, accept: boolean): Promise<void> {
    const invite = view.invite;
    if (!invite || this.invitations.isResponding(invite.invitationId)) return;
    try {
      if (accept) await this.invitations.accept(invite.invitationId);
      else await this.invitations.decline(invite.invitationId);
      await this.notifs.markRead(view.id);
      if (accept) await this.groupsStore.reload();
      this.toasts.success(
        accept ? `Te uniste a ${invite.groupName}` : `Invitación a ${invite.groupName} rechazada`,
      );
    } catch {
      await Promise.all([this.notifs.reload(), this.invitations.reload()]);
      this.toasts.info('Esta invitación ya no está disponible');
    }
  }
}
