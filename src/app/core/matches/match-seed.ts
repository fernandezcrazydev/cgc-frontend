/**
 * SEMILLA DE DESARROLLO DEL HISTORIAL — FICHERO CONDENADO.
 *
 * BACKEND NOTE: esto existe SOLO para poder ver y validar en pantalla el historial, el cruce,
 * el versus y la sinergia mientras el backend no tiene módulo `matches`. Hoy
 * `MatchHistoryStore.allMatches` arranca vacío, así que esas cinco vistas pintan su estado
 * vacío y no hay nada que rediseñar.
 *
 * **Fecha de muerte: el día que exista `GET /api/v1/matches`.** Entonces se borra este fichero
 * ENTERO —generador y datos— junto con su única línea de carga en `app.config.ts`, y el store
 * pasa al patrón `Session`. No se refactoriza, no se extrae a un servicio, no se le añaden
 * tests: es la categoría *Placeholder* de `CLAUDE.md`, y todo lo que se invierta aquí se tira.
 *
 * Nunca entra en producción: `app.config.ts` solo lo carga si `!environment.production`.
 *
 * Reglas que sí respeta, porque si no no serviría para validar nada:
 * - **Determinista**: sin `Math.random()` ni `Date.now()`. Todo sale de `hash()` sobre claves
 *   estables, así que dos recargas enseñan exactamente la misma partida.
 * - **Autoconsistente**: las muertes de un equipo suman los asesinatos del contrario, el
 *   porcentaje de daño sale del daño real del equipo, y quien gana la línea es quien lleva más
 *   oro en el minuto 14. Una tabla que no cuadra se nota, y entonces el rediseño se valida
 *   contra datos que nadie se cree.
 * - **No inventa identidad de juego**: el `championName` es solo un texto de respaldo para
 *   cuando el catálogo de `GameDataStore` no está cargado; el nombre y el icono reales los
 *   resuelve siempre el catálogo por `championId`.
 */
import { EnvironmentInjector } from '@angular/core';
import { hash } from '../group-ranking';
import { groupModalitiesConfig, MODALITY_LABELS, StatModality } from '../group-stats';
import { CURRENT_USER, GROUPS, MOCK_NAMES, REAL_CHAMPION_IDS } from '../lobby';
import { MatchHistoryStore } from './match-history-store';
import {
  DragonType,
  GroupContext,
  Lane,
  Match,
  MatchGameMode,
  MatchItemSlot,
  MatchLobbyType,
  MatchParticipant,
  ParticipantStats,
  TeamSide,
  TeamSummary,
} from './models';

/** Región del elenco. Coincide con la del roster mock para que el cruce resuelva identidades. */
const REGION = 'LAN';

/** Las cinco posiciones, en el orden en que se lee un marcador. */
const LANES: readonly Lane[] = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'];

/** Catálogo de objetos reales de League of Legends (DataDragon 14.24.1) por posición */
interface ItemDef {
  id: number;
  name: string;
  iconUrl?: string;
}

const ITEMS_BY_LANE: Record<Lane, ItemDef[]> = {
  TOP: [
    { id: 3078, name: 'Fuerza de la Trinidad' },
    { id: 3053, name: 'Guantelete de Sterak' },
    { id: 3071, name: 'Cuchilla Negra' },
    { id: 3047, name: 'Punteras de Acero' },
    { id: 6333, name: 'Danza de la Muerte' },
    { id: 3026, name: 'Ángel de la Guarda' },
    { id: 3340, name: 'Guardián Invisible' },
    {
      id: 1221,
      name: 'Teleport Mejorado (Misión)',
      iconUrl: 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/rolequest_topreward1_complete.png',
    },
  ],
  JUNGLA: [
    { id: 6692, name: 'Eclipse' },
    { id: 3142, name: 'Filo Fantasma de Youmuu' },
    { id: 6694, name: 'Rencor de Serylda' },
    { id: 3158, name: 'Botas Jonias de Lucidez' },
    { id: 3814, name: 'Filo de la Noche' },
    { id: 3026, name: 'Ángel de la Guarda' },
    { id: 3364, name: 'Lente del Oráculo' },
    {
      id: 1102,
      name: 'Caminavientos (Misión)',
      iconUrl: 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/1102_buff.png',
    },
  ],
  MID: [
    { id: 6655, name: 'Compañero de Luden' },
    { id: 4645, name: 'Llama Sombría' },
    { id: 3157, name: 'Reloj de Arena de Zhonya' },
    { id: 3089, name: 'Sombrero Mortal de Rabadon' },
    { id: 3135, name: 'Bastón del Vacío' },
    { id: 4629, name: 'Impulso Cósmico' },
    { id: 3340, name: 'Guardián Invisible' },
    {
      id: 3013,
      name: 'Almas en sincronía (Botas mejoradas)',
      iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3013.png',
    },
  ],
  ADC: [
    { id: 6672, name: 'Verdugo de Krakens' },
    { id: 3031, name: 'Filo Infinito' },
    { id: 3036, name: 'Recuerdos de Lord Dominik' },
    { id: 3072, name: 'Sanguinaria' },
    { id: 3094, name: 'Cañón de Fuego Rápido' },
    { id: 3026, name: 'Ángel de la Guarda' },
    { id: 3363, name: 'Alteración de Lejanía' },
    {
      id: 3006,
      name: 'Grebas de Berserker (Misión)',
      iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3006.png',
    },
  ],
  SUPPORT: [
    { id: 3869, name: 'Oposición Celestial' },
    { id: 2065, name: 'Canto de Guerra de Shurelya' },
    { id: 3190, name: 'Relicario de los Solari de Hierro' },
    { id: 3107, name: 'Redención' },
    { id: 3158, name: 'Botas Jonias de Lucidez' },
    { id: 3109, name: 'Promesa del Caballero' },
    { id: 3364, name: 'Lente del Oráculo' },
    {
      id: 2055,
      name: 'Guardián de Control (Misión)',
      iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/2055.png',
    },
  ],
};

