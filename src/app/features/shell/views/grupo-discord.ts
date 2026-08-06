import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NgTemplateOutlet } from '@angular/common';
import { NfButton, NfSelect, NfSkeleton, NfWindow } from '../../../ui';
import { GroupsStore } from '../../../core/groups';
import { DiscordStore } from '../../../core/discord';
import { ToastService } from '../../../core/toast';
import { errorMessage, messageForCode } from '../../../core/http/api-error';

/** Los tres pasos del asistente. El 3 es el estado final, no un paso que haya que dar. */
type Step = 1 | 2 | 3;

const STEP_LABELS: readonly string[] = ['Servidor', 'Canal', 'Listo'];

/**
 * Conectar un grupo con un canal de Discord, guiado.
 *
 * Un asistente y no un formulario porque el trabajo de verdad pasa FUERA de esta pantalla: hay que
 * meter un bot en un servidor de Discord y elegir dónde escribe. Lo que hacía antes era pedir dos
 * snowflakes de 18 cifras copiados de un menú contextual que primero había que activar; ahí no hay
 * nada que validar a ojo, y un id correcto del canal equivocado se acepta igual de bien.
 *
 * Ahora cada paso deja el siguiente hecho: Discord pregunta en qué servidor va el bot (y solo enseña
 * aquellos donde quien mira manda), y con el servidor ya sabido el canal es un desplegable. El
 * último paso lo cierra el propio bot publicando el mensaje de bienvenida — que es a la vez la
 * confirmación, la prueba de que puede escribir ahí, y cómo se entera el resto del servidor.
 *
 * El paso NO es estado de UI: sale de lo que hay guardado en el servidor. Por eso un F5 a mitad, o
 * volver de Discord, o que lo retome otro admin, caen todos donde tocaba y no en la casilla de
 * salida. Lo único local es `forcedStep`, para "cambiar de canal" sin desconectar nada.
 */
