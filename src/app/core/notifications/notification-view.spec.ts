import { notificationView, timeAgo } from './notification-view';
import { NotificationResponse } from './models';

const NOW = Date.parse('2026-07-18T12:00:00Z');

function invite(overrides: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    id: 'n1',
    type: 'INVITED_TO_GROUP',
    data: { groupId: 'g1', groupName: 'Los Cracks', invitationId: 'inv1' },
    read: false,
    createdAt: '2026-07-18T12:00:00Z',
    ...overrides,
  };
}

describe('notificationView', () => {
  it('mapea INVITED_TO_GROUP a título/mensaje en español con el payload de invitación', () => {
    const view = notificationView(invite(), NOW);
    expect(view.title).toBe('INVITACIÓN A GRUPO');
    expect(view.message).toBe('Te invitaron a unirte a Los Cracks');
    expect(view.invite).toEqual({
      invitationId: 'inv1',
      groupId: 'g1',
      groupName: 'Los Cracks',
      invitedByName: null,
    });
    expect(view.read).toBe(false);
  });

  it('usa invitedByName en el mensaje cuando el backend lo manda', () => {
    const view = notificationView(
      invite({ data: { groupId: 'g1', groupName: 'Los Cracks', invitationId: 'inv1', invitedByName: 'St0rm' } }),
      NOW,
    );
    expect(view.message).toBe('St0rm te invitó a unirte a Los Cracks');
    expect(view.invite?.invitedByName).toBe('St0rm');
  });

  it('sobrevive a un tipo desconocido sin romperse (sin acciones de invitación)', () => {
    const view = notificationView(invite({ type: 'SOMETHING_NEW', data: {} }), NOW);
    expect(view.title).toBe('NOTIFICACIÓN');
    expect(view.invite).toBeNull();
  });

  it('cae a un nombre genérico si falta groupName', () => {
    const view = notificationView(invite({ data: { invitationId: 'inv1' } }), NOW);
    expect(view.message).toBe('Te invitaron a unirte a un grupo');
    expect(view.invite?.groupName).toBe('un grupo');
  });
});

describe('timeAgo', () => {
  it('formatea la antigüedad de forma compacta', () => {
    expect(timeAgo('2026-07-18T11:59:30Z', NOW)).toBe('AHORA');
    expect(timeAgo('2026-07-18T11:55:00Z', NOW)).toBe('5 MIN');
    expect(timeAgo('2026-07-18T09:00:00Z', NOW)).toBe('3 H');
    expect(timeAgo('2026-07-16T12:00:00Z', NOW)).toBe('2 D');
  });

  it('devuelve cadena vacía ante una fecha inválida', () => {
    expect(timeAgo('no-es-fecha', NOW)).toBe('');
  });
});