const ALT_ITEMS_BY_LANE: Record<Lane, ItemDef[]> = {
  TOP: [
    { id: 6631, name: 'Sanguinario' },
    { id: 3748, name: 'Hidra Titánica' },
    { id: 3065, name: 'Velo de la Bruja Negra' },
    { id: 3742, name: 'Placa del Muerto' },
    { id: 3153, name: 'Hoja del Rey Arruinado' },
  ],
  JUNGLA: [
    { id: 6676, name: 'El Coleccionista' },
    { id: 3071, name: 'Cuchilla Negra' },
    { id: 6609, name: 'Cimitarra Chempunk' },
    { id: 6333, name: 'Danza de la Muerte' },
    { id: 3036, name: 'Recuerdos de Lord Dominik' },
  ],
  MID: [
    { id: 3165, name: 'Morellonomicón' },
    { id: 6653, name: 'Ira de Liandry' },
    { id: 3116, name: 'Cetro de Cristal de Rylai' },
    { id: 4628, name: 'Antorcha Torcida' },
    { id: 3152, name: 'Impulsor Hextech' },
  ],
  ADC: [
    { id: 6673, name: 'Susurro Inmortal' },
    { id: 6675, name: 'Hojas Rápidas de Navori' },
    { id: 3046, name: 'Danzarín Fantasma' },
    { id: 6676, name: 'El Coleccionista' },
    { id: 3033, name: 'Recordatorio Mortal' },
  ],
  SUPPORT: [
    { id: 3504, name: 'Incensario Ardiente' },
    { id: 6617, name: 'Reliquia de la Luna Naciente' },
    { id: 3222, name: 'Bendición de Mikael' },
    { id: 4005, name: 'Mandato Imperial' },
    { id: 3011, name: 'Purificador Quimiotecnológico' },
  ],
};

