import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { GrupoPerfil } from './grupo-perfil';
import { GroupMembershipResponse, GroupMemberResponse } from '../../../../core/groups';

function createMembership(groupId: string, name = 'Customs Tryhard'): GroupMembershipResponse {
  return {
    group: {
      groupId,
      name,
      tag: 'TRY',
      region: 'EUW',
      matchmakingPreset: 'BALANCED',
      avatarUrl: null,
    },
    role: 'OWNER',
    joinedAt: '2026-02-01T10:00:00Z',
  };
}

function createMember(overrides: Partial<GroupMemberResponse> = {}): GroupMemberResponse {
  return {
    userId: 'usr-1',
    discordUsername: 'Victor',
    avatarUrl: null,
    riotId: 'Victor#EUW',
    riotStrength: 'VERIFIED',
    role: 'OWNER',
    joinedAt: '2026-02-01T10:00:00Z',
    ...overrides,
  };
}

describe('GrupoPerfil', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GrupoPerfil],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(new Map([['id', 'grp-1']])),
          },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  async function setupView(groupId = 'grp-1', members: GroupMemberResponse[] = [createMember()]) {
    const fixture = TestBed.createComponent(GrupoPerfil);
    fixture.detectChanges();

    const reqDetail = http.expectOne(`${environment.apiUrl}/groups/${groupId}`);
    reqDetail.flush(createMembership(groupId));

    const reqMembers = http.expectOne(
      (r) => r.url === `${environment.apiUrl}/groups/${groupId}/members`,
    );
    reqMembers.flush({
      content: members,
      page: 0,
      size: 100,
      totalElements: members.length,
      totalPages: 1,
    });

    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, element: fixture.nativeElement as HTMLElement };
  }

  it('renderiza la cabecera institucional con nombre, tag, región y miembros', async () => {
    const { element } = await setupView();

    const banner = element.querySelector('.gp-banner');
    expect(banner).toBeTruthy();

    const name = element.querySelector('.gp-banner__name');
    expect(name?.textContent?.trim()).toBe('Customs Tryhard');

    const tag = element.querySelector('.gp-banner__tag');
    expect(tag?.textContent?.trim()).toBe('#TRY');

    const meta = element.querySelector('.gp-banner__meta');
    expect(meta?.textContent).toContain('EUW');
    expect(meta?.textContent).toContain('1 miembro');
    expect(meta?.textContent).toContain('Desde');
  });

  it('renderiza la tira de cuatro cifras en el orden acordado', async () => {
    const { element } = await setupView();

    const stats = element.querySelectorAll('.gp-stat');
    expect(stats.length).toBe(4);

    const labels = Array.from(stats).map((s) => s.querySelector('.gp-stat__label')?.textContent?.trim());
    expect(labels).toEqual([
      'Customs jugadas',
      'Horas disputadas',
      'Victorias en azul',
      'Ligas activas',
    ]);
  });

  it('el palmarés aparece en la vista dentro de su ventana', async () => {
    const { element, component } = await setupView();

    expect(component.palmares().length).toBe(3);
    const palmaresWindow = element.querySelector('nf-window[title="Palmarés"]');
    expect(palmaresWindow).toBeTruthy();

    if (component.hasAnyTrophy()) {
      const trophyArticles = element.querySelectorAll('.gp-trophy');
      expect(trophyArticles.length).toBe(3);
    } else {
      const emptyAll = element.querySelector('.gp-trophy-empty--all');
      expect(emptyAll?.textContent).toContain('Este grupo todavía no ha cerrado ninguna temporada.');
    }
  });

  it('ordena el directorio por Propietario -> Administrador -> Miembro, y por nombre dentro de cada rol', async () => {
    const members: GroupMemberResponse[] = [
      createMember({ userId: 'u3', discordUsername: 'Sara', role: 'ADMIN', riotId: 'Sara#EUW' }),
      createMember({ userId: 'u1', discordUsername: 'Victor', role: 'OWNER', riotId: 'Victor#EUW' }),
      createMember({ userId: 'u4', discordUsername: 'Kaori', role: 'MEMBER', riotId: 'Kaori#EUW' }),
      createMember({ userId: 'u2', discordUsername: 'Adri', role: 'ADMIN', riotId: 'Adri#EUW' }),
      createMember({ userId: 'u5', discordUsername: 'Manolito', role: 'MEMBER', riotId: null }),
    ];

    const { component, element } = await setupView('grp-1', members);

    const dir = component.directoryMembers();
    expect(dir.map((m) => m.discordUsername)).toEqual(['Victor', 'Adri', 'Sara', 'Kaori', 'Manolito']);

    const rows = element.querySelectorAll('.gp-member');
    expect(rows.length).toBe(5);
    expect(rows[0].querySelector('.gp-role-chip')?.textContent?.trim()).toBe('Propietario');
    expect(rows[1].querySelector('.gp-role-chip')?.textContent?.trim()).toBe('Administrador');
    expect(rows[4].querySelector('.gp-role-chip')?.textContent?.trim()).toBe('Miembro');
  });

  it('un miembro sin cuenta de Riot enseña "Sin cuenta vinculada" y ningún emblema', async () => {
    const members = [
      createMember({ userId: 'u1', discordUsername: 'Manolito', riotId: null, role: 'MEMBER' }),
    ];

    const { element } = await setupView('grp-1', members);

    const row = element.querySelector('.gp-member');
    expect(row?.querySelector('.gp-member__unlinked')?.textContent?.trim()).toBe('Sin cuenta vinculada');
    expect(row?.querySelector('nf-rank-emblem')).toBeNull();
  });

  it('cada fila del directorio enlaza al perfil de ese jugador', async () => {
    const members = [
      createMember({ userId: 'usr-target', discordUsername: 'Victor', role: 'OWNER' }),
    ];

    const { element } = await setupView('grp-1', members);

    const row = element.querySelector('a.gp-member') as HTMLAnchorElement;
    expect(row).toBeTruthy();
    expect(row.getAttribute('href')).toContain('/app/perfil/usr-target');
  });

  it('activa el scroll interno solo cuando el grupo pasa de 15 miembros', async () => {
    const members = Array.from({ length: 16 }, (_, i) =>
      createMember({ userId: `u-${i}`, discordUsername: `User ${i}` }),
    );

    const { component } = await setupView('grp-1', members);
    expect(component.isRosterScrollable()).toBe(true);
  });
});
