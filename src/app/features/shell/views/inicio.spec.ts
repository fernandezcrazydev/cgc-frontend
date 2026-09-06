import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Inicio } from './inicio';
import { SessionRecovery } from '../../../core/http';
import { GroupsApi } from '../../../core/groups/groups-api';
import { GroupsStore } from '../../../core/groups';
import { LobbiesApi } from '../../../core/lobbies/lobbies-api';
import { LobbiesStore } from '../../../core/lobbies';

/**
 * Una convocatoria confirmada con seis de diez apuntados: es la sala que el widget de
 * Inicio pinta. Antes de que la vista leyera datos reales, estos seis estaban escritos
 * a mano dentro del propio componente.
 */
const LIVE_LOBBY = {
  id: 'room-123',
  groupId: 'grp-1',
  code: 'WX4K',
  mode: 'OPEN',
  status: 'CONFIRMED',
  capacity: 10,
  note: null,
  openedBy: { userId: 'u-1', discordUsername: 'daxlup', avatarUrl: null, joinedAt: '2026-09-01T18:00:00Z' },
  confirmedSlotId: 'slot-1',
  createdAt: '2026-09-01T18:00:00Z',
  slots: [
    {
      id: 'slot-1',
      startsAt: '2026-09-01T20:00:00Z',
      signedUp: 6,
      starters: [
        { userId: 'u-1', discordUsername: 'daxlup', avatarUrl: null, joinedAt: '2026-09-01T18:00:00Z' },
        { userId: 'u-2', discordUsername: 'EduUC', avatarUrl: null, joinedAt: '2026-09-01T18:01:00Z' },
        { userId: 'u-3', discordUsername: 'Nightstalker', avatarUrl: null, joinedAt: '2026-09-01T18:02:00Z' },
        { userId: 'u-4', discordUsername: 'FakerClone', avatarUrl: null, joinedAt: '2026-09-01T18:03:00Z' },
        { userId: 'u-5', discordUsername: 'Chronoshift', avatarUrl: null, joinedAt: '2026-09-01T18:04:00Z' },
        { userId: 'u-6', discordUsername: 'ViperX', avatarUrl: null, joinedAt: '2026-09-01T18:05:00Z' },
      ],
      bench: [],
    },
  ],
};

