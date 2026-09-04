import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { HubRosterPanelComponent } from './hub-roster-panel.component';
import { GroupMemberResponse } from '../../../../core/groups';

function member(overrides: Partial<GroupMemberResponse> = {}): GroupMemberResponse {
  return {
    userId: 'usr-1',
    discordUsername: 'Adri',
    avatarUrl: null,
    role: 'MEMBER',
    joinedAt: '2026-02-01T10:00:00Z',
    riotId: 'Adri#EUW',
    riotStrength: 'VERIFIED',
    ...overrides,
  };
}

const ME = member({ userId: 'usr-me', discordUsername: 'EduUC', role: 'OWNER', riotId: 'EduUC#EUW' });
const ADRI = member();
const ADMIN = member({ userId: 'usr-2', discordUsername: 'Victor', role: 'ADMIN', riotId: 'VictorGod#EUW' });

describe('HubRosterPanelComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  function createComponent(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(HubRosterPanelComponent);
    fixture.componentRef.setInput('groupId', 'grp-1');
    fixture.componentRef.setInput('members', [ME, ADRI, ADMIN]);
    fixture.componentRef.setInput('memberCount', 3);
    fixture.componentRef.setInput('currentUserId', 'usr-me');
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('no ofrece ninguna acción a quien no gestiona el grupo', () => {
    const { component } = createComponent({ canManage: false, isOwner: false, myRole: 'MEMBER' });

    expect(component.menuFor(ADRI)).toEqual([]);
    expect(component.menuFor(ADMIN)).toEqual([]);
  });

  it('nunca ofrece acciones sobre uno mismo', () => {
    const { component } = createComponent({ canManage: true, isOwner: true, myRole: 'OWNER' });

    expect(component.menuFor(ME)).toEqual([]);
  });

  it('da al owner ascender, transferir y expulsar sobre un miembro', () => {
    const { component } = createComponent({ canManage: true, isOwner: true, myRole: 'OWNER' });

    expect(component.menuFor(ADRI).map((i) => i.kind)).toEqual(['promote', 'transfer', 'kick']);
  });

  it('al owner le ofrece degradar, no ascender, sobre un admin', () => {
    const { component } = createComponent({ canManage: true, isOwner: true, myRole: 'OWNER' });

    expect(component.menuFor(ADMIN).map((i) => i.kind)).toEqual(['demote', 'transfer', 'kick']);
  });

  it('un admin solo puede expulsar miembros, nunca a otro admin', () => {
    const { component } = createComponent({ canManage: true, isOwner: false, myRole: 'ADMIN' });

    expect(component.menuFor(ADRI).map((i) => i.kind)).toEqual(['kick']);
    expect(component.menuFor(ADMIN)).toEqual([]);
  });

  it('emite la acción elegida con el miembro al que apunta', () => {
    const { component } = createComponent({ canManage: true, isOwner: true, myRole: 'OWNER' });
    const emitted: string[] = [];
    component.action.subscribe((a) => emitted.push(a.kind + ':' + a.member.userId));

    component.run('kick', ADRI);

    expect(emitted).toEqual(['kick:usr-1']);
    // Emitir cierra el menú: la capa flotante no se queda abierta sobre el diálogo que abre.
    expect(component.openMenu()).toBeNull();
  });

  it('filtra el roster por nombre y por Riot ID', () => {
    const { component } = createComponent();

    component.query.set('adr');
    expect(component.visibleMembers().map((m) => m.userId)).toEqual(['usr-1']);

    component.query.set('#EUW');
    expect(component.visibleMembers()).toHaveLength(3);

    component.query.set('nadie');
    expect(component.visibleMembers()).toEqual([]);
  });

  it('cambia de pestaña cerrando cualquier menú abierto', () => {
    const { component } = createComponent({ canManage: true, isOwner: true, myRole: 'OWNER' });
    component.openMenu.set('usr-1');

    component.setTab('ranking');

    expect(component.tab()).toBe('ranking');
    expect(component.openMenu()).toBeNull();
  });

  it('detecta si un jugador está cerca del final de la lista para abrir el menú hacia arriba', () => {
    const { component } = createComponent();

    // Con 3 miembros visibles (índices 0, 1, 2), los índices 1 y 2 están cerca del fondo
    expect(component['isNearBottom'](0)).toBe(false);
    expect(component['isNearBottom'](1)).toBe(true);
    expect(component['isNearBottom'](2)).toBe(true);
  });

  it('muestra las acciones de solicitudes e invitaciones solo cuando canManage es true', () => {
    const adminPanel = createComponent({ canManage: true, pendingRequests: 2, pendingInvites: 1 });
    const memberPanel = createComponent({ canManage: false });

    const adminButtons = adminPanel.fixture.nativeElement.querySelectorAll('.hub-roster__action-btn');
    expect(adminButtons.length).toBe(2);
    expect(adminPanel.fixture.nativeElement.textContent).toContain('Solicitudes');
    expect(adminPanel.fixture.nativeElement.textContent).toContain('Invitaciones');

    const memberButtons = memberPanel.fixture.nativeElement.querySelectorAll('.hub-roster__action-btn');
    expect(memberButtons.length).toBe(0);
  });
});
