# Casos límite y cosas no contempladas

Revisión de la lógica (todo mock). Clasificado por severidad. Muchos son inofensivos
hoy porque no hay multi-usuario ni backend, pero importan en cuanto eso llegue — o
delatan inconsistencias de modelo que conviene decidir ahora.

Leyenda: 🔴 conceptual/bloqueante para el backend · 🟠 inconsistencia visible ·
🟡 menor/cosmético · 💡 mejora.

---

## Identidad y membresía

### 🔴 1. El usuario actual no está en ningún roster seed
`CURRENT_USER = N1ghtfang#LAN`, pero `seedRoster` usa `MEMBER_POOL` (Pix3lQueen,
Cr1msonByte…) y **N1ghtfang no aparece en ninguno**. Sin embargo `GROUPS` marca al
usuario como `OWNER` de `lan-challenger` y `night-owls`.

Consecuencias:
- Hay **dos "owners"** conceptuales en un grupo que posees: tú (`Group.role==='OWNER'`)
  y el `Member` con `owner:true` del roster (un nombre del pool).
- `canManage` (sala) hace `rosterOf(g.id).find(m => m.tag === CURRENT_USER.tag)` → siempre
  `undefined` en grupos seed, y `openedBy` (= `roster[0].name`) ≠ `N1ghtfang` → **canManage
  es false incluso para tus propios grupos**. No se nota porque no se aplica, pero al
  activar permisos te bloqueas a ti mismo.
- En el perfil cross-grupo, todos los miembros del roster se vuelven aliados/rivales del
  usuario aunque el usuario no comparta roster con ellos.

**Decisión pendiente:** inyectar a `CURRENT_USER` como `Member` real (owner) en los
rosters de los grupos que posee, y derivar `Group.role` de ahí.

### 🔴 2. "Capitán" = `roster()[0]`, no el usuario que actúa
En `crear-partida.chooseMode`, `captain = this.roster()[0]` (el owner seed). Si un
**MIEMBRO** (no owner) monta una partida en `scrim-squad`/`arcane-five`, la sala se crea
con `openedBy`/seat 0 = el owner seed, no quien la creó. La idempotencia de
`startDraft`/`openRoom` también se clava por `openedBy === captain.name`, así que de facto
solo hay **un draft por grupo** (el del owner), nunca uno por usuario real.

### 🟠 3. Las invitaciones pendientes nunca se convierten en miembros
`inviteMember` añade un tag a `pendingInvites`, pero **no existe ninguna ruta** que lo
acepte y lo pase al roster. El único "join" (`joinFromInvite`) mete a `CURRENT_USER`, no
al invitado. En el mock está bien, pero el ciclo invitar→aceptar→miembro está a medias y
`Group.members` no refleja invitaciones pendientes (correcto, pero conviene documentarlo).

### 🟡 4. `removeMember` / `setAdmin` operan por nombre
Si dos miembros compartieran nombre, ambos se verían afectados. Hoy imposible (rosters
≤12 con pool de 12 nombres únicos), pero es frágil. Migrar a tag/id.

### 🟡 5. Roster > 12 duplicaría tags
`seedRoster` hace `MEMBER_POOL[i % 12]` y el tag es `Nombre#REGION`. Un grupo con
`members > 12` repetiría nombre+región → **tags duplicados**, lo que rompería stats por
tag y el matchmaking (que dedupea por tag). Ningún seed lo hace (máx 12), pero `add`/
edición no impiden contadores futuros incoherentes.

---

## Partidas / sala

### 🔴 6. El rebalanceo en la sala pierde reglas y pins de línea
`rebuildTeams` (sala) llama `matchmake(..., [], seed)` con **reglas vacías** y roles de
**perfil** (no los pins del paso 2). Por tanto **Revancha/Rebalancear/Cambiar jugadores**
ignoran los duos/versus/duelos y las líneas forzadas que costó configurar en el wizard.
`MatchRoom` no persiste `rules` ni `lineRoles`, solo `teams`. Si se quiere conservar la
intención del admin entre partidas, hay que guardarlas en la sala.

