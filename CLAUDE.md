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
npm run api:types  # regenera los tipos del backend (ver § "El contrato del backend")
```

**Antes de dar por terminado cualquier cambio: `npm run arch && npm test`.** El primero es
instantáneo y es lo que impide que este documento vuelva a ser decorativo.

## Cómo se leen los documentos del proyecto (regla de coste)

Los documentos de dominio y planificación viven **fuera de este repositorio**, en la raíz `main/`,
y dos de ellos son enormes: **`Roadmap.md` pesa 355 KB (~90.000 tokens)** y **`FlujoJuego.md`
110 KB**. Leerlos enteros para «tener contexto» se gasta el presupuesto de una sesión antes de la
primera decisión, y casi todo lo leído no hacía falta.

**Ninguno de los dos se lee entero jamás.** Los dos llevan un índice de secciones con rangos de
línea al principio. El procedimiento es localizar la sección y leer solo esas líneas:

```bash
grep -n "^#\{1,4\} " ../Roadmap.md        # el mapa: encabezado → línea
sed -n '3155,3290p' ../Roadmap.md         # y se lee solo el tramo que interesa
```

Única excepción: un refactor que reescriba el documento. Lo que **sí** se lee completo es
`../prompt.md`, que es el briefing de arranque y está escrito para eso, y este mismo fichero.

`FlujoJuego.md` es la **fuente de la verdad del dominio**: cuando contradice a `Roadmap.md`, gana
él y el roadmap se corrige en el mismo turno.

## Estrategia de migración mock → backend (LA decisión de arquitectura)

**Ya hablan con backend real**: `auth` (OIDC code+PKCE contra nuestro backend; Discord es solo
el IdP), `groups`, `leagues`, `lobbies`, `matches`, `game-data`, `notifications`, `preferences`,
`riot`, `sessions`, `settings`, `feedback`, `discord`, `users` y `admin`.

**Sigue siendo mock en memoria**, sembrado con constantes y generadores deterministas
(`seeded`/`hash`): `core/lobby.ts` y `lobby-extras.ts` (el God-module legacy), `group-store.ts`,
`group-hub.ts`, `group-stats.ts`, `group-medals.ts`, `group-ranking.ts`, `member-detail.ts`,
`player-profile.ts`, `champions` (tiene su `*-api.ts`, pero el store se alimenta del mock hasta
que exista el endpoint) y `reactions` (que además es local del navegador: no hay tabla ni
endpoint).
Los comentarios `BACKEND NOTE:` marcan cada punto de integración.

**El backend será el dueño de TODA la regla de negocio**: matchmaking, cálculo de MMR/elo,
validaciones de draft, TTL de salas, permisos, resolución de conflictos de importación,
generación de ids/códigos/timestamps. La lógica de ese tipo que hoy vive en el front
(en stores mock, generadores y semillas deterministas...) es un
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
con varios ficheros, como hacen `shell.ts` y `group/grupo-ranking.ts` (base + `-podio` +
`-historial`).
Ojo: ese presupuesto **no ve el CSS global**, así que hoy pasa solo porque el monolito lo esquiva.
Sacar CSS a componentes es la primera vez que ese límite mira de verdad.

**Al partir una hoja, comprueba que declaras TODAS las partes en `styleUrls`.** Nada avisa si te
dejas una: no falla el build, no lo ve `dead-css` (sus clases siguen apareciendo en el markup, así
que las da por vivas) y no lo ve `css-total-size` (el fichero sigue ahí, contando). `grupo-ranking`
partió su hoja en tres y siguió declarando solo la base: 1.133 líneas —el podio entero y el cajón
de historial del jugador— llevaban desde entonces sin cargarse, y esas dos zonas de la vista se
pintaban sin estilo. Para auditarlo, cada hoja de `app/` debe aparecer en algún `styleUrl(s)`:

```bash
for f in $(find src/app -name '*.scss'); do
  grep -rqF "'./$(basename $f)'" --include=*.ts src/app || echo "huérfana: $f"
