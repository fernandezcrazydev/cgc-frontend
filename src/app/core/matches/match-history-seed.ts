import { Match, MatchMilestones, MatchParticipant, TeamSummary } from './models';
import { GROUPS } from '../lobby';
import { hash } from '../group-ranking';

/** Items reales con IDs típicos de League of Legends */
export const MOCK_ITEMS = {
  filoNocturno: { id: 3814, name: 'Filo Nocturno', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.14.1/img/item/3814.png', gold: 3000 },
  hojaInfinita: { id: 3031, name: 'Filo Infinito', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.14.1/img/item/3031.png', gold: 3400 },
  botasVeloces: { id: 3006, name: 'Grebas de Berserker', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.14.1/img/item/3006.png', gold: 1100 },
  dagaFilo: { id: 3134, name: 'Daga Serrada', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.14.1/img/item/3134.png', gold: 1000 },
  hidraVoraz: { id: 3074, name: 'Hidra Voraz', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.14.1/img/item/3074.png', gold: 3300 },
  tomoArcano: { id: 3802, name: 'Capítulo Perdido', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.14.1/img/item/3802.png', gold: 1200 },
  cetroAbisal: { id: 3001, name: 'Máscara Abisal', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.14.1/img/item/3001.png', gold: 2650 },
  veloBanshee: { id: 3102, name: 'Velo del Hada de la Muerte', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.14.1/img/item/3102.png', gold: 3100 },
  egidaSolar: { id: 3068, name: 'Égida de Fuego Solar', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.14.1/img/item/3068.png', gold: 2700 },
  mazaEspinada: { id: 3075, name: 'Cota de Espinas', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.14.1/img/item/3075.png', gold: 2700 },
  sombreroRabadon: { id: 3089, name: 'Sombrero Mortal de Rabadon', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.14.1/img/item/3089.png', gold: 3600 },
  relojArenaZhonya: { id: 3157, name: 'Reloj de Arena de Zhonya', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.14.1/img/item/3157.png', gold: 3250 },
  trinketAmarillo: { id: 3340, name: 'Guardián Invisible', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.14.1/img/item/3340.png', gold: 0 },
  trinketRojo: { id: 3364, name: 'Lente del Oráculo', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.14.1/img/item/3364.png', gold: 0 },
};

function getGroupCtx(groupId: string) {
  const g = GROUPS.find((grp) => grp.id === groupId);
  return {
    id: groupId,
    name: g?.name ?? 'Liga Sale Custom',
    tag: g?.tag ?? 'LAN',
    initials: g?.initials ?? 'LC',
    color1: g?.c1 ?? 'hsl(320,90%,64%)',
    color2: g?.c2 ?? 'hsl(280,78%,34%)',
    seasonName: '2026 · Temporada 2',
  };
}

export const SEED_MATCHES: Match[] = [
  // 1. LAN Challenger - Victoria con Ahri (MID) - MVP de la partida
  {
    id: 'lan-2895',
    code: 'WX4K',
    groupId: 'lan-challenger',
    group: getGroupCtx('lan-challenger'),
    source: 'import',
    durationSeconds: 1934,
    decidedAt: '2026-06-23T21:45:00Z',
    winningTeam: 'blue',
    mvpParticipantId: 'p-blue-mid-1',
    blueTeam: {
      side: 'blue',
      won: true,
      totalKills: 28,
      totalDeaths: 19,
      totalAssists: 56,
      totalGold: 64420,
      totalDamage: 92400,
      dragons: 3,
      barons: 1,
      towers: 9,
      participants: [
        {
          id: 'p-blue-top-1',
          userId: 'u-alex',
          riotId: 'Alex#LAN',
          isGuest: false,
          team: 'blue',
          role: 'TOP',
          championId: 86, // Garen
          championName: 'Garen',
          championLevel: 16,
          wasAutofill: false,
          lpDelta: 17,
          stats: {
            kills: 6, deaths: 4, assists: 9, cs: 215, csPerMin: 6.7, gold: 13800,
            totalDamageToChampions: 19400, damageSharePercentage: 21, damageTaken: 28400,
            visionScore: 24, wardsPlaced: 12, wardsKilled: 4,
            items: [MOCK_ITEMS.egidaSolar, MOCK_ITEMS.mazaEspinada, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.hidraVoraz, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 12], goldAt14: 4200, csAt14: 110, wonLane: true,
          }
        },
        {
          id: 'p-blue-jug-1',
          userId: 'u-lee',
          riotId: 'Raik#LAN',
          isGuest: false,
          team: 'blue',
          role: 'JUNGLA',
          championId: 64, // Lee Sin
          championName: 'Lee Sin',
          championLevel: 15,
          wasAutofill: false,
          lpDelta: 18,
          stats: {
            kills: 4, deaths: 3, assists: 13, cs: 162, csPerMin: 5.0, gold: 12400,
            totalDamageToChampions: 14200, damageSharePercentage: 15, damageTaken: 24100,
            visionScore: 42, wardsPlaced: 18, wardsKilled: 9,
            items: [MOCK_ITEMS.hidraVoraz, MOCK_ITEMS.veloBanshee, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.dagaFilo, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 11], goldAt14: 3900, csAt14: 85, wonLane: true,
          }
        },
        {
          id: 'p-blue-mid-1',
          userId: 'u-n1ghtfang',
          riotId: 'N1ghtfang#LAN',
          isGuest: false,
          team: 'blue',
          role: 'MID',
          championId: 103, // Ahri
          championName: 'Ahri',
          championLevel: 17,
          wasAutofill: false,
          lpDelta: 22,
          stats: {
            kills: 12, deaths: 3, assists: 8, cs: 241, csPerMin: 7.5, gold: 15820,
            totalDamageToChampions: 34500, damageSharePercentage: 37, damageTaken: 14200,
            visionScore: 28, wardsPlaced: 14, wardsKilled: 6,
            items: [MOCK_ITEMS.filoNocturno, MOCK_ITEMS.sombreroRabadon, MOCK_ITEMS.relojArenaZhonya, MOCK_ITEMS.tomoArcano, MOCK_ITEMS.botasVeloces, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 4850, csAt14: 124, wonLane: true, isMvp: true,
          }
        },
        {
          id: 'p-blue-adc-1',
          userId: 'u-jinx',
          riotId: 'Kira#LAN',
          isGuest: false,
          team: 'blue',
          role: 'ADC',
          championId: 222, // Jinx
          championName: 'Jinx',
          championLevel: 15,
          wasAutofill: false,
          lpDelta: 16,
          stats: {
            kills: 5, deaths: 4, assists: 11, cs: 238, csPerMin: 7.4, gold: 14100,
            totalDamageToChampions: 20100, damageSharePercentage: 22, damageTaken: 13500,
            visionScore: 19, wardsPlaced: 10, wardsKilled: 3,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.dagaFilo, MOCK_ITEMS.filoNocturno, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 7], goldAt14: 4100, csAt14: 118, wonLane: false,
          }
        },
        {
          id: 'p-blue-sup-1',
          userId: 'u-thresh',
          riotId: 'Sona#LAN',
          isGuest: false,
          team: 'blue',
          role: 'SUPPORT',
          championId: 412, // Thresh
          championName: 'Thresh',
          championLevel: 13,
          wasAutofill: false,
          lpDelta: 19,
          stats: {
            kills: 1, deaths: 5, assists: 15, cs: 34, csPerMin: 1.1, gold: 8300,
            totalDamageToChampions: 4200, damageSharePercentage: 5, damageTaken: 18200,
            visionScore: 68, wardsPlaced: 38, wardsKilled: 14,
            items: [MOCK_ITEMS.tomoArcano, MOCK_ITEMS.egidaSolar, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 14], goldAt14: 2600, csAt14: 16, wonLane: false,
          }
        }
      ]
    },
    redTeam: {
      side: 'red',
      won: false,
      totalKills: 19,
      totalDeaths: 28,
      totalAssists: 38,
      totalGold: 57300,
      totalDamage: 71200,
      dragons: 1,
      barons: 0,
      towers: 3,
      participants: [
        {
          id: 'p-red-top-1',
          userId: 'u-morf',
          riotId: 'Morf#LAN',
          isGuest: false,
          team: 'red',
          role: 'TOP',
          championId: 157, // Yasuo
          championName: 'Yasuo',
          championLevel: 15,
          wasAutofill: false,
          lpDelta: -14,
          stats: {
            kills: 5, deaths: 6, assists: 5, cs: 204, csPerMin: 6.3, gold: 12600,
            totalDamageToChampions: 18400, damageSharePercentage: 26, damageTaken: 26100,
            visionScore: 21, wardsPlaced: 11, wardsKilled: 4,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.veloBanshee, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 3900, csAt14: 98, wonLane: false,
          }
        },
        {
          id: 'p-red-jug-1',
          userId: 'u-karthus',
          riotId: 'Zee#LAN',
          isGuest: false,
          team: 'red',
          role: 'JUNGLA',
          championId: 30, // Karthus
          championName: 'Karthus',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 4, deaths: 7, assists: 8, cs: 148, csPerMin: 4.6, gold: 11200,
            totalDamageToChampions: 17800, damageSharePercentage: 25, damageTaken: 22400,
            visionScore: 31, wardsPlaced: 14, wardsKilled: 5,
            items: [MOCK_ITEMS.tomoArcano, MOCK_ITEMS.cetroAbisal, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 11], goldAt14: 3600, csAt14: 78, wonLane: false,
          }
        },
        {
          id: 'p-red-mid-1',
          userId: 'u-zed',
          riotId: 'Pyro#LAN',
          isGuest: false,
          team: 'red',
          role: 'MID',
          championId: 238, // Zed
          championName: 'Zed',
          championLevel: 15,
          wasAutofill: false,
          lpDelta: -16,
          stats: {
            kills: 4, deaths: 7, assists: 6, cs: 198, csPerMin: 6.1, gold: 12100,
            totalDamageToChampions: 19200, damageSharePercentage: 27, damageTaken: 19800,
            visionScore: 23, wardsPlaced: 11, wardsKilled: 5,
            items: [MOCK_ITEMS.filoNocturno, MOCK_ITEMS.dagaFilo, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 4100, csAt14: 104, wonLane: false,
          }
        },
        {
          id: 'p-red-adc-1',
          userId: 'u-ashe',
          riotId: 'Dox#LAN',
          isGuest: false,
          team: 'red',
          role: 'ADC',
          championId: 22, // Ashe
          championName: 'Ashe',
          championLevel: 15,
          wasAutofill: false,
          lpDelta: -14,
          stats: {
            kills: 5, deaths: 4, assists: 7, cs: 226, csPerMin: 7.0, gold: 13500,
            totalDamageToChampions: 13100, damageSharePercentage: 18, damageTaken: 12900,
            visionScore: 26, wardsPlaced: 14, wardsKilled: 6,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.dagaFilo, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 7], goldAt14: 4300, csAt14: 122, wonLane: true,
          }
        },
        {
          id: 'p-red-sup-1',
          userId: 'u-luxy',
          riotId: 'Luxy#LAN',
          isGuest: false,
          team: 'red',
          role: 'SUPPORT',
          championId: 99, // Lux
          championName: 'Lux',
          championLevel: 12,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 1, deaths: 4, assists: 12, cs: 28, csPerMin: 0.9, gold: 7900,
            totalDamageToChampions: 2700, damageSharePercentage: 4, damageTaken: 14100,
            visionScore: 54, wardsPlaced: 30, wardsKilled: 10,
            items: [MOCK_ITEMS.tomoArcano, MOCK_ITEMS.veloBanshee, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 14], goldAt14: 2800, csAt14: 18, wonLane: true,
          }
        }
      ]
    }
  },

  // 2. LAN Challenger - Derrota con Lee Sin (JUNGLA)
  {
    id: 'lan-2891',
    code: 'PL92',
    groupId: 'lan-challenger',
    group: getGroupCtx('lan-challenger'),
    source: 'import',
    durationSeconds: 1680,
    decidedAt: '2026-06-23T20:58:00Z',
    winningTeam: 'red',
    mvpParticipantId: 'p-red-mid-2',
    blueTeam: {
      side: 'blue',
      won: false,
      totalKills: 14,
      totalDeaths: 27,
      totalAssists: 22,
      totalGold: 47940,
      totalDamage: 52100,
      dragons: 1,
      barons: 0,
      towers: 2,
      participants: [
        {
          id: 'p-blue-top-2',
          userId: 'u-alex',
          riotId: 'Alex#LAN',
          isGuest: false,
          team: 'blue',
          role: 'TOP',
          championId: 86, // Garen
          championName: 'Garen',
          championLevel: 13,
          wasAutofill: false,
          lpDelta: -16,
          stats: {
            kills: 3, deaths: 6, assists: 3, cs: 172, csPerMin: 6.1, gold: 9800,
            totalDamageToChampions: 11200, damageSharePercentage: 21, damageTaken: 22100,
            visionScore: 18, wardsPlaced: 9, wardsKilled: 2,
            items: [MOCK_ITEMS.egidaSolar, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 12], goldAt14: 3800, csAt14: 92, wonLane: false,
          }
        },
        {
          id: 'p-blue-jug-2',
          userId: 'u-n1ghtfang',
          riotId: 'N1ghtfang#LAN',
          isGuest: false,
          team: 'blue',
          role: 'JUNGLA',
          championId: 64, // Lee Sin
          championName: 'Lee Sin',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 4, deaths: 7, assists: 7, cs: 198, csPerMin: 7.1, gold: 11240,
            totalDamageToChampions: 15800, damageSharePercentage: 30, damageTaken: 26400,
            visionScore: 36, wardsPlaced: 19, wardsKilled: 7,
            items: [MOCK_ITEMS.tomoArcano, MOCK_ITEMS.cetroAbisal, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.veloBanshee, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 11], goldAt14: 4100, csAt14: 98, wonLane: false,
          }
        },
        {
          id: 'p-blue-mid-2',
          userId: 'u-pyro',
          riotId: 'Pyro#LAN',
          isGuest: false,
          team: 'blue',
          role: 'MID',
          championId: 238, // Zed
          championName: 'Zed',
          championLevel: 13,
          wasAutofill: false,
          lpDelta: -17,
          stats: {
            kills: 3, deaths: 7, assists: 4, cs: 165, csPerMin: 5.9, gold: 9700,
            totalDamageToChampions: 13100, damageSharePercentage: 25, damageTaken: 17200,
            visionScore: 16, wardsPlaced: 8, wardsKilled: 3,
            items: [MOCK_ITEMS.filoNocturno, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 3600, csAt14: 86, wonLane: false,
          }
        },
        {
          id: 'p-blue-adc-2',
          userId: 'u-jinx',
          riotId: 'Kira#LAN',
          isGuest: false,
          team: 'blue',
          role: 'ADC',
          championId: 222, // Jinx
          championName: 'Jinx',
          championLevel: 13,
          wasAutofill: false,
          lpDelta: -14,
          stats: {
            kills: 3, deaths: 4, assists: 3, cs: 192, csPerMin: 6.9, gold: 10400,
            totalDamageToChampions: 9800, damageSharePercentage: 19, damageTaken: 11800,
            visionScore: 17, wardsPlaced: 9, wardsKilled: 3,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 7], goldAt14: 3900, csAt14: 102, wonLane: false,
          }
        },
        {
          id: 'p-blue-sup-2',
          userId: 'u-sona',
          riotId: 'Sona#LAN',
          isGuest: false,
          team: 'blue',
          role: 'SUPPORT',
          championId: 412, // Thresh
          championName: 'Thresh',
          championLevel: 11,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 1, deaths: 3, assists: 5, cs: 22, csPerMin: 0.8, gold: 6800,
            totalDamageToChampions: 2200, damageSharePercentage: 4, damageTaken: 14100,
            visionScore: 48, wardsPlaced: 24, wardsKilled: 8,
            items: [MOCK_ITEMS.tomoArcano, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 14], goldAt14: 2300, csAt14: 12, wonLane: false,
          }
        }
      ]
    },
    redTeam: {
      side: 'red',
      won: true,
      totalKills: 27,
      totalDeaths: 14,
      totalAssists: 51,
      totalGold: 60200,
      totalDamage: 78500,
      dragons: 3,
      barons: 1,
      towers: 8,
      participants: [
        {
          id: 'p-red-top-2',
          userId: 'u-morf',
          riotId: 'Morf#LAN',
          isGuest: false,
          team: 'red',
          role: 'TOP',
          championId: 157, // Yasuo
          championName: 'Yasuo',
          championLevel: 15,
          wasAutofill: false,
          lpDelta: 18,
          stats: {
            kills: 7, deaths: 2, assists: 8, cs: 218, csPerMin: 7.8, gold: 13900,
            totalDamageToChampions: 21200, damageSharePercentage: 27, damageTaken: 18900,
            visionScore: 22, wardsPlaced: 12, wardsKilled: 4,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.hidraVoraz, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 4500, csAt14: 114, wonLane: true,
          }
        },
        {
          id: 'p-red-jug-2',
          userId: 'u-karthus',
          riotId: 'Zee#LAN',
          isGuest: false,
          team: 'red',
          role: 'JUNGLA',
          championId: 30, // Karthus
          championName: 'Karthus',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: 16,
          stats: {
            kills: 5, deaths: 3, assists: 12, cs: 174, csPerMin: 6.2, gold: 12100,
            totalDamageToChampions: 19400, damageSharePercentage: 25, damageTaken: 18200,
            visionScore: 32, wardsPlaced: 15, wardsKilled: 6,
            items: [MOCK_ITEMS.sombreroRabadon, MOCK_ITEMS.tomoArcano, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 11], goldAt14: 4000, csAt14: 92, wonLane: true,
          }
        },
        {
          id: 'p-red-mid-2',
          userId: 'u-ahri-red',
          riotId: 'Pix3lQueen#EUW',
          isGuest: false,
          team: 'red',
          role: 'MID',
          championId: 103, // Ahri
          championName: 'Ahri',
          championLevel: 16,
          wasAutofill: false,
          lpDelta: 22,
          stats: {
            kills: 9, deaths: 2, assists: 11, cs: 224, csPerMin: 8.0, gold: 14600,
            totalDamageToChampions: 26800, damageSharePercentage: 34, damageTaken: 12400,
            visionScore: 29, wardsPlaced: 14, wardsKilled: 7,
            items: [MOCK_ITEMS.sombreroRabadon, MOCK_ITEMS.relojArenaZhonya, MOCK_ITEMS.tomoArcano, MOCK_ITEMS.botasVeloces, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 4900, csAt14: 128, wonLane: true, isMvp: true,
          }
        },
        {
          id: 'p-red-adc-2',
          userId: 'u-ashe',
          riotId: 'Dox#LAN',
          isGuest: false,
          team: 'red',
          role: 'ADC',
          championId: 22, // Ashe
          championName: 'Ashe',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: 17,
          stats: {
            kills: 5, deaths: 3, assists: 9, cs: 210, csPerMin: 7.5, gold: 12800,
            totalDamageToChampions: 8900, damageSharePercentage: 11, damageTaken: 10200,
            visionScore: 21, wardsPlaced: 11, wardsKilled: 4,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 7], goldAt14: 4200, csAt14: 110, wonLane: true,
          }
        },
        {
          id: 'p-red-sup-2',
          userId: 'u-luxy',
          riotId: 'Luxy#LAN',
          isGuest: false,
          team: 'red',
          role: 'SUPPORT',
          championId: 99, // Lux
          championName: 'Lux',
          championLevel: 12,
          wasAutofill: false,
          lpDelta: 16,
          stats: {
            kills: 1, deaths: 4, assists: 11, cs: 24, csPerMin: 0.9, gold: 6800,
            totalDamageToChampions: 2200, damageSharePercentage: 3, damageTaken: 11200,
            visionScore: 59, wardsPlaced: 32, wardsKilled: 12,
            items: [MOCK_ITEMS.tomoArcano, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 14], goldAt14: 2500, csAt14: 14, wonLane: true,
          }
        }
      ]
    }
  },

  // 3. Scrim Squad - Victoria con Yasuo (MID)
  {
    id: 'scrim-204',
    code: 'SS81',
    groupId: 'scrim-squad',
    group: getGroupCtx('scrim-squad'),
    source: 'import',
    durationSeconds: 2460,
    decidedAt: '2026-06-22T23:10:00Z',
    winningTeam: 'blue',
    mvpParticipantId: 'p-blue-mid-3',
    blueTeam: {
      side: 'blue',
      won: true,
      totalKills: 34,
      totalDeaths: 26,
      totalAssists: 68,
      totalGold: 78330,
      totalDamage: 118400,
      dragons: 4,
      barons: 2,
      towers: 10,
      participants: [
        {
          id: 'p-blue-top-3',
          userId: 'u-ashen',
          riotId: 'AshenWolf#EUW',
          isGuest: false,
          team: 'blue',
          role: 'TOP',
          championId: 86, // Garen
          championName: 'Garen',
          championLevel: 18,
          wasAutofill: false,
          lpDelta: 18,
          stats: {
            kills: 7, deaths: 5, assists: 12, cs: 284, csPerMin: 6.9, gold: 16800,
            totalDamageToChampions: 26200, damageSharePercentage: 22, damageTaken: 38400,
            visionScore: 32, wardsPlaced: 16, wardsKilled: 6,
            items: [MOCK_ITEMS.egidaSolar, MOCK_ITEMS.mazaEspinada, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.hidraVoraz, MOCK_ITEMS.veloBanshee, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 12], goldAt14: 4300, csAt14: 112, wonLane: true,
          }
        },
        {
          id: 'p-blue-jug-3',
          userId: 'u-zer0',
          riotId: 'Zer0Cool#BR',
          isGuest: false,
          team: 'blue',
          role: 'JUNGLA',
          championId: 64, // Lee Sin
          championName: 'Lee Sin',
          championLevel: 17,
          wasAutofill: false,
          lpDelta: 19,
          stats: {
            kills: 6, deaths: 6, assists: 16, cs: 215, csPerMin: 5.2, gold: 15400,
            totalDamageToChampions: 18900, damageSharePercentage: 16, damageTaken: 32100,
            visionScore: 54, wardsPlaced: 28, wardsKilled: 12,
            items: [MOCK_ITEMS.hidraVoraz, MOCK_ITEMS.veloBanshee, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.dagaFilo, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 11], goldAt14: 4100, csAt14: 90, wonLane: true,
          }
        },
        {
          id: 'p-blue-mid-3',
          userId: 'u-n1ghtfang',
          riotId: 'N1ghtfang#LAN',
          isGuest: false,
          team: 'blue',
          role: 'MID',
          championId: 157, // Yasuo
          championName: 'Yasuo',
          championLevel: 18,
          wasAutofill: false,
          lpDelta: 24,
          stats: {
            kills: 9, deaths: 5, assists: 6, cs: 312, csPerMin: 7.6, gold: 17430,
            totalDamageToChampions: 39800, damageSharePercentage: 34, damageTaken: 28400,
            visionScore: 28, wardsPlaced: 14, wardsKilled: 6,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.dagaFilo, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.hidraVoraz, MOCK_ITEMS.veloBanshee, MOCK_ITEMS.mazaEspinada, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 4900, csAt14: 128, wonLane: true, isMvp: true,
          }
        },
        {
          id: 'p-blue-adc-3',
          userId: 'u-glitch',
          riotId: 'GlitchKid#EUW',
          isGuest: false,
          team: 'blue',
          role: 'ADC',
          championId: 222, // Jinx
          championName: 'Jinx',
          championLevel: 17,
          wasAutofill: false,
          lpDelta: 18,
          stats: {
            kills: 10, deaths: 5, assists: 14, cs: 305, csPerMin: 7.4, gold: 17800,
            totalDamageToChampions: 29400, damageSharePercentage: 25, damageTaken: 16500,
            visionScore: 26, wardsPlaced: 13, wardsKilled: 5,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.filoNocturno, MOCK_ITEMS.dagaFilo, MOCK_ITEMS.hidraVoraz, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 7], goldAt14: 4400, csAt14: 118, wonLane: true,
          }
        },
        {
          id: 'p-blue-sup-3',
          userId: 'u-bytesiren',
          riotId: 'ByteSiren#EUW',
          isGuest: false,
          team: 'blue',
          role: 'SUPPORT',
          championId: 89, // Leona
          championName: 'Leona',
          championLevel: 15,
          wasAutofill: false,
          lpDelta: 17,
          stats: {
            kills: 2, deaths: 5, assists: 20, cs: 48, csPerMin: 1.2, gold: 10900,
            totalDamageToChampions: 4100, damageSharePercentage: 3, damageTaken: 29400,
            visionScore: 82, wardsPlaced: 44, wardsKilled: 16,
            items: [MOCK_ITEMS.egidaSolar, MOCK_ITEMS.mazaEspinada, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.veloBanshee, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 14], goldAt14: 2800, csAt14: 16, wonLane: true,
          }
        }
      ]
    },
    redTeam: {
      side: 'red',
      won: false,
      totalKills: 26,
      totalDeaths: 34,
      totalAssists: 52,
      totalGold: 70800,
      totalDamage: 98200,
      dragons: 2,
      barons: 0,
      towers: 4,
      participants: [
        {
          id: 'p-red-top-3',
          userId: 'u-storm',
          riotId: 'St0rmcaller#LANA',
          isGuest: false,
          team: 'red',
          role: 'TOP',
          championId: 11, // Master Yi
          championName: 'Master Yi',
          championLevel: 17,
          wasAutofill: false,
          lpDelta: -16,
          stats: {
            kills: 7, deaths: 8, assists: 8, cs: 265, csPerMin: 6.5, gold: 15600,
            totalDamageToChampions: 24500, damageSharePercentage: 25, damageTaken: 28900,
            visionScore: 24, wardsPlaced: 12, wardsKilled: 4,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.filoNocturno, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 4100, csAt14: 104, wonLane: false,
          }
        },
        {
          id: 'p-red-jug-3',
          userId: 'u-hex',
          riotId: 'HexHunter#NA',
          isGuest: false,
          team: 'red',
          role: 'JUNGLA',
          championId: 33, // Rammus
          championName: 'Rammus',
          championLevel: 16,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 3, deaths: 7, assists: 14, cs: 182, csPerMin: 4.4, gold: 13200,
            totalDamageToChampions: 12400, damageSharePercentage: 13, damageTaken: 36400,
            visionScore: 41, wardsPlaced: 18, wardsKilled: 8,
            items: [MOCK_ITEMS.egidaSolar, MOCK_ITEMS.mazaEspinada, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 11], goldAt14: 3700, csAt14: 82, wonLane: false,
          }
        },
        {
          id: 'p-red-mid-3',
          userId: 'u-void',
          riotId: 'V0idWalker#666',
          isGuest: false,
          team: 'red',
          role: 'MID',
          championId: 245, // Ekko
          championName: 'Ekko',
          championLevel: 18,
          wasAutofill: false,
          lpDelta: -14,
          stats: {
            kills: 9, deaths: 6, assists: 9, cs: 288, csPerMin: 7.0, gold: 16900,
            totalDamageToChampions: 31200, damageSharePercentage: 32, damageTaken: 24200,
            visionScore: 29, wardsPlaced: 14, wardsKilled: 6,
            items: [MOCK_ITEMS.sombreroRabadon, MOCK_ITEMS.relojArenaZhonya, MOCK_ITEMS.tomoArcano, MOCK_ITEMS.botasVeloces, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 4600, csAt14: 116, wonLane: false,
          }
        },
        {
          id: 'p-red-adc-3',
          userId: 'u-ashe-red',
          riotId: 'Cr1msonByte#PSOE',
          isGuest: false,
          team: 'red',
          role: 'ADC',
          championId: 22, // Ashe
          championName: 'Ashe',
          championLevel: 17,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 5, deaths: 7, assists: 11, cs: 278, csPerMin: 6.8, gold: 15400,
            totalDamageToChampions: 23400, damageSharePercentage: 24, damageTaken: 19800,
            visionScore: 31, wardsPlaced: 16, wardsKilled: 7,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.dagaFilo, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 7], goldAt14: 4200, csAt14: 110, wonLane: false,
          }
        },
        {
          id: 'p-red-sup-3',
          userId: 'u-neon',
          riotId: 'NeonRift#DRWHO',
          isGuest: false,
          team: 'red',
          role: 'SUPPORT',
          championId: 99, // Lux
          championName: 'Lux',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 2, deaths: 6, assists: 10, cs: 36, csPerMin: 0.9, gold: 9700,
            totalDamageToChampions: 6700, damageSharePercentage: 7, damageTaken: 16400,
            visionScore: 68, wardsPlaced: 36, wardsKilled: 12,
            items: [MOCK_ITEMS.tomoArcano, MOCK_ITEMS.veloBanshee, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 14], goldAt14: 2700, csAt14: 14, wonLane: false,
          }
        }
      ]
    }
  },

  // 4. Night Owls - Victoria con Lux (SUPPORT)
  {
    id: 'owl-118',
    code: 'NW09',
    groupId: 'night-owls',
    group: getGroupCtx('night-owls'),
    source: 'import',
    durationSeconds: 1560,
    decidedAt: '2026-06-21T01:34:00Z',
    winningTeam: 'blue',
    mvpParticipantId: 'p-blue-sup-4',
    blueTeam: {
      side: 'blue',
      won: true,
      totalKills: 25,
      totalDeaths: 12,
      totalAssists: 58,
      totalGold: 57820,
      totalDamage: 76700,
      dragons: 3,
      barons: 1,
      towers: 8,
      participants: [
        {
          id: 'p-blue-top-4',
          userId: 'u-garen-owl',
          riotId: 'D4rkFl4me#CITY',
          isGuest: false,
          team: 'blue',
          role: 'TOP',
          championId: 86, // Garen
          championName: 'Garen',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: 19,
          stats: {
            kills: 5, deaths: 3, assists: 8, cs: 184, csPerMin: 7.1, gold: 11400,
            totalDamageToChampions: 14200, damageSharePercentage: 19, damageTaken: 19400,
            visionScore: 19, wardsPlaced: 10, wardsKilled: 3,
            items: [MOCK_ITEMS.egidaSolar, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.mazaEspinada, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 12], goldAt14: 4100, csAt14: 104, wonLane: true,
          }
        },
        {
          id: 'p-blue-jug-4',
          userId: 'u-lee-owl',
          riotId: 'LumeCore#KR',
          isGuest: false,
          team: 'blue',
          role: 'JUNGLA',
          championId: 64, // Lee Sin
          championName: 'Lee Sin',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: 21,
          stats: {
            kills: 7, deaths: 2, assists: 11, cs: 154, csPerMin: 5.9, gold: 11800,
            totalDamageToChampions: 16100, damageSharePercentage: 21, damageTaken: 18900,
            visionScore: 36, wardsPlaced: 18, wardsKilled: 7,
            items: [MOCK_ITEMS.hidraVoraz, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.dagaFilo, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 11], goldAt14: 4400, csAt14: 92, wonLane: true,
          }
        },
        {
          id: 'p-blue-mid-4',
          userId: 'u-ahri-owl',
          riotId: 'Pix3lQueen#EUW',
          isGuest: false,
          team: 'blue',
          role: 'MID',
          championId: 103, // Ahri
          championName: 'Ahri',
          championLevel: 15,
          wasAutofill: false,
          lpDelta: 20,
          stats: {
            kills: 6, deaths: 2, assists: 10, cs: 198, csPerMin: 7.6, gold: 12600,
            totalDamageToChampions: 19800, damageSharePercentage: 26, damageTaken: 11200,
            visionScore: 24, wardsPlaced: 12, wardsKilled: 5,
            items: [MOCK_ITEMS.sombreroRabadon, MOCK_ITEMS.tomoArcano, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 4600, csAt14: 114, wonLane: true,
          }
        },
        {
          id: 'p-blue-adc-4',
          userId: 'u-jinx-owl',
          riotId: 'GlitchKid#EUW',
          isGuest: false,
          team: 'blue',
          role: 'ADC',
          championId: 222, // Jinx
          championName: 'Jinx',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: 22,
          stats: {
            kills: 5, deaths: 1, assists: 8, cs: 204, csPerMin: 7.8, gold: 12900,
            totalDamageToChampions: 14200, damageSharePercentage: 19, damageTaken: 8900,
            visionScore: 18, wardsPlaced: 9, wardsKilled: 3,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.dagaFilo, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 7], goldAt14: 4300, csAt14: 116, wonLane: true,
          }
        },
        {
          id: 'p-blue-sup-4',
          userId: 'u-n1ghtfang',
          riotId: 'N1ghtfang#LAN',
          isGuest: false,
          team: 'blue',
          role: 'SUPPORT',
          championId: 99, // Lux
          championName: 'Lux',
          championLevel: 13,
          wasAutofill: false,
          lpDelta: 24,
          stats: {
            kills: 2, deaths: 4, assists: 21, cs: 64, csPerMin: 2.5, gold: 9120,
            totalDamageToChampions: 12400, damageSharePercentage: 16, damageTaken: 9800,
            visionScore: 64, wardsPlaced: 32, wardsKilled: 12,
            items: [MOCK_ITEMS.tomoArcano, MOCK_ITEMS.egidaSolar, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.veloBanshee, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 14], goldAt14: 3100, csAt14: 24, wonLane: true, isMvp: true,
          }
        }
      ]
    },
    redTeam: {
      side: 'red',
      won: false,
      totalKills: 12,
      totalDeaths: 25,
      totalAssists: 19,
      totalGold: 41200,
      totalDamage: 43200,
      dragons: 0,
      barons: 0,
      towers: 1,
      participants: [
        {
          id: 'p-red-top-4',
          userId: 'u-inv-1',
          riotId: 'ShadowTop#NA',
          isGuest: true,
          team: 'red',
          role: 'TOP',
          championId: 157, // Yasuo
          championName: 'Yasuo',
          championLevel: 13,
          wasAutofill: false,
          lpDelta: -16,
          stats: {
            kills: 3, deaths: 5, assists: 3, cs: 160, csPerMin: 6.2, gold: 8900,
            totalDamageToChampions: 11400, damageSharePercentage: 26, damageTaken: 18200,
            visionScore: 14, wardsPlaced: 7, wardsKilled: 2,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 3600, csAt14: 88, wonLane: false,
          }
        },
        {
          id: 'p-red-jug-4',
          userId: 'u-inv-2',
          riotId: 'NocturneMain#NA',
          isGuest: true,
          team: 'red',
          role: 'JUNGLA',
          championId: 30, // Karthus
          championName: 'Karthus',
          championLevel: 12,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 2, deaths: 6, assists: 4, cs: 128, csPerMin: 4.9, gold: 8100,
            totalDamageToChampions: 10200, damageSharePercentage: 24, damageTaken: 17400,
            visionScore: 22, wardsPlaced: 11, wardsKilled: 3,
            items: [MOCK_ITEMS.tomoArcano, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 11], goldAt14: 3200, csAt14: 70, wonLane: false,
          }
        },
        {
          id: 'p-red-mid-4',
          userId: 'u-inv-3',
          riotId: 'MidDiff#NA',
          isGuest: true,
          team: 'red',
          role: 'MID',
          championId: 238, // Zed
          championName: 'Zed',
          championLevel: 13,
          wasAutofill: false,
          lpDelta: -16,
          stats: {
            kills: 3, deaths: 5, assists: 3, cs: 168, csPerMin: 6.5, gold: 9200,
            totalDamageToChampions: 12100, damageSharePercentage: 28, damageTaken: 13900,
            visionScore: 16, wardsPlaced: 8, wardsKilled: 2,
            items: [MOCK_ITEMS.filoNocturno, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 3800, csAt14: 92, wonLane: false,
          }
        },
        {
          id: 'p-red-adc-4',
          userId: 'u-inv-4',
          riotId: 'SilverBot#NA',
          isGuest: true,
          team: 'red',
          role: 'ADC',
          championId: 22, // Ashe
          championName: 'Ashe',
          championLevel: 12,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 3, deaths: 4, assists: 4, cs: 172, csPerMin: 6.6, gold: 9400,
            totalDamageToChampions: 7800, damageSharePercentage: 18, damageTaken: 11400,
            visionScore: 16, wardsPlaced: 8, wardsKilled: 3,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 7], goldAt14: 3700, csAt14: 96, wonLane: false,
          }
        },
        {
          id: 'p-red-sup-4',
          userId: 'u-inv-5',
          riotId: 'HookMiss#NA',
          isGuest: true,
          team: 'red',
          role: 'SUPPORT',
          championId: 412, // Thresh
          championName: 'Thresh',
          championLevel: 10,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 1, deaths: 5, assists: 5, cs: 16, csPerMin: 0.6, gold: 5600,
            totalDamageToChampions: 1700, damageSharePercentage: 4, damageTaken: 14200,
            visionScore: 41, wardsPlaced: 20, wardsKilled: 6,
            items: [MOCK_ITEMS.tomoArcano, null, null, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 14], goldAt14: 2100, csAt14: 8, wonLane: false,
          }
        }
      ]
    }
  },

  // 5. Arcane Five - Victoria con Jinx (ADC)
  {
    id: 'flex-77',
    code: 'AF33',
    groupId: 'arcane-five',
    group: getGroupCtx('arcane-five'),
    source: 'import',
    durationSeconds: 2280,
    decidedAt: '2026-06-20T22:19:00Z',
    winningTeam: 'blue',
    mvpParticipantId: 'p-blue-adc-5',
    blueTeam: {
      side: 'blue',
      won: true,
      totalKills: 39,
      totalDeaths: 28,
      totalAssists: 72,
      totalGold: 72040,
      totalDamage: 109400,
      dragons: 3,
      barons: 2,
      towers: 9,
      participants: [
        {
          id: 'p-blue-top-5',
          userId: 'u-garen-5',
          riotId: 'AshenWolf#EUW',
          isGuest: false,
          team: 'blue',
          role: 'TOP',
          championId: 86, // Garen
          championName: 'Garen',
          championLevel: 17,
          wasAutofill: false,
          lpDelta: 18,
          stats: {
            kills: 8, deaths: 7, assists: 11, cs: 248, csPerMin: 6.5, gold: 15400,
            totalDamageToChampions: 24100, damageSharePercentage: 22, damageTaken: 34100,
            visionScore: 26, wardsPlaced: 14, wardsKilled: 5,
            items: [MOCK_ITEMS.egidaSolar, MOCK_ITEMS.mazaEspinada, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.hidraVoraz, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 12], goldAt14: 4200, csAt14: 108, wonLane: true,
          }
        },
        {
          id: 'p-blue-jug-5',
          userId: 'u-lee-5',
          riotId: 'LumeCore#KR',
          isGuest: false,
          team: 'blue',
          role: 'JUNGLA',
          championId: 64, // Lee Sin
          championName: 'Lee Sin',
          championLevel: 16,
          wasAutofill: false,
          lpDelta: 19,
          stats: {
            kills: 6, deaths: 6, assists: 18, cs: 184, csPerMin: 4.8, gold: 14200,
            totalDamageToChampions: 17800, damageSharePercentage: 16, damageTaken: 29400,
            visionScore: 48, wardsPlaced: 24, wardsKilled: 10,
            items: [MOCK_ITEMS.hidraVoraz, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.veloBanshee, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 11], goldAt14: 3900, csAt14: 84, wonLane: true,
          }
        },
        {
          id: 'p-blue-mid-5',
          userId: 'u-ahri-5',
          riotId: 'Pix3lQueen#EUW',
          isGuest: false,
          team: 'blue',
          role: 'MID',
          championId: 103, // Ahri
          championName: 'Ahri',
          championLevel: 18,
          wasAutofill: false,
          lpDelta: 20,
          stats: {
            kills: 9, deaths: 5, assists: 14, cs: 274, csPerMin: 7.2, gold: 16400,
            totalDamageToChampions: 29800, damageSharePercentage: 27, damageTaken: 19400,
            visionScore: 28, wardsPlaced: 14, wardsKilled: 6,
            items: [MOCK_ITEMS.sombreroRabadon, MOCK_ITEMS.relojArenaZhonya, MOCK_ITEMS.tomoArcano, MOCK_ITEMS.botasVeloces, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 4500, csAt14: 118, wonLane: true,
          }
        },
        {
          id: 'p-blue-adc-5',
          userId: 'u-n1ghtfang',
          riotId: 'N1ghtfang#LAN',
          isGuest: false,
          team: 'blue',
          role: 'ADC',
          championId: 222, // Jinx
          championName: 'Jinx',
          championLevel: 18,
          wasAutofill: false,
          lpDelta: 23,
          stats: {
            kills: 15, deaths: 6, assists: 9, cs: 226, csPerMin: 5.9, gold: 16240,
            totalDamageToChampions: 34200, damageSharePercentage: 31, damageTaken: 15800,
            visionScore: 22, wardsPlaced: 11, wardsKilled: 4,
            items: [MOCK_ITEMS.filoNocturno, MOCK_ITEMS.hidraVoraz, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.dagaFilo, MOCK_ITEMS.mazaEspinada, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 7], goldAt14: 4800, csAt14: 122, wonLane: true, isMvp: true,
          }
        },
        {
          id: 'p-blue-sup-5',
          userId: 'u-thresh-5',
          riotId: 'Sona#LAN',
          isGuest: false,
          team: 'blue',
          role: 'SUPPORT',
          championId: 412, // Thresh
          championName: 'Thresh',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: 18,
          stats: {
            kills: 1, deaths: 4, assists: 20, cs: 38, csPerMin: 1.0, gold: 9800,
            totalDamageToChampions: 3500, damageSharePercentage: 3, damageTaken: 24800,
            visionScore: 74, wardsPlaced: 38, wardsKilled: 14,
            items: [MOCK_ITEMS.tomoArcano, MOCK_ITEMS.egidaSolar, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 14], goldAt14: 2600, csAt14: 12, wonLane: true,
          }
        }
      ]
    },
    redTeam: {
      side: 'red',
      won: false,
      totalKills: 28,
      totalDeaths: 39,
      totalAssists: 48,
      totalGold: 65900,
      totalDamage: 91200,
      dragons: 2,
      barons: 0,
      towers: 4,
      participants: [
        {
          id: 'p-red-top-5',
          userId: 'u-morf-5',
          riotId: 'Morf#LAN',
          isGuest: false,
          team: 'red',
          role: 'TOP',
          championId: 157, // Yasuo
          championName: 'Yasuo',
          championLevel: 16,
          wasAutofill: false,
          lpDelta: -16,
          stats: {
            kills: 8, deaths: 8, assists: 8, cs: 240, csPerMin: 6.3, gold: 14800,
            totalDamageToChampions: 22400, damageSharePercentage: 25, damageTaken: 29800,
            visionScore: 22, wardsPlaced: 11, wardsKilled: 4,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.filoNocturno, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 4100, csAt14: 104, wonLane: false,
          }
        },
        {
          id: 'p-red-jug-5',
          userId: 'u-karthus-5',
          riotId: 'Zee#LAN',
          isGuest: false,
          team: 'red',
          role: 'JUNGLA',
          championId: 30, // Karthus
          championName: 'Karthus',
          championLevel: 15,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 5, deaths: 9, assists: 11, cs: 178, csPerMin: 4.7, gold: 13100,
            totalDamageToChampions: 21400, damageSharePercentage: 23, damageTaken: 26800,
            visionScore: 36, wardsPlaced: 16, wardsKilled: 6,
            items: [MOCK_ITEMS.tomoArcano, MOCK_ITEMS.sombreroRabadon, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 11], goldAt14: 3700, csAt14: 80, wonLane: false,
          }
        },
        {
          id: 'p-red-mid-5',
          userId: 'u-zed-5',
          riotId: 'Pyro#LAN',
          isGuest: false,
          team: 'red',
          role: 'MID',
          championId: 238, // Zed
          championName: 'Zed',
          championLevel: 16,
          wasAutofill: false,
          lpDelta: -16,
          stats: {
            kills: 6, deaths: 8, assists: 9, cs: 232, csPerMin: 6.1, gold: 14200,
            totalDamageToChampions: 22800, damageSharePercentage: 25, damageTaken: 21400,
            visionScore: 24, wardsPlaced: 12, wardsKilled: 5,
            items: [MOCK_ITEMS.filoNocturno, MOCK_ITEMS.dagaFilo, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 4100, csAt14: 106, wonLane: false,
          }
        },
        {
          id: 'p-red-adc-5',
          userId: 'u-ashe-5',
          riotId: 'Cr1msonByte#PSOE',
          isGuest: false,
          team: 'red',
          role: 'ADC',
          championId: 22, // Ashe
          championName: 'Ashe',
          championLevel: 16,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 7, deaths: 8, assists: 10, cs: 256, csPerMin: 6.7, gold: 14900,
            totalDamageToChampions: 19800, damageSharePercentage: 22, damageTaken: 18400,
            visionScore: 28, wardsPlaced: 14, wardsKilled: 6,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.dagaFilo, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 7], goldAt14: 4300, csAt14: 114, wonLane: false,
          }
        },
        {
          id: 'p-red-sup-5',
          userId: 'u-luxy-5',
          riotId: 'Luxy#LAN',
          isGuest: false,
          team: 'red',
          role: 'SUPPORT',
          championId: 99, // Lux
          championName: 'Lux',
          championLevel: 13,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 2, deaths: 6, assists: 10, cs: 32, csPerMin: 0.8, gold: 8900,
            totalDamageToChampions: 4800, damageSharePercentage: 5, damageTaken: 17200,
            visionScore: 56, wardsPlaced: 28, wardsKilled: 10,
            items: [MOCK_ITEMS.tomoArcano, MOCK_ITEMS.veloBanshee, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 14], goldAt14: 2500, csAt14: 12, wonLane: false,
          }
        }
      ]
    }
  },
  // 6. Scrim Squad - Choque 5v5 adicional (Victoria Equipo Azul)
  {
    id: 'scrim-205',
    code: 'SQ99',
    groupId: 'scrim-squad',
    group: getGroupCtx('scrim-squad'),
    source: 'import',
    durationSeconds: 1820,
    decidedAt: '2026-06-15T19:30:00Z',
    winningTeam: 'blue',
    mvpParticipantId: 'p-blue-mid-6',
    blueTeam: {
      side: 'blue',
      won: true,
      totalKills: 31,
      totalDeaths: 14,
      totalAssists: 62,
      totalGold: 66400,
      totalDamage: 88500,
      dragons: 3,
      barons: 1,
      towers: 8,
      participants: [
        {
          id: 'p-blue-top-6',
          userId: 'u-garen-6',
          riotId: 'HexHunter#EUW',
          isGuest: false,
          team: 'blue',
          role: 'TOP',
          championId: 86, // Garen
          championName: 'Garen',
          championLevel: 15,
          wasAutofill: false,
          lpDelta: 18,
          stats: {
            kills: 5, deaths: 3, assists: 11, cs: 220, csPerMin: 7.2, gold: 13200,
            totalDamageToChampions: 18200, damageSharePercentage: 21, damageTaken: 25100,
            visionScore: 22, wardsPlaced: 11, wardsKilled: 4,
            items: [MOCK_ITEMS.egidaSolar, MOCK_ITEMS.mazaEspinada, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 12], goldAt14: 4100, csAt14: 108, wonLane: true,
          }
        },
        {
          id: 'p-blue-jug-6',
          userId: 'u-lee-6',
          riotId: 'V0idWalker#EUW',
          isGuest: false,
          team: 'blue',
          role: 'JUNGLA',
          championId: 64, // Lee Sin
          championName: 'Lee Sin',
          championLevel: 15,
          wasAutofill: false,
          lpDelta: 19,
          stats: {
            kills: 8, deaths: 2, assists: 14, cs: 155, csPerMin: 5.1, gold: 12900,
            totalDamageToChampions: 16500, damageSharePercentage: 19, damageTaken: 21000,
            visionScore: 38, wardsPlaced: 16, wardsKilled: 8,
            items: [MOCK_ITEMS.hidraVoraz, MOCK_ITEMS.veloBanshee, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 11], goldAt14: 4300, csAt14: 82, wonLane: true,
          }
        },
        {
          id: 'p-blue-mid-6',
          userId: 'u-ahri-6',
          riotId: 'N1ghtfang#LAN',
          isGuest: false,
          team: 'blue',
          role: 'MID',
          championId: 103, // Ahri
          championName: 'Ahri',
          championLevel: 16,
          wasAutofill: false,
          lpDelta: 22,
          stats: {
            kills: 11, deaths: 2, assists: 12, cs: 248, csPerMin: 8.2, gold: 16100,
            totalDamageToChampions: 31200, damageSharePercentage: 35, damageTaken: 14200,
            visionScore: 32, wardsPlaced: 14, wardsKilled: 6,
            items: [MOCK_ITEMS.sombreroRabadon, MOCK_ITEMS.relojArenaZhonya, MOCK_ITEMS.tomoArcano, MOCK_ITEMS.botasVeloces, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 5100, csAt14: 124, wonLane: true,
          }
        },
        {
          id: 'p-blue-adc-6',
          userId: 'u-jinx-6',
          riotId: 'Pix3lQueen#EUW',
          isGuest: false,
          team: 'blue',
          role: 'ADC',
          championId: 222, // Jinx
          championName: 'Jinx',
          championLevel: 15,
          wasAutofill: false,
          lpDelta: 18,
          stats: {
            kills: 6, deaths: 4, assists: 13, cs: 235, csPerMin: 7.7, gold: 14300,
            totalDamageToChampions: 17800, damageSharePercentage: 20, damageTaken: 15800,
            visionScore: 24, wardsPlaced: 12, wardsKilled: 5,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.filoNocturno, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 7], goldAt14: 4200, csAt14: 110, wonLane: false,
          }
        },
        {
          id: 'p-blue-sup-6',
          userId: 'u-lux-6',
          riotId: 'Cr1msonByte#EUW',
          isGuest: false,
          team: 'blue',
          role: 'SUPPORT',
          championId: 99, // Lux
          championName: 'Lux',
          championLevel: 13,
          wasAutofill: false,
          lpDelta: 16,
          stats: {
            kills: 1, deaths: 3, assists: 12, cs: 28, csPerMin: 0.9, gold: 9900,
            totalDamageToChampions: 4800, damageSharePercentage: 5, damageTaken: 13200,
            visionScore: 58, wardsPlaced: 29, wardsKilled: 12,
            items: [MOCK_ITEMS.tomoArcano, MOCK_ITEMS.veloBanshee, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 3], goldAt14: 2800, csAt14: 14, wonLane: false,
          }
        }
      ]
    },
    redTeam: {
      side: 'red',
      won: false,
      totalKills: 14,
      totalDeaths: 31,
      totalAssists: 26,
      totalGold: 53200,
      totalDamage: 54100,
      dragons: 1,
      barons: 0,
      towers: 2,
      participants: [
        {
          id: 'p-red-top-6',
          userId: 'u-darius-6',
          riotId: 'AshenWolf#EUW',
          isGuest: false,
          team: 'red',
          role: 'TOP',
          championId: 122, // Darius
          championName: 'Darius',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: -16,
          stats: {
            kills: 4, deaths: 6, assists: 4, cs: 198, csPerMin: 6.5, gold: 11200,
            totalDamageToChampions: 13200, damageSharePercentage: 24, damageTaken: 28400,
            visionScore: 18, wardsPlaced: 9, wardsKilled: 3,
            items: [MOCK_ITEMS.egidaSolar, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 12], goldAt14: 3600, csAt14: 94, wonLane: false,
          }
        },
        {
          id: 'p-red-jug-6',
          userId: 'u-karthus-6',
          riotId: 'D4rkFl4me#EUW',
          isGuest: false,
          team: 'red',
          role: 'JUNGLA',
          championId: 30, // Karthus
          championName: 'Karthus',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 3, deaths: 7, assists: 6, cs: 168, csPerMin: 5.5, gold: 10800,
            totalDamageToChampions: 16400, damageSharePercentage: 30, damageTaken: 22100,
            visionScore: 26, wardsPlaced: 12, wardsKilled: 5,
            items: [MOCK_ITEMS.sombreroRabadon, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 11], goldAt14: 3400, csAt14: 78, wonLane: false,
          }
        },
        {
          id: 'p-red-mid-6',
          userId: 'u-zed-6',
          riotId: 'NeonRift#EUW',
          isGuest: false,
          team: 'red',
          role: 'MID',
          championId: 238, // Zed
          championName: 'Zed',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: -17,
          stats: {
            kills: 3, deaths: 7, assists: 5, cs: 210, csPerMin: 6.9, gold: 11900,
            totalDamageToChampions: 11200, damageSharePercentage: 21, damageTaken: 19800,
            visionScore: 22, wardsPlaced: 10, wardsKilled: 4,
            items: [MOCK_ITEMS.filoNocturno, MOCK_ITEMS.dagaFilo, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 3700, csAt14: 98, wonLane: false,
          }
        },
        {
          id: 'p-red-adc-6',
          userId: 'u-ashe-6',
          riotId: 'St0rmcaller#EUW',
          isGuest: false,
          team: 'red',
          role: 'ADC',
          championId: 22, // Ashe
          championName: 'Ashe',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 3, deaths: 6, assists: 6, cs: 215, csPerMin: 7.1, gold: 11400,
            totalDamageToChampions: 10500, damageSharePercentage: 19, damageTaken: 17200,
            visionScore: 24, wardsPlaced: 11, wardsKilled: 4,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 7], goldAt14: 3900, csAt14: 102, wonLane: true,
          }
        },
        {
          id: 'p-red-sup-6',
          userId: 'u-thresh-6',
          riotId: 'GlitchKid#EUW',
          isGuest: false,
          team: 'red',
          role: 'SUPPORT',
          championId: 412, // Thresh
          championName: 'Thresh',
          championLevel: 12,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 1, deaths: 5, assists: 5, cs: 24, csPerMin: 0.8, gold: 7900,
            totalDamageToChampions: 2800, damageSharePercentage: 5, damageTaken: 16400,
            visionScore: 48, wardsPlaced: 24, wardsKilled: 9,
            items: [MOCK_ITEMS.cetroAbisal, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 14], goldAt14: 2400, csAt14: 10, wonLane: true,
          }
        }
      ]
    }
  },
  // 7. Night Owls - Choque 5v5 adicional (Victoria Equipo Rojo)
  {
    id: 'owl-119',
    code: 'NO22',
    groupId: 'night-owls',
    group: getGroupCtx('night-owls'),
    source: 'import',
    durationSeconds: 1680,
    decidedAt: '2026-06-11T23:15:00Z',
    winningTeam: 'red',
    mvpParticipantId: 'p-red-mid-7',
    blueTeam: {
      side: 'blue',
      won: false,
      totalKills: 16,
      totalDeaths: 29,
      totalAssists: 30,
      totalGold: 48900,
      totalDamage: 52000,
      dragons: 1,
      barons: 0,
      towers: 2,
      participants: [
        {
          id: 'p-blue-top-7',
          userId: 'u-garen-7',
          riotId: 'LumeCore#NA',
          isGuest: false,
          team: 'blue',
          role: 'TOP',
          championId: 86, // Garen
          championName: 'Garen',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: -16,
          stats: {
            kills: 4, deaths: 6, assists: 5, cs: 185, csPerMin: 6.6, gold: 10400,
            totalDamageToChampions: 12400, damageSharePercentage: 24, damageTaken: 26100,
            visionScore: 19, wardsPlaced: 10, wardsKilled: 3,
            items: [MOCK_ITEMS.egidaSolar, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 12], goldAt14: 3600, csAt14: 92, wonLane: false,
          }
        },
        {
          id: 'p-blue-jug-7',
          userId: 'u-lee-7',
          riotId: 'Zer0Cool#NA',
          isGuest: false,
          team: 'blue',
          role: 'JUNGLA',
          championId: 64, // Lee Sin
          championName: 'Lee Sin',
          championLevel: 13,
          wasAutofill: false,
          lpDelta: -16,
          stats: {
            kills: 3, deaths: 6, assists: 7, cs: 138, csPerMin: 4.9, gold: 9800,
            totalDamageToChampions: 11500, damageSharePercentage: 22, damageTaken: 21400,
            visionScore: 28, wardsPlaced: 14, wardsKilled: 5,
            items: [MOCK_ITEMS.hidraVoraz, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 11], goldAt14: 3500, csAt14: 74, wonLane: false,
          }
        },
        {
          id: 'p-blue-mid-7',
          userId: 'u-ahri-7',
          riotId: 'ByteSiren#NA',
          isGuest: false,
          team: 'blue',
          role: 'MID',
          championId: 103, // Ahri
          championName: 'Ahri',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: -17,
          stats: {
            kills: 5, deaths: 6, assists: 6, cs: 195, csPerMin: 7.0, gold: 11100,
            totalDamageToChampions: 14200, damageSharePercentage: 27, damageTaken: 18200,
            visionScore: 24, wardsPlaced: 11, wardsKilled: 4,
            items: [MOCK_ITEMS.sombreroRabadon, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 3800, csAt14: 100, wonLane: false,
          }
        },
        {
          id: 'p-blue-adc-7',
          userId: 'u-ashe-7',
          riotId: 'DarkLord#NA',
          isGuest: false,
          team: 'blue',
          role: 'ADC',
          championId: 22, // Ashe
          championName: 'Ashe',
          championLevel: 13,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 3, deaths: 5, assists: 6, cs: 190, csPerMin: 6.8, gold: 10200,
            totalDamageToChampions: 11100, damageSharePercentage: 21, damageTaken: 16100,
            visionScore: 22, wardsPlaced: 10, wardsKilled: 4,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 7], goldAt14: 3700, csAt14: 98, wonLane: false,
          }
        },
        {
          id: 'p-blue-sup-7',
          userId: 'u-lux-7',
          riotId: 'StarGazer#NA',
          isGuest: false,
          team: 'blue',
          role: 'SUPPORT',
          championId: 99, // Lux
          championName: 'Lux',
          championLevel: 11,
          wasAutofill: false,
          lpDelta: -15,
          stats: {
            kills: 1, deaths: 6, assists: 6, cs: 22, csPerMin: 0.8, gold: 7400,
            totalDamageToChampions: 2800, damageSharePercentage: 5, damageTaken: 15100,
            visionScore: 42, wardsPlaced: 21, wardsKilled: 7,
            items: [MOCK_ITEMS.tomoArcano, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 14], goldAt14: 2200, csAt14: 8, wonLane: false,
          }
        }
      ]
    },
    redTeam: {
      side: 'red',
      won: true,
      totalKills: 29,
      totalDeaths: 16,
      totalAssists: 58,
      totalGold: 62800,
      totalDamage: 86000,
      dragons: 3,
      barons: 1,
      towers: 7,
      participants: [
        {
          id: 'p-red-top-7',
          userId: 'u-darius-7',
          riotId: 'WolfGamer#NA',
          isGuest: false,
          team: 'red',
          role: 'TOP',
          championId: 122, // Darius
          championName: 'Darius',
          championLevel: 15,
          wasAutofill: false,
          lpDelta: 18,
          stats: {
            kills: 7, deaths: 3, assists: 10, cs: 210, csPerMin: 7.5, gold: 12800,
            totalDamageToChampions: 19800, damageSharePercentage: 23, damageTaken: 22100,
            visionScore: 24, wardsPlaced: 12, wardsKilled: 5,
            items: [MOCK_ITEMS.egidaSolar, MOCK_ITEMS.mazaEspinada, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 12], goldAt14: 4200, csAt14: 106, wonLane: true,
          }
        },
        {
          id: 'p-red-jug-7',
          userId: 'u-karthus-7',
          riotId: 'ShadowWalker#NA',
          isGuest: false,
          team: 'red',
          role: 'JUNGLA',
          championId: 30, // Karthus
          championName: 'Karthus',
          championLevel: 15,
          wasAutofill: false,
          lpDelta: 19,
          stats: {
            kills: 6, deaths: 4, assists: 14, cs: 165, csPerMin: 5.9, gold: 12400,
            totalDamageToChampions: 21200, damageSharePercentage: 25, damageTaken: 19400,
            visionScore: 32, wardsPlaced: 15, wardsKilled: 7,
            items: [MOCK_ITEMS.sombreroRabadon, MOCK_ITEMS.veloBanshee, MOCK_ITEMS.botasVeloces, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 11], goldAt14: 4100, csAt14: 88, wonLane: true,
          }
        },
        {
          id: 'p-red-mid-7',
          userId: 'u-yasuo-7',
          riotId: 'N1ghtfang#LAN',
          isGuest: false,
          team: 'red',
          role: 'MID',
          championId: 157, // Yasuo
          championName: 'Yasuo',
          championLevel: 16,
          wasAutofill: false,
          lpDelta: 22,
          stats: {
            kills: 10, deaths: 3, assists: 11, cs: 242, csPerMin: 8.6, gold: 15800,
            totalDamageToChampions: 26400, damageSharePercentage: 31, damageTaken: 16500,
            visionScore: 28, wardsPlaced: 13, wardsKilled: 6,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.filoNocturno, MOCK_ITEMS.botasVeloces, MOCK_ITEMS.dagaFilo, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 14], goldAt14: 4900, csAt14: 120, wonLane: true,
          }
        },
        {
          id: 'p-red-adc-7',
          userId: 'u-jinx-7',
          riotId: 'Moonlight#NA',
          isGuest: false,
          team: 'red',
          role: 'ADC',
          championId: 222, // Jinx
          championName: 'Jinx',
          championLevel: 14,
          wasAutofill: false,
          lpDelta: 17,
          stats: {
            kills: 5, deaths: 3, assists: 12, cs: 218, csPerMin: 7.8, gold: 13100,
            totalDamageToChampions: 15200, damageSharePercentage: 18, damageTaken: 14200,
            visionScore: 22, wardsPlaced: 11, wardsKilled: 4,
            items: [MOCK_ITEMS.hojaInfinita, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketAmarillo],
            spells: [4, 7], goldAt14: 4100, csAt14: 105, wonLane: true,
          }
        },
        {
          id: 'p-red-sup-7',
          userId: 'u-thresh-7',
          riotId: 'SoulReaper#NA',
          isGuest: false,
          team: 'red',
          role: 'SUPPORT',
          championId: 412, // Thresh
          championName: 'Thresh',
          championLevel: 13,
          wasAutofill: false,
          lpDelta: 16,
          stats: {
            kills: 1, deaths: 3, assists: 11, cs: 26, csPerMin: 0.9, gold: 8700,
            totalDamageToChampions: 3400, damageSharePercentage: 4, damageTaken: 15800,
            visionScore: 52, wardsPlaced: 26, wardsKilled: 10,
            items: [MOCK_ITEMS.cetroAbisal, MOCK_ITEMS.botasVeloces, null, null, null, null, MOCK_ITEMS.trinketRojo],
            spells: [4, 14], goldAt14: 2600, csAt14: 12, wonLane: true,
          }
        }
      ]
    }
  }
];

