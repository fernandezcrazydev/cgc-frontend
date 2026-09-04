# cgc-frontend — Guía para agentes

> **Este fichero es la fuente única de las reglas del proyecto, sea cual sea el agente.**
> `AGENTS.md` (Codex, Cursor, Copilot, Jules…) y `GEMINI.md` (Gemini CLI) son punteros a este
> documento; no dupliques contenido en ellos. Hubo una copia completa en `AGENTS.md` y se
> desincronizó: describía rutas huérfanas que ya no existían. Un documento normativo duplicado
> es un documento normativo equivocado.
>
> Lo que aquí se puede verificar, se verifica: **`npm run arch`** (§ "Reglas verificadas").

SPA Angular 22 (standalone + signals) para organizar partidas custom de LoL entre grupos.
La aplicación se llama **Sale Custom** (nombre oficial: es el que va en el wordmark, el `<title>`
y los títulos de ruta). UI en **español**. Design system propio: tokens `--nf-*` y componentes
`nf-*`. El prefijo viene de "NEXUS//FORGE", como se llamó el sistema mientras el look era
vaporwave; el nombre se retiró con la estética, pero el prefijo se conserva porque renombrarlo
serían ~1.500 ediciones sin ningún beneficio. Léelo como "el prefijo de este proyecto".

## Comandos

```bash
npm start        # ng serve (dev, backend en http://localhost:8080)
npm run build    # ng build (defaultConfiguration: production)
npm test         # ng test (vitest vía @angular/build:unit-test)
npm run arch     # reglas de arquitectura de este documento (ver § "Reglas verificadas")
```

**Antes de dar por terminado cualquier cambio: `npm run arch && npm test`.** El primero es
instantáneo y es lo que impide que este documento vuelva a ser decorativo.

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
src/styles/_breakpoints.scss  Escalones responsive ($bp-*, $touch) para las hojas de componente.
                   Partial de SCSS y no un token CSS a propósito: `@media` necesita un valor en
                   tiempo de compilación. Se consume con `@use '<ruta>/breakpoints' as *;`.