describe('Inicio Component', () => {
  let component: Inicio;
  let router: Router;
  let groupsStore: GroupsStore;

  beforeEach(async () => {
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: GroupsApi,
          useValue: {
            myGroups: () =>
              of([
                {
                  group: { groupId: 'grp-1', name: 'LAN Challenger', region: 'LAN', matchmakingPreset: 'BALANCED', avatarUrl: null },
                  role: 'OWNER',
                  joinedAt: '2026-07-18T12:00:00Z',
                },
                {
                  group: { groupId: 'grp-2', name: 'Scrim Squad', region: 'EUW', matchmakingPreset: 'BALANCED', avatarUrl: null },
                  role: 'MEMBER',
                  joinedAt: '2026-07-18T12:00:00Z',
                },
              ]),
          },
        },
        { provide: OidcSecurityService, useValue: { getAccessToken: () => of(''), checkAuth: () => of({ isAuthenticated: true }) } },
        {
          provide: LobbiesApi,
          useValue: {
            listForGroup: () =>
              of({ content: [LIVE_LOBBY], page: 0, size: 20, totalElements: 1, totalPages: 1 }),
          },
        },
        { provide: SessionRecovery, useValue: { refresh: () => Promise.resolve(false) } },
      ],
    }).compileComponents();

    groupsStore = TestBed.inject(GroupsStore);
    await groupsStore.ensureLoaded();
    // El shell las mantiene cargadas en la app; aquí hay que pedirlas a mano.
    await TestBed.inject(LobbiesStore).ensureLoaded('grp-1');

    const fixture = TestBed.createComponent(Inicio);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('se crea correctamente con los grupos cargados', () => {
    expect(component).toBeTruthy();
    expect(component.hasMultipleGroups()).toBe(true);
    expect(component.activeGroup()?.id).toBe('grp-1');
  });

  it('gestiona la navegación Slide & Fade Cinemático entre grupos en el carrusel', () => {
    expect(component.groupIndex()).toBe(0);

    // Primer click a siguiente
    component.nextGroup();
    expect(component.groupIndex()).toBe(1);
    expect(component.slideState()).toBe('sliding-left');
    expect(component.activeGroup()?.id).toBe('grp-2');
    vi.advanceTimersByTime(260);
    expect(component.slideState()).toBe('idle');

    // Segundo click a siguiente (comprobamos que no se queda bloqueado)
    component.nextGroup();
    expect(component.groupIndex()).toBe(0);
    expect(component.slideState()).toBe('sliding-left');
    expect(component.activeGroup()?.id).toBe('grp-1');
    vi.advanceTimersByTime(260);
    expect(component.slideState()).toBe('idle');

    // Navegación hacia atrás
    component.prevGroup();
    expect(component.groupIndex()).toBe(1);
    expect(component.slideState()).toBe('sliding-right');
    expect(component.activeGroup()?.id).toBe('grp-2');
    vi.advanceTimersByTime(260);
    expect(component.slideState()).toBe('idle');
  });

  it('crearPartida lleva al Tablón del grupo activo, que es donde se convoca', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.crearPartida();
    expect(navigateSpy).toHaveBeenCalledWith(['/app', 'grupos', 'grp-1', 'tablon']);
  });

  it('entrarSala navega a la sala especificada del grupo activo', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.entrarSala('room-123');
    expect(navigateSpy).toHaveBeenCalledWith(['/app', 'grupos', 'grp-1', 'sala', 'room-123']);
  });

  it('retarNemesis navega a la ruta de Versus del rival', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.retarNemesis('daxlup#EUW');
    expect(navigateSpy).toHaveBeenCalledWith(['/app', 'versus', 'daxlup%23EUW']);
  });

  it('selectGroup selecciona un grupo directamente y sincroniza el índice', () => {
    expect(component.groupIndex()).toBe(0);

    component.selectGroup(1);
    expect(component.groupIndex()).toBe(1);
    expect(component.slideState()).toBe('sliding-left');
    expect(component.activeGroup()?.id).toBe('grp-2');
    vi.advanceTimersByTime(260);
    expect(component.slideState()).toBe('idle');
  });

  it('calcula correctamente el resumen multigrupo allGroupsLpSummary', () => {
    const summary = component.allGroupsLpSummary();
    expect(summary.length).toBe(2);
    expect(summary[0].name).toBe('LAN Challenger');
    expect(summary[0].isActive).toBe(true);
    expect(summary[1].name).toBe('Scrim Squad');
    expect(summary[1].isActive).toBe(false);
  });

  it('permite alternar el intervalo temporal y recalcula los puntos', () => {
    expect(component.timeRange()).toBe('30d');
    expect(component.lpEvolution().points.length).toBeGreaterThanOrEqual(18);
    expect(component.lpEvolution().yTicks.length).toBe(6);

    component.timeRange.set('7d');
    expect(component.timeRange()).toBe('7d');
    expect(component.lpEvolution().points.length).toBe(7);

    component.timeRange.set('24h');
    expect(component.timeRange()).toBe('24h');
    expect(component.lpEvolution().points.length).toBe(3);
  });

  it('permite establecer puntos en hover y resolver activePoint', () => {
    expect(component.hoveredPoint()).toBeNull();
    const evo = component.lpEvolution();
    expect(evo.activePoint).toBeDefined();

    const samplePoint = {
      idx: 2,
      x: 100,
      y: 50,
      percentX: 10,
      percentY: 18,
      val: 980,
      delta: 25,
      dateStr: '26 ago 2026, 12:30 (CEST)',
      label: 'P3',
      win: true,
    };
    component.setHoveredPoint(samplePoint);
    expect(component.hoveredPoint()?.val).toBe(980);
    component.onChartMouseLeave();
    expect(component.hoveredPoint()).toBeNull();
  });

  it('verPerfil navega a la ruta de perfil del jugador', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.verPerfil('Nightstalker#EUW');
    expect(navigateSpy).toHaveBeenCalledWith(['/app', 'perfil', 'Nightstalker%23EUW']);
  });

  it('calcula lobbyFillPercent adecuadamente', () => {
    expect(component.lobbyFillPercent()).toBe(60);
    expect(component.missingSeats()).toBe(4);
    expect(component.isUserInActiveRoom()).toBe(true);
    expect(component.roomCtaLabel()).toBe('¡Solo faltan 4!');
  });

  it('onHighlightClick gestiona la navegación para cada tipo de highlight', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    // Damage
    component.onHighlightClick({
      id: 'damage',
      label: 'Mayor daño',
      value: '54.2k',
      sublabel: 'Partida',
      matchId: 'match-123',
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/app', 'historial', 'match-123']);

    // Streak
    component.onHighlightClick({
      id: 'streak',
      label: 'Racha',
      value: 'W6',
      sublabel: 'Récord',
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/app', 'grupos', 'grp-1', 'ranking']);

    // Duel
    component.onHighlightClick({
      id: 'duel',
      label: 'Duelo',
      value: 'daxlup vs EduUC',
      sublabel: '15 duelos',
      riotId: 'EduUC',
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/app', 'versus', 'EduUC']);
  });
});