done
```

Hoy solo señala `views.scss`, y es el falso positivo esperado: el monolito es global y se declara
en `angular.json`, no en un `styleUrl`. Cualquier otra cosa que salga ahí es CSS que no se carga.

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

`features/shell/views` no es una capa, es un cubo: **agrupa por dominio**. Fue una carpeta plana
de 48 ficheros donde `admin-seguridad.ts`, `perfil.ts` y `no-encontrado.ts` eran hermanos, y ya
no lo es. Hoy:

```
views/
  admin/          directorio, feedback (+detalle), métricas de Riot, registro de seguridad
  cross/          el cruce con otro jugador: layout, cabecera, historial, versus, sinergia
  group/          las vistas de un grupo: lista, detalle, perfil, ranking, tierlist…
  group-hub/      tarjetas del hub que compone `group/grupo-detalle`
  group-board/    EL TABLÓN: salas vivas + convocatorias, y sus dos columnas
  group-lobby/    LA CONVOCATORIA: sus franjas, sus salas y su banquillo
  group-room/     LA SALA: los diez que juegan
  group-stats/    estadísticas del grupo y sus tarjetas
  match-history/  historial personal, detalle de partida y las tarjetas que comparten
  profile/        perfil propio, perfil de miembro y sus tarjetas
  ajustes.*  inicio.*  no-encontrado.ts  views.scss
```

Las carpetas se nombran **en inglés** y los ficheros conservan su nombre **en español**: es la
convención que ya traían `cross/` y `match-history/`, y mezclarla ahora costaría más de lo que
aclara. `group-hub/`, `group-board/`, `group-lobby/`, `group-room/` y `group-stats/` son hermanas
de `group/` y no hijas suyas a propósito: son las piezas de una sola vista cada una, y anidarlas
alargaría todos sus imports relativos sin decir nada nuevo.

Solo quedan sueltos los ficheros que de verdad son de raíz: las dos vistas que no pertenecen a
ningún dominio (`inicio`, `ajustes`), el 404 y el monolito `views.scss`. Al crear una vista
nueva, va dentro de su carpeta; si estrena dominio, se crea la carpeta.

### La zona de juego del grupo

Tres pantallas, una por objeto del dominio de `FlujoJuego.md` §2, más el monitoreo del reparto
colgando de la sala. **El vocabulario no es
decorativo: es lo que decide el nombre de cada ruta, cada carpeta y cada rótulo.**

| ruta | pantalla | qué es |
|---|---|---|
| `grupos/:id/tablon` | **Tablón** (`group-board/`) | Lo que hay ahora y lo que viene |
| `grupos/:id/convocatoria/:lobbyId` | **Convocatoria** (`group-lobby/`) | La llamada a jugar: sus franjas, sus salas, su banquillo |
| `grupos/:id/sala/:salaId` | **Sala** (`group-room/`) | Los diez que juegan. Sobrevive a cada partida (§10) |
| `grupos/:id/sala/:salaId/reparto` | **Reparto** (`group-room/`) | Por qué salió ese reparto y no otro. **Solo admins del grupo** |

**Una «partida» es una custom ya jugada, y eso está en Historial.** Por eso la sección dejó de
llamarse «Partidas»: no contenía ninguna. Y por eso el botón del host se llama **`Formar
equipos`** y no «Generar partida» — si el menú y el botón usan la misma palabra para el sitio y
para el acto, nadie sabe cuál creó qué.

Solo viajan **dos ids** y ninguno se llama `roomId`, que era vocabulario del mock:

```text
lobbyId ── la convocatoria (con franjas, o sin ellas si es «jugar ahora»)
  ├─ salaId  Sala 1
  ├─ salaId  Sala 2
  └─ banquillo (sin sala)
