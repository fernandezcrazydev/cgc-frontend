import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  NfAvatar,
  NfBadge,
  NfButton,
  NfModal,
  NfSelect,
  NfSkeleton,
  NfWindow,
} from '../../../../ui';
import { errorMessage } from '../../../../core/http';
import { Auth } from '../../../../core/auth';
import { GroupBridge, GroupDetailStore, GroupsStore, InvitationsStore } from '../../../../core/groups';
import { LobbiesStore, LobbyDetailStore } from '../../../../core/lobbies';
import { PreferencesStore } from '../../../../core/preferences';
import { DiscordStore } from '../../../../core/discord';
import { RiotMetricsStore, RiotUsageStore } from '../../../../core/admin';
import { NotificationsStore } from '../../../../core/notifications';
import { opggUrl } from '../../../../core/member-detail';
import {
  ActiveSession,
  SessionsStore,
  desktopAppMeta,
  scopeLabels,
  sessionLabel,
} from '../../../../core/sessions';
import {
  PairingCode,
  RIOT_REGIONS,
  RiotAccount,
  RiotAccountStore,
  RiotRegion,
} from '../../../../core/riot';
import { ToastService } from '../../../../core/toast';
import { formatRelativeTime } from '../../../../shared/date-format';
import { wireConnectModalOnRiotEvent } from './perfil-connect-modal';

const RELINK_FMT = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

