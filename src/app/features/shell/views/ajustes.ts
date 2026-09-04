import { ChangeDetectionStrategy, Component, inject, linkedSignal, signal } from '@angular/core';
import { NfBadge, NfButton, NfSelect, NfSkeleton, NfToggle, NfWindow } from '../../../ui';
import { errorMessage } from '../../../core/http';
import { REGION_OPTIONS } from '../../../core/lobby';
import { SettingsStore } from '../../../core/settings';
import { ActiveSession, SessionsStore, scopeLabels, sessionLabel } from '../../../core/sessions';
import { THEMES, ThemeService } from '../../../core/theme';
import { ToastService } from '../../../core/toast';
import { formatRelativeTime } from '../../../shared/date-format';

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [NfWindow, NfToggle, NfSelect, NfSkeleton, NfButton, NfBadge],
  styleUrl: './ajustes.scss',
  template: `
    <div class="view max-520">
      <div class="view__head">
        <h1 class="view__title">Ajustes</h1>
      </div>

      <div class="settings-stack">
        <nf-window title="Tema" bodyPadding="22px">
          <div class="settings-eyebrow nf-mono">Apariencia</div>

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

        <nf-window title="Sesiones" bodyPadding="22px">
          <div class="settings-eyebrow nf-mono">Sesiones activas</div>
          <div class="setting-sub setting-sub--help session-intro">
            Dónde tienes la sesión abierta ahora mismo: navegadores y la app de escritorio. Cierra
            la de un dispositivo que ya no uses o que no reconozcas.
          </div>

          <div [attr.aria-busy]="sessions.isLoading() || null">
            @switch (sessions.status()) {
              @case ('loading') {
                <nf-skeleton width="100%" height="52px" />
                <nf-skeleton width="100%" height="52px" />
              }
              @case ('error') {
                <div class="setting-row setting-row--last">
                  <div class="setting-sub">No se han podido cargar las sesiones.</div>
                  <button nfButton variant="ghost" size="sm" (click)="retrySessions()">Reintentar</button>
                </div>
              }
              @default {
                @if (sessions.sessions(); as list) {
                  @if (list.length === 0) {
                    <div class="session-empty nf-mono">No hay ninguna sesión abierta.</div>
                  } @else {
                    @for (session of list; track session.id; let last = $last) {
                      <div class="setting-row" [class.setting-row--last]="last">
                        <div>
                          <div class="setting-title">
                            {{ label(session) }}
                            @if (session.current) {
                              <nf-badge color="secondary">Este dispositivo</nf-badge>
                            }
                          </div>
                          <div class="setting-sub nf-mono">{{ sessionMeta(session) }}</div>
                        </div>
                        <!-- La sesión actual no ofrece el botón: el backend responde 409, y un
                             botón que siempre falla es peor que no tenerlo. Salir de este
                             dispositivo es "Cerrar sesión", que está en el menú de la cuenta. -->
                        @if (!session.current) {
                          <button
                            nfButton
                            variant="danger"
                            size="sm"
                            [disabled]="sessions.isClosing(session.id)"
                            [attr.aria-label]="'Cerrar la sesión de ' + label(session)"
                            (click)="closeSession(session)"
                          >
                            Cerrar
                          </button>
                        }
                      </div>
                    }
                  }
                }
              }
            }
          </div>
        </nf-window>

        <nf-window title="Ajustes" bodyPadding="22px">
          <div class="settings-eyebrow nf-mono">Preferencias del lobby</div>

          <div class="setting-row">
            <div>
              <div class="setting-title">Voz activada</div>
              <div class="setting-sub nf-mono">Chat de voz en el lobby</div>
            </div>
            <nf-toggle [checked]="voice()" (checkedChange)="voice.set($event)" />
          </div>

          <div class="setting-row">
            <div>
              <div class="setting-title">Partida clasificatoria</div>
              <div class="setting-sub nf-mono">Cuenta para el ranking</div>
            </div>
            <nf-toggle [checked]="ranked()" (checkedChange)="ranked.set($event)" />
          </div>

          <div class="setting-row">
            <div>
              <div class="setting-title">Permitir espectadores</div>
              <div class="setting-sub nf-mono">Hasta 5 observadores</div>
            </div>
            <nf-toggle [checked]="spectators()" (checkedChange)="spectators.set($event)" />
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
        border-color: var(--nf-primary);
        background: color-mix(in srgb, var(--nf-primary) 12%, var(--nf-surface-2));
      }
      .theme-opt:focus-visible {
        outline: 2px solid var(--nf-secondary);
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

      .session-intro {
        margin: 6px 0 16px;
      }
      .session-empty {
        padding: 14px 2px 2px;
        font-size: var(--fs-caption);
        color: var(--nf-text-mid);
      }

    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Ajustes {
  readonly theme = inject(ThemeService);
  readonly settings = inject(SettingsStore);
  readonly sessions = inject(SessionsStore);
  private readonly toasts = inject(ToastService);
  readonly themes = THEMES;
  readonly regionOptions = REGION_OPTIONS;

  constructor() {
    void this.settings.ensureLoaded();
    void this.sessions.ensureLoaded();
  }

  retry(): void {
    void this.settings.reload();
  }

  retrySessions(): void {
    void this.sessions.reload();
  }

  /** "Chrome en Windows". Delegado al dominio, que es donde está probado que un `null` no se rellena. */
  label(session: ActiveSession): string {
    return sessionLabel(session);
  }

  /**
   * La segunda línea de la fila: qué es, qué permisos tiene si es la app, y cuándo se usó por
   * última vez. El último acceso va siempre, y va al final porque es el dato con el que de verdad
   * se decide si una sesión es tuya.
   */
  sessionMeta(session: ActiveSession): string {
    const parts: string[] = [];
    if (session.kind === 'DESKTOP_APP') parts.push('App de escritorio');
    if (session.scopes.length) parts.push(scopeLabels(session.scopes));
    parts.push(`Último acceso ${formatRelativeTime(session.lastSeenAt)}`);
    return parts.join(' · ');
  }

  /**
   * Cierra la sesión de otro dispositivo. Pesimista: el store solo la quita de la lista cuando el
   * servidor confirma, y el botón queda deshabilitado mientras vuela (no reentrante). Un fallo se
   * traduce con `errorMessage()`; el 404 de "ya no estaba" el store lo trata como éxito.
   */
  async closeSession(session: ActiveSession): Promise<void> {
    if (this.sessions.isClosing(session.id)) return;
    try {
      await this.sessions.close(session.id);
      this.toasts.success('Sesión cerrada');
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
      // PUT es escritura completa: si solo viajara el campo que se ha tocado, el backend
      // respondería 422. Por eso el otro ajuste se manda tal y como está ahora mismo.
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

  /** Misma mecánica que {@link allowInvites}: el `nf-toggle` mueve su propio estado al pulsarlo. */
  readonly discordNotifs = linkedSignal<boolean | null>(
    () => this.settings.settings()?.discordNotifications ?? null,
  );

  /** Optimista con rollback, igual que el de invitaciones y por el mismo motivo. */
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
  readonly voice = signal(true);
  readonly ranked = signal(false);
  readonly spectators = signal(true);
  readonly region = signal('LAN');
}
