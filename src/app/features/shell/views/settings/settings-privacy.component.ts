import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { NfButton, NfSkeleton, NfToggle, NfWindow } from '../../../../ui';
import { errorMessage } from '../../../../core/http';
import { ProfileVisibility, SettingsStore } from '../../../../core/settings';
import { ToastService } from '../../../../core/toast';

/**
 * Los dos interruptores de privacidad de la cuenta.
 *
 * El segundo —**Perfil privado**— es el que devuelve una pantalla que existió como maqueta y se
 * borró al conectar los perfiles al API, porque el estado que la disparaba era, literalmente,
 * `tag.includes('secret')`: eras privado si tu Riot ID contenía esa palabra. Ahora hay preferencia,
 * columna y endpoint (`cgc-backend#98`), y lo que decide de verdad es el servidor: el cruce
 * responde `403 PROFILE_PRIVATE` a quien no pueda verlo. Este interruptor solo lo elige.
 *
 * **Lo que dice el texto de ayuda importa tanto como el interruptor.** Alguien que lo enciende
 * creyendo que desaparece del historial del grupo está entendiendo lo contrario de lo que hace, y
 * eso es peor que no tener la opción: las partidas son del grupo y siguen saliendo con su nombre y
 * su campeón. Por eso la frase dice las dos mitades, la que tapa y la que no.
 */
@Component({
  selector: 'app-settings-privacy',
  standalone: true,
  imports: [NfWindow, NfSkeleton, NfButton, NfToggle],
  template: `
    <nf-window title="Privacidad" bodyPadding="22px">
      <div class="settings-eyebrow nf-mono">Invitaciones</div>

      <div class="setting-row" [attr.aria-busy]="settings.isLoading() || null">
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

      <div class="settings-eyebrow nf-mono">Perfil</div>

      <div class="setting-row setting-row--last" [attr.aria-busy]="settings.isLoading() || null">
        <div>
          <div class="setting-title">Perfil privado</div>
          <div class="setting-sub setting-sub--help">
            Esconde tus estadísticas —el cruce con otros jugadores y, cuando existan, tu perfil y
            tu tier list— de todo el que no administre un grupo contigo
          </div>
          <div class="setting-sub setting-sub--help setting-sub--caveat">
            Tus partidas no se esconden: son del grupo, y siguen saliendo en su historial con tu
            nombre y tu campeón.
          </div>
        </div>

        @switch (settings.status()) {
          @case ('error') {
            <button nfButton variant="ghost" size="sm" (click)="retry()">Reintentar</button>
          }
          @default {
            @if (isPrivate() === null) {
              <nf-skeleton width="48px" height="28px" />
            } @else {
              <nf-toggle
                [checked]="!!isPrivate()"
                ariaLabel="Perfil privado"
                [disabled]="settings.saving()"
                (checkedChange)="setPrivate($event)"
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

  /**
   * El interruptor es un booleano y el contrato un enum de dos, así que la traducción vive aquí y
   * en un solo sitio. Cuando aparezca un tercer público esto deja de ser un `nf-toggle` y pasa a
   * ser un `nf-select`, que es exactamente por lo que el campo no es un booleano en el backend.
   */
  private readonly visibility = linkedSignal<ProfileVisibility | null>(
    () => this.settings.settings()?.profileVisibility ?? null,
  );

  readonly isPrivate = computed(() => {
    const value = this.visibility();
    return value === null ? null : value === 'GROUP_ADMINS';
  });

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
      await this.settings.patch({ allowGroupInvites: allow });
      this.toasts.success(
        allow ? 'Ya puedes recibir invitaciones a grupos' : 'No recibirás más invitaciones a grupos',
      );
    } catch (e) {
      this.allowInvites.set(previous);
      this.toasts.error(errorMessage(e));
    }
  }

  async setPrivate(hidden: boolean): Promise<void> {
    const previous = this.visibility();
    const next: ProfileVisibility = hidden ? 'GROUP_ADMINS' : 'PUBLIC';
    if (this.settings.saving() || next === previous) return;
    this.visibility.set(next);
    try {
      await this.settings.patch({ profileVisibility: next });
      this.toasts.success(
        hidden
          ? 'Tus estadísticas solo las verán los administradores de tus grupos'
          : 'Tus estadísticas vuelven a ser visibles para tus grupos',
      );
    } catch (e) {
      this.visibility.set(previous);
      this.toasts.error(errorMessage(e));
    }
  }
}
