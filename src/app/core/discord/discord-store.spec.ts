import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { DiscordApi } from './discord-api';
import { DiscordStore } from './discord-store';
import { DiscordBotInfo, GroupDiscordLink, LinkDiscordRequest } from './models';

const GROUP_A = 'aaaaaaaa-1111-2222-3333-444444444444';
const GROUP_B = 'bbbbbbbb-1111-2222-3333-444444444444';

function linked(channelId: string): GroupDiscordLink {
  return {
    linked: true,
    guildId: '111222333444555666',
    channelId,
    linkedAt: '2026-08-01T10:00:00Z',
    linkedByName: 'fulano',
    linkHealthy: true,
  };
}

const NOT_LINKED: GroupDiscordLink = {
  linked: false,
  guildId: null,
  channelId: null,
  linkedAt: null,
  linkedByName: null,
  linkHealthy: true,
};

/**
 * Doble del API con emisiones resueltas a mano, para poder observar el estado del store mientras
 * una petición está en vuelo — que es justo lo que la vista pinta.
 */
class ApiStub {
  linkCalls: string[] = [];
  unlinkCalls: string[] = [];
  lastLink: LinkDiscordRequest | null = null;
  failLinkOf = false;
  failLink = false;

  private pending = new Map<string, (link: GroupDiscordLink) => void>();

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

  link(groupId: string, request: LinkDiscordRequest): Observable<GroupDiscordLink> {
    this.lastLink = request;
    if (this.failLink) return throwError(() => new Error('boom'));
    return of(linked(request.channelId));
  }

  unlink(groupId: string): Observable<void> {
    this.unlinkCalls.push(groupId);
    return of(undefined);
  }

  botInfo(): Observable<DiscordBotInfo> {
    return of({ enabled: true, botInviteUrl: 'https://discord.com/oauth2/authorize?x' });
  }

  /** Resuelve la carga en vuelo de un grupo concreto. */
  async settle(groupId: string, link: GroupDiscordLink): Promise<void> {
    this.pending.get(groupId)!(link);
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

  it('conectar publica lo que confirma el servidor', async () => {
    const loading = store.ensureLoaded(GROUP_A);
    await api.settle(GROUP_A, NOT_LINKED);
    await loading;

    await store.link_(GROUP_A, { guildId: '111222333444555666', channelId: 'canal-nuevo' });

    expect(store.link()?.channelId).toBe('canal-nuevo');
    expect(store.saving()).toBe(false);
  });

  it('un fallo al conectar lanza y no toca el estado guardado', async () => {
    const loading = store.ensureLoaded(GROUP_A);
    await api.settle(GROUP_A, linked('canal-a'));
    await loading;
    api.failLink = true;

    await expect(
      store.link_(GROUP_A, { guildId: '111222333444555666', channelId: 'canal-malo' }),
    ).rejects.toThrow();

    expect(store.link()?.channelId).toBe('canal-a');
    expect(store.saving()).toBe(false);
  });

  it('desconectar deja el grupo en "sin conectar"', async () => {
    const loading = store.ensureLoaded(GROUP_A);
    await api.settle(GROUP_A, linked('canal-a'));
    await loading;

    await store.unlink(GROUP_A);

    expect(store.link()?.linked).toBe(false);
    expect(api.unlinkCalls).toEqual([GROUP_A]);
  });

  it('al cerrar sesión no queda rastro del grupo anterior', async () => {
    const loading = store.ensureLoaded(GROUP_A);
    await api.settle(GROUP_A, linked('canal-a'));
    await loading;

    store.clear();

    expect(store.link()).toBeNull();
    expect(store.status()).toBe('idle');
  });
});