/* ------------------------------------------------------------------------------------------
 * PLACEHOLDER AISLADO: clasificación e hitos
 *
 * Va aquí abajo, en dos mapas, y no repartido por las 1.700 líneas de arriba, para que el día
 * que exista el endpoint de historial se borre de una pieza. `enrichMatchesForUser()` los
 * fusiona sobre las partidas al construir el store.
 *
 * BACKEND NOTE: ambos los calcula el servidor. La posición en la clasificación depende del
 * estado del grupo en el instante de la partida (no se puede recalcular a posteriori en
 * cliente), y los hitos vienen de la telemetría de Riot.
 * ---------------------------------------------------------------------------------------- */

/** `matchId -> participantId -> [posición antes, posición después]` en la clasificación del grupo. */
const RANKS_BY_MATCH: Record<string, Record<string, [number, number]>> = {
  'lan-2895': {
    'p-blue-top-1': [8, 7],
    'p-blue-jug-1': [6, 5],
    'p-blue-mid-1': [5, 4],
    'p-blue-adc-1': [3, 2],
    'p-blue-sup-1': [2, 1],
    'p-red-top-1': [4, 6],
    'p-red-jug-1': [10, 10],
    'p-red-mid-1': [9, 9],
    'p-red-adc-1': [7, 8],
    'p-red-sup-1': [1, 3],
  },
  'lan-2891': {
    'p-blue-top-2': [2, 4],
    'p-blue-jug-2': [9, 9],
    'p-blue-mid-2': [4, 5],
    'p-blue-adc-2': [10, 10],
    'p-blue-sup-2': [7, 8],
    'p-red-top-2': [6, 6],
    'p-red-jug-2': [1, 1],
    'p-red-mid-2': [8, 7],
    'p-red-adc-2': [3, 2],
    'p-red-sup-2': [5, 3],
  },
  'scrim-204': {
    'p-blue-top-3': [2, 2],
    'p-blue-jug-3': [5, 3],
    'p-blue-mid-3': [6, 4],
    'p-blue-adc-3': [1, 1],
    'p-blue-sup-3': [7, 6],
    'p-red-top-3': [10, 10],
    'p-red-jug-3': [9, 9],
    'p-red-mid-3': [8, 8],
    'p-red-adc-3': [4, 7],
    'p-red-sup-3': [3, 5],
  },
  'owl-118': {
    'p-blue-top-4': [4, 1],
    'p-blue-jug-4': [6, 6],
    'p-blue-mid-4': [5, 3],
    'p-blue-adc-4': [9, 8],
    'p-blue-sup-4': [8, 7],
    'p-red-top-4': [3, 5],
    'p-red-jug-4': [7, 9],
    'p-red-mid-4': [1, 2],
    'p-red-adc-4': [10, 10],
    'p-red-sup-4': [2, 4],
  },
  'flex-77': {
    'p-blue-top-5': [9, 8],
    'p-blue-jug-5': [8, 6],
    'p-blue-mid-5': [2, 1],
    'p-blue-adc-5': [5, 4],
    'p-blue-sup-5': [3, 2],
    'p-red-top-5': [7, 9],
    'p-red-jug-5': [6, 7],
    'p-red-mid-5': [1, 3],
    'p-red-adc-5': [4, 5],
    'p-red-sup-5': [10, 10],
  },
  'scrim-205': {
    'p-blue-top-6': [8, 6],
    'p-blue-jug-6': [2, 1],
    'p-blue-mid-6': [4, 2],
    'p-blue-adc-6': [6, 5],
    'p-blue-sup-6': [9, 8],
    'p-red-top-6': [3, 4],
    'p-red-jug-6': [5, 7],
    'p-red-mid-6': [1, 3],
    'p-red-adc-6': [7, 9],
    'p-red-sup-6': [10, 10],
  },
  'owl-119': {
    'p-blue-top-7': [2, 3],
    'p-blue-jug-7': [8, 9],
    'p-blue-mid-7': [5, 6],
    'p-blue-adc-7': [9, 10],
    'p-blue-sup-7': [6, 7],
    'p-red-top-7': [10, 8],
    'p-red-jug-7': [1, 1],
    'p-red-mid-7': [3, 2],
    'p-red-adc-7': [7, 5],
    'p-red-sup-7': [4, 4],
  },
};

