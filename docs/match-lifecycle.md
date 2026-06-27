# Ciclo de vida de una partida

Implicados: `grupo-crear-partida.ts` (wizard), `grupo-sala.ts` (sala/detalle),
`grupo-partidas.ts` (lista de activas), `match-store.ts` (estado).

## Pre-requisito

Una 5v5 necesita **10 miembros en el grupo**. Si `roster().length < 10`, ambos modos
muestran "FALTAN JUGADORES" y enlazan a invitar.

## Paso 0 · elección de modo

`crear-partida` arranca en un selector: **PARTIDA MANUAL** o **SALA ABIERTA**.
Al elegir, se crea **ya** una sala persistente en `MatchStore`:

- `manual` → `startDraft(groupId, captain)` crea una sala `drafting`. Un `effect`
  hace `syncDraft` en cada cambio, así los no-admin la siguen en directo.
- `open` → `openRoom(groupId, captain)` crea una sala `waiting`.

> `captain = roster()[0]` (siempre el owner del grupo). Ver caso límite en
> [edge-cases.md](edge-cases.md) — no es necesariamente el usuario actual.

Ambos son **idempotentes por capitán**: reentrar devuelve la misma sala; un draft
manual se rehidrata desde `draft.raw`.

## Modo MANUAL · wizard de 5 pasos

| Paso | Nombre | Lógica clave |
|------|--------|--------------|
| 1 | PARTICIPANTES | Buscador + filtros por rol. Gate: **exactamente 10** seleccionados |
| 2 | LÍNEAS | Roles permitidos por jugador (pre-cargados del perfil). Chequeo de viabilidad por **matching bipartito** (2 por rol). Bloquea "Siguiente" si la 5v5 es imposible |
| 3 | DUOS/TRÍOS/VS | Reglas `together` / `versus` (bandos A vs B) / `lane` (duelo 1v1). Validación de contradicciones (union-find) y de línea compartida |
| 4 | PERSONAJES | Reservar campeón por jugador (= asegurado + no baneable). Bloquea si dos reservan el mismo |
| 5 | LANZAR | Reparto Azul/Rojo generado + barra de balance de elo. "REBALANCEAR" reprueba otro seed |

- **Saltar y lanzar:** si la config-hasta-ahora es válida (10 jugadores, líneas
  factibles, sin errores de reglas/campeones) se puede saltar los pasos opcionales
  directo al paso 5 (`canSkipToLaunch` / `skipToLaunch`).
- **Diagnósticos:** cada paso separa `errors` (bloquean) de `warnings` (avisan).
- **Descartar vs salir:** "Volver al grupo" conserva el draft (reanudable); "Descartar"
  lo elimina de verdad (`discardDraft`).
- **Lanzar** (`launch`): tras un loader, `promoteToLive(roomId, teams)` congela el
  lineup y navega a la sala.

### Validaciones del paso 2 (líneas)

- `lineCoverage`: cuántos de los 10 pueden cubrir cada rol (necesita 2).
- `lineMatch`: matching bipartito (Kuhn) → ¿se pueden asignar 10→5 roles×2? Devuelve
  los no-asignables para nombrarlos en el error.
- Errores: rol con <2 candidatos; >2 jugadores fijados al mismo rol único; jugador que
  no encaja en ninguna línea libre.
- Avisos: justo 2 para un rol (poco margen); ≥6 líneas fijadas.

### Validaciones del paso 3 (reglas)

- Union-find: cada `together` y cada lado de `versus`/`lane` es un bloque "mismo equipo".
- Error si un componente "mismo equipo" supera 5 (no cabe en un equipo).
- Error si un jugador está en ambos bandos de un enfrentamiento, o si A y B quedan
  obligados a ir juntos y en contra a la vez.
- `lane` exige que A y B compartan al menos una línea jugable (del paso 2).

## Modo SALA ABIERTA

1. **filling:** sala de espera con 10 asientos; los miembros se apuntan (en la maqueta,
   botón "simular que alguien se apunta" / `addSeat`). El capitán puede quitar a otros.
2. Al llenarse (`openFull`), "CONTINUAR A RESTRICCIONES" lleva los 10 al **mismo wizard**
   de restricciones (pasos 2-5), saltándose el picker.

Salir de una sala abierta la **cancela** (`remove`); un draft manual **se conserva**.

## La sala (`grupo-sala.ts`)

Renderiza según `status`:

- **drafting:** vista de **seguidor read-only** — pinta participantes/líneas/reglas/
  reservas según el `draft` snapshot, con el paso actual del admin.
- **waiting:** asientos + herramientas de llenado/recorte.
- **live:** lineup Azul/Rojo por línea + barra de balance + zona de resultado.

### Resolver el resultado (solo en `live`)

Dos caminos:

- **Manual (solo admin):** "GANÓ AZUL/ROJO" tras un confirm → `setResult(source:'manual')`,
  calcula MMR, lanza animación de victoria. "CANCELAR" → resultado `cancelled` sin MMR.
- **Import (cualquier jugador):** sube el JSON del scraper de escritorio.
  - *Sin conflictos* (`simulateImport`): gana un lado, resultado import.
  - *Con conflictos* (`simulateImportConflicts`): abre panel de resolución; hay que
    resolver **todos** (`allResolved`) para "RESOLVER Y APLICAR". También se puede
    "descartar import".

### MMR (`computeMmr`)

Fórmula Elo de puntuación esperada: victoria equilibrada ≈ ±16, K=32. Todos los de un
equipo reciben el **mismo** delta. Mostrado en la pantalla de victoria.

### Después del resultado · seguir jugando

Desde el resultado:

- **Revancha** (`rematchSame`): mismos equipos/posiciones → preview directo.
- **Rebalancear** (`rebalance`): mismos jugadores, nuevas posiciones (re-matchmaking).
- **Reconfigurar** (`reconfigure`): reabre el wizard con `?reconfigure=roomId` para
  esos 10; al lanzar, **actualiza esta sala** (`setTeams`) en vez de crear otra.
- **Cambiar jugadores** (`openSwap`): entran/salen miembros del grupo (debe quedar 10),
  luego re-empareja.
- **Corregir** (`undoResult` → `clearResult`): vuelve a "sin decidir".
- **Cerrar la sala** (`closeRoom`): elimina la sala para todos.

Todo relanzamiento pasa primero por un **preview local** (`previewTeams`) que solo se
hace público al "LANZAR" (`confirmPreview` → `setTeams`). El preview nunca llega a
espectadores.

### Permisos (`canManage`) — modelado, no aplicado

`canManage` = capitán (`openedBy`) o owner/admin del grupo. Está cableado pero **no se
aplica en el template** todavía (sin auth real se dejan todos los botones visibles).
Cuando lleguen auth + realtime (SSE), las acciones se esconden tras `canManage` y los
no-admin verán la sala read-only.

## Banner de sala pendiente (shell)

`Shell.pendingRoom` muestra la primera sala `waiting` no llena del grupo activo, para
saltar a ella sin buscar la notificación.
</content>
