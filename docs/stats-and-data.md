# Datos derivados: stats, ranking, premios, badges, perfil

Todo es **mock determinista**. La base es un PRNG seedeado por strings, así una misma
entrada siempre da los mismos números (estable entre renders, sin backend).

## Motor de seeding (`group-ranking.ts`)

- `hash(str)` → semilla 32-bit (FNV-1a).
- `seeded(seed)` / `mulberry32(seed)` → generador `() => number` en [0,1).
- `sparkPoints(spark, w, h)` → string de `points` para el SVG del sparkline.

## Estadísticas por grupo (`group-stats.ts`)

`statsFor(groupId, roster, scope)` produce `MemberStats[]` (una pasada por miembro,
**fuente única**), seedeado por `tag + scope + groupId`. `scope ∈ noche | temporada |
historico` escala el volumen de partidas (`SCOPE_GAMES`).

De ahí se proyectan 4 superficies:

- `summaryFor` → RESUMEN (MVP, mejor combo, racha, totales).
- `leaderboardsFor` → mini-leaderboards por métrica (winrate, KDA, main, daño, CS, visión).
- `awardsFor` → PREMIOS (granjero, carry silencioso, ward simp, penta hunter, señor del
  CC, donante) — "métricas para reírse".
- `playerTiles` → tiles del panel expandido de un jugador.

El **MVP** es el de mayor `rating` compuesto (winrate + KDA + daño).

## Badges cross-surface (`group-badges.ts`)

`badgesFor(groupId, roster, scope='temporada')` deriva del **mismo** `statsFor`:
MVP + cada premio, cada uno fijado a su ganador. Se usan en ranking, lista de miembros,
wizard y sala — así un jugador lleva sus trofeos a todas partes.

> **Clave por NOMBRE** (no tag), porque es el único identificador compartido en el mock.
> `BACKEND NOTE` en el código: pasar a id/tag estable.

## Ranking del grupo (`group-ranking.ts`)

`rankingFor(groupId, count)` genera un leaderboard ordenado por `rating`, seedeado por
**solo el groupId**, usando un **NAME_POOL propio** (tags distintos: PSOE, CITY, 666…).

> ⚠️ Esto NO se deriva del roster real ni de `statsFor`. El ranking y las estadísticas
> son dos fuentes independientes seedeadas distinto → un mismo jugador puede mostrar
> winrates diferentes en una pantalla y otra. El comentario lo reconoce ("en sync por
> convención"). Ver [edge-cases.md](edge-cases.md).

## Detalle de miembro (`member-detail.ts`)

`memberDetail(member, roster)` (seedeado por tag): top campeones, roles (`FLEX` ~45% del
tiempo, si no 1-2 roles), y 3 head-to-head (mejor duo, víctima favorita, peor pesadilla)
tomados de compañeros reales del roster, completados con `FALLBACK_FOES` si el roster es
pequeño. `opggUrl(tag)` construye el enlace a OP.GG.

## Perfil de jugador (`player-profile.ts`)

`buildPlayerProfile(user, groups, rosterOf)`: carrera **agregada cross-grupo** del
usuario actual, seedeada por su tag. Suma records por grupo, KDA global, racha/forma
reciente, mejor aliado / némesis / víctima favorita (de todos los rosters dedupeados),
top campeones. La vista aclara que es cross-grupo (para cifras exactas, abrir las stats
del grupo).

## Historial (`match-history.ts`)

`MATCH_HISTORY`: 6 partidas seed del usuario (campeón, KDA, CS, oro, build de 6 items).
`matchById`, `matchesByGroup`, `kdaRatio` (0 muertes = partida perfecta), `shortGold`.

> El historial **no se alimenta** de las partidas resueltas en la sala — es un seed
> aparte. Resolver una partida no añade nada aquí (ver [edge-cases.md](edge-cases.md)).
</content>