function generateItems(
  role: Lane,
  seed: string,
  spells: number[] = [4, 12],
  smiteVariant?: 'blue' | 'red' | 'green' | 'unevolved',
): (MatchItemSlot | null)[] {
  const basePool = (ITEMS_BY_LANE[role] ?? ITEMS_BY_LANE.MID).slice(0, 6);
  const altPool = ALT_ITEMS_BY_LANE[role] ?? ALT_ITEMS_BY_LANE.MID;
  const candidates = [...basePool, ...altPool];
  const chosen = candidates
    .slice()
    .sort((a, b) => hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`))
    .slice(0, 6);

  const items: (MatchItemSlot | null)[] = chosen.map((item) => ({
    id: item.id,
    name: item.name,
    iconUrl: item.iconUrl ?? `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/${item.id}.png`,
    gold: 3000,
  }));

  const baseFull = ITEMS_BY_LANE[role] ?? ITEMS_BY_LANE.MID;
  items[6] = baseFull[6]
    ? {
        id: baseFull[6].id,
        name: baseFull[6].name,
        iconUrl: baseFull[6].iconUrl ?? `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/${baseFull[6].id}.png`,
        gold: 0,
      }
    : null;

  if (role === 'TOP') {
    const hasTeleport = spells.includes(12);
    items[7] = hasTeleport
      ? {
          id: 1221,
          name: 'Teleport Mejorado (Misión)',
          iconUrl: 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/rolequest_topreward1_complete.png',
          gold: 0,
        }
      : {
          id: 12,
          name: 'Teleportar (Misión)',
          iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/spell/SummonerTeleport.png',
          gold: 0,
        };
  } else if (role === 'JUNGLA') {
    const companionMap: Record<'blue' | 'red' | 'green', { id: number; name: string; iconUrl: string }> = {
      blue: {
        id: 1102,
        name: 'Caminavientos (Misión)',
        iconUrl: 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/1102_buff.png',
      },
      red: {
        id: 1101,
        name: 'Garramélica (Misión)',
        iconUrl: 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/1101_buff.png',
      },
      green: {
        id: 1103,
        name: 'Brincamusgo (Misión)',
        iconUrl: 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/1103_buff.png',
      },
    };
    const key = smiteVariant === 'red' || smiteVariant === 'green' || smiteVariant === 'blue' ? smiteVariant : 'blue';
    const comp = companionMap[key];
    items[7] = {
      id: comp.id,
      name: comp.name,
      iconUrl: comp.iconUrl,
      gold: 0,
    };
  } else if (role === 'MID' || role === 'ADC' || role === 'SUPPORT') {
    items[7] = baseFull[7]
      ? {
          id: baseFull[7].id,
          name: baseFull[7].name,
          iconUrl: baseFull[7].iconUrl ?? `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/${baseFull[7].id}.png`,
          gold: 0,
        }
      : null;
  }

  return items;
}

/** Segundo hechizo por posición; el primero es siempre Destello (4). Ids reales de ddragon. */
const SECOND_SPELL: Record<Lane, number> = {
  TOP: 12,
  JUNGLA: 11,
  MID: 14,
  ADC: 7,
  SUPPORT: 3,
};

/** Runa clave principal y árbol secundario por posición. Ids reales de Data Dragon / Community Dragon. */
const RUNES_BY_LANE: Record<
  Lane,
  { primaryTreeId: number; primaries: number[]; secondaryTree: number }
> = {
  TOP: { primaryTreeId: 8400, primaries: [8437, 8439, 8465], secondaryTree: 8000 },
  JUNGLA: { primaryTreeId: 8000, primaries: [8010, 8005, 8021], secondaryTree: 8300 },
  MID: { primaryTreeId: 8100, primaries: [8112, 8128, 9923], secondaryTree: 8200 },
  ADC: { primaryTreeId: 8000, primaries: [8008, 8005, 8021], secondaryTree: 8300 },
  SUPPORT: { primaryTreeId: 8400, primaries: [8465, 8439, 8214], secondaryTree: 8300 },
};

const RUNES_BY_TREE: Record<number, number[][]> = {
  8100: [
    [8126, 8139, 8143],
    [8136, 8120, 8138],
    [8135, 8134, 8105, 8106],
  ],
  8000: [
    [8009, 9101, 9111],
    [9104, 9105, 9103],
    [8014, 8017, 8299],
  ],
  8200: [
    [8224, 8226, 8275],
    [8210, 8234, 8233],
    [8237, 8232, 8236],
  ],
  8300: [
    [8306, 8304, 8321],
    [8313, 8352, 8345],
    [8347, 8410, 8316],
  ],
  8400: [
    [8446, 8463, 8401],
    [8429, 8444, 8473],
    [8451, 8453, 8242],
  ],
};

const STAT_SHARD_ROWS: number[][] = [
  [5008, 5005, 5007],
  [5008, 5010, 5001],
  [5011, 5013, 5001],
];

/**
 * Variantes de Smite para junglas:
 * - 1102: Smite Azul (Gustwalker / Caminavientos)
 * - 1101: Smite Rojo (Scorchclaw / Garramélica)
 * - 1103: Smite Verde (Mosshoof / Brincamusgo)
 * - 11: Smite clásico sin evolucionar
 */
function pickJungleSmite(seed: string, minutes: number): { spellId: number; variant: 'blue' | 'red' | 'green' | 'unevolved' } {
  if (minutes < 16 || hash(`${seed}:smite_evo`) % 8 === 0) {
    return { spellId: 11, variant: 'unevolved' };
  }
  const choices: { spellId: number; variant: 'blue' | 'red' | 'green' }[] = [
    { spellId: 1102, variant: 'blue' },
    { spellId: 1101, variant: 'red' },
    { spellId: 1103, variant: 'green' },
  ];
  return choices[hash(`${seed}:smite_pick`) % choices.length];
}

/**
 * Los nueve compañeros de reparto. Salen de `MOCK_NAMES` para que sus tags coincidan con el
 * roster mock de los grupos: así el cara a cara resuelve nombre, iniciales y color por roster,
 * y los enlaces desde el perfil de miembro caen en un jugador que existe.
 */
const CAST = MOCK_NAMES.slice(0, 9);

/** Cuántas partidas. Suficientes para que paginación, filtros y medias digan algo. */
const MATCH_COUNT = 40;

/** Ancla temporal fija (24 de agosto de 2026, 21:00 UTC). Constante, nunca "ahora". */
const BASE_MS = Date.UTC(2026, 7, 24, 21, 0, 0);
const DAY_MS = 86_400_000;

/** El grupo al que se atribuyen: el primero del mock, con su identidad visual. */
const GROUP: GroupContext = {
  id: GROUPS[0].id,
  name: GROUPS[0].name,
  tag: GROUPS[0].tag,
  initials: GROUPS[0].initials,
  color1: GROUPS[0].c1,
  color2: GROUPS[0].c2,
  seasonName: GROUPS[0].leagueName,
};

// ── Utilidades deterministas ────────────────────────────────────────────────

/** Un entero estable en `[min, max]` a partir de una clave. */
function between(seed: string, min: number, max: number): number {
  return min + (hash(seed) % (max - min + 1));
}

/** Un elemento estable de una lista. */
function pick<T>(seed: string, list: readonly T[]): T {
  return list[hash(seed) % list.length];
}

function other(side: TeamSide): TeamSide {
  return side === 'blue' ? 'red' : 'blue';
}

/**
 * Reparte `total` entre tantas casillas como claves haya, con pesos estables y sin perder ni
 * inventar unidades. Es lo que hace que las muertes de un equipo sumen exactamente los
 * asesinatos del contrario.
 */
function distribute(total: number, seeds: readonly string[]): number[] {
  const weights = seeds.map((s) => 1 + (hash(s) % 5));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const out = weights.map((w) => Math.floor((total * w) / weightSum));
  let rest = total - out.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0; i = (i + 1) % out.length, rest--) out[i]++;
  return out;
}

// ── Construcción ────────────────────────────────────────────────────────────

/** Un participante a medio hacer: le faltan las muertes y el reparto de daño del equipo. */
interface Draft {
  participant: MatchParticipant;
  kills: number;
}

function draftParticipant(args: {
  matchId: string;
  riotId: string;
  team: TeamSide;
  role: Lane;
  won: boolean;
  minutes: number;
  userId?: string | null;
}): Draft {
  const { matchId, riotId, team, role, won, minutes, userId } = args;
  const s = `${matchId}:${riotId}`;

  const championId = pick(`${s}:champ`, REAL_CHAMPION_IDS);
  const kills = between(`${s}:k`, won ? 2 : 0, won ? 16 : 11);
  const assists = between(`${s}:a`, role === 'SUPPORT' ? 6 : 1, role === 'SUPPORT' ? 24 : 18);
  const cs = role === 'SUPPORT' ? between(`${s}:cs`, 18, 70) : between(`${s}:cs`, 115, 295);
  const csAt14 = Math.round(cs * between(`${s}:cs14`, 34, 42) / 100);
  const goldAt14 = 3200 + csAt14 * 21 + kills * 180 + between(`${s}:g14`, 0, 600);

  const stats: ParticipantStats = {
    kills,
    // Se rellena en `settleTeam`: debe cuadrar con los asesinatos del equipo rival.
    deaths: 0,
    assists,
    cs,
    csPerMin: +(cs / minutes).toFixed(1),
    gold: 7800 + cs * 22 + kills * 320 + assists * 95,
    totalDamageToChampions:
      role === 'SUPPORT' ? between(`${s}:dmg`, 6000, 18000) : between(`${s}:dmg`, 14000, 44000),
    // Se rellena en `settleTeam`: es una cuota del daño real del equipo, no un número suelto.
    damageSharePercentage: 0,
    damageTaken:
      role === 'TOP' ? between(`${s}:tank`, 24000, 48000) : between(`${s}:tank`, 9000, 30000),
    visionScore: role === 'SUPPORT' ? between(`${s}:vs`, 30, 78) : between(`${s}:vs`, 8, 34),
    wardsPlaced: role === 'SUPPORT' ? between(`${s}:wp`, 14, 34) : between(`${s}:wp`, 3, 14),
    wardsKilled: between(`${s}:wk`, 0, 11),
    ...(() => {
      let secondSpell = SECOND_SPELL[role];
      let smiteVariant: 'blue' | 'red' | 'green' | 'unevolved' | undefined;

      if (role === 'JUNGLA') {
        const smite = pickJungleSmite(s, minutes);
        secondSpell = smite.spellId;
        smiteVariant = smite.variant;
      } else if (role === 'TOP') {
        const topRoll = hash(`${s}:top_spell`) % 10;
        if (topRoll === 0) {
          secondSpell = 14;
        } else if (topRoll === 1) {
          secondSpell = 6;
        } else {
          secondSpell = 12;
        }
      }

      const spells: [number, number] = [4, secondSpell];
      return {
        items: generateItems(role, s, spells, smiteVariant),
        spells,
        smiteVariant,
      };
    })(),
    ...(() => {
      const runeCfg = RUNES_BY_LANE[role];
      const primaryKeystone = pick(`${s}:rune`, runeCfg.primaries);
      const primaryRows = RUNES_BY_TREE[runeCfg.primaryTreeId];
      const primaryRuneIds = [
        pick(`${s}:p_r0`, primaryRows[0]),
        pick(`${s}:p_r1`, primaryRows[1]),
        pick(`${s}:p_r2`, primaryRows[2]),
      ];

      const secRows = RUNES_BY_TREE[runeCfg.secondaryTree];
      const secRowPairChoice = hash(`${s}:sec_rows`) % 3;
      const [rA, rB] = secRowPairChoice === 0 ? [0, 1] : secRowPairChoice === 1 ? [0, 2] : [1, 2];
      const secondaryRuneIds = [
        pick(`${s}:s_rA`, secRows[rA]),
        pick(`${s}:s_rB`, secRows[rB]),
      ];

      const statShardIds = [
        pick(`${s}:shard_0`, STAT_SHARD_ROWS[0]),
        pick(`${s}:shard_1`, STAT_SHARD_ROWS[1]),
        pick(`${s}:shard_2`, STAT_SHARD_ROWS[2]),
      ];

      return {
        primaryRuneId: primaryKeystone,
        secondaryRuneTreeId: runeCfg.secondaryTree,
        primaryTreeId: runeCfg.primaryTreeId,
        primaryRuneIds,
        secondaryRuneIds,
        statShardIds,
      };
    })(),
    goldAt14,
    csAt14,
  };

  const participant: MatchParticipant = {
    id: `${matchId}-${team}-${role}`,
    userId: userId ?? null,
    riotId,
    isGuest: false,
    team,
    role,
    championId,
    // Solo respaldo: el nombre e icono reales los resuelve `GameDataStore.championById()`.
    championName: `Campeón ${championId}`,
    championLevel: between(`${s}:lvl`, 13, 18),
    wasAutofill: hash(`${s}:fill`) % 9 === 0,
    lpDelta: won ? between(`${s}:lp`, 16, 29) : -between(`${s}:lp`, 11, 23),
    stats,
  };

  return { participant, kills };
}

/**
 * Cierra un equipo: reparte las muertes que le corresponden (los asesinatos del rival) y
 * convierte el daño de cada uno en su cuota real del daño del equipo.
 */
function settleTeam(matchId: string, drafts: readonly Draft[], enemyKills: number): void {
  const deaths = distribute(
    enemyKills,
    drafts.map((d) => `${matchId}:${d.participant.riotId}:deaths`),
  );
  const teamDamage = drafts.reduce((a, d) => a + d.participant.stats.totalDamageToChampions, 0);

  drafts.forEach((d, i) => {
    d.participant.stats.deaths = deaths[i];
    d.participant.stats.damageSharePercentage = Math.round(
      (d.participant.stats.totalDamageToChampions / teamDamage) * 100,
    );
  });
}

const ALL_DRAKES: DragonType[] = ['infernal', 'mountain', 'ocean', 'cloud', 'hextech', 'chemtech'];

function summarize(
  matchId: string,
  side: TeamSide,
  won: boolean,
  participants: readonly MatchParticipant[],
): TeamSummary {
  const total = (read: (s: ParticipantStats) => number) =>
    participants.reduce((a, p) => a + read(p.stats), 0);

  const dragonsCount = won ? between(`${matchId}:${side}:dr`, 2, 4) : between(`${matchId}:${side}:dr`, 0, 2);
  const barons = won ? between(`${matchId}:${side}:ba`, 0, 2) : between(`${matchId}:${side}:ba`, 0, 1);
  const elderDragons = won && dragonsCount >= 3 && hash(`${matchId}:${side}:elder`) % 3 === 0 ? 1 : 0;
  const voidgrubs = won ? between(`${matchId}:${side}:grubs`, 2, 6) : between(`${matchId}:${side}:grubs`, 0, 3);

  const dragonTypes: DragonType[] = [];
  for (let i = 0; i < dragonsCount; i++) {
    dragonTypes.push(ALL_DRAKES[hash(`${matchId}:drake:${side}:${i}`) % ALL_DRAKES.length]);
  }

  return {
    side,
    won,
    totalKills: total((s) => s.kills),
    totalDeaths: total((s) => s.deaths),
    totalAssists: total((s) => s.assists),
    totalGold: total((s) => s.gold),
    totalDamage: total((s) => s.totalDamageToChampions),
    dragons: dragonsCount + elderDragons,
    barons,
    towers: won ? between(`${matchId}:${side}:tw`, 6, 11) : between(`${matchId}:${side}:tw`, 0, 5),
    elderDragons,
    voidgrubs,
    dragonTypes,
    participants: [...participants],
  };
}

/** Relación (K + A) / max(1, M). Solo para elegir el MVP; la de presentación vive en `match-view`. */
function kda(p: MatchParticipant): number {
  return (p.stats.kills + p.stats.assists) / Math.max(1, p.stats.deaths);
}

/**
 * La modalidad de una partida sembrada.
 *
 * BACKEND NOTE: la sirve la liga a la que pertenece la partida; esto se borra con el resto de la
 * semilla.
 *
 * Se sortea SOLO entre las modalidades que ese grupo ha jugado, según `groupModalitiesConfig()`.
 * Sortearla libre entre las tres crea una contradicción real: ese generador decide que ~1 de cada 4
 * grupos no ha jugado nunca a Caos, así que sus Estadísticas dejan Caos deshabilitado mientras su
 * Historial enseñaría partidas de Caos.
 *
 * El reparto no es uniforme: cuanto más larga es la temporada de una modalidad, más se juega.
 * Competitivo pesa 3, Equilibrado 2 y Caos 1.
 */
export function seededGameMode(matchId: string, groupId: string): MatchGameMode {
  const played = groupModalitiesConfig(groupId).filter((m) => m.played);
  if (played.length === 0) {
    return 'Competitivo';
  }
  const weights: Record<StatModality, number> = { COMPETITIVE: 3, BALANCED: 2, CHAOS: 1 };
  const bag: StatModality[] = [];
  for (const p of played) {
    const w = weights[p.modality] ?? 1;
    for (let i = 0; i < w; i++) {
      bag.push(p.modality);
    }
  }
  if (bag.length === 0) {
    return 'Competitivo';
  }
  const chosen = bag[hash(matchId + ':mode') % bag.length];
  return MODALITY_LABELS[chosen] as MatchGameMode;
}

function buildMatch(index: number): Match {
  const id = `seed-${String(index + 1).padStart(3, '0')}`;
  const minutes = between(`${id}:dur`, 22, 41);

  const userTeam: TeamSide = hash(`${id}:side`) % 2 === 0 ? 'blue' : 'red';
  // ~55 % de victorias: un historial con winrate creíble, no una racha.
  const userWon = hash(`${id}:win`) % 100 < 55;
  const winningTeam: TeamSide = userWon ? userTeam : other(userTeam);

  // El elenco rota una posición por partida: así cada uno de los nueve pasa por aliado en unas
  // y por rival en otras, y tanto la sinergia como el versus tienen datos para todos.
  const shift = index % CAST.length;
  const rotated = [...CAST.slice(shift), ...CAST.slice(0, shift)];
  const allyNames = rotated.slice(0, 4);
  const enemyNames = rotated.slice(4, 9);

  const userRole = pick(`${id}:role`, LANES);
  const allyLanes = LANES.filter((l) => l !== userRole);

  const mine: Draft[] = [
    draftParticipant({ matchId: id, riotId: CURRENT_USER.tag, team: userTeam, role: userRole, won: userWon, minutes }),
    ...allyNames.map((name, j) =>
      draftParticipant({
        matchId: id,
        riotId: `${name}#${REGION}`,
        team: userTeam,
        role: allyLanes[j],
        won: userWon,
        minutes,
      }),
    ),
  ];

  // Los cinco rivales cubren las cinco posiciones, rotadas por partida: el rival que te toca en
  // tu línea cambia, que es lo que hace que el duelo de línea sea un subconjunto y no el total.
  const theirs: Draft[] = enemyNames.map((name, j) =>
    draftParticipant({
      matchId: id,
      riotId: `${name}#${REGION}`,
      team: other(userTeam),
      role: LANES[(j + index) % LANES.length],
      won: !userWon,
      minutes,
    }),
  );

  const myKills = mine.reduce((a, d) => a + d.kills, 0);
  const theirKills = theirs.reduce((a, d) => a + d.kills, 0);
  settleTeam(id, mine, theirKills);
  settleTeam(id, theirs, myKills);

  const all = [...mine, ...theirs].map((d) => d.participant);

  // Ganar la línea lo decide el oro en el minuto 14 contra tu oponente directo. Es la misma
  // comparación para los dos, así que nunca pueden ganarla ambos.
  for (const lane of LANES) {
    const pair = all.filter((p) => p.role === lane);
    if (pair.length !== 2) continue;
    const [a, b] = pair;
    const aAhead = (a.stats.goldAt14 ?? 0) >= (b.stats.goldAt14 ?? 0);
    a.stats.wonLane = aAhead;
    b.stats.wonLane = !aAhead;
  }

  const order = (p: MatchParticipant) => LANES.indexOf(p.role);
  const mineSorted = mine.map((d) => d.participant).sort((a, b) => order(a) - order(b));
  const theirsSorted = theirs.map((d) => d.participant).sort((a, b) => order(a) - order(b));

  const blue = userTeam === 'blue' ? mineSorted : theirsSorted;
  const red = userTeam === 'blue' ? theirsSorted : mineSorted;

  // El MVP es el mejor KDA del equipo ganador, no un sorteo: así la insignia se sostiene
  // cuando alguien mira el marcador.
  const mvp = all
    .filter((p) => p.team === winningTeam)
    .reduce((best, p) => (kda(p) > kda(best) ? p : best));
  mvp.stats.isMvp = true;

  // El ACE es el mejor KDA del equipo perdedor.
  const losingTeam = other(winningTeam);
  const ace = all
    .filter((p) => p.team === losingTeam)
    .reduce((best, p) => (kda(p) > kda(best) ? p : best));
  ace.stats.isAce = true;

  const userParticipant = mine[0].participant;
  const rankBefore = between(`${id}:rank`, 2, 14);

  const gameMode: MatchGameMode = seededGameMode(id, GROUP.id);
  const lobbyType: MatchLobbyType = hash(`${id}:lobby`) % 2 === 0 ? 'Party' : 'Room';
  const modeLabel = `${gameMode} · ${lobbyType}`;

  return {
    id,
    groupId: GROUP.id,
    group: GROUP,
    leagueName: GROUP.seasonName ?? 'Liga Challenger Clausura',
    modeLabel,
    gameMode,
    lobbyType,
    source: hash(`${id}:src`) % 3 === 0 ? 'manual' : 'import',
    durationSeconds: minutes * 60,
    decidedAt: new Date(BASE_MS - index * DAY_MS - between(`${id}:hh`, 0, 9) * 3_600_000).toISOString(),
    winningTeam,
    blueTeam: summarize(id, 'blue', winningTeam === 'blue', blue),
    redTeam: summarize(id, 'red', winningTeam === 'red', red),
    mvpParticipantId: mvp.id,
    aceParticipantId: ace.id,
    milestones: {
      firstBloodParticipantId: pick(`${id}:fb`, all).id,
      firstTowerTeam: hash(`${id}:ft`) % 3 === 0 ? other(winningTeam) : winningTeam,
      firstDragonTeam: hash(`${id}:fd`) % 2 === 0 ? 'blue' : 'red',
      firstBaronTeam: winningTeam,
    },
    userParticipant,
    userOutcome: userWon ? 'win' : 'loss',
  };
}