```

`partyId` **no es un nivel intermedio**: §2 la define como el contenedor de *una* convocatoria en
rotación, o sea 1:1 con ella, así que no aparece en ninguna URL. La **tanda** tampoco: es una
sección dentro de la pantalla de convocatoria.

El **reparto** cuelga de la sala porque es esa sala vista por dentro, no una sección aparte.
Lo lee `GET /lobbies/{id}/balance/explanation` y **solo lo abren los admins del grupo**: la
respuesta dice lo que valía cada jugador en cada línea, y eso el grupo no ha acordado
enseñárselo entre ellos — el backend responde 403 a todos los demás, incluido el convocante que
generó el reparto, así que la entrada se esconde en vez de ofrecer una puerta cerrada. Tres
cosas de esa pantalla vienen del contrato y no son estilo: `globalDifference` no se pinta nunca
sin `uncertainty` (una cifra sola, con una suposición dentro, es peor que no dar cifra),
`provisional` va arriba y bien visible, y `repetition`/`familiarity` son la mitad que faltaba de
la explicación. Hasta que el front no genere los equipos contra el backend, esa pantalla
responderá `BALANCE_NOT_RECORDED` en las salas que existan.

**BACKEND NOTE — `salaId` es hoy el `lobbyId`.** El servidor todavía no crea filas de sala y una
convocatoria rinde exactamente una (`starters` + `bench`). La ruta ya tiene su forma definitiva:
en la Fase 6 solo cambia el store que resuelve ese id, no la URL.

**Lo que falta: «Jugar ahora»** (§4.1), la puerta principal según ese documento. No entra todavía
porque el backend la rechaza por cuatro reglas independientes, y la cuarta no está en §17.3 —
la encontró esta sesión: `CreateLobbyRequest.slotStartTimes` lleva `@NotEmpty`; `confirmIfFull` es
el único camino a `CONFIRMED`; `checkCanFreezeLineup` exige estar confirmada; y **`findExpired`
cancela cualquier `POLLING` sin franja futura**, así que una sala abierta «ahora» la barre el
cron a la hora. Está anotado en la Fase 6 del `Roadmap.md`.

## El historial de partidas, y las tres reglas que trajo consigo

Es el dominio más grande conectado hasta ahora (issue #69) y dejó tres reglas que no son suyas:
aplican a cualquier cosa que llegue del backend.

### 1. Lo que no se sabe es `null`, y `null` no es `0`

`hasStats: false` es un estado REAL: el grupo jugó, alguien tecleó el resultado y **nadie exportó
la partida desde el cliente de LoL**. Contó para el LP y para el rating, así que sale en la lista
igual —esconderla dejaría una clasificación que el historial no puede explicar—, pero todo lo que
dependía de esa subida llega nulo: duración, campeón, KDA, `riotId`, totales del equipo, MVP.

Rellenar eso con ceros es la tentación obvia y es exactamente lo que no se puede hacer: un
`kills: 0` se lee como una partida de verdad en la que un equipo no mató a nadie, y esa mentira
**no la detecta nadie mirando la pantalla**. Lo mismo con `lpDelta`: `0` es «contó y no movió
nada», ausente es «no contó para ninguna liga».

En pantalla, un hueco se pinta como hueco (`—`, un recuadro vacío, una píldora que no aparece) y
se explica una vez, no diez: el aviso va al pie de la fila, no en cada uno de los diez asientos.

### 2. El lado (azul/rojo) puede no existir; el hueco (A/B) siempre

Quién vistió de azul lo decide la sala y **puede no haberse decidido nunca**. Entonces
`winnerSide` y el `side` de los dos equipos llegan `null`, y la tarjeta dice «Equipo A» / «Equipo
B» y se pinta en neutro. Derivarlo del orden de entrada a la sala es literalmente el bug de la app
anterior: produjo un jugador 14-0 «en azul» sin que nadie lo hubiera elegido.

Por eso los dos viajan (`slot` siempre, `side` a veces) y por eso `teams` es un par ordenado por
hueco en vez de `blueTeam`/`redTeam`. Consecuencia práctica: **el color es pintura, el orden y la
identidad salen del hueco**. `teamLabel()` de `match-view.ts` es el único sitio que decide cómo se
nombra un equipo.

Y los objetivos de la grieta **no vienen si no hay lado decidido**: son del equipo 100/200, así
que colgarlos de A o de B sería inventar. Sin ellos, el bloque entero no se pinta.

### 2.bis Una partida anulada sale en la lista y no cuenta en el resumen

`voided` es una anulación explícita: rebobina el rating y reconstruye el LP como si la partida no
hubiera existido. Ni victoria ni derrota — su `userOutcome` es `'cancelled'` y se pinta en neutro.

**La fila sale igual**, con su alineación, para que una sala terminada siga teniendo explicación.
Pero **ningún número de ningún resumen la cuenta**. De ahí la consecuencia que hay que tener
presente al escribir cualquier contador:

> el `totalElements` de un listado y el `totalMatches` de su resumen **no tienen por qué
> coincidir**. La lista es el registro de lo que pasó; el resumen, lo que cuenta.

No es un descuadre, pero lo parece, así que las dos pantallas que enseñan las dos cifras juntas lo
dicen en voz baja (`gh-summary__scope` y la tarjeta de récord del historial personal).

### 3. Con la lista en el servidor, el cliente ya no tiene corpus

Filtrar, ordenar, buscar y paginar los hace el servidor. Lo que hay en el cliente es **una
página**, y eso mató una familia entera de derivaciones que antes eran correctas: el resumen del
historial, «mejor aliado», «némesis», las medias comparadas del cruce, las rachas vivas y los
emparejamientos de campeón repetidos. Todas recorrían el historial completo.

La regla que queda: **cualquier cifra que describa «tu historial» o «el grupo» tiene que venir de
un endpoint de resumen, no de sumar lo que hay en pantalla.** Sumar seis filas y llamarlo
«vuestro récord» es peor que no darlo, y no se distingue mirando.

Cuando una superficie de verdad necesita un corpus (el cajón de partidas recientes del ranking,
la tarjeta de MVP de Inicio), se pide una **muestra acotada** —`MatchHistoryStore.groupSample()`,
una sola página del tamaño máximo— y **la pantalla dice que es una muestra**: «sobre las últimas
N partidas». Lo que no puede es llamarse «del grupo» a secas.

La tier list de campeones **ya no usa esa muestra**: tiene su propio dominio (`core/champions`,
`ChampionStatsStore`), que hoy se alimenta de `champion-stats-mock.ts` y muere con su endpoint.
Es el camino bueno para una agregación de este tipo, y es preferible a la muestra: esta última es
el apaño para las superficies que todavía no tienen endpoint propio.

### Dos tipos de consulta, porque un filtro no significa lo mismo en las dos listas

| | Lista de grupo | Lista personal |
|---|---|---|
| `championId` | el campeón de **cualquiera** de los diez | el campeón que jugué **yo** |
| `outcome` | **no existe** | cómo me fue **a mí** |
| `winningSide` | qué bando ganó | **no existe** |
| `lane` | **no existe** | la línea que jugué **yo** |
| `participation` | todas / mías / de los demás | **no existe** |

`outcome` y `winningSide` no son la misma pregunta, y confundirlas ya costó un bug: el `outcome`
de la lista de grupo descartaba solo las partidas que habías jugado, así que «Victorias» enseñaba
tus victorias MÁS todas las partidas ajenas. Por eso `GroupMatchQuery` y `PersonalMatchQuery` son
tipos distintos: el compilador impide mandar `winningSide` a `/me/matches`.

**El cruce con otro jugador es un filtro, no un endpoint**: `GET /me/matches?with={userId}`, y
`&relation=ALLY|ENEMY` lo acota. El recuento sale del mismo resumen con los mismos parámetros. La
relación la decide el servidor leyendo los dos equipos.

### La identidad de un asiento viene en el asiento

Cada uno de los diez trae `riotId`, `discordUsername` y `avatarUrl`, y los dos últimos **llegan
siempre**, con subida o sin ella. La asimetría es del backend y es deliberada: el `riotId` es el
del día que se jugó (parte de lo que pasó, no se reescribe) y el nombre de Discord es el de hoy
(sirve para reconocer a alguien, así que sigue los cambios de nombre). `participantName()` los
lee en ese orden.

**Ninguna vista resuelve nombres contra el censo del grupo**, y no debe volver a hacerlo: hubo un
`PlayerDirectory` que las pantallas construían desde `GroupDetailStore.roster()` y se borró al
llegar estos campos. No servía en `/me/matches` —ahí cada fila es de un grupo distinto y puede que
ni sigas siendo miembro— y obligaba a enhebrar un input por toda la cadena de componentes.

La excepción es legítima y está sola: el **líder de MVPs** del resumen de grupo llega como un
`userId` pelado, así que esa pantalla —que ya tiene el censo cargado— lo busca ahí.

Lo mismo con el grupo: la fila trae `groupId` y `groupName` en **las dos** listas, también en la
del propio grupo donde es redundante. Esa igualdad de forma es lo que permite pintarlas con un
solo componente.

### Lo que el backend no sirve todavía (y por qué no se rellena)

Objetos, runas, hechizos del listado, nivel de campeón, wards, cualquier cifra de dragones,
`damageSharePercentage` y `wonLane`. Los primeros están guardados, pero con nombres de campo sacados de la documentación del
cliente de LoL que **nadie ha visto en un payload medido**. Mientras tanto se pintaban con tablas
de reserva por línea —el jungla siempre con Smite azul, el soporte siempre con Protector— que no
describían ninguna partida real. `itemBg()` se queda esperando; el resto se borró.

`damageShare` y `wonLane` sí se derivan aquí, y se dice: el reparto de daño sale de los cinco del
equipo (un campo almacenado y este cálculo llegaron a decir 37% y 34% del mismo jugador), y «ganó
la línea» sale del oro del minuto 14 contra el rival de su misma línea, **etiquetado como
estimación nuestra** allí donde se pinta.

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

## El contrato del backend (`npm run api:types`)

El backend publica su contrato commiteado en dos ficheros, y **los genera un test suyo que falla
si dejan de describir lo que sirve el código**:

- `cgc-backend/http/openapi.json` — la forma de cada endpoint
- `cgc-backend/http/api-error-codes.json` — los `code` de error estables, con su status

`npm run api:types` (script en `scripts/api-contract.mjs`) los lee **del disco** —`cgc-backend`
es un repo hermano, no hace falta levantarlo— y escribe:

- `src/app/core/http/api-types.d.ts` — `paths`, `operations` y `components['schemas']`
- `src/app/core/http/api-error-codes.ts` — `ApiErrorCode`, la lista cerrada de códigos

**Los dos van commiteados**: `npm run build` no puede depender de que tengas el backend clonado.

Qué gana esto, en concreto:

- `MESSAGES_BY_CODE` de `api-error.ts` está tipado contra `ApiErrorCode`, así que **un código que
  el backend renombra o borra es un error de compilación aquí**. Se estrenó encontrando dos
  traducciones muertas (`UNSUPPORTED_IMAGE` e `IMAGE_TOO_LARGE`) para un código que el backend
  nunca ha mandado: el real es `INVALID_AVATAR`.
- Al migrar un dominio de mock a HTTP, `api-types.d.ts` dice la forma exacta de la respuesta. No
  la copies a mano otra vez.

Ojo con dos cosas:

- **Todos los campos salen opcionales** (`id?: string`). Un `record` de Java no declara
  nulabilidad y springdoc no se la inventa. Es deuda conocida del backend, no algo que arreglar
  aquí.
- **`MESSAGES_BY_CODE` está tipado como `Record<ApiErrorCode, string>`, sin `Partial`.** Los 98
  códigos están traducidos, y el compilador te obliga a mantenerlo así: un código nuevo del
  backend **no compila** hasta que le escribes su texto en español. Ese es el aviso que antes
  dependía de que alguien se acordara de darlo. Si algún día estorba, `Partial<Record<...>>` lo
  relaja — y entonces lo que falte vuelve a caer al genérico por `status` sin que nadie se entere.

El detalle completo está en `cgc-backend/docs/contrato-api.md`.

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
- **Dragones.** `MatchTeamObjectives` trae `dragonKills` a secas y **nadie ha medido todavía si
  incluye a los ancianos**: producción está a cero partidas y no hay ni un bloque de equipo real.
  Los tipos de dragón y el alma no viven en ese bloque en ninguna versión del contrato, sino en
  los eventos del timeline. Mientras tanto **no se pinta ninguna cifra de dragones**: ni el eje
  del radar ni el contador de la cabecera de equipo. No es una reserva, es la misma regla de los
  nulos un nivel más abajo — enseñar `dragonKills` bajo la etiqueta «Dragones» afirma qué cuenta.
  No se pierde nada esperando: el backend guarda el bloque de equipo y el timeline en crudo, así
  que el día que se mida se tipa y se rellena hacia atrás, partidas viejas incluidas.

Cuando se acuerde uno, documentarlo aquí y borrar la línea de pendientes.

## Reglas de oro

1. **Identidad**: el usuario es `Session` (`core/auth`). `CURRENT_USER` de `lobby.ts` es mock
   legacy — prohibido en código nuevo (hoy los permisos `canManage`/`canEditPerks` comparan
   contra el mock; se re-derivarán de `Session` + backend al migrar cada dominio).
2. **DTOs espejo**: las interfaces de `models.ts` replican exactamente la respuesta del backend
   (como `CurrentUser` ↔ `MeResponse`). Si el backend cambia, cambia el modelo; no lo parchees.
   **Contrástalas con `core/http/api-types.d.ts`**, que es el contrato real generado — ver
   § "El contrato del backend".
3. **HTTP**: siempre `HttpClient` (ya provisto con `withFetch()` + `authInterceptor`). El Bearer
   se añade solo a `secureRoutes` (= `environment.apiUrl`); si añades otro host, regístralo ahí.
4. **Componentes finos**: un componente orquesta stores y navega. Si necesitas escribir un
   algoritmo dentro de una vista, o es presentación pura (→ `shared/`/`computed`) o es negocio
   (→ endpoint futuro: placeholder mínimo + `BACKEND NOTE:`).
5. **Estado de UI ≠ estado de dominio**: modales, tabs y selección visual viven en signals del
   componente, no en stores de `core/`.
6. **Un solo desplegable abierto a la vez.** Cuando una pantalla tiene varios elementos desplegables
   del mismo tipo —tarjetas de partida, filas de una tabla, acordeones, cajones de detalle—, **abrir
   uno pliega el que estuviera abierto**. Se comporta como un acordeón, no como una lista de
   casillas independientes. Es norma de toda la aplicación, no de una pantalla.
   - Hoy hay sitios que hacen lo contrario y hay que ir alineándolos: `MatchHistoryUiState` guarda un
     `ReadonlySet` de desplegados, y la tabla de líderes de las estadísticas del grupo admite varias
     filas abiertas.
   - Si una superficie necesita la excepción —comparar dos filas es a veces justo para lo que
     sirve—, se plantea antes de construirla; no se decide en silencio.
   - **`npm run arch` no puede verificar esto**: no es una regla de ficheros, de capas ni de CSS.
     Es de las que este documento clasifica como recomendación escrita y no como trinquete, así que
     depende de que se aplique al construir cada pantalla.

## Angular idiomático (obligatorio en código nuevo)

- Standalone + `inject()` (no constructor DI), control flow `@if/@for/@switch`.
- `ChangeDetectionStrategy.OnPush` en todo componente nuevo.
- Signal APIs: `input()`, `output()`, `model()` — no `@Input()/@Output()/EventEmitter`.
- Estado local con `signal`/`computed`/`linkedSignal`; streams de router con `toSignal`.
- Rutas hijas siempre `loadComponent` (lazy) con `title` definido.
- **Plantilla inline hasta ~150 líneas; a partir de ahí, `templateUrl`.** La regla anterior
  ("inline por defecto, `templateUrl` solo si crece mucho") se escribió cuando una vista cabía
  en pantalla, y produjo ficheros de 2.000 líneas donde lógica y markup se pisaban
  (`grupo-crear-partida.ts` llegó a tener 780 líneas de plantilla dentro del `.ts`). Las cuatro
  vistas peores ya tienen su `.html`; el umbral lo vigila `npm run arch`
  (regla `inline-template-size`), que solo mide la **primera** plantilla inline de cada fichero.

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
- **Nombres que un bloqueador de anuncios ocultaría, nunca.** EasyList —la lista por defecto
  de uBlock Origin, AdBlock Plus y AdGuard— trae ~8.800 reglas cosméticas **genéricas** del
  tipo `##.clase`, sin dominio que las acote: aplican `display:none !important` a ese nombre
  en cualquier página. El directorio de administración se llamó `ad-grid`/`ad-card` y
  **desapareció entero** para quien usara un bloqueador: DOM completo, guard pasado, consola
  limpia, pantalla vacía. Nada en desarrollo lo enseña. Las reglas casan el nombre EXACTO, así
  que el riesgo está en la **cabeza** del nombre: `gp-banner` es seguro, `banner` no. Lo vigila
  `npm run arch` (regla `adblock-bait`); el prefijo de esa vista es hoy `adm-*`.
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
| `css-total-size` | CSS total del proyecto, hojas **y** `styles: []` inline (mover es neutro; borrar, no) |
| `inline-template-size` | plantilla inline > 150 líneas |
| `font-floor` | `font-size` < 11px |
| `font-size-raw` | `font-size` en px crudos en vez de la escala `--fs-*` |
| `adblock-bait` | clases que los bloqueadores de anuncios ocultan solas (`ad-*`, `banner*`, `promo*`…) |
| `viewport-units` | `100vh`/`100vw` a pelo (el zoom de `:root` los desvía un 10%) |
| `emoji-free` | pictogramas de color en la interfaz (§ "UI kit": los iconos son SVG inline) |
| `legacy-angular` | `@Input()`/`@Output()`/`EventEmitter` en vez de `input()`/`output()`/`model()` |
| `onpush` | componente sin `ChangeDetectionStrategy.OnPush` |
| `ng-deep` | `::ng-deep`, que es API muerta |
| `toast-literal` | `toasts.error('…')` con string fija en vez de `errorMessage(e)` |
| `route-title` | ruta con vista propia y sin `title` (la pestaña se queda muda) |
| `nav-label` | segmento de ruta que `ROUTE_TITLES` de `shell-nav.ts` no sabe rotular |
| `theme-tokens` | token de **color** de `styles/tokens/` que una skin de `styles/themes/` no decide |

