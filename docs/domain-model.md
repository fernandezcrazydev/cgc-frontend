# Modelo de dominio

Todas las interfaces viven en `core/` (sobre todo `lobby.ts` y `match-store.ts`).

## Group (`lobby.ts`)

Un grupo/equipo.

| Campo | Notas |
|-------|-------|
| `id` | slug estable usado en la URL (`/app/grupos/:id`). Generado por `uniqueId(name)` con sufijo `-2`, `-3`… si colisiona |
| `name` | nombre visible |
| `tag` | subtítulo mono. En seeds es la región (`LAN`, `EUW`…); en invites es `EUW · COMPETITIVO` |
| `initials` | 2 letras derivadas del nombre |
| `role` | `OWNER` \| `MIEMBRO` — **rol del usuario actual respecto al grupo** |
| `members` | contador (debe seguir a la longitud del roster; ver `syncCount`) |
| `c1`, `c2` | stops del gradiente del banner/avatar |
| `avatar?` | foto opcional como data URL (cae a iniciales si no hay) |

Seeds: `GROUPS` (4 grupos). El roster real se construye aparte en `GroupStore`.

## Member (`lobby.ts`)

Un integrante de un roster.

| Campo | Notas |
|-------|-------|
| `name`, `tag` | tag estilo Riot `Nombre#REGION` |
| `initials`, `hue` | avatar |
| `role` | etiqueta in-group, p. ej. `CAPITÁN · OWNER`, `MID`, `SUPLENTE` |
| `owner` | true para el dueño (siempre el índice 0 del roster) |
| `admin?` | true si el owner lo ascendió |

El roster es **la fuente de verdad de la membresía** (`GroupStore.rosters`), separado
de `Group.members` (solo contador).

## GroupStore (`group-store.ts`)

- `groups`, `selectedId`/`selected`.
- `rosters: Record<groupId, Member[]>` — seedeado con `seedRoster` (pool de 12 nombres).
- `pendingInvites: Record<groupId, string[]>` — tags invitados pendientes de aceptar.
- `perks: Record<groupId, Record<memberTag, perkId[]>>` — perks curados por owner/admin.
- Operaciones: `inviteMember` (valida `TAG_RE`, dup miembro/pendiente),
  `cancelInvite`, `removeMember` (por nombre, nunca al owner, sincroniza contador),
  `setAdmin` (por nombre, nunca al owner), `togglePerk`, `joinFromInvite`, `add`,
  `update`.

`TAG_RE = /^.{2,16}#[A-Za-z0-9]{2,5}$/`.

## Champion / MatchItem / NavItem (`lobby.ts`)

`CHAMPIONS` (12, seed), `MATCHES` (3 ejemplos del home), `NAV` (4 secciones).
`REGION_OPTIONS = ['LAN','BR','NA','EUW','KR']`.

## Notification (`lobby.ts` + `notification-store.ts`)

`kind ∈ invite | join | result | system`. Las `invite`/`join` son **accionables**
(panel "Requiere tu atención" del home + campana). Una `invite` de grupo lleva un
`groupInvite: GroupInvitePayload` que abre un modal de revisión y, al aceptar,
ejecuta `GroupStore.joinFromInvite`.

`NotificationStore`: `unreadCount`, `hasUnread`, `actionable`, `markAllRead`, `clear`,
`dismiss`, `acceptGroupInvite`.

## MatchRoom (`match-store.ts`)

La entidad central de una partida. Ciclo de vida (`status`):

```
drafting  → admin configurando en el wizard (otros lo siguen EN DIRECTO vía draft snapshot)
waiting   → sala abierta llenándose
live      → 5v5 en curso (lineup Azul/Rojo congelado en `teams`)
(finalizada → sale del store y pasa al historial)
```

| Campo | Notas |
|-------|-------|
| `id`, `groupId`, `code` (p. ej. `WX4K`) | |
| `mode` | `open` \| `manual` |
| `status` | ver arriba |
| `capacity` | siempre 10 |
| `seats: Member[]` | seat 0 = capitán que abrió |
| `openedBy`, `createdAt` | |
| `draft?: DraftSnapshot` | config en vivo mientras `drafting` (display-ready + `raw` para rehidratar) |
| `teams?: RoomTeams` | lineup Azul/Rojo una vez `live` |
| `result?: MatchResult` | desenlace |

### DraftSnapshot

Tiene **dos caras**: campos *display-ready* (`participants`/`lines`/`rules`/`reserved`,
nombres y labels resueltos) para que la vista de espectador no necesite lógica; y `raw`
(estado crudo del editor por tag/clave) para que el wizard del admin **rehidrate** un
borrador abandonado.

### MatchResult

- `winner: 'blue' | 'red' | 'cancelled'`
- `source: 'manual' | 'import'` — **import es la fuente de verdad** y sobreescribe a
  manual (no al revés).
- `mmr: MmrChange[]`, `decidedAt`.

### ImportConflict

Discrepancia entre el JSON importado y el lineup configurado:
`unknown-player` (alguien del JSON no estaba en la sala → reemplazar o entrar como
**invitado fantasma**) o `wrong-position` (jugó otra línea → aceptar posición real).
Se resuelven **en la sala** antes de aceptar el resultado; solo un import sin conflictos
entra al historial (donde es **inmutable, solo borrable**).

## MatchStore (`match-store.ts`)

`byId` / `activeOf` / `waitingOf` (excluyen drafts caducados por TTL de 24h),
`openRoom`, `startDraft` (ambos idempotentes por capitán), `syncDraft`, `promoteToLive`,
`setResult`, `clearResult`, `setTeams`, `addSeat`, `removeSeat`, `remove`,
`pruneStaleDrafts`.

`DRAFT_TTL_MS = 24h`: un borrador abandonado se conserva para reanudar y se oculta al
leer pasado ese tiempo.
</content>
