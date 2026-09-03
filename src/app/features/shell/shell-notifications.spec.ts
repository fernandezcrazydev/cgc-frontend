import { describe, expect, it } from 'vitest';
import { notificationView, NotificationView } from '../../core/notifications';

describe('Semáforo y Notificaciones Semánticas en la Campana [F5.5-02]', () => {
  const NOW = Date.parse('2026-07-18T12:00:00Z');

  function computeSeverity(views: NotificationView[]): string | null {
    const unread = views.filter((v) => !v.read);
    if (unread.length === 0) return null;
    if (unread.some((v) => v.semanticLevel === 'critical')) return 'critical';
    if (unread.some((v) => v.semanticLevel === 'achievement')) return 'achievement';
    if (unread.some((v) => v.semanticLevel === 'room')) return 'room';
    return 'social';
  }

  it('respeta la precedencia estricta: Rojo (Crítico) > Amarillo (Logro) > Verde (Sala) > Azul (Social)', () => {
    const criticalNotif = notificationView(
      {
        id: '1',
        type: 'SANCTION_ISSUED',
        data: { groupName: 'Customs Tryhard' },
        read: false,
        createdAt: '2026-07-18T11:50:00Z',
      },
      NOW,
    );

    const achievementNotif = notificationView(
      {
        id: '2',
        type: 'MVP_EARNED',
        data: { champion: 'Aatrox', kda: '12/2/8' },
        read: false,
        createdAt: '2026-07-18T11:00:00Z',
      },
      NOW,
    );

    const roomNotif = notificationView(
      {
        id: '3',
        type: 'LOBBY_OPENED',
        data: { groupId: 'g1', groupName: 'Noche de Flex', slotsMissing: '2', slotsOccupied: '8' },
        read: false,
        createdAt: '2026-07-18T11:58:00Z',
      },
      NOW,
    );

    const socialNotif = notificationView(
      {
        id: '4',
        type: 'INVITED_TO_GROUP',
        data: { groupId: 'g2', groupName: 'ARAM Legends' },
        read: false,
        createdAt: '2026-07-18T09:00:00Z',
      },
      NOW,
    );

    // Con todas presentes no leídas, gana Rojo (crítico)
    expect(computeSeverity([criticalNotif, achievementNotif, roomNotif, socialNotif])).toBe('critical');

    // Sin crítico, gana Amarillo (logro)
    expect(computeSeverity([achievementNotif, roomNotif, socialNotif])).toBe('achievement');

    // Sin crítico ni logro, gana Verde (sala)
    expect(computeSeverity([roomNotif, socialNotif])).toBe('room');

    // Solo social, toma Azul (social)
    expect(computeSeverity([socialNotif])).toBe('social');

    // Si todo está leído, devuelve null (apaga el semáforo)
    expect(computeSeverity([{ ...socialNotif, read: true }])).toBeNull();
  });

  it('separa los avisos obligatorios no leídos del flujo reciente', () => {
    const sanction = notificationView(
      {
        id: 's1',
        type: 'SANCTION_ISSUED',
        data: { groupName: 'Customs Tryhard' },
        read: false,
        createdAt: '2026-07-18T11:50:00Z',
      },
      NOW,
    );
    const room = notificationView(
      {
        id: 'r1',
        type: 'LOBBY_OPENED',
        data: { groupId: 'g1', groupName: 'Noche de Flex' },
        read: false,
        createdAt: '2026-07-18T11:58:00Z',
      },
      NOW,
    );

    const views = [sanction, room];
    const mandatory = views.filter((v) => v.isMandatory && !v.read);
    const mandatoryIds = new Set(mandatory.map((v) => v.id));
    const recent = views.filter((v) => !mandatoryIds.has(v.id));

    expect(mandatory.length).toBe(1);
    expect(mandatory[0].id).toBe('s1');
    expect(recent.length).toBe(1);
    expect(recent[0].id).toBe('r1');
  });

  it('al confirmar lectura del aviso obligatorio se transfiere al flujo reciente', () => {
    const sanction = notificationView(
      {
        id: 's1',
        type: 'SANCTION_ISSUED',
        data: { groupName: 'Customs Tryhard' },
        read: true, // ya confirmado
        createdAt: '2026-07-18T11:50:00Z',
      },
      NOW,
    );

    const views = [sanction];
    const mandatory = views.filter((v) => v.isMandatory && !v.read);
    const mandatoryIds = new Set(mandatory.map((v) => v.id));
    const recent = views.filter((v) => !mandatoryIds.has(v.id));

    expect(mandatory.length).toBe(0);
    expect(recent.length).toBe(1);
    expect(recent[0].id).toBe('s1');
  });
});
