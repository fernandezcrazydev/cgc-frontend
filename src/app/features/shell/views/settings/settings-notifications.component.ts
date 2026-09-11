import {
  ChangeDetectionStrategy,
  Component,
  inject,
  linkedSignal,
} from '@angular/core';
import { NfButton, NfSkeleton, NfToggle, NfWindow } from '../../../../ui';
import { errorMessage } from '../../../../core/http';
import { SettingsStore } from '../../../../core/settings';
import { ToastService } from '../../../../core/toast';

@Component({
  selector: 'app-settings-notifications',
  standalone: true,
  imports: [NfWindow, NfSkeleton, NfButton, NfToggle],
  template: `
    <div class="settings-notifications-stack">
      <nf-window title="Notificaciones" bodyPadding="22px">
        <div class="settings-eyebrow nf-mono">Discord</div>

        <div class="setting-row setting-row--last" [attr.aria-busy]="settings.isLoading() || null">
          <div>
            <div class="setting-title">Avisarme por Discord</div>
            <div class="setting-sub setting-sub--help">
              Te escribiremos al canal de tu grupo cuando se convoque, se confirme o se cancele una
              partida, y por privado si subes de suplente a titular
            </div>
          </div>

          @switch (settings.status()) {
            @case ('error') {
              <button nfButton variant="ghost" size="sm" (click)="retry()">Reintentar</button>
            }
            @default {
              @if (discordNotifs() === null) {
                <nf-skeleton width="48px" height="28px" />
              } @else {
                <nf-toggle
                  [checked]="!!discordNotifs()"
                  ariaLabel="Avisarme por Discord"
                  [disabled]="settings.saving()"
                  (checkedChange)="setDiscordNotifs($event)"
                />
              }
            }
          }
        </div>
      </nf-window>

      <!-- Bloque informativo de silenciado por grupo -->
      <nf-window title="Silenciar grupos" bodyPadding="22px">
        <div class="settings-eyebrow nf-mono">Grupos</div>
        <div class="setting-sub setting-sub--help mute-groups-text">
          Poder silenciar los avisos de un grupo concreto todavía no está disponible.
        </div>
      </nf-window>
    </div>
  `,
  styleUrl: './settings-notifications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsNotificationsComponent {
  protected readonly settings = inject(SettingsStore);
  private readonly toasts = inject(ToastService);

  readonly discordNotifs = linkedSignal<boolean | null>(
    () => this.settings.settings()?.discordNotifications ?? null,
  );

  constructor() {
    void this.settings.ensureLoaded();
  }

  retry(): void {
    void this.settings.reload();
  }

  async setDiscordNotifs(enabled: boolean): Promise<void> {
    const previous = this.discordNotifs();
    if (this.settings.saving() || enabled === previous) return;
    this.discordNotifs.set(enabled);
    try {
      await this.settings.update({
        allowGroupInvites: this.settings.settings()?.allowGroupInvites ?? true,
        discordNotifications: enabled,
      });
      this.toasts.success(
        enabled ? 'Te avisaremos por Discord' : 'No te avisaremos por Discord',
      );
    } catch (e) {
      this.discordNotifs.set(previous);
      this.toasts.error(errorMessage(e));
    }
  }
}
