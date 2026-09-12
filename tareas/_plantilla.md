# [F5.5-XX] Título del ítem

> **Qué es este fichero.** La especificación completa de una tarea, escrita por Claude y ejecutada
> por Gemini. Su único criterio de calidad: **quien la ejecuta no debe necesitar abrir `Roadmap.md`
> ni `FlujoJuego.md`.** Si hace falta consultarlos, la ficha está mal escrita.
>
> Se borra la ficha cuando el ítem se marca ✅ en `Roadmap.md` §5.5.0 y su changelog está escrito.

- **Estado en el catálogo:** 🚧 EN PROGRESO · marcado el AAAA-MM-DD
- **Sección del roadmap:** `Roadmap.md` §5.5.XX (líneas NNNN-NNNN) — referencia, no lectura obligada
- **Dominio:** `FlujoJuego.md` §N.N — lo que manda si algo se contradice

## Objetivo

Una frase. Qué tiene que poder hacer el usuario cuando esto esté terminado.

## Ficheros

Rutas exactas. Nada de «y los ficheros relacionados».

| Acción | Ruta |
|---|---|
| crear | `src/app/features/shell/views/<carpeta>/<componente>.ts` |
| crear | `src/app/features/shell/views/<carpeta>/<componente>.scss` |
| modificar | `src/app/...` — qué cambia exactamente |
| ruta | `src/app/app.routes.ts` — `loadComponent` + `title` |

## Wireframe aprobado

La disposición ya está decidida. **No se reinterpreta.**

```text
┌──────────────────────────────────────────┐
│                                          │
└──────────────────────────────────────────┘
```

Notas de densidad, jerarquía y copy exacto que se ve en pantalla.

## Datos

> **De dónde sale cada número de la pantalla.** El backend casi no existe todavía, así que **el
> dato hay que fabricarlo**, y ahí está el peligro: no es que falte, es que salga **distinto** del
> que ya enseña otra pantalla. Ahri con 54 % de winrate aquí y 61 % en la tierlist es la aplicación
> contradiciéndose. Ya pasó: `core/seed-matches.ts` existe porque la identidad de las partidas de
> la semilla estaba copiada en dos generadores.

| Bloque de la pantalla | De dónde sale | Endpoint futuro |
|---|---|---|
| … | reutiliza `core/<fichero>.ts` | `GET /...` |
| … | **crear** en `core/<fichero>.ts`, sembrado con `hash(championId)` | `GET /...` |

- **Primero se mira si ya existe.** Generadores y semillas disponibles: `seed-matches.ts`,
  `player-profile.ts`, `member-detail.ts`, `group-stats.ts`, `group-medals.ts`, `group-hub.ts`,
  `lobby.ts`, `lobby-extras.ts`. Los helpers deterministas son `seeded(seed)` y `hash(str)`, y
  viven en `core/group-ranking.ts`.
- **Si hay que crear semilla nueva**, va en `core/`, **nunca en línea dentro del componente**, y se
  siembra con una clave estable (el id de la entidad) para que dos pantallas que enseñen lo mismo
  saquen lo mismo.
- **`BACKEND NOTE:`** en cada punto de integración, diciendo qué endpoint lo sustituirá y que este
  bloque se borra entero al migrar.

## Enlaces

> **A dónde lleva cada cosa que se pinta.** Un campeón, un jugador, un grupo o una partida en
> pantalla son **entidades navegables**, y si no se enlazan quedan como píxeles muertos que nadie
> vuelve a revisar. Medido el 2026-09-11: 23 ficheros pintan campeones y **solo 7 enlazan**; 37
> pintan jugadores y **solo 7 enlazan**.
>
> Si el destino definitivo todavía no existe, **el destino provisional se escribe aquí con sus
> parámetros**, no se deja a criterio de quien ejecuta.

| Entidad que pinta | Destino definitivo | Destino provisional | Lo desbloquea |
|---|---|---|---|
| Campeón | `/app/grupos/:id/campeon/:championId` | `/app/grupos/:id/tierlist?campeon=:championId` | `[F5.5-19]` |
| Jugador | `/app/jugador/:playerId` | — (ya existe) | — |
| … | | | |

- Si una entidad **no** debe ser pulsable en esta pantalla, se dice **por qué** en esta misma tabla.
  En un marcador, por ejemplo, puede interesar más que lo pulsable sea el jugador y no el campeón.
