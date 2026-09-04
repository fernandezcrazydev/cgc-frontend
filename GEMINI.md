# cgc-frontend — contexto para Gemini CLI

Las reglas del proyecto viven en un único fichero. Se importa aquí para que entren en tu contexto:

@CLAUDE.md

@AGENTS.md

Si tu versión de Gemini CLI no resuelve la sintaxis `@fichero`, abre y lee `CLAUDE.md` entero
antes de escribir nada. No trabajes solo con este resumen.

---

## Resumen operativo

SPA **Angular 22** (standalone + signals) para organizar partidas custom de LoL entre grupos. La
app se llama **Sale Custom**. **Toda la UI va en español.** Design system propio: tokens `--nf-*`,
componentes `nf-*`.

```bash
npm start        # ng serve (dev, backend en http://localhost:8080)
npm run build    # ng build (production)
npm test         # ng test (vitest)
npm run arch     # reglas de arquitectura (trinquete; CI lo ejecuta en cada PR)
```

**Criterio de "terminado": `npm run arch && npm test` en verde.** No des un cambio por bueno sin
ejecutar los dos. `npm run arch` tarda menos de un segundo y te dice exactamente qué regla de
`CLAUDE.md` has roto y dónde.

## Lo que más se incumple (léelo aunque no leas nada más)

1. **`src/app/features/shell/views/views.scss` está congelado. Cero líneas nuevas.** Lo que
   queda ahí (~4.000 líneas) son bloques compartidos por varios componentes a propósito; el resto
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

## Errores frecuentes de agentes en este repo

- **Escribir en inglés.** Copy, comentarios y mensajes de error: español. En frase normal, sin
  MAYÚSCULAS ni glifos decorativos. Los enums del backend (`OWNER`, `CONFIRMED`) y las siglas
  (`KDA`, `MVP`, `CS`) sí van en mayúsculas porque *son* así.
- **`catch { toasts.error('No se pudo...') }`.** Prohibido. Va
  `this.toasts.error(errorMessage(e))`, importando de `core/http`. El catálogo de mensajes vive en
  `MESSAGES_BY_CODE` (`core/http/api-error.ts`). El campo `detail` del backend viene en inglés y
  **nunca se pinta**: es solo para logs.
- **Tratar el 401 endpoint a endpoint.** Ya está resuelto de forma central en
  `core/http/session-recovery.ts`. Excepción: transportes que esquivan `HttpClient` (el stream SSE
  de notificaciones) piden la renovación a mano.
- **Nombrar por color.** `--nf-primary`, `--nf-danger`, `color="success"` — nunca `--nf-pink`, que
  ya acabó pintando azul. Única excepción: los bandos de LoL (`'blue' | 'red'`), que son dominio.
- **`font-size` en px crudos.** Usa la escala `--fs-*` de `styles/tokens/typography.css`
  (`var(--fs-label)`, `var(--fs-body)`...). Nada por debajo de 11px. Y nunca `100vh`/`100vw` a
  pelo: el zoom del `:root` los desvía un 10%, usa `calc(var(--nf-vh) * 100)`. Los tres los caza
  `npm run arch`.
- **Estilar el interior de una primitiva `nf-*`** con un selector descendente: la encapsulación
  de tu hoja no llega a sus hijos internos. Expón una custom property en la primitiva y fíjala
  sobre el host (ver `nf-pagination.scss`). Nunca `::ng-deep`.
- **Escrituras optimistas.** Por defecto son pesimistas: botón deshabilitado (`pending`), `await`
  de la confirmación, y **solo entonces** toast y/o navegación.
- **Angular antiguo.** `input()`/`output()`/`model()`, no `@Input()`/`@Output()`/`EventEmitter`.
  `inject()`, no DI por constructor. `@if`/`@for`/`@switch`, no `*ngIf`/`*ngFor`.
  `ChangeDetectionStrategy.OnPush` en todo componente nuevo.
- **Crear markup ad-hoc** para modales, paginación o tabs: ya existen `NfModal`, `NfPagination` y
  `NfSegmented` en `src/app/ui/`. Mira ahí antes de escribir CSS.

El detalle completo de cada uno de estos puntos —patrón de store asíncrono, checklist de
casuísticas al conectar un endpoint, mapa de errores HTTP, temas, testing, deuda conocida— está
en `CLAUDE.md`.
