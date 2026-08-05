import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfButton, NfSkeleton, NfWindow } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { DiscordStore } from '../../../core/discord';
import { ToastService } from '../../../core/toast';
import { errorMessage } from '../../../core/http/api-error';

/** Un snowflake de Discord: 17 a 20 dígitos. Solo para avisar antes de gastar una petición. */
const SNOWFLAKE = /^\d{17,20}$/;

/**
 * Conectar un grupo con un canal de Discord.
 *
 * Está en tres pasos numerados a propósito: es una configuración que se hace una vez, con dudas,
 * y copiando ids desde un menú contextual que hay que activar antes. Un formulario de dos campos
 * sin contexto dejaría a la gente pegando cualquier cosa.
 */
@Component({
  selector: 'app-grupo-discord',
  standalone: true,
  imports: [RouterLink, NfButton, NfWindow, NfSkeleton],
  template: `
    <div class="view">
      @if (group(); as g) {
        <a class="view-back nf-mono" [routerLink]="['/app', 'grupos', g.id]">
          <span class="view-back__arrow" aria-hidden="true">←</span> {{ g.name }}
        </a>
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Discord</div>
          <p class="view__lead">
            Conecta este grupo con un canal de Discord y los avisos de las customs llegarán al móvil
            de todo el mundo, sin que nadie tenga que pasar el enlace.
          </p>
        </div>

        @if (botInfo(); as info) {
          @if (!info.enabled) {
            <nf-window title="Integración desactivada" bodyPadding="22px">
              <p class="setting-sub setting-sub--help">
                La integración con Discord está apagada en este servidor. Habla con quien lo
                administra: hasta entonces no se puede conectar ningún grupo.
              </p>
            </nf-window>
          }
        }

        <nf-window title="1 · Invita al bot a tu servidor" bodyPadding="22px">
          <p class="setting-sub setting-sub--help">
            El bot tiene que estar dentro del servidor para poder escribir en él. Solo pide permiso
            para ver el canal, escribir y crear eventos.
          </p>
          @if (botInfo(); as info) {
            <a
              nfButton
              variant="primary"
              size="sm"
              [href]="info.botInviteUrl"
              target="_blank"
              rel="noopener"
              [attr.aria-disabled]="!info.enabled || null"
              >Invitar al bot</a
            >
          } @else {
            <nf-skeleton width="140px" height="32px" />
          }
        </nf-window>

        <nf-window title="2 · Pega los IDs" bodyPadding="22px">
          <details class="setting-sub setting-sub--help">
            <summary>¿De dónde saco los IDs?</summary>
            <p>
              En Discord: Ajustes de usuario → Avanzado → activa <b>Modo desarrollador</b>. Luego
              clic derecho en el servidor → Copiar ID del servidor, y clic derecho en el canal →
              Copiar ID del canal.
            </p>
          </details>

          <label class="field">
            <span class="field__label nf-mono">ID del servidor</span>
            <input
              class="field__input"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              placeholder="111222333444555666"
              [value]="guildId()"
              (input)="guildId.set($any($event.target).value.trim())"
            />
          </label>

          <label class="field">
            <span class="field__label nf-mono">ID del canal</span>
            <input
              class="field__input"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              placeholder="987654321098765432"
              [value]="channelId()"
              (input)="channelId.set($any($event.target).value.trim())"
            />
          </label>

          @if (formError(); as message) {
            <p class="setting-sub setting-sub--help" role="alert">{{ message }}</p>
          }

          <button
            nfButton
            variant="primary"
            size="sm"
            [disabled]="discord.saving() || !isValid()"
            (click)="save(g.id)"
          >
            {{ discord.saving() ? 'Comprobando…' : 'Conectar' }}
          </button>
        </nf-window>

        <nf-window title="3 · Estado" bodyPadding="22px">
          @switch (discord.status()) {
            @case ('loading') {
              <nf-skeleton width="100%" height="72px" />
            }
            @case ('error') {
              <p class="setting-sub setting-sub--help">No hemos podido leer la conexión.</p>
              <button nfButton variant="ghost" size="sm" (click)="retry(g.id)">Reintentar</button>
            }
            @default {
              @if (discord.link(); as link) {
                @if (link.linked) {
                  <div class="setting-row">
                    <div>
                      <div class="setting-title">Canal conectado</div>
                      <div class="setting-sub setting-sub--help">
                        Canal <code>{{ link.channelId }}</code> del servidor
                        <code>{{ link.guildId }}</code>
                        @if (link.linkedByName) {
                          · lo conectó {{ link.linkedByName }}
                        }
                      </div>
                      @if (!link.linkHealthy) {
                        <div class="setting-sub setting-sub--help" role="alert">
                          Los últimos avisos no han llegado. Comprueba que el bot sigue en el
                          servidor y que el canal existe.
                        </div>
                      }
                    </div>
                    <button
                      nfButton
                      variant="danger"
                      size="sm"
                      [disabled]="discord.saving()"
                      (click)="unlink(g.id)"
                    >
                      Desconectar
                    </button>
                  </div>
                } @else {
                  <p class="setting-sub setting-sub--help">
                    Este grupo todavía no avisa por Discord. Rellena los dos IDs de arriba.
                  </p>
                }
              }
            }
          }
        </nf-window>
      }
    </div>
  `,
})
export class GrupoDiscord {
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  protected readonly groups = inject(GroupStore);
  protected readonly discord = inject(DiscordStore);

  protected readonly guildId = signal('');
  protected readonly channelId = signal('');
  protected readonly formError = signal<string | null>(null);
  protected readonly botInfo = this.discord.botInfo;

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  protected readonly group = computed(() => {
    const id = this.id();
    return id ? this.groups.byId(id) ?? null : null;
  });

  protected readonly isValid = computed(
    () => SNOWFLAKE.test(this.guildId()) && SNOWFLAKE.test(this.channelId()),
  );

  constructor() {
    // Se recarga al cambiar de :id sin desmontar el componente, que es lo que pasa navegando
    // entre grupos por el sidebar.
    effect(() => {
      const id = this.id();
      if (id) void this.discord.ensureLoaded(id);
    });
    void this.discord.ensureBotInfo();
  }

  protected retry(groupId: string): void {
    void this.discord.reload(groupId);
  }

  /**
   * Conecta el grupo. Pesimista: el estado solo cambia cuando el servidor confirma, porque la
   * comprobación contra Discord es justamente lo que puede decir que no.
   */
  protected async save(groupId: string): Promise<void> {
    if (this.discord.saving() || !this.isValid()) return;
    this.formError.set(null);
    try {
      await this.discord.link_(groupId, { guildId: this.guildId(), channelId: this.channelId() });
      this.guildId.set('');
      this.channelId.set('');
      this.toasts.success('Grupo conectado con Discord');
    } catch (e) {
      // También en línea, no solo en un toast: el error explica qué arreglar y el toast se va.
      this.formError.set(errorMessage(e));
      this.toasts.error(errorMessage(e));
    }
  }

  protected async unlink(groupId: string): Promise<void> {
    if (this.discord.saving()) return;
    try {
      await this.discord.unlink(groupId);
      this.toasts.success('Este grupo ya no avisa por Discord');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