/** Quién se llevó cada primer objetivo. */
const MILESTONES_BY_MATCH: Record<string, MatchMilestones> = {
  // Los hitos concuerdan con los objetivos de cada equipo: quien acabó con 3 dragones y el
  // barón es también quien abrió el marcador de objetivos.
  'lan-2895': {
    firstBloodParticipantId: 'p-blue-mid-1',
    firstTowerTeam: 'blue',
    firstDragonTeam: 'red',
    firstBaronTeam: 'blue',
  },
  'lan-2891': {
    firstBloodParticipantId: 'p-red-jug-2',
    firstTowerTeam: 'red',
    firstDragonTeam: 'blue',
    firstBaronTeam: 'red',
  },
  'scrim-204': {
    firstBloodParticipantId: 'p-blue-jug-3',
    firstTowerTeam: 'blue',
    firstDragonTeam: 'blue',
    firstBaronTeam: 'blue',
  },
  'owl-118': {
    firstBloodParticipantId: 'p-blue-sup-4',
    firstTowerTeam: 'blue',
    firstDragonTeam: 'blue',
    firstBaronTeam: 'blue',
  },
  'flex-77': {
    firstBloodParticipantId: 'p-red-mid-5',
    firstTowerTeam: 'blue',
    firstDragonTeam: 'red',
    firstBaronTeam: 'blue',
  },
  'scrim-205': {
    firstBloodParticipantId: 'p-blue-mid-6',
    firstTowerTeam: 'blue',
    firstDragonTeam: 'blue',
    firstBaronTeam: 'blue',
  },
  // El rojo remonta: el azul abre con la primera sangre y la primera torre y aun así pierde.
  'owl-119': {
    firstBloodParticipantId: 'p-blue-jug-7',
    firstTowerTeam: 'blue',
    firstDragonTeam: 'red',
    firstBaronTeam: 'red',
  },
};

