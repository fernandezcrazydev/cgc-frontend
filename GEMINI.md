# cgc-frontend — contrato de ejecución para un agente que no decide

> **⚠ Ningún CLI carga este fichero solo.** Se comprobó el 2026-09-10 contra el CLI de Antigravity
> (`agy`), que es el que se usa aquí: no lee `CLAUDE.md`, ni `GEMINI.md`, ni `AGENTS.md`.
> Preguntado a bocajarro qué fichero `.scss` está congelado, responde «NO LO SÉ».
>
> **Consecuencia práctica:** el prompt que lanza una tarea tiene que decir explícitamente qué leer,
> y lo que se le pasa —su ficha de `tareas/`— tiene que ser **autosuficiente de verdad**, porque
> detrás no hay ninguna red. `herramientas/ejecutar-ficha.mjs` (fuera del repositorio) ya lo hace.
>
> Este documento sigue valiendo como el contrato al que apuntar: «lee `CLAUDE.md` y `GEMINI.md`
> antes de empezar». Lo que no vale es suponer que alguien lo abrió por ti.

Las reglas del proyecto viven en un único fichero, `CLAUDE.md`. Si tu CLI resuelve la sintaxis
`@fichero`, estos dos entran solos:

@CLAUDE.md

@AGENTS.md

Si no la resuelve —lo normal—, **abre y lee `CLAUDE.md` entero antes de escribir nada.** No
trabajes solo con este resumen.

---

## 0. Tu papel en este proyecto

Este proyecto se construye con **dos agentes y un reparto explícito**:

- **Claude decide.** Elige la disposición de cada pantalla, resuelve las contradicciones con
  `FlujoJuego.md` y escribe la especificación.
- **Tú ejecutas.** Conviertes una especificación ya cerrada en código que pasa el trinquete.

No es una jerarquía, es economía: tú eres mucho más rápido y barato, así que el bucle largo
—implementar, y sobre todo las decenas de correcciones que el usuario va pidiendo mirando la
pantalla— es tuyo. Lo que sale caro no es que escribas mal una regla de CSS: eso lo caza
`npm run arch` en un segundo. Lo que sale caro es que **tomes una decisión de diseño en silencio**,
porque eso no lo caza ningún script y aparece tres pantallas después.

### Tu punto de entrada es una ficha, no el roadmap

Cada tarea llega como un fichero **`tareas/<ID>.md`**. Contiene el objetivo, los ficheros exactos,
el wireframe ya aprobado, las primitivas y tokens obligatorios, lo que no debes tocar y una
checklist de aceptación. **Está escrita para que no necesites abrir `Roadmap.md`.**

Lees: tu ficha, `CLAUDE.md`, y los ficheros que la ficha nombre. **Nada más.** `Roadmap.md` pesa
355 KB y `FlujoJuego.md` 110 KB; si crees que necesitas algo de ellos, localiza la sección con
`grep -n "^#\{1,4\} " ../Roadmap.md` y lee solo ese tramo — nunca el fichero entero.

## 1. Qué decides tú y qué no

| Decides solo | Paras y preguntas |
|---|---|
| Nombres de variables y de clases CSS | La disposición de una pantalla o su jerarquía visual |
| Orden de las propiedades dentro de una regla | El **copy** que ve el usuario, si no está en la ficha |
| Cómo partir una función o un `computed` | Qué campos o métricas se enseñan |
| Qué fichero de un componente toca | Si algo es `Placeholder` o `Permanente` (§ "Estrategia de migración") |
| Cómo escribir el test de un store | Tocar un presupuesto de `scripts/arch-budgets.json` |

**Nunca subas un presupuesto de `arch-budgets.json`.** Si una regla empeora, el que está mal es el
código. Bajarlo con `npm run arch:fix` cuando de verdad mejora sí es correcto.

### La regla de los dos intentos

Si algo no sale en **dos** vueltas, no pruebes una tercera. Escribe en la sección `## Dudas` de tu
ficha qué intentaste, qué falla y qué necesitas, y **para**. Un traspaso de dos líneas cuesta
infinitamente menos que veinte intentos a ciegas, y el usuario prefiere enterarse pronto.

Lo mismo si al ejecutar la ficha te encuentras con que **falta una decisión**: no la inventes, no
elijas «la opción razonable». Va a `## Dudas` y paras.

## 2. El bucle de cierre, obligatorio

```bash
npm run arch     # trinquete de arquitectura (<1s). Te dice qué regla y en qué línea
npm test         # vitest
```

**«Hecho» sin los dos en verde no es hecho.** No lo anuncies, no escribas changelog, no marques
nada como completado. `npm run arch` tarda menos de un segundo: ejecútalo después de cada tanda de
ediciones, no al final.

El trinquete verifica hoy **quince** reglas, entre ellas cinco que se añadieron el 2026-09-10
precisamente porque eran las que más se incumplían sin que nadie se diera cuenta: `emoji-free`,
`legacy-angular`, `onpush`, `ng-deep` y `toast-literal`. Si el check pasa, esas quince ya no hay
que revisarlas a mano.

## 3. Resumen operativo

SPA **Angular 22** (standalone + signals) para organizar partidas custom de LoL entre grupos. La
app se llama **Sale Custom**. **Toda la UI va en español.** Design system propio: tokens `--nf-*`,
componentes `nf-*`.

```bash
npm start        # ng serve (dev, backend en http://localhost:8080)
npm run build    # ng build (production)
npm test         # ng test (vitest)
npm run arch     # reglas de arquitectura (trinquete; CI lo ejecuta en cada PR)
```