export const CHIRINGUITO_GROUP_ID = 'a0000000-0000-0000-0000-000000000001';

const GROUP_CHIRINGUITO: GroupContext = {
  id: CHIRINGUITO_GROUP_ID,
  name: 'Chiringuito Chatarra',
  tag: 'EUW · #CCH',
  initials: 'CC',
  color1: '#f85149',
  color2: '#e3b341',
  seasonName: 'Chiringo',
};

interface ChiringuitoMember {
  userId: string;
  riotId: string;
  name: string;
}

export const CHIRINGUITO_ROSTER: readonly ChiringuitoMember[] = [
  { userId: 'daxlup', riotId: 'Daxlup#EUW', name: 'daxlup' },
  { userId: 'c0000000-0000-0000-0000-000000000001', riotId: 'Nightstalker#EUW', name: 'Nightstalker' },
  { userId: 'c0000000-0000-0000-0000-000000000002', riotId: 'Hide on bush#KR1', name: 'FakerClone' },
  { userId: 'c0000000-0000-0000-0000-000000000003', riotId: 'JungleKing#MAD', name: 'ElyoyaFan' },
  { userId: 'c0000000-0000-0000-0000-000000000004', riotId: 'Craps#G2W', name: 'Capsito' },
  { userId: 'c0000000-0000-0000-0000-000000000005', riotId: 'ZileanGod#EUW', name: 'Chronoshift' },
  { userId: 'c0000000-0000-0000-0000-000000000006', riotId: 'Dunkmaster#LAN', name: 'SilverScrapes' },
  { userId: 'c0000000-0000-0000-0000-000000000007', riotId: 'NexusLord#EUW', name: 'NexusFounder' },
  { userId: 'c0000000-0000-0000-0000-000000000008', riotId: 'Daredevil#EUW', name: 'PentaSamira' },
  { userId: 'c0000000-0000-0000-0000-000000000009', riotId: 'Madlife#KR1', name: 'ThreshHook' },
  { userId: 'c0000000-0000-0000-0000-000000000010', riotId: 'LeeSinMain#LAN', name: 'InsecKick' },
  { userId: 'c0000000-0000-0000-0000-000000000011', riotId: 'SmiteGod#EUW', name: 'BaronStealer' },
  { userId: 'c0000000-0000-0000-0000-000000000012', riotId: 'VisionScore#EUW', name: 'WardHunter' },
  { userId: 'c0000000-0000-0000-0000-000000000013', riotId: 'AllIn#LAS', name: 'FlashIgnite' },
  { userId: 'c0000000-0000-0000-0000-000000000014', riotId: 'xPeke#EUW', name: 'BackdoorKing' },
  { userId: 'c0000000-0000-0000-0000-000000000015', riotId: '10CSMin#EUW', name: 'MinionFarmer' },
  { userId: 'c0000000-0000-0000-0000-000000000016', riotId: 'IntingSion#EUW', name: 'TurretDiver' },
  { userId: 'c0000000-0000-0000-0000-000000000017', riotId: 'ShyvanaOtp#LAN', name: 'DragonSlayer' },
  { userId: 'c0000000-0000-0000-0000-000000000018', riotId: 'Shelly#EUW', name: 'RiftHerald' },
  { userId: 'c0000000-0000-0000-0000-000000000019', riotId: 'BrambleVest#EUW', name: 'RedBuffEnjoyer' },
  { userId: 'c0000000-0000-0000-0000-000000000020', riotId: 'BronzeBeast#LAN', name: 'IronForged' },
  { userId: 'c0000000-0000-0000-0000-000000000021', riotId: 'PlasticV#EUW', name: 'WoodDivision' },
  { userId: 'c0000000-0000-0000-0000-000000000022', riotId: 'DiscoNunu#EUW', name: 'ToxicTroll' },
];

