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
    expect(view.title).toBe('Invitación a grupo');
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
    expect(view.title).toBe('Notificación');
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
    expect(view.title).toBe('Cuenta vinculada');
    expect(view.message).toBe('Vinculamos N1ghtfang#LAN desde la app de escritorio');
    expect(view.accent).toBe('var(--nf-blue-semantic)');
    expect(view.glyph).toBe('↔');
    expect(view.invite).toBeNull();
  });

  it('mapea RIOT_ACCOUNT_VERIFIED con el riotId interpolado', () => {
    const view = notificationView(
      invite({ type: 'RIOT_ACCOUNT_VERIFIED', data: { riotId: 'N1ghtfang#LAN', region: 'LAN' } }),
      NOW,
    );
    expect(view.title).toBe('Cuenta verificada');
    expect(view.message).toBe('Comprobamos con Riot que N1ghtfang#LAN es tuya');
    expect(view.accent).toBe('var(--nf-blue-semantic)');
    expect(view.glyph).toBe('✓');
    expect(view.invite).toBeNull();
  });

  it('mapea RIOT_ACCOUNT_TAKEN_OVER con el riotId interpolado', () => {
    const view = notificationView(
      invite({ type: 'RIOT_ACCOUNT_TAKEN_OVER', data: { riotId: 'N1ghtfang#LAN' } }),
      NOW,
    );
    expect(view.title).toBe('Cuenta desvinculada');
    expect(view.message).toBe(
      'Alguien demostró ser el dueño de N1ghtfang#LAN y se ha desvinculado de tu perfil',
    );
    expect(view.accent).toBe('var(--nf-crimson)');
    expect(view.glyph).toBe('⊘');
    expect(view.invite).toBeNull();
  });

  it('un tipo desconocido sigue cayendo en el genérico (no rompe con tipos nuevos del backend)', () => {
    const view = notificationView(invite({ type: 'RIOT_ACCOUNT_SOMETHING_FUTURE', data: {} }), NOW);
    expect(view.title).toBe('Notificación');
    expect(view.accent).toBe('var(--nf-blue-semantic)');
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
    expect(view.accent).toBe('var(--nf-blue-semantic)');
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
   * El copy va en frase normal (CLAUDE.md § UI kit): ningún componente pone mayúsculas por
   * su cuenta. Si alguien vuelve a gritar aquí, este test se pone rojo.
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
  it('las notificaciones de grupos llevan a su grupo correspondiente', () => {
    expect(notificationView(invite(), NOW).link).toEqual(['/app', 'grupos', 'g1']);
  });

  it('las notificaciones sin destino no traen enlace', () => {
    expect(notificationView(invite({ type: 'SOMETHING_NEW', data: {} }), NOW).link).toBeNull();
  });
});

describe('timeAgo', () => {
  it('formatea la antigüedad de forma compacta', () => {
    expect(timeAgo('2026-07-18T11:59:30Z', NOW)).toBe('Ahora');
    expect(timeAgo('2026-07-18T11:55:00Z', NOW)).toBe('5 min');
    expect(timeAgo('2026-07-18T09:00:00Z', NOW)).toBe('3 h');
    expect(timeAgo('2026-07-16T12:00:00Z', NOW)).toBe('2 d');
  });

  it('devuelve cadena vacía ante una fecha inválida', () => {
    expect(timeAgo('no-es-fecha', NOW)).toBe('');
  });
});

describe('notificationView · niveles semánticos y avisos obligatorios [F5.5-02]', () => {
  it('mapea SANCTION_ISSUED como crítico obligatorio con botón de lectura', () => {
    const view = notificationView(
      {
        id: 's1',
        type: 'SANCTION_ISSUED',
        data: { groupName: 'Customs Tryhard' },
        read: false,
        createdAt: '2026-07-18T11:50:00Z',
      },
      NOW,
    );
    expect(view.title).toBe('Sanción aplicada');
    expect(view.message).toContain('strike por abandono en "Customs Tryhard"');
    expect(view.semanticLevel).toBe('critical');
    expect(view.isMandatory).toBe(true);
    expect(view.ctaLabel).toBe('Entendido');
    expect(view.accent).toBe('var(--nf-crimson)');
  });

  it('mapea MVP_EARNED como logro / amarillo y redirige a la partida', () => {
    const view = notificationView(
      {
        id: 'm1',
        type: 'MVP_EARNED',
        data: { champion: 'Aatrox', kda: '12/2/8', matchId: 'partida-12' },
        read: false,
        createdAt: '2026-07-18T11:00:00Z',
      },
      NOW,
    );
    expect(view.title).toBe('¡Nuevo MVP obtenido!');
    expect(view.message).toBe('Fuiste el MVP en la victoria con Aatrox (12/2/8).');
    expect(view.semanticLevel).toBe('achievement');
    expect(view.accent).toBe('var(--nf-gold)');
    expect(view.link).toEqual(['/app', 'historial', 'partida-12']);
  });

  it('mapea LOBBY_OPENED como sala con slots y cta de unirse', () => {
    const view = notificationView(
      {
        id: 'l1',
        type: 'LOBBY_OPENED',
        data: {
          groupId: 'g1',
          groupName: 'Noche de Flex',
          slotsMissing: '2',
          slotsOccupied: '8',
          slotsTotal: '10',
        },
        read: false,
        createdAt: '2026-07-18T11:58:00Z',
      },
      NOW,
    );
    expect(view.title).toBe('Sala abierta: Solo faltan 2');
    expect(view.message).toBe('"Noche de Flex" tiene 8/10 jugadores apuntados.');
    expect(view.semanticLevel).toBe('room');
    expect(view.ctaLabel).toBe('Unirme a la sala');
  });

  it('mapea INVITED_TO_GROUP como social', () => {
    const view = notificationView(invite(), NOW);
    expect(view.semanticLevel).toBe('social');
    expect(view.accent).toBe('var(--nf-blue-semantic)');
  });
});

