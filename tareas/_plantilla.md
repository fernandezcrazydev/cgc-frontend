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

## Obligatorio

- Primitivas de `src/app/ui/` que hay que usar: `NfModal`, `NfSegmented`, `NfSkeleton`…
- Tokens concretos: `--nf-...`, escala `--fs-...`, puntos de corte de `_breakpoints.scss`.
- Estados que hay que cubrir: cargando (`nf-skeleton` sin layout shift) / error / vacío / no existe.
- Iconos: **SVG inline con `currentColor`**. Cero emojis.
- Un solo desplegable abierto a la vez, si la pantalla tiene varios.

## Prohibido

- Tocar `src/app/features/shell/views/views.scss` (congelado).
- Subir cualquier presupuesto de `scripts/arch-budgets.json`.
- Refactorizar lógica `Placeholder` (algoritmos de negocio, datos semilla) o escribirle tests.
- Cambiar copy, disposición o qué campos se enseñan respecto al wireframe de arriba.
- Añadir dependencias nuevas al `package.json`.

## Aceptación

Una línea por punto, todas verificables mirando la pantalla o ejecutando algo.

- [ ] `npm run arch` en verde, sin haber tocado ningún presupuesto.
- [ ] `npm test` en verde.
- [ ] …

## Dudas

> Vacío al empezar. **Lo rellena Gemini y para.** Rige la regla de los dos intentos: si algo no
> sale en dos vueltas, o falta una decisión que no está en esta ficha, se escribe aquí qué se
> intentó y qué falla — no se inventa la decisión ni se prueba una tercera vez.