const CHIRINGUITO_MATCH_COUNT = 30;

function buildChiringuitoMatch(index: number): Match {
  const id = `cc-match-${String(index + 1).padStart(3, '0')}`;
  const minutes = between(`${id}:dur`, 23, 43);
  const winningTeam: TeamSide = hash(`${id}:win`) % 2 === 0 ? 'blue' : 'red';

  // Rotamos el elenco de forma determinista para que todos los jugadores participen
  const offset = (index * 7) % CHIRINGUITO_ROSTER.length;
  const pool = [...CHIRINGUITO_ROSTER.slice(offset), ...CHIRINGUITO_ROSTER.slice(0, offset)];
  const blueMembers = pool.slice(0, 5);
  const redMembers = pool.slice(5, 10);

  const blueDrafts: Draft[] = blueMembers.map((m, j) =>
    draftParticipant({
      matchId: id,
      riotId: m.riotId,
      userId: m.userId,
      team: 'blue',
      role: LANES[j],
      won: winningTeam === 'blue',
      minutes,
    }),
  );

  const redDrafts: Draft[] = redMembers.map((m, j) =>
    draftParticipant({
      matchId: id,
      riotId: m.riotId,
      userId: m.userId,
      team: 'red',
      role: LANES[j],
      won: winningTeam === 'red',
      minutes,
    }),
  );

  const blueKills = blueDrafts.reduce((a, d) => a + d.kills, 0);
  const redKills = redDrafts.reduce((a, d) => a + d.kills, 0);
  settleTeam(id, blueDrafts, redKills);
  settleTeam(id, redDrafts, blueKills);

  const all = [...blueDrafts, ...redDrafts].map((d) => d.participant);

  for (const lane of LANES) {
    const pair = all.filter((p) => p.role === lane);
    if (pair.length === 2) {
      const [a, b] = pair;
      const aAhead = (a.stats.goldAt14 ?? 0) >= (b.stats.goldAt14 ?? 0);
      a.stats.wonLane = aAhead;
      b.stats.wonLane = !aAhead;
    }
  }

  const order = (p: MatchParticipant) => LANES.indexOf(p.role);
  const blueSorted = blueDrafts.map((d) => d.participant).sort((a, b) => order(a) - order(b));
  const redSorted = redDrafts.map((d) => d.participant).sort((a, b) => order(a) - order(b));

  const mvp = all
    .filter((p) => p.team === winningTeam)
    .reduce((best, p) => (kda(p) > kda(best) ? p : best));
  mvp.stats.isMvp = true;

  // El ACE es el mejor KDA del equipo perdedor.
  const losingTeam = other(winningTeam);
  const ace = all
    .filter((p) => p.team === losingTeam)
    .reduce((best, p) => (kda(p) > kda(best) ? p : best));
  ace.stats.isAce = true;

  // Si daxlup jugó en esta partida, asignamos userParticipant
  const userParticipant = all.find(
    (p) => p.userId === 'daxlup' || p.riotId.toLowerCase().includes('daxlup'),
  );
  const userWon = userParticipant ? userParticipant.team === winningTeam : undefined;

  const gameMode: MatchGameMode = seededGameMode(id, CHIRINGUITO_GROUP_ID);
  const lobbyType: MatchLobbyType = hash(`${id}:lobby`) % 2 === 0 ? 'Party' : 'Room';
  const modeLabel = `${gameMode} · ${lobbyType}`;

  return {
    id,
    groupId: CHIRINGUITO_GROUP_ID,
    group: GROUP_CHIRINGUITO,
    leagueName: GROUP_CHIRINGUITO.seasonName ?? 'Chiringo',
    modeLabel,
    gameMode,
    lobbyType,
    source: hash(`${id}:src`) % 2 === 0 ? 'import' : 'manual',
    durationSeconds: minutes * 60,
    decidedAt: new Date(BASE_MS - index * (DAY_MS * 0.7) - between(`${id}:hh`, 0, 8) * 3_600_000).toISOString(),
    winningTeam,
    blueTeam: summarize(id, 'blue', winningTeam === 'blue', blueSorted),
    redTeam: summarize(id, 'red', winningTeam === 'red', redSorted),
    mvpParticipantId: mvp.id,
    aceParticipantId: ace.id,
    milestones: {
      firstBloodParticipantId: pick(`${id}:fb`, all).id,
      firstTowerTeam: hash(`${id}:ft`) % 3 === 0 ? other(winningTeam) : winningTeam,
      firstDragonTeam: hash(`${id}:fd`) % 2 === 0 ? 'blue' : 'red',
      firstBaronTeam: winningTeam,
    },
    userParticipant,
    userOutcome: userWon !== undefined ? (userWon ? 'win' : 'loss') : undefined,
  };
}

/**
 * Las partidas de la semilla, de más reciente a más antigua (el orden natural del historial).
 *
 * Incluye tanto partidas de LAN Challenger (historial personal) como de Chiringuito Chatarra (grupo y ranking).
 */
export const MATCH_SEED: readonly Match[] = [
  ...Array.from({ length: MATCH_COUNT }, (_, i) => buildMatch(i)),
  ...Array.from({ length: CHIRINGUITO_MATCH_COUNT }, (_, i) => buildChiringuitoMatch(i)),
].sort((a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime());

/**
 * Carga la semilla en el store. Es el único consumidor de `MATCH_SEED`.
 *
 * Recibe el inyector y no el store porque quien la llama (`app.config.ts`) no debe importar
 * `MatchHistoryStore`: si lo hiciera, el store subiría al bundle inicial, cuando hoy viaja en
 * los chunks perezosos de las vistas que lo usan.
 */
export function seedMatchHistory(injector: EnvironmentInjector): void {
  injector.get(MatchHistoryStore).allMatches.set([...MATCH_SEED]);
}
