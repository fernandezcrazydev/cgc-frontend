# cgc-frontend — Guía para agentes

SPA Angular 22 (standalone + signals) para organizar partidas custom de LoL entre grupos.
UI en **español**. Design system propio "NEXUS//FORGE" (tokens `--nf-*`, componentes `nf-*`).

## Comandos

```bash
npm start        # ng serve (dev, backend en http://localhost:8080)
npm run build    # ng build (defaultConfiguration: production)
npm test         # ng test (vitest vía @angular/build:unit-test)
```

## Estrategia de migración mock → backend (LA decisión de arquitectura)

**Solo `core/auth/` habla con backend real** (OIDC code+PKCE contra nuestro backend; Discord es
solo el IdP). Todo lo demás es mock en memoria sembrado con constantes y generadores
deterministas (`seeded`/`hash`). Los comentarios `BACKEND NOTE:` marcan puntos de integración.

**El backend será el dueño de TODA la regla de negocio**: matchmaking, cálculo de MMR/elo,
validaciones de draft, TTL de salas, permisos, resolución de conflictos de importación,
generación de ids/códigos/timestamps. La lógica de ese tipo que hoy vive en el front
(en `matchmaking.ts`, `grupo-crear-partida.ts`, `grupo-sala.ts`, stores...) es un
**placeholder desechable del endpoint futuro**. Por tanto:

- **No la refactorices, no la extraigas a servicios "para dejarla limpia", no le añadas tests.**
  Es código muerto en diferido; invertir en él es tirar trabajo.
- Cuando exista el endpoint: se sustituye por la llamada HTTP y **se borra** el placeholder
  entero (algoritmo + datos semilla). Nunca dejar mock y real conviviendo para el mismo dato.
- Si tienes que tocar un placeholder antes de que exista su endpoint, cambio mínimo + comentario
  `BACKEND NOTE:` describiendo qué deberá hacer el servidor.

Clasifica siempre el código en una de estas tres categorías antes de trabajar sobre él:

| Categoría | Qué es | Regla |
|---|---|---|
| **Permanente** | UI, stores (la parte de estado/fetch), presentación, derivaciones visuales | Calidad máxima, tests, patrones de abajo |
| **Contrato** | `models.ts` (interfaces espejo de DTOs), enums, catálogos estáticos (perks) | Se conserva; evoluciona solo con el backend |
| **Placeholder** | Algoritmos de negocio en cliente, datos semilla, `Math.random()`/`Date.now()` de dominio | No invertir; reemplazar por HTTP y borrar |

## Arquitectura de capas

```
src/app/
  core/            Un subdirectorio por dominio (auth/, groups/, matches/, ...), cada uno con:
                     models.ts     → interfaces de dominio (espejo de los DTOs del backend)
                     <dom>-api.ts  → ÚNICO sitio que usa HttpClient y environment.apiUrl del dominio
                     <dom>-store.ts→ estado con signals (patrón Session, abajo)
                     index.ts      → barrel: solo superficie pública (los Api son privados)
                   `core/auth/` es el modelo de referencia: copia su estructura.
  features/        Componentes ruteados. Finos: orquestan stores y navegan.
  ui/              Primitivas presentacionales nf-*. Sin dependencias hacia core/features.
  shared/          Helpers transversales (utils de ruta, gradientes, etc.).
src/environments/  Única fuente de URLs (apiBaseUrl, apiUrl, authority, clientId).
src/styles/tokens/ Tokens --nf-* globales (colors, typography, spacing, effects, base).
```

Dirección de dependencias: `features → core | ui | shared`; `core → shared`; `ui` y `shared` no
importan de nadie. Una feature nunca importa internals de otra. Nadie construye URLs con
`environment.apiUrl` fuera de un `*-api.ts`.

## Patrón obligatorio: store asíncrono (clon de `Session`)

`core/auth/session.ts` es el molde. Todo store que hable con backend debe tener:

- Signals privados + exposición `asReadonly()` / `computed()`. Nunca signals mutables públicos.
- `status: 'idle' | 'loading' | 'ready' | 'error'` como signal.
- `ensureLoaded()` idempotente con deduplicación de petición en vuelo (cachear la promesa),
  `reload()` para forzar refetch, `clear()` en logout.

