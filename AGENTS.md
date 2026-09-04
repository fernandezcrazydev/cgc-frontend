# cgc-frontend — Guía para agentes

**Las reglas de este proyecto viven en [`CLAUDE.md`](./CLAUDE.md). Léelo entero antes de tocar
código.** Este fichero no las repite a propósito: hasta septiembre de 2026 fue una copia completa
de `CLAUDE.md`, se desincronizó y acabó describiendo rutas huérfanas que ya no existían. Un
documento normativo duplicado es un documento normativo equivocado.

Vale para cualquier agente que lea `AGENTS.md` (Codex, Cursor, Copilot, Jules, Aider…). Gemini CLI
entra por `GEMINI.md`, que importa el mismo fichero.

## Lo mínimo, por si no sigues el enlace

SPA Angular 22 (standalone + signals) para organizar partidas custom de LoL. Se llama **Sale
Custom**. **UI en español.** Design system propio: tokens `--nf-*`, componentes `nf-*`.

```bash
npm start        # ng serve (dev, backend en http://localhost:8080)
npm run build    # ng build (production)
npm test         # ng test (vitest)
npm run arch     # reglas de arquitectura — CORRELO SIEMPRE ANTES DE TERMINAR
```

**Al acabar cualquier cambio: `npm run arch && npm test`.** Los dos tienen que pasar. CI ejecuta
lo mismo en cada PR.

### Las cinco que más se incumplen

1. **No escribas en `src/app/features/shell/views/views.scss`.** Está congelado. Lo que queda
   ahí (~4.000 líneas) son bloques que comparten varios componentes; todo lo demás ya vive en la
   hoja de su componente. El estilo nuevo va en `<componente>.scss` con `styleUrl`.
   `npm run arch` falla si el fichero crece una sola línea.
2. **Plantilla inline hasta ~150 líneas**; a partir de ahí, `templateUrl` en su propio `.html`.
3. **Capas**: `features → core | ui | shared`; `core → shared`; `ui` y `shared` no importan de
   nadie. `environment.apiUrl` solo dentro de un `*-api.ts`.
4. **La lógica de negocio es del backend.** Casi todo lo que hay en el front (matchmaking, MMR,
   validaciones) es placeholder desechable: no lo refactorices, no le añadas tests, no lo
   "dejes limpio". Se borrará entero cuando exista el endpoint. Lee § "Estrategia de migración
   mock → backend" en `CLAUDE.md` antes de tocar nada de eso.
5. **Nada de datos de red apareciendo de golpe**: todo lo que llega por HTTP se pinta con
   `<nf-skeleton>` de la misma forma y tamaño que el contenido final. Y hay que distinguir
   siempre cargando / error / vacío / no existe.

### Convenciones que se notan enseguida

- Copy **en frase normal**, en español, sin MAYÚSCULAS decorativas. Los enums del backend
  (`OWNER`, `CONFIRMED`) y las siglas (`KDA`, `MVP`, `CS`) sí van en mayúsculas: son valores.
- Los colores se nombran por lo que **significan** (`--nf-primary`, `--nf-danger`), nunca por el
  color (`--nf-pink` acabó pintando azul).
- Nada de `font-size` por debajo de 11px. Nada de `100vh`/`100vw` a pelo (usa `var(--nf-vh)`).
- Los mensajes de error los escribe el front en español, desde `MESSAGES_BY_CODE` en
  `core/http/api-error.ts`. El `detail` que manda el backend **nunca se pinta**.

Todo lo demás —patrón de store, checklist de endpoints, manejo de errores HTTP, temas, testing,
deuda conocida— está en `CLAUDE.md`.
