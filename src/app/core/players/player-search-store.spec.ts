import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { PlayerSearchStore } from './player-search-store';
import { Session } from '../auth';
import { GroupStore } from '../group-store';
import { GroupsStore } from '../groups';
import { signal } from '@angular/core';
import { PlayerSearchResult, GroupSearchResultItem } from './models';

describe('PlayerSearchStore', () => {
  let store: PlayerSearchStore;
  let mockSession: { user: ReturnType<typeof signal>; avatarUrl: ReturnType<typeof signal>; initials: ReturnType<typeof signal> };
  let mockGroupStore: { groups: ReturnType<typeof signal> };
  let mockGroupsStore: { groups: ReturnType<typeof signal> };

  beforeEach(() => {
    mockSession = {
      user: signal({
        userId: 'user-me-123',
        discordUsername: 'eduuc_main',
        discriminator: '0',
        globalName: 'EduUC',
        email: 'test@example.com',
        avatar: null,
      } as any),
      avatarUrl: signal(null),
      initials: signal('ED'),
    };

    mockGroupStore = {
      groups: signal([
        { id: 'lan-challenger', name: 'LAN Challenger', tag: 'LAN', initials: 'LC', c1: 'hsl(320,90%,64%)', c2: 'hsl(280,78%,34%)', members: 28 } as any,
      ]),
    };

    mockGroupsStore = {
      groups: signal([]),
    };

    TestBed.configureTestingModule({
      providers: [
        PlayerSearchStore,
        { provide: Session, useValue: mockSession },
        { provide: GroupStore, useValue: mockGroupStore },
        { provide: GroupsStore, useValue: mockGroupsStore },
      ],
    });

    store = TestBed.inject(PlayerSearchStore);
  });

  it('devuelve array vacío si la consulta tiene menos de 2 caracteres', () => {
    expect(store.search('')).toEqual([]);
    expect(store.search(' ')).toEqual([]);
    expect(store.search('e')).toEqual([]);
  });

  it('encuentra sugerencias de jugadores por prefijo o coincidencia en Discord o Riot ID', () => {
    const results = store.search('ed');
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);

    const match = results.find((r): r is PlayerSearchResult => r.type === 'player' && r.discordUsername === 'eduuc');
    expect(match).toBeDefined();
    expect(match?.riotId).toBe('EduUC#EUW');
    expect(match?.rankBadge).toBe('G2');
  });

  it('encuentra grupos por nombre o tag', () => {
    const results = store.search('scrim');
    expect(results.length).toBeGreaterThan(0);

    const scrim = results.find((r): r is GroupSearchResultItem => r.type === 'group' && r.id === 'scrim-squad');
    expect(scrim).toBeDefined();
    expect(scrim?.name).toBe('Scrim Squad');
    expect(scrim?.tag).toBe('EUW');
  });

  it('marca correctamente si el usuario es miembro del grupo', () => {
    const results = store.search('challenger');
    const lan = results.find((r): r is GroupSearchResultItem => r.type === 'group' && r.id === 'lan-challenger');
    expect(lan).toBeDefined();
    expect(lan?.isMember).toBe(true);
  });

  it('limita los resultados a un máximo estricto de 5', () => {
    const results = store.search('e');
    expect(results.length).toBe(0); // < 2 caracteres

    const resultsMulti = store.search('ed');
    expect(resultsMulti.length).toBeLessThanOrEqual(5);
  });

  it('calcula correctamente los grupos en común para jugadores', () => {
    const results = store.search('ed');
    const eduuc = results.find((r): r is PlayerSearchResult => r.type === 'player' && r.discordUsername === 'eduuc');
    const edward = results.find((r): r is PlayerSearchResult => r.type === 'player' && r.discordUsername === 'edward');

    expect(eduuc).toBeDefined();
    expect(eduuc!.commonGroupsCount).toBeGreaterThanOrEqual(1);

    if (edward) {
      expect(edward.commonGroupsCount).toBe(0);
    }
  });

  it('aplica la regla de privacidad: no muestra cuentas privadas sin grupos en común', () => {
    const results = store.search('ghost');
    expect(results.some((r) => r.type === 'player' && r.discordUsername === 'edward_ghost')).toBe(false);
  });

  it('aplica la regla de privacidad: sí muestra cuentas privadas si comparten grupo', () => {
    const results = store.search('secret');
    expect(results.some((r) => r.type === 'player' && r.discordUsername === 'ed_secret')).toBe(true);
    const secret = results.find((r): r is PlayerSearchResult => r.type === 'player' && r.discordUsername === 'ed_secret');
    expect(secret?.commonGroupsCount).toBe(1);
    expect(secret?.rankBadge).toBe('CH');
  });
});