## 4. Lo que más se incumple (léelo aunque no leas nada más)

1. **`src/app/features/shell/views/views.scss` está congelado. Cero líneas nuevas.** Lo que
   queda ahí (~3.000 líneas) son bloques compartidos por varios componentes a propósito; el resto
   ya se movió a la hoja de cada componente. El estilo nuevo va en `<componente>.scss` con
   `styleUrl`. `npm run arch` falla si el fichero crece una sola línea.
2. **Plantilla inline hasta ~150 líneas**; a partir de ahí `templateUrl` en su propio `.html`.
3. **Dirección de dependencias**: `features → core | ui | shared`; `core → shared`; `ui` y
   `shared` no importan de nadie; una feature no importa internals de otra; `environment.apiUrl`
   solo dentro de un `*-api.ts`.
4. **La regla de negocio es del backend, no tuya.** Matchmaking, MMR, validaciones de draft, TTL
   de salas, ids, timestamps: lo que hay en el front es **placeholder desechable** que se borrará
   entero cuando exista el endpoint. No lo refactorices, no lo extraigas a servicios "para dejarlo
   limpio", no le escribas tests. Si tienes que tocarlo: cambio mínimo + comentario
   `BACKEND NOTE:` explicando qué deberá hacer el servidor.
5. **Ningún dato de red aparece de golpe.** Todo lo que llega por HTTP se pinta con
   `<nf-skeleton>` de la misma forma, tamaño y márgenes que el contenido final (cero layout
   shift). Y se distingue siempre **cargando / error / vacío / no existe** — nunca
   `@if (dato) {...} @else {404}`, que parpadea un 404 falso con latencia real.

## 5. Errores frecuentes de agentes en este repo

Los marcados con **[arch]** ya los caza el trinquete y no hace falta revisarlos a mano; los demás
dependen de que los apliques al construir.

- **[arch] Emojis en la interfaz.** Los iconos son **SVG inline con `currentColor`**, la
  convención que `CLAUDE.md` documenta para `NfIconButton`. No hay librería de iconos: los trazos
  se escriben a mano. Un emoji lo dibuja el sistema operativo, cambia entre Windows y Android, y
  no obedece a `currentColor` ni a los tokens. Ojo con los **estados vacíos** y las **etiquetas de
  acción**, que es donde más se cuelan. Los caracteres tipográficos que la app sí usa (`✓`, `★`,
  `▾`, `›`, `·`) no son emojis y no entran aquí; el emoji del selector y de las reacciones tampoco,
  porque ahí el emoji **es** el dato que escribe el usuario.
- **Escribir en inglés.** Copy, comentarios y mensajes de error: español. En frase normal, sin
  MAYÚSCULAS ni glifos decorativos. Los enums del backend (`OWNER`, `CONFIRMED`) y las siglas
  (`KDA`, `MVP`, `CS`) sí van en mayúsculas porque *son* así.
- **[arch] `catch { toasts.error('No se pudo...') }`.** Prohibido. Va
  `this.toasts.error(errorMessage(e))`, importando de `core/http`. El catálogo de mensajes vive en
  `MESSAGES_BY_CODE` (`core/http/api-error.ts`). El campo `detail` del backend viene en inglés y
  **nunca se pinta**: es solo para logs.
- **Tratar el 401 endpoint a endpoint.** Ya está resuelto de forma central en
  `core/http/session-recovery.ts`. Excepción: transportes que esquivan `HttpClient` (el stream SSE
  de notificaciones) piden la renovación a mano.
- **Nombrar por color.** `--nf-primary`, `--nf-danger`, `color="success"` — nunca `--nf-pink`, que
  ya acabó pintando azul. Única excepción: los bandos de LoL (`'blue' | 'red'`), que son dominio.
- **[arch] `font-size` en px crudos.** Usa la escala `--fs-*` de `styles/tokens/typography.css`
  (`var(--fs-label)`, `var(--fs-body)`...). Nada por debajo de 11px. Y nunca `100vh`/`100vw` a
  pelo: el zoom del `:root` los desvía un 10%, usa `calc(var(--nf-vh) * 100)`.
- **[arch] Estilar el interior de una primitiva `nf-*`** con un selector descendente: la
  encapsulación de tu hoja no llega a sus hijos internos. Expón una custom property en la primitiva
  y fíjala sobre el host (ver `nf-pagination.scss`). Nunca `::ng-deep`.
- **Escrituras optimistas.** Por defecto son pesimistas: botón deshabilitado (`pending`), `await`
  de la confirmación, y **solo entonces** toast y/o navegación.
- **[arch] Angular antiguo.** `input()`/`output()`/`model()`, no `@Input()`/`@Output()`/
  `EventEmitter`. `inject()`, no DI por constructor. `@if`/`@for`/`@switch`, no `*ngIf`/`*ngFor`.
  `ChangeDetectionStrategy.OnPush` en todo componente nuevo.
- **Crear markup ad-hoc** para modales, paginación o tabs: ya existen `NfModal`, `NfPagination` y
  `NfSegmented` en `src/app/ui/`. Mira ahí antes de escribir CSS.
- **Varios desplegables abiertos a la vez.** Es norma de toda la aplicación: dentro de una pantalla,
  abrir un desplegable **pliega el que estuviera abierto**. Se comporta como un acordeón.

El detalle completo de cada uno de estos puntos —patrón de store asíncrono, checklist de
casuísticas al conectar un endpoint, mapa de errores HTTP, temas, testing, deuda conocida— está
en `CLAUDE.md`.