@Component({
  selector: 'app-grupo-discord',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet, NfButton, NfWindow, NfSkeleton, NfSelect],
  template: `
    <div class="view max-520">
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

        <!-- Los tres pasos siempre a la vista: cuántos quedan es lo primero que se pregunta
             cualquiera antes de empezar algo que le va a sacar de la aplicación. -->
        <ol class="dc-steps" [attr.aria-label]="'Paso ' + step() + ' de 3'">
          @for (label of stepLabels; track label; let i = $index) {
            <li
              class="dc-step"
              [class.dc-step--done]="step() > i + 1"
              [class.dc-step--now]="step() === i + 1"
              [attr.aria-current]="step() === i + 1 ? 'step' : null"
            >
              <span class="dc-step__dot nf-mono" aria-hidden="true">
                {{ step() > i + 1 ? '✓' : i + 1 }}
              </span>
              <span class="dc-step__label">{{ label }}</span>
            </li>
          }
        </ol>

        @if (botInfo(); as info) {
          @if (!info.enabled) {
            <nf-window title="Integración desactivada" bodyPadding="22px">
              <p class="field__warning">
                La integración con Discord está apagada en este servidor. Habla con quien lo
                administra: hasta entonces no se puede conectar ningún grupo.
              </p>
            </nf-window>
          }
        }

        <!-- Lo que trae la vuelta de Discord cuando algo no salió. Va aquí arriba y no en un toast:
             el toast se va solo y esto es exactamente lo que hay que leer para saber qué hacer. -->
        @if (returnError(); as message) {
          <p class="dc-error dc-error--banner" role="alert">{{ message }}</p>
        }

        @switch (discord.status()) {
          @case ('loading') {
            <nf-window title="Cargando" bodyPadding="22px">
              <div aria-busy="true">
                <nf-skeleton width="70%" height="15px" aria-hidden="true" />
                <div class="dc-gap"></div>
                <nf-skeleton width="90%" height="15px" aria-hidden="true" />
                <div class="dc-gap"></div>
                <nf-skeleton width="150px" height="32px" aria-hidden="true" />
              </div>
            </nf-window>
          }
          @case ('error') {
            <nf-window title="No hemos podido leer la conexión" bodyPadding="22px">
              <p class="field__hint dc-block">
                No hemos podido saber si este grupo ya está conectado a Discord.
              </p>
              <button nfButton variant="ghost" size="sm" (click)="retry(g.id)">Reintentar</button>
            </nf-window>
          }
          @default {
            @switch (step()) {
              @case (1) {
                <nf-window title="1 · Elige tu servidor de Discord" bodyPadding="22px">
                  <p class="field__hint dc-block">
                    Te llevamos a Discord para que digas en qué servidor entra el bot. Discord solo te
                    enseñará los servidores que administras, y el bot pide únicamente permiso para ver
                    el canal, escribir en él y crear eventos.
                  </p>
                  <button
                    nfButton
                    variant="primary"
                    size="sm"
                    [disabled]="!integrationLive() || discord.authorizing()"
                    (click)="authorize(g.id)"
                  >
                    {{ discord.authorizing() ? 'Abriendo Discord…' : 'Conectar con Discord' }}
                  </button>
                  <p class="field__hint dc-foot">
                    Volverás aquí solo, y seguimos por el canal.
                  </p>
                </nf-window>
              }

              @case (2) {
                <nf-window title="2 · Elige el canal de los avisos" bodyPadding="22px">
                  <p class="field__hint dc-block">
                    El bot ya está dentro de
                    <b>{{ discord.link()?.guildName || 'tu servidor' }}</b
                    >. Dinos en qué canal quieres que avise de las customs.
                  </p>

                  @switch (discord.channelsStatus()) {
                    @case ('error') {
                      <p class="field__hint dc-block">
                        {{
                          discord.channelsError() ||
                            'No hemos podido leer los canales del servidor. Comprueba que el bot sigue dentro.'
                        }}
                      </p>
                      <div class="form-foot">
                        <button nfButton variant="ghost" size="sm" (click)="reloadChannels(g.id)">
                          Reintentar
                        </button>
                        <button
                          nfButton
                          variant="ghost"
                          size="sm"
                          [disabled]="discord.authorizing()"
                          (click)="authorize(g.id)"
                        >
                          Volver a meter el bot
                        </button>
                      </div>
                    }
                    @case ('ready') {
                      @if (channelOptions().length) {
                        <div class="form-grid">
                          <div class="field">
                            <label class="field__label nf-mono" for="discord-channel">Canal</label>
                            <nf-select
                              [options]="channelOptions()"
                              [value]="channelId()"
                              (valueChange)="channelId.set($event)"
                            />
                          </div>
                        </div>

                        @if (formError(); as message) {
                          <p class="dc-error" role="alert">{{ message }}</p>
                        }

                        <div class="form-foot">
                          <button
                            nfButton
                            variant="primary"
                            size="sm"
                            [disabled]="discord.saving() || !channelId()"
                            (click)="save(g.id)"
                          >
                            {{ discord.saving() ? 'Conectando…' : 'Conectar este canal' }}
                          </button>
                          <button
                            nfButton
                            variant="ghost"
                            size="sm"
                            [disabled]="discord.saving() || discord.authorizing()"
                            (click)="authorize(g.id)"
                          >
                            Elegir otro servidor
                          </button>
                        </div>
                        <p class="field__hint dc-foot">
                          Al conectar, el bot publicará un mensaje ahí para que se vea que funciona.
                        </p>

                        <!-- Plegado y no a la vista: con la lista llena esto no le hace falta a
                             nadie, y desplegado solo añadiría ruido al camino que ya funciona. -->
                        @if (discord.channels()?.hiddenChannels; as hidden) {
                          <details class="dc-help">
                            <summary class="dc-help__summary">
                              No veo el canal que quiero
                              <span class="dc-help__count nf-mono">{{ hidden }} sin permiso</span>
                            </summary>
                            <div class="dc-help__body">
                              <ng-container [ngTemplateOutlet]="permisos" />
                            </div>
                          </details>
                        }
                      } @else {
                        <!-- Dos motivos muy distintos para una lista vacía: el servidor no tiene
                             canales de texto, o los tiene y el bot no entra en ninguno. Mandar a
                             dar permisos a quien no tiene canales es enviarle a un diálogo que no
                             va a encontrar. -->
                        @if (discord.channels()?.hiddenChannels; as hidden) {
                          <p class="dc-block">
                            El bot no puede escribir en ningún canal de <b>{{ serverName() }}</b>.
                            {{ hidden === 1 ? 'Hay 1 canal de texto' : 'Hay ' + hidden + ' canales de texto' }},
                            pero está todo cerrado para él.
                          </p>
                          <p class="field__hint dc-block">
                            Es lo normal en servidores donde los canales son privados: estar dentro
                            del servidor no le da acceso a nada, se lo tienes que dar tú. Y solo
                            hace falta en el canal que vayas a usar.
                          </p>
                          <ng-container [ngTemplateOutlet]="permisos" />
                        } @else {
                          <p class="dc-block">
                            <b>{{ serverName() }}</b> no tiene ningún canal de texto. Crea uno en
                            Discord y vuelve a cargar la lista.
                          </p>
                        }
                        <div class="form-foot">
                          <button nfButton variant="primary" size="sm" (click)="reloadChannels(g.id)">
                            Volver a cargar la lista
                          </button>
                          <button
                            nfButton
                            variant="ghost"
                            size="sm"
                            [disabled]="discord.authorizing()"
                            (click)="authorize(g.id)"
                          >
                            Elegir otro servidor
                          </button>
                        </div>
                      }
                    }
                    @default {
                      <div class="form-grid" aria-busy="true">
                        <div class="field">
                          <label class="field__label nf-mono">Canal</label>
                          <nf-skeleton width="100%" height="38px" aria-hidden="true" />
                        </div>
                      </div>
                      <div class="form-foot">
                        <nf-skeleton width="170px" height="32px" aria-hidden="true" />
                      </div>
                    }
                  }
                </nf-window>
              }

              @case (3) {
                @if (discord.link(); as link) {
                  <nf-window title="3 · Conectado" bodyPadding="22px">
                    <div class="dc-done">
                      <span class="dc-done__mark nf-mono" aria-hidden="true">✓</span>
                      <div>
                        <div class="setting-title">
                          Los avisos van a
                          <span class="dc-channel">#{{ link.channelName || 'el canal elegido' }}</span>
                          @if (link.guildName) {
                            <span class="field__hint">, en {{ link.guildName }}</span>
                          }
                        </div>
                        <p class="field__hint dc-foot">
                          El bot ya ha saludado ahí.
                          @if (link.linkedByName) {
                            Lo conectó {{ link.linkedByName }}.
                          }
                        </p>
                      </div>
                    </div>

                    @if (!link.linkHealthy) {
                      <p class="field__warning dc-block" role="alert">
                        Los últimos avisos no han llegado. Comprueba que el bot sigue en el servidor y
                        que el canal existe.
                      </p>
                    }

                    <div class="form-foot">
                      <button
                        nfButton
                        variant="secondary"
                        size="sm"
                        [disabled]="discord.saving()"
                        (click)="changeChannel(g.id)"
                      >
                        Cambiar de canal
                      </button>
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
                  </nf-window>
                }
              }
            }
          }
        }
      } @else if (groups.isReady()) {
        <!-- La lista ya está cargada y este grupo no está en ella. Sin esta rama la pantalla se
             quedaba EN BLANCO, que es el peor de los dos: la persona no sabe si está cargando,
             si se ha roto algo o si el enlace es malo. -->
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Discord</div>
          <p class="view__lead">Este grupo no existe, o ya no formas parte de él.</p>
        </div>
        <a class="view-back nf-mono" routerLink="/app/grupos">
          <span class="view-back__arrow" aria-hidden="true">←</span> Tus grupos
        </a>
      } @else {
        <nf-skeleton width="40%" height="18px" aria-hidden="true" />
        <div class="dc-gap"></div>
        <nf-skeleton width="100%" height="180px" aria-hidden="true" />
      }
    </div>

    <!-- Un solo sitio para las instrucciones, usado desde las dos ramas del paso 2: desplegable
         corto (plegadas) y desplegable vacío (a la vista). Copiarlas sería garantizar que un día
         digan cosas distintas. -->
    <ng-template #permisos>
      <ol class="dc-help__steps">
        <li>
          En Discord, clic derecho sobre el canal que quieras usar y entra en <b>Editar canal</b>,
          pestaña <b>Permisos</b>.
        </li>
        <li>
          En <b>Añadir miembros o roles</b>, busca <b>{{ botRoleName() }}</b>.
        </li>
        <li>Actívale <b>Ver canal</b> y <b>Enviar mensajes</b>, y guarda los cambios.</li>
      </ol>
      <p class="field__hint dc-block">
        También vale darle al bot un rol que ya vea ese canal, desde Ajustes del servidor,
        Miembros. Es más cómodo si vas a usar varios canales.
      </p>
    </ng-template>
  `,
  styles: [
    `
      /* Los helpers de views.scss no traen margen propio: dentro de un .field se lo dan los
         gaps del flex, pero aquí van sueltos dentro de la ventana y necesitan separarse de
         lo que tienen encima y debajo. */
      .dc-block {
        margin: 0 0 14px;
      }
      .dc-foot {
        margin: 10px 0 0;
      }
      .dc-gap {
        height: 12px;
      }

      /* El "no veo mi canal". Un <details> nativo y no un acordeón propio: ya sabe abrirse con
         teclado, ya se anuncia como plegable, y la mitad de las veces nadie lo abre. */
      .dc-help {
        margin: 14px 0 0;
        border-top: 1px solid var(--nf-border);
        padding: 12px 0 0;
      }
      .dc-help__summary {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 13px;
        color: var(--nf-text-dim);
      }
      .dc-help__summary:hover {
        color: var(--nf-text);
      }
      .dc-help__count {
        font-size: 11px;
        color: var(--nf-text-dim);
        border: 1px solid var(--nf-border);
        border-radius: 999px;
        padding: 1px 8px;
      }
      .dc-help__body {
        margin: 12px 0 0;
      }

      /* Instrucciones que se siguen con Discord delante, así que van numeradas: hay que saber por
         cuál se iba al volver de la otra ventana. */
      .dc-help__steps {
        margin: 0 0 12px;
        padding: 0 0 0 20px;
        font-size: 13px;
        line-height: 1.65;
        color: var(--nf-text-dim);
      }
      .dc-help__steps b {
        color: var(--nf-text);
        font-weight: 600;
      }
      .dc-help__steps li + li {
        margin-top: 6px;
      }

      /* El indicador de pasos. Una lista y no tres divs: es una secuencia numerada, y así un
         lector de pantalla anuncia "1 de 3" sin que haya que decírselo. */
      .dc-steps {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 20px;
        padding: 0;
        list-style: none;
      }
      .dc-step {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
        font-size: 12px;
        color: var(--nf-text-dim);
      }
      .dc-step + .dc-step::before {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--nf-border);
      }
      .dc-step__dot {
        display: grid;
        place-items: center;
        flex: none;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 1px solid var(--nf-border);
        font-size: 11px;
        line-height: 1;
      }
      .dc-step__label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      /* El paso actual en color de marca y el ya dado en el de éxito: de un vistazo, dónde estoy
         y qué queda. Los pasados no se apagan del todo — siguen siendo información. */
      .dc-step--now {
        color: var(--nf-text);
      }
      .dc-step--now .dc-step__dot {
        border-color: var(--nf-primary);
        color: var(--nf-primary);
      }
      .dc-step--done .dc-step__dot {
        border-color: var(--nf-success);
        color: var(--nf-success);
      }

      .dc-done {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      .dc-done__mark {
        display: grid;
        place-items: center;
        flex: none;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 1px solid var(--nf-success);
        color: var(--nf-success);
        font-size: 13px;
        line-height: 1;
      }
      /* El nombre del canal con su almohadilla, como se escribe en Discord: es lo que la persona
         va a buscar con la vista para comprobar que es el suyo. */
      .dc-channel {
        font-variant-numeric: tabular-nums;
        color: var(--nf-primary);
      }

      /* En rojo y no en el ámbar de field__warning: aquí sí es un error, algo que acaba de
         fallar y hay que corregir antes de seguir. */
      .dc-error {
        margin: 14px 0 0;
        font-size: 12px;
        line-height: 1.5;
        color: var(--nf-danger);
      }
      .dc-error--banner {
        margin: 0 0 18px;
      }
    `,
  ],
})
export class GrupoDiscord {
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

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  protected readonly group = computed(() => {
    const id = this.id();
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
   * Cómo se llama el rol del bot, que es lo que hay que buscar en el diálogo de Discord. El
   * genérico es el último recurso: "busca el rol del bot" es seguible a duras penas, pero mejor
   * que un hueco vacío en mitad de una instrucción.
   */
  protected readonly botRoleName = computed(
    () => this.discord.channels()?.botRoleName ?? 'el rol del bot',
  );

  /**
   * En qué paso está el grupo, según lo que hay guardado. Sin canal pero con servidor es el estado
   * intermedio real: el bot ya está dentro y volver a mandar a nadie a Discord sería repetir trabajo
   * hecho.
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
    // Sin esto la pantalla dependía de que otra vista hubiera cargado los grupos antes, y por
    // ahí llega justo el caso que importa: el callback de Discord vuelve al navegador con una
    // carga completa de página, no navegando por dentro de la SPA.
    void this.groups.ensureLoaded();

    // Se recarga al cambiar de :id sin desmontar el componente, que es lo que pasa navegando
    // entre grupos por el sidebar. Lo local se olvida: pertenecía al grupo anterior.
    effect(() => {
      const id = this.id();
      if (!id) return;
      this.forcedStep.set(null);
      this.channelId.set('');
      this.formError.set(null);
      void this.discord.ensureLoaded(id);
    });

    // Los canales solo se piden cuando hacen falta. Pedirlos al entrar gastaría una llamada a
    // Discord en cada visita a una pantalla que casi siempre solo se viene a mirar.
    effect(() => {
      const id = this.id();
      if (id && this.step() === 2) void this.discord.ensureChannels(id);
    });

    // Preselecciona el primero para que el botón nunca esté deshabilitado sin explicación: un
    // desplegable nativo ya enseña su primera opción, así que dejar el valor vacío mentiría.
    // La lectura de `channelId` va en `untracked` para que este efecto dependa SOLO de la lista:
    // rastreándola, escribir aquí lo volvería a disparar para no hacer nada.
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

  /**
   * El `?error=` con el que vuelve el backend cuando la ida a Discord no salió. Se lee una vez y se
   * borra de la URL: si se quedase, un F5 volvería a enseñar un error de hace diez minutos como si
   * acabara de pasar.
   */
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

  /** Vuelve al paso 2 sin tocar nada: el servidor ya está autorizado, solo cambia el destino. */
  protected changeChannel(groupId: string): void {
    this.formError.set(null);
    this.forcedStep.set(2);
    void this.discord.ensureChannels(groupId);
  }

  /**
   * Paso 1. Pide la URL y navega la pestaña entera: Discord devuelve el navegador a nuestro backend
   * y este a esta misma ruta, así que abrirlo en otra pestaña dejaría la original con la pantalla
   * vieja y el resultado en la de al lado.
   */
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

  /**
   * Paso 2. Pesimista: el backend publica el mensaje de bienvenida antes de guardar nada, así que
   * el estado solo cambia cuando ha llegado de verdad a Discord.
   */
  protected async save(groupId: string): Promise<void> {
    if (this.discord.saving() || !this.channelId()) return;
    this.formError.set(null);
    try {
      await this.discord.linkChannel(groupId, { channelId: this.channelId() });
      // Se suelta el paso forzado para que mande otra vez lo guardado, que ahora dice "conectado".
      this.forcedStep.set(null);
      this.returnError.set(null);
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
      this.forcedStep.set(null);
      this.channelId.set('');
      this.toasts.success('Este grupo ya no avisa por Discord');
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