**Las tres últimas se añadieron el 2026-09-11 y entran las tres en cero**, o sea que son muros, no
trinquetes. Salieron de una revisión de huecos de conexión entre pantallas, y cada una destapó un
bug real que llevaba tiempo ahí: el `callback` de OIDC no tenía `title`, y la pantalla de **Reparto**
—`grupos/:id/sala/:salaId/reparto`, que existe desde hace semanas— no estaba en `ROUTE_TITLES`, así
que la barra superior la rotulaba «Página no encontrada» aunque la ruta funcionase. Los dos
arreglados aquí.

> **`theme-tokens` es el que más va a molestar, y a propósito.** Un token que una skin no redefine
> **no se rompe**: hereda el de `:root`. Por eso nadie se entera de que se está pintando con un color
> afinado para la otra paleta. La regla obliga a **decidir**, no a copiar: si el valor bueno es el
> mismo, se repite y ya está. Quedan exentos `--nf-brand-*` (el rojo de Riot es el rojo de Riot en
> los dos temas) y `--nf-shadow-*` / `--nf-edge-*`, que derivan de `--nf-shadow-color`, que sí está
> tematizado.

Las cinco anteriores se añadieron el **2026-09-10** y no son reglas nuevas: son reglas que este
documento ya exigía en prosa y que nadie verificaba, así que se incumplían sin que se notase
(90 líneas con emoji, 22 `@Input()`, 17 componentes sin `OnPush`, 9 `toasts.error()` literales).
Entraron con el incumplimiento de hoy como presupuesto: **no obligan a limpiar la deuda, obligan a
no añadir más**. `ng-deep` entró en **0**, que es un muro de verdad: los `::ng-deep` que aparecían
al grepear estaban todos dentro de comentarios que advertían contra él.