- Toda ruta nueva se da de alta en `ROUTE_TITLES` de `features/shell/shell-nav.ts` y lleva `title`.
  Las dos cosas las verifica `npm run arch` (`nav-label` y `route-title`), así que no es opcional.

## Obligatorio

- Primitivas de `src/app/ui/` que hay que usar: `NfModal`, `NfSegmented`, `NfSkeleton`…
- Tokens concretos: `--nf-...`, escala `--fs-...`.
- Estados que hay que cubrir: cargando (`nf-skeleton` sin layout shift) / error / vacío / no existe.
- Iconos: **SVG inline con `currentColor`**. Cero emojis.
- Un solo desplegable abierto a la vez, si la pantalla tiene varios.
- **Ruta**: `loadComponent` perezoso **con `title`**, y su segmento dado de alta en
  `features/shell/shell-nav.ts` para que la barra superior sepa rotularlo.

### Que no se cierre la puerta al móvil

No hay que diseñar la versión móvil aquí —eso es un repaso propio al final—, pero sí **no impedirla**,
porque estas cuatro cosas son baratas ahora e imposibles de retrofitar sin rediseñar:

- **Nada de anchos fijos** en contenedores: unidades fluidas, `min-width`/`max-width`.
- **Todo lo ancho** —tablas, marcadores, rejillas de campeones— dentro de un contenedor con
  `overflow-x: auto`. El cuerpo de la página no debe hacer scroll horizontal nunca.
- **Nada que dependa de `hover`**: un menú o un dato que solo aparece al pasar el ratón está muerto
  en táctil. Si hay información esencial en un tooltip, tiene que existir otro camino a ella.
- **Áreas táctiles de `$touch` (44px)** en lo interactivo.

> ⚠ **El shell conmuta su layout a 760px por `matchMedia` en `shell.ts`**, no solo por CSS. Eso
> significa que **el DOM cambia** en ese píxel: comprueba la pantalla a 759px aunque no la estés
> diseñando para móvil, o el markup y las hojas se contradicen. Los tres escalones están en
> `src/styles/_breakpoints.scss` (`$bp-compact: 860px`, `$bp-mobile: 760px`, `$bp-narrow: 420px`) y
> se consumen con `@use 'breakpoints' as *;`.

### Los dos temas

La aplicación tiene dos skins: `nocturne` (por defecto, en `styles/tokens/`) y `original`
(`styles/themes/original.css`). **Una skin es solo CSS**: si para cambiar de tema hiciera falta
tocar markup, el que está mal es el markup.

- Los colores salen **siempre** de un token `var(--nf-*)`. Ningún literal hexadecimal.
- **Si esta pantalla estrena un token de color**, hay que decidir su valor **en las dos skins**, no
  solo en la de por defecto. Si no se redefine, hereda el valor de `nocturne` — no se rompe, pero
  se pinta con un color afinado para otra paleta y nadie se entera.

## Prohibido

- Tocar `src/app/features/shell/views/views.scss` (congelado).
- Subir cualquier presupuesto de `scripts/arch-budgets.json`.
- **Refactorizar** la lógica `Placeholder` que ya existe, o escribirle tests. **Ojo: refactorizar
  el placeholder que hay no es lo mismo que crear el que falta** — lo que la pantalla necesite para
  pintarse se fabrica según `## Datos`.
- Cambiar copy, disposición o qué campos se enseñan respecto al wireframe de arriba.
- Añadir dependencias nuevas al `package.json`.

## Aceptación

Una línea por punto, todas verificables mirando la pantalla o ejecutando algo. **Se marcan al
terminar cada sesión**: es lo que permite retomar el ítem sin releer nada más.

- [ ] `npm run arch` en verde, sin haber tocado ningún presupuesto.
- [ ] `npm test` en verde.
- [ ] Los datos que enseña **cuadran con los de las pantallas que ya enseñan lo mismo**.
- [ ] A 759px de ancho no hay scroll horizontal en el cuerpo ni nada cortado.
- [ ] Se ve bien en las dos skins (Ajustes → tema).
- [ ] La barra superior rotula la pantalla y la pestaña del navegador tiene título.
- [ ] …

## Dudas

> Vacío al empezar. **Lo rellena Gemini y para.** Rige la regla de los dos intentos: si algo no
> sale en dos vueltas, o falta una decisión que no está en esta ficha, se escribe aquí qué se
> intentó y qué falla — no se inventa la decisión ni se prueba una tercera vez.
