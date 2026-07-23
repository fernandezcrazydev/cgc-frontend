import { ChangeDetectionStrategy, Component, inject, linkedSignal, signal } from '@angular/core';
import { NfButton, NfSelect, NfSkeleton, NfToggle, NfWindow } from '../../../ui';
import { errorMessage } from '../../../core/http';
import { REGION_OPTIONS } from '../../../core/lobby';
import { SettingsStore } from '../../../core/settings';
import { DevicesStore } from '../../../core/devices';
import { THEMES, ThemeService } from '../../../core/theme';
import { ToastService } from '../../../core/toast';

/** "23 jul 2026" — la fecha en que se vinculó una sesión de escritorio. */
const DEVICE_FMT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

/** Copy amable de cada scope; un scope sin traducir se pinta tal cual (no rompe). */
const SCOPE_LABELS: Record<string, string> = {
  'profile:read': 'Leer perfil',
  'matches:upload': 'Subir partidas',
};

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [NfWindow, NfToggle, NfSelect, NfSkeleton, NfButton],
  template: `
    <div class="view max-520">
      <div class="view__head">
        <h1 class="view__title">Ajustes</h1>
      </div>

      <div class="settings-stack">
        <nf-window title="tema.exe" accent="cyan" bodyPadding="22px">
          <div class="settings-eyebrow nf-mono nf-eyebrow">Apariencia</div>

          <div class="theme-grid" role="radiogroup" aria-label="Tema visual">
            @for (t of themes; track t.id) {
              <button
                type="button"
                role="radio"
                class="theme-opt"
                [class.is-active]="theme.theme() === t.id"
                [attr.aria-checked]="theme.theme() === t.id"
                (click)="theme.set(t.id)"
              >
                <span class="theme-opt__swatch" [attr.data-preview]="t.id" aria-hidden="true"></span>
                <span class="theme-opt__text">
                  <span class="theme-opt__name">{{ t.label }}</span>
                  <span class="theme-opt__desc">{{ t.description }}</span>
                </span>
              </button>
            }
          </div>
        </nf-window>

        <nf-window title="privacidad.exe" accent="cyan" bodyPadding="22px">
          <div class="settings-eyebrow nf-mono nf-eyebrow">Invitaciones</div>

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
                    accent="cyan"
                    ariaLabel="Aceptar invitaciones a grupos"
                    [disabled]="settings.saving()"
                    (checkedChange)="setAllowInvites($event)"
                  />
                }
              }
            }
          </div>
        </nf-window>

        <nf-window title="dispositivos.exe" accent="pink" bodyPadding="22px">
          <div class="settings-eyebrow nf-mono nf-eyebrow">Dispositivos vinculados</div>
          <div class="setting-sub setting-sub--help device-intro">
            Sesiones de la app de escritorio con acceso a tu cuenta. Revoca la de una máquina que ya
            no uses o que no reconozcas.
          </div>

          <div [attr.aria-busy]="devices.isLoading() || null">
            @switch (devices.status()) {
              @case ('loading') {
                <nf-skeleton width="100%" height="52px" />
                <nf-skeleton width="100%" height="52px" />
              }
              @case ('error') {
                <div class="setting-row setting-row--last">
                  <div class="setting-sub">No se han podido cargar los dispositivos.</div>
                  <button nfButton variant="ghost" size="sm" (click)="retryDevices()">Reintentar</button>
                </div>
              }
              @default {
                @if (devices.devices(); as list) {
                  @if (list.length === 0) {
                    <div class="device-empty nf-mono">
                      No tienes ninguna sesión de escritorio vinculada.
                    </div>
                  } @else {
                    @for (device of list; track device.id; let last = $last) {
                      <div class="setting-row" [class.setting-row--last]="last">
                        <div>
                          <div class="setting-title">Vinculado el {{ formatDeviceDate(device.linkedAt) }}</div>
                          <div class="setting-sub nf-mono nf-caps">{{ scopeLabels(device.scopes) }}</div>
                        </div>
                        <button
                          nfButton
                          variant="danger"
                          size="sm"
                          [disabled]="devices.isRevoking(device.id)"
                          (click)="revoke(device.id)"
                        >
                          Revocar
                        </button>
                      </div>
                    }
                  }
                }
              }
            }
          </div>
        </nf-window>

        <nf-window title="config.exe" accent="pink" bodyPadding="22px">
          <div class="settings-eyebrow nf-mono nf-eyebrow">Preferencias del lobby</div>

          <div class="setting-row">
            <div>
              <div class="setting-title">Voz activada</div>
              <div class="setting-sub nf-mono nf-caps">Chat de voz en el lobby</div>
            </div>
            <nf-toggle [checked]="voice()" accent="cyan" (checkedChange)="voice.set($event)" />
          </div>

          <div class="setting-row">
            <div>
              <div class="setting-title">Partida clasificatoria</div>
              <div class="setting-sub nf-mono nf-caps">Cuenta para el ranking</div>
            </div>
            <nf-toggle [checked]="ranked()" accent="pink" (checkedChange)="ranked.set($event)" />
          </div>

          <div class="setting-row">
            <div>
              <div class="setting-title">Permitir espectadores</div>
              <div class="setting-sub nf-mono nf-caps">Hasta 5 observadores</div>
            </div>
            <nf-toggle [checked]="spectators()" accent="cyan" (checkedChange)="spectators.set($event)" />
          </div>

          <div class="setting-row setting-row--last">
            <div class="setting-title">Región</div>
            <div class="setting-row__control">
              <nf-select [options]="regionOptions" [value]="region()" (valueChange)="region.set($event)" />
            </div>
          </div>
        </nf-window>
      </div>
    </div>
  `,
  styles: [
    `
      .theme-grid {
        display: grid;
        gap: 10px;
        margin-top: 14px;
      }
      .theme-opt {
        display: flex;
        align-items: center;
        gap: 14px;
        width: 100%;
        padding: 12px 14px;
        text-align: left;
        cursor: pointer;
        background: var(--nf-surface-2);
        border: var(--bw-1) solid var(--nf-border);
        border-radius: var(--nf-radius);
        color: inherit;
        font: inherit;
        transition: border-color 0.15s, background 0.15s;
      }
      .theme-opt:hover {
        border-color: var(--nf-border-strong);
      }
      .theme-opt.is-active {
        border-color: var(--nf-pink);
        background: color-mix(in srgb, var(--nf-pink) 12%, var(--nf-surface-2));
      }
      .theme-opt:focus-visible {
        outline: 2px solid var(--nf-cyan);
        outline-offset: 2px;
      }

      /* Muestra de cada skin: los colores van literales a propósito — es una
         previsualización del tema, no del tema activo, así que no puede usar
         los tokens --nf-* (cambiarían con la skin en curso). */
      .theme-opt__swatch {
        flex: none;
        width: 42px;
        height: 42px;
        border-radius: var(--nf-radius-sm);
        border: 1px solid rgba(255, 255, 255, 0.14);
      }
      .theme-opt__swatch[data-preview='nexus'] {
        background: linear-gradient(135deg, #36e0ff, #ff5fd2 60%, #180a2c);
      }
      .theme-opt__swatch[data-preview='nocturne'] {
        background: linear-gradient(135deg, #3a3a3c, #0a84ff 65%, #000);
      }
      .theme-opt__swatch[data-preview='original'] {
        background: linear-gradient(135deg, #818cf8, #e879f9 55%, #070912);
      }

      .theme-opt__text {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }
      .theme-opt__name {
        font-weight: var(--fw-bold);
        font-size: var(--fs-body);
      }
      .theme-opt__desc {
        font-size: 12px;
        color: var(--nf-text-mid);
        line-height: 1.4;
      }

      .device-intro {
        margin: 6px 0 16px;
      }
      .device-empty {
        padding: 14px 2px 2px;
        font-size: 12px;
        color: var(--nf-text-mid);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Ajustes {
  readonly theme = inject(ThemeService);
  readonly settings = inject(SettingsStore);
  readonly devices = inject(DevicesStore);
  private readonly toasts = inject(ToastService);
  readonly themes = THEMES;
  readonly regionOptions = REGION_OPTIONS;

  constructor() {
    void this.settings.ensureLoaded();
    void this.devices.ensureLoaded();
  }

  retry(): void {
    void this.settings.reload();
  }

  retryDevices(): void {
    void this.devices.reload();
  }

  formatDeviceDate(iso: string): string {
    return DEVICE_FMT.format(new Date(iso));
  }

  scopeLabels(scopes: string[]): string {
    return scopes.map((scope) => SCOPE_LABELS[scope] ?? scope).join(' · ');
  }

  /**
   * Revoca una sesión de escritorio. Pesimista: el store solo la quita de la lista cuando el
   * servidor confirma, y el botón queda deshabilitado mientras vuela (no reentrante). Un fallo se
   * traduce con `errorMessage()`; el 404 de "ya no estaba" el store lo trata como éxito.
   */
  async revoke(id: string): Promise<void> {
    if (this.devices.isRevoking(id)) return;
    try {
      await this.devices.revoke(id);
      this.toasts.success('Dispositivo desvinculado');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  /**
   * Posición visible del interruptor; null mientras el valor real no ha llegado (ahí va el
   * skeleton). Es un `linkedSignal` y no un `computed` porque `nf-toggle` mueve su propio
   * estado al hacer clic: si la vista solo leyera del store, un guardado fallido dejaría el
   * interruptor apagado enseñando una mentira, y Angular no lo devolvería a su sitio (la
   * expresión enlazada no habría cambiado de valor).
   */
  readonly allowInvites = linkedSignal<boolean | null>(
    () => this.settings.settings()?.allowGroupInvites ?? null,
  );

  /**
   * Optimista con rollback explícito, que es la excepción que permite el CLAUDE.md: el
   * interruptor ya se ha movido bajo el dedo del usuario y devolverlo a su sitio durante el
   * guardado se leería como "no me ha hecho caso". Mientras vuela queda deshabilitado, y si
   * el servidor dice que no, se devuelve a donde estaba con un toast que lo explica.
   */
  async setAllowInvites(allow: boolean): Promise<void> {
    const previous = this.allowInvites();
    if (this.settings.saving() || allow === previous) return;
    this.allowInvites.set(allow);
    try {
      await this.settings.update({ allowGroupInvites: allow });
      this.toasts.success(
        allow ? 'Ya puedes recibir invitaciones a grupos' : 'No recibirás más invitaciones a grupos',
      );
    } catch (e) {
      this.allowInvites.set(previous);
      this.toasts.error(errorMessage(e));
    }
  }
  readonly voice = signal(true);
  readonly ranked = signal(false);
  readonly spectators = signal(true);
  readonly region = signal('LAN');
}