## Casuísticas obligatorias al conectar cualquier endpoint

Checklist que TODO dominio migrado debe cubrir (no negociable; revisar una a una):

**Lecturas**
- Distinguir siempre **cargando / error / vacío / no existe**. Nunca `@if (dato) {...} @else {404}`
  a pelo: con latencia real eso parpadea un 404 falso. Patrón:
  ```html
  @switch (store.status()) {
    @case ('loading') { <skeleton/spinner> }
    @case ('error')   { <error + botón reintentar> }
    @default {
      @if (entity(); as e) { ... } @else { <404 real> }
    }
  }
  ```
- Estado **vacío** con CTA (grupo sin partidas, historial vacío...) ≠ estado de error.
- Cancelar/ignorar respuestas obsoletas al cambiar de ruta o de `:id` (switchMap sobre el param,
  o comprobar que el id de la respuesta sigue siendo el activo antes de escribir en la signal).
- Listas: paginación/filtrado/orden **en servidor** desde el diseño del endpoint. No traer
  colecciones enteras y paginar en cliente (el pool de campeones/historiales crecerá).

**Escrituras**
- **Pesimistas por defecto**: deshabilitar el botón (estado `pending` por acción), `await` de la
  confirmación, y solo entonces toast de éxito y/o navegación. Prohibido navegar u optimizar UI
  antes de confirmar (hoy `create()` navega al detalle antes del POST — no replicar).
- Optimista solo si la UX lo exige de verdad, y siempre con rollback + toast de error escrito.
- Doble submit: toda acción de escritura debe ser no-reentrante (guard con la signal `pending`).
- Tras una escritura que afecte a datos derivados (stats, ranking, MMR), **refetch** de lo
  derivado; no recalcular en cliente.

**Errores HTTP (mapa de decisiones)**
- `401`: lo gestiona el refresh de `angular-auth-oidc-client`; si el refresh falla → `Session.clear()`
  + redirigir a login. No tratar 401 endpoint a endpoint.
- `403`: el usuario no puede — ocultar/deshabilitar el control si es predecible; si llega igual,
  toast genérico. Los checks de permiso en cliente son solo UX; el backend decide.
- `404`: entidad no existe → estado 404 de la vista (distinto de loading).
- `409` / conflictos (plaza ocupada, invitación ya aceptada, sala cerrada, versión obsoleta):
  refetch del recurso + mensaje concreto. Esperables en cuanto haya multi-usuario real.
- `422`/validación: mapear errores por campo al formulario cuando el backend los dé; genérico si no.
- Errores de red/timeout: toast + opción de reintentar; nunca dejar la vista colgada en `loading`.
- Mensajes al usuario siempre en español; nunca volcar el mensaje técnico del backend en la UI.

**Concurrencia multi-usuario (llegará con el backend)**
- Los datos pueden cambiar en el servidor sin que este cliente actúe (otro miembro edita el grupo,
  acepta una invitación, cierra la sala). Diseñar cada vista asumiendo datos potencialmente
  obsoletos: `reload()` barato y llamado al re-entrar en la ruta.
- Salas/drafts en vivo (`MatchStore.syncDraft` y seguidores) están diseñados para migrar a
  **WebSocket/SSE** (writes broadcast, reads subscribe). Mantener las firmas de los métodos del
  store estables para que solo cambie la fuente de datos, no las vistas.

**Datos**
- Ids, códigos de sala, timestamps y resultados los genera el backend. Cero `Math.random()` /
  `Date.now()` para datos de dominio en cliente.
- Entidades referenciadas por **id estable del backend**, nunca por `name` ni `tag` (`Nombre#REGION`).
- Fechas del backend en ISO-8601; formatear en presentación.

## Contratos pendientes de acordar con backend (preguntar antes de asumir)

- **Formato de error** (¿ProblemDetail RFC 7807 de Spring?) → condiciona el manejo global de errores.
- **Contrato de paginación** (page/size vs cursor) → condiciona `NfPagination` y los stores de listas.
- **Canal realtime** (WebSocket vs SSE, y su autenticación) para salas/drafts/notificaciones.
- **Ids estables de jugador/miembro/grupo** y su relación con la identidad Discord de `/me`.

Cuando se acuerde uno, documentarlo aquí y borrar la línea de pendientes.

## Reglas de oro