@Component({
  selector: 'app-settings-account',
  standalone: true,
  imports: [NfWindow, NfSkeleton, NfButton, NfAvatar, NfBadge, NfModal, NfSelect],
  templateUrl: './settings-account.component.html',
  styleUrl: './settings-account.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAccountComponent {
  protected readonly riot = inject(RiotAccountStore);
  protected readonly sessions = inject(SessionsStore);
  private readonly toasts = inject(ToastService);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  private readonly notifs = inject(NotificationsStore);
  private readonly invitations = inject(InvitationsStore);
  private readonly groups = inject(GroupsStore);
  private readonly groupDetail = inject(GroupDetailStore);
  private readonly groupBridge = inject(GroupBridge);
  private readonly lobbies = inject(LobbiesStore);
  private readonly lobbyDetail = inject(LobbyDetailStore);
  private readonly prefs = inject(PreferencesStore);
  private readonly discord = inject(DiscordStore);
  private readonly riotUsage = inject(RiotUsageStore);
  private readonly riotMetrics = inject(RiotMetricsStore);

  // ── Modales de Riot ───────────────────────────────────────────────
  readonly linking = signal(false);
  readonly unlinking = signal<RiotAccount | null>(null);
  readonly riotIdDraft = signal('');
  readonly regionDraft = signal<RiotRegion>('EUW');
  readonly regions = [...RIOT_REGIONS];

  readonly linkValid = computed(() => /^.+#.+$/.test(this.riotIdDraft().trim()));
  readonly canLink = computed(() => this.linkValid() && !this.riot.saving());

  readonly relinkAvailableAt = computed(() => {
    const iso = this.riot.relinkAvailableAt();
    return iso ? RELINK_FMT.format(new Date(iso)) : null;
  });

  // ── Conectar app ──────────────────────────────────────────────────
  readonly connecting = signal(false);
  readonly pairingCode = signal<PairingCode | null>(null);
  readonly copied = signal(false);

  private readonly now = signal(Date.now());
  private tick: ReturnType<typeof setInterval> | null = null;

  private readonly codeRemainingMs = computed(() => {
    const pc = this.pairingCode();
    if (!pc) return 0;
    return Math.max(0, new Date(pc.expiresAt).getTime() - this.now());
  });
  readonly codeExpired = computed(() => this.pairingCode() !== null && this.codeRemainingMs() === 0);
  readonly codeCountdown = computed(() => {
    const total = Math.floor(this.codeRemainingMs() / 1000);
    const seconds = total % 60;
    return `${Math.floor(total / 60)}:${seconds.toString().padStart(2, '0')}`;
  });

  // ── Cerrar sesión ─────────────────────────────────────────────────
  readonly confirmLogout = signal(false);

  constructor() {
    void this.riot.ensureLoaded();
    void this.sessions.ensureLoaded();

    wireConnectModalOnRiotEvent(
      this.notifs,
      this.connecting,
      (riotId, type) => {
        this.closeConnect();
        this.toasts.success(
          type === 'RIOT_ACCOUNT_VERIFIED'
            ? `Cuenta ${riotId} verificada.`
            : `Cuenta ${riotId} vinculada.`,
        );
      },
    );
  }

  retryRiot(): void {
    void this.riot.reload();
  }

  retrySessions(): void {
    void this.sessions.reload();
  }

  setRegion(value: string): void {
    if ((RIOT_REGIONS as readonly string[]).includes(value)) {
      this.regionDraft.set(value as RiotRegion);
    }
  }

  startLinking(): void {
    this.riotIdDraft.set('');
    this.regionDraft.set(this.riot.account()?.region ?? 'EUW');
    this.linking.set(true);
  }

  cancelLinking(): void {
    if (this.riot.saving()) return;
    this.linking.set(false);
  }

  async confirmLink(): Promise<void> {
    if (!this.canLink()) return;
    try {
      const ok = await this.riot.link({
        riotId: this.riotIdDraft().trim(),
        region: this.regionDraft(),
      });
      if (!ok) return;
      this.linking.set(false);
      this.toasts.success('Cuenta de Riot vinculada.');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  askUnlink(): void {
    this.unlinking.set(this.riot.account());
  }

  cancelUnlink(): void {
    if (this.riot.saving()) return;
    this.unlinking.set(null);
  }

  async confirmUnlink(): Promise<void> {
    try {
      const ok = await this.riot.unlink();
      if (!ok) return;
      this.unlinking.set(null);
      this.linking.set(false);
      this.toasts.success('Cuenta de Riot desvinculada.');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  openConnect(): void {
    this.pairingCode.set(null);
    this.copied.set(false);
    this.connecting.set(true);
    this.startTick();
  }

  closeConnect(): void {
    this.connecting.set(false);
    this.pairingCode.set(null);
    this.stopTick();
  }

  async generateCode(): Promise<void> {
    if (this.riot.generatingCode()) return;
    try {
      const code = await this.riot.requestPairingCode();
      if (!code) return;
      this.copied.set(false);
      this.now.set(Date.now());
      this.pairingCode.set(code);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(code);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Ignorar fallo de portapapeles
    }
  }

  private startTick(): void {
    this.stopTick();
    this.now.set(Date.now());
    this.tick = setInterval(() => this.now.set(Date.now()), 1000);
  }

  private stopTick(): void {
    if (this.tick !== null) {
      clearInterval(this.tick);
      this.tick = null;
    }
  }

  opgg(tag: string): string {
    return opggUrl(tag);
  }

  label(session: ActiveSession): string {
    return sessionLabel(session);
  }

  sessionMeta(session: ActiveSession): string {
    const parts: string[] = [];
    const desktop = desktopAppMeta(session);
    if (desktop) parts.push(desktop);
    if (session.scopes.length) parts.push(scopeLabels(session.scopes));
    parts.push(`Último acceso ${formatRelativeTime(session.lastSeenAt)}`);
    return parts.join(' · ');
  }

  async closeSession(session: ActiveSession): Promise<void> {
    if (this.sessions.isClosing(session.id)) return;
    try {
      await this.sessions.close(session.id);
      this.toasts.success('Sesión cerrada');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  async logout(): Promise<void> {
    this.confirmLogout.set(false);
    this.notifs.clear();
    this.invitations.clear();
    this.groups.clear();
    this.groupDetail.clear();
    this.groupBridge.clear();
    this.lobbies.clear();
    this.lobbyDetail.clear();
    this.riot.clear();
    this.sessions.clear();
    this.prefs.clear();
    this.discord.clear();
    this.riotUsage.clear();
    this.riotMetrics.clear();
    await this.auth.logout();
    await this.router.navigateByUrl('/');
  }
}