### 🟠 7. La resolución de conflictos del import es cosmética
`applyImport` resuelve los conflictos en UI pero luego **ignora las resoluciones**: elige
ganador con `Math.random()` y calcula MMR sobre `r.teams` original. No mete al invitado
fantasma, no reemplaza jugadores ni recoloca líneas. El comentario lo deja al backend,
pero hoy `replace`/`guest`/`accept-position` no cambian nada.

### 🟠 8. `RoomTeamSlot.guest` no se honra en el MMR
El modelo dice que un invitado (guest) es un fantasma: 0 delta, no cuenta para nada. Pero
`computeMmr` recorre **todos** los slots y da el mismo delta a todos, sin mirar `guest`.
Como los guests nunca se crean de verdad (ver #7), no se ve, pero la implementación de MMR
contradice el contrato del modelo.

### 🟠 9. El historial no se alimenta de las partidas resueltas
Resolver una partida (manual o import) hace `setResult` pero **nunca añade un
`MatchRecord`** a `match-history.ts` (que es un seed fijo). "Una vez en el historial es
inmutable" describe un historial que aún no recibe nada. Igual: las stats/ranking son
seed determinista, **no derivan de resultados**, así que ganar/perder no mueve ninguna
cifra.

### 🟠 10. `undoResult` no revierte MMR (ni hay MMR persistido)
El propio comentario lo dice. Hoy es inocuo porque el MMR no se persiste a stats; pero
combinado con #9 implica que MMR/stats/ranking están totalmente desconectados de los
resultados reales.

### 🟡 11. Import después de resultado manual requiere "corregir" primero
El flujo "un manual puede enriquecerse luego con un import real" no es directo: una vez
hay `result`, la UI muestra el panel de resultado decidido, no el de "esperando import".
Para importar hay que `undoResult` (clearResult) antes. La protección de `setResult`
(import gana a manual) nunca llega a dispararse por la UI actual.

### 🟡 12. `pruneStaleDrafts` no se llama nunca
Está definido pero sin invocar. Los drafts caducados se ocultan al leer (`byId`/`activeOf`
filtran por TTL) pero nunca se eliminan físicamente del signal → fuga de memoria menor en
sesiones muy largas. Hoy intrascendente.

### 🟡 13. TTL del draft con reloj del cliente
`isExpired` usa `Date.now() - createdAt > 24h`. El `createdAt` no se refresca al reanudar
ni al editar, así que un draft "activo" que se trabaja >24h desaparecería a mitad. El
backend debería usar "última actividad", no creación.

### 🟡 14. Solo se muestra una sala pendiente / un draft
`Shell.pendingRoom` toma `waitingOf(g.id)[0]`; si hay varias salas abiertas, las demás no
tienen banner. `startDraft` impide >1 draft por capitán de todos modos.

### 🟡 15. El resultado importado elige ganador al azar
`simulateImport`/`applyImport` hacen `Math.random() < 0.5`. Es maqueta, pero significa que
el "import" no lee ningún dato real; el ganador no se correlaciona con nada mostrado.

### 💡 16. No hay confirmación al salir del wizard con cambios
"Volver al grupo" desde el wizard manual conserva el draft (bien), pero no avisa. En sala
abierta, "← MODO" cancela la sala sin confirmar (sí hay confirm para "cerrar la sala" en
live y para "descartar borrador"). Asimetría de UX.

---

## Datos / consistencia visual

### 🟠 17. Ranking ≠ Estadísticas para el mismo jugador
`group-ranking.ts` usa un **NAME_POOL propio con tags distintos** y semilla solo-groupId,
mientras `group-stats.ts`/badges parten del roster real seedeado por tag+scope+grupo. Son
dos universos: el winrate de un jugador en el Ranking no coincide con el de Estadísticas,
y los badges (de stats, por nombre) pueden recaer en nombres que el ranking no muestra.

### 🟠 18. Badges por nombre vs ranking por pool
`badgesFor` mapea por `Member.name` (del roster). El ranking se construye del NAME_POOL.
Coinciden los nombres por convención, pero si divergen (p. ej. grupos creados por el
usuario, cuyo roster es solo el owner), los badges del ranking quedan vacíos o descuadran.

### 🟡 19. Grupo recién creado: stats/ranking "fantasma"
Un grupo creado por el usuario arranca con roster = [owner] (1 miembro). `rankingFor`
genera `count` filas del pool igualmente, y las stats se calculan sobre 1 miembro →
leaderboards/premios con un único ganador repetido. Las vistas deberían contemplar el
estado "grupo nuevo sin datos".

### 🟡 20. `regionFromTag` asume formato concreto
En `group-store` parte por `·`; en `player-profile` parte por `#`. Tags creados (`EUW`)
vs invitados (`EUW · COMPETITIVO`) vs miembros (`Nombre#EUW`) tienen formas distintas;
funciona por las rutas actuales pero es frágil ante cualquier tag inesperado.

### 🟡 21. Posible división por cero / NaN en seeds
Varios cálculos hacen `wins/games`; se protegen con `games ? ... : 0` o `Math.max(1,…)`.
Revisado: `matchup` (member-detail) hace `wins/games` con `games = 3 + …` (nunca 0), y
profile/ranking usan guardas. OK hoy, pero cualquier scope con `games=0` necesitaría
guarda (p. ej. `noche` con rango [3,6] nunca da 0).

---

## Validación / entrada

### 🟡 22. Avatar (data URL) sin límite de tamaño
`NewGroupInput.avatar`/edición aceptan cualquier data URL sin validar peso/tipo. Una foto
grande infla el signal en memoria; con backend habría que limitar/subir aparte.

### 🟡 23. `TAG_RE` permite nombres con cualquier carácter
`/^.{2,16}#[A-Za-z0-9]{2,5}$/` — el nombre admite espacios y símbolos (incluido otro `#`
no, pero sí espacios). Riot real es más restrictivo. Menor.

### 🟡 24. Nombre de grupo solo valida `trim().length > 0`
Se permite un nombre de un único carácter o solo símbolos; `initialsOf` cae a `GR` y
`uniqueId` a `grupo`. Aceptable, pero sin límite superior de longitud ni de duplicados
de nombre (sí de id).

---

## Concurrencia / multi-usuario (cuando llegue el realtime)

### 🔴 25. Todo es estado local de un único navegador
Los `BACKEND NOTE` lo dicen: followers, "en directo", import por "cualquier jugador",
permisos… asumen un canal realtime (WS/SSE) que no existe. La forma de los métodos está
pensada para ello, pero hoy no hay sincronización entre usuarios ni resolución de
conflictos de escritura concurrente (dos admins editando el mismo draft, dos imports a la
vez, etc.).

### 🟠 26. `simulate*` son la única forma de progresar
Apuntarse a sala, importar partidas y "alguien se une" se disparan con botones de maqueta.
No hay caminos reales; al cablear el backend, estos botones deben desaparecer/ocultarse.

---

## Resumen de prioridades sugeridas

1. **Decidir la identidad del usuario** (#1, #2): inyectar `CURRENT_USER` en los rosters
   y derivar capitán/role de ahí. Desbloquea permisos y coherencia de owner.
2. **Persistir reglas/líneas en la sala** (#6) si se quiere que revancha/rebalanceo
   respeten la configuración.
3. **Conectar resultados → historial → stats/MMR** (#9, #10) o documentar explícitamente
   que son superficies independientes en la maqueta.
4. **Unificar la fuente de ranking y estadísticas** (#17, #18) para que un jugador muestre
   cifras coherentes en todas las pantallas.
5. **Honrar `guest` en el MMR** y aplicar de verdad las resoluciones de import (#7, #8).
</content>