/* ------------------------------------------------------------------------------------------
 * PLACEHOLDER AISLADO: proyección de la semilla sobre las ligas reales del usuario
 *
 * La semilla de arriba está escrita contra cuatro grupos inventados (`lan-challenger`,
 * `scrim-squad`…), pero la barra lateral y la lista de grupos las sirve el backend real, con
 * ids UUID. Sin esta proyección, entrar en una liga tuya y pulsar «Historial» llamaba a
 * `matchesByGroup(<uuid>)`, que no encontraba nada, y la vista pintaba «Sin partidas todavía»:
 * el historial de grupo era literalmente inalcanzable navegando.
 *
 * `buildMockHistory()` reparte una copia de las siete partidas sobre cada liga del usuario, con
 * su identidad, sus compañeros de verdad y sus propias fechas. Así el historial personal y el de
 * grupo dejan de ser dos mundos: la etiqueta de liga de una fila personal lleva a un grupo que
 * sí está en tu barra lateral, y ese grupo enseña esa misma partida.
 *
 * BACKEND NOTE: desechable entero. El día que exista `GET /matches` (paginado y filtrado en
 * servidor) se borra este bloque junto con `SEED_MATCHES` y los dos mapas de arriba.
 * ---------------------------------------------------------------------------------------- */

/**
 * La ranura que la semilla reserva al usuario de la sesión. Cada una de las siete partidas tiene
 * exactamente un participante con este Riot ID, colocado a mano en un bando y una línea distintos
 * para que el historial personal no salga siempre desde el mismo sitio. La proyección la usa como
 * ancla: ahí es donde entra quien mira, cuando le toca jugar.
 */