> **Ojo con `emoji-free`.** Distingue el pictograma de color del carácter tipográfico, que es la
> distinción que importa: caza lo que tiene `Emoji_Presentation` o lleva un `U+FE0F` detrás, así que
> `✓`, `★`, `▾`, `›`, `·`, `✕` y `⚠` a secas **no** son incumplimientos —la app los usa a propósito—
> y `🏆`, `⚔️` o `⚠️` sí. Quedan exentos `ui/emoji-picker/`, `core/reactions/` y
> `core/feedback/models.ts`, donde el emoji **es el contenido que escribe el usuario**, no
> decoración de la interfaz.

**Es un trinquete, no un muro.** La deuda actual está anotada en `scripts/arch-budgets.json`; el
check falla solo si una regla **empeora**. Así se adopta con el repo como está, sin big-bang.

- Si lo rompes: **arregla el código**. El presupuesto no es donde se esconde un incumplimiento.
- Si lo mejoras (borras CSS muerto, sacas una plantilla): `npm run arch:fix` baja el presupuesto y
  lo commiteas. **`arch:fix` solo baja**, nunca sube, y sale con código 1 si alguna regla ha
  empeorado — un `fix` que deja reglas en rojo no puede pasar por bueno en un script ni en CI.
- **Si el crecimiento es legítimo, se sube con motivo y queda escrito.** Una pantalla nueva trae
  CSS suyo, y `css-total-size` no es un techo al tamaño de la aplicación:

  ```bash
  npm run arch:fix -- --subir "pagina de Ajustes nueva"
  ```

  El motivo es obligatorio y se guarda en `_historial`, dentro del propio `arch-budgets.json`, para
  que quien revise el PR lo vea pegado al número en vez de tener que buscarlo en un mensaje de
  commit. **Lo que el script no puede decidir es si el crecimiento está bien** —una pantalla nueva
  y CSS duplicado sin querer suben igual—, y por eso esa frase la escribe una persona.

  > **Por qué existe esa fricción, en un caso real.** `arch:fix` escribía el valor medido de TODAS
  > las reglas, así que una que había empeorado se llevaba su techo hacia arriba sin que nadie lo
  > decidiera. El 2026-09-11 un `arch:fix` lanzado para bajar `inline-template-size` de 15 a 1
  > subió de paso `css-total-size` de 17.230 a 18.342, absorbiendo 1.112 líneas de CSS que había
  > metido **otra** tarea. Un trinquete que cede solo es un pasamanos.
