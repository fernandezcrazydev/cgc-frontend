import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, beforeEach } from 'vitest';
import { ChampionItemStats, ChampionRunePage } from '../../../../core/champions';
import { GameDataApi } from '../../../../core/game-data/game-data-api';
import { GameDataStore } from '../../../../core/game-data';
import { ChampionBuildsCardComponent } from './champion-builds-card.component';

@Component({
  standalone: true,
  imports: [ChampionBuildsCardComponent],
  template: `
    <app-champion-builds-card
      [items]="items()"
      [runePage]="runePage()"
      [totalGames]="totalGames()"
      [championName]="championName()"
      [hasGroup]="hasGroup()"
    />
  `,
})
class Host {
  readonly items = signal<ChampionItemStats[]>([]);
  readonly runePage = signal<ChampionRunePage | null>(null);
  readonly totalGames = signal(10);
  readonly championName = signal('Ahri');
  readonly hasGroup = signal(true);
}

describe('ChampionBuildsCardComponent', () => {
  let fixture: ComponentFixture<Host>;
  let gameDataStore: GameDataStore;

  const mockGameDataApi = {
    manifest: () => of({ version: '16.14.1', updatedAt: '2026-07-26T04:17:03Z' }),
    champions: () => of([]),
    champion: () => of(null as any),
    summonerSpells: () => of([]),
    perks: () =>
      of([
        {
          id: 8112,
          name: 'Electrocutar',
          iconUrl: 'https://cdn.example.com/electrocute.png',
          style: false,
        },
      ]),
    items: () =>
      of({
        content: [
          {
            id: 3089,
            name: 'Sombrero mortal de Rabadon',
            iconUrl: 'https://cdn.example.com/3089.png',
            totalGold: 3600,
            purchasable: true,
            available: true,
          },
          {
            id: 3165,
            name: 'Morellonomicón',
            iconUrl: 'https://cdn.example.com/3165.png',
            totalGold: 3000,
            purchasable: true,
            available: true,
          },
        ],
        page: 0,
        size: 200,
        totalElements: 2,
        totalPages: 1,
      }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [GameDataStore, { provide: GameDataApi, useValue: mockGameDataApi }],
    }).compileComponents();

    gameDataStore = TestBed.inject(GameDataStore);
    await gameDataStore.ensureLoaded();

    fixture = TestBed.createComponent(Host);
  });

  it('con objetos conocidos con iconUrl, pinta los <img> con src, alt y title', async () => {
    fixture.componentInstance.items.set([
      { itemId: 3089, games: 8, wins: 5, winrate: 62.5 },
      { itemId: 3165, games: 6, wins: 3, winrate: 50.0 },
    ]);
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const imgs = root.querySelectorAll<HTMLImageElement>('.b-alt4__items-grid img.b-alt4__item-icon');
    expect(imgs.length).toBe(2);
    expect(imgs[0].src).toBe('https://cdn.example.com/3089.png');
    expect(imgs[0].alt).toBe('Sombrero mortal de Rabadon');
    expect(imgs[0].title).toBe('Sombrero mortal de Rabadon');

    expect(imgs[1].src).toBe('https://cdn.example.com/3165.png');
    expect(imgs[1].alt).toBe('Morellonomicón');
    expect(imgs[1].title).toBe('Morellonomicón');
  });

  it('cuando no hay iconUrl (objeto desconocido), no pinta <img> con src vacío y pinta recuadro vacío con fallback de nombre', async () => {
    fixture.componentInstance.items.set([
      { itemId: 99999, games: 3, wins: 1, winrate: 33.3 },
    ]);
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const imgs = root.querySelectorAll<HTMLImageElement>('.b-alt4__items-grid img');
    expect(imgs.length).toBe(0);

    const emptyBox = root.querySelector<HTMLDivElement>('.b-alt4__items-grid .b-alt4__item-icon');
    expect(emptyBox).not.toBeNull();
    expect(emptyBox?.tagName.toLowerCase()).toBe('div');
    expect(emptyBox?.getAttribute('title')).toBe('Objeto #99999');
    expect(emptyBox?.getAttribute('aria-label')).toBe('Objeto #99999');
  });
});
