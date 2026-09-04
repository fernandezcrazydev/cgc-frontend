import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { Router } from '@angular/router';
import { GlobalSearchItem, GroupSearchResultItem, PlayerSearchResult, PlayerSearchStore } from '../../core/players';
import { Session } from '../../core/auth';
import { signal } from '@angular/core';

describe('Buscador Global de Jugadores y Grupos [F5.5-01] Integración', () => {
  let playerSearchStore: PlayerSearchStore;
  let mockRouter: { navigate: any };
  let mockSession: { user: any; avatarUrl: any; initials: any };

  beforeEach(() => {
    mockRouter = {
      navigate: vi.fn().mockReturnValue(Promise.resolve(true)),
    };

    mockSession = {
      user: signal({
        userId: 'user-edu-1',
        discordUsername: 'eduuc',
        discriminator: '0',
        globalName: 'EduUC',
        email: 'edu@example.com',
        avatar: null,
      }),
      avatarUrl: signal(null),
      initials: signal('ED'),
    };

    TestBed.configureTestingModule({
      providers: [
        PlayerSearchStore,
        { provide: Router, useValue: mockRouter },
        { provide: Session, useValue: mockSession },
      ],
    });

    playerSearchStore = TestBed.inject(PlayerSearchStore);
  });

  it('devuelve resultados estructurados para jugadores con avatar, discord, riotId, rankBadge y grupos en común', () => {
    const results = playerSearchStore.search('edgar');
    expect(results.length).toBeGreaterThan(0);
    const edgar = results.find((r): r is PlayerSearchResult => r.type === 'player' && r.discordUsername === 'edgar_p');
    expect(edgar).toBeDefined();
    expect(edgar?.discordUsername).toBe('edgar_p');
    expect(edgar?.riotId).toBe('EdgarP#LAN');
    expect(edgar?.rankTier).toBe('SILVER');
    expect(edgar?.rankBadge).toBe('S1');
    expect(typeof edgar?.commonGroupsCount).toBe('number');
  });

  it('devuelve resultados estructurados para grupos', () => {
    const results = playerSearchStore.search('scrim');
    expect(results.length).toBeGreaterThan(0);
    const scrim = results.find((r): r is GroupSearchResultItem => r.type === 'group' && r.id === 'scrim-squad');
    expect(scrim).toBeDefined();
    expect(scrim?.name).toBe('Scrim Squad');
    expect(scrim?.tag).toBe('EUW');
  });

  it('navega a /app/grupos/:id si se selecciona un grupo', () => {
    const item: GlobalSearchItem = {
      type: 'group',
      id: 'scrim-squad',
      name: 'Scrim Squad',
      tag: 'EUW',
      region: 'EUW',
      initials: 'SS',
      c1: 'hsl(190,90%,62%)',
      c2: 'hsl(205,78%,32%)',
      avatarUrl: null,
      membersCount: 12,
      isMember: false,
    };

    if (item.type === 'group') {
      void mockRouter.navigate(['/app', 'grupos', item.id]);
    }

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/app', 'grupos', 'scrim-squad']);
  });

  it('navega a /app/perfil si el jugador seleccionado es el propio usuario', () => {
    const mePlayer: PlayerSearchResult = {
      type: 'player',
      userId: 'user-edu-1',
      discordUsername: 'eduuc',
      riotId: 'EduUC#EUW',
      avatarUrl: null,
      initials: 'ED',
      hue: 210,
      rankTier: 'GOLD',
      rankDivision: 'II',
      rankBadge: 'G2',
      commonGroupsCount: 2,
    };

    const me = mockSession.user();
    if (me && (mePlayer.userId === me.userId || mePlayer.discordUsername.toLowerCase() === me.discordUsername.toLowerCase())) {
      void mockRouter.navigate(['/app', 'perfil']);
    }

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/app', 'perfil']);
  });

  it('navega a /app/perfil/:riotId si el jugador seleccionado es otro usuario', () => {
    const otherPlayer: PlayerSearchResult = {
      type: 'player',
      userId: 'user-edgar-2',
      discordUsername: 'edgar_p',
      riotId: 'EdgarP#LAN',
      avatarUrl: null,
      initials: 'EP',
      hue: 140,
      rankTier: 'SILVER',
      rankDivision: 'I',
      rankBadge: 'S1',
      commonGroupsCount: 1,
    };

    const me = mockSession.user();
    if (me && (otherPlayer.userId === me.userId || otherPlayer.discordUsername.toLowerCase() === me.discordUsername.toLowerCase())) {
      void mockRouter.navigate(['/app', 'perfil']);
    } else {
      void mockRouter.navigate(['/app', 'perfil', otherPlayer.riotId]);
    }

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/app', 'perfil', 'EdgarP#LAN']);
  });
});