- Añadir una regla nueva a este documento significa añadirla al script. Si no se puede verificar,
  escríbela igual pero sabiendo que es una recomendación, no una regla.
- La única subida legítima es **ampliar lo que una regla mide**, y se anota aquí. Pasó una vez:
  `css-total-size` solo miraba ficheros `.scss`/`.css`, así que el CSS escrito en `styles: []`
  dentro de un `.ts` no lo veía nadie —ni esa regla, ni `dead-css`, ni el presupuesto por hoja de
  `angular.json`—. El efecto era el contrario del que busca la regla: sacar CSS de un `.ts` a su
  hoja, que es lo que pide este documento, salía en el diff como un empeoramiento de cien líneas,
  y esconderlo salía gratis. Al empezar a contarlo aparecieron **812 líneas** que ya estaban ahí
  (16.871 → 17.733 sin tocar una línea de CSS). Ese salto es de medición; a partir de él, el
  número solo baja. `dead-css` y las reglas de tipografía siguen ciegas a ese CSS: es deuda
  anotada, no una decisión.

## Deuda conocida (no la propagues)

- `views.scss`: quedan ~3.000 líneas, y son las que **deben** quedar (bloques compartidos por
  varios componentes). Sigue congelado: cero líneas nuevas. Ver § "Organización de ficheros".
