import { LobbyParticipantResponse, LobbyResponse } from './models';

function mockUser(
  index: number,
  name: string,
  options?: Partial<LobbyParticipantResponse>,
): LobbyParticipantResponse {
  const pad = String(index).padStart(2, '0');
  return {
    userId: `u-${pad}`,
    discordUsername: name,
    avatarUrl: null,
    joinedAt: new Date(Date.now() - (50 - index) * 60000).toISOString(),
    isAdded: false,
    isActive: true,
    isHost: index === 1,
    ...options,
  };
}

function makeParticipants(
  names: string[],
  offset = 1,
  defaultOpts?: Partial<LobbyParticipantResponse>,
): LobbyParticipantResponse[] {
  return names.map((name, i) => mockUser(offset + i, name, defaultOpts));
}

const POOL_A = [
  'N1ghtfang', 'Pix3lQueen', 'Cr1msonByte', 'D4rkFl4me', 'V0idWalker',
  'NeonRift', 'GlitchKid', 'St0rmcaller', 'HexHunter', 'AshenWolf',
];

const POOL_B = [
  'LumeCore', 'Zer0Cool', 'ByteSiren', 'Nyx0verdrive', 'R1ftBreaker',
  'SolarFang', 'EchoVanguard', 'AuraWeaver', 'PulseFire', 'NovaStrike',
];

const POOL_BENCH_7 = [
  'IronWill', 'ShadowBlade', 'FrostGrip', 'CyberGhost',
  'MysticDawn', 'ViperStrike', 'ThunderHawk',
];

const POOL_KN_A = [
  'KennenGod', 'NinjaShadow', 'AkaliDuo', 'ZedMaster', 'ShenTank',
  'KassadinLate', 'RivenCombo', 'IreliaDash', 'YasuoWind', 'YoneBlade',
];

const POOL_KN_B_TEAMS: LobbyParticipantResponse[] = [
  mockUser(41, 'JinxRocket', { team: 'BLUE', assignedLane: 'TOP' }),
  mockUser(42, 'CaitlynTrap', { team: 'BLUE', assignedLane: 'JUNGLE' }),
  mockUser(43, 'VayneRoll', { team: 'BLUE', assignedLane: 'MID' }),
  mockUser(44, 'EzrealShift', { team: 'BLUE', assignedLane: 'BOTTOM' }),
  mockUser(45, 'KaiSaVoid', { team: 'BLUE', assignedLane: 'SUPPORT' }),
  mockUser(46, 'ThreshHooker', { team: 'RED', assignedLane: 'TOP' }),
  mockUser(47, 'NautilusAnchor', { team: 'RED', assignedLane: 'JUNGLE' }),
  mockUser(48, 'LeonaStun', { team: 'RED', assignedLane: 'MID' }),
  mockUser(49, 'LuluShield', { team: 'RED', assignedLane: 'BOTTOM' }),
  mockUser(50, 'NamiTide', { team: 'RED', assignedLane: 'SUPPORT' }),
];

const POOL_KN_BENCH = ['BraumShield', 'AatroxDarkin'];

const POOL_LAN_7 = [
  'SalsaKing', 'TacoWarrior', 'AztecSun', 'MayaRift',
  'AndesHero', 'CaribeBreeze', 'PampaRunner',
];

const POOL_CHIRINGUITO_BLUE: LobbyParticipantResponse[] = [
  mockUser(1, 'NexusFounder', { isHost: true, team: 'BLUE', assignedLane: 'TOP' }),
  mockUser(2, 'daxlup', { team: 'BLUE', assignedLane: 'JUNGLE' }),
  mockUser(3, 'IronForged', { team: 'BLUE', assignedLane: 'MID' }),
  mockUser(4, 'BackdoorKing', { team: 'BLUE', assignedLane: 'BOTTOM' }),
  mockUser(5, 'SilverScrapes', { team: 'BLUE', assignedLane: 'SUPPORT' }),
];

const POOL_CHIRINGUITO_RED: LobbyParticipantResponse[] = [
  mockUser(6, 'InsecKick', { team: 'RED', assignedLane: 'TOP' }),
  mockUser(7, 'ElyoyaFan', { team: 'RED', assignedLane: 'JUNGLE' }),
  mockUser(8, 'WardHunter', { team: 'RED', assignedLane: 'MID' }),
  mockUser(9, 'RiftHerald', { team: 'RED', assignedLane: 'BOTTOM' }),
  mockUser(10, 'BaronStealer', { team: 'RED', assignedLane: 'SUPPORT' }),
];