```

Dirección de dependencias: `features → core | ui | shared`; `core → shared`; `ui` y `shared` no
importan de nadie. Una feature nunca importa internals de otra. Nadie construye URLs con
`environment.apiUrl` fuera de un `*-api.ts`.

Esto **lo verifica `npm run arch`**, no la buena voluntad (ver § "Reglas verificadas"), y hoy
está en **cero incumplimientos**. Los cuatro que había se arreglaron así, que es el patrón a
repetir:

- `core/matches/models.ts` y `core/group-ranking.ts` importaban `NfLane` de `ui/lane-icon`: la
  dependencia estaba invertida, porque `Lane` es **dominio** (viene en los DTOs). Ahora `core/`
  declara `Lane` y `ui/` declara `NfLane` por su cuenta. Son uniones de string idénticas y
  TypeScript es estructural, así que siguen siendo intercambiables sin que ninguna capa importe
  de la otra. **La de `core/` es la que manda si el dominio cambia.**
- `ui/toast/nf-toast.ts` inyectaba `ToastService` de `core/` (este documento afirmaba lo
  contrario y no era cierto). No se pudo mover el servicio a `ui/`, porque `core/groups` y
  `core/http` también lo inyectan y solo habría invertido la violación. Se arregló convirtiendo
  `NfToastHost` en la primitiva presentacional que decía ser: recibe `[toasts]`/`[paused]` y
  emite `(dismiss)`/`(pause)`/`(resume)`; el cableado vive en `shell.html`.
- `features/shell/shell.ts` importaba `../feedback/feedback-dialog`. Ahora hay
  `features/feedback/index.ts` y se importa `../feedback`. **La distinción es deliberada y la
  regla la respeta**: el barrel es superficie pública y se permite; el fichero de dentro es un
  internal y no.

## Organización de ficheros y localidad del CSS (regla dura)

**Un componente = una carpeta con su `.ts`, su `.html` si pasa de 150 líneas, su `.scss` y su
`.spec.ts`.** Los estilos viven pegados al markup que estilan. No es preferencia estética: es la
única forma de que el CSS **muera cuando muere su markup**.

**`views.scss` está congelado. Cero líneas nuevas, sin excepciones.** Es una hoja *global*
(declarada en `angular.json`, no en un `styleUrl`), así que no tiene encapsulación, no tiene
dueño y nadie la poda. Lo que eso ha producido, medido:

- 12.312 líneas, y la curva se rompió en agosto de 2026: 4.740 líneas el 28-ago → 12.312 el
  01-sep. Cuatro días, +7.500 líneas.
- **128 de sus 1.308 clases (~10%) no las referencia ningún `.ts` ni `.html`**: `attn-card__*`,
  `cx-hero__*`, `cx-kpi*`, `cp-launched__*`, `resume-hero__*`... Se borró el markup y el CSS
  se quedó, porque no estaba a la vista de quien borraba.
- Todas las rutas cargan el CSS de todas las vistas en el arranque, lo que alimenta el aviso de
  bundle budget de más abajo.

El CSS en sí está bien escrito (anidamiento máximo 2, 23 `!important` en 12k líneas, prefijos BEM
disciplinados). **El problema nunca fue la calidad: es la ubicación y el ciclo de vida.** No hay
que reescribirlo, hay que moverlo.

**Si escribes estilo nuevo, va en `<componente>.scss` con `styleUrl`.** Ya hay seis vistas
migradas que sirven de molde: `grupo-detalle.scss`, `grupos.scss`, `inicio.scss`, `tierlist.scss`,
`synergy.scss`, `versus.scss`.

### Estado: hecho

La migración está ejecutada. Medido contra `main` justo antes de integrarla (ya con la Fase 5.5):

| | main | después |
|---|---|---|
| `views.scss` | 11.817 líneas | **3.906** |
| clases muertas | 222 | **0** |
| `styles.css` (bundle) | 204,50 kB | **70,65 kB** (−65%) |
| transferencia | 26,43 kB | **11,20 kB** |
| bundle inicial | 976,88 kB | **838,94 kB** |
| violaciones de capas | 4 | **0** |

Una veintena de hojas de componente nuevas. El CSS de cada vista viaja ahora en su chunk lazy:
solo lo paga quien abre esa vista. El aviso de `shell.scss exceeded budget` desapareció solo al
podar sus reglas muertas.

**La migración es reproducible por script** (`scripts/migracion-css/`), y eso no es un detalle:
cuando la Fase 5.5 aterrizó en `main` con 1.735 líneas nuevas en `views.scss`, el merge se
resolvió quedándose con el CSS de `main` y **reejecutando la extracción entera encima**, en vez
de pelear 6 conflictos a mano. Si vuelve a pasar, ese es el camino.

### Lo que queda global, y por qué

`views.scss` conserva ~4.000 líneas y **eso es correcto, no deuda pendiente**. Son bloques que
escriben varios componentes sin un ancestro siempre cargado, así que una hoja encapsulada no los
alcanzaría:

| bloque | reglas | lo escriben |
|---|---|---|
| `m-card` | 109 | 7 componentes (la fila de partida, en historial, cruzado y perfil) |
| `m-lineup` | 67 | 4 |
| `m-summary` | 30 | 2 |
| `cp-tray`, `cp-pchip`, `cp-balance`, `cp-pick`… | ~100 | crear-partida + sala |
| `pf-hero-compact`, `pf-champ-tile`, `pf-mini-champ`… | ~90 | perfil + perfil-miembro |
| `cx-card`, `cx-metric`, `cx-compare` | ~46 | 2-3 de `cross/` |
| `view*`, `field`, `modal`, `tabs`, `empty` | ~50 | transversales |

**Regla para decidir**: si un bloque lo escribe un solo componente, va a su hoja. Si lo escriben
varios, se queda global salvo que exista un componente ancestro que se cargue siempre con ellos.
`planificar.mjs` calcula las dos listas.

Antes de mover un bloque compartido a `ui/`, comprueba que de verdad es una primitiva y no solo
CSS repetido: `.modal*` y `.tabs*`/`.seg*` sí lo son (duplican `NfModal` y `NfSegmented`), pero
`m-card` es una vista de dominio y no pinta nada en `ui/`.

### Cómo se desmonta el monolito (una vista por PR, sin cambio visual)

Las utilidades están en `scripts/migracion-css/`, con un README que explica el ciclo y las
**cuatro trampas** que costaron una pasada cada una (reformatear el origen, comentarios entre
selectores, comas dentro de comentarios, `@use` al principio del fichero). **Son temporales:
cuando `views.scss` desaparezca, se borra esa carpeta.**

El ciclo, si vuelves a mover un bloque:

```bash
node scripts/migracion-css/planificar.mjs <prefijo>        # ¿tiene dueño único?
node scripts/migracion-css/extraer-prefijo.mjs <bloques> <destino.scss> --apply
node scripts/migracion-css/borrar-clases-muertas.mjs <hoja> <clases>
node scripts/migracion-css/verificar-vs-head.mjs           # ¿se ha perdido algo?
npm run arch && npm test && npx ng build --configuration production
```

**`verificar-vs-head.mjs` es lo que da la confianza, no el build.** Un build en verde no ve una
regla mutilada ni un cuerpo alterado: compara HEAD con el estado actual regla a regla y solo
aprueba si toda regla que existía sigue existiendo igual, salvo las borradas a propósito. Los
tres bugs del extractor los encontró él, no el compilador.

**El único riesgo no mecánico**: hay 13 selectores que apuntan a internals de componentes `nf-*`,
y ~6 de ellos **dejarán de aplicar al encapsular**, porque apuntan a hijos internos y el atributo
`_ngcontent` del padre no llega ahí: `.nf-pager__btn`, `.nf-seg__btn`, `.nf-game-icon`,
`.nf-avatar__fallback`. Los que apuntan al elemento host (`.nf-avatar` a secas) sí siguen
funcionando. Localízalos antes de mover con:

```bash
grep -nE '\.nf-[a-z]' src/app/features/shell/views/views.scss | grep -v 'var(--nf'
```

y resuélvelos subiendo el estilo a la primitiva o exponiendo un `input`/token — nunca con
`::ng-deep`, que es API muerta.

**Distingue host de interno**: `.nf-avatar` es la clase HOST de `<nf-avatar>`
(`host: { class: 'nf-avatar' }`), y el elemento `<nf-avatar>` de tu plantilla sí recibe tu
`_ngcontent`, así que ese selector sobrevive. `.nf-pager__btn` es un `<button>` dentro de la
plantilla de `NfPagination`: ese no.

Para los internos, **la primitiva expone una custom property y la vista la fija sobre el host**;
las custom properties sí heredan a través de la frontera de encapsulación. Ya está hecho en
`nf-pagination.scss` (`--nf-pager-width`, `--nf-pager-margin-top`, `--nf-pager-btn-size`) y
`nf-segmented.scss` (`--nf-seg-display`, `--nf-seg-btn-flex`, `--nf-seg-btn-padding`):

```scss
.gd-statusbar nf-pagination {   /* el host sí lo alcanza la hoja de la vista */
  --nf-pager-margin-top: 0;
  --nf-pager-btn-size: 30px;
}
```

Nunca `::ng-deep`, que es API muerta.

**Esto no es teórico y ya ha pasado dos veces.** Comprueba en el bundle si dudas: Angular pega el
`_ngcontent` al ÚLTIMO selector, así que `.shell__search .nf-typeahead__field` se compila como

```
.shell__search[_ngcontent-%COMP%]   .nf-typeahead__field[_ngcontent-%COMP%]{ … }
```

y ese `<div>` vive en la plantilla de `NfTypeahead`, no en la del shell: **no lleva ese atributo
y la regla no casa con nada**. Así llegó el buscador global de la Fase 5.5, con 7 reglas de
estilo que no pintaban. Se arregló exponiendo `--nf-ta-*` en `nf-typeahead.scss` y fijándolas
sobre `nf-typeahead` (el host sí lo alcanza la hoja de la vista). Grep para auditarlo:

```bash
grep -ohE "[^{]*\.nf-[a-z][^{]*\[_ngcontent[^]]*\]\{" dist/cgc-frontend/browser/*.js
```

Lo que salga apuntando a un hijo interno (`__algo`) está muerto. Lo que apunte a una clase host
(`.nf-avatar` a secas) está bien.

En toda la migración aparecieron 13 casos: 9 eran clase host (seguros), 2 se resolvieron con
custom properties, y 2 (`.nf-game-icon`) apuntaban a un componente **que no existe en el repo**.

**Tamaño de hoja**: Angular avisa a 24 kB y falla a 32 por hoja de componente
(`anyComponentStyle` en `angular.json`). Una vista-página no es un componente del tamaño que
asume ese umbral, pero **no subas el presupuesto**: parte la hoja por bloques y usa `styleUrls`
con varios ficheros, como hacen `shell.ts` y `grupo-ranking.ts` (base + `-podio` + `-historial`).
Ojo: ese presupuesto **no ve el CSS global**, así que hoy pasa solo porque el monolito lo esquiva.
Sacar CSS a componentes es la primera vez que ese límite mira de verdad.

### La duplicación es otro problema, y se arregla con tokens (no con ficheros)

`views.scss` **casi no duplica selectores** (22 repetidos de 1.591 únicos, 1,4%) y **no solapa
nada** con las hojas ya extraídas. Pero el **9,6% de sus declaraciones tienen un gemelo byte a
byte**, y no es copia-pega de componentes:

```
44 reglas idénticas: { color: var(--nf-text-dim); font-size: 11px }
 8 reglas idénticas: { color: var(--nf-text-dim); font-size: 12px }
 8 reglas idénticas: { display: flex; align-items: center; gap: 8px }
```

Eso es **una decisión de diseño sin nombre, escrita 44 veces**. "Texto secundario pequeño" es un
estilo del design system que no existe como token, así que cada componente lo reinventa.

La escala `--fs-*` **ya existe** en `styles/tokens/typography.css` y estaba al 4% de adopción
(24 usos con token frente a 556 en px crudos, solo el bloque `cx-` la usaba). Hay además medios
escalones inventados sobre la marcha: `11.5px` ×24, `12.5px` ×17, `13.5px` ×13; y `13px` (×54) no
tiene token.

**Duplicación y ubicación son problemas independientes.** Partir el fichero no crea duplicación
(esas 44 reglas ya pertenecen a 44 componentes distintos) ni juntarlo la arregla (ya está todo en
un fichero y sigue duplicado).

**Hecho: 360 sustituciones exactas**, sin mover un píxel (los temas no redefinen la escala, así
que la equivalencia es total): `11px → var(--fs-label)`, `14px → var(--fs-body)`,
`15px → var(--fs-body-lg)`, `18px → var(--fs-h3)`, `30px → var(--fs-h1)`. La regla
`font-size-raw` bajó de 750 a 390.

**Pendiente, y es decisión de diseño tuya, no mecánica.** Los 390 que quedan no se pudieron
sustituir porque *la escala tiene huecos y una ambigüedad*:

| valor | usos | problema |
|---|---|---|
| `12px` | 134 | **ambiguo**: `--fs-eyebrow` y `--fs-caption` valen los dos 12px. Un token semánticamente equivocado miente más que un `px` crudo, así que no se eligió a ciegas |
| `13px` | 93 | **sin token**. Es el segundo valor más usado de la app y no está en la escala |
| `16px`, `17px` | 28 | sin token |
| `12.5px`, `13.5px` | 43 | medios escalones inventados sobre la marcha |

Lo sensato es cerrar la escala (¿fusionar `eyebrow` y `caption`? ¿añadir un peldaño en 13px?
¿redondear los medios escalones al vecino?) y entonces la sustitución del resto vuelve a ser
mecánica. `npm run arch` lo vigila para que no se quede otra vez al 4% de adopción.

### Carpetas

`features/shell/views/` es una carpeta plana con 48 ficheros donde `admin-seguridad.ts`,
`perfil.ts` y `no-encontrado.ts` son hermanos. `views` no es una capa, es un cubo. **Agrupa por
dominio**, como ya hacen bien `views/cross/` y `views/match-history/`: `views/admin/`,
`views/grupo/`, `views/perfil/`. Al tocar una vista por otro motivo, muévela.

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
    @case ('loading') { <nf-skeleton .../> }
    @case ('error')   { <error + botón reintentar> }
    @default {
      @if (entity(); as e) { ... } @else { <404 real> }
    }
  }
  ```
- **Ningún dato de red aparece de golpe.** Todo lo que llega por HTTP —incluido un simple
  badge o un nombre— se pinta con `<nf-skeleton>` mientras `status()` sea `loading`. Reglas:
  - El skeleton tiene la **misma forma, tamaño y márgenes** que el contenido final: al llegar
    el dato no salta nada de sitio (cero layout shift). Un skeleton que no reserva el hueco
    exacto es peor que no ponerlo.
  - Nunca rellenar el hueco con un valor de mentira mientras carga (iniciales `??`, `0`, `—`):
    el usuario lee eso como dato real y luego lo ve cambiar.
  - El contenedor que espera lleva `aria-busy="true"`; los skeletons son `aria-hidden`.
  - Spinner solo para **acciones** en vuelo (botón en `pending`), nunca para bloques de
    contenido; skeleton solo para **contenido**, nunca para acciones.
  - Skeleton ≠ estado vacío: si el dato llega y no hay nada que enseñar, va el estado vacío
    con CTA.
  - El arranque (mientras `authGuard` espera a `/me` la raíz no tiene nada que pintar) lo
    cubre el splash de `App` (`booting`). Si algún guard nuevo bloquea una ruta, comprueba
    que no deja un blanco: o resuelve rápido, o la vista se pinta con skeletons.
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

**Formato de error (contrato acordado con backend)**

El backend responde los errores como **ProblemDetail (RFC 7807)** extendido con un **`code`
estable y obligatorio** legible por máquina. Ejemplo real:

```jsonc
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Unsupported image type; use JPEG or PNG", // técnico/inglés: SOLO para logs
  "instance": "/api/v1/groups",
  "code": "UNSUPPORTED_IMAGE",                          // ← la clave que consume el front
  "errors": [{ "field": "name", "code": "TOO_LONG" }]   // ← solo en 422 (validación por campo)
}
```

Reglas de oro del manejo de errores:
- **`detail` NUNCA se pinta**: viene en inglés y es técnico. Es solo para logs/telemetría.
- **El front es dueño del texto en español.** El catálogo `code → mensaje` vive en
  `core/http/api-error.ts` (`MESSAGES_BY_CODE`). Añadir un `code` nuevo en backend obliga a
  añadir su traducción ahí.
- **Todo `catch` de una escritura pasa por el helper**, nunca una string fija que se traga el
  error: `this.toasts.error(errorMessage(e))` (import desde `core/http`). Prohibido el patrón
  viejo `catch { toasts.error('No se pudo...') }`.
- **Cadena de fallback** (en `messageForError`): `code` conocido → mensaje específico; `code`
  desconocido → genérico por `status` + `console.warn` para catalogarlo; sin `code` → genérico
  por `status`; red/timeout (`status 0`) → mensaje de reintento. Nunca cuelga sin mensaje.
- **`422`**: usar `ApiError.errors[]` para mapear cada `code` a su campo del formulario.
- Nuevos códigos que descubramos en runtime salen por `console.warn`; catalogarlos cuanto antes.

**Errores HTTP (mapa de decisiones)**
- `401`: **ya resuelto de forma central** en `core/http/session-recovery.ts`
  (`sessionRecoveryInterceptor`): renueva el token con `forceRefreshSession()` y **reintenta la
  petición original** (una sola vez, con la renovación deduplicada entre peticiones simultáneas);
  solo si el refresh falla → `Session.clear()` + vuelta a login. Ningún store ni vista debe tratar
  el 401 endpoint a endpoint: para ellos ese error ya no llega, o si llega es sesión terminada.
  **Excepción: todo transporte que esquive `HttpClient` no está cubierto por el interceptor** —
  hoy el stream SSE de notificaciones (`fetch` a pelo, porque `EventSource` no admite cabeceras),
  mañana el WebSocket de salas. Esos deben pedir la renovación a mano (`SessionRecovery.refresh()`,
  ver `NotificationsStore.reconnectWithFreshToken()`); si no, reintentan para siempre con un
  Bearer muerto.
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

- ~~**Formato de error**~~ → **ACORDADO**: ProblemDetail RFC 7807 + `code` estable obligatorio.
  Documentado arriba en § "Formato de error" y en `core/http/api-error.ts`.
- ~~**Contrato de paginación**~~ → **ACORDADO**: paginación por **offset**. El cliente manda
  `?page=&size=` (`page` 0-based) y recibe `PageResponse<T>` = `{ content, page, size,
  totalElements, totalPages }`. El tipo vive en `core/http/page.ts` (uno solo para toda la app,
  no una copia por dominio). `totalElements` es el total de la colección, así que también es el
  contador que se pinta ("24 miembros"), nunca `content.length`. `<nf-pagination>` es 1-based:
  al pintarlo va `[page]="page + 1"` y al recibir el evento se resta 1.
  Lo usan `GET /admin/feedback` y `GET /groups/{id}/members`.
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
- **Plantilla inline hasta ~150 líneas; a partir de ahí, `templateUrl`.** La regla anterior
  ("inline por defecto, `templateUrl` solo si crece mucho") se escribió cuando una vista cabía
  en pantalla, y ha producido ficheros de 2.300 líneas donde lógica y markup se pisan
  (`grupo-crear-partida.ts`: 947 líneas de plantilla dentro del `.ts`). El umbral lo vigila
  `npm run arch` (regla `inline-template-size`).

## UI kit y estilos

- Primitivas en `src/app/ui/` (`NfButton`, `NfWindow`, `NfModal`, `NfBadge`, `NfToggle`, `NfSelect`,
  `NfSegmented`, `NfPagination`, `NfAvatarPicker`, `NfSkeleton`, `NfToastHost`), exportadas por
  `ui/index.ts`. Antes de crear markup ad-hoc (modales, paginación...), mira si existe o debe
  existir una primitiva `nf-*`.
- Los componentes **consumen** tokens `var(--nf-*)`; solo `src/styles/tokens/` los declara.
- **Zoom de interfaz**: en escritorio (`min-width: 1000px`) la app se pinta al 110% vía
  `zoom` en `:root` (`--nf-zoom`, en `tokens/base.css`). Consecuencia práctica: **nunca escribas
  `100vh`/`100vw` a pelo** — el zoom pre-multiplica el valor usado y las unidades de viewport se
  pasan un 10%. Usa `calc(var(--nf-vh) * 100)` / `var(--nf-vw)`, que ya compensan. Los `%` y los
  anchos `auto` no necesitan nada. Los breakpoints (todos ≤ 860px) quedan fuera de la zona
  escalada a propósito: las media queries miden el viewport sin escalar.
- **Nombres de color, nunca**. Tokens, tipos y variantes se nombran por lo que *significan*
  (`--nf-primary`, `--nf-danger`, `color="success"`), no por el color que salga hoy. La app
  ya arrastró un juego de tokens llamado `--nf-pink`/`--nf-cyan` que acabó pintando azul.
  Excepción única: los bandos de LoL (`'blue' | 'red'`, `.lm-side--*`, `.cp-team--*`), que
  son dominio y no tema.
- **Temas**: `core/theme` mantiene `<html data-theme>`; cada skin es un fichero en
  `src/styles/themes/` que redefine tokens. El tema por defecto (`nocturne`) vive en
  `styles/tokens/` y **no lleva atributo**, así que `:root` a secas ya es el defecto.
  Skins actuales: `nocturne` (default) y `original` (port del look legacy).
  El selector vive en **Ajustes**, no en la barra. Al añadir una skin: fichero en `themes/`,
  entrada en `THEMES`, import en `styles.scss` y el `if` del script inline de `index.html`.
- **Una skin es solo CSS, sin excepciones.** Si para cambiar de tema hace falta tocar markup,
  el que está mal es el markup. Hubo una excepción declarada —`NfWindow` consultaba el tema
  por un token `NF_THEME` para decidir si pintaba una barra de ventana retro— y se resolvió
  borrando la barra, no ampliando la excepción. `ui/` ya no importa de `core/` en ningún sitio,
  y `npm run arch` (regla `layers`) lo mantiene así.
- **Copy en frase normal, siempre.** Ni MAYÚSCULAS ni glifos decorativos en las plantillas ni
  en constantes de TS. Ningún componente transforma el texto que recibe: lo que escribes es
  lo que se pinta. Ojo al distinguir copy de valores de dominio: los enums del backend
  (`OWNER`, `CONFIRMED`), los códigos de región y las siglas (`KDA`, `MVP`, `CS`) van en
  mayúsculas porque *son* así; si un enum se pinta en pantalla, pásalo por una función de
  etiqueta (ver `groupRoleLabel()` en `core/groups/group-view.ts`).
- Tipografía: la pila del sistema, sin webfonts. `.nf-mono` ya no cambia la familia; marca
  cifras que deben alinearse (`tabular-nums`). **Nada por debajo de 11px** — no es una
  recomendación: la app llegó a tener 91 declaraciones por debajo de ese suelo y era el
  motivo principal de que costase leerla.
- Feedback al usuario: `ToastService` (`core/toast.ts`) + `NfToastHost`.

## Testing

- Vitest (jsdom). Mínimo exigido por dominio migrado: specs del store y del `*-api.ts`
  (incluyendo loading/error/reintento y no-reentrada de escrituras). `*.spec.ts` junto al fichero.
- No escribir tests de lógica placeholder (categoría desechable).

## Reglas verificadas (`npm run arch`)

Este documento tenía un problema: **decía la verdad y no la hacía cumplir**. El suelo de 11px
llevaba 25 incumplimientos; "`ui/` no importa de `core/`" era falso; la regla de no engordar
`views.scss` estaba escrita *dentro de un comentario de `grupo-detalle.scss`* y se ignoró quince
veces. Una regla que nadie verifica es un comentario.

`scripts/arch-check.mjs` es el equivalente a ArchUnit para este repo. Node puro, sin dependencias,
corre en <1s, y CI lo ejecuta en cada PR (`.github/workflows/ci.yml`). Comprueba:

| regla | qué vigila |
|---|---|
| `layers` | `features → core\|ui\|shared`, `core → shared`, `ui`/`shared` hojas |
| `feature-internals` | una feature no importa internals de otra |
| `api-url` | `environment.apiUrl` solo en `*-api.ts` (infra de `core/http`, `core/auth` y `app.config.ts` exentas por diseño) |
| `views-scss-size` | `views.scss` no crece **nunca** |
| `dead-css` | clases de **cualquier** hoja de `app/` que ningún `.ts`/`.html` referencia |
| `css-total-size` | CSS total del proyecto (mover del monolito al componente es neutro; borrar, no) |
| `inline-template-size` | plantilla inline > 150 líneas |
| `font-floor` | `font-size` < 11px |
| `font-size-raw` | `font-size` en px crudos en vez de la escala `--fs-*` |
| `viewport-units` | `100vh`/`100vw` a pelo (el zoom de `:root` los desvía un 10%) |

**Es un trinquete, no un muro.** La deuda actual está anotada en `scripts/arch-budgets.json`; el
check falla solo si una regla **empeora**. Así se adopta con el repo como está, sin big-bang.

- Si lo rompes: **arregla el código**. Subir un presupuesto es hacer trampa y se ve en el diff.
- Si lo mejoras (borras CSS muerto, sacas una plantilla): `npm run arch:fix` baja el presupuesto y
  lo commiteas. El número solo baja; eso es lo que hace que el repo converja.
- Añadir una regla nueva a este documento significa añadirla al script. Si no se puede verificar,
  escríbela igual pero sabiendo que es una recomendación, no una regla.

## Deuda conocida (no la propagues)

- `views.scss`: quedan ~4.000 líneas, y son las que **deben** quedar (bloques compartidos por
  varios componentes). Sigue congelado: cero líneas nuevas. Ver § "Organización de ficheros".
- `features/shell/views/`: ficheros planos sin agrupar por dominio (`cross/`, `match-history/` y
  `profile/` sí lo están; el resto no).
- Vistas gigantes: `grupo-crear-partida.ts` (2.327 líneas, 947 de plantilla inline),
  `grupo-sala.ts` (1.473/826), `grupo-ranking.ts` (1.417/714), `perfil.ts` (1.402/846). Su lógica
  de negocio es placeholder del backend: **no la refactorices** — se adelgazará sola al migrar
  matchmaking/MMR/resultados a endpoints. Pero sacar **plantilla y CSS** de ahí no es refactorizar
  negocio: es gratis, es mecánico y sobrevive a la migración. Hazlo cuando toques la vista.
- Duplicados pendientes de unificar en `shared/`: resolución de `:id`→grupo (repetida en 8
  vistas), `avatarBg(hue)`, bloque 404.
- **CSS ad-hoc que duplica primitivas que ya existen**: `.modal*` en 6 vistas pese a `NfModal`,
  `.tabs*`/`.seg*` en 5 pese a `NfSegmented`. Al desmontar `views.scss`, esos bloques no se
  mueven: se borran y se usa la primitiva. `.field*` (9 vistas) sí es candidato a primitiva nueva
  (`NfField`), no existe todavía.
- Rutas huérfanas: `crear.ts` y `partidas.ts` no están en `app.routes.ts`. Ya no caen en el
  login: el wildcard interno del shell pinta `no-encontrado`. (`campeones.ts` se renombró a
  `tierlist.ts` y sí tiene ruta.)
- `lobby.ts` es un God-module de tipos + datos semilla; al migrar cada dominio, mueve sus tipos a
  `core/<dominio>/models.ts` y borra sus semillas.
- `GroupStore.selectedId` es estado de UI (sidebar del shell) viviendo en un store de dominio, y
  las vistas lo sincronizan vía `effect()` — no extender ese patrón.
- `tsconfig` aún sin `strict` ni `strictTemplates`; UI kit aún con `@Input()` legacy; sin
  `provideZonelessChangeDetection` explícito. El objetivo es activarlos — no escribas código
  nuevo que lo impida.
- `environment.prod.ts` tiene `apiBaseUrl` placeholder (`TODO`).
- Advertencia de bundle budget en producción: `Initial total 838,94 kB vs 500 kB`. Bajó desde
  976,88 kB al sacar el CSS del monolito global a los chunks lazy; lo que queda es sobre todo
  generadores y semillas deterministas del frontend (Fase 0/1), que se borran al migrar a
  endpoints reales en la Fase 6.
- **Deuda heredada de la Fase 5.5**, anotada en `scripts/arch-budgets.json` al integrarla y
  pendiente de pagar. No la metió la migración del CSS; venía en el código nuevo:
  - `font-floor` +19 (23 → 42): declaraciones nuevas por debajo de 11px, sobre todo en la barra
    de notificaciones y el buscador del shell. El suelo no es una recomendación (§ "UI kit").
  - `font-size-raw` +71 (390 → 461): `font-size` en px crudos en vez de la escala `--fs-*`.
  - `inline-template-size` +1 (21 → 22).
  No se corrigieron aquí a propósito: subir esos textos cambia el aspecto de features recién
  revisadas, y esa es una decisión visual, no mecánica.