- Vistas gigantes: `group/grupo-ranking.ts` (917 líneas) y `profile/perfil.ts` (558) ya no llevan
  la plantilla dentro —cada una tiene su `.html` al lado— pero su **lógica** sigue siendo grande.
  Es placeholder del backend: **no la refactorices**, se adelgazará sola al migrar MMR y
  resultados a endpoints. Sacar **plantilla y CSS**, en cambio, no es refactorizar negocio: es
  gratis, es mecánico y sobrevive a la migración. Hazlo cuando toques una vista que aún no lo
  tenga. **`inline-template-size` ya está en 0**, así que dejó de ser un trinquete y es un muro:
  una plantilla inline de más de 150 líneas ahora rompe el check en vez de caber en el
  presupuesto. `match-scoreboard.component.ts` salió de esa lista al conectar el historial, y el
  resto cayó con la extracción de plantillas que llegó por `main`.
  Las otras dos que estaban aquí —el asistente `grupo-crear-partida.ts` y la sala mock
  `grupo-sala.ts`— **ya no existen**: ver § "La zona de juego del grupo". Y `partida-detalle.ts`
  tampoco: eran 552 líneas + 429 de SCSS que **ninguna ruta abría**, así que se borró en vez de
  migrarse. Toda vista de `views/` vuelve a tener su ruta.
