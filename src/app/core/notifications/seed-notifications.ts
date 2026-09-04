import { NotificationResponse } from './models';

/**
 * Catálogo base determinista y completo de notificaciones demostrativas [F5.5-02].
 * Permite visualizar e interactuar con todos los niveles y estados:
 *
 * - 🔴 ROJO (Crítico / Sanción / Moderación):
 *     - Aviso obligatorio no leído con pulso en campana y botón [ Confirmar lectura ]
 * - 🟡 AMARILLO (Logro / MVP / Ascenso):
 *     - ¡Nuevo MVP obtenido!
 *     - Subida de división en ranking
 * - 🟢 VERDE (Sala / Convocatoria en directo):
 *     - Sala abierta esperando jugadores con botón [ Unirme a la sala ]
 *     - Partida confirmada con hora
 *     - Ascenso de suplente a titular
 * - 🔵 AZUL (Social / Invitaciones / Cuenta):
 *     - Invitación a grupo con botones [ Aceptar / Rechazar ]
 *     - Confirmación de vinculación y verificación de Riot
 *     - Notificación de feedback / reporte
 */
export const SEED_NOTIFICATIONS: NotificationResponse[] = [
  {
    id: 'demo-notif-sanction-1',
    type: 'SANCTION_ISSUED',
    data: {
      groupId: 'lan-challenger',
      groupName: 'Customs Tryhard',
      message: 'Has recibido un strike por abandono en "Customs Tryhard". Recuerda que 3 strikes suponen suspensión.',
    },
    read: false,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // Hace 10 min
  },
  {
    id: 'demo-notif-lobby-open',
    type: 'LOBBY_OPENED',
    data: {
      groupId: 'lan-challenger',
      groupName: 'Noche de Flex',
      lobbyId: 'lobby-flex-1',
      slotsMissing: '2',
      slotsOccupied: '8',
      slotsTotal: '10',
      message: '"Noche de Flex" tiene 8/10 jugadores apuntados.',
    },
    read: false,
    createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(), // Hace 3 min
  },
  {
    id: 'demo-notif-mvp-1',
    type: 'MVP_EARNED',
    data: {
      matchId: 'partida-12',
      champion: 'Aatrox',
      kda: '12/2/8',
      message: 'Fuiste el MVP en la victoria con Aatrox (12/2/8).',
    },
    read: false,
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // Hace 45 min
  },
  {
    id: 'demo-notif-invite-1',
    type: 'INVITED_TO_GROUP',
    data: {
      groupId: 'scrim-squad',
      groupName: 'ARAM Legends',
      invitationId: 'inv-aram-1',
      invitedByName: 'Edu',
    },
    read: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // Hace 2 horas
  },
  {
    id: 'demo-notif-tier-promo',
    type: 'TIER_PROMOTED',
    data: {
      tier: 'Esmeralda II',
      message: '¡Has ascendido a Esmeralda II en el ranking del grupo!',
    },
    read: false,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // Hace 3 horas
  },
  {
    id: 'demo-notif-lobby-confirmed',
    type: 'LOBBY_CONFIRMED',
    data: {
      groupId: 'lan-challenger',
      lobbyId: 'lobby-flex-1',
      groupName: 'LAN Challenger S14',
      startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    },
    read: true,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // Hace 5 horas
  },
  {
    id: 'demo-notif-lobby-promoted',
    type: 'LOBBY_PROMOTED',
    data: {
      groupId: 'lan-challenger',
      lobbyId: 'lobby-flex-1',
      groupName: 'LAN Challenger S14',
      startsAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    },
    read: true,
    createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(), // Hace 7 horas
  },
  {
    id: 'demo-notif-riot-verified',
    type: 'RIOT_ACCOUNT_VERIFIED',
    data: {
      riotId: 'EduUC#EUW',
      region: 'EUW',
    },
    read: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Hace 1 día
  },
  {
    id: 'demo-notif-riot-paired',
    type: 'RIOT_ACCOUNT_PAIRED',
    data: {
      riotId: 'EduUC#EUW',
      region: 'EUW',
    },
    read: true,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // Hace 2 días
  },
  {
    id: 'demo-notif-feedback-1',
    type: 'FEEDBACK_SUBMITTED',
    data: {
      feedbackId: 'fb-demo-1',
      kind: 'PROPOSAL',
      title: 'Añadir selector de roles preferidos en el balanceo',
    },
    read: true,
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // Hace 3 días
  },
];