const POOL_CHIRINGUITO_BENCH: LobbyParticipantResponse[] = [
  mockUser(11, 'MinionFarmer'),
  mockUser(12, 'RedBuffEnjoyer'),
  mockUser(13, 'ToxicTroll', { isActive: false }),
];

export const MOCK_GROUP_LOBBIES: Record<string, LobbyResponse[]> = {
  // 1. Escuadron Prueba (00000000-0000-4000-8000-00000000beef):
  //    Contiene estrictamente los dos unicos tipos de lobbie segun FlujoJuego.md:
  //    - PARTY ACTIVA con 27 personas (LIVE):
  //        2 salas simultaneas sincronizadas: Sala A (10) y Sala B (10) = 20 jugando
  //        7 personas en espera en la rotacion con Deuda de rotacion (+1 Deuda) para Tanda 2
  //    - ROOMS (Salas contiguas) con 22 personas (PRU3):
  //        2 salas contiguas: Sala 1 (10) y Sala 2 (10) + 2 suplentes en banquillo
  //    - ROOMS (Sala individual) con 7 personas (SEMI-07):
  //        7 de 10 titulares con huecos libres + 2 suplentes
  '00000000-0000-4000-8000-00000000beef': [
    {
      id: 'mock-lobby-party-live-27',
      groupId: '00000000-0000-4000-8000-00000000beef',
      code: 'PRTY-27',
      mode: 'OPEN',
      status: 'LIVE',
      capacity: 10,
      note: 'Party Activa: 27 personas en rotacion continua · Tanda 1 (20 jugando en Sala A y B, 7 esperan con deuda +1)',
      modality: 'BALANCED',
      distribution: 'PARTY',
      subType: 'PARTY_ROUNDS',
      scraperActive: true,
      matchDurationMinutes: 16,
      openedBy: mockUser(1, 'N1ghtfang', { isHost: true }),
      confirmedSlotId: 'slot-party-live-27',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      slots: [
        {
          id: 'slot-party-live-27',
          startsAt: new Date(Date.now() - 960000).toISOString(),
          signedUp: 27,
          roomName: 'Sala A',
          secondaryRoomName: 'Sala B',
          partyRound: 1,
          starters: makeParticipants(POOL_A, 1),
          secondaryStarters: makeParticipants(POOL_B, 11),
          bench: makeParticipants(POOL_BENCH_7, 21, { rotationDebt: 1, isActive: true }),
        },
      ],
    },
    {
      id: 'mock-pru3-contiguous',
      groupId: '00000000-0000-4000-8000-00000000beef',
      code: 'PRU3',
      mode: 'OPEN',
      status: 'CONFIRMED',
      capacity: 10,
      note: '¡22 inscritos! 2 salas contiguas de 10 + 2 suplentes en banquillo (FIFO).',
      modality: 'BALANCED',
      distribution: 'ROOMS',
      subType: 'CONTIGUOUS_ROOMS',
      scraperActive: true,
      openedBy: mockUser(1, 'N1ghtfang', { isHost: true }),
      confirmedSlotId: 'slot-pru3-1',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      slots: [
        {
          id: 'slot-pru3-1',
          startsAt: new Date(Date.now() + 86400000 + 7200000).toISOString(),
          signedUp: 22,
          roomName: 'Sala 1',
          secondaryRoomName: 'Sala 2',
          starters: makeParticipants(POOL_A, 1),
          secondaryStarters: makeParticipants(POOL_B, 11),
          bench: makeParticipants(['IronWill', 'ShadowBlade'], 21),
        },
      ],
    },
    {
      id: 'mock-lobby-individual-semi',
      groupId: '00000000-0000-4000-8000-00000000beef',
      code: 'SEMI-07',
      mode: 'OPEN',
      status: 'CONFIRMED',
      capacity: 10,
      note: 'Custom Equilibrada: 7 inscritos y 3 huecos libres',
      modality: 'BALANCED',
      distribution: 'ROOMS',
      subType: 'STANDARD',
      scraperActive: true,
      openedBy: mockUser(1, 'N1ghtfang', { isHost: true }),
      confirmedSlotId: 'slot-semi-1',
      createdAt: new Date(Date.now() - 900000).toISOString(),
      slots: [
        {
          id: 'slot-semi-1',
          startsAt: new Date(Date.now() + 86400000 + 14400000).toISOString(),
          signedUp: 7,
          starters: [
            mockUser(1, 'N1ghtfang', { isHost: true }),
            mockUser(2, 'Pix3lQueen', { isAdded: false }),
            mockUser(3, 'Cr1msonByte', { isAdded: true }),
            mockUser(4, 'D4rkFl4me', { isAdded: false }),
            mockUser(5, 'V0idWalker', { isAdded: true }),
            mockUser(6, 'NeonRift', { isAdded: false }),
            mockUser(7, 'GlitchKid', { isAdded: false }),
          ],
          bench: [
            mockUser(8, 'St0rmcaller', { isActive: true }),
            mockUser(9, 'HexHunter', { isActive: false }),
          ],
        },
      ],
    },
  ],

  // 2. LAN Challenger: Rooms con 23 personas (2 salas contiguas + 3 suplentes FIFO)
  'lan-challenger': [
    {
      id: 'mock-lobby-contiguous',
      groupId: 'lan-challenger',
      code: 'CTGU-23',
      mode: 'OPEN',
      status: 'CONFIRMED',
      capacity: 10,
      note: 'Aduana LAN: 23 jugadores registrados en 2 salas contiguas (FIFO)',
      modality: 'COMPETITIVE',
      distribution: 'ROOMS',
      subType: 'CONTIGUOUS_ROOMS',
      scraperActive: true,
      openedBy: mockUser(1, 'N1ghtfang', { isHost: true }),
      confirmedSlotId: 'slot-ctgu-1',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      slots: [
        {
          id: 'slot-ctgu-1',
          startsAt: new Date(Date.now() + 600000).toISOString(),
          signedUp: 23,
          roomName: 'Sala 1',
          secondaryRoomName: 'Sala 2',
          starters: makeParticipants(POOL_A, 1),
          secondaryStarters: makeParticipants(POOL_B, 11),
          bench: makeParticipants(['IronWill', 'ShadowBlade', 'FrostGrip'], 21),
        },
      ],
    },
    {
      id: 'mock-lobby-contiguous-sched',
      groupId: 'lan-challenger',
      code: 'CTGU-SC',
      mode: 'OPEN',
      status: 'POLLING',
      capacity: 10,
      note: 'Quedada del domingo',
      modality: 'BALANCED',
      distribution: 'ROOMS',
      subType: 'STANDARD',
      scraperActive: false,
      openedBy: mockUser(3, 'Cr1msonByte'),
      confirmedSlotId: null,
      createdAt: new Date().toISOString(),
      slots: [
        {
          id: 'slot-ctgu-p1',
          startsAt: new Date(Date.now() + 172800000).toISOString(),
          signedUp: 7,
          starters: makeParticipants(POOL_A.slice(0, 7), 1),
          bench: [],
        },
      ],
    },
  ],

  // 3. Scrim Squad: Party activa con 27 personas
  'scrim-squad': [
    {
      id: 'mock-lobby-party-scrim-27',
      groupId: 'scrim-squad',
      code: 'PRTY-SS',
      mode: 'OPEN',
      status: 'LIVE',
      capacity: 10,
      note: 'Party Scrims: 27 personas en rotacion continua · Tanda 1 (20 jugando, 7 en rotacion con deuda)',
      modality: 'COMPETITIVE',
      distribution: 'PARTY',
      subType: 'PARTY_ROUNDS',
      scraperActive: true,
      matchDurationMinutes: 22,
      openedBy: mockUser(1, 'N1ghtfang', { isHost: true }),
      confirmedSlotId: 'slot-party-scrim-1',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      slots: [
        {
          id: 'slot-party-scrim-1',
          startsAt: new Date(Date.now() - 1320000).toISOString(),
          signedUp: 27,
          roomName: 'Sala A',
          secondaryRoomName: 'Sala B',
          partyRound: 1,
          starters: makeParticipants(POOL_A, 1),
          secondaryStarters: makeParticipants(POOL_B, 11),
          bench: makeParticipants(POOL_BENCH_7, 21, { rotationDebt: 1, isActive: true }),
        },
      ],
    },
  ],

  // 4. Arcane Five: Rooms con 10 personas (Sala en juego)
  'arcane-five': [
    {
      id: 'mock-lobby-arcane-rooms',
      groupId: 'arcane-five',
      code: 'ROOM-10',
      mode: 'OPEN',
      status: 'LIVE',
      capacity: 10,
      note: 'Torneo Arcane: Sala 1 en juego (minuto 18)',
      modality: 'COMPETITIVE',
      distribution: 'ROOMS',
      subType: 'STANDARD',
      scraperActive: true,
      matchDurationMinutes: 18,
      openedBy: mockUser(1, 'N1ghtfang', { isHost: true }),
      confirmedSlotId: 'slot-arcane-1',
      createdAt: new Date(Date.now() - 2400000).toISOString(),
      slots: [
        {
          id: 'slot-arcane-1',
          startsAt: new Date(Date.now() - 1200000).toISOString(),
          signedUp: 10,
          roomName: 'Sala 1',
          starters: makeParticipants(POOL_A, 1),
          bench: [],
        },
      ],
    },
  ],

  // 5. Night Owls: Sin salas activas (vacio)
  'night-owls': [],

  // 6. kn: Salas contiguas con 22 personas (2 salas de 10 + 2 suplentes) · Modalidad Competitivo
  '40afe774-3c27-4efa-8049-910f7ee3a453': [
    {
      id: 'mock-lobby-kn-22',
      groupId: '40afe774-3c27-4efa-8049-910f7ee3a453',
      code: 'KN22',
      mode: 'OPEN',
      status: 'CONFIRMED',
      capacity: 10,
      note: 'Salas contiguas · Modalidad Competitivo · Sala 2 con equipos generados',
      modality: 'COMPETITIVE',
      distribution: 'ROOMS',
      subType: 'CONTIGUOUS_ROOMS',
      scraperActive: true,
      openedBy: mockUser(31, 'KennenGod', { isHost: true }),
      confirmedSlotId: 'slot-kn-22',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      slots: [
        {
          id: 'slot-kn-22',
          startsAt: new Date(Date.now() + 600000).toISOString(),
          signedUp: 22,
          roomName: 'Sala 1',
          secondaryRoomName: 'Sala 2',
          starters: makeParticipants(POOL_KN_A, 31),
          secondaryStarters: POOL_KN_B_TEAMS,
          bench: makeParticipants(POOL_KN_BENCH, 51),
        },
      ],
    },
    {
      id: 'mock-lobby-kn-party-23',
      groupId: '40afe774-3c27-4efa-8049-910f7ee3a453',
      code: 'PRTY-KN23',
      mode: 'OPEN',
      status: 'CONFIRMED',
      capacity: 10,
      note: 'Party de la comunidad KN: 23 personas inscritas en rotación continua',
      modality: 'BALANCED',
      distribution: 'PARTY',
      subType: 'PARTY_POOL',
      scraperActive: false,
      openedBy: mockUser(31, 'KennenGod', { isHost: true }),
      confirmedSlotId: 'slot-kn-party-23',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      slots: [
        {
          id: 'slot-kn-party-23',
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          signedUp: 23,
          roomName: 'Party KN',
          starters: makeParticipants(POOL_KN_A, 31),
          secondaryStarters: POOL_KN_B_TEAMS,
          bench: makeParticipants(['BraumShield', 'AatroxDarkin', 'ZedShadow'], 51, { rotationDebt: 1, isActive: true }),
        },
      ],
    },
    {
      id: 'mock-lobby-kn-polling',
      groupId: '40afe774-3c27-4efa-8049-910f7ee3a453',
      code: 'POLL-KN',
      mode: 'OPEN',
      status: 'POLLING',
      capacity: 10,
      note: 'Votación de horario semanal KN',
      modality: 'COMPETITIVE',
      distribution: 'ROOMS',
      subType: 'STANDARD',
      scraperActive: false,
      openedBy: mockUser(32, 'NinjaShadow'),
      confirmedSlotId: null,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      slots: [
        {
          id: 'slot-kn-poll-1',
          startsAt: new Date(Date.now() + 172800000).toISOString(),
          signedUp: 8,
          starters: makeParticipants(POOL_KN_A.slice(0, 8), 31),
          bench: [],
        },
        {
          id: 'slot-kn-poll-2',
          startsAt: new Date(Date.now() + 172800000 + 3600000).toISOString(),
          signedUp: 5,
          starters: makeParticipants(POOL_KN_A.slice(0, 5), 31),
          bench: [],
        },
      ],
    },
  ],
  'kn': [
    {
      id: 'mock-lobby-kn-22-alias',
      groupId: 'kn',
      code: 'KN22',
      mode: 'OPEN',
      status: 'CONFIRMED',
      capacity: 10,
      note: 'Salas contiguas · Modalidad Competitivo · Sala 2 con equipos generados',
      modality: 'COMPETITIVE',
      distribution: 'ROOMS',
      subType: 'CONTIGUOUS_ROOMS',
      scraperActive: true,
      openedBy: mockUser(31, 'KennenGod', { isHost: true }),
      confirmedSlotId: 'slot-kn-22-alias',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      slots: [
        {
          id: 'slot-kn-22-alias',
          startsAt: new Date(Date.now() + 600000).toISOString(),
          signedUp: 22,
          roomName: 'Sala 1',
          secondaryRoomName: 'Sala 2',
          starters: makeParticipants(POOL_KN_A, 31),
          secondaryStarters: POOL_KN_B_TEAMS,
          bench: makeParticipants(POOL_KN_BENCH, 51),
        },
      ],
    },
    {
      id: 'mock-lobby-kn-party-23-alias',
      groupId: 'kn',
      code: 'PRTY-KN23',
      mode: 'OPEN',
      status: 'CONFIRMED',
      capacity: 10,
      note: 'Party de la comunidad KN: 23 personas inscritas en rotación continua',
      modality: 'BALANCED',
      distribution: 'PARTY',
      subType: 'PARTY_POOL',
      scraperActive: false,
      openedBy: mockUser(31, 'KennenGod', { isHost: true }),
      confirmedSlotId: 'slot-kn-party-23-alias',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      slots: [
        {
          id: 'slot-kn-party-23-alias',
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          signedUp: 23,
          roomName: 'Party KN',
          starters: makeParticipants(POOL_KN_A, 31),
          secondaryStarters: POOL_KN_B_TEAMS,
          bench: makeParticipants(['BraumShield', 'AatroxDarkin', 'ZedShadow'], 51, { rotationDebt: 1, isActive: true }),
        },
      ],
    },
    {
      id: 'mock-lobby-kn-polling-alias',
      groupId: 'kn',
      code: 'POLL-KN',
      mode: 'OPEN',
      status: 'POLLING',
      capacity: 10,
      note: 'Votación de horario semanal KN',
      modality: 'COMPETITIVE',
      distribution: 'ROOMS',
      subType: 'STANDARD',
      scraperActive: false,
      openedBy: mockUser(32, 'NinjaShadow'),
      confirmedSlotId: null,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      slots: [
        {
          id: 'slot-kn-poll-1-alias',
          startsAt: new Date(Date.now() + 172800000).toISOString(),
          signedUp: 8,
          starters: makeParticipants(POOL_KN_A.slice(0, 8), 31),
          bench: [],
        },
        {
          id: 'slot-kn-poll-2-alias',
          startsAt: new Date(Date.now() + 172800000 + 3600000).toISOString(),
          signedUp: 5,
          starters: makeParticipants(POOL_KN_A.slice(0, 5), 31),
          bench: [],
        },
      ],
    },
  ],

  // 7. LAN: Sala estándar 7/10 con huecos libres para entrar · Modalidad Caos
  '84ffd0e4-48d4-41b1-a60f-fefb46a96257': [
    {
      id: 'mock-lobby-lan-7',
      groupId: '84ffd0e4-48d4-41b1-a60f-fefb46a96257',
      code: 'LAN7',
      mode: 'OPEN',
      status: 'CONFIRMED',
      capacity: 10,
      note: 'Custom LAN · Modalidad Caos · 7/10 plazas cubiertas, faltan 3 para empezar',
      modality: 'CHAOS',
      distribution: 'ROOMS',
      subType: 'STANDARD',
      scraperActive: true,
      openedBy: mockUser(53, 'SalsaKing', { isHost: true }),
      confirmedSlotId: 'slot-lan-7',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      slots: [
        {
          id: 'slot-lan-7',
          startsAt: new Date(Date.now() + 600000).toISOString(),
          signedUp: 7,
          roomName: 'Sala 1',
          starters: makeParticipants(POOL_LAN_7, 53),
          bench: [],
        },
      ],
    },
  ],
  'lan': [
    {
      id: 'mock-lobby-lan-7-alias',
      groupId: 'lan',
      code: 'LAN7',
      mode: 'OPEN',
      status: 'CONFIRMED',
      capacity: 10,
      note: 'Custom LAN · Modalidad Caos · 7/10 plazas cubiertas, faltan 3 para empezar',
      modality: 'CHAOS',
      distribution: 'ROOMS',
      subType: 'STANDARD',
      scraperActive: true,
      openedBy: mockUser(53, 'SalsaKing', { isHost: true }),
      confirmedSlotId: 'slot-lan-7-alias',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
      slots: [
        {
          id: 'slot-lan-7-alias',
          startsAt: new Date(Date.now() + 600000).toISOString(),
          signedUp: 7,
          roomName: 'Sala 1',
          starters: makeParticipants(POOL_LAN_7, 53),
          bench: [],
        },
      ],
    },
  ],

  // 8. Chiringuito Chatarra: Equipos formados por el host (5v5 Azul vs Rojo)
  'a0000000-0000-0000-0000-000000000001': [
    {
      id: 'd0000000-0000-4000-8000-000000000001',
      groupId: 'a0000000-0000-0000-0000-000000000001',
      code: 'CUST',
      mode: 'OPEN',
      status: 'CONFIRMED',
      capacity: 10,
      note: 'Custom de los jueves · Equipos formados (5v5 Azul vs Rojo)',
      modality: 'BALANCED',
      distribution: 'ROOMS',
      subType: 'TEAMS_GENERATED',
      scraperActive: true,
      openedBy: POOL_CHIRINGUITO_BLUE[0],
      confirmedSlotId: 'd1000000-0000-4000-8000-000000000001',
      createdAt: new Date(Date.now() - 5400000).toISOString(),
      slots: [
        {
          id: 'd1000000-0000-4000-8000-000000000001',
          startsAt: new Date(Date.now() + 1200000).toISOString(),
          signedUp: 13,
          roomName: 'Sala 1',
          starters: [...POOL_CHIRINGUITO_BLUE, ...POOL_CHIRINGUITO_RED],
          bench: POOL_CHIRINGUITO_BENCH,
        },
      ],
    },
  ],
  'chiringuito-chatarra': [
    {
      id: 'mock-lobby-cust-alias',
      groupId: 'chiringuito-chatarra',
      code: 'CUST',
      mode: 'OPEN',
      status: 'CONFIRMED',
      capacity: 10,
      note: 'Custom de los jueves · Equipos formados (5v5 Azul vs Rojo)',
      modality: 'BALANCED',
      distribution: 'ROOMS',
      subType: 'TEAMS_GENERATED',
      scraperActive: true,
      openedBy: POOL_CHIRINGUITO_BLUE[0],
      confirmedSlotId: 'slot-cust-alias',
      createdAt: new Date(Date.now() - 5400000).toISOString(),
      slots: [
        {
          id: 'slot-cust-alias',
          startsAt: new Date(Date.now() + 1200000).toISOString(),
          signedUp: 13,
          roomName: 'Sala 1',
          starters: [...POOL_CHIRINGUITO_BLUE, ...POOL_CHIRINGUITO_RED],
          bench: POOL_CHIRINGUITO_BENCH,
        },
      ],
    },
  ],
};

MOCK_GROUP_LOBBIES['escuadron-prueba'] = MOCK_GROUP_LOBBIES['00000000-0000-4000-8000-00000000beef'];

export function findMockLobbyById(lobbyId: string): LobbyResponse | null {
  for (const list of Object.values(MOCK_GROUP_LOBBIES)) {
    const found = list.find((l) => l.id === lobbyId);
    if (found) return found;
  }
  return null;
}