const VIEWER_SLOT_RIOT_ID = 'N1ghtfang#LAN';

/**
 * De cada diez partidas, en siete juega el usuario. Que en las otras tres no aparezca no es un
 * descuido: es lo que hace visible el filtro «Participación → Otras» del historial de grupo, y lo
 * que distingue el registro colectivo del personal. Con el usuario en las siete partidas —que es
 * lo que hacía la semilla— ese filtro devolvía siempre una lista vacía.
 */
const VIEWER_PLAY_RATE = 7;

/** Nombres de relleno para las ranuras que ni el usuario ni el roster real llegan a ocupar. */
const FILLER_RIOT_IDS = [
  'Vexil#LAN', 'Orbyn#EUW', 'Kaltra#NA', 'Sombra#LAS', 'Wren#KR',
  'Tesela#BR', 'Nocturn#EUNE', 'Halcon#LAN',
];

/** La liga sobre la que se proyecta una copia del historial. Espejo reducido de `GroupView`. */
export interface MockHistoryGroup {
  id: string;
  name: string;
  region: string;
  initials: string;
  c1: string;
  c2: string;
}

/** Quién mira: sus partidas son las que salen en el historial personal. */
export interface MockHistoryViewer {
  userId: string;
  riotId: string;
}

/** Un compañero de liga, tal y como lo guarda el roster mock (`GroupStore.rosterOf`). */
export interface MockHistoryMember {
  userId?: string;
  name: string;
  tag: string;
  avatar?: string;
}

