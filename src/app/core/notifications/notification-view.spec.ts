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

describe('notificationView · vinculación con la app de escritorio', () => {
  it('mapea RIOT_ACCOUNT_PAIRED con el riotId interpolado', () => {
    const view = notificationView(
      invite({ type: 'RIOT_ACCOUNT_PAIRED', data: { riotId: 'N1ghtfang#LAN', region: 'LAN' } }),
      NOW,
    );
    expect(view.title).toBe('CUENTA VINCULADA');
    expect(view.message).toBe('Vinculamos N1ghtfang#LAN desde la app de escritorio');
    expect(view.accent).toBe('var(--nf-secondary)');
    expect(view.glyph).toBe('↔');
    expect(view.invite).toBeNull();
  });

  it('mapea RIOT_ACCOUNT_VERIFIED con el riotId interpolado', () => {
    const view = notificationView(
      invite({ type: 'RIOT_ACCOUNT_VERIFIED', data: { riotId: 'N1ghtfang#LAN', region: 'LAN' } }),
      NOW,
    );
    expect(view.title).toBe('CUENTA VERIFICADA');
    expect(view.message).toBe('Comprobamos con Riot que N1ghtfang#LAN es tuya');
    expect(view.accent).toBe('var(--nf-success)');
    expect(view.glyph).toBe('✓');
    expect(view.invite).toBeNull();
  });

  it('mapea RIOT_ACCOUNT_TAKEN_OVER con el riotId interpolado', () => {
    const view = notificationView(
      invite({ type: 'RIOT_ACCOUNT_TAKEN_OVER', data: { riotId: 'N1ghtfang#LAN' } }),
      NOW,
    );
    expect(view.title).toBe('CUENTA DESVINCULADA');
    expect(view.message).toBe(
      'Alguien demostró ser el dueño de N1ghtfang#LAN y se ha desvinculado de tu perfil',
    );
    expect(view.accent).toBe('var(--nf-danger)');
    expect(view.glyph).toBe('⊘');
    expect(view.invite).toBeNull();
  });

  it('un tipo desconocido sigue cayendo en el genérico (no rompe con tipos nuevos del backend)', () => {
    const view = notificationView(invite({ type: 'RIOT_ACCOUNT_SOMETHING_FUTURE', data: {} }), NOW);
    expect(view.title).toBe('NOTIFICACIÓN');
    expect(view.accent).toBe('var(--nf-warning)');
    expect(view.invite).toBeNull();
  });
});

describe('notificationView · reporte de feedback (solo admins)', () => {
  function feedback(data: Record<string, string>): NotificationResponse {
    return invite({ type: 'FEEDBACK_SUBMITTED', data });
  }

  it('mapea un bug con su antetítulo, el título del reporte y el enlace al detalle', () => {
    const view = notificationView(
      feedback({ feedbackId: 'f1', kind: 'BUG', title: 'El draft se queda colgado' }),
      NOW,
    );
    expect(view.title).toBe('Nuevo bug');
    expect(view.message).toBe('El draft se queda colgado');
    expect(view.accent).toBe('var(--nf-tertiary)');
    expect(view.glyph).toBe('⚑');
    expect(view.link).toEqual(['/app', 'admin', 'feedback', 'f1']);
    expect(view.invite).toBeNull();
  });

  it('concuerda el género del antetítulo con la clase de reporte', () => {
    expect(notificationView(feedback({ feedbackId: 'f1', kind: 'PROPOSAL', title: 't' }), NOW).title)
      .toBe('Nueva sugerencia');
    expect(notificationView(feedback({ feedbackId: 'f1', kind: 'INCIDENT', title: 't' }), NOW).title)
      .toBe('Nueva incidencia');
  });

  /**
   * El copy va en frase normal: las mayúsculas del antetítulo son de la skin (`nf-caps`), no del
   * texto (CLAUDE.md § UI kit). Si alguien vuelve a gritar aquí, este test se pone rojo.
   */
  it('escribe el antetítulo en frase normal, sin mayúsculas de decoración', () => {
    const title = notificationView(feedback({ feedbackId: 'f1', kind: 'BUG', title: 't' }), NOW).title;
    expect(title).not.toBe(title.toUpperCase());
  });

  /** Si el backend añade una clase de reporte, la campana la enseña en genérico, no se rompe. */
  it('cae a un antetítulo genérico ante un kind desconocido', () => {
    const view = notificationView(feedback({ feedbackId: 'f1', kind: 'QUESTION', title: 't' }), NOW);
    expect(view.title).toBe('Nuevo reporte');
    expect(view.link).toEqual(['/app', 'admin', 'feedback', 'f1']);
  });

  /** Un clic que aterriza en un 404 es peor que una fila que solo informa. */
  it('no navega a ninguna parte si falta el feedbackId', () => {
    expect(notificationView(feedback({ kind: 'BUG', title: 't' }), NOW).link).toBeNull();
  });

  it('cae a un mensaje genérico si falta el título', () => {
    expect(notificationView(feedback({ feedbackId: 'f1', kind: 'BUG' }), NOW).message)
      .toBe('Alguien ha enviado un reporte');
  });

  /**
   * El id llega interpolado en la ruta, así que se pasa como comando de router y no como URL
   * en texto: el router codifica el segmento y un id con barras no puede reescribir la ruta.
   */
  it('deja el id como un segmento propio, sin construir la URL a mano', () => {
    const view = notificationView(feedback({ feedbackId: '../../ajustes', kind: 'BUG', title: 't' }), NOW);
    expect(view.link).toEqual(['/app', 'admin', 'feedback', '../../ajustes']);
  });
});

describe('notificationView · enlace', () => {
  it('las notificaciones que no llevan a ninguna parte no traen enlace', () => {
    expect(notificationView(invite(), NOW).link).toBeNull();
    expect(notificationView(invite({ type: 'RIOT_ACCOUNT_PAIRED', data: {} }), NOW).link).toBeNull();
    expect(notificationView(invite({ type: 'SOMETHING_NEW', data: {} }), NOW).link).toBeNull();
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
