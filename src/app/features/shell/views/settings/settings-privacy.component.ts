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
  selector: 'app-settings-privacy',
  standalone: true,
  imports: [NfWindow, NfSkeleton, NfButton, NfToggle],
  template: `
    <nf-window title="Privacidad" bodyPadding="22px">
      <div class="settings-eyebrow nf-mono">Invitaciones</div>

      <div class="setting-row setting-row--last" [attr.aria-busy]="settings.isLoading() || null">
        <div>
          <div class="setting-title">Aceptar invitaciones a grupos</div>
          <div class="setting-sub setting-sub--help">
            Si lo apagas, nadie podrá invitarte a un grupo nuevo
          </div>
        </div>

        @switch (settings.status()) {
          @case ('error') {
            <button nfButton variant="ghost" size="sm" (click)="retry()">Reintentar</button>
          }
          @default {
            @if (allowInvites() === null) {
              <nf-skeleton width="48px" height="28px" />
            } @else {
              <nf-toggle
                [checked]="!!allowInvites()"
                ariaLabel="Aceptar invitaciones a grupos"
                [disabled]="settings.saving()"
                (checkedChange)="setAllowInvites($event)"
              />
            }
          }
        }
      </div>
    </nf-window>
  `,
  styleUrl: './settings-privacy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPrivacyComponent {
  protected readonly settings = inject(SettingsStore);
  private readonly toasts = inject(ToastService);

  readonly allowInvites = linkedSignal<boolean | null>(
    () => this.settings.settings()?.allowGroupInvites ?? null,
  );

  constructor() {
    void this.settings.ensureLoaded();
  }

  retry(): void {
    void this.settings.reload();
  }

  async setAllowInvites(allow: boolean): Promise<void> {
    const previous = this.allowInvites();
    if (this.settings.saving() || allow === previous) return;
    this.allowInvites.set(allow);
    try {
      await this.settings.update({
        allowGroupInvites: allow,
        discordNotifications: this.settings.settings()?.discordNotifications ?? true,
      });
      this.toasts.success(
        allow ? 'Ya puedes recibir invitaciones a grupos' : 'No recibirás más invitaciones a grupos',
      );
    } catch (e) {
      this.allowInvites.set(previous);
      this.toasts.error(errorMessage(e));
    }
  }
}
