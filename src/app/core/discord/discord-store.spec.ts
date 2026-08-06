import { TestBed } from '@angular/core/testing';
// Después de `@angular/core/testing` a propósito: importarlo antes carga `@angular/common/http`
// entero sin que el compilador JIT esté registrado, y la suite entera muere al arrancar.
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { DiscordApi } from './discord-api';
import { DiscordStore } from './discord-store';
import {
  DiscordAuthorizationStart,
  DiscordBotInfo,
  DiscordGuildChannels,
  GroupDiscordLink,
  LinkDiscordChannelRequest,
} from './models';

const GROUP_A = 'aaaaaaaa-1111-2222-3333-444444444444';
const GROUP_B = 'bbbbbbbb-1111-2222-3333-444444444444';
const GUILD_A = '111222333444555666';
const GUILD_B = '999888777666555444';

function linked(channelId: string, guildId = GUILD_A): GroupDiscordLink {
  return {
    linked: true,
    guildId,
    guildName: 'Los Randoms',
    channelId,
    channelName: 'customs',
    linkedAt: '2026-08-01T10:00:00Z',
    linkedByName: 'fulano',
    linkHealthy: true,
  };
}

/** El estado intermedio del asistente: bot dentro, canal sin elegir. */
function guildOnly(guildId = GUILD_A): GroupDiscordLink {
  return {
    linked: false,
    guildId,
    guildName: 'Los Randoms',
    channelId: null,
    channelName: null,
    linkedAt: '2026-08-01T10:00:00Z',
    linkedByName: 'fulano',
    linkHealthy: true,
  };
}

const NOT_LINKED: GroupDiscordLink = {
  linked: false,
  guildId: null,
  guildName: null,
  channelId: null,
  channelName: null,
  linkedAt: null,
  linkedByName: null,
  linkHealthy: true,
};

function channelsOf(guildId: string): DiscordGuildChannels {
  return {
    guildId,
    guildName: 'Los Randoms',
    channels: [{ id: 'canal-' + guildId, name: 'customs', categoryName: 'LoL' }],
  };
}

/**
 * Doble del API con emisiones resueltas a mano, para poder observar el estado del store mientras
 * una petición está en vuelo — que es justo lo que la vista pinta.
 */
class ApiStub {
  linkCalls: string[] = [];
  unlinkCalls: string[] = [];
  channelCalls: string[] = [];
  lastLink: LinkDiscordChannelRequest | null = null;
  failLinkOf = false;
  failLink = false;
  failChannels = false;
  channelsFailureCode: string | null = null;

  private pending = new Map<string, (link: GroupDiscordLink) => void>();
  private pendingChannels = new Map<string, (channels: DiscordGuildChannels) => void>();

  linkOf(groupId: string): Observable<GroupDiscordLink> {
    this.linkCalls.push(groupId);
    if (this.failLinkOf) return throwError(() => new Error('boom'));
    return new Observable((sub) => {
      this.pending.set(groupId, (link) => {
        sub.next(link);
        sub.complete();
      });
    });
  }

  beginAuthorization(groupId: string): Observable<DiscordAuthorizationStart> {
    return of({ authorizationUrl: 'https://discord.com/oauth2/authorize?state=' + groupId });
  }

  channels(groupId: string): Observable<DiscordGuildChannels> {
    this.channelCalls.push(groupId);
    if (this.channelsFailureCode) {
      return throwError(
        () =>
          new HttpErrorResponse({ status: 409, error: { code: this.channelsFailureCode } }),
      );
    }
    if (this.failChannels) return throwError(() => new Error('boom'));
    return new Observable((sub) => {
      this.pendingChannels.set(groupId, (channels) => {
        sub.next(channels);
        sub.complete();
      });
    });
  }

  link(groupId: string, request: LinkDiscordChannelRequest): Observable<GroupDiscordLink> {
    this.lastLink = request;
    if (this.failLink) return throwError(() => new Error('boom'));
    return of(linked(request.channelId));
  }

  unlink(groupId: string): Observable<void> {
    this.unlinkCalls.push(groupId);
    return of(undefined);
  }

  botInfo(): Observable<DiscordBotInfo> {
    return of({ enabled: true });
  }

  /** Resuelve la carga en vuelo de un grupo concreto. */
  async settle(groupId: string, link: GroupDiscordLink): Promise<void> {
    this.pending.get(groupId)!(link);
    await Promise.resolve();
  }

  async settleChannels(groupId: string, channels: DiscordGuildChannels): Promise<void> {
    this.pendingChannels.get(groupId)!(channels);
    await Promise.resolve();
  }
}