/**
 * El historial completo del usuario: las siete partidas semilla proyectadas sobre cada una de
 * sus ligas.
 *
 * `rosterOf` es una función y no una lista porque el roster real de un grupo solo está sembrado
 * después de que `GroupBridge` lo traiga (al entrar en cualquier sub-vista del grupo). Antes de
 * eso las ranuras conservan los nombres de la semilla, y al llegar el roster la lista se
 * recalcula sola: todo esto cuelga de signals.
 */
export function buildMockHistory(
  groups: readonly MockHistoryGroup[],
  viewer: MockHistoryViewer,
  rosterOf: (groupId: string) => readonly MockHistoryMember[],
): Match[] {
  const out: Match[] = [];
  for (const group of groups) {
    const roster = rosterOf(group.id).filter((m) => identityOf(m).userId !== viewer.userId);
    for (const seed of SEED_MATCHES) {
      out.push(project(seed, group, viewer, roster));
    }
  }
  return out;
}

function project(
  seed: Match,
  group: MockHistoryGroup,
  viewer: MockHistoryViewer,
  roster: readonly MockHistoryMember[],
): Match {
  // Id namespaced: la ruta `/app/historial/:id` tiene que poder distinguir la copia de una liga
  // de la de otra. Los ids de PARTICIPANTE no se tocan — solo se comparan dentro de su partida
  // (MVP, primera sangre, clasificación), así que namespacearlos solo rompería esos tres mapas.
  const id = `${group.id}--${seed.id}`;
  const ranks = RANKS_BY_MATCH[seed.id];

  const slots = [...seed.blueTeam.participants, ...seed.redTeam.participants];
  const viewerSlot = slots.findIndex((p) => p.riotId === VIEWER_SLOT_RIOT_ID);
  const viewerPlays = viewerSlot >= 0 && hash(`${id}:juega`) % 10 < VIEWER_PLAY_RATE;

  // El roster real entra por una ranura distinta en cada partida, para que la misma persona no
  // salga siempre de jungla azul. Cada compañero ocupa como mucho una: repetirlos para llenar
  // las diez pondría a alguien enfrentándose a sí mismo.
  const offset = hash(id) % slots.length;
  const free: number[] = [];
  for (let k = 0; k < slots.length; k++) {
    const index = (offset + k) % slots.length;
    if (viewerPlays && index === viewerSlot) continue;
    free.push(index);
  }
  const bySlot = new Map<number, MockHistoryMember>();
  roster.slice(0, free.length).forEach((member, j) => bySlot.set(free[j], member));

  const rebuilt = slots.map((p, index) => {
    const withRank = applyRank(p, ranks);
    if (viewerPlays && index === viewerSlot) {
      return { ...withRank, userId: viewer.userId, riotId: viewer.riotId, isGuest: false };
    }
    const member = bySlot.get(index);
    if (member) {
      const who = identityOf(member);
      return {
        ...withRank,
        userId: who.userId,
        riotId: who.riotId,
        isGuest: false,
        avatarUrl: member.avatar,
      };
    }
    // La ranura del usuario cuando no juega: dejarle su Riot ID puesto haría creer que jugó.
    if (index === viewerSlot) {
      const filler = FILLER_RIOT_IDS[hash(`${id}:relleno`) % FILLER_RIOT_IDS.length];
      return { ...withRank, userId: `mock:${filler}`, riotId: filler, isGuest: true };
    }
    return withRank;
  });

  const split = seed.blueTeam.participants.length;
  const blueTeam: TeamSummary = { ...seed.blueTeam, participants: rebuilt.slice(0, split) };
  const redTeam: TeamSummary = { ...seed.redTeam, participants: rebuilt.slice(split) };

  const userParticipant = viewerPlays ? rebuilt[viewerSlot] : undefined;

  return {
    ...seed,
    id,
    groupId: group.id,
    group: {
      id: group.id,
      name: group.name,
      tag: group.region,
      initials: group.initials,
      color1: group.c1,
      color2: group.c2,
      seasonName: '2026 · Temporada 2',
    },
    // Cada liga corre su propio calendario: sin este desfase las siete partidas de todos los
    // grupos caerían en el mismo instante y el orden por fecha del historial personal sería un
    // empate de N grupos.
    decidedAt: shiftDays(seed.decidedAt, -(hash(group.id) % 21)),
    blueTeam,
    redTeam,
    milestones: MILESTONES_BY_MATCH[seed.id],
    userParticipant,
    userOutcome: userParticipant
      ? userParticipant.team === seed.winningTeam
        ? 'win'
        : 'loss'
      : undefined,
  };
}

/** La posición en la clasificación de ese participante, si la partida la tiene registrada. */
function applyRank(
  p: MatchParticipant,
  ranks: Record<string, [number, number]> | undefined,
): MatchParticipant {
  const pair = ranks?.[p.id];
  return pair ? { ...p, rankBefore: pair[0], rankAfter: pair[1] } : p;
}

/**
 * Identidad estable de un compañero. El `userId` real llega cuando `GroupBridge` ha sembrado el
 * roster del backend; los rosters puramente mock no lo traen, y para esos la clave es su tag, que
 * también es único.
 */
function identityOf(member: MockHistoryMember): { userId: string; riotId: string } {
  return { userId: member.userId ?? `mock:${member.tag}`, riotId: member.tag || member.name };
}

function shiftDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}
