/**
 * Contrato de `core/game-data`, espejo exacto de los DTOs de
 * `GET /api/v1/game-data/*` (`com.cgc.cc.gamedata`).
 *
 * Todas las `iconUrl`/`loadingUrl`/`splashUrl` son URLs ABSOLUTAS ya montadas
 * por el backend (`AssetUrls` del lado servidor). El front NUNCA concatena una
 * base de ddragon: es el requisito que permite migrar a un mirror propio (p.
 * ej. Cloudflare R2) cambiando una sola property del backend, sin tocar nada
 * aquí. Ver "Contrato HTTP" del plan del módulo.
 */

/** Campeón tal y como lo lista `GET /game-data/champions` (173 filas, sin paginar). */
export interface ChampionSummary {
  /** La "key" numérica de ddragon: id estable de la FK, no cambia con los reworks. */
  id: number;
  /** Slug usado en rutas/URLs de asset ("Ahri", "MonkeyKing"). */
  slug: string;
  name: string;
  title: string;
  /** Vocabulario de Riot, en inglés a propósito: lo traduce `shared/champion-tags`. */
  tags: string[];
  iconUrl: string;
  loadingUrl: string;
}

/** Las cinco ranuras de habilidad de un campeón. */
export type AbilitySlot = 'PASSIVE' | 'Q' | 'W' | 'E' | 'R';

/** Una habilidad (pasiva o Q/W/E/R), tal y como viaja dentro de `ChampionDetail`. */
export interface ChampionAbility {
  slot: AbilitySlot;
  name: string;
  iconUrl: string;
}

/** `GET /game-data/champions/{id}`: el resumen más el splash y las 5 habilidades. */
export interface ChampionDetail extends ChampionSummary {
  /** Splash art. Ojo: esta URL NO lleva versión (derivada del slug, ver backend). */
  splashUrl: string;
  abilities: ChampionAbility[];
}

/** `GET /game-data/summoner-spells`. */
export interface SummonerSpell {
  id: number;
  slug: string;
  name: string;
  iconUrl: string;
  modes: string[];
}

/** Un elemento de `GET /game-data/items` (paginado, ver `GameDataApi.items`). */
export interface GameItem {
  id: number;
  name: string;
  iconUrl: string;
  totalGold: number;
  purchasable: boolean;
  /** `false` = retirado por Riot; nunca se borra, solo se marca. */
  available: boolean;
}

/**
 * `GET /game-data/manifest`. `version: null` significa que el backend nunca ha
 * importado el catálogo todavía: es una respuesta 200 válida con lista vacía,
 * no un error (ver casos edge en `game-data-store.spec.ts`).
 */
export interface GameDataManifest {
  version: string | null;
  updatedAt: string | null;
}