- Duplicados pendientes de unificar en `shared/`: resolución de `:id`→grupo (repetida en 8
  vistas), `avatarBg(hue)`, bloque 404.
- **CSS ad-hoc que duplica primitivas que ya existen**: `.modal*` en 6 vistas pese a `NfModal`,
  `.tabs*`/`.seg*` en 5 pese a `NfSegmented`. Al desmontar `views.scss`, esos bloques no se
  mueven: se borran y se usa la primitiva. `.field*` (9 vistas) sí es candidato a primitiva nueva
  (`NfField`), no existe todavía.
- ~~Rutas huérfanas `crear.ts` y `partidas.ts`~~: ya no existen en el repo. Toda vista de
  `views/` tiene hoy su ruta en `app.routes.ts`.
- `lobby.ts` es un God-module de tipos + datos semilla; al migrar cada dominio, mueve sus tipos a
  `core/<dominio>/models.ts` y borra sus semillas.
- `GroupStore.selectedId` es estado de UI (sidebar del shell) viviendo en un store de dominio, y
  las vistas lo sincronizan vía `effect()` — no extender ese patrón.
- `tsconfig` aún sin `strict` ni `strictTemplates`; UI kit aún con `@Input()` legacy; sin
  `provideZonelessChangeDetection` explícito. El objetivo es activarlos — no escribas código
  nuevo que lo impida.
- `environment.prod.ts` tiene `apiBaseUrl` placeholder (`TODO`).
- Advertencia de bundle budget en producción: `Initial total 877,92 kB vs 500 kB`. Venía de
  976,88 kB (el CSS del monolito global a los chunks lazy); el historial le sumó ~14 kB —el cliente
  HTTP, el mapeo y el store entran en el paquete inicial porque el shell los usa— y el resto lo
  pusieron los dominios que entraron a la vez. Lo que queda por soltar son los generadores y
  semillas deterministas que siguen en `core/lobby.ts` y compañía, que se borran al migrar los
  dominios que aún son mock.
- **Deuda heredada de la Fase 5.5**, anotada en `scripts/arch-budgets.json` al integrarla y
  pendiente de pagar. No la metió la migración del CSS; venía en el código nuevo:
  - `font-floor` +19 (23 → 42): declaraciones nuevas por debajo de 11px, sobre todo en la barra
    de notificaciones y el buscador del shell. El suelo no es una recomendación (§ "UI kit").
  - `font-size-raw` +71 (390 → 461): `font-size` en px crudos en vez de la escala `--fs-*`.
  - `inline-template-size` +1 (21 → 22).

  Los tres han bajado, y ninguno por haberse arreglado: `font-floor` 37, `font-size-raw` 285 e
  `inline-template-size` 0. Lo que quedaba de esas declaraciones en las pantallas que retiró el
  historial se fue con ellas, y las plantillas las extrajo otra tarea. **Lo que sigue en pie
  sigue sin pagarse**: el suelo de 11px y la escala `--fs-*` sólo bajan cuando alguien toca esos
  textos a propósito, que es una decisión visual.
  No se corrigieron aquí a propósito: subir esos textos cambia el aspecto de features recién
  revisadas, y esa es una decisión visual, no mecánica.
