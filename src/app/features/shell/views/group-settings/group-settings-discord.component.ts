import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { NfButton, NfSelect, NfSkeleton, NfWindow } from '../../../../ui';
import { GroupsStore } from '../../../../core/groups';
import { DiscordStore } from '../../../../core/discord';
import { ToastService } from '../../../../core/toast';
import { errorMessage, messageForCode } from '../../../../core/http/api-error';

/** Los tres pasos del asistente. El 3 es el estado final, no un paso que haya que dar. */
type Step = 1 | 2 | 3;

const STEP_LABELS: readonly string[] = ['Servidor', 'Canal', 'Listo'];

/**
 * Conectar un grupo con un canal de Discord, guiado.
 * Sección de Discord de los Ajustes del Grupo.
 */
@Component({
  selector: 'app-group-settings-discord',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet, NfButton, NfWindow, NfSkeleton, NfSelect],
  templateUrl: './group-settings-discord.component.html',
  styleUrl: './group-settings-discord.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupSettingsDiscordComponent {
  readonly groupId = input.required<string>();

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  protected readonly groups = inject(GroupsStore);
  protected readonly discord = inject(DiscordStore);

  protected readonly stepLabels = STEP_LABELS;
  protected readonly channelId = signal('');
  protected readonly formError = signal<string | null>(null);
  protected readonly returnError = signal<string | null>(null);
  protected readonly botInfo = this.discord.botInfo;

  /**
   * Volver atrás a mano desde "conectado", para cambiar de canal sin desconectar el grupo. Es lo
   * único de esta pantalla que sí es estado de UI: todo lo demás sale de lo guardado en servidor.
   */
  private readonly forcedStep = signal<Step | null>(null);

  protected readonly group = computed(() => {
    const id = this.groupId();
    return id ? (this.groups.byId(id) ?? null) : null;
  });

  /** Sin bot configurado no hay nada que conectar; mientras no se sabe, se deja probar. */
  protected readonly integrationLive = computed(() => this.botInfo()?.enabled !== false);

  /**
   * El servidor autorizado. Se prefiere el nombre que viene con la lista de canales porque es el
   * más reciente: el del vínculo se guardó al autorizar y a un servidor le pueden cambiar el
   * nombre entre un paso y el siguiente.
   */
  protected readonly serverName = computed(
    () => this.discord.channels()?.guildName ?? this.discord.link()?.guildName ?? 'este servidor',
  );

  /**
   * Cómo se llama el rol del bot, que es lo que hay que buscar en el diálogo de Discord.
   */
  protected readonly botRoleName = computed(
    () => this.discord.channels()?.botRoleName ?? 'el rol del bot',
  );

  /**
   * En qué paso está el grupo, según lo que hay guardado.
   */
  private readonly derivedStep = computed<Step>(() => {
    const link = this.discord.link();
    if (!link || !link.guildId) return 1;
    return link.linked ? 3 : 2;
  });

  protected readonly step = computed<Step>(() => this.forcedStep() ?? this.derivedStep());

  /** `#canal · Categoría`, en el orden en que Discord los enseña en la barra lateral. */
  protected readonly channelOptions = computed(() =>
    (this.discord.channels()?.channels ?? []).map((c) => ({
      value: c.id,
      label: c.categoryName ? `#${c.name} · ${c.categoryName}` : `#${c.name}`,
    })),
  );

  constructor() {
    void this.groups.ensureLoaded();

    effect(() => {
      const id = this.groupId();
      if (!id) return;
      this.forcedStep.set(null);
      this.channelId.set('');
      this.formError.set(null);
      void this.discord.ensureLoaded(id);
    });

    effect(() => {
      const id = this.groupId();
      if (id && this.step() === 2) void this.discord.ensureChannels(id);
    });

    effect(() => {
      const options = this.channelOptions();
      const chosen = untracked(this.channelId);
      if (options.length && !options.some((o) => o.value === chosen)) {
        this.channelId.set(options[0].value);
      }
    });

    this.readReturnError();
    void this.discord.ensureBotInfo();
  }

  private readReturnError(): void {
    const code = this.route.snapshot.queryParamMap.get('error');
    if (!code) return;
    this.returnError.set(messageForCode(code));
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  protected retry(groupId: string): void {
    void this.discord.reload(groupId);
  }

  protected reloadChannels(groupId: string): void {
    void this.discord.reloadChannels(groupId);
  }

  protected changeChannel(groupId: string): void {
    this.formError.set(null);
    this.forcedStep.set(2);
    void this.discord.ensureChannels(groupId);
  }

  protected async authorize(groupId: string): Promise<void> {
    if (this.discord.authorizing()) return;
    this.returnError.set(null);
    try {
      const url = await this.discord.beginAuthorization(groupId);
      window.location.assign(url);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  protected async save(groupId: string): Promise<void> {
    if (this.discord.saving() || !this.channelId()) return;
    this.formError.set(null);
    try {
      await this.discord.linkChannel(groupId, { channelId: this.channelId() });
      this.forcedStep.set(null);
      this.returnError.set(null);
      this.toasts.success('Grupo conectado con Discord');
    } catch (e) {
      this.formError.set(errorMessage(e));
      this.toasts.error(errorMessage(e));
    }
  }

  protected async unlink(groupId: string): Promise<void> {
    if (this.discord.saving()) return;
    try {
      await this.discord.unlink(groupId);
      this.forcedStep.set(null);
      this.channelId.set('');
      this.toasts.success('Este grupo ya no avisa por Discord');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
