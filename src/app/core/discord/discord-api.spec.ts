import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { DiscordApi } from './discord-api';
import { DiscordGuildChannels, GroupDiscordLink } from './models';

const API = environment.apiUrl;
const GROUP = 'aaaaaaaa-1111-2222-3333-444444444444';

describe('DiscordApi', () => {
  let api: DiscordApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DiscordApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(DiscordApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('linkOf hace GET del vínculo del grupo', () => {
    const expected: GroupDiscordLink = {
      linked: true,
      guildId: '111222333444555666',
      guildName: 'Los Randoms',
      channelId: '987654321098765432',
      channelName: 'customs',
      linkedAt: '2026-08-01T10:00:00Z',
      linkedByName: 'fulano',
      linkHealthy: true,
    };
    let received: GroupDiscordLink | undefined;
    api.linkOf(GROUP).subscribe((r) => (received = r));

    const req = http.expectOne(`${API}/groups/${GROUP}/discord-link`);
    expect(req.request.method).toBe('GET');
    req.flush(expected);
    expect(received).toEqual(expected);
  });

  /** POST y no GET porque escribe: cada llamada emite un `state` nuevo y quema el anterior. */
  it('beginAuthorization hace POST y devuelve la URL de Discord', () => {
    let received: string | undefined;
    api.beginAuthorization(GROUP).subscribe((r) => (received = r.authorizationUrl));

    const req = http.expectOne(`${API}/groups/${GROUP}/discord/authorization`);
    expect(req.request.method).toBe('POST');
    req.flush({ authorizationUrl: 'https://discord.com/oauth2/authorize?state=abc' });
    expect(received).toBe('https://discord.com/oauth2/authorize?state=abc');
  });

  it('channels hace GET de los canales del servidor autorizado', () => {
    const expected: DiscordGuildChannels = {
      guildId: '111222333444555666',
      guildName: 'Los Randoms',
      channels: [{ id: '987654321098765432', name: 'customs', categoryName: 'LoL' }],
    };
    let received: DiscordGuildChannels | undefined;
    api.channels(GROUP).subscribe((r) => (received = r));

    const req = http.expectOne(`${API}/groups/${GROUP}/discord/channels`);
    expect(req.request.method).toBe('GET');
    req.flush(expected);
    expect(received).toEqual(expected);
  });

  /**
   * El cuerpo lleva SOLO el canal. El servidor lo fija Discord al autorizar al bot y lo lee el
   * backend de su propia fila; mandarlo desde aquí devolvería justo la capacidad que el asistente
   * quita — nombrar un servidor que nadie ha demostrado administrar.
   */
  it('link manda únicamente el canal', () => {
    api.link(GROUP, { channelId: '987654321098765432' }).subscribe();

    const req = http.expectOne(`${API}/groups/${GROUP}/discord-link`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ channelId: '987654321098765432' });
    expect(Object.keys(req.request.body)).not.toContain('guildId');
    req.flush({});
  });

  it('unlink hace DELETE del vínculo', () => {
    api.unlink(GROUP).subscribe();

    const req = http.expectOne(`${API}/groups/${GROUP}/discord-link`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('botInfo hace GET de la configuración del servidor', () => {
    let received: boolean | undefined;
    api.botInfo().subscribe((r) => (received = r.enabled));

    const req = http.expectOne(`${API}/discord/bot-info`);
    expect(req.request.method).toBe('GET');
    req.flush({ enabled: true });
    expect(received).toBe(true);
  });
});
