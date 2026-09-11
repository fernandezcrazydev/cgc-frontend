import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
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
  templateUrl: './grupo-discord.html',
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
      /* La línea va DETRÁS de cada paso, no delante del siguiente. Puesta delante, el paso 1 —que
         no tiene— se quedaba con su espacio sobrante suelto detrás de la etiqueta, y la línea del
         paso 2 pegada a su círculo: "Servidor" flotando lejos de una raya desplazada a la derecha.
         Detrás, el hueco que sobra ES la línea, y queda a 8px de la etiqueta y a 8px del círculo
         siguiente sin tener que calcular nada. */
      .dc-step:not(:last-child)::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--nf-border);
      }
      /* El último no crece: si creciera, el sobrante volvería a quedarse colgando detrás de
         "Listo", que es el mismo defecto en la otra punta. */
      .dc-step:last-child {
        flex: none;
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
