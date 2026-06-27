# Matchmaking interno

Módulo `core/matchmaking.ts`. Es la "caja negra" que convierte 10 jugadores en una
5v5 equilibrada Azul vs Rojo. Lo comparten el **wizard** (reparto inicial) y la **sala**
(rebalanceo / cambio de jugadores), así ambos producen lo mismo con las mismas entradas.

## Elo interno

`internalElo(tag)` → 480-800, determinista por tag (`hash` + `seeded`). Es un stand-in;
el backend lo reemplaza por rating real.

## Algoritmo (`matchmake`)

Solo acepta **exactamente 10** jugadores (5 roles × 2). Pasos:

1. **Shuffle seedeado** (`mulberry32` con el `seed`), para que "rebalancear" explore
   otro layout válido.
2. **Asignación de roles** (`assignRoles`): matching bipartito (Kuhn) que da a cada
   jugador un rol, **2 por rol**, respetando sus roles permitidos (`roles` vacío = "any").
   Devuelve `null` si es imposible.
3. **Split de equipos:** prueba las **2^5 = 32** formas de repartir las 5 parejas-de-rol
   en dos equipos; elige la que **satisface más reglas**, y a igualdad, la de **elo más
   equilibrado** (menor diferencia).

Salida: `slots` (10 asientos rol+equipo), `satisfied`/`total` de reglas.

## Reglas (`MatchmakeRule`)

- `together`: usa solo el lado A (2-3 jugadores en el mismo equipo).
- `versus`: A vs B en equipos opuestos (1-3 por lado).
- `lane`: duelo 1v1, A y B en la misma línea, equipos opuestos.

`scoreRules` cuenta cuántas se cumplen para un reparto dado.

## Balance (UI)

- `teamElo`: suma de elo por equipo + `blueShare` para la barra.
- `verdict`: `EQUILIBRADO` si |diff| ≤ 15, si no `+N` hacia el lado más fuerte.

## Notas / consistencia

- En la sala, el rebalanceo **no conserva las reglas ni los pins de línea** del wizard
  (no se guardan en la sala live): usa los roles de **perfil** y `rules: []`. Es decir,
  un "rebalancear" desde la sala puede romper duos/versus que se habían configurado al
  crear. Ver [edge-cases.md](edge-cases.md).
- El wizard usa un `teamSeed` incremental; la sala usa `Date.now()` como seed.
- Feasibilidad: el gate del paso 2 (`lineMatch`) y `assignRoles` usan el mismo matching,
  así que si el paso 2 da OK, `matchmake` no debería devolver `null` por roles.
</content>
