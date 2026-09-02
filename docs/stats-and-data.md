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

`buildPlayerProfile(user, groups, rosterOf, roleSamples)`: carrera **agregada cross-grupo**
del usuario actual, seedeada por su tag. Suma records por grupo, KDA global, racha/forma
reciente y top campeones. La vista aclara que es cross-grupo (para cifras exactas, abrir
las stats del grupo).

Dos cosas que **ya no** salen de aquí, y es a propósito:

- **El cara a cara** (mejor aliado, némesis, víctima favorita) se derivaba de una semilla
  por pareja que no coincidía con la pantalla que abría. Ahora sale de las partidas reales
  (`MatchHistoryStore.crossWith()` + `bestAllyOf`/`nemesisOf` de `cross-history.ts`), que
  es la misma fuente que alimenta Versus, Synergy y el historial cruzado.
- **El desglose por posición** se sorteaba (se elegía un winrate y de él salían las
  victorias, al revés de como se calcula). Ahora se **cuenta** sobre las `roleSamples` que
  pasa la vista, y las posiciones sin partidas se pintan como «sin datos», nunca con un
  porcentaje. `mainRole` es `null` mientras no haya ninguna partida que lo determine.

`buildMemberProfile(tag, groups, rosterOf, roleSamples, knownFromMatches)` hace lo propio
para el perfil ajeno, y **devuelve `null`** cuando ese jugador no está en ningún roster ni
aparece en tus partidas: eso es el 404 de la vista, y es la misma respuesta que dan las
tres vistas del cruce ante la misma entrada.

## Historial (`core/matches/`)

`MatchHistoryStore.allMatches` proyecta las siete partidas de `match-history-seed.ts`
sobre cada liga del usuario, con su identidad, sus compañeros reales y sus propias fechas
(`buildMockHistory`). No es una constante: sus entradas —las ligas, la identidad y la
cuenta de Riot— llegan por red, así que el store expone un `status()` y las vistas esperan
a que sea `ready` antes de pintar. Sin eso, las cifras se pintaban y cambiaban solas al
resolverse esas peticiones.

La copia de cada liga **nunca cambia el resultado de la partida**: lo que varía es en qué
ranura entra quien mira (en parte de las copias, en el bando contrario al que le reserva la
semilla). Volcar el ganador, que es lo que se hacía antes, dejaba los totales de equipo y
el MVP describiendo al ganador original.

`cross-history.ts` deriva de ahí el cruce con otro jugador (`buildCrossMatches`,
`aggregateCross`, `bestAllyOf`/`nemesisOf`), emparejando siempre por identidad completa
—`userId` estable, o el Riot ID entero— nunca por prefijo de nombre.

> El historial **no se alimenta** de las partidas resueltas en la sala — es un seed
> aparte. Resolver una partida no añade nada aquí (ver [edge-cases.md](edge-cases.md)).
</content>