1. **Identidad**: el usuario es `Session` (`core/auth`). `CURRENT_USER` de `lobby.ts` es mock
   legacy — prohibido en código nuevo (hoy los permisos `canManage`/`canEditPerks` comparan
   contra el mock; se re-derivarán de `Session` + backend al migrar cada dominio).
2. **DTOs espejo**: las interfaces de `models.ts` replican exactamente la respuesta del backend
   (como `CurrentUser` ↔ `MeResponse`). Si el backend cambia, cambia el modelo; no lo parchees.
3. **HTTP**: siempre `HttpClient` (ya provisto con `withFetch()` + `authInterceptor`). El Bearer
   se añade solo a `secureRoutes` (= `environment.apiUrl`); si añades otro host, regístralo ahí.
4. **Componentes finos**: un componente orquesta stores y navega. Si necesitas escribir un
   algoritmo dentro de una vista, o es presentación pura (→ `shared/`/`computed`) o es negocio
   (→ endpoint futuro: placeholder mínimo + `BACKEND NOTE:`).
5. **Estado de UI ≠ estado de dominio**: modales, tabs y selección visual viven en signals del
   componente, no en stores de `core/`.

## Angular idiomático (obligatorio en código nuevo)

- Standalone + `inject()` (no constructor DI), control flow `@if/@for/@switch`.
- `ChangeDetectionStrategy.OnPush` en todo componente nuevo.
- Signal APIs: `input()`, `output()`, `model()` — no `@Input()/@Output()/EventEmitter`.
- Estado local con `signal`/`computed`/`linkedSignal`; streams de router con `toSignal`.
- Rutas hijas siempre `loadComponent` (lazy) con `title` definido.
- Template inline por defecto; `templateUrl` solo si crece mucho (como `shell`).

## UI kit y estilos

- Primitivas en `src/app/ui/` (`NfButton`, `NfWindow`, `NfBadge`, `NfToggle`, `NfSelect`,
  `NfPagination`, `NfAvatarPicker`, `NfToastHost`), exportadas por `ui/index.ts`. Antes de crear
  markup ad-hoc (modales, paginación...), mira si existe o debe existir una primitiva `nf-*`.
- Los componentes **consumen** tokens `var(--nf-*)`; solo `src/styles/tokens/` los declara.
- Tipografía: Manrope para texto de lectura; Share Tech Mono solo como acento (labels, código,
  números). Nada por debajo de ~11px.
- Feedback al usuario: `ToastService` (`core/toast.ts`) + `NfToastHost`.

## Testing

- Vitest (jsdom). Mínimo exigido por dominio migrado: specs del store y del `*-api.ts`
  (incluyendo loading/error/reintento y no-reentrada de escrituras). `*.spec.ts` junto al fichero.
- No escribir tests de lógica placeholder (categoría desechable).

## Deuda conocida (no la propagues)

- `grupo-crear-partida.ts` (~1800 líneas) y `grupo-sala.ts` (~1100): vistas gigantes cuya lógica
  de negocio es placeholder del backend. No añadir más lógica ahí; tampoco refactorizarlas por
  gusto — se adelgazarán solas al migrar matchmaking/MMR/resultados a endpoints.
- Duplicados pendientes de unificar en `shared/`: resolución de `:id`→grupo (repetida en 8
  vistas), `avatarBg(hue)`, bloque 404, modales ad-hoc (falta un `NfModal`).
- Rutas huérfanas: `crear.ts`, `campeones.ts`, `partidas.ts` no están en `app.routes.ts`
  (los enlaces desde inicio caen en el wildcard → login).
- `lobby.ts` es un God-module de tipos + datos semilla; al migrar cada dominio, mueve sus tipos a
  `core/<dominio>/models.ts` y borra sus semillas.
- `GroupStore.selectedId` es estado de UI (sidebar del shell) viviendo en un store de dominio, y
  las vistas lo sincronizan vía `effect()` — no extender ese patrón.
- `tsconfig` aún sin `strict` ni `strictTemplates`; UI kit aún con `@Input()` legacy; sin
  `provideZonelessChangeDetection` explícito. El objetivo es activarlos — no escribas código
  nuevo que lo impida.
- `environment.prod.ts` tiene `apiBaseUrl` placeholder (`TODO`).
