import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GameDataApi } from './game-data-api';
import { ChampionDetail, ChampionSummary, GameItem } from './models';

const API = environment.apiUrl;

describe('GameDataApi', () => {
  let api: GameDataApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(GameDataApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('manifest hace GET /game-data/manifest', async () => {
    const result = firstValueFrom(api.manifest());

    const req = http.expectOne(`${API}/game-data/manifest`);
    expect(req.request.method).toBe('GET');
    req.flush({ version: '16.14.1', updatedAt: '2026-07-26T04:17:03Z' });

    expect(await result).toEqual({ version: '16.14.1', updatedAt: '2026-07-26T04:17:03Z' });
  });

  /** El backend nunca ha importado nada: 200 con version null, no un error. */
  it('manifest acepta version null sin romperse', async () => {
    const result = firstValueFrom(api.manifest());

    http.expectOne(`${API}/game-data/manifest`).flush({ version: null, updatedAt: null });

    expect(await result).toEqual({ version: null, updatedAt: null });
  });

  it('champions hace GET /game-data/champions y devuelve el array plano', async () => {
    const ahri: ChampionSummary = {
      id: 103,
      slug: 'Ahri',
      name: 'Ahri',
      title: 'la zorra de nueve colas',
      tags: ['Mage', 'Assassin'],
      iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.14.1/img/champion/Ahri.png',
      loadingUrl: 'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Ahri_0.jpg',
    };
    const result = firstValueFrom(api.champions());

    const req = http.expectOne(`${API}/game-data/champions`);
    expect(req.request.method).toBe('GET');
    req.flush([ahri]);

    expect(await result).toEqual([ahri]);
  });

  it('champion(id) hace GET /game-data/champions/{id} con splash y habilidades', async () => {
    const detail: ChampionDetail = {
      id: 103,
      slug: 'Ahri',
      name: 'Ahri',
      title: 'la zorra de nueve colas',
      tags: ['Mage', 'Assassin'],
      iconUrl: '.../Ahri.png',
      loadingUrl: '.../Ahri_0.jpg',
      splashUrl: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg',
      abilities: [
        { slot: 'PASSIVE', name: 'Esencia robada', iconUrl: '.../Ahri_SoulEater2.png' },
        { slot: 'Q', name: 'Orbe del engaño', iconUrl: '.../AhriOrbofDeception.png' },
      ],
    };
    const result = firstValueFrom(api.champion(103));

    const req = http.expectOne(`${API}/game-data/champions/103`);
    expect(req.request.method).toBe('GET');
    req.flush(detail);

    expect(await result).toEqual(detail);
  });

  it('summonerSpells hace GET /game-data/summoner-spells', async () => {
    const result = firstValueFrom(api.summonerSpells());

    const req = http.expectOne(`${API}/game-data/summoner-spells`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 4, slug: 'SummonerFlash', name: 'Destello', iconUrl: '.../SummonerFlash.png', modes: ['CLASSIC'] }]);

    expect(await result).toEqual([
      { id: 4, slug: 'SummonerFlash', name: 'Destello', iconUrl: '.../SummonerFlash.png', modes: ['CLASSIC'] },
    ]);
  });

  /**
   * Las runas son el único recurso del catálogo cuyo `iconUrl` NO apunta a ddragon: Riot las
   * retiró de ahí y el backend las importa de CommunityDragon. El front no se entera —recibe
   * una URL absoluta como las demás—, y este test lo deja fijado por si alguien intenta
   * "arreglar" el host algún día desde el cliente.
   */
  it('perks hace GET /game-data/perks y acepta el iconUrl de CommunityDragon', async () => {
    const perks = [
      { id: 8100, name: 'Dominación', iconUrl: '.../v1/perk-images/styles/7200_domination.png', style: true },
      {
        id: 8112,
        name: 'Electrocutar',
        iconUrl: '.../v1/perk-images/styles/domination/electrocute/electrocute.png',
        style: false,
      },
    ];
    const result = firstValueFrom(api.perks());

    const req = http.expectOne(`${API}/game-data/perks`);
    expect(req.request.method).toBe('GET');
    req.flush(perks);

    expect(await result).toEqual(perks);
  });

  it('items manda page y size, y omite q cuando no se pasa', async () => {
    api.items(0, 50).subscribe();

    const req = http.expectOne((r) => r.url === `${API}/game-data/items`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('50');
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ content: [], page: 0, size: 50, totalElements: 0, totalPages: 0 });
  });

  it('items manda q cuando se pasa un término de búsqueda', async () => {
    const item: GameItem = {
      id: 3031,
      name: 'Filo del Infinito',
      iconUrl: '.../3031.png',
      totalGold: 3400,
      purchasable: true,
      available: true,
    };
    const result = firstValueFrom(api.items(0, 50, 'filo'));

    const req = http.expectOne((r) => r.url === `${API}/game-data/items`);
    expect(req.request.params.get('q')).toBe('filo');
    req.flush({ content: [item], page: 0, size: 50, totalElements: 1, totalPages: 1 });

    expect(await result).toEqual({ content: [item], page: 0, size: 50, totalElements: 1, totalPages: 1 });
  });
});