describe('DiscordStore', () => {
  let api: ApiStub;
  let store: DiscordStore;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({ providers: [{ provide: DiscordApi, useValue: api }] });
    store = TestBed.inject(DiscordStore);
  });

  it('carga el vínculo del grupo y lo publica', async () => {
    const loading = store.ensureLoaded(GROUP_A);
    expect(store.isLoading()).toBe(true);

    await api.settle(GROUP_A, linked('canal-a'));
    await loading;

    expect(store.status()).toBe('ready');
    expect(store.link()?.channelId).toBe('canal-a');
  });

  it('no vuelve a pedir lo que ya tiene del mismo grupo', async () => {
    const first = store.ensureLoaded(GROUP_A);
    await api.settle(GROUP_A, linked('canal-a'));
    await first;

    await store.ensureLoaded(GROUP_A);

    expect(api.linkCalls).toEqual([GROUP_A]);
  });

  /**
   * Se navega entre grupos por el sidebar, así que la respuesta del grupo anterior puede llegar
   * después de haber cambiado de pantalla. Sin comprobar de quién son los datos, el canal de otro
   * grupo se pintaría como si fuera el de este — y con un canal, eso se ve como un dato correcto.
   */
  it('descarta la respuesta del grupo que ya no se está mirando', async () => {
    const stale = store.ensureLoaded(GROUP_A);
    const fresh = store.ensureLoaded(GROUP_B);

    // La del primer grupo llega TARDE, cuando la pantalla ya es la del segundo.
    await api.settle(GROUP_B, linked('canal-b'));
    await fresh;
    await api.settle(GROUP_A, linked('canal-a'));
    await stale;

    expect(store.link()?.channelId).toBe('canal-b');
  });

  it('un grupo sin conectar es un estado normal, no un error', async () => {
    const loading = store.ensureLoaded(GROUP_A);
    await api.settle(GROUP_A, NOT_LINKED);
    await loading;

    expect(store.status()).toBe('ready');
    expect(store.link()?.linked).toBe(false);
  });

  /**
   * El asistente a medias tiene que sobrevivir a la recarga: el bot ya está en el servidor y eso
   * no se deshace desde aquí. Si el store no distinguiera este estado del "sin conectar", la
   * pantalla mandaría a la gente a Discord otra vez a hacer lo que ya está hecho.
   */
  it('distingue "servidor autorizado sin canal" de "sin conectar"', async () => {
    const loading = store.ensureLoaded(GROUP_A);
    await api.settle(GROUP_A, guildOnly());
    await loading;

    expect(store.link()?.linked).toBe(false);
    expect(store.link()?.guildId).toBe(GUILD_A);
  });

  it('un fallo de carga deja status en error y permite reintentar', async () => {
    api.failLinkOf = true;

    await store.ensureLoaded(GROUP_A);
    expect(store.status()).toBe('error');

    // El reintento tiene que volver a tocar la red: si la promesa rechazada se quedara
    // cacheada, el botón de reintentar no haría nada nunca.
    api.failLinkOf = false;
    const retry = store.reload(GROUP_A);
    await api.settle(GROUP_A, linked('canal-a'));
    await retry;

    expect(store.status()).toBe('ready');
  });

  // ---------------------------------------------------------------- los canales

  it('carga los canales del servidor autorizado con su propio status', async () => {
    const loading = store.ensureChannels(GROUP_A);
    expect(store.channelsStatus()).toBe('loading');

    await api.settleChannels(GROUP_A, channelsOf(GUILD_A));
    await loading;

    expect(store.channelsStatus()).toBe('ready');
    expect(store.channels()?.channels).toHaveLength(1);
  });

  it('un fallo al leer los canales no tumba el resto de la pantalla', async () => {
    const loading = store.ensureLoaded(GROUP_A);
    await api.settle(GROUP_A, guildOnly());
    await loading;
    api.failChannels = true;

    await store.ensureChannels(GROUP_A);

    expect(store.channelsStatus()).toBe('error');
    // El vínculo sigue leído: son dos peticiones con dos ciclos de vida.
    expect(store.status()).toBe('ready');
  });

  /**
   * El motivo del fallo tiene que llegar a la vista. Los dos casos reales piden acciones opuestas
   * —esperar a que Discord responda, o volver al paso 1 a meter el bot otra vez— así que un único
   * mensaje genérico manda a la mitad de la gente a hacer lo que no es.
   */
  it('publica por qué falló la lista de canales', async () => {
    api.channelsFailureCode = 'DISCORD_BOT_NOT_IN_GUILD';

    await store.ensureChannels(GROUP_A);

    expect(store.channelsStatus()).toBe('error');
    expect(store.channelsError()).toContain('ya no está en ese servidor');
  });

  it('un reintento limpia el error anterior', async () => {
    api.channelsFailureCode = 'DISCORD_BOT_NOT_IN_GUILD';
    await store.ensureChannels(GROUP_A);

    api.channelsFailureCode = null;
    const retry = store.reloadChannels(GROUP_A);
    await api.settleChannels(GROUP_A, channelsOf(GUILD_A));
    await retry;

    expect(store.channelsError()).toBeNull();
  });

  /**
   * Mismo peligro que con el vínculo, y peor de detectar: una lista de canales de otro servidor
   * son nombres plausibles, y elegir uno conectaría el grupo a un sitio que nadie ha autorizado.
   */
  it('descarta la lista de canales del grupo que ya no se está mirando', async () => {
    const stale = store.ensureChannels(GROUP_A);
    const fresh = store.ensureChannels(GROUP_B);

    await api.settleChannels(GROUP_B, channelsOf(GUILD_B));
    await fresh;
    await api.settleChannels(GROUP_A, channelsOf(GUILD_A));
    await stale;

    expect(store.channels()?.guildId).toBe(GUILD_B);
  });

  it('cambiar de grupo olvida los canales del anterior', async () => {
    const loading = store.ensureLoaded(GROUP_A);
    await api.settle(GROUP_A, guildOnly());
    await loading;
    const channels = store.ensureChannels(GROUP_A);
    await api.settleChannels(GROUP_A, channelsOf(GUILD_A));
    await channels;

    store.ensureLoaded(GROUP_B);

    expect(store.channels()).toBeNull();
    expect(store.channelsStatus()).toBe('idle');
  });

  // ---------------------------------------------------------------- escrituras

  it('conectar publica lo que confirma el servidor', async () => {
    const loading = store.ensureLoaded(GROUP_A);
    await api.settle(GROUP_A, guildOnly());
    await loading;

    await store.linkChannel(GROUP_A, { channelId: 'canal-nuevo' });

    expect(store.link()?.channelId).toBe('canal-nuevo');
    expect(store.link()?.linked).toBe(true);
    expect(store.saving()).toBe(false);
  });

  it('un fallo al conectar lanza y no toca el estado guardado', async () => {
    const loading = store.ensureLoaded(GROUP_A);
    await api.settle(GROUP_A, linked('canal-a'));
    await loading;
    api.failLink = true;

    await expect(store.linkChannel(GROUP_A, { channelId: 'canal-malo' })).rejects.toThrow();

    expect(store.link()?.channelId).toBe('canal-a');
    expect(store.saving()).toBe(false);
  });

  /**
   * El backend publica el mensaje de bienvenida antes de guardar, así que conectar tarda lo que
   * tarde Discord. Un doble clic mandaría dos mensajes al canal de otra gente.
   */
  it('no deja lanzar dos conexiones a la vez', async () => {
    const loading = store.ensureLoaded(GROUP_A);
    await api.settle(GROUP_A, guildOnly());
    await loading;

    const first = store.linkChannel(GROUP_A, { channelId: 'canal-nuevo' });
    await expect(store.linkChannel(GROUP_A, { channelId: 'canal-nuevo' })).rejects.toThrow();
    await first;
  });

  it('desconectar deja el grupo en "sin conectar" y olvida los canales', async () => {
    const loading = store.ensureLoaded(GROUP_A);
    await api.settle(GROUP_A, linked('canal-a'));
    await loading;
    const channels = store.ensureChannels(GROUP_A);
    await api.settleChannels(GROUP_A, channelsOf(GUILD_A));
    await channels;

    await store.unlink(GROUP_A);

    expect(store.link()?.linked).toBe(false);
    expect(store.link()?.guildId).toBeNull();
    expect(store.channels()).toBeNull();
    expect(api.unlinkCalls).toEqual([GROUP_A]);
  });

  it('pedir la autorización devuelve la URL sin navegar', async () => {
    const url = await store.beginAuthorization(GROUP_A);

    expect(url).toContain('discord.com/oauth2/authorize');
    expect(store.authorizing()).toBe(false);
  });

  it('al cerrar sesión no queda rastro del grupo anterior', async () => {
    const loading = store.ensureLoaded(GROUP_A);
    await api.settle(GROUP_A, linked('canal-a'));
    await loading;

    store.clear();

    expect(store.link()).toBeNull();
    expect(store.status()).toBe('idle');
    expect(store.channels()).toBeNull();
  });
});
